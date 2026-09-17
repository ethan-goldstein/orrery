import type { Engine } from '@/engine/Engine';
import { clockStore } from '@/store/clock';
import { ROUTES } from '@/app/route-list';
import { captureFilename, composeCapture } from './capture';

/** Copy the current address; clipboard API first, the selection route as a fallback. */
export async function copyLinkToClipboard(): Promise<boolean> {
  const href = window.location.href;
  try {
    await navigator.clipboard.writeText(href);
    return true;
  } catch {
    /* fall through */
  }
  const ta = document.createElement('textarea');
  ta.value = href;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok: boolean;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/** The caption plate for a capture: what the page says about itself right now. */
export function currentCaption(active: string | null) {
  const route = ROUTES.find((r) => r.id === active);
  const title = document.querySelector('h1')?.textContent?.trim() ?? route?.title ?? 'Orrery';
  const kicker = document.querySelector('.plate .kicker')?.textContent?.trim() ?? route?.nav ?? '';
  return { kicker, title, epochMs: clockStore.getState().epochMs, url: window.location.href };
}

/** Render one frame, add the caption plate, return it as a PNG file (null when nothing is mounted). */
export async function captureFrame(engine: Engine | null, active: string | null): Promise<File | null> {
  if (!engine) return null;
  const frame = await engine.capture();
  if (!frame) return null;
  const cap = currentCaption(active);
  const png = await composeCapture(frame, cap);
  return new File([png], captureFilename(active ?? 'orrery', cap.epochMs), { type: 'image/png' });
}

/** Hand a file to the browser as a download. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
