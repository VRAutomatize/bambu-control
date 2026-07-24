import { revalidatePath } from 'next/cache';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { IconPrinter } from '@/components/icons';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function createPrinter(_prev: unknown, formData: FormData) {
  'use server';
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 1) return { error: 'Informe o nome da impressora.' };

  const supabase = await createClient();
  // Cria um perfil de custo (modo calculado) junto com a impressora.
  const { data: profile, error: profErr } = await supabase
    .from('machine_cost_profiles')
    .insert({
      organization_id: org.organizationId,
      name: `${name} — custo`,
      calculation_mode: 'calculated',
      purchase_price: Number(formData.get('purchasePrice')) || 0,
      residual_value: Number(formData.get('residualValue')) || 0,
      useful_life_hours: Number(formData.get('usefulLifeHours')) || 0,
      average_power_w: Number(formData.get('averagePowerW')) || 0,
      electricity_price_kwh: Number(formData.get('electricityPriceKwh')) || 0,
      maintenance_cost_per_hour: Number(formData.get('maintenanceCostPerHour')) || 0,
      overhead_cost_per_hour: Number(formData.get('overheadCostPerHour')) || 0,
    })
    .select('id')
    .single();
  if (profErr) return { error: profErr.message };

  const { error } = await supabase.from('printers').insert({
    organization_id: org.organizationId,
    name,
    model: String(formData.get('model') ?? '') || null,
    location: String(formData.get('location') ?? '') || null,
    machine_cost_profile_id: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/impressoras');
  return { ok: 'Impressora cadastrada.' };
}

export default async function ImpressorasPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: printers } = await supabase
    .from('printers')
    .select('id, name, model, location, serial_number, active, last_seen_at')
    .eq('organization_id', org.organizationId)
    .order('name');

  const maskSerial = (s: string | null) =>
    s ? s.slice(0, 3) + '••••' + s.slice(-3) : '—';

  return (
    <div>
      <PageHeader title="Impressoras" subtitle="Equipamentos e perfis de custo" />
      <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
        <div>
          {!printers || printers.length === 0 ? (
            <EmptyState title="Nenhuma impressora" description="Cadastre sua primeira máquina ao lado." />
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2">
              {printers.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400">
                        <IconPrinter width={17} height={17} />
                      </div>
                      <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
                        {p.name}
                      </h3>
                    </div>
                    <span
                      className={`badge shrink-0 ${p.active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400' : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'}`}
                    >
                      {p.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <dl className="mt-3.5 space-y-1.5 text-[13px]">
                    <PrinterRow label="Modelo" value={p.model ?? '—'} />
                    <PrinterRow label="Local" value={p.location ?? '—'} />
                    <PrinterRow label="Serial" value={maskSerial(p.serial_number)} />
                    <PrinterRow label="Última sync" value={formatDateTime(p.last_seen_at, org.timezone)} />
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Nova impressora</h2>
          <AuthForm action={createPrinter} submitLabel="Cadastrar">
            <input name="name" required className="input" placeholder="Nome (ex.: X1C-Oficina)" />
            <input name="model" className="input" placeholder="Modelo (X1 Carbon…)" />
            <input name="location" className="input" placeholder="Local" />
            <p className="pb-0.5 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
              Perfil de custo (modo calculado)
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <input name="purchasePrice" type="number" step="0.01" className="input" placeholder="Preço compra" />
              <input name="residualValue" type="number" step="0.01" className="input" placeholder="Valor residual" />
              <input name="usefulLifeHours" type="number" step="1" className="input" placeholder="Vida útil (h)" />
              <input name="averagePowerW" type="number" step="1" className="input" placeholder="Potência (W)" />
              <input name="electricityPriceKwh" type="number" step="0.01" className="input" placeholder="R$/kWh" />
              <input name="maintenanceCostPerHour" type="number" step="0.01" className="input" placeholder="Manut./h" />
              <input name="overheadCostPerHour" type="number" step="0.01" className="input" placeholder="Overhead/h" />
            </div>
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}

function PrinterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-400 dark:text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
  );
}
