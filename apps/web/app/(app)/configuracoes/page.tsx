import { requireCurrentOrg, listMemberships } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

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

  const memberships = await listMemberships();

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
          <table className="w-full">
            <thead className="table-head">
              <tr>
                <th className="py-2">Usuário</th>
                <th className="py-2">Papel</th>
                <th className="py-2">Desde</th>
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
          <p className="mt-4 text-[12px] text-neutral-400 dark:text-neutral-500">
            Convite de membros e permissões avançadas: próxima iteração.
          </p>
        </Card>
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
