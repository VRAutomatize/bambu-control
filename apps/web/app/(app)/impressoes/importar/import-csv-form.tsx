'use client';
import { useActionState, useMemo, useState } from 'react';
import { IconAlertTriangle, IconCheckCircle } from '@/components/icons';
import { parseCsv, csvRowsToObjects } from '@/lib/csv';
import { importPrintJobsCsv } from './actions';

type State = Awaited<ReturnType<typeof importPrintJobsCsv>> | undefined;

export function ImportCsvForm({ filamentNames }: { filamentNames: string[] }) {
  const [state, action, pending] = useActionState<State, FormData>(importPrintJobsCsv, undefined);
  const [csvText, setCsvText] = useState('');

  const filamentSet = useMemo(() => new Set(filamentNames.map((n) => n.toLowerCase())), [filamentNames]);

  const preview = useMemo(() => {
    if (!csvText.trim()) return null;
    const rows = csvRowsToObjects(parseCsv(csvText));
    return rows.slice(0, 10).map((r, i) => {
      const problems: string[] = [];
      if (!r.titulo?.trim()) problems.push('sem título');
      if (r.filamento && !filamentSet.has(r.filamento.trim().toLowerCase())) {
        problems.push(`filamento "${r.filamento}" não cadastrado`);
      }
      return { index: i, row: r, problems, total: rows.length };
    });
  }, [csvText, filamentSet]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <a href="/templates/impressoes-template.csv" download className="btn-secondary text-xs">
          Baixar modelo CSV
        </a>
        <p className="mt-2 text-[11.5px] text-neutral-500 dark:text-neutral-400">
          Colunas: <code className="font-mono">titulo, data, duracao_min, peso_g, quantidade, filamento,
          impressora, status</code>. Apenas <strong>titulo</strong> é obrigatório. O nome do filamento precisa
          bater exatamente com um já cadastrado em Filamentos.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="csvFile">
            Arquivo CSV
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            className="input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="csvText">
            Ou cole o conteúdo aqui
          </label>
          <textarea
            id="csvText"
            className="input min-h-32 font-mono text-[12px]"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="titulo,data,duracao_min,peso_g,quantidade,filamento,impressora,status"
          />
        </div>
        <input type="hidden" name="csvText" value={csvText} />

        {preview && preview.length > 0 && (
          <div>
            <h3 className="mb-2 text-[12.5px] font-semibold text-neutral-700 dark:text-neutral-200">
              Pré-visualização ({preview[0]!.total} linha{preview[0]!.total === 1 ? '' : 's'} detectada
              {preview[0]!.total === 1 ? '' : 's'}, mostrando até 10)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
              <table className="w-full text-[12px]">
                <thead className="table-head">
                  <tr>
                    <th className="table-cell-head">Título</th>
                    <th className="table-cell-head">Data</th>
                    <th className="table-cell-head">Peso (g)</th>
                    <th className="table-cell-head">Filamento</th>
                    <th className="table-cell-head">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr
                      key={p.index}
                      className={`table-row ${p.problems.length > 0 ? 'bg-red-50 dark:bg-red-500/10' : ''}`}
                    >
                      <td className="table-cell">{p.row.titulo || '—'}</td>
                      <td className="table-cell">{p.row.data || '—'}</td>
                      <td className="table-cell">{p.row.peso_g || '—'}</td>
                      <td className="table-cell">{p.row.filamento || '—'}</td>
                      <td className="table-cell">
                        {p.problems.length > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{p.problems.join('; ')}</span>
                        ) : (
                          <span className="text-brand-600 dark:text-brand-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {state?.error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <IconAlertTriangle width={15} height={15} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}

        {state?.ok && (
          <div className="space-y-2 rounded-xl bg-brand-50 px-3.5 py-3 dark:bg-brand-500/10">
            <p className="flex items-center gap-2 text-[13px] font-medium text-brand-700 dark:text-brand-300">
              <IconCheckCircle width={15} height={15} />
              {state.created} impressão(ões) importada(s)
              {state.skippedDuplicates ? `, ${state.skippedDuplicates} duplicada(s) ignorada(s)` : ''}.
            </p>
            {state.invalid && state.invalid.length > 0 && (
              <div className="text-[12px] text-amber-700 dark:text-amber-300">
                <p className="font-medium">{state.invalid.length} linha(s) com problema:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {state.invalid.slice(0, 15).map((inv) => (
                    <li key={inv.row}>
                      Linha {inv.row}: {inv.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button type="submit" className="btn-primary px-5 py-2.5" disabled={pending || !csvText.trim()}>
            {pending ? 'Importando…' : 'Importar'}
          </button>
          {!csvText.trim() && !pending && (
            <span className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
              Envie um arquivo ou cole o conteúdo do CSV para habilitar
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
