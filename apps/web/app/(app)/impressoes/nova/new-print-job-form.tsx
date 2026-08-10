'use client';
import { useActionState, useState } from 'react';
import { IconAlertTriangle, IconPlus } from '@/components/icons';
import { Select } from '@/components/select';
import { createManualPrintJob } from '../actions';

type Option = { id: string; label: string };
type SpoolOption = { id: string; filamentId: string; label: string };
type State = { error?: string } | undefined;

export function NewPrintJobForm({
  filaments,
  printers,
  spools,
}: {
  filaments: Option[];
  printers: Option[];
  spools: SpoolOption[];
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    createManualPrintJob,
    undefined,
  );
  const [materialRows, setMaterialRows] = useState([0]);
  const [rowFilament, setRowFilament] = useState<Record<number, string>>({});

  return (
    <form action={action} className="space-y-7">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">
            Título
          </label>
          <input id="title" name="title" required className="input" placeholder="Suporte de fone" />
        </div>

        <div>
          <label className="label" htmlFor="printerId">
            Impressora
          </label>
          <Select
            id="printerId"
            name="printerId"
            placeholder="— Nenhuma —"
            options={printers.map((p) => ({ value: p.id, label: p.label }))}
          />
        </div>

        <div>
          <label className="label" htmlFor="normalizedStatus">
            Status
          </label>
          <Select
            id="normalizedStatus"
            name="normalizedStatus"
            defaultValue="completed"
            options={[
              { value: 'completed', label: 'Concluída' },
              { value: 'printing', label: 'Imprimindo' },
              { value: 'pending', label: 'Pendente' },
              { value: 'failed', label: 'Falhou' },
              { value: 'cancelled', label: 'Cancelada' },
            ]}
          />
        </div>

        <div>
          <label className="label" htmlFor="durationMin">
            Duração (min)
          </label>
          <input id="durationMin" name="durationMin" type="number" min="0" step="1" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="manualWeightG">
            Peso total (g)
          </label>
          <input id="manualWeightG" name="manualWeightG" type="number" min="0" step="0.1" className="input" />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="quantityProduced">
            Quantidade produzida
          </label>
          <input
            id="quantityProduced"
            name="quantityProduced"
            type="number"
            min="0"
            step="1"
            defaultValue="1"
            className="input md:w-40"
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
            Materiais
          </h3>
          <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
            Preço/kg capturado do cadastro no momento do registro
          </p>
        </div>
        <div className="space-y-2 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
          {materialRows.map((row, idx) => {
            const selectedFilament = rowFilament[row];
            const availableSpools = selectedFilament
              ? spools.filter((s) => s.filamentId === selectedFilament)
              : [];
            return (
              <div key={row} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,1fr,110px,auto]">
                <Select
                  name="materialFilamentId"
                  placeholder="— Filamento —"
                  options={filaments.map((f) => ({ value: f.id, label: f.label }))}
                  onChange={(v) => setRowFilament((prev) => ({ ...prev, [row]: v }))}
                />
                <Select
                  // Remonta ao trocar de filamento — descarta o rolo
                  // selecionado antes, já que a lista de opções mudou.
                  key={`spool-${row}-${selectedFilament ?? ''}`}
                  name="materialSpoolId"
                  disabled={!selectedFilament}
                  placeholder={
                    selectedFilament
                      ? availableSpools.length > 0
                        ? '— Rolo (opcional) —'
                        : 'Sem rolos em estoque'
                      : 'Selecione o filamento primeiro'
                  }
                  options={availableSpools.map((s) => ({ value: s.id, label: s.label }))}
                />
                <input
                  name="materialWeightG"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Peso (g)"
                  className="input"
                />
                {idx > 0 ? (
                  <button
                    type="button"
                    className="btn-ghost px-2.5"
                    onClick={() => setMaterialRows((rows) => rows.filter((r) => r !== row))}
                    aria-label="Remover material"
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="btn-ghost text-[12.5px]"
            onClick={() => setMaterialRows((rows) => [...rows, Math.max(...rows) + 1])}
          >
            <IconPlus width={13} height={13} strokeWidth={2} />
            Adicionar material
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
          Custos adicionais
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="laborCost">
              Mão de obra (R$)
            </label>
            <input id="laborCost" name="laborCost" type="number" min="0" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="packagingCost">
              Embalagem (R$)
            </label>
            <input id="packagingCost" name="packagingCost" type="number" min="0" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="otherCost">
              Outros (R$)
            </label>
            <input id="otherCost" name="otherCost" type="number" min="0" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="failurePercentage">
              Reserva falha (%)
            </label>
            <input
              id="failurePercentage"
              name="failurePercentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue="0"
              className="input"
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <IconAlertTriangle width={15} height={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex gap-2 border-t border-black/[0.06] pt-6 dark:border-white/[0.08]">
        <button type="submit" className="btn-primary px-5 py-2.5" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar e calcular custo'}
        </button>
      </div>
    </form>
  );
}
