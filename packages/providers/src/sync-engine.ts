/**
 * Motor de sincronização — orquestração PURA e idempotente, sem acoplar a um
 * provedor ou banco específico. Recebe um provedor (fonte paginada) e um store
 * (upsert). Garante:
 *   - paginação completa por cursor;
 *   - deduplicação por external_task_id dentro da execução;
 *   - retry com backoff exponencial em erros retornáveis;
 *   - timeout por página;
 *   - NUNCA apaga impressão que sumiu de uma página;
 *   - contagem para sync_runs.
 *
 * A idempotência entre execuções é reforçada pelo unique
 * (provider_connection_id, external_task_id) no banco + upsert do store.
 */

import type { NormalizedPrintJob } from '@bambu/domain';
import { ProviderError, type PrinterProvider, type SyncHistoryInput } from './types.js';

export type UpsertOutcome = 'created' | 'updated';

export interface PrintJobStore {
  /** Insere ou atualiza uma impressão pela chave externa. Retorna o resultado. */
  upsert(job: NormalizedPrintJob): Promise<UpsertOutcome>;
}

export interface RunSyncOptions {
  cursor?: string | null;
  since?: string | null;
  maxPages?: number;
  /** Tentativas por página (inclui a primeira). */
  maxRetries?: number;
  /** Base do backoff em ms (multiplicada exponencialmente). */
  backoffBaseMs?: number;
  /** Timeout por página em ms. */
  pageTimeoutMs?: number;
  /** Injetável para testes (evita esperas reais). */
  sleep?: (ms: number) => Promise<void>;
  /** Logger estruturado e sanitizado. */
  onLog?: (event: SyncLogEvent) => void;
}

export interface SyncLogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  page?: number;
  attempt?: number;
  errorCode?: string;
}

export interface RunSyncResult {
  status: 'success' | 'partial' | 'error';
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  pagesFetched: number;
  cursorAfter: string | null;
  errorCode?: string;
  errorMessage?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new ProviderError('timeout de página', 'timeout', true)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Executa a sincronização completa de um provedor. */
export async function runSync(
  provider: PrinterProvider,
  store: PrintJobStore,
  options: RunSyncOptions = {},
): Promise<RunSyncResult> {
  const {
    since = null,
    maxPages = 50,
    maxRetries = 4,
    backoffBaseMs = 200,
    pageTimeoutMs = 15_000,
    sleep = defaultSleep,
    onLog,
  } = options;

  const log = (e: SyncLogEvent) => onLog?.(e);
  const seen = new Set<string>();

  let cursor: string | null = options.cursor ?? null;
  let pagesFetched = 0;
  let received = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let page = 0; page < maxPages; page++) {
    const input: SyncHistoryInput = { cursor, since };

    let pageResult;
    try {
      pageResult = await fetchPageWithRetry(provider, input, {
        maxRetries,
        backoffBaseMs,
        pageTimeoutMs,
        sleep,
        page,
        log,
      });
    } catch (err) {
      const pe = err instanceof ProviderError ? err : new ProviderError(String(err), 'unknown', false);
      log({ level: 'error', message: 'falha ao buscar página', page, errorCode: pe.code });
      return {
        // Falha após já ter processado algo = parcial; senão erro.
        status: received > 0 ? 'partial' : 'error',
        recordsReceived: received,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsFailed: failed,
        pagesFetched,
        cursorAfter: cursor,
        errorCode: pe.code,
        errorMessage: pe.message,
      };
    }

    pagesFetched++;

    for (const job of pageResult.jobs) {
      received++;
      // Dedup dentro da execução (paginação sobreposta / repetição).
      if (job.externalTaskId === '' || seen.has(job.externalTaskId)) {
        continue;
      }
      seen.add(job.externalTaskId);
      try {
        const outcome = await store.upsert(job);
        if (outcome === 'created') created++;
        else updated++;
      } catch (err) {
        failed++;
        log({
          level: 'warn',
          message: `falha ao gravar tarefa ${job.externalTaskId}`,
          page,
          errorCode: err instanceof ProviderError ? err.code : 'store_error',
        });
      }
    }

    cursor = pageResult.nextCursor;
    if (cursor === null) break; // fim da paginação
  }

  log({ level: 'info', message: 'sincronização concluída', page: pagesFetched });
  return {
    status: failed > 0 ? 'partial' : 'success',
    recordsReceived: received,
    recordsCreated: created,
    recordsUpdated: updated,
    recordsFailed: failed,
    pagesFetched,
    cursorAfter: cursor,
  };
}

async function fetchPageWithRetry(
  provider: PrinterProvider,
  input: SyncHistoryInput,
  ctx: {
    maxRetries: number;
    backoffBaseMs: number;
    pageTimeoutMs: number;
    sleep: (ms: number) => Promise<void>;
    page: number;
    log: (e: SyncLogEvent) => void;
  },
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ctx.maxRetries; attempt++) {
    try {
      return await withTimeout(provider.fetchHistoryPage(input), ctx.pageTimeoutMs);
    } catch (err) {
      lastError = err;
      const pe =
        err instanceof ProviderError ? err : new ProviderError(String(err), 'unknown', false);
      // 401/403 não são retornáveis: propagam para marcar a conexão.
      if (!pe.retryable || attempt === ctx.maxRetries) {
        throw pe;
      }
      const delay = ctx.backoffBaseMs * 2 ** (attempt - 1);
      ctx.log({
        level: 'warn',
        message: 'retry de página',
        page: ctx.page,
        attempt,
        errorCode: pe.code,
      });
      await ctx.sleep(delay);
    }
  }
  throw lastError;
}
