import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPlausible, MIN_ROWS, rowsHash, unchanged } from '../../../scripts/lib/guards';
import { readStatus, writeStatus } from '../../../scripts/lib/status';

describe('data guards', () => {
  it('refuses implausibly small datasets', () => {
    expect(() => assertPlausible('satellites', MIN_ROWS.satellites - 1)).toThrow(/refusing/);
    expect(() => assertPlausible('quakes', 0)).toThrow();
    expect(() => assertPlausible('quakes', NaN)).toThrow();
    expect(() => assertPlausible('satellites', MIN_ROWS.satellites)).not.toThrow();
  });
  it('hashes rows independently of surrounding timestamps', () => {
    const rows = [[1, 2, 3], [4, 5, 6]];
    const dir = mkdtempSync(join(tmpdir(), 'orrery-guards-'));
    const file = join(dir, 'x.json');
    writeFileSync(file, JSON.stringify({ retrieved: '2026-01-01T00:00:00Z', rows }));
    expect(unchanged(file, 'rows', rows)).toBe(true);
    expect(unchanged(file, 'rows', [[1, 2, 3], [4, 5, 7]])).toBe(false);
    expect(unchanged(join(dir, 'missing.json'), 'rows', rows)).toBe(false);
    expect(rowsHash(rows)).toHaveLength(64);
  });
  it('merges status patches without dropping other datasets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orrery-status-'));
    const file = join(dir, 'status.json');
    writeStatus({ orbit: { snapshot: '2026-09-14', count: 19_799, updated: 'a' } }, file);
    writeStatus({ quakes: { retrieved: 'b', count: 3974, end: '2026-09-14', updated: 'b' } }, file);
    const s = readStatus(file);
    expect(s.orbit?.count).toBe(19_799);
    expect(s.quakes?.count).toBe(3974);
  });
});
