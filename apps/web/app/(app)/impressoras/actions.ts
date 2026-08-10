'use server';
import { revalidatePath } from 'next/cache';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function createPrinter(_prev: unknown, formData: FormData) {
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

export async function updatePrinter(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const id = String(formData.get('id') ?? '');
  const costProfileId = String(formData.get('costProfileId') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  if (!id) return { error: 'Impressora inválida.' };
  if (name.length < 1) return { error: 'Informe o nome da impressora.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('printers')
    .update({
      name,
      model: String(formData.get('model') ?? '') || null,
      location: String(formData.get('location') ?? '') || null,
    })
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  const costFields = {
    purchase_price: Number(formData.get('purchasePrice')) || 0,
    residual_value: Number(formData.get('residualValue')) || 0,
    useful_life_hours: Number(formData.get('usefulLifeHours')) || 0,
    average_power_w: Number(formData.get('averagePowerW')) || 0,
    electricity_price_kwh: Number(formData.get('electricityPriceKwh')) || 0,
    maintenance_cost_per_hour: Number(formData.get('maintenanceCostPerHour')) || 0,
    overhead_cost_per_hour: Number(formData.get('overheadCostPerHour')) || 0,
  };

  if (costProfileId) {
    // Perfil de custo já existe (impressora cadastrada manualmente) —
    // edita junto, mantendo nome e escopo em sincronia.
    const { error: profErr } = await supabase
      .from('machine_cost_profiles')
      .update({ name: `${name} — custo`, ...costFields })
      .eq('id', costProfileId)
      .eq('organization_id', org.organizationId);
    if (profErr) return { error: profErr.message };
  } else {
    // Impressoras vindas de sincronização (Bambu Cloud) não nascem com um
    // perfil de custo — criamos um agora com os valores informados, em vez
    // de descartar silenciosamente o que foi digitado no formulário.
    const { data: profile, error: profErr } = await supabase
      .from('machine_cost_profiles')
      .insert({
        organization_id: org.organizationId,
        name: `${name} — custo`,
        calculation_mode: 'calculated',
        ...costFields,
      })
      .select('id')
      .single();
    if (profErr) return { error: profErr.message };
    const { error: linkErr } = await supabase
      .from('printers')
      .update({ machine_cost_profile_id: profile.id })
      .eq('id', id)
      .eq('organization_id', org.organizationId);
    if (linkErr) return { error: linkErr.message };
  }

  revalidatePath('/impressoras');
  return { ok: 'Impressora atualizada.' };
}

/** Ativa/desativa: impressora inativa some das listas de seleção de nova
 * impressão, mas o histórico de impressões dela fica intacto. */
export async function togglePrinterActive(id: string, active: boolean) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('printers')
    .update({ active })
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };
  revalidatePath('/impressoras');
}

/** Exclusão definitiva. Segura mesmo com impressões já registradas: a FK
 * print_jobs.printer_id é ON DELETE SET NULL — o histórico de impressões
 * fica, só perde o vínculo com a máquina. Também remove o perfil de custo
 * criado junto com a impressora, se nenhuma outra impressora o usar. */
export async function deletePrinter(id: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();

  const { data: printer } = await supabase
    .from('printers')
    .select('machine_cost_profile_id')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .single();

  const { error } = await supabase
    .from('printers')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  if (printer?.machine_cost_profile_id) {
    const { count } = await supabase
      .from('printers')
      .select('id', { count: 'exact', head: true })
      .eq('machine_cost_profile_id', printer.machine_cost_profile_id);
    if (!count) {
      await supabase
        .from('machine_cost_profiles')
        .delete()
        .eq('id', printer.machine_cost_profile_id)
        .eq('organization_id', org.organizationId);
    }
  }

  revalidatePath('/impressoras');
}
