import { formatUtc } from '@/astro/time';

export interface Caption {
  kicker: string;
  title: string;
  epochMs: number;
  url: string;
}

/**
 * Lay a small almanac plate over a captured frame: the world's kicker and
 * headline bottom-left, the date and the address bottom-right. Returns a PNG.
 */
export async function composeCapture(frame: Blob, caption: Caption): Promise<Blob> {
  const bitmap = await createImageBitmap(frame);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frame;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const s = Math.max(1, canvas.width / 1400); // scale text with the frame
  const pad = 36 * s;
  const rule = 'rgba(239,230,211,0.35)';
  // bottom gradient so type reads over stars and limbs
  const grad = ctx.createLinearGradient(0, canvas.height - 220 * s, 0, canvas.height);
  grad.addColorStop(0, 'rgba(7,10,18,0)');
  grad.addColorStop(1, 'rgba(7,10,18,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, canvas.height - 220 * s, canvas.width, 220 * s);
  ctx.textBaseline = 'alphabetic';
  // hairline
  ctx.strokeStyle = rule;
  ctx.lineWidth = Math.max(1, s);
  ctx.beginPath();
  ctx.moveTo(pad, canvas.height - pad - 78 * s);
  ctx.lineTo(canvas.width - pad, canvas.height - pad - 78 * s);
  ctx.stroke();
  // kicker
  ctx.fillStyle = '#b7ae9c';
  ctx.font = `500 ${13 * s}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  ctx.fillText(caption.kicker.toUpperCase().split('').join(String.fromCharCode(0x200a)), pad, canvas.height - pad - 50 * s);
  // headline
  ctx.fillStyle = '#efe6d3';
  ctx.font = `400 ${40 * s}px "Fraunces Variable", Fraunces, Georgia, serif`;
  ctx.fillText(caption.title, pad, canvas.height - pad);
  // date and address, right aligned
  ctx.textAlign = 'right';
  ctx.fillStyle = '#c9a961';
  ctx.font = `500 ${14 * s}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  ctx.fillText(formatUtc(caption.epochMs), canvas.width - pad, canvas.height - pad - 50 * s);
  ctx.fillStyle = '#b7ae9c';
  ctx.font = `400 ${13 * s}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  ctx.fillText(caption.url.replace(/^https?:\/\//, ''), canvas.width - pad, canvas.height - pad - 24 * s);
  ctx.fillStyle = '#efe6d3';
  ctx.font = `500 ${16 * s}px "Fraunces Variable", Fraunces, Georgia, serif`;
  ctx.fillText('orrery', canvas.width - pad, canvas.height - pad);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? frame), 'image/png'));
}

/** orrery-moon-2026-09-14-1200.png */
export function captureFilename(world: string, epochMs: number): string {
  const d = new Date(epochMs);
  const stamp = Number.isFinite(d.getTime()) && Math.abs(d.getUTCFullYear()) < 10000 ? d.toISOString().slice(0, 16).replace('T', '-').replace(':', '') : 'undated';
  return `orrery-${world}-${stamp}.png`;
}
