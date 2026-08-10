'use client';

/** Botão de ação destrutiva/sensível com confirmação inline (2 cliques,
 * sem modal — "Excluir" → "Excluir? Sim/Não"). Reutilizado em todo
 * cadastro do app (filamentos, rolos, impressoras, clientes...). */
import { useState, useTransition } from 'react';
import { IconTrash } from './icons';

export function ConfirmActionButton({
  action,
  id,
  label = 'Excluir',
  confirmText = 'Excluir?',
  pendingLabel = 'Excluindo…',
  icon = true,
  tone = 'danger',
  className,
}: {
  /** Server action — recebe o id e retorna erro opcional (não lança). */
  action: (id: string) => Promise<{ error?: string } | void>;
  id: string;
  label?: string;
  confirmText?: string;
  pendingLabel?: string;
  icon?: boolean;
  tone?: 'danger' | 'neutral';
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toneClass =
    tone === 'danger'
      ? 'text-neutral-400 hover:text-red-600 dark:hover:text-red-400'
      : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200';

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px]">
        <span className="text-neutral-500 dark:text-neutral-400">{confirmText}</span>
        <button
          type="button"
          className="font-medium text-red-600 hover:text-red-700 dark:text-red-400"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await action(id);
              if (res?.error) setError(res.error);
              setConfirming(false);
            });
          }}
        >
          {pending ? pendingLabel : 'Sim'}
        </button>
        <button
          type="button"
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Não
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      <button
        type="button"
        className={className ?? `inline-flex items-center gap-1 text-[11px] font-medium ${toneClass}`}
        onClick={() => setConfirming(true)}
      >
        {icon && <IconTrash width={13} height={13} strokeWidth={2} />}
        {label}
      </button>
    </span>
  );
}
