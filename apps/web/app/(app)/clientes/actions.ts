'use server';
import { revalidatePath } from 'next/cache';
import { customerSchema } from '@bambu/contracts';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Telefone e WhatsApp são o mesmo campo na UI — um único número de
 * contato é gravado nas duas colunas (mantém compatibilidade com
 * qualquer integração futura que leia especificamente `whatsapp`). */
function parseCustomerForm(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    whatsapp: formData.get('phone') || null,
    document: formData.get('document') || null,
  });
}

export async function createCustomer(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const parsed = parseCustomerForm(formData);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('customers').insert({
    organization_id: org.organizationId,
    name: c.name,
    email: c.email || null,
    phone: c.phone,
    whatsapp: c.whatsapp,
    document: c.document,
  });
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  return { ok: 'Cliente cadastrado.' };
}

export async function updateCustomer(_prev: unknown, formData: FormData) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Cliente inválido.' };
  const parsed = parseCustomerForm(formData);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({
      name: c.name,
      email: c.email || null,
      phone: c.phone,
      whatsapp: c.whatsapp,
      document: c.document,
    })
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  return { ok: 'Cliente atualizado.' };
}

/** Ativa/desativa: cliente inativo some das listas de seleção de novos
 * pedidos, mas o histórico de pedidos/pagamentos dele fica intacto. */
export async function toggleCustomerActive(id: string, active: boolean) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ active })
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
}

/** Exclusão definitiva. Segura mesmo com pedidos existentes: a FK
 * orders.customer_id é ON DELETE SET NULL — o histórico de pedidos fica,
 * só perde o vínculo com o cadastro do cliente. */
export async function deleteCustomer(id: string) {
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.organizationId);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
}
