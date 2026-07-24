'use server';
import { requireCurrentOrg, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function inviteMember(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!isAdmin(org.role)) {
    return { error: 'Apenas owner/admin podem convidar membros.' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'viewer');

  if (!email || !email.includes('@')) {
    return { error: 'Email inválido.' };
  }

  if (!['owner', 'admin', 'operator', 'viewer'].includes(role)) {
    return { error: 'Papel inválido.' };
  }

  const supabase = await createClient();

  // Invite expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: org.organizationId,
      email,
      role: role as 'owner' | 'admin' | 'operator' | 'viewer',
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single();

  if (error) {
    if (error.message.includes('unique_pending_invite')) {
      return { error: 'Já existe um convite pendente para este email.' };
    }
    return { error: error.message };
  }

  if (!invite) {
    return { error: 'Não foi possível criar o convite.' };
  }

  // TODO: In production, send email with accept link via email service
  // For demo, log to console only (never expose via UI)
  const acceptLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/accept-invite?code=${invite.token}`;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEMO] Invite link for ${email}: ${acceptLink}`);
  }

  revalidatePath('/configuracoes');
  return {
    ok: true,
    message: `Convite enviado para ${email}. ${process.env.NODE_ENV === 'development' ? 'Verifique o console para o link em modo demo.' : 'Verá o link no email.'}`,
  };
}
