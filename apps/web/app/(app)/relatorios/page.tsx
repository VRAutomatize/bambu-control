import { computeProfit } from '@bambu/domain';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { formatMoney, formatMargin, formatWeight } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const orgId = org.organizationId;

  const [ordersRes, itemsRes, assocRes, jobsRes, snapsRes, materialsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_charged, status, customer_id, customers(name)')
      .eq('organization_id', orgId),
    supabase.from('order_items').select('id, order_id').eq('organization_id', orgId),
    supabase
      .from('order_item_print_jobs')
      .select('order_item_id, print_job_id, allocated_quantity')
      .eq('organization_id', orgId),
    supabase.from('print_jobs').select('id, quantity_produced').eq('organization_id', orgId),
    supabase.from('latest_print_cost_snapshots').select('print_job_id, total_cost').eq('organization_id', orgId),
    supabase.from('print_job_materials').select('weight_g, material_cost_snapshot').eq('organization_id', orgId),
  ]);

  const orders = ordersRes.data ?? [];
  const items = itemsRes.data ?? [];
  const assoc = assocRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const materials = materialsRes.data ?? [];

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const costByJob = new Map((snapsRes.data ?? []).map((s) => [s.print_job_id, Number(s.total_cost) || 0]));
  const orderIdByItemId = new Map(items.map((it) => [it.id, it.order_id]));

  // Custo por pedido: soma apenas das impressões efetivamente associadas
  // (mesma lógica de apps/web/app/(app)/pedidos/[id]/page.tsx — nunca usar
  // o custo de impressões que não foram vendidas/vinculadas a este pedido).
  const costByOrder = new Map<string, number>();
  for (const a of assoc) {
    const orderId = orderIdByItemId.get(a.order_item_id);
    if (!orderId) continue;
    const job = jobById.get(a.print_job_id);
    const totalCost = costByJob.get(a.print_job_id) ?? 0;
    const perUnit = job && Number(job.quantity_produced) > 0 ? totalCost / Number(job.quantity_produced) : totalCost;
    const cost = (Number(a.allocated_quantity) || 0) * perUnit;
    costByOrder.set(orderId, (costByOrder.get(orderId) ?? 0) + cost);
  }

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = activeOrders.reduce((a, o) => a + (Number(o.total_charged) || 0), 0);
  const totalCost = activeOrders.reduce((a, o) => a + (costByOrder.get(o.id) ?? 0), 0);
  const { grossProfit, marginPercentage } = computeProfit(totalRevenue, totalCost);

  const totalGrams = materials.reduce((a, m) => a + (Number(m.weight_g) || 0), 0);
  const totalMaterialCost = materials.reduce((a, m) => a + (Number(m.material_cost_snapshot) || 0), 0);

  // Lucro por cliente (não apenas receita): receita - custo agregado das
  // impressões vinculadas aos pedidos desse cliente.
  const byCustomer = new Map<string, { revenue: number; cost: number }>();
  for (const o of activeOrders) {
    const name = (o.customers as unknown as { name: string } | null)?.name ?? 'Sem cliente';
    const entry = byCustomer.get(name) ?? { revenue: 0, cost: 0 };
    entry.revenue += Number(o.total_charged) || 0;
    entry.cost += costByOrder.get(o.id) ?? 0;
    byCustomer.set(name, entry);
  }

  const empty = orders.length === 0 && materials.length === 0;

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Resultado consolidado (todo o período)" />
      {empty ? (
        <EmptyState title="Sem dados para relatório" description="Cadastre impressões e pedidos." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Resultado geral</h2>
            <dl className="space-y-2.5 text-[13.5px]">
              <Line label="Receita" value={formatMoney(totalRevenue, org.currency)} />
              <Line label="Custo (apenas impressões vendidas)" value={formatMoney(totalCost, org.currency)} />
              <Line label="Lucro" value={formatMoney(grossProfit, org.currency)} />
              <Line label="Margem" value={formatMargin(marginPercentage)} />
            </dl>
            <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
              Custo considera apenas impressões associadas a pedidos ativos — impressões ainda não vendidas não
              entram nesse total.
            </p>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Consumo de material</h2>
            <dl className="space-y-2.5 text-[13.5px]">
              <Line label="Filamento consumido (total)" value={formatWeight(totalGrams)} />
              <Line label="Custo de material (total)" value={formatMoney(totalMaterialCost, org.currency)} />
            </dl>
            <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
              Inclui todas as impressões registradas, vendidas ou não.
            </p>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Lucratividade por cliente</h2>
            {byCustomer.size === 0 ? (
              <p className="text-[13.5px] text-neutral-500">Sem pedidos.</p>
            ) : (
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th className="py-2 text-left">Cliente</th>
                    <th className="py-2 text-right">Receita</th>
                    <th className="py-2 text-right">Custo</th>
                    <th className="py-2 text-right">Lucro</th>
                    <th className="py-2 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byCustomer.entries()]
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([name, { revenue, cost }]) => {
                      const { grossProfit: profit, marginPercentage: margin } = computeProfit(revenue, cost);
                      return (
                        <tr key={name} className="hairline">
                          <td className="py-2 text-[13.5px]">{name}</td>
                          <td className="py-2 text-right text-[13.5px] tabular-nums text-neutral-700 dark:text-neutral-300">
                            {formatMoney(revenue, org.currency)}
                          </td>
                          <td className="py-2 text-right text-[13.5px] tabular-nums text-neutral-500">
                            {formatMoney(cost, org.currency)}
                          </td>
                          <td className="py-2 text-right text-[13.5px] font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                            {formatMoney(profit, org.currency)}
                          </td>
                          <td className="py-2 text-right text-[13.5px] tabular-nums text-neutral-500">
                            {formatMargin(margin)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  );
}
