import { notFound } from 'next/navigation';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { EditButton } from '@/components/edit-button';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { Select } from '@/components/select';
import { formatMoney, formatWeight, formatDuration, formatDateTime } from '@/lib/format';
import { updatePrintJob, deletePrintJob, removePrintJobMaterial } from '../actions';
import { AddMaterialForm } from './add-material-form';

export const dynamic = 'force-dynamic';

export default async function PrintJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .single();
  if (!job) notFound();

  const [materialsRes, snapRes, filamentsRes, printersRes, spoolsRes] = await Promise.all([
    supabase
      .from('print_job_materials')
      .select('id, weight_g, price_per_kg_snapshot, material_cost_snapshot, source, filament_id, filaments(name, brand)')
      .eq('print_job_id', id),
    supabase
      .from('print_cost_snapshots')
      .select('*')
      .eq('print_job_id', id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('filaments')
      .select('id, name, brand')
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
  const materials = materialsRes.data ?? [];
  const snap = snapRes.data;

  const filamentOptions = (filamentsRes.data ?? []).map((f) => ({
    id: f.id,
    label: `${f.brand ? f.brand + ' — ' : ''}${f.name}`,
  }));
  const printerOptions = (printersRes.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.name}${p.model ? ` (${p.model})` : ''}`,
  }));
  const spoolOptions = (spoolsRes.data ?? []).map((s) => ({
    id: s.id,
    filamentId: s.filament_id,
    label: `${s.label ?? 'Rolo'} — ${Math.round(Number(s.remaining_weight_g))}g restantes`,
  }));

  const isManual = (v: unknown) => v !== null && v !== undefined;

  // O % de reserva pra falha não é uma coluna do snapshot — só existe
  // dentro do input que gerou o cálculo. Recupera pra não resetar
  // silenciosamente um valor que o usuário já tinha configurado.
  const prevFailurePercentage =
    snap?.calculation_input_json &&
    typeof snap.calculation_input_json === 'object' &&
    !Array.isArray(snap.calculation_input_json) &&
    'failurePercentage' in snap.calculation_input_json
      ? Number(snap.calculation_input_json.failurePercentage) || 0
      : 0;

  const costRows: Array<[string, number | null | undefined]> = snap
    ? [
        ['Material', snap.material_cost],
        ['Energia', snap.electricity_cost],
        ['Depreciação', snap.depreciation_cost],
        ['Manutenção', snap.maintenance_cost],
        ['Overhead máquina', snap.machine_overhead_cost],
        ['Mão de obra', snap.labor_cost],
        ['Reserva falha', snap.failure_allowance_cost],
        ['Embalagem', snap.packaging_cost],
        ['Outros', snap.other_cost],
      ]
    : [];

  return (
    <div>
      <PageHeader
        title={job.title ?? 'Impressão'}
        subtitle={`Origem: ${job.source}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={job.normalized_status} />
            <EditButton title="Editar impressão" action={updatePrintJob} submitLabel="Salvar">
              <input type="hidden" name="id" value={job.id} />
              <div>
                <label className="label" htmlFor="title">
                  Título
                </label>
                <input id="title" name="title" required defaultValue={job.title ?? ''} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="printerId">
                  Impressora
                </label>
                <Select
                  id="printerId"
                  name="printerId"
                  searchable
                  placeholder="— Nenhuma —"
                  defaultValue={job.printer_id ?? ''}
                  options={printerOptions.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="normalizedStatus">
                  Status
                </label>
                <Select
                  id="normalizedStatus"
                  name="normalizedStatus"
                  defaultValue={job.normalized_status}
                  options={[
                    { value: 'completed', label: 'Concluída' },
                    { value: 'printing', label: 'Imprimindo' },
                    { value: 'pending', label: 'Pendente' },
                    { value: 'failed', label: 'Falhou' },
                    { value: 'cancelled', label: 'Cancelada' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="label" htmlFor="durationMin">
                    Duração (min)
                  </label>
                  <input
                    id="durationMin"
                    name="durationMin"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={job.effective_duration_s ? Math.round(job.effective_duration_s / 60) : ''}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="manualWeightG">
                    Peso total (g)
                  </label>
                  <input
                    id="manualWeightG"
                    name="manualWeightG"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue={job.effective_weight_g ?? ''}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="quantityProduced">
                  Quantidade produzida
                </label>
                <input
                  id="quantityProduced"
                  name="quantityProduced"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={job.quantity_produced}
                  className="input"
                />
              </div>
              <p className="pb-0.5 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
                Custos adicionais
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  name="laborCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={snap?.labor_cost ?? 0}
                  className="input"
                  placeholder="Mão de obra (R$)"
                />
                <input
                  name="packagingCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={snap?.packaging_cost ?? 0}
                  className="input"
                  placeholder="Embalagem (R$)"
                />
                <input
                  name="otherCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={snap?.other_cost ?? 0}
                  className="input"
                  placeholder="Outros (R$)"
                />
                <input
                  name="failurePercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={prevFailurePercentage}
                  className="input"
                  placeholder="Reserva falha (%)"
                />
              </div>
            </EditButton>
            <ConfirmActionButton action={deletePrintJob} id={job.id} label="Excluir" />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Dados
          </h2>
          <dl className="space-y-2.5 text-[13.5px]">
            <Row label="Duração">
              {formatDuration(job.effective_duration_s)}{' '}
              {isManual(job.manual_duration_s) && <ManualTag />}
            </Row>
            <Row label="Peso">
              {formatWeight(job.effective_weight_g)}{' '}
              {isManual(job.manual_weight_g) && <ManualTag />}
            </Row>
            <Row label="Quantidade">{job.quantity_produced}</Row>
            <Row label="Início">{formatDateTime(job.provider_start_at, org.timezone)}</Row>
            <Row label="Fim">{formatDateTime(job.provider_end_at, org.timezone)}</Row>
            <Row label="Fonte da duração">{job.duration_source ?? '—'}</Row>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Custo detalhado
          </h2>
          {!snap ? (
            <p className="text-[13.5px] text-neutral-500">
              Sem snapshot de custo — associe um filamento abaixo para calcular.
            </p>
          ) : (
            <>
              <table className="w-full">
                <tbody>
                  {costRows.map(([label, value]) => (
                    <tr key={label} className="hairline">
                      <td className="py-2 text-[13.5px] text-neutral-500">{label}</td>
                      <td className="py-2 text-right text-[13.5px] tabular-nums text-neutral-800 dark:text-neutral-200">
                        {formatMoney(value, org.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-3 text-[14px] font-semibold text-neutral-900 dark:text-neutral-50">
                      Total
                    </td>
                    <td className="pt-3 text-right text-[16px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {formatMoney(snap.total_cost, org.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {snap.estimated && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Cálculo marcado como estimado (materiais sem peso por item).
                </p>
              )}
              {snap.material_cost === 0 && materials.length === 0 && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Nenhum filamento associado — o custo de material está zerado. Associe um
                  filamento abaixo para o custo real aparecer.
                </p>
              )}
              <p className="mt-3 text-[11.5px] text-neutral-400 dark:text-neutral-500">
                Versão do cálculo: {snap.calculation_version} ·{' '}
                {formatDateTime(snap.calculated_at, org.timezone)}
              </p>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Materiais
        </h2>
        {materials.length === 0 ? (
          <p className="mb-4 text-[13.5px] text-neutral-500">
            Nenhum material associado
            {job.source === 'bambu_cloud'
              ? ' — impressões sincronizadas da Bambu Cloud não trazem o filamento usado automaticamente.'
              : '.'}
          </p>
        ) : (
          <table className="mb-4 w-full">
            <thead className="table-head">
              <tr>
                <th className="py-2">Filamento</th>
                <th className="py-2">Peso</th>
                <th className="py-2">Preço/kg (snapshot)</th>
                <th className="py-2">Custo</th>
                <th className="py-2">Fonte</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const fil = Array.isArray(m.filaments) ? m.filaments[0] : m.filaments;
                return (
                  <tr key={m.id} className="hairline">
                    <td className="py-2 text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100">
                      {fil ? `${fil.brand ? fil.brand + ' — ' : ''}${fil.name}` : '—'}
                    </td>
                    <td className="py-2 text-[13.5px]">{formatWeight(m.weight_g)}</td>
                    <td className="py-2 text-[13.5px]">{formatMoney(m.price_per_kg_snapshot, org.currency)}</td>
                    <td className="py-2 text-[13.5px]">{formatMoney(m.material_cost_snapshot, org.currency)}</td>
                    <td className="py-2 text-[13.5px] text-neutral-500">{m.source}</td>
                    <td className="py-2 text-right">
                      <ConfirmActionButton
                        action={removePrintJobMaterial}
                        id={m.id}
                        label="Remover"
                        confirmText="Remover?"
                        pendingLabel="Removendo…"
                        icon={false}
                        className="text-[11px] font-medium text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {filamentOptions.length === 0 ? (
          <p className="text-[12.5px] text-neutral-400 dark:text-neutral-500">
            Cadastre um filamento em <strong>Filamentos</strong> para poder associá-lo aqui.
          </p>
        ) : (
          <>
            <h3 className="mb-2.5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
              Associar filamento
            </h3>
            <AddMaterialForm printJobId={job.id} filaments={filamentOptions} spools={spoolOptions} />
          </>
        )}
      </Card>

      {job.raw_payload_json ? (
        <Card className="mt-4">
          <details>
            <summary className="cursor-pointer text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
              Payload técnico
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-neutral-900 p-3.5 text-[11.5px] leading-relaxed text-neutral-100">
              {JSON.stringify(job.raw_payload_json, null, 2)}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
        {children}
      </dd>
    </div>
  );
}

function ManualTag() {
  return <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">manual</span>;
}
