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

  // Lucratividade por cliente: receita por pedido vs custo agregado.
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_charged, status, customers(name)')
    .eq('organization_id', orgId);

  // Consumo de material por filamento (via print_job_materials).
  const { data: materials } = await supabase
    .from('print_job_materials')
    .select('weight_g, material_cost_snapshot')
    .eq('organization_id', orgId);

  const totalRevenue = (orders ?? [])
    .filter((o) => o.status !== 'cancelled')
    .reduce((a, o) => a + (Number(o.total_charged) || 0), 0);

  const { data: snaps } = await supabase
    .from('latest_print_cost_snapshots')
    .select('total_cost')
    .eq('organization_id', orgId);
  const totalCost = (snaps ?? []).reduce((a, s) => a + (Number(s.total_cost) || 0), 0);
  const { grossProfit, marginPercentage } = computeProfit(totalRevenue, totalCost);

  const totalGrams = (materials ?? []).reduce((a, m) => a + (Number(m.weight_g) || 0), 0);
  const totalMaterialCost = (materials ?? []).reduce(
    (a, m) => a + (Number(m.material_cost_snapshot) || 0),
    0,
  );

  const byCustomer = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.status === 'cancelled') continue;
    const name = (o.customers as unknown as { name: string } | null)?.name ?? 'Sem cliente';
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + (Number(o.total_charged) || 0));
  }

  const empty = (orders ?? []).length === 0 && (materials ?? []).length === 0;

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
              <Line label="Custo total" value={formatMoney(totalCost, org.currency)} />
              <Line label="Lucro" value={formatMoney(grossProfit, org.currency)} />
              <Line label="Margem" value={formatMargin(marginPercentage)} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Consumo de material</h2>
            <dl className="space-y-2.5 text-[13.5px]">
              <Line label="Filamento consumido" value={formatWeight(totalGrams)} />
              <Line label="Custo de material" value={formatMoney(totalMaterialCost, org.currency)} />
            </dl>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Receita por cliente</h2>
            {byCustomer.size === 0 ? (
              <p className="text-[13.5px] text-neutral-500">Sem pedidos.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {[...byCustomer.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, value]) => (
                      <tr key={name} className="hairline">
                        <td className="py-2 text-[13.5px]">{name}</td>
                        <td className="py-2 text-right text-[13.5px] font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {formatMoney(value, org.currency)}
                        </td>
                      </tr>
                    ))}
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
