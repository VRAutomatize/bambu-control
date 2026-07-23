import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { OrderForm } from './order-form';

export const dynamic = 'force-dynamic';

export default async function NovoPedidoPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('organization_id', org.organizationId)
    .eq('active', true)
    .order('name');

  return (
    <div>
      <PageHeader title="Novo pedido" subtitle="Crie um pedido e seus itens" />
      <Card>
        <OrderForm customers={(customers ?? []).map((c) => ({ id: c.id, label: c.name }))} />
      </Card>
    </div>
  );
}
