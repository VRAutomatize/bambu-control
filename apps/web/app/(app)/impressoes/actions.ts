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

/** Edita os dados de qualquer impressão (manual, CSV ou vinda de
 * sincronização) e gera um novo snapshot de custo. Necessário sobretudo
 * pra impressões sincronizadas da Bambu Cloud, que chegam sem custo
 * algum — o worker não sabe qual filamento foi usado. */
export async function updatePrintJob(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Impressão inválida.' };

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
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('print_jobs')
    .update({
      title: input.title,
      printer_id: input.printerId,
      normalized_status: input.normalizedStatus,
      manual_status: input.normalizedStatus,
      manual_duration_s: input.manualDurationS,
      manual_weight_g: input.manualWeightG,
      quantity_produced: input.quantityProduced,
    })
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  await recalculatePrintJob(supabase, org.organizationId, id, {
    laborCost: input.laborCost,
    packagingCost: input.packagingCost,
    otherCost: input.otherCost,
    failurePercentage: input.failurePercentage,
  });

  revalidatePath('/impressoes');
  revalidatePath(`/impressoes/${id}`);
  revalidatePath('/dashboard');
  return { ok: 'Impressão atualizada.' };
}

/** Exclusão definitiva. Bloqueada (com mensagem clara) se a impressão
 * estiver vinculada a um item de pedido — excluir apagaria esse vínculo
 * de faturamento sem avisar ninguém (order_item_print_jobs é ON DELETE
 * CASCADE). Peça pra desassociar do pedido primeiro. */
export async function deletePrintJob(id: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();

  const { count } = await supabase
    .from('order_item_print_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('print_job_id', id)
    .eq('organization_id', org.organizationId);
  if (count) {
    return {
      error: 'Esta impressão está vinculada a um pedido. Remova o vínculo no pedido antes de excluir.',
    };
  }

  const { error } = await supabase
    .from('print_jobs')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  revalidatePath('/impressoes');
  revalidatePath('/dashboard');
  redirect('/impressoes');
}

/** Associa um filamento (peso consumido, rolo opcional) a uma impressão já
 * existente — é assim que uma impressão sincronizada da Bambu Cloud (sem
 * material nenhum) passa a ter custo calculado. */
export async function addPrintJobMaterial(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const printJobId = String(formData.get('printJobId') ?? '');
  const filamentId = String(formData.get('filamentId') ?? '');
  const spoolId = String(formData.get('spoolId') ?? '') || null;
  const weightG = Number(formData.get('weightG'));
  if (!printJobId || !filamentId) return { error: 'Selecione o filamento.' };
  if (!weightG || weightG <= 0) return { error: 'Informe o peso consumido (g).' };

  const supabase = await createClient();
  const { data: fil } = await supabase
    .from('filaments')
    .select('default_price_per_kg')
    .eq('id', filamentId)
    .eq('organization_id', org.organizationId)
    .single();
  if (!fil) return { error: 'Filamento não encontrado.' };

  const pricePerKg = Number(fil.default_price_per_kg) || 0;
  const materialCost = (weightG * pricePerKg) / 1000;
  const { error } = await supabase.from('print_job_materials').insert({
    organization_id: org.organizationId,
    print_job_id: printJobId,
    filament_id: filamentId,
    spool_id: spoolId,
    source: 'manual',
    weight_g: weightG,
    price_per_kg_snapshot: pricePerKg,
    material_cost_snapshot: Math.round(materialCost * 10000) / 10000,
  });
  if (error) return { error: error.message };

  await recalculatePrintJob(supabase, org.organizationId, printJobId);
  revalidatePath(`/impressoes/${printJobId}`);
  revalidatePath('/impressoes');
  revalidatePath('/dashboard');
  return { ok: 'Material associado.' };
}

/** Remove um material da impressão e recalcula o custo (novo snapshot). */
export async function removePrintJobMaterial(materialId: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();

  const { data: material } = await supabase
    .from('print_job_materials')
    .select('print_job_id')
    .eq('id', materialId)
    .eq('organization_id', org.organizationId)
    .single();
  if (!material) return { error: 'Material não encontrado.' };

  const { error } = await supabase
    .from('print_job_materials')
    .delete()
    .eq('id', materialId)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  await recalculatePrintJob(supabase, org.organizationId, material.print_job_id);
  revalidatePath(`/impressoes/${material.print_job_id}`);
  revalidatePath('/impressoes');
  revalidatePath('/dashboard');
}
