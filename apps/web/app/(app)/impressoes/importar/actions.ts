'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { NormalizedStatus } from '@bambu/db';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { recalculatePrintJob } from '@/lib/services/cost';
import { parseCsv, csvRowsToObjects, sanitizeCsvInjection } from '@/lib/csv';

type ImportReport = {
  error?: string;
  ok?: boolean;
  created?: number;
  skippedDuplicates?: number;
  invalid?: { row: number; reason: string }[];
};

const STATUS_MAP: Record<string, NormalizedStatus> = {
  completed: 'completed',
  concluida: 'completed',
  concluída: 'completed',
  printing: 'printing',
  imprimindo: 'printing',
  pending: 'pending',
  pendente: 'pending',
  failed: 'failed',
  falhou: 'failed',
  cancelled: 'cancelled',
  cancelado: 'cancelled',
  cancelada: 'cancelled',
};

/** Importa impressões em lote a partir de um CSV (template próprio — a Bambu
 * Lab não disponibiliza export oficial de histórico). Cada linha vira uma
 * impressão manual normal, com o mesmo motor de custo do cadastro manual. */
export async function importPrintJobsCsv(_prev: unknown, formData: FormData): Promise<ImportReport> {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };

  const csvText = String(formData.get('csvText') ?? '').trim();
  if (!csvText) return { error: 'Cole ou envie um arquivo CSV.' };

  const rows = csvRowsToObjects(parseCsv(csvText));
  if (rows.length === 0) return { error: 'CSV vazio ou em formato inválido.' };
  if (rows.length > 500) return { error: 'Máximo de 500 linhas por importação.' };

  const supabase = await createClient();

  const [filamentsRes, printersRes] = await Promise.all([
    supabase.from('filaments').select('id, name').eq('organization_id', org.organizationId),
    supabase.from('printers').select('id, name').eq('organization_id', org.organizationId),
  ]);
  const filamentByName = new Map((filamentsRes.data ?? []).map((f) => [f.name.trim().toLowerCase(), f.id]));
  const printerByName = new Map((printersRes.data ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  type ParsedRow = {
    index: number;
    title: string;
    dateStr: string;
    durationMin: number | null;
    weightG: number | null;
    quantity: number;
    filamentId: string | null;
    printerId: string | null;
    status: NormalizedStatus;
    dedupeKey: string;
  };

  const invalid: { row: number; reason: string }[] = [];
  const parsed: ParsedRow[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2; // +1 header, +1 humano (1-indexado)
    const title = sanitizeCsvInjection((r.titulo ?? '').trim());
    if (!title) {
      invalid.push({ row: rowNum, reason: 'Título em branco.' });
      return;
    }

    const durationMin = r.duracao_min ? Number(r.duracao_min.replace(',', '.')) : null;
    if (r.duracao_min && (durationMin === null || Number.isNaN(durationMin) || durationMin < 0)) {
      invalid.push({ row: rowNum, reason: `Duração inválida: "${r.duracao_min}".` });
      return;
    }

    const weightG = r.peso_g ? Number(r.peso_g.replace(',', '.')) : null;
    if (r.peso_g && (weightG === null || Number.isNaN(weightG) || weightG < 0)) {
      invalid.push({ row: rowNum, reason: `Peso inválido: "${r.peso_g}".` });
      return;
    }

    const quantity = r.quantidade ? Number(r.quantidade) : 1;
    if (Number.isNaN(quantity) || quantity < 0) {
      invalid.push({ row: rowNum, reason: `Quantidade inválida: "${r.quantidade}".` });
      return;
    }

    let filamentId: string | null = null;
    if (r.filamento) {
      filamentId = filamentByName.get(r.filamento.trim().toLowerCase()) ?? null;
      if (!filamentId) {
        invalid.push({ row: rowNum, reason: `Filamento não encontrado no catálogo: "${r.filamento}".` });
        return;
      }
    }

    const printerId = r.impressora ? printerByName.get(r.impressora.trim().toLowerCase()) ?? null : null;

    const statusRaw = (r.status ?? 'completed').trim().toLowerCase();
    const status = STATUS_MAP[statusRaw] ?? 'completed';

    const dedupeKey = createHash('sha256')
      .update(`${org.organizationId}|${title}|${r.data ?? ''}|${durationMin ?? ''}|${weightG ?? ''}`)
      .digest('hex')
      .slice(0, 32);

    parsed.push({
      index: rowNum,
      title,
      dateStr: r.data ?? '',
      durationMin,
      weightG,
      quantity,
      filamentId,
      printerId,
      status,
      dedupeKey,
    });
  });

  if (parsed.length === 0) {
    return { error: 'Nenhuma linha válida encontrada.', invalid };
  }

  const { data: existing } = await supabase
    .from('print_jobs')
    .select('external_task_id')
    .eq('organization_id', org.organizationId)
    .eq('source', 'csv_import')
    .in('external_task_id', parsed.map((p) => p.dedupeKey));
  const existingKeys = new Set((existing ?? []).map((e) => e.external_task_id));

  let created = 0;
  let skippedDuplicates = 0;

  for (const row of parsed) {
    if (existingKeys.has(row.dedupeKey)) {
      skippedDuplicates++;
      continue;
    }

    const importedAt = row.dateStr ? new Date(row.dateStr) : new Date();
    const validDate = Number.isNaN(importedAt.getTime()) ? new Date() : importedAt;

    const { data: job, error: jobErr } = await supabase
      .from('print_jobs')
      .insert({
        organization_id: org.organizationId,
        printer_id: row.printerId,
        external_task_id: row.dedupeKey,
        title: row.title,
        normalized_status: row.status,
        manual_status: row.status,
        manual_duration_s: row.durationMin !== null ? row.durationMin * 60 : null,
        manual_weight_g: row.weightG,
        quantity_produced: row.quantity,
        source: 'csv_import',
        duration_source: 'csv_import',
        imported_at: validDate.toISOString(),
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      invalid.push({ row: row.index, reason: `Falha ao gravar: ${jobErr?.message ?? 'erro desconhecido'}` });
      continue;
    }

    if (row.filamentId && row.weightG && row.weightG > 0) {
      const { data: fil } = await supabase
        .from('filaments')
        .select('default_price_per_kg')
        .eq('id', row.filamentId)
        .single();
      const pricePerKg = Number(fil?.default_price_per_kg) || 0;
      const materialCost = (row.weightG * pricePerKg) / 1000;
      await supabase.from('print_job_materials').insert({
        organization_id: org.organizationId,
        print_job_id: job.id,
        filament_id: row.filamentId,
        source: 'manual',
        weight_g: row.weightG,
        price_per_kg_snapshot: pricePerKg,
        material_cost_snapshot: Math.round(materialCost * 10000) / 10000,
      });
    }

    await recalculatePrintJob(supabase, org.organizationId, job.id);
    created++;
  }

  revalidatePath('/impressoes');
  revalidatePath('/dashboard');

  return { ok: true, created, skippedDuplicates, invalid };
}
