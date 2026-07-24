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
        action={
          <LinkButton href="/pedidos/nova" icon="plus">
            Novo pedido
          </LinkButton>
        }
      />
      {!orders || orders.length === 0 ? (
        <EmptyState title="Nenhum pedido" description="Crie seu primeiro pedido." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  <th className="table-cell-head">Número</th>
                  <th className="table-cell-head">Cliente</th>
                  <th className="table-cell-head">Status</th>
                  <th className="table-cell-head">Total</th>
                  <th className="table-cell-head">Pago</th>
                  <th className="table-cell-head">Data</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const customer = o.customers as unknown as { name: string } | null;
                  return (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                        <Link href={`/pedidos/${o.id}`} className="hover:text-brand-600">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="table-cell">{customer?.name ?? '—'}</td>
                      <td className="table-cell">
                        <span className="badge bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="table-cell tabular-nums">{formatMoney(o.total_charged, org.currency)}</td>
                      <td className="table-cell tabular-nums">{formatMoney(o.total_paid, org.currency)}</td>
                      <td className="table-cell text-neutral-500">{formatDate(o.ordered_at, org.timezone)}</td>
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
