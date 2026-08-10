'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentSchema } from '@bambu/contracts';
import { Dec } from '@bambu/domain';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Cria um pedido com itens; calcula subtotal e total. */
export async function createOrder(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };

  const orderNumber = String(formData.get('orderNumber') ?? '').trim();
  const customerId = String(formData.get('customerId') ?? '') || null;
  if (!orderNumber) return { error: 'Informe o número do pedido.' };

  const descriptions = formData.getAll('itemDescription').map(String);
  const quantities = formData.getAll('itemQuantity').map((v) => Number(v) || 0);
  const unitPrices = formData.getAll('itemUnitPrice').map((v) => Number(v) || 0);

  const items = descriptions
    .map((description, i) => ({
      description,
      quantity: quantities[i] ?? 0,
      unitPrice: unitPrices[i] ?? 0,
    }))
    .filter((it) => it.description && it.quantity > 0);

  if (items.length === 0) return { error: 'Adicione ao menos um item.' };

  const itemTotals = items.map((it) => Dec.from(it.quantity).mul(it.unitPrice));
  const subtotal = itemTotals.reduce((acc, t) => acc.add(t), Dec.ZERO);
  const discount = Dec.from(Number(formData.get('discount')) || 0);
  const shipping = Dec.from(Number(formData.get('shippingAmount')) || 0);
  const totalRaw = subtotal.sub(discount).add(shipping);
  const total = totalRaw.isNegative() ? Dec.ZERO : totalRaw;

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      organization_id: org.organizationId,
      customer_id: customerId,
      order_number: orderNumber,
      status: 'approved',
      ordered_at: new Date().toISOString(),
      subtotal: subtotal.toNumber(),
      discount: discount.toNumber(),
      shipping_amount: shipping.toNumber(),
      total_charged: total.toNumber(),
    })
    .select('id')
    .single();
  if (error || !order) return { error: `Falha: ${error?.message}` };

  let firstItemId: string | null = null;
  for (const [i, it] of items.entries()) {
    const { data: insertedItem } = await supabase
      .from('order_items')
      .insert({
        organization_id: org.organizationId,
        order_id: order.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: Dec.from(it.unitPrice).toNumber(),
        total_price: itemTotals[i]!.toNumber(),
      })
      .select('id')
      .single();
    if (i === 0) firstItemId = insertedItem?.id ?? null;
  }

  // Vincula as impressões selecionadas no wizard ao primeiro item — permite
  // "vender" várias peças já produzidas de uma vez, sem N submits manuais.
  const printJobIds = formData.getAll('printJobIds').map(String).filter(Boolean);
  if (printJobIds.length > 0 && firstItemId) {
    for (const printJobId of printJobIds) {
      const available = await getAvailableQuantity(supabase, org.organizationId, printJobId);
      if (available < 1) continue; // já vendida em outro pedido nesse meio-tempo — pula silenciosamente
      await supabase.from('order_item_print_jobs').insert({
        organization_id: org.organizationId,
        order_item_id: firstItemId,
        print_job_id: printJobId,
        allocated_quantity: 1,
      });
    }
  }

  revalidatePath('/pedidos');
  redirect(`/pedidos/${order.id}`);
}

/** Registra um pagamento (parcial suportado) e atualiza total_paid. */
export async function addPayment(orderId: string, _prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const parsed = paymentSchema.safeParse({
    amount: formData.get('amount'),
    paymentMethod: formData.get('paymentMethod') || null,
    paidAt: new Date().toISOString(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Valor inválido.' };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('orders')
    .select('total_charged, total_paid')
    .eq('id', orderId)
    .eq('organization_id', org.organizationId)
    .single();
  if (!existing) return { error: 'Pedido não encontrado.' };

  const remaining = Dec.from(existing.total_charged).sub(existing.total_paid);
  const amount = Dec.from(parsed.data.amount);
  if (amount.toNumber() > remaining.toNumber()) {
    return {
      error: `Valor excede o saldo em aberto (R$ ${remaining.toFixed(2)}).`,
    };
  }

  const { error } = await supabase.from('payments').insert({
    organization_id: org.organizationId,
    order_id: orderId,
    amount: amount.toNumber(),
    payment_method: parsed.data.paymentMethod,
    paid_at: parsed.data.paidAt,
    status: 'confirmed',
  });
  if (error) return { error: error.message };

  await recomputeOrderPaid(supabase, org.organizationId, orderId);
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: 'Pagamento registrado.' };
}

/** Associa uma impressão a um item do pedido (N:N). */
export async function associatePrintJob(orderId: string, _prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const orderItemId = String(formData.get('orderItemId') ?? '');
  const printJobId = String(formData.get('printJobId') ?? '');
  const allocatedQuantity = Number(formData.get('allocatedQuantity')) || 1;
  if (!orderItemId || !printJobId) return { error: 'Selecione item e impressão.' };

  const supabase = await createClient();

  const available = await getAvailableQuantity(supabase, org.organizationId, printJobId);
  if (allocatedQuantity > available) {
    return {
      error:
        available <= 0
          ? 'Esta impressão já está totalmente vinculada a outro(s) pedido(s).'
          : `Apenas ${available} unidade(s) disponível(is) para vincular.`,
    };
  }

  const { error } = await supabase.from('order_item_print_jobs').insert({
    organization_id: org.organizationId,
    order_item_id: orderItemId,
    print_job_id: printJobId,
    allocated_quantity: allocatedQuantity,
  });
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: 'Impressão associada.' };
}

/** Desfaz o vínculo entre um item de pedido e uma impressão (não mexe nos
 * registros em si — só na associação). Libera a impressão pra ser
 * vinculada em outro pedido, e é o que destrava excluir a impressão
 * quando ela está presa a um pedido. */
export async function removePrintJobAssociation(id: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();

  const { data: assoc } = await supabase
    .from('order_item_print_jobs')
    .select('order_item_id, order_items(order_id)')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .single();

  const { error } = await supabase
    .from('order_item_print_jobs')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };

  const orderItem = Array.isArray(assoc?.order_items) ? assoc.order_items[0] : assoc?.order_items;
  if (orderItem?.order_id) revalidatePath(`/pedidos/${orderItem.order_id}`);
}

/** Unidades de uma impressão ainda não alocadas a nenhum item de pedido. */
async function getAvailableQuantity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  printJobId: string,
): Promise<number> {
  const [jobRes, allocRes] = await Promise.all([
    supabase
      .from('print_jobs')
      .select('quantity_produced')
      .eq('id', printJobId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('order_item_print_jobs')
      .select('allocated_quantity')
      .eq('organization_id', orgId)
      .eq('print_job_id', printJobId),
  ]);
  const produced = Number(jobRes.data?.quantity_produced) || 0;
  const allocated = (allocRes.data ?? []).reduce((acc, a) => acc + (Number(a.allocated_quantity) || 0), 0);
  return Math.max(produced - allocated, 0);
}

async function recomputeOrderPaid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  orderId: string,
) {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status')
    .eq('order_id', orderId);
  const paid = (payments ?? [])
    .filter((p) => p.status === 'confirmed')
    .reduce((acc, p) => acc.add(p.amount ?? 0), Dec.ZERO);
  await supabase
    .from('orders')
    .update({ total_paid: paid.toNumber() })
    .eq('id', orderId)
    .eq('organization_id', orgId);
}
