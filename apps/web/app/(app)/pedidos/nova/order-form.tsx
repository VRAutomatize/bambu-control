'use client';
import { useActionState, useState } from 'react';
import { IconAlertTriangle, IconPlus } from '@/components/icons';
import { createOrder } from '../actions';

type State = { error?: string } | undefined;

export function OrderForm({ customers }: { customers: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<State, FormData>(createOrder, undefined);
  const [rows, setRows] = useState([0]);

  return (
    <form action={action} className="space-y-7">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="orderNumber">
            Número do pedido
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

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
          Itens
        </h3>
        <div className="space-y-2 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
          {rows.map((row, idx) => (
            <div key={row} className="grid grid-cols-[1fr,90px,120px,auto] gap-2">
              <input name="itemDescription" className="input" placeholder="Descrição" />
              <input name="itemQuantity" type="number" min="1" step="1" defaultValue="1" className="input" placeholder="Qtd" />
              <input name="itemUnitPrice" type="number" min="0" step="0.01" className="input" placeholder="Preço un." />
              {idx > 0 ? (
                <button
                  type="button"
                  className="btn-ghost px-2.5"
                  onClick={() => setRows((r) => r.filter((x) => x !== row))}
                  aria-label="Remover item"
                >
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost text-[12.5px]"
            onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}
          >
            <IconPlus width={13} height={13} strokeWidth={2} />
            Adicionar item
          </button>
        </div>
      </div>

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

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <IconAlertTriangle width={15} height={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <div className="border-t border-black/[0.06] pt-6 dark:border-white/[0.08]">
        <button type="submit" className="btn-primary px-5 py-2.5" disabled={pending}>
          {pending ? 'Salvando…' : 'Criar pedido'}
        </button>
      </div>
    </form>
  );
}
