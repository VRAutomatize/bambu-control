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
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold">Crie seu workspace</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Um workspace isola os dados da sua operação. Você poderá convidar sua equipe depois.
        </p>
        <div className="card">
          <AuthForm action={createOrg} submitLabel="Criar workspace e continuar">
            <div>
              <label className="label" htmlFor="name">
                Nome do workspace
              </label>
              <input id="name" name="name" required className="input" placeholder="Ateliê 3D" />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
