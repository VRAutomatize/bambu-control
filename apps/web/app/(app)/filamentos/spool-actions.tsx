'use client';
import { archiveSpool } from './actions';
import { ConfirmActionButton } from '@/components/confirm-action-button';

export function ArchiveSpoolButton({ spoolId }: { spoolId: string }) {
  return (
    <ConfirmActionButton
      action={archiveSpool}
      id={spoolId}
      label="Arquivar"
      confirmText="Arquivar?"
      pendingLabel="Arquivando…"
      icon={false}
      tone="neutral"
      className="text-[11px] font-medium text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
    />
  );
}
