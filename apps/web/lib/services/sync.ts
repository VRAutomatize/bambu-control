import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bambu/db';
import type { NormalizedPrintJob } from '@bambu/domain';
import {
  createProvider,
  openToken,
  runSync,
  type PrintJobStore,
  type ProviderKind,
  type UpsertOutcome,
} from '@bambu/providers';

type Client = SupabaseClient<Database>;

/**
 * Sincroniza uma conexão de provedor: cria um sync_run, executa o motor de
 * sincronização idempotente e persiste os print_jobs. Sanitiza logs (sem
 * tokens). Marca a conexão como `expired` em 401.
 */
export async function syncConnection(
  supabase: Client,
  organizationId: string,
  connectionId: string,
): Promise<{ ok: boolean; created: number; updated: number; error?: string }> {
  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('id, provider, status, encrypted_credentials, last_sync_cursor')
    .eq('id', connectionId)
    .eq('organization_id', organizationId)
    .single();
  if (connErr || !conn) return { ok: false, created: 0, updated: 0, error: 'Conexão não encontrada' };

  // Resolve token (se live) — nunca logar.
  let accessToken: string | undefined;
  if (process.env.BAMBU_LIVE_ENABLED === 'true' && conn.encrypted_credentials) {
    try {
      const token = openToken<{ accessToken?: string }>(
        conn.encrypted_credentials,
        process.env.CREDENTIALS_ENCRYPTION_KEY ?? '',
      );
      accessToken = token.accessToken;
    } catch {
      // token corrompido/chave errada — segue como mock/erro controlado
    }
  }

  const provider = await createProvider({
    kind: conn.provider as ProviderKind,
    accessToken,
    region: (process.env.BAMBU_REGION as 'global' | 'china') ?? 'global',
  });

  // sync_run: running
  const { data: run } = await supabase
    .from('sync_runs')
    .insert({
      organization_id: organizationId,
      provider_connection_id: connectionId,
      status: 'running',
      cursor_before: conn.last_sync_cursor,
    })
    .select('id')
    .single();

  // Pré-carrega chaves existentes para contar created vs updated.
  const { data: existing } = await supabase
    .from('print_jobs')
    .select('external_task_id')
    .eq('provider_connection_id', connectionId);
  const existingKeys = new Set((existing ?? []).map((e) => e.external_task_id ?? ''));

  const store: PrintJobStore = {
    async upsert(job: NormalizedPrintJob): Promise<UpsertOutcome> {
      const isUpdate = existingKeys.has(job.externalTaskId);
      const row = {
        organization_id: organizationId,
        provider_connection_id: connectionId,
        external_task_id: job.externalTaskId,
        external_model_id: job.externalModelId,
        title: job.title,
        cover_url: job.coverUrl,
        provider_status: job.providerStatus,
        normalized_status: job.normalizedStatus,
        provider_start_at: job.providerStartAt,
        provider_end_at: job.providerEndAt,
        provider_duration_s: job.providerDurationS,
        provider_weight_g: job.providerWeightG,
        duration_source: job.durationSource,
        source: 'bambu_cloud',
        raw_payload_json: job.rawPayload as Record<string, unknown>,
        last_synced_at: new Date().toISOString(),
        imported_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('print_jobs')
        .upsert(row, { onConflict: 'provider_connection_id,external_task_id' });
      if (error) throw new Error(error.message);
      existingKeys.add(job.externalTaskId);
      return isUpdate ? 'updated' : 'created';
    },
  };

  const result = await runSync(provider, store, {
    cursor: conn.last_sync_cursor,
    // Logs estruturados sem dados sensíveis.
    onLog: (e) => console.info('[sync]', JSON.stringify({ ...e, connectionId })),
  });

  // Atualiza a conexão conforme o resultado.
  const connectionStatus =
    result.errorCode === 'unauthorized' ? 'expired' : result.status === 'error' ? 'error' : 'connected';
  await supabase
    .from('provider_connections')
    .update({
      status: connectionStatus,
      last_sync_cursor: result.cursorAfter,
      last_synced_at: new Date().toISOString(),
      last_error_code: result.errorCode ?? null,
      last_error_message: result.errorMessage ?? null,
    })
    .eq('id', connectionId)
    .eq('organization_id', organizationId);

  // Finaliza o sync_run.
  if (run) {
    await supabase
      .from('sync_runs')
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        cursor_after: result.cursorAfter,
        records_received: result.recordsReceived,
        records_created: result.recordsCreated,
        records_updated: result.recordsUpdated,
        records_failed: result.recordsFailed,
        error_code: result.errorCode ?? null,
        error_message: result.errorMessage ?? null,
      })
      .eq('id', run.id);
  }

  return {
    ok: result.status !== 'error',
    created: result.recordsCreated,
    updated: result.recordsUpdated,
    error: result.errorMessage,
  };
}
