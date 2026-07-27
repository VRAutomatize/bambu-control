import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { signUp } from '../actions';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="card p-7">
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-0.01em]">Criar conta</h1>
      <p className="mb-6 text-[13.5px] text-neutral-500 dark:text-neutral-400">
        {next?.startsWith('/accept-invite')
          ? 'Crie sua conta para aceitar o convite recebido.'
          : 'Comece a controlar seus custos de impressão 3D.'}
      </p>
      <AuthForm action={signUp} submitLabel="Criar conta">
        {next && <input type="hidden" name="redirectTo" value={next} />}
        <div>
          <label className="label" htmlFor="fullName">
            Nome
          </label>
          <input id="fullName" name="fullName" type="text" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="input"
            autoComplete="new-password"
          />
          <p className="mt-1.5 text-[11.5px] text-neutral-400 dark:text-neutral-500">
            Mínimo de 8 caracteres.
          </p>
        </div>
      </AuthForm>
      <p className="mt-5 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
        Já tem conta?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
