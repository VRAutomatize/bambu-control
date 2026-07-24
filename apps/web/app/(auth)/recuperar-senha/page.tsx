import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { requestPasswordReset } from '../actions';

export default function RecoverPage() {
  return (
    <div className="card p-7">
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-0.01em]">Recuperar senha</h1>
      <p className="mb-6 text-[13.5px] text-neutral-500 dark:text-neutral-400">
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
      <p className="mt-5 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
        <Link href="/login" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
