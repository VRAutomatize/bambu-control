'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { manualPrintJobSchema } from '@bambu/contracts';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { recalculatePrintJob } from '@/lib/services/cost';

/** Cria uma impressão manual + materiais e grava o snapshot de custo. */
export async function createManualPrintJob(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Você não tem permissão para criar impressões.' };

  // Materiais vêm como arrays paralelos (filamentId[], spoolId[], weightG[]).
  const filamentIds = formData.getAll('materialFilamentId').map(String);
  const spoolIds = formData.getAll('materialSpoolId').map(String);
  const weights = formData.getAll('materialWeightG').map((v) => Number(v));
  const materials = filamentIds
    .map((filamentId, i) => ({
      filamentId: filamentId || null,
      spoolId: spoolIds[i] || null,
      weightG: weights[i] ?? 0,
    }))
    .filter((m) => m.filamentId && m.weightG > 0);

  const parsed = manualPrintJobSchema.safeParse({
    title: formData.get('title'),
    printerId: formData.get('printerId') || null,
    normalizedStatus: formData.get('normalizedStatus') || 'completed',
    manualDurationS: formData.get('durationMin')
      ? Number(formData.get('durationMin')) * 60
      : null,
    manualWeightG: formData.get('manualWeightG') || null,
    quantityProduced: formData.get('quantityProduced') || 1,
    laborCost: formData.get('laborCost') || 0,
    packagingCost: formData.get('packagingCost') || 0,
    otherCost: formData.get('otherCost') || 0,
    failurePercentage: formData.get('failurePercentage') || 0,
    materials,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  }
  const input = parsed.data;

  const supabase = await createClient();

  // 1) Cria a impressão.
  const { data: job, error: jobErr } = await supabase
    .from('print_jobs')
    .insert({
      organization_id: org.organizationId,
      printer_id: input.printerId,
      title: input.title,
      normalized_status: input.normalizedStatus,
      manual_status: input.normalizedStatus,
      manual_duration_s: input.manualDurationS,
      manual_weight_g: input.manualWeightG,
      quantity_produced: input.quantityProduced,
      source: 'manual',
      duration_source: 'manual',
      imported_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (jobErr || !job) return { error: `Falha ao criar impressão: ${jobErr?.message}` };

  // 2) Materiais: busca preço snapshot do filamento se não informado.
  for (const m of input.materials) {
    let pricePerKg = m.pricePerKgSnapshot ?? 0;
    if (!pricePerKg && m.filamentId) {
      const { data: fil } = await supabase
        .from('filaments')
        .select('default_price_per_kg')
        .eq('id', m.filamentId)
        .single();
      pricePerKg = Number(fil?.default_price_per_kg) || 0;
    }
    const materialCost = (m.weightG * pricePerKg) / 1000;
    await supabase.from('print_job_materials').insert({
      organization_id: org.organizationId,
      print_job_id: job.id,
      filament_id: m.filamentId,
      spool_id: m.spoolId ?? null,
      source: 'manual',
      weight_g: m.weightG,
      price_per_kg_snapshot: pricePerKg,
      material_cost_snapshot: Math.round(materialCost * 10000) / 10000,
      allocation_percentage: m.allocationPercentage ?? null,
    });
  }

  // 3) Snapshot de custo (fonte única = motor de custos).
  await recalculatePrintJob(supabase, org.organizationId, job.id, {
    laborCost: input.laborCost,
    packagingCost: input.packagingCost,
    otherCost: input.otherCost,
    failurePercentage: input.failurePercentage,
  });

  revalidatePath('/impressoes');
  revalidatePath('/dashboard');
  redirect(`/impressoes/${job.id}`);
}

/** Recalcula o custo de uma impressão existente (gera novo snapshot). */
export async function recalculate(printJobId: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return;
  const supabase = await createClient();
  await recalculatePrintJob(supabase, org.organizationId, printJobId);
  revalidatePath(`/impressoes/${printJobId}`);
}
