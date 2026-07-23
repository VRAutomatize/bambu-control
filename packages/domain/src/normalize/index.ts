/**
 * Normalização de tarefas do provedor Bambu → NormalizedPrintJob.
 *
 * Função PURA e defensiva: nunca lança por payload malformado; acumula avisos.
 * Preserva o payload bruto. Não presume semântica de `weight` nem de `costTime`.
 */

import type {
  DurationSource,
  NormalizedMaterial,
  NormalizedPrintJob,
  NormalizedStatus,
} from './types.js';

export * from './types.js';

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return value && typeof value === 'object' ? (value as Json) : {};
}

/** Lê a primeira chave presente dentre `keys`. */
function pick(obj: Json, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function toStringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse defensivo de data → ISO UTC. Aceita epoch (s ou ms) e strings de data.
 * Retorna null para valores ausentes/inválidos.
 */
function parseTimestamp(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heurística: valores < 1e12 são segundos, caso contrário milissegundos.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) {
      return parseTimestamp(numeric);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

/**
 * Mapeia o status bruto do provedor para o status normalizado.
 * Os valores exatos da Bambu são DESCONHECIDOS — cobrimos rótulos comuns e
 * caímos para 'unknown' com aviso.
 */
export function normalizeStatus(raw: unknown): { status: NormalizedStatus; matched: boolean } {
  const s = toStringOrNull(raw);
  if (s === null) return { status: 'unknown', matched: false };
  const v = s.toLowerCase();

  const map: Record<string, NormalizedStatus> = {
    success: 'completed',
    finish: 'completed',
    finished: 'completed',
    completed: 'completed',
    done: 'completed',
    running: 'printing',
    printing: 'printing',
    working: 'printing',
    prepare: 'pending',
    pending: 'pending',
    idle: 'pending',
    queued: 'pending',
    failed: 'failed',
    failure: 'failed',
    error: 'failed',
    cancel: 'cancelled',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    stopped: 'cancelled',
    aborted: 'cancelled',
  };

  const matched = map[v];
  if (matched) return { status: matched, matched: true };
  return { status: 'unknown', matched: false };
}

/** Normaliza o mapeamento de AMS em materiais (best-effort). */
function normalizeAmsMaterials(raw: unknown, warnings: string[]): NormalizedMaterial[] {
  if (raw === undefined || raw === null) return [];

  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
      ? Object.values(raw as Json)
      : [];

  if (list.length === 0) {
    warnings.push('ams_mapping_vazio');
    return [];
  }

  return list.map((entry) => {
    const e = asRecord(entry);
    return {
      amsUnit: toNumberOrNull(pick(e, ['ams', 'amsId', 'ams_unit', 'unit'])),
      slotNumber: toNumberOrNull(pick(e, ['slot', 'slotId', 'slot_number', 'trayId', 'id'])),
      colorHex: toStringOrNull(pick(e, ['color', 'colour', 'color_hex', 'colorHex'])),
      materialType: toStringOrNull(pick(e, ['type', 'material', 'filamentType', 'tray_type'])),
      weightG: toNumberOrNull(pick(e, ['weight', 'weight_g', 'used_g', 'usedWeight'])),
    };
  });
}

/**
 * Normaliza uma tarefa bruta da Bambu Cloud.
 * Nunca lança: payloads desconhecidos produzem um registro com warnings.
 */
export function normalizeBambuTask(payload: unknown): NormalizedPrintJob {
  const warnings: string[] = [];
  const obj = asRecord(payload);

  const externalTaskId =
    toStringOrNull(pick(obj, ['id', 'taskId', 'task_id', 'jobId', 'uuid'])) ?? '';
  if (externalTaskId === '') {
    warnings.push('external_task_id_ausente');
  }

  const rawStatus = pick(obj, ['status', 'state', 'taskStatus', 'print_status']);
  const { status: normalizedStatus, matched } = normalizeStatus(rawStatus);
  if (!matched && rawStatus !== undefined) warnings.push('status_desconhecido');

  const providerStartAt = parseTimestamp(
    pick(obj, ['startTime', 'start_time', 'startAt', 'beginTime']),
  );
  const providerEndAt = parseTimestamp(pick(obj, ['endTime', 'end_time', 'endAt', 'finishTime']));

  if (providerStartAt === null && pick(obj, ['startTime', 'start_time']) !== undefined) {
    warnings.push('start_time_invalido');
  }
  if (providerEndAt === null && pick(obj, ['endTime', 'end_time']) !== undefined) {
    warnings.push('end_time_invalido');
  }

  // Duração: NÃO presumir que costTime é tempo real. Para concluídos com datas
  // válidas, preferir endTime - startTime; caso contrário, cair para costTime.
  const costTimeS = toNumberOrNull(pick(obj, ['costTime', 'cost_time', 'time', 'duration']));
  let providerDurationS: number | null = null;
  let durationSource: DurationSource = 'none';

  if (
    normalizedStatus === 'completed' &&
    providerStartAt !== null &&
    providerEndAt !== null &&
    new Date(providerEndAt).getTime() > new Date(providerStartAt).getTime()
  ) {
    providerDurationS = Math.round(
      (new Date(providerEndAt).getTime() - new Date(providerStartAt).getTime()) / 1000,
    );
    durationSource = 'end_minus_start';
  } else if (costTimeS !== null && costTimeS > 0) {
    providerDurationS = costTimeS;
    durationSource = 'cost_time';
  } else {
    if (costTimeS === 0) warnings.push('duracao_zero');
    durationSource = 'none';
  }

  const providerWeightG = toNumberOrNull(pick(obj, ['weight', 'weight_g', 'totalWeight']));
  if (providerWeightG === 0) warnings.push('peso_zero');
  if (providerWeightG === null && pick(obj, ['weight']) !== undefined) {
    warnings.push('peso_invalido');
  }

  const materials = normalizeAmsMaterials(
    pick(obj, ['amsDetailMapping', 'ams_detail_mapping', 'amsMapping', 'ams']),
    warnings,
  );

  return {
    externalTaskId,
    externalModelId: toStringOrNull(pick(obj, ['modelId', 'model_id', 'designId', 'design_id'])),
    title: toStringOrNull(pick(obj, ['title', 'designTitle', 'name', 'modelName'])),
    coverUrl: toStringOrNull(pick(obj, ['cover', 'coverUrl', 'cover_url', 'image', 'thumbnail'])),
    providerStatus: toStringOrNull(rawStatus),
    normalizedStatus,
    providerStartAt,
    providerEndAt,
    providerDurationS,
    durationSource,
    providerWeightG,
    externalDeviceId: toStringOrNull(pick(obj, ['deviceId', 'device_id', 'devId', 'printerId'])),
    deviceName: toStringOrNull(pick(obj, ['deviceName', 'device_name', 'printerName'])),
    deviceModel: toStringOrNull(pick(obj, ['deviceModel', 'device_model', 'model', 'machineType'])),
    printMode: toStringOrNull(pick(obj, ['mode', 'printMode', 'print_mode'])),
    materials,
    rawPayload: payload,
    warnings,
  };
}
