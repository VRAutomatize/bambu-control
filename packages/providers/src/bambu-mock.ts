/**
 * Provedor `bambu_mock` — simula a Bambu Cloud usando fixtures, com paginação.
 * Serve para desenvolvimento, demo e testes E2E sem depender da API real nem
 * de credenciais. Usa a MESMA normalização do adaptador real.
 */

import { allTasks, normalizeBambuTask, type NormalizedPrintJob } from '@bambu/domain';
import type {
  ConnectionTestResult,
  PrinterProvider,
  ProviderPrinter,
  SyncHistoryInput,
  SyncHistoryPage,
} from './types.js';

export interface BambuMockOptions {
  /** Tarefas brutas a paginar. Padrão: fixtures do domínio. */
  rawTasks?: unknown[];
  /** Tamanho de página. */
  pageSize?: number;
  /** Simula exigência de verificação por código na conexão. */
  requiresVerification?: boolean;
  printers?: ProviderPrinter[];
}

export class BambuMockProvider implements PrinterProvider {
  readonly kind = 'bambu_cloud' as const;
  private readonly rawTasks: unknown[];
  private readonly pageSize: number;
  private readonly requiresVerification: boolean;
  private readonly printers: ProviderPrinter[];

  constructor(options: BambuMockOptions = {}) {
    this.rawTasks = options.rawTasks ?? allTasks;
    this.pageSize = options.pageSize ?? 5;
    this.requiresVerification = options.requiresVerification ?? false;
    this.printers =
      options.printers ??
      [
        {
          externalDeviceId: 'DEV-AABBCC',
          name: 'X1C-Oficina',
          model: 'X1 Carbon',
          serialNumber: '00M09A1234567',
          online: true,
        },
      ];
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (this.requiresVerification) {
      return {
        ok: false,
        status: 'pending_verification',
        requiresVerification: true,
        message: 'Enviamos um código de verificação para o e-mail da conta.',
      };
    }
    return { ok: true, status: 'connected' };
  }

  async listPrinters(): Promise<ProviderPrinter[]> {
    return this.printers;
  }

  async fetchHistoryPage(input: SyncHistoryInput): Promise<SyncHistoryPage> {
    const offset = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
    const slice = this.rawTasks.slice(offset, offset + this.pageSize);
    const jobs: NormalizedPrintJob[] = slice.map((t) => normalizeBambuTask(t));
    const nextOffset = offset + this.pageSize;
    const nextCursor = nextOffset < this.rawTasks.length ? String(nextOffset) : null;
    return { jobs, nextCursor };
  }

  async disconnect(): Promise<void> {
    // no-op
  }
}
