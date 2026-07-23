import { requireCurrentOrg, listMemberships } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Organização</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Nome" value={org.organizationName} />
            <Row label="Moeda" value={org.currency} />
            <Row label="Fuso horário" value={org.timezone} />
            <Row label="Seu papel" value={org.role} />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Suas organizações</h2>
          <ul className="space-y-1 text-sm">
            {memberships.map((m) => (
              <li key={m.organizationId} className="flex justify-between">
                <span>{m.organizationName}</span>
                <span className="capitalize text-neutral-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Membros</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-1">Usuário</th>
                <th className="py-1">Papel</th>
                <th className="py-1">Desde</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.user_id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5 font-mono text-xs">{m.user_id.slice(0, 8)}…</td>
                  <td className="py-1.5 capitalize">{m.role}</td>
                  <td className="py-1.5 text-neutral-500">{formatDateTime(m.created_at, org.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-neutral-400">
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
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
