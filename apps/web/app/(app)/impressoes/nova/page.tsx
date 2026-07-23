import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { NewPrintJobForm } from './new-print-job-form';

export const dynamic = 'force-dynamic';

export default async function NovaImpressaoPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const [filamentsRes, printersRes] = await Promise.all([
    supabase
      .from('filaments')
      .select('id, name, brand, default_price_per_kg')
      .eq('organization_id', org.organizationId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('printers')
      .select('id, name, model')
      .eq('organization_id', org.organizationId)
      .eq('active', true)
      .order('name'),
  ]);

  const filaments = (filamentsRes.data ?? []).map((f) => ({
    id: f.id,
    label: `${f.brand ? f.brand + ' — ' : ''}${f.name}`,
  }));
  const printers = (printersRes.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.name}${p.model ? ` (${p.model})` : ''}`,
  }));

  return (
    <div>
      <PageHeader title="Nova impressão" subtitle="Cadastro manual com cálculo de custo" />
      <Card>
        <NewPrintJobForm filaments={filaments} printers={printers} />
      </Card>
    </div>
  );
}
