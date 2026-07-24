'use client';
import Link from 'next/link';

export function AcceptInviteForm({ code }: { code: string }) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Faça login com a conta que recebeu o convite.
      </p>
      <Link href={`/login?redirect=/accept-invite?code=${code}`} className="btn-primary w-full text-xs">
        Ir para login
      </Link>
      <Link href="/" className="btn-secondary w-full text-xs">
        Voltar ao início
      </Link>
    </div>
  );
}
