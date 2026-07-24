import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { IconCheckCircle, IconAlertTriangle } from '@/components/icons';
import { AcceptInviteForm } from './accept-invite-form';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = params.code as string | undefined;

  if (!code) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Card className="max-w-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15">
              <IconAlertTriangle width={16} height={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Código inválido</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">O código do convite está faltando.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Try to accept the invite
  try {
    await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('accept_organization_invite', {
      p_token: code,
    });

    const result = data?.[0];
    if (error || !result || !result.success) {
      return (
        <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
          <Card className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15">
                <IconAlertTriangle width={16} height={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Convite inválido ou expirado</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{result?.message || 'Não foi possível aceitar o convite.'}</p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Success — redirect to the organization
    redirect('/dashboard');
  } catch (error) {
    // User not authenticated — show login prompt
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
}
