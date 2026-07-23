/**
 * Fixed-point decimal backed by BigInt — deterministic, exact for +/-/*, and
 * half-up rounded for division. Used so money and cost math never touches IEEE
 * floating point (requisito do produto: "Não use ponto flutuante para dinheiro").
 *
 * Internal scale is 6 decimal places. Convert to number only at the boundary
 * (display / persistence), rounding to the caller's desired decimal places.
 */

const SCALE = 6n;
const SCALE_FACTOR = 1_000_000n; // 10 ** 6

export class Dec {
  /** Value multiplied by SCALE_FACTOR. */
  readonly raw: bigint;

  private constructor(raw: bigint) {
    this.raw = raw;
  }

  static readonly ZERO = new Dec(0n);

  static from(value: number | string | Dec): Dec {
    if (value instanceof Dec) return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Dec.from: valor não finito: ${value}`);
      }
      return Dec.fromString(value.toString());
    }
    return Dec.fromString(value);
  }

  private static fromString(input: string): Dec {
    const s = input.trim();
    const negative = s.startsWith('-');
    const unsigned = negative ? s.slice(1) : s;
    const [intPart = '0', fracPartRaw = ''] = unsigned.split('.');
    // pad/truncate fractional part to SCALE digits (truncate extra precision)
    const fracPart = fracPartRaw.padEnd(Number(SCALE), '0').slice(0, Number(SCALE));
    const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, '');
    const magnitude = BigInt(digits === '' ? '0' : digits);
    return new Dec(negative ? -magnitude : magnitude);
  }

  add(other: number | string | Dec): Dec {
    return new Dec(this.raw + Dec.from(other).raw);
  }

  sub(other: number | string | Dec): Dec {
    return new Dec(this.raw - Dec.from(other).raw);
  }

  mul(other: number | string | Dec): Dec {
    // (a/S) * (b/S) = a*b / S^2  → scaled value = a*b / S
    return new Dec(divRoundHalfUp(this.raw * Dec.from(other).raw, SCALE_FACTOR));
  }

  div(other: number | string | Dec): Dec {
    const divisor = Dec.from(other).raw;
    if (divisor === 0n) throw new Error('Dec.div: divisão por zero');
    // (a/S) / (b/S) = a/b → scaled value = a*S / b
    return new Dec(divRoundHalfUp(this.raw * SCALE_FACTOR, divisor));
  }

  isZero(): boolean {
    return this.raw === 0n;
  }

  isNegative(): boolean {
    return this.raw < 0n;
  }

  /** Round to `dp` decimal places and return a JS number (boundary only). */
  toNumber(dp = 4): number {
    return Number(this.toFixed(dp));
  }

  /** Round to `dp` decimal places and return a fixed-precision string. */
  toFixed(dp = 4): string {
    if (dp < 0) throw new Error('toFixed: dp negativo');
    const targetFactor = 10n ** BigInt(dp);
    const scaled = divRoundHalfUp(this.raw * targetFactor, SCALE_FACTOR);
    const negative = scaled < 0n;
    const abs = negative ? -scaled : scaled;
    const asStr = abs.toString().padStart(dp + 1, '0');
    const intPart = asStr.slice(0, asStr.length - dp) || '0';
    const fracPart = dp > 0 ? '.' + asStr.slice(asStr.length - dp) : '';
    return `${negative ? '-' : ''}${intPart}${fracPart}`;
  }
}

/** Integer division of BigInts with half-up rounding (round half away from zero). */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;
  const quotient = a / b;
  const remainder = a % b;
  const rounded = remainder * 2n >= b ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export const dec = (value: number | string | Dec): Dec => Dec.from(value);
