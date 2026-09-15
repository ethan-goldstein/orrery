/**
 * public/data/status.json: last-updated stamps per dataset, read by the
 * Sources dialog. Only written when a dataset actually changed, so a
 * no-change refresh leaves the tree clean and nothing is redeployed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DataStatus {
  orbit?: { snapshot: string; count: number; updated: string };
  quakes?: { retrieved: string; count: number; end: string; updated: string };
  solar?: { epoch: string; retrieved: string; updated: string };
}

export const STATUS_FILE = 'public/data/status.json';

export function readStatus(file = STATUS_FILE): DataStatus {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as DataStatus;
  } catch {
    return {};
  }
}

export function writeStatus(patch: DataStatus, file = STATUS_FILE): DataStatus {
  const next = { ...readStatus(file), ...patch };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 1)}\n`);
  return next;
}
