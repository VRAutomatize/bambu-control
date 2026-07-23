'use client';
import { useActionState, useState } from 'react';
import { createManualPrintJob } from '../actions';

type Option = { id: string; label: string };
type State = { error?: string } | undefined;

export function NewPrintJobForm({
  filaments,
  printers,
}: {
  filaments: Option[];
  printers: Option[];
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    createManualPrintJob,
    undefined,
  );
  const [materialRows, setMaterialRows] = useState([0]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">
            Título *
          </label>
          <input id="title" name="title" required className="input" placeholder="Suporte de fone" />
        </div>

        <div>
          <label className="label" htmlFor="printerId">
            Impressora
          </label>
          <select id="printerId" name="printerId" className="input" defaultValue="">
            <option value="">— Nenhuma —</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="normalizedStatus">
            Status
          </label>
          <select id="normalizedStatus" name="normalizedStatus" className="input" defaultValue="completed">
            <option value="completed">Concluída</option>
            <option value="printing">Imprimindo</option>
            <option value="pending">Pendente</option>
            <option value="failed">Falhou</option>
            <option value="cancelled">Cancelada</option>
          </select>
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
            defaultValue="1"
            className="input"
          />
        </div>
      </div>

      <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-2 text-sm font-medium">Materiais</legend>
        <div className="space-y-3">
          {materialRows.map((row, idx) => (
            <div key={row} className="grid grid-cols-[1fr,140px,auto] gap-2">
              <select name="materialFilamentId" className="input" defaultValue="">
                <option value="">— Filamento —</option>
                {filaments.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                name="materialWeightG"
                type="number"
                min="0"
                step="0.1"
                placeholder="Peso (g)"
                className="input"
              />
              {idx > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMaterialRows((rows) => rows.filter((r) => r !== row))}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary mt-3 text-xs"
          onClick={() => setMaterialRows((rows) => [...rows, Math.max(...rows) + 1])}
        >
          + Adicionar material
        </button>
        <p className="mt-2 text-xs text-neutral-400">
          O preço por kg é capturado do cadastro do filamento no momento do registro (snapshot).
        </p>
      </fieldset>

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

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar e calcular custo'}
        </button>
      </div>
    </form>
  );
}
