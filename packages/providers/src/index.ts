export * from './types.js';
export * from './crypto.js';
export * from './sync-engine.js';
export * from './manual.js';
export * from './bambu-mock.js';
export * from './bambu-cloud.js';

import { BambuMockProvider } from './bambu-mock.js';
import { ManualProvider } from './manual.js';
import type { PrinterProvider, ProviderKind } from './types.js';

/**
 * Fábrica de provedores. No MVP resolve `manual` e `bambu_cloud`. Quando
 * BAMBU_LIVE_ENABLED != 'true', `bambu_cloud` cai para o mock (dev/demo).
 */
export interface ProviderFactoryInput {
  kind: ProviderKind;
  accessToken?: string;
  region?: 'global' | 'china';
}

export async function createProvider(input: ProviderFactoryInput): Promise<PrinterProvider> {
  switch (input.kind) {
    case 'manual':
      return new ManualProvider();
    case 'bambu_cloud': {
      if (process.env.BAMBU_LIVE_ENABLED === 'true' && input.accessToken) {
        const { BambuCloudProvider } = await import('./bambu-cloud.js');
        return new BambuCloudProvider({
          accessToken: input.accessToken,
          region: input.region ?? 'global',
        });
      }
      return new BambuMockProvider();
    }
    default:
      throw new Error(`Provedor não implementado no MVP: ${input.kind}`);
  }
}
