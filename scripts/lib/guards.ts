/**
 * Guard rails for the data-refresh workflow. Pure functions so they can be
 * unit-tested: a bad upstream response must fail the job, never shrink the
 * committed data, and unchanged rows must not churn timestamps.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export const MIN_ROWS = { satellites: 15_000, quakes: 3_500 } as const;
export type DatasetKind = keyof typeof MIN_ROWS;

export function assertPlausible(kind: DatasetKind, count: number): void {
  if (!Number.isFinite(count) || count < MIN_ROWS[kind]) {
    throw new Error(`${kind}: only ${count} rows, expected at least ${MIN_ROWS[kind]}; refusing to overwrite the committed data`);
  }
}

/** Hash of the row payload only: timestamps and snapshot dates are excluded on purpose. */
export function rowsHash(rows: unknown): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

/** True when the file on disk already holds exactly these rows under `key`. */
export function unchanged(prevFile: string, key: string, rows: unknown): boolean {
  if (!existsSync(prevFile)) return false;
  try {
    const prev = JSON.parse(readFileSync(prevFile, 'utf8')) as Record<string, unknown>;
    return rowsHash(prev[key]) === rowsHash(rows);
  } catch {
    return false;
  }
}
