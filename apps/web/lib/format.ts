import { formatInTimeZone } from 'date-fns-tz';

const DEFAULT_TZ = process.env.APP_DEFAULT_TIMEZONE || 'America/Sao_Paulo';

/** Formata BRL (ou moeda da org). Aceita number ou string (numeric do PG). */
export function formatMoney(value: number | string | null | undefined, currency = 'BRL'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Margem em %, tratando null (receita zero) como "—". */
export function formatMargin(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

/** Formata data/hora no timezone da organização. */
export function formatDateTime(
  value: string | Date | null | undefined,
  tz = DEFAULT_TZ,
): string {
  if (!value) return '—';
  try {
    return formatInTimeZone(new Date(value), tz, "dd/MM/yyyy HH:mm");
  } catch {
    return '—';
  }
}

export function formatDate(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return '—';
  try {
    return formatInTimeZone(new Date(value), tz, 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

/** Duração humanizada a partir de segundos. */
export function formatDuration(seconds: number | string | null | undefined): string {
  const s = typeof seconds === 'string' ? Number(seconds) : (seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function formatWeight(grams: number | string | null | undefined): string {
  const g = typeof grams === 'string' ? Number(grams) : (grams ?? 0);
  if (!Number.isFinite(g)) return '—';
  return `${g.toFixed(0)} g`;
}
