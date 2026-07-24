import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { ORG_COOKIE_NAME } from '@/lib/auth';
import { AuthForm } from '@/components/auth-form';

async function createOrg(_prev: unknown, formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  const currency = String(formData.get('currency') ?? 'BRL');
  const timezone = String(formData.get('timezone') ?? 'America/Sao_Paulo');
  if (name.length < 2) return { error: 'Informe o nome do workspace.' };

  const slug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || `org-${Date.now()}`;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: name,
    p_slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
    p_currency: currency,
    p_timezone: timezone,
  });
  if (error) return { error: `Não foi possível criar: ${error.message}` };

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE_NAME, data.id, { path: '/', httpOnly: false, sameSite: 'lax' });
  redirect('/dashboard');
}

export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-4 dark:bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,theme(colors.brand.100),transparent_70%)] dark:[background:radial-gradient(60%_50%_at_50%_0%,theme(colors.brand.900/.25),transparent_70%)]"
      />
      <div className="w-full max-w-[440px]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-b from-brand-400 to-brand-600 text-[17px] font-bold text-white shadow-sm">
            B
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-neutral-900 dark:text-neutral-50">
            Crie seu workspace
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] text-neutral-500 dark:text-neutral-400">
            Um workspace isola os dados da sua operação. Você poderá convidar sua equipe depois.
          </p>
        </div>
        <div className="card p-7">
          <AuthForm action={createOrg} submitLabel="Criar workspace e continuar">
            <div>
              <label className="label" htmlFor="name">
                Nome do workspace
              </label>
              <input id="name" name="name" required className="input" placeholder="Ateliê 3D" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="currency">
                  Moeda
                </label>
                <select id="currency" name="currency" className="input" defaultValue="BRL">
                  <option value="BRL">Real (BRL)</option>
                  <option value="USD">Dólar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="timezone">
                  Fuso horário
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  className="input"
                  defaultValue="America/Sao_Paulo"
                >
                  <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                  <option value="America/Manaus">America/Manaus</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </AuthForm>
        </div>
      </div>
    </div>
  );
}
