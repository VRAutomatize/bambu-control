import Link from 'next/link';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, StatusBadge, LinkButton, EmptyState } from '@/components/ui';
import { formatWeight, formatDuration, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUSES = ['', 'completed', 'printing', 'pending', 'failed', 'cancelled'] as const;

export default async function ImpressoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { org } = await requireCurrentOrg();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('print_jobs')
    .select('id, title, normalized_status, effective_weight_g, effective_duration_s, source, created_at')
    .eq('organization_id', org.organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (params.status)
    query = query.eq('normalized_status', params.status as Exclude<(typeof STATUSES)[number], ''>);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const { data: jobs } = await query;

  return (
    <div>
      <PageHeader
        title="Impressões"
        subtitle="Histórico de impressões e custos"
        action={
          <div className="flex gap-2">
            <LinkButton href="/impressoes/importar" variant="secondary">
              Importar CSV
            </LinkButton>
            <LinkButton href="/impressoes/nova" icon="plus">
              Nova impressão
            </LinkButton>
          </div>
        }
      />

      <Card className="mb-5">
        <form className="flex flex-wrap gap-2.5">
          <input
            name="q"
            placeholder="Buscar por título…"
            defaultValue={params.q ?? ''}
            className="input max-w-xs"
          />
          <select name="status" defaultValue={params.status ?? ''} className="input max-w-[180px]">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'Todos os status' : s}
              </option>
            ))}
          </select>
          <button className="btn-secondary" type="submit">
            Filtrar
          </button>
        </form>
      </Card>

      {!jobs || jobs.length === 0 ? (
        <EmptyState
          title="Nenhuma impressão encontrada"
          description="Cadastre uma impressão manual ou sincronize a Bambu Cloud."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  <th className="table-cell-head">Título</th>
                  <th className="table-cell-head">Status</th>
                  <th className="table-cell-head">Duração</th>
                  <th className="table-cell-head">Peso</th>
                  <th className="table-cell-head">Origem</th>
                  <th className="table-cell-head">Data</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="table-row">
                    <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                      <Link href={`/impressoes/${j.id}`} className="hover:text-brand-600">
                        {j.title ?? 'Sem título'}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={j.normalized_status} />
                    </td>
                    <td className="table-cell">{formatDuration(j.effective_duration_s)}</td>
                    <td className="table-cell">{formatWeight(j.effective_weight_g)}</td>
                    <td className="table-cell text-neutral-500">{j.source}</td>
                    <td className="table-cell text-neutral-500">
                      {formatDateTime(j.created_at, org.timezone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
