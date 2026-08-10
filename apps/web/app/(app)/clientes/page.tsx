import Link from 'next/link';
import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { EditButton } from '@/components/edit-button';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { ToggleActiveButton } from '@/components/toggle-active-button';
import { createCustomer, updateCustomer, deleteCustomer, toggleCustomerActive } from './actions';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone, document, active')
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="table-head">
                    <tr>
                      <th className="table-cell-head">Nome</th>
                      <th className="table-cell-head">E-mail</th>
                      <th className="table-cell-head">Telefone/WhatsApp</th>
                      <th className="table-cell-head">Status</th>
                      <th className="table-cell-head" />
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="table-row">
                        <td
                          className={`table-cell font-medium ${c.active ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'}`}
                        >
                          <Link href={`/pedidos?customer=${c.id}`} className="hover:text-brand-600">
                            {c.name}
                          </Link>
                        </td>
                        <td className="table-cell text-neutral-500">{c.email ?? '—'}</td>
                        <td className="table-cell text-neutral-500">{c.phone ?? '—'}</td>
                        <td className="table-cell">
                          <span
                            className={`badge ${c.active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400' : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'}`}
                          >
                            {c.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center justify-end gap-3">
                            <EditButton title="Editar cliente" action={updateCustomer} iconOnly>
                              <input type="hidden" name="id" value={c.id} />
                              <input name="name" required defaultValue={c.name} className="input" placeholder="Nome" />
                              <input
                                name="email"
                                type="email"
                                defaultValue={c.email ?? ''}
                                className="input"
                                placeholder="E-mail (opcional)"
                              />
                              <input
                                name="phone"
                                defaultValue={c.phone ?? ''}
                                className="input"
                                placeholder="Telefone/WhatsApp"
                              />
                              <input
                                name="document"
                                defaultValue={c.document ?? ''}
                                className="input"
                                placeholder="CPF/CNPJ"
                              />
                            </EditButton>
                            <ToggleActiveButton action={toggleCustomerActive} id={c.id} active={c.active} />
                            <ConfirmActionButton action={deleteCustomer} id={c.id} icon={false} label="Excluir" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Novo cliente</h2>
          <AuthForm action={createCustomer} submitLabel="Cadastrar">
            <input name="name" required className="input" placeholder="Nome" />
            <input name="email" type="email" className="input" placeholder="E-mail (opcional)" />
            <input name="phone" className="input" placeholder="Telefone/WhatsApp" />
            <input name="document" className="input" placeholder="CPF/CNPJ" />
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}
