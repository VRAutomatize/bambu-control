import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState, InlineAlert } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { Select } from '@/components/select';
import { IconAlertTriangle, IconPlug } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { connectBambu } from './actions';
import { SyncButton, DisconnectButton, VerifyCodeButton } from './sync-buttons';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Aguardando verificação',
  connected: 'Conectado',
  expired: 'Token expirado',
  error: 'Erro',
  disconnected: 'Desconectado',
};

const STATUS_STYLES: Record<string, string> = {
  pending_verification: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  connected: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
  expired: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  error: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  disconnected: 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400',
};

export default async function IntegracoesPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: connections } = await supabase
    .from('provider_connections')
    .select('id, provider, display_name, status, last_synced_at, last_error_message')
    .eq('organization_id', org.organizationId)
    .order('created_at', { ascending: false });

  const live = process.env.BAMBU_LIVE_ENABLED === 'true';

  return (
    <div>
      <PageHeader title="Integrações" subtitle="Conecte e sincronize suas impressoras" />

      <div className="mb-5">
        <InlineAlert tone="warning">
          Integração não oficial e independente. Bambu Control não é afiliado à Bambu Lab.
          {!live && ' Modo demo: a sincronização usa dados simulados (fixtures).'}
        </InlineAlert>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
        <div className="space-y-3">
          {!connections || connections.length === 0 ? (
            <EmptyState title="Nenhuma conexão" description="Conecte a Bambu Cloud ao lado." />
          ) : (
            connections.map((c) => (
              <Card key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400">
                      <IconPlug width={16} height={16} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
                        {c.display_name}
                      </h3>
                      <p className="text-[12px] text-neutral-400">{c.provider}</p>
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${STATUS_STYLES[c.status] ?? STATUS_STYLES.disconnected}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Última sincronização: {formatDateTime(c.last_synced_at, org.timezone)}
                </p>
                {c.last_error_message && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-red-600 dark:text-red-400">
                    <IconAlertTriangle width={13} height={13} />
                    {c.last_error_message}
                  </p>
                )}
                {c.status === 'pending_verification' && (
                  <div className="mt-4 space-y-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                    <div>
                      <p className="text-[12px] font-medium text-amber-900 dark:text-amber-100">
                        Verifique sua conexão
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-200">
                        Um código foi enviado por email. Digite-o abaixo para completar a autenticação.
                      </p>
                    </div>
                    <VerifyCodeButton connectionId={c.id} />
                  </div>
                )}
                {c.status !== 'disconnected' && c.status !== 'pending_verification' && (
                  <div className="mt-4 flex gap-2">
                    <SyncButton connectionId={c.id} />
                    <DisconnectButton connectionId={c.id} />
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          {!live && (
            <Card>
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-500/15">
                <p className="text-[11px] font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ Modo simulado
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-200">
                  Você está testando com dados simulados. Os dados reais não serão acessados.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">Conectar impressoras Bambu</h2>
            <div className="space-y-4">
              {live && (
                <div className="space-y-3 rounded-lg bg-brand-50 px-3 py-3 dark:bg-brand-500/10">
                  <p className="text-[12px] font-semibold text-brand-900 dark:text-brand-100">
                    Como conectar (3 passos)
                  </p>

                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-800 dark:bg-brand-500/30 dark:text-brand-200">
                        1
                      </span>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-brand-900 dark:text-brand-100">
                          Ter uma conta Bambu Lab
                        </p>
                        <p className="text-[10px] text-brand-700 dark:text-brand-200">
                          Visite{' '}
                          <a
                            href="https://www.bambulab.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline"
                          >
                            bambulab.com
                          </a>
                          {' '}para criar a sua.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-800 dark:bg-brand-500/30 dark:text-brand-200">
                        2
                      </span>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-brand-900 dark:text-brand-100">
                          Digitar suas credenciais
                        </p>
                        <p className="text-[10px] text-brand-700 dark:text-brand-200">
                          Use seu e-mail e senha. Nunca armazenamos a senha.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-800 dark:bg-brand-500/30 dark:text-brand-200">
                        3
                      </span>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-brand-900 dark:text-brand-100">
                          Verificar código por email
                        </p>
                        <p className="text-[10px] text-brand-700 dark:text-brand-200">
                          Um código será enviado para confirmar a conexão.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <AuthForm action={connectBambu} submitLabel={live ? 'Conectar' : 'Criar conexão demo'}>
                <input
                  name="displayName"
                  className="input"
                  placeholder="Nome da conexão"
                  defaultValue="Bambu Cloud"
                />
                {live && (
                  <>
                    <input name="account" className="input" placeholder="E-mail da conta Bambu" required />
                    <input name="password" type="password" className="input" placeholder="Senha" required />
                    <Select
                      name="region"
                      defaultValue="global"
                      options={[
                        { value: 'global', label: 'Conta global (bambulab.com)' },
                        { value: 'china', label: 'Conta China (bambulab.cn)' },
                      ]}
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      <strong>Segurança:</strong> A senha é descartada após autenticação. Guardamos somente o token
                      criptografado.
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      A Bambu Lab não tem API pública — esta conexão pode falhar ou parar de funcionar sem aviso.
                    </p>
                  </>
                )}
              </AuthForm>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
