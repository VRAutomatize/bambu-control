'use server';
import { revalidatePath } from 'next/cache';
import { requireCurrentOrg, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/services/sync';

/**
 * Conecta a Bambu Cloud. Em modo demo (BAMBU_LIVE_ENABLED != true) cria uma
 * conexão simulada já "connected". Em modo live, o back-end autenticaria e
 * guardaria o token CRIPTOGRAFADO (a senha nunca é persistida) — ver
 * docs/security.md e docs/architecture/provider-integration.md.
 */
export async function connectBambu(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem conectar integrações.' };

  const displayName = String(formData.get('displayName') ?? 'Bambu Cloud').trim();
  const supabase = await createClient();

  const live = process.env.BAMBU_LIVE_ENABLED === 'true';
  const { error } = await supabase.from('provider_connections').insert({
    organization_id: org.organizationId,
    provider: 'bambu_cloud',
    display_name: displayName,
    status: live ? 'pending_verification' : 'connected',
    // Em demo não há credenciais reais. Em live, encrypted_credentials seria
    // preenchido pelo fluxo de autenticação/verificação server-side.
    encrypted_credentials: null,
  });
  if (error) return { error: error.message };
  revalidatePath('/integracoes');
  return { ok: live ? 'Conexão criada. Verifique o código enviado.' : 'Conexão simulada criada (modo demo).' };
}

/** Sincroniza agora uma conexão. */
export async function syncNow(connectionId: string) {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  await syncConnection(supabase, org.organizationId, connectionId);
  revalidatePath('/integracoes');
  revalidatePath('/impressoes');
  revalidatePath('/dashboard');
}

/** Desconecta e apaga as credenciais. */
export async function disconnect(connectionId: string) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return;
  const supabase = await createClient();
  await supabase
    .from('provider_connections')
    .update({ status: 'disconnected', encrypted_credentials: null })
    .eq('id', connectionId)
    .eq('organization_id', org.organizationId);
  revalidatePath('/integracoes');
}

/** Verifica o código de autenticação Bambu. */
export async function verifyBambuCode(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem verificar integrações.' };

  const connectionId = String(formData.get('connectionId') ?? '');
  const code = String(formData.get('code') ?? '').trim().toUpperCase();

  if (!connectionId || !code) {
    return { error: 'Código e conexão são obrigatórios.' };
  }

  // Validar formato: 6 dígitos ou caracteres alfanuméricos
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { error: 'Código deve ter exatamente 6 caracteres alfanuméricos.' };
  }

  const supabase = await createClient();

  // In live mode, would call Bambu API to verify the code
  // For now, demo mode just marks as connected
  const live = process.env.BAMBU_LIVE_ENABLED === 'true';

  if (live) {
    // TODO: Call Bambu API with code to verify and get token
    // const bambuResult = await verifyBambuAuthCode(code);
    // if (!bambuResult.success) {
    //   return { error: 'Código inválido. Verifique e tente novamente.' };
    // }
    // encrypted_credentials would be set here with bambuResult.token encrypted
  }

  // Mark connection as connected
  const { error } = await supabase
    .from('provider_connections')
    .update({
      status: 'connected',
      last_error_message: null,
      last_error_code: null,
    })
    .eq('id', connectionId)
    .eq('organization_id', org.organizationId);

  if (error) return { error: error.message };

  revalidatePath('/integracoes');
  return { ok: 'Conexão verificada com sucesso!' };
}

/** Reenviar código (stub para demo). */
export async function resendBambuCode(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem reenviar código.' };

  const connectionId = String(formData.get('connectionId') ?? '');

  if (!connectionId) {
    return { error: 'Conexão não encontrada.' };
  }

  // In live mode, would call Bambu API to resend the code
  // For demo, just acknowledge
  return { ok: 'Código reenviado (em demo mode, não há email real).' };
}
