import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { NewPrintJobForm } from './new-print-job-form';

export const dynamic = 'force-dynamic';

export default async function NovaImpressaoPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const [filamentsRes, printersRes, spoolsRes] = await Promise.all([
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
    supabase
      .from('spools')
      .select('id, filament_id, label, remaining_weight_g')
      .eq('organization_id', org.organizationId)
      .in('status', ['sealed', 'active'])
      .order('created_at'),
  ]);

  const filaments = (filamentsRes.data ?? []).map((f) => ({
    id: f.id,
    label: `${f.brand ? f.brand + ' — ' : ''}${f.name}`,
  }));
  const printers = (printersRes.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.name}${p.model ? ` (${p.model})` : ''}`,
  }));
  const spools = (spoolsRes.data ?? []).map((s) => ({
    id: s.id,
    filamentId: s.filament_id,
    label: `${s.label ?? 'Rolo'} — ${Math.round(Number(s.remaining_weight_g))}g restantes`,
  }));

  return (
    <div>
      <PageHeader title="Nova impressão" subtitle="Cadastro manual com cálculo de custo" />
      <Card>
        <NewPrintJobForm filaments={filaments} printers={printers} spools={spools} />
      </Card>
    </div>
  );
}
