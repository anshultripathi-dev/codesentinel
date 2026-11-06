// Input validators (sample code for CodeSentinel demos).
export type Result = { ok: true } | { ok: false; reason: string };

export function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function nonEmpty(value: string): Result {
  return value.trim().length > 0 ? { ok: true } : { ok: false, reason: "empty" };
}

export function maxLength(value: string, limit: number): Result {
  return value.length <= limit ? { ok: true } : { ok: false, reason: `longer than ${limit}` };
}

export function oneOf<T>(value: T, allowed: readonly T[]): boolean {
  return allowed.includes(value);
}

export function firstError(results: Result[]): string | null {
  for (const r of results) {
    if (!r.ok) {
      return r.reason;
    }
  }
  return null;
}
