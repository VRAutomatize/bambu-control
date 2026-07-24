import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { customerSchema } from '@bambu/contracts';
import { requireCurrentOrg, canWrite } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';

export const dynamic = 'force-dynamic';

async function createCustomer(_prev: unknown, formData: FormData) {
  'use server';
  const { org } = await requireCurrentOrg();
  if (!canWrite(org.role)) return { error: 'Sem permissão.' };
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    whatsapp: formData.get('whatsapp') || null,
    document: formData.get('document') || null,
  });
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

export default async function ClientesPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, whatsapp, active')
    .eq('organization_id', org.organizationId)
    .order('name');

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Cadastro e histórico de clientes" />
      <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
        <div>
          {!customers || customers.length === 0 ? (
            <EmptyState title="Nenhum cliente" description="Cadastre seu primeiro cliente ao lado." />
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th className="table-cell-head">Nome</th>
                    <th className="table-cell-head">E-mail</th>
                    <th className="table-cell-head">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="table-cell font-medium text-neutral-900 dark:text-neutral-100">
                        <Link href={`/pedidos?customer=${c.id}`} className="hover:text-brand-600">
                          {c.name}
                        </Link>
                      </td>
                      <td className="table-cell text-neutral-500">{c.email ?? '—'}</td>
                      <td className="table-cell text-neutral-500">{c.whatsapp ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Novo cliente</h2>
          <AuthForm action={createCustomer} submitLabel="Cadastrar">
            <input name="name" required className="input" placeholder="Nome" />
            <input name="email" type="email" className="input" placeholder="E-mail" />
            <input name="phone" className="input" placeholder="Telefone" />
            <input name="whatsapp" className="input" placeholder="WhatsApp" />
            <input name="document" className="input" placeholder="CPF/CNPJ" />
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}
