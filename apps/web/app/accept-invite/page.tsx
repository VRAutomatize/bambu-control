import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { IconAlertTriangle } from '@/components/icons';
import { AcceptInviteForm } from './accept-invite-form';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = params.code as string | undefined;

  // Missing or invalid code
  if (!code || typeof code !== 'string' || code.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Card className="max-w-md">
          <div className="text-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 mx-auto mb-3">
              <IconAlertTriangle width={20} height={20} />
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Link de convite inválido</h2>
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              O código do convite não foi fornecido ou é inválido.
            </p>
            <a href="/" className="mt-4 inline-block text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Voltar ao início
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Não autenticado — mostra prompt de login/cadastro preservando o código
  // (o middleware deixa /accept-invite passar sem redirecionar sozinho;
  // ver PUBLIC_PATHS em apps/web/middleware.ts).
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Card className="max-w-md">
          <div className="text-center">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
              Faça login para aceitar o convite
            </h2>
            <p className="mt-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              Você precisa estar autenticado para aceitar um convite de organização.
            </p>
            <AcceptInviteForm code={code} />
          </div>
        </Card>
      </div>
    );
  }

  const { data, error } = await supabase.rpc('accept_organization_invite', {
    p_token: code,
  });

  const result = data?.[0];

  // Success case — redireciona direto (não precisa de clique extra; era um
  // <button onClick> num Server Component, que quebra em produção).
  if (!error && result?.success && result.org_id) {
    redirect('/dashboard');
  }

  // Error case: invalid or expired
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <Card className="max-w-md">
        <div className="text-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 mx-auto mb-3">
            <IconAlertTriangle width={20} height={20} />
          </div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Convite expirado ou inválido
          </h2>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {result?.message || 'O convite pode ter expirado (válido por 7 dias).'}
          </p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Peça a um administrador que envie um novo convite.
          </p>
          <a href="/" className="mt-4 inline-block text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Voltar ao início
          </a>
        </div>
      </Card>
    </div>
  );
}
