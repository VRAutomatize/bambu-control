/**
 * Worker de sincronização do Bambu Control.
 *
 * A cada intervalo (SYNC_INTERVAL_MINUTES, padrão 10), varre as conexões
 * `connected` e sincroniza o histórico de cada uma, com lock por conexão em
 * memória para evitar execuções sobrepostas.
 *
 * Somente leitura. Não envia comandos às impressoras.
 */

import { createAdminClient } from '@bambu/db';
import { syncConnection } from './sync.js';

const INTERVAL_MS =
  Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES) || 10) * 60_000;

const inFlight = new Set<string>();

async function tick(): Promise<void> {
  const supabase = createAdminClient();
  const { data: connections, error } = await supabase
    .from('provider_connections')
    .select('id, organization_id, provider, status')
    .in('status', ['connected'])
    .neq('provider', 'manual');

  if (error) {
    console.error('[worker] falha ao listar conexões:', error.message);
    return;
  }
  if (!connections || connections.length === 0) {
    console.info('[worker] nenhuma conexão para sincronizar');
    return;
  }

  for (const conn of connections) {
    if (inFlight.has(conn.id)) {
      console.info(`[worker] pulando ${conn.id} (já em execução)`);
      continue;
    }
    inFlight.add(conn.id);
    try {
      const r = await syncConnection(supabase, conn.organization_id, conn.id);
      console.info(
        `[worker] sync ${conn.id}: ok=${r.ok} created=${r.created} updated=${r.updated}`,
      );
    } catch (err) {
      console.error(`[worker] erro ao sincronizar ${conn.id}:`, (err as Error).message);
    } finally {
      inFlight.delete(conn.id);
    }
  }
}

async function main(): Promise<void> {
  console.info(`[worker] iniciando. Intervalo: ${INTERVAL_MS / 60000} min`);
  await tick().catch((e) => console.error('[worker] tick inicial falhou:', e));
  setInterval(() => {
    tick().catch((e) => console.error('[worker] tick falhou:', e));
  }, INTERVAL_MS);
}

// Encerramento gracioso.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.info(`[worker] recebido ${sig}, encerrando.`);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error('[worker] falha fatal:', e);
  process.exit(1);
});
