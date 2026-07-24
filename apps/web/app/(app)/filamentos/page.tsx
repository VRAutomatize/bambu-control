import { revalidatePath } from 'next/cache';
import { filamentSchema } from '@bambu/contracts';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function createFilament(_prev: unknown, formData: FormData) {
  'use server';
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

export default async function FilamentosPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: filaments } = await supabase
    .from('filaments')
    .select('id, brand, name, material, color_name, color_hex, default_price_per_kg, active')
    .eq('organization_id', org.organizationId)
    .order('name');

  return (
    <div>
      <PageHeader title="Filamentos" subtitle="Catálogo de materiais e preços" />
      <div className="grid gap-5 lg:grid-cols-[1fr,340px]">
        <div>
          {!filaments || filaments.length === 0 ? (
            <EmptyState title="Nenhum filamento" description="Cadastre seu primeiro material ao lado." />
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th className="table-cell-head">Nome</th>
                    <th className="table-cell-head">Material</th>
                    <th className="table-cell-head">Cor</th>
                    <th className="table-cell-head">Preço/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {filaments.map((f) => (
                    <tr key={f.id} className="table-row">
                      <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                        {f.brand ? `${f.brand} — ` : ''}
                        {f.name}
                      </td>
                      <td className="table-cell">{f.material ?? '—'}</td>
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                            style={{ backgroundColor: f.color_hex ?? '#ccc' }}
                          />
                          {f.color_name ?? '—'}
                        </span>
                      </td>
                      <td className="table-cell tabular-nums">{formatMoney(f.default_price_per_kg, org.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Novo filamento</h2>
          <AuthForm action={createFilament} submitLabel="Cadastrar">
            <input name="name" required className="input" placeholder="Nome (ex.: PLA Basic)" />
            <input name="brand" className="input" placeholder="Marca" />
            <input name="material" className="input" placeholder="Material (PLA, PETG…)" />
            <div className="grid grid-cols-2 gap-2.5">
              <input name="colorName" className="input" placeholder="Cor" />
              <input name="colorHex" className="input" placeholder="#00A651" />
            </div>
            <input
              name="defaultPricePerKg"
              type="number"
              min="0"
              step="0.01"
              className="input"
              placeholder="Preço por kg (R$)"
            />
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}
