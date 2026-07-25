'use server';
import { revalidatePath } from 'next/cache';
import { filamentSchema, spoolSchema } from '@bambu/contracts';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function createFilament(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const parsed = filamentSchema.safeParse({
    brand: formData.get('brand') || null,
    name: formData.get('name'),
    material: formData.get('material') || null,
    colorName: formData.get('colorName') || null,
    colorHex: formData.get('colorHex') || null,
    defaultPricePerKg: formData.get('defaultPricePerKg') || 0,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  const f = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('filaments').insert({
    organization_id: org.organizationId,
    brand: f.brand,
    name: f.name,
    material: f.material,
    color_name: f.colorName,
    color_hex: f.colorHex ? (f.colorHex.startsWith('#') ? f.colorHex : `#${f.colorHex}`) : null,
    diameter_mm: f.diameterMm,
    default_price_per_kg: f.defaultPricePerKg,
  });
  if (error) return { error: error.message };
  revalidatePath('/filamentos');
  return { ok: 'Filamento cadastrado.' };
}

/** Cadastra um rolo físico (spool) em estoque, com peso inicial = peso restante. */
export async function createSpool(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const parsed = spoolSchema.safeParse({
    filamentId: formData.get('filamentId'),
    label: formData.get('label') || null,
    supplier: formData.get('supplier') || null,
    purchasePrice: formData.get('purchasePrice') || 0,
    initialNetWeightG: formData.get('initialNetWeightG') || 1000,
    lotNumber: formData.get('lotNumber') || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('spools').insert({
    organization_id: org.organizationId,
    filament_id: s.filamentId,
    label: s.label,
    supplier: s.supplier,
    purchase_price: s.purchasePrice,
    initial_net_weight_g: s.initialNetWeightG,
    remaining_weight_g: s.initialNetWeightG,
    lot_number: s.lotNumber,
    status: 'sealed',
  });
  if (error) return { error: error.message };
  revalidatePath('/filamentos');
  return { ok: 'Rolo adicionado ao estoque.' };
}

/** Marca um rolo como arquivado (não aparece mais como disponível para uso). */
export async function archiveSpool(spoolId: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return;
  const supabase = await createClient();
  await supabase
    .from('spools')
    .update({ status: 'archived' })
    .eq('id', spoolId)
    .eq('organization_id', org.organizationId);
  revalidatePath('/filamentos');
}
