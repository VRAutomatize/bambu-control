import Link from 'next/link';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState, LinkButton } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  quoted: 'Orçado',
  approved: 'Aprovado',
  in_production: 'Em produção',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export default async function PedidosPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_charged, total_paid, ordered_at, customers(name)')
    .eq('organization_id', org.organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Vendas, pagamentos e lucro"
        action={<LinkButton href="/pedidos/nova">Novo pedido</LinkButton>}
      />
      {!orders || orders.length === 0 ? (
        <EmptyState title="Nenhum pedido" description="Crie seu primeiro pedido." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-400 dark:border-neutral-800">
                <tr>
                  <th className="p-3">Número</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Pago</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const customer = o.customers as unknown as { name: string } | null;
                  return (
                    <tr key={o.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                      <td className="p-3 font-medium">
                        <Link href={`/pedidos/${o.id}`} className="hover:text-brand-600">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="p-3">{customer?.name ?? '—'}</td>
                      <td className="p-3">
                        <span className="badge bg-neutral-100 text-neutral-700">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="p-3">{formatMoney(o.total_charged, org.currency)}</td>
                      <td className="p-3">{formatMoney(o.total_paid, org.currency)}</td>
                      <td className="p-3 text-neutral-500">{formatDate(o.ordered_at, org.timezone)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
