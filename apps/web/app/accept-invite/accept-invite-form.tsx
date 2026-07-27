'use client';
import Link from 'next/link';

export function AcceptInviteForm({ code }: { code: string }) {
  const target = encodeURIComponent(`/accept-invite?code=${code}`);
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Entre (ou crie uma conta) com o e-mail que recebeu o convite.
      </p>
      <Link href={`/login?next=${target}`} className="btn-primary w-full text-xs">
        Ir para login
      </Link>
      <Link href={`/cadastro?next=${target}`} className="btn-secondary w-full text-xs">
        Criar conta
      </Link>
    </div>
  );
}
