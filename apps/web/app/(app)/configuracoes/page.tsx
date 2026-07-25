import { requireCurrentOrg, listMemberships, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { InviteMemberForm } from './invite-member-form';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default async function ConfiguracoesPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from('organization_members')
    .select('role, created_at, user_id')
    .eq('organization_id', org.organizationId)
    .order('created_at');

  const { data: invites } = await supabase
    .from('organization_invites')
    .select('id, email, role, expires_at, accepted_at')
    .eq('organization_id', org.organizationId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  const now = Date.now();

  const memberships = await listMemberships();
  const canInvite = isAdmin(org.role);

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Organização, membros e preferências" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Organização</h2>
          <dl className="space-y-2.5 text-[13.5px]">
            <Row label="Nome" value={org.organizationName} />
            <Row label="Moeda" value={org.currency} />
            <Row label="Fuso horário" value={org.timezone} />
            <Row label="Seu papel" value={ROLE_LABELS[org.role] ?? org.role} />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Suas organizações</h2>
          <ul className="space-y-2.5 text-[13.5px]">
            {memberships.map((m) => (
              <li key={m.organizationId} className="flex justify-between">
                <span className="text-neutral-900 dark:text-neutral-100">{m.organizationName}</span>
                <span className="text-neutral-500">{ROLE_LABELS[m.role] ?? m.role}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Membros</h2>
          {(members ?? []).length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="table-head">
                    <tr>
                      <th className="py-2 text-left">Usuário</th>
                      <th className="py-2 text-left">Papel</th>
                      <th className="py-2 text-left">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(members ?? []).map((m) => (
                      <tr key={m.user_id} className="hairline">
                        <td className="py-2 font-mono text-[12px] text-neutral-500">{m.user_id.slice(0, 8)}…</td>
                        <td className="py-2 text-[13.5px]">{ROLE_LABELS[m.role] ?? m.role}</td>
                        <td className="py-2 text-[13.5px] text-neutral-500">
                          {formatDateTime(m.created_at, org.timezone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(invites?.length ?? 0) > 0 && <div className="mt-4 border-t border-neutral-200 dark:border-white/[0.08]" />}
            </>
          )}
          {(invites?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h3 className="mb-3 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Convites pendentes</h3>
              <div className="space-y-2">
                {invites?.map((invite) => {
                  const expired = new Date(invite.expires_at).getTime() < now;
                  return (
                    <div
                      key={invite.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                        expired
                          ? 'bg-neutral-100 dark:bg-white/[0.04]'
                          : 'bg-amber-50 dark:bg-amber-500/10'
                      }`}
                    >
                      <div>
                        <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                          {invite.email}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {ROLE_LABELS[invite.role] ?? invite.role} ·{' '}
                          {expired ? 'Expirado' : `Expira ${formatDateTime(invite.expires_at, org.timezone)}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {canInvite && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Convidar membro</h2>
            <InviteMemberForm />
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  );
}
