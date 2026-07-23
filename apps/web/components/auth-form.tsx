'use client';
import { useActionState } from 'react';

type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: Action;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.ok}</p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Aguarde…' : submitLabel}
      </button>
    </form>
  );
}
