'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentSchema } from '@bambu/contracts';
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

  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const discount = Number(formData.get('discount')) || 0;
  const shipping = Number(formData.get('shippingAmount')) || 0;
  const total = Math.max(subtotal - discount + shipping, 0);

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      organization_id: org.organizationId,
      customer_id: customerId,
      order_number: orderNumber,
      status: 'approved',
      ordered_at: new Date().toISOString(),
      subtotal: round(subtotal),
      discount: round(discount),
      shipping_amount: round(shipping),
      total_charged: round(total),
    })
    .select('id')
    .single();
  if (error || !order) return { error: `Falha: ${error?.message}` };

  for (const it of items) {
    await supabase.from('order_items').insert({
      organization_id: org.organizationId,
      order_id: order.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: round(it.unitPrice),
      total_price: round(it.quantity * it.unitPrice),
    });
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
  const { error } = await supabase.from('payments').insert({
    organization_id: org.organizationId,
    order_id: orderId,
    amount: round(parsed.data.amount),
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
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  await supabase.from('orders').update({ total_paid: round(paid) }).eq('id', orderId).eq('organization_id', orgId);
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
