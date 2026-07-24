'use client';
import { useActionState } from 'react';
import { inviteMember } from './actions';
import { IconCheckCircle } from '@/components/icons';

export function InviteMemberForm() {
  const [state, formAction, isPending] = useActionState(inviteMember, null);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          Email do membro
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          placeholder="nome@exemplo.com"
          required
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          Papel
        </label>
        <select name="role" id="role" className="input" disabled={isPending}>
          <option value="viewer">Visualizador (ler tudo)</option>
          <option value="operator">Operador (usar impressoras, sincronizar)</option>
          <option value="admin">Administrador (gerenciar integrações, convites)</option>
        </select>
      </div>

      {state?.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12px] text-red-600 dark:bg-red-500/15 dark:text-red-400">
          {state.error}
        </div>
      )}

      {state?.ok && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-500/15">
            <IconCheckCircle width={16} height={16} className="text-green-600 dark:text-green-400" />
            <div>
              <p className="text-[12px] font-medium text-green-600 dark:text-green-400">{state.message}</p>
              {state.link && (
                <p className="mt-1 text-[11px] text-green-600/70 dark:text-green-400/70">
                  Link: <code className="font-mono">{state.link}</code>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <button type="submit" className="btn-primary w-full text-xs" disabled={isPending}>
        {isPending ? 'Enviando convite…' : 'Enviar convite'}
      </button>
    </form>
  );
}
