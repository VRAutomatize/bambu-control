import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { Select } from '@/components/select';
import { ColorPickerField } from '@/components/color-picker';
import { IconAlertTriangle } from '@/components/icons';
import { formatMoney, formatWeight } from '@/lib/format';
import { createFilament, createSpool } from './actions';
import { ArchiveSpoolButton } from './spool-actions';

export const dynamic = 'force-dynamic';

const SPOOL_STATUS_LABELS: Record<string, string> = {
  sealed: 'Lacrado',
  active: 'Em uso',
  empty: 'Vazio',
  archived: 'Arquivado',
};

const SPOOL_STATUS_STYLES: Record<string, string> = {
  sealed: 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
  active: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
  empty: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  archived: 'bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-neutral-500',
};

export default async function FilamentosPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const [filamentsRes, spoolsRes] = await Promise.all([
    supabase
      .from('filaments')
      .select('id, brand, name, material, color_name, color_hex, default_price_per_kg, active')
      .eq('organization_id', org.organizationId)
      .order('name'),
    supabase
      .from('spools')
      .select('id, filament_id, label, supplier, purchase_price, initial_net_weight_g, remaining_weight_g, status')
      .eq('organization_id', org.organizationId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),
  ]);

  const filaments = filamentsRes.data ?? [];
  const spools = spoolsRes.data ?? [];
  const filamentById = new Map(filaments.map((f) => [f.id, f]));

  const lowStockSpools = spools.filter(
    (s) => s.status !== 'empty' && Number(s.remaining_weight_g) <= Number(s.initial_net_weight_g) * 0.15,
  );

  return (
    <div>
      <PageHeader title="Filamentos" subtitle="Catálogo de materiais, preços e estoque de rolos" />

      {lowStockSpools.length > 0 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
          <IconAlertTriangle width={16} height={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[12.5px] text-amber-800 dark:text-amber-200">
            <strong>{lowStockSpools.length}</strong> rolo(s) com estoque baixo (abaixo de 15%):{' '}
            {lowStockSpools
              .map((s) => filamentById.get(s.filament_id)?.name ?? s.label ?? 'rolo')
              .join(', ')}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr,340px]">
        <div className="space-y-5">
          <div>
            <h2 className="mb-3 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400">
              Catálogo de materiais
            </h2>
            {filaments.length === 0 ? (
              <EmptyState title="Nenhum filamento" description="Cadastre seu primeiro material ao lado." />
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
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
                          <td className="table-cell tabular-nums">
                            {formatMoney(f.default_price_per_kg, org.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400">
              Estoque de rolos (spools)
            </h2>
            {spools.length === 0 ? (
              <EmptyState
                title="Nenhum rolo em estoque"
                description="Cadastre os rolos físicos que você possui para o sistema controlar o consumo automaticamente."
              />
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-head">
                      <tr>
                        <th className="table-cell-head">Filamento</th>
                        <th className="table-cell-head">Rótulo</th>
                        <th className="table-cell-head">Restante</th>
                        <th className="table-cell-head">Status</th>
                        <th className="table-cell-head" />
                      </tr>
                    </thead>
                    <tbody>
                      {spools.map((s) => {
                        const filament = filamentById.get(s.filament_id);
                        const pct = Math.round(
                          (Number(s.remaining_weight_g) / Number(s.initial_net_weight_g)) * 100,
                        );
                        return (
                          <tr key={s.id} className="table-row">
                            <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                              {filament?.name ?? '—'}
                            </td>
                            <td className="table-cell">{s.label ?? '—'}</td>
                            <td className="table-cell tabular-nums">
                              {formatWeight(s.remaining_weight_g)} / {formatWeight(s.initial_net_weight_g)}
                              <span className="ml-1.5 text-[11px] text-neutral-400">({pct}%)</span>
                            </td>
                            <td className="table-cell">
                              <span className={`badge ${SPOOL_STATUS_STYLES[s.status] ?? ''}`}>
                                {SPOOL_STATUS_LABELS[s.status] ?? s.status}
                              </span>
                            </td>
                            <td className="table-cell text-right">
                              <ArchiveSpoolButton spoolId={s.id} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Novo filamento</h2>
            <AuthForm action={createFilament} submitLabel="Cadastrar">
              <input name="name" required className="input" placeholder="Nome (ex.: PLA Basic)" />
              <input name="brand" className="input" placeholder="Marca" />
              <input name="material" className="input" placeholder="Material (PLA, PETG…)" />
              <ColorPickerField nameField="colorName" hexField="colorHex" />
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

          {filaments.length > 0 && (
            <Card>
              <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Adicionar rolo ao estoque</h2>
              <AuthForm action={createSpool} submitLabel="Adicionar rolo">
                <Select
                  name="filamentId"
                  required
                  placeholder="— Filamento —"
                  options={filaments.map((f) => ({
                    value: f.id,
                    label: `${f.brand ? `${f.brand} — ` : ''}${f.name}`,
                  }))}
                />
                <input name="label" className="input" placeholder="Rótulo (ex.: Rolo #1)" />
                <input
                  name="initialNetWeightG"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="1000"
                  className="input"
                  placeholder="Peso líquido (g)"
                />
                <input
                  name="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder="Preço pago no rolo (R$)"
                />
                <input name="supplier" className="input" placeholder="Fornecedor (opcional)" />
              </AuthForm>
              <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
                O peso restante é abatido automaticamente sempre que uma impressão consumir material deste rolo.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
