'use client';
import { useActionState } from 'react';
import { inviteMember } from './actions';
import { IconCheckCircle, IconAlertTriangle } from '@/components/icons';

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
          placeholder="nome@empresa.com"
          required
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          Papel do membro
        </label>
        <select name="role" id="role" className="input" disabled={isPending}>
          <option value="viewer">Visualizador — apenas leitura</option>
          <option value="operator">Operador — usar impressoras, sincronizar</option>
          <option value="admin">Administrador — gerenciar tudo</option>
        </select>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-500/15">
          <IconAlertTriangle width={16} height={16} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-[12px] text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      {state?.ok && (
        <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 dark:bg-brand-500/15">
          <IconCheckCircle width={16} height={16} className="mt-0.5 flex-shrink-0 text-brand-700 dark:text-brand-400" />
          <div>
            <p className="text-[12px] font-medium text-brand-700 dark:text-brand-400">{state.message}</p>
            <p className="mt-0.5 text-[11px] text-brand-700/75 dark:text-brand-400/75">
              {process.env.NODE_ENV === 'development'
                ? 'Link de aceitação disponível no console do navegador'
                : 'Um email com instruções foi enviado'}
            </p>
          </div>
        </div>
      )}

      <button type="submit" className="btn-primary w-full text-xs" disabled={isPending}>
        {isPending ? 'Enviando convite…' : 'Enviar convite'}
      </button>
    </form>
  );
}
