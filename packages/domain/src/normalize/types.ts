/**
 * Tipos da normalização de tarefas do provedor (Bambu Cloud e outros).
 *
 * IMPORTANTE: a estrutura real do payload da Bambu é fruto de engenharia reversa
 * e INSTÁVEL. Tratamos tudo como desconhecido, preservamos o payload bruto e
 * registramos avisos (`warnings`) em vez de assumir. Ver docs/architecture.
 */

/** Status normalizado, independente do provedor. */
export type NormalizedStatus =
  | 'pending'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown';

/** Fonte usada para a duração efetiva. */
export type DurationSource = 'end_minus_start' | 'cost_time' | 'none';

/** Material inferido do mapeamento de AMS (best-effort). */
export interface NormalizedMaterial {
  amsUnit: number | null;
  slotNumber: number | null;
  colorHex: string | null;
  materialType: string | null;
  weightG: number | null;
}

/** Tarefa de impressão normalizada, pronta para upsert em print_jobs. */
export interface NormalizedPrintJob {
  /** Identificador estável da tarefa no provedor (chave de deduplicação). */
  externalTaskId: string;
  externalModelId: string | null;
  title: string | null;
  coverUrl: string | null;

  /** Status bruto do provedor (preservado). */
  providerStatus: string | null;
  normalizedStatus: NormalizedStatus;

  /** Datas em ISO 8601 UTC, ou null se ausentes/inválidas. */
  providerStartAt: string | null;
  providerEndAt: string | null;

  /** Duração efetiva escolhida (segundos) e sua origem. */
  providerDurationS: number | null;
  durationSource: DurationSource;

  /** Peso informado pelo provedor (gramas). Pode ser estimado ou 0. */
  providerWeightG: number | null;

  externalDeviceId: string | null;
  deviceName: string | null;
  deviceModel: string | null;
  printMode: string | null;

  materials: NormalizedMaterial[];

  /** Payload bruto original, preservado para diagnóstico. */
  rawPayload: unknown;

  /** Avisos de normalização (campos ausentes, datas inválidas, etc.). */
  warnings: string[];
}
