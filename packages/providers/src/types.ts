/**
 * Contrato de provedor de coleta de dados de impressora. O domínio NÃO é
 * acoplado à API Bambu — qualquer provedor (Bambu Cloud, LAN, SimplyPrint,
 * manual, genérico) implementa esta interface.
 *
 * MVP implementa: `manual` e `bambu_mock` (testável); `bambu_cloud` (HTTP real)
 * fica atrás da flag BAMBU_LIVE_ENABLED. Somente leitura — nenhum comando de
 * controle da impressora.
 */

import type { NormalizedPrintJob } from '@bambu/domain';

export type ProviderKind =
  | 'bambu_cloud'
  | 'bambu_lan'
  | 'manual'
  | 'simplyprint'
  | 'generic';

export interface ConnectionTestResult {
  ok: boolean;
  /** Status sanitizado para o front-end (sem segredos). */
  status: 'connected' | 'pending_verification' | 'expired' | 'error';
  message?: string;
  /** True quando o provedor exige um código de verificação para concluir. */
  requiresVerification?: boolean;
}

export interface ProviderPrinter {
  externalDeviceId: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  online: boolean;
}

export interface SyncHistoryInput {
  /** Cursor da última sincronização (null = do início). */
  cursor: string | null;
  /** Não buscar tarefas anteriores a esta data, quando suportado. */
  since?: string | null;
  /** Limite defensivo de páginas por execução. */
  maxPages?: number;
}

export interface SyncHistoryPage {
  jobs: NormalizedPrintJob[];
  nextCursor: string | null;
}

export interface SyncHistoryResult {
  jobs: NormalizedPrintJob[];
  cursorAfter: string | null;
  pagesFetched: number;
}

export interface PrinterStatus {
  externalDeviceId: string;
  online: boolean;
  state: string | null;
}

export interface PrinterProvider {
  readonly kind: ProviderKind;
  testConnection(): Promise<ConnectionTestResult>;
  listPrinters(): Promise<ProviderPrinter[]>;
  /** Busca uma única página do histórico (a orquestração fica no sync-engine). */
  fetchHistoryPage(input: SyncHistoryInput): Promise<SyncHistoryPage>;
  getPrinterStatus?(printerId: string): Promise<PrinterStatus>;
  disconnect(): Promise<void>;
}

/** Erro tipado da camada de provedor, mapeando status HTTP relevantes. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unauthorized' // 401
      | 'forbidden' // 403
      | 'rate_limited' // 429
      | 'server_error' // 5xx
      | 'network'
      | 'timeout'
      | 'unknown',
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
