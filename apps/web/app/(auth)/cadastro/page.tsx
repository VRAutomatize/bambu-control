import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { signUp } from '../actions';

export default function SignupPage() {
  return (
    <div className="card">
      <h1 className="mb-1 text-lg font-semibold">Criar conta</h1>
      <p className="mb-5 text-sm text-neutral-500">Comece a controlar seus custos de impressão 3D.</p>
      <AuthForm action={signUp} submitLabel="Criar conta">
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
          <p className="mt-1 text-xs text-neutral-400">Mínimo de 8 caracteres.</p>
        </div>
      </AuthForm>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
