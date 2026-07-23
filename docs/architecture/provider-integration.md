# ADR 001 — Integração por provedores (PrinterProvider)

- **Status**: Aceito
- **Contexto**: O produto precisa importar histórico de impressão de fontes
  diversas (Bambu Cloud, LAN, SimplyPrint, importação manual). A API da Bambu
  Cloud é fruto de engenharia reversa e **instável**. Não podemos acoplar o
  domínio (custos, pedidos, lucro) a um provedor específico.

## Decisão

Introduzir uma abstração `PrinterProvider` (`packages/providers/src/types.ts`):

```ts
interface PrinterProvider {
  readonly kind: ProviderKind;
  testConnection(): Promise<ConnectionTestResult>;
  listPrinters(): Promise<ProviderPrinter[]>;
  fetchHistoryPage(input: SyncHistoryInput): Promise<SyncHistoryPage>;
  getPrinterStatus?(printerId: string): Promise<PrinterStatus>;
  disconnect(): Promise<void>;
}
```

Provedores previstos: `bambu_cloud | bambu_lan | manual | simplyprint | generic`.

**No MVP** implementamos:
- `manual` — sem chamadas externas; histórico criado pela UI/CSV.
- `bambu_mock` — simula a Bambu Cloud com fixtures e paginação (dev/demo/E2E).
- `bambu_cloud` — adaptador HTTP **real, somente leitura**, atrás da flag
  `BAMBU_LIVE_ENABLED`. Usa a MESMA normalização do mock.

Os demais provedores têm contrato e enum reservados no banco, sem implementação
especulativa.

## Sincronização

A orquestração vive em `sync-engine.ts` (PURA, testável), separada do provedor
e do banco:
- paginação completa por cursor;
- deduplicação por `external_task_id` na execução;
- retry com backoff exponencial em erros retornáveis (429/5xx/timeout/rede);
- 401/403 **não** são retornáveis → conexão marcada `expired`/`error`;
- limite de páginas (`maxPages`) contra loops;
- **nunca** apaga impressão ausente de uma página;
- idempotência entre execuções via `unique(provider_connection_id, external_task_id)` + upsert.

## Semântica incerta (tratada como desconhecida)

- `costTime` **não** é assumido como tempo real. Para concluídos com datas
  válidas usamos `endTime - startTime`; caso contrário, `costTime`. A fonte é
  registrada em `duration_source`.
- `weight` é tratado como informado/estimado pelo provedor, corrigível
  manualmente (`manual_weight_g`).
- Endpoints/host regional são hipóteses documentadas no código
  (`bambu-cloud.ts`) e devem ser validados com credenciais reais.

## Consequências

- Trocar de provedor não afeta o domínio.
- A integração real pode ser desligada por flag sem tocar em código de negócio.
- Payload bruto é sempre preservado (`raw_payload_json`) para diagnóstico.

## Não-objetivos (fora do MVP)

- Comandos de controle (start/pause/cancel/mover/temperatura/G-code).
- Microserviço Python dedicado (só se comprovadamente necessário, via nova ADR).
- Regras de custo/domínio no n8n (n8n é integração opcional, não fonte da verdade).
