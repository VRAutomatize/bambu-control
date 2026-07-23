import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { formatDateTime } from '@/lib/format';
import { connectBambu } from './actions';
import { SyncButton, DisconnectButton } from './sync-buttons';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Aguardando verificação',
  connected: 'Conectado',
  expired: 'Token expirado',
  error: 'Erro',
  disconnected: 'Desconectado',
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

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Integração não oficial e independente. Bambu Control não é afiliado à Bambu Lab.
        {!live && ' Modo demo: a sincronização usa dados simulados (fixtures).'}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="space-y-3">
          {!connections || connections.length === 0 ? (
            <EmptyState title="Nenhuma conexão" description="Conecte a Bambu Cloud ao lado." />
          ) : (
            connections.map((c) => (
              <Card key={c.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{c.display_name}</h3>
                    <p className="text-xs text-neutral-500">{c.provider}</p>
                  </div>
                  <span className="badge bg-neutral-100 text-neutral-700">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Última sincronização: {formatDateTime(c.last_synced_at, org.timezone)}
                </p>
                {c.last_error_message && (
                  <p className="mt-1 text-xs text-red-600">Erro: {c.last_error_message}</p>
                )}
                {c.status !== 'disconnected' && (
                  <div className="mt-3 flex gap-2">
                    <SyncButton connectionId={c.id} />
                    <DisconnectButton connectionId={c.id} />
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">Conectar Bambu Cloud</h2>
          <AuthForm action={connectBambu} submitLabel={live ? 'Conectar' : 'Criar conexão demo'}>
            <input name="displayName" className="input" placeholder="Nome da conexão" defaultValue="Bambu Cloud" />
            {live && (
              <>
                <input name="account" className="input" placeholder="E-mail da conta Bambu" />
                <input name="password" type="password" className="input" placeholder="Senha" />
                <p className="text-xs text-neutral-400">
                  A senha é usada apenas para autenticar e é descartada; guardamos somente o token
                  criptografado.
                </p>
              </>
            )}
          </AuthForm>
        </Card>
      </div>
    </div>
  );
}
