/**
 * Adaptador REAL da Bambu Cloud — SOMENTE LEITURA, atrás da flag
 * BAMBU_LIVE_ENABLED. A API é fruto de engenharia reversa e INSTÁVEL; os
 * endpoints, hosts regionais e formatos abaixo são HIPÓTESES baseadas em
 * documentação comunitária e DEVEM ser validados com credenciais reais antes
 * de habilitar em produção. Ver docs/architecture/provider-integration.md.
 *
 * Nenhum comando de controle da impressora é implementado (sem start/pause/
 * cancel/move/temperatura/G-code).
 */

import { normalizeBambuTask, type NormalizedPrintJob } from '@bambu/domain';
import {
  ProviderError,
  type ConnectionTestResult,
  type PrinterProvider,
  type ProviderPrinter,
  type SyncHistoryInput,
  type SyncHistoryPage,
} from './types.js';

export type BambuRegion = 'global' | 'china';

// HIPÓTESE (validar): hosts regionais.
const REGION_HOSTS: Record<BambuRegion, string> = {
  global: 'https://api.bambulab.com',
  china: 'https://api.bambulab.cn',
};

export interface BambuCloudConfig {
  accessToken: string;
  region: BambuRegion;
  pageSize?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function mapHttpError(status: number, body: string): ProviderError {
  if (status === 401) return new ProviderError('token inválido/expirado', 'unauthorized', false);
  if (status === 403) return new ProviderError('acesso negado', 'forbidden', false);
  if (status === 429) return new ProviderError('rate limited', 'rate_limited', true);
  if (status >= 500) return new ProviderError(`erro do servidor ${status}`, 'server_error', true);
  return new ProviderError(`http ${status}: ${body.slice(0, 120)}`, 'unknown', false);
}

export class BambuCloudProvider implements PrinterProvider {
  readonly kind = 'bambu_cloud' as const;
  private readonly host: string;
  private readonly cfg: Required<Omit<BambuCloudConfig, 'accessToken' | 'region'>> &
    Pick<BambuCloudConfig, 'accessToken' | 'region'>;

  constructor(config: BambuCloudConfig) {
    if (process.env.BAMBU_LIVE_ENABLED !== 'true') {
      throw new ProviderError(
        'BAMBU_LIVE_ENABLED != true — adaptador Bambu Cloud real está desabilitado. ' +
          'Use BambuMockProvider em desenvolvimento.',
        'forbidden',
        false,
      );
    }
    this.host = REGION_HOSTS[config.region];
    this.cfg = {
      accessToken: config.accessToken,
      region: config.region,
      pageSize: config.pageSize ?? 20,
      fetchImpl: config.fetchImpl ?? fetch,
      timeoutMs: config.timeoutMs ?? 15_000,
    };
  }

  private async request(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.host);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await this.cfg.fetchImpl(url.toString(), {
        method: 'GET', // SOMENTE LEITURA
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw mapHttpError(res.status, await res.text().catch(() => ''));
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if ((err as { name?: string }).name === 'AbortError') {
        throw new ProviderError('timeout', 'timeout', true);
      }
      throw new ProviderError(String(err), 'network', true);
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // HIPÓTESE (validar): endpoint de bind lista dispositivos do usuário.
      await this.request('/v1/iot-service/api/user/bind');
      return { ok: true, status: 'connected' };
    } catch (err) {
      const pe = err instanceof ProviderError ? err : new ProviderError(String(err), 'unknown', false);
      if (pe.code === 'unauthorized') return { ok: false, status: 'expired', message: 'Token expirado' };
      return { ok: false, status: 'error', message: pe.message };
    }
  }

  async listPrinters(): Promise<ProviderPrinter[]> {
    const data = (await this.request('/v1/iot-service/api/user/bind')) as {
      devices?: Array<Record<string, unknown>>;
    };
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    return devices.map((d) => ({
      externalDeviceId: String(d.dev_id ?? d.deviceId ?? ''),
      name: String(d.name ?? d.dev_name ?? 'Impressora'),
      model: (d.dev_product_name as string) ?? (d.model as string) ?? null,
      serialNumber: (d.dev_id as string) ?? null,
      online: Boolean(d.online ?? d.dev_online ?? false),
    }));
  }

  async fetchHistoryPage(input: SyncHistoryInput): Promise<SyncHistoryPage> {
    // HIPÓTESE (validar): /v1/user-service/my/tasks com paginação por `after`.
    const query: Record<string, string> = { limit: String(this.cfg.pageSize) };
    if (input.cursor) query.after = input.cursor;

    const data = (await this.request('/v1/user-service/my/tasks', query)) as {
      hits?: unknown[];
      total?: number;
    };
    const hits = Array.isArray(data?.hits) ? data.hits : [];
    const jobs: NormalizedPrintJob[] = hits.map((h) => normalizeBambuTask(h));

    // Cursor: último id da página, se ainda houver itens. NUNCA some com dados
    // ausentes — apenas para de paginar quando a página vem vazia.
    const last = jobs[jobs.length - 1];
    const nextCursor = hits.length >= this.cfg.pageSize && last ? last.externalTaskId : null;
    return { jobs, nextCursor };
  }

  async disconnect(): Promise<void> {
    // Descarte do token é responsabilidade do chamador (apaga encrypted_credentials).
  }
}
