'use client';
import { useState, useTransition } from 'react';
import { archiveSpool } from './actions';

export function ArchiveSpoolButton({ spoolId }: { spoolId: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px]">
        <span className="text-neutral-500 dark:text-neutral-400">Arquivar?</span>
        <button
          className="font-medium text-red-600 hover:text-red-700 dark:text-red-400"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await archiveSpool(spoolId);
              } catch {
                setError('Falha ao arquivar.');
              } finally {
                setConfirming(false);
              }
            });
          }}
        >
          {pending ? 'Arquivando…' : 'Sim'}
        </button>
        <button
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
        className="text-[11px] font-medium text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
        onClick={() => setConfirming(true)}
      >
        Arquivar
      </button>
    </span>
  );
}
