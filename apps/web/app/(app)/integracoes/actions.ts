'use server';
import { revalidatePath } from 'next/cache';
import { requireCurrentOrg, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/services/sync';
import { login, verifyLoginCode, sealToken, openToken, ProviderError, type BambuRegion } from '@bambu/providers';

function encryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) throw new Error('CREDENTIALS_ENCRYPTION_KEY não configurada.');
  return key;
}

/**
 * Conecta a Bambu Cloud. Em modo demo (BAMBU_LIVE_ENABLED != true) cria uma
 * conexão simulada já "connected". Em modo live, faz login de verdade contra
 * a Bambu Cloud (login + verificação por e-mail) — ver
 * packages/providers/src/bambu-auth.ts. A API não é oficial/documentada:
 * pode falhar, mudar de formato ou ser bloqueada pela Bambu sem aviso.
 * A senha NUNCA é persistida — só o token retornado, criptografado.
 */
export async function connectBambu(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem conectar integrações.' };

  const displayName = String(formData.get('displayName') ?? 'Bambu Cloud').trim();
  const supabase = await createClient();
  const live = process.env.BAMBU_LIVE_ENABLED === 'true';

  if (!live) {
    const { error } = await supabase.from('provider_connections').insert({
      organization_id: org.organizationId,
      provider: 'bambu_cloud',
      display_name: displayName,
      status: 'connected',
      encrypted_credentials: null,
    });
    if (error) return { error: error.message };
    revalidatePath('/integracoes');
    return { ok: 'Conexão simulada criada (modo demo).' };
  }

  const account = String(formData.get('account') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const region = (String(formData.get('region') ?? 'global') as BambuRegion) || 'global';
  if (!account || !password) return { error: 'Informe e-mail e senha da conta Bambu.' };

  let key: string;
  try {
    key = encryptionKey();
  } catch (err) {
    return { error: (err as Error).message };
  }

  try {
    const result = await login(account, password, region);

    if (result.needsVerification) {
      // Guarda só account/region (não a senha) até o código chegar por e-mail.
      const pendingEnvelope = sealToken({ account, region }, key);
      const { error } = await supabase.from('provider_connections').insert({
        organization_id: org.organizationId,
        provider: 'bambu_cloud',
        display_name: displayName,
        status: 'pending_verification',
        encrypted_credentials: pendingEnvelope,
      });
      if (error) return { error: error.message };
      revalidatePath('/integracoes');
      return { ok: 'Conexão criada. Digite o código enviado por e-mail para confirmar.' };
    }

    // Login direto sem verificação — já grava o token.
    const tokenEnvelope = sealToken(
      { account, region, accessToken: result.accessToken, refreshToken: result.refreshToken },
      key,
    );
    const expiresAt = result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString() : null;
    const { error } = await supabase.from('provider_connections').insert({
      organization_id: org.organizationId,
      provider: 'bambu_cloud',
      display_name: displayName,
      status: 'connected',
      encrypted_credentials: tokenEnvelope,
      token_expires_at: expiresAt,
    });
    if (error) return { error: error.message };
    revalidatePath('/integracoes');
    return { ok: 'Conectado com sucesso!' };
  } catch (err) {
    const message =
      err instanceof ProviderError
        ? err.message
        : 'Não foi possível conectar à Bambu Cloud. Tente novamente em instantes.';
    return { error: message };
  }
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

/** Verifica o código de autenticação enviado por e-mail pela Bambu Cloud. */
export async function verifyBambuCode(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem verificar integrações.' };

  const connectionId = String(formData.get('connectionId') ?? '');
  const code = String(formData.get('code') ?? '').trim().toUpperCase();

  if (!connectionId || !code) {
    return { error: 'Código e conexão são obrigatórios.' };
  }
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    return { error: 'Código inválido — verifique o e-mail e tente novamente.' };
  }

  const supabase = await createClient();
  const live = process.env.BAMBU_LIVE_ENABLED === 'true';

  if (!live) {
    // Modo demo: aceita qualquer código válido e marca como conectado
    // (não há credenciais reais envolvidas).
    const { error } = await supabase
      .from('provider_connections')
      .update({ status: 'connected', last_error_message: null, last_error_code: null })
      .eq('id', connectionId)
      .eq('organization_id', org.organizationId);
    if (error) return { error: error.message };
    revalidatePath('/integracoes');
    return { ok: 'Conexão verificada com sucesso! (modo demo)' };
  }

  let key: string;
  try {
    key = encryptionKey();
  } catch (err) {
    return { error: (err as Error).message };
  }

  const { data: conn } = await supabase
    .from('provider_connections')
    .select('encrypted_credentials')
    .eq('id', connectionId)
    .eq('organization_id', org.organizationId)
    .single();
  if (!conn?.encrypted_credentials) {
    return { error: 'Conexão não encontrada ou sem dados pendentes.' };
  }

  try {
    const pending = openToken<{ account: string; region: BambuRegion }>(conn.encrypted_credentials, key);
    const result = await verifyLoginCode(pending.account, code, pending.region);

    const tokenEnvelope = sealToken(
      {
        account: pending.account,
        region: pending.region,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      key,
    );
    const expiresAt = result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString() : null;

    const { error } = await supabase
      .from('provider_connections')
      .update({
        status: 'connected',
        encrypted_credentials: tokenEnvelope,
        token_expires_at: expiresAt,
        last_error_message: null,
        last_error_code: null,
      })
      .eq('id', connectionId)
      .eq('organization_id', org.organizationId);
    if (error) return { error: error.message };

    revalidatePath('/integracoes');
    return { ok: 'Conexão verificada com sucesso!' };
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : 'Falha ao verificar o código.';
    await supabase
      .from('provider_connections')
      .update({ last_error_code: 'verification_failed', last_error_message: message })
      .eq('id', connectionId)
      .eq('organization_id', org.organizationId);
    revalidatePath('/integracoes');
    return { error: message };
  }
}

/** Reinicia o login para reenviar o código (a Bambu Cloud não expõe um "resend" isolado). */
export async function resendBambuCode(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) return { error: 'Apenas owner/admin podem reenviar código.' };

  const connectionId = String(formData.get('connectionId') ?? '');
  if (!connectionId) return { error: 'Conexão não encontrada.' };

  const live = process.env.BAMBU_LIVE_ENABLED === 'true';
  if (!live) {
    return { ok: 'Código reenviado (modo demo, não há e-mail real).' };
  }

  const supabase = await createClient();
  let key: string;
  try {
    key = encryptionKey();
  } catch (err) {
    return { error: (err as Error).message };
  }

  const { data: conn } = await supabase
    .from('provider_connections')
    .select('encrypted_credentials')
    .eq('id', connectionId)
    .eq('organization_id', org.organizationId)
    .single();
  if (!conn?.encrypted_credentials) return { error: 'Conexão não encontrada.' };

  // A Bambu Cloud não tem endpoint de "reenviar código" — o único jeito
  // (documentado pela comunidade) é reiniciar o login. Sem a senha guardada
  // (nunca persistimos), não é possível reenviar automaticamente aqui.
  return {
    error: 'Não é possível reenviar automaticamente. Desconecte e conecte novamente com sua senha para receber um novo código.',
  };
}
