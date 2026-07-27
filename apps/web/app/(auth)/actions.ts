'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Só aceita caminhos internos (evita open redirect via ?next=https://...). */
function safeRedirectTarget(raw: FormDataEntryValue | null, fallback: string): string {
  const value = String(raw ?? '');
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return fallback;
}

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha inválidos.' };
  redirect(safeRedirectTarget(formData.get('redirectTo'), '/dashboard'));
}

export async function signUp(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  if (password.length < 8) return { error: 'A senha deve ter ao menos 8 caracteres.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  // Se veio de um convite (?next=/accept-invite?code=...), não manda para o
  // onboarding de criar organização — o convite já resolve isso.
  redirect(safeRedirectTarget(formData.get('redirectTo'), '/onboarding'));
}

export async function requestPasswordReset(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);
  // Não revela se o e-mail existe (evita enumeração de contas).
  return { ok: 'Se o e-mail existir, enviaremos as instruções de recuperação.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
