/**
 * Provedor `manual` — não faz chamadas externas. Existe para que o sistema
 * continue útil mesmo sem nenhuma integração. O histórico é criado/editado
 * pela interface e por importação CSV.
 */

import type {
  ConnectionTestResult,
  PrinterProvider,
  ProviderPrinter,
  SyncHistoryPage,
} from './types.js';

export class ManualProvider implements PrinterProvider {
  readonly kind = 'manual' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, status: 'connected', message: 'Provedor manual sempre disponível' };
  }

  async listPrinters(): Promise<ProviderPrinter[]> {
    return [];
  }

  async fetchHistoryPage(): Promise<SyncHistoryPage> {
    // Sem histórico remoto: nada a sincronizar.
    return { jobs: [], nextCursor: null };
  }

  async disconnect(): Promise<void> {
    // no-op
  }
}
