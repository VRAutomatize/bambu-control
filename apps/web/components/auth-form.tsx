'use client';
import { useActionState, useEffect } from 'react';
import { IconAlertTriangle, IconCheckCircle } from './icons';

type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AuthForm({
  action,
  submitLabel,
  children,
  onSuccess,
}: {
  action: Action;
  submitLabel: string;
  children: React.ReactNode;
  /** Chamado quando a action retorna `ok` (ex.: fechar um modal de edição). */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-3.5">
      {children}
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <IconAlertTriangle width={15} height={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <IconCheckCircle width={15} height={15} className="mt-0.5 shrink-0" />
          {state.ok}
        </p>
      )}
      <button type="submit" className="btn-primary w-full py-2.5" disabled={pending}>
        {pending ? 'Aguarde…' : submitLabel}
      </button>
    </form>
  );
}
