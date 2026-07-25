import { notFound } from 'next/navigation';
import { computeProfit } from '@bambu/domain';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, StatCard } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { formatMoney, formatMargin, formatDate } from '@/lib/format';
import { addPayment, associatePrintJob } from '../actions';

export const dynamic = 'force-dynamic';

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const orgId = org.organizationId;

  const { data: order } = await supabase
    .from('orders')
    .select('*, customers(name)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single();
  if (!order) notFound();

  const [itemsRes, assocRes, paymentsRes, jobsRes, snapsRes] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id),
    // Todos os vínculos da org (não só deste pedido) — usado tanto para o
    // custo deste pedido quanto para calcular quantas unidades de cada
    // impressão ainda estão disponíveis para vender.
    supabase
      .from('order_item_print_jobs')
      .select('order_item_id, print_job_id, allocated_quantity')
      .eq('organization_id', orgId),
    supabase.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase
      .from('print_jobs')
      .select('id, title, quantity_produced')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('latest_print_cost_snapshots').select('print_job_id, total_cost').eq('organization_id', orgId),
  ]);

  const items = itemsRes.data ?? [];
  const itemIds = new Set(items.map((it) => it.id));
  const allAssoc = assocRes.data ?? [];
  const assoc = allAssoc.filter((a) => itemIds.has(a.order_item_id));
  const payments = paymentsRes.data ?? [];

  const allocatedByJob = new Map<string, number>();
  for (const a of allAssoc) {
    allocatedByJob.set(a.print_job_id, (allocatedByJob.get(a.print_job_id) ?? 0) + (Number(a.allocated_quantity) || 0));
  }
  const jobById = new Map((jobsRes.data ?? []).map((j) => [j.id, j]));
  const jobs = (jobsRes.data ?? [])
    .map((j) => ({
      ...j,
      quantityAvailable: Math.max(Number(j.quantity_produced) - (allocatedByJob.get(j.id) ?? 0), 0),
    }))
    .filter((j) => j.quantityAvailable > 0);
  const costByJob = new Map((snapsRes.data ?? []).map((s) => [s.print_job_id, Number(s.total_cost) || 0]));

  // Custo do pedido: soma por associação (allocated_quantity * custo por unidade).
  let orderCost = 0;
  for (const a of assoc) {
    const job = jobById.get(a.print_job_id);
    const totalCost = costByJob.get(a.print_job_id) ?? 0;
    const perUnit = job && Number(job.quantity_produced) > 0 ? totalCost / Number(job.quantity_produced) : totalCost;
    orderCost += (Number(a.allocated_quantity) || 0) * perUnit;
  }

  const revenue = order.status === 'cancelled' ? 0 : Number(order.total_charged) || 0;
  const { grossProfit, marginPercentage } = computeProfit(revenue, orderCost);
  const paid = Number(order.total_paid) || 0;
  const balance = Math.max(revenue - paid, 0);
  const customer = order.customers as unknown as { name: string } | null;

  const paymentAction = addPayment.bind(null, id);
  const associateAction = associatePrintJob.bind(null, id);

  return (
    <div>
      <PageHeader
        title={`Pedido ${order.order_number}`}
        subtitle={customer?.name ? `Cliente: ${customer.name}` : 'Sem cliente'}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <StatCard label="Receita" value={formatMoney(revenue, org.currency)} />
        <StatCard label="Custo" value={formatMoney(orderCost, org.currency)} />
        <StatCard label="Lucro" value={formatMoney(grossProfit, org.currency)} tone={grossProfit >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Margem" value={formatMargin(marginPercentage)} />
        <StatCard label="Saldo em aberto" value={formatMoney(balance, org.currency)} tone={balance > 0 ? 'negative' : 'default'} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Itens</h2>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-head">
              <tr>
                <th className="py-2">Descrição</th>
                <th className="py-2">Qtd</th>
                <th className="py-2">Preço un.</th>
                <th className="py-2">Total</th>
                <th className="py-2">Impressões</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const n = assoc.filter((a) => a.order_item_id === it.id).length;
                return (
                  <tr key={it.id} className="hairline">
                    <td className="py-2 text-[13.5px]">{it.description}</td>
                    <td className="py-2 text-[13.5px]">{it.quantity}</td>
                    <td className="py-2 text-[13.5px]">{formatMoney(it.unit_price, org.currency)}</td>
                    <td className="py-2 text-[13.5px]">{formatMoney(it.total_price, org.currency)}</td>
                    <td className="py-2 text-[13.5px]">{n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="mt-5 border-t border-black/[0.06] pt-5 dark:border-white/[0.08]">
            <h3 className="mb-2.5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
              Associar impressão a um item
            </h3>
            <AuthForm action={associateAction} submitLabel="Associar">
              <select name="orderItemId" required className="input">
                <option value="">— Item —</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.description}
                  </option>
                ))}
              </select>
              <select name="printJobId" required className="input">
                <option value="">— Impressão —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title ?? j.id} ({j.quantityAvailable} disponível{j.quantityAvailable === 1 ? '' : 'is'})
                  </option>
                ))}
              </select>
              <input name="allocatedQuantity" type="number" min="1" step="1" defaultValue="1" className="input" placeholder="Qtd alocada" />
            </AuthForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Pagamentos</h2>
          {payments.length === 0 ? (
            <p className="text-[13.5px] text-neutral-500">Nenhum pagamento registrado.</p>
          ) : (
            <table className="mb-5 w-full">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="hairline">
                    <td className="py-2 text-[13.5px] text-neutral-500">{formatDate(p.paid_at, org.timezone)}</td>
                    <td className="py-2 text-[13.5px] text-neutral-500">{p.payment_method ?? '—'}</td>
                    <td className="py-2 text-right text-[13.5px] font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {formatMoney(p.amount, org.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="mb-2.5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
            Registrar pagamento
          </h3>
          <AuthForm action={paymentAction} submitLabel="Registrar">
            <input name="amount" type="number" min="0.01" step="0.01" required className="input" placeholder="Valor (R$)" />
            <select name="paymentMethod" className="input" defaultValue="pix">
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
            </select>
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}
