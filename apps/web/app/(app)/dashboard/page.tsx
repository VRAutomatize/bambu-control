import { computeProfit } from '@bambu/domain';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, Card, StatusBadge, LinkButton, EmptyState } from '@/components/ui';
import { formatMoney, formatMargin, formatDuration, formatWeight, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const orgId = org.organizationId;

  // Consultas org-scoped (RLS + filtro explícito).
  const [ordersRes, jobsRes, snapsRes, recentRes] = await Promise.all([
    supabase.from('orders').select('total_charged, total_paid, status').eq('organization_id', orgId),
    supabase
      .from('print_jobs')
      .select('normalized_status, effective_duration_s, effective_weight_g')
      .eq('organization_id', orgId),
    supabase.from('latest_print_cost_snapshots').select('total_cost').eq('organization_id', orgId),
    supabase
      .from('print_jobs')
      .select('id, title, normalized_status, effective_weight_g, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const orders = ordersRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const snaps = snapsRes.data ?? [];
  const recent = recentRes.data ?? [];

  const revenue = sum(orders.filter((o) => o.status !== 'cancelled').map((o) => o.total_charged));
  const paid = sum(orders.map((o) => o.total_paid));
  const totalCost = sum(snaps.map((s) => s.total_cost));
  const { grossProfit, marginPercentage } = computeProfit(revenue, totalCost);
  const receivable = Math.max(revenue - paid, 0);

  const completed = jobs.filter((j) => j.normalized_status === 'completed').length;
  const failed = jobs.filter((j) => j.normalized_status === 'failed').length;
  const totalSeconds = sum(jobs.map((j) => j.effective_duration_s));
  const totalGrams = sum(jobs.map((j) => j.effective_weight_g));

  const empty = jobs.length === 0 && orders.length === 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da operação (todo o período)"
        action={<LinkButton href="/impressoes/nova">Nova impressão</LinkButton>}
      />

      {empty ? (
        <EmptyState
          title="Ainda não há dados"
          description="Comece cadastrando uma impressão manual ou conectando a Bambu Cloud."
          action={
            <div className="mt-2 flex justify-center gap-2">
              <LinkButton href="/impressoes/nova" icon="plus">
                Cadastrar impressão
              </LinkButton>
              <LinkButton href="/integracoes" variant="secondary">
                Conectar integração
              </LinkButton>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard label="Receita" value={formatMoney(revenue, org.currency)} hint="Total cobrado (pedidos ativos)" />
            <StatCard label="Custo total" value={formatMoney(totalCost, org.currency)} hint="Soma dos snapshots mais recentes" />
            <StatCard
              label="Lucro"
              value={formatMoney(grossProfit, org.currency)}
              tone={grossProfit >= 0 ? 'positive' : 'negative'}
              hint="Receita − custo"
            />
            <StatCard label="Margem" value={formatMargin(marginPercentage)} hint="Lucro / receita" />
            <StatCard label="Horas impressas" value={formatDuration(totalSeconds)} />
            <StatCard label="Filamento consumido" value={formatWeight(totalGrams)} />
            <StatCard label="Concluídas / Falhas" value={`${completed} / ${failed}`} />
            <StatCard label="A receber" value={formatMoney(receivable, org.currency)} tone="negative" />
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
              Impressões recentes
            </h2>
            {recent.length === 0 ? (
              <Card className="text-[13.5px] text-neutral-500">Nenhuma impressão ainda.</Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-head">
                      <tr>
                        <th className="table-cell-head">Título</th>
                        <th className="table-cell-head">Status</th>
                        <th className="table-cell-head">Peso</th>
                        <th className="table-cell-head">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="table-row">
                          <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                            {r.title ?? 'Sem título'}
                          </td>
                          <td className="table-cell">
                            <StatusBadge status={r.normalized_status} />
                          </td>
                          <td className="table-cell">{formatWeight(r.effective_weight_g)}</td>
                          <td className="table-cell text-neutral-500">
                            {formatDateTime(r.created_at, org.timezone)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function sum(values: Array<number | string | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
}
