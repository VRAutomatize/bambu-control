import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { requestPasswordReset } from '../actions';

export default function RecoverPage() {
  return (
    <div className="card">
      <h1 className="mb-1 text-lg font-semibold">Recuperar senha</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Informe seu e-mail para receber as instruções.
      </p>
      <AuthForm action={requestPasswordReset} submitLabel="Enviar instruções">
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
      </AuthForm>
      <p className="mt-4 text-center text-sm text-neutral-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
