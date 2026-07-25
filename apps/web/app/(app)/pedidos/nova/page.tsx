import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { OrderForm } from './order-form';

export const dynamic = 'force-dynamic';

export default async function NovoPedidoPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const [customersRes, jobsRes, assocRes, snapsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', org.organizationId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('print_jobs')
      .select('id, title, quantity_produced, normalized_status, created_at')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('order_item_print_jobs')
      .select('print_job_id, allocated_quantity')
      .eq('organization_id', org.organizationId),
    supabase.from('latest_print_cost_snapshots').select('print_job_id, total_cost').eq('organization_id', org.organizationId),
  ]);

  // Só oferece impressões com unidades ainda não vendidas — soma a
  // quantidade já alocada em qualquer pedido e compara com quantity_produced,
  // para permitir vender partes de um lote sem vender a mesma peça 2x.
  const allocatedByJob = new Map<string, number>();
  for (const a of assocRes.data ?? []) {
    allocatedByJob.set(a.print_job_id, (allocatedByJob.get(a.print_job_id) ?? 0) + (Number(a.allocated_quantity) || 0));
  }
  const costByJob = new Map((snapsRes.data ?? []).map((s) => [s.print_job_id, Number(s.total_cost) || 0]));
  const availableJobs = (jobsRes.data ?? [])
    .filter((j) => j.normalized_status === 'completed')
    .map((j) => ({
      id: j.id,
      label: j.title ?? 'Sem título',
      quantityProduced: j.quantity_produced,
      quantityAvailable: Math.max(j.quantity_produced - (allocatedByJob.get(j.id) ?? 0), 0),
      cost: costByJob.get(j.id) ?? 0,
    }))
    .filter((j) => j.quantityAvailable > 0);

  return (
    <div>
      <PageHeader title="Novo pedido" subtitle="Crie um pedido e seus itens" />
      <Card>
        <OrderForm
          customers={(customersRes.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          availableJobs={availableJobs}
          currency={org.currency}
        />
      </Card>
    </div>
  );
}
