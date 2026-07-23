import { notFound } from 'next/navigation';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatMoney, formatWeight, formatDuration, formatDateTime } from '@/lib/format';

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

  const [materialsRes, snapRes] = await Promise.all([
    supabase
      .from('print_job_materials')
      .select('weight_g, price_per_kg_snapshot, material_cost_snapshot, source, filament_id')
      .eq('print_job_id', id),
    supabase
      .from('print_cost_snapshots')
      .select('*')
      .eq('print_job_id', id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const materials = materialsRes.data ?? [];
  const snap = snapRes.data;

  const isManual = (v: unknown) => v !== null && v !== undefined;

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
        action={<StatusBadge status={job.normalized_status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-400">Dados</h2>
          <dl className="space-y-2 text-sm">
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
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-400">
            Custo detalhado
          </h2>
          {!snap ? (
            <p className="text-sm text-neutral-500">Sem snapshot de custo.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <tbody>
                  {costRows.map(([label, value]) => (
                    <tr key={label} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-1.5 text-neutral-500">{label}</td>
                      <td className="py-1.5 text-right">{formatMoney(value, org.currency)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-semibold">Total</td>
                    <td className="py-2 text-right font-semibold">
                      {formatMoney(snap.total_cost, org.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {snap.estimated && (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  Cálculo marcado como estimado (materiais sem peso por item).
                </p>
              )}
              <p className="mt-2 text-xs text-neutral-400">
                Versão do cálculo: {snap.calculation_version} · {formatDateTime(snap.calculated_at, org.timezone)}
              </p>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-400">Materiais</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum material associado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-1">Peso</th>
                <th className="py-1">Preço/kg (snapshot)</th>
                <th className="py-1">Custo</th>
                <th className="py-1">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => (
                <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5">{formatWeight(m.weight_g)}</td>
                  <td className="py-1.5">{formatMoney(m.price_per_kg_snapshot, org.currency)}</td>
                  <td className="py-1.5">{formatMoney(m.material_cost_snapshot, org.currency)}</td>
                  <td className="py-1.5 text-neutral-500">{m.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {job.raw_payload_json ? (
        <Card className="mt-4">
          <details>
            <summary className="cursor-pointer text-sm font-medium">Payload técnico</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100">
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
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function ManualTag() {
  return <span className="badge bg-blue-100 text-blue-700">manual</span>;
}
