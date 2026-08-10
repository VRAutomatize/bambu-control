'use client';

/** Formulário de "associar filamento" a uma impressão já existente — é
 * assim que uma impressão sincronizada da Bambu Cloud (chega sem nenhum
 * material, então sem custo) passa a ter custo calculado. */
import { useState } from 'react';
import { AuthForm } from '@/components/auth-form';
import { Select } from '@/components/select';
import { addPrintJobMaterial } from '../actions';

type Option = { id: string; label: string };
type SpoolOption = { id: string; filamentId: string; label: string };

export function AddMaterialForm({
  printJobId,
  filaments,
  spools,
}: {
  printJobId: string;
  filaments: Option[];
  spools: SpoolOption[];
}) {
  const [selectedFilament, setSelectedFilament] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const availableSpools = selectedFilament ? spools.filter((s) => s.filamentId === selectedFilament) : [];

  return (
    <AuthForm
      action={addPrintJobMaterial}
      submitLabel="Associar material"
      onSuccess={() => {
        setSelectedFilament('');
        setResetKey((k) => k + 1);
      }}
    >
      <input type="hidden" name="printJobId" value={printJobId} />
      <div
        key={resetKey}
        className={`grid grid-cols-1 gap-2 ${spools.length > 0 ? 'sm:grid-cols-[1fr,1fr,110px]' : 'sm:grid-cols-[1fr,110px]'}`}
      >
        <Select
          name="filamentId"
          required
          searchable
          placeholder="— Filamento —"
          options={filaments.map((f) => ({ value: f.id, label: f.label }))}
          onChange={setSelectedFilament}
        />
        {spools.length > 0 && (
          <Select
            key={`spool-${selectedFilament}`}
            name="spoolId"
            disabled={!selectedFilament}
            placeholder={
              selectedFilament
                ? availableSpools.length > 0
                  ? '— Rolo (opcional) —'
                  : 'Nenhum rolo deste filamento'
                : 'Selecione o filamento primeiro'
            }
            options={availableSpools.map((s) => ({ value: s.id, label: s.label }))}
          />
        )}
        <input name="weightG" type="number" min="0.1" step="0.1" required className="input" placeholder="Peso (g)" />
      </div>
    </AuthForm>
  );
}
