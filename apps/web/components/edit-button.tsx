'use client';

/** Botão "Editar" + modal com formulário — reutilizado em todo cadastro
 * do app (filamentos, impressoras, clientes...). Os campos do formulário
 * são passados como `children`, pré-preenchidos pelo componente pai
 * (server component) via `defaultValue`. */
import { useState, type ReactNode } from 'react';
import { Modal } from './modal';
import { AuthForm } from './auth-form';
import { IconPencil } from './icons';

type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function EditButton({
  title,
  action,
  submitLabel = 'Salvar alterações',
  triggerLabel,
  iconOnly = false,
  children,
}: {
  title: string;
  action: Action;
  submitLabel?: string;
  triggerLabel?: string;
  /** Mostra só o ícone de lápis (tabelas compactas), sem o texto "Editar". */
  iconOnly?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
      >
        <IconPencil width={13} height={13} strokeWidth={2} />
        {!iconOnly && (triggerLabel ?? 'Editar')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <AuthForm action={action} submitLabel={submitLabel} onSuccess={() => setOpen(false)}>
          {children}
        </AuthForm>
      </Modal>
    </>
  );
}
