'use client';
import { useTransition } from 'react';
import { archiveSpool } from './actions';

export function ArchiveSpoolButton({ spoolId }: { spoolId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-[11px] font-medium text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
      disabled={pending}
      onClick={() => {
        if (confirm('Arquivar este rolo? Ele deixará de aparecer como disponível.')) {
          start(() => archiveSpool(spoolId));
        }
      }}
    >
      {pending ? 'Arquivando…' : 'Arquivar'}
    </button>
  );
}
