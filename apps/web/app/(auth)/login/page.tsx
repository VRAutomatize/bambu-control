import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { signIn } from '../actions';

export default function LoginPage() {
  return (
    <div className="card">
      <h1 className="mb-1 text-lg font-semibold">Entrar</h1>
      <p className="mb-5 text-sm text-neutral-500">Acesse sua conta do Bambu Control.</p>
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
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-brand-600 hover:underline">
          Esqueci a senha
        </Link>
        <Link href="/cadastro" className="text-brand-600 hover:underline">
          Criar conta
        </Link>
      </div>
    </div>
  );
}
