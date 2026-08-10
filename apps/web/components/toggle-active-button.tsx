'use client';

/** Ativa/desativa um registro (soft toggle, sempre reversível — sem
 * confirmação, diferente do excluir). Um item inativo some das listas de
 * seleção (nova impressão, novo pedido...) mas mantém todo o histórico. */
import { useState, useTransition } from 'react';

export function ToggleActiveButton({
  action,
  id,
  active,
}: {
  action: (id: string, active: boolean) => Promise<{ error?: string } | void>;
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      <button
        type="button"
        disabled={pending}
        className="text-[11px] font-medium text-neutral-400 transition-colors hover:text-neutral-700 disabled:opacity-50 dark:hover:text-neutral-200"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await action(id, !active);
            if (res?.error) setError(res.error);
          });
        }}
      >
        {pending ? 'Aguarde…' : active ? 'Desativar' : 'Reativar'}
      </button>
    </span>
  );
}
