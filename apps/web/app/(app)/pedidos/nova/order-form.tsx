'use client';
import { useActionState, useState } from 'react';
import { createOrder } from '../actions';

type State = { error?: string } | undefined;

export function OrderForm({ customers }: { customers: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<State, FormData>(createOrder, undefined);
  const [rows, setRows] = useState([0]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="orderNumber">
            Número do pedido *
          </label>
          <input id="orderNumber" name="orderNumber" required className="input" placeholder="PED-0001" />
        </div>
        <div>
          <label className="label" htmlFor="customerId">
            Cliente
          </label>
          <select id="customerId" name="customerId" className="input" defaultValue="">
            <option value="">— Sem cliente —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-2 text-sm font-medium">Itens</legend>
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={row} className="grid grid-cols-[1fr,90px,120px,auto] gap-2">
              <input name="itemDescription" className="input" placeholder="Descrição" />
              <input name="itemQuantity" type="number" min="1" step="1" defaultValue="1" className="input" placeholder="Qtd" />
              <input name="itemUnitPrice" type="number" min="0" step="0.01" className="input" placeholder="Preço un." />
              {idx > 0 ? (
                <button type="button" className="btn-secondary" onClick={() => setRows((r) => r.filter((x) => x !== row))}>
                  −
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}>
          + Adicionar item
        </button>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="discount">
            Desconto (R$)
          </label>
          <input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue="0" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="shippingAmount">
            Frete (R$)
          </label>
          <input id="shippingAmount" name="shippingAmount" type="number" min="0" step="0.01" defaultValue="0" className="input" />
        </div>
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Salvando…' : 'Criar pedido'}
      </button>
    </form>
  );
}
