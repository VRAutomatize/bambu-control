import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { signIn } from '../actions';

export default function LoginPage() {
  return (
    <div className="card p-7">
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-0.01em]">Entrar</h1>
      <p className="mb-6 text-[13.5px] text-neutral-500 dark:text-neutral-400">
        Acesse sua conta do Bambu Control.
      </p>
      <AuthForm action={signIn} submitLabel="Entrar">
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
            className="input"
            autoComplete="current-password"
          />
        </div>
      </AuthForm>
      <div className="mt-5 flex justify-between text-[13px]">
        <Link href="/recuperar-senha" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Esqueci a senha
        </Link>
        <Link href="/cadastro" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Criar conta
        </Link>
      </div>
    </div>
  );
}
