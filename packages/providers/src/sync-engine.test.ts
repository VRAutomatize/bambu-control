import { describe, expect, it } from 'vitest';
import type { NormalizedPrintJob } from '@bambu/domain';
import { BambuMockProvider } from './bambu-mock.js';
import { runSync, type PrintJobStore, type UpsertOutcome } from './sync-engine.js';
import {
  ProviderError,
  type PrinterProvider,
  type SyncHistoryPage,
} from './types.js';

/** Store em memória que respeita a chave external_task_id (idempotente). */
class MemoryStore implements PrintJobStore {
  readonly byKey = new Map<string, NormalizedPrintJob>();
  async upsert(job: NormalizedPrintJob): Promise<UpsertOutcome> {
    const existed = this.byKey.has(job.externalTaskId);
    this.byKey.set(job.externalTaskId, job);
    return existed ? 'updated' : 'created';
  }
}

const noSleep = async () => {};

describe('runSync — paginação e persistência', () => {
  it('pagina todas as tarefas do mock e persiste sem duplicar', async () => {
    const provider = new BambuMockProvider({ pageSize: 3 });
    const store = new MemoryStore();
    const result = await runSync(provider, store, { sleep: noSleep });

    // fixtures: 11 tarefas; missingFieldsTask e outras têm ids únicos
    expect(result.status).toBe('success');
    expect(result.recordsCreated).toBe(store.byKey.size);
    expect(store.byKey.size).toBe(11);
    expect(result.pagesFetched).toBeGreaterThan(1);
  });

  it('é idempotente: segunda execução atualiza, não duplica', async () => {
    const provider = new BambuMockProvider({ pageSize: 5 });
    const store = new MemoryStore();
    await runSync(provider, store, { sleep: noSleep });
    const sizeAfterFirst = store.byKey.size;

    const second = await runSync(provider, store, { sleep: noSleep });
    expect(store.byKey.size).toBe(sizeAfterFirst); // nada duplicado
    expect(second.recordsCreated).toBe(0);
    expect(second.recordsUpdated).toBe(sizeAfterFirst);
  });

  it('deduplica ids repetidos dentro da mesma execução', async () => {
    const dup = { id: 'dup-1', status: 'success', startTime: 1, endTime: 2, weight: 1 };
    const provider = new BambuMockProvider({ rawTasks: [dup, dup, dup], pageSize: 1 });
    const store = new MemoryStore();
    const result = await runSync(provider, store, { sleep: noSleep });
    expect(store.byKey.size).toBe(1);
    expect(result.recordsReceived).toBe(3);
    expect(result.recordsCreated).toBe(1);
  });
});

describe('runSync — tratamento de erros', () => {
  function failingProvider(error: ProviderError, failTimes: number): PrinterProvider {
    let calls = 0;
    return {
      kind: 'bambu_cloud',
      async testConnection() {
        return { ok: true, status: 'connected' };
      },
      async listPrinters() {
        return [];
      },
      async fetchHistoryPage(): Promise<SyncHistoryPage> {
        calls++;
        if (calls <= failTimes) throw error;
        return { jobs: [], nextCursor: null };
      },
      async disconnect() {},
    };
  }

  it('faz retry com backoff em erro retornável (429) e recupera', async () => {
    const provider = failingProvider(new ProviderError('429', 'rate_limited', true), 2);
    const store = new MemoryStore();
    const result = await runSync(provider, store, { sleep: noSleep, maxRetries: 4 });
    expect(result.status).toBe('success');
  });

  it('NÃO faz retry em 401 e retorna erro imediatamente', async () => {
    const provider = failingProvider(new ProviderError('401', 'unauthorized', false), 10);
    const store = new MemoryStore();
    const result = await runSync(provider, store, { sleep: noSleep, maxRetries: 4 });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('unauthorized');
  });

  it('respeita o limite de páginas (maxPages)', async () => {
    // provedor que sempre retorna próxima página → loop infinito sem o guard
    const provider: PrinterProvider = {
      kind: 'bambu_cloud',
      async testConnection() {
        return { ok: true, status: 'connected' };
      },
      async listPrinters() {
        return [];
      },
      async fetchHistoryPage() {
        return { jobs: [], nextCursor: 'always' };
      },
      async disconnect() {},
    };
    const store = new MemoryStore();
    const result = await runSync(provider, store, { sleep: noSleep, maxPages: 3 });
    expect(result.pagesFetched).toBe(3);
  });
});
