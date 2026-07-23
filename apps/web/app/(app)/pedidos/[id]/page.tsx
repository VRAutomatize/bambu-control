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
  const assoc = (assocRes.data ?? []).filter((a) => itemIds.has(a.order_item_id));
  const payments = paymentsRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Receita" value={formatMoney(revenue, org.currency)} />
        <StatCard label="Custo" value={formatMoney(orderCost, org.currency)} />
        <StatCard label="Lucro" value={formatMoney(grossProfit, org.currency)} tone={grossProfit >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Margem" value={formatMargin(marginPercentage)} />
        <StatCard label="Saldo em aberto" value={formatMoney(balance, org.currency)} tone={balance > 0 ? 'negative' : 'default'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Itens</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-1">Descrição</th>
                <th className="py-1">Qtd</th>
                <th className="py-1">Preço un.</th>
                <th className="py-1">Total</th>
                <th className="py-1">Impressões</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const n = assoc.filter((a) => a.order_item_id === it.id).length;
                return (
                  <tr key={it.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-1.5">{it.description}</td>
                    <td className="py-1.5">{it.quantity}</td>
                    <td className="py-1.5">{formatMoney(it.unit_price, org.currency)}</td>
                    <td className="py-1.5">{formatMoney(it.total_price, org.currency)}</td>
                    <td className="py-1.5">{n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <h3 className="mb-2 text-sm font-medium">Associar impressão a um item</h3>
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
                    {j.title ?? j.id}
                  </option>
                ))}
              </select>
              <input name="allocatedQuantity" type="number" min="1" step="1" defaultValue="1" className="input" placeholder="Qtd alocada" />
            </AuthForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Pagamentos</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum pagamento registrado.</p>
          ) : (
            <table className="mb-4 w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-1.5">{formatDate(p.paid_at, org.timezone)}</td>
                    <td className="py-1.5">{p.payment_method ?? '—'}</td>
                    <td className="py-1.5 text-right font-medium">{formatMoney(p.amount, org.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="mb-2 text-sm font-medium">Registrar pagamento</h3>
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
