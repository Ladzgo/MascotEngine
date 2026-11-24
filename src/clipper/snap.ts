import {spawnSync} from 'node:child_process';

export const FRAME = 0.01; // s per energy frame

/** RMS per 10 ms frame of mono 16 kHz audio in [t0, t1). */
export function loadEnergy(file: string, t0: number, t1: number): {t0: number; rms: number[]} {
  const s = Math.max(0, t0);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(s), '-t', String(t1 - s), '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], {maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`ffmpeg energy failed: ${String(r.stderr).slice(0, 200)}`);
  const b = r.stdout, n = 160, rms: number[] = [];
  for (let o = 0; o + n * 2 <= b.length; o += n * 2) {
    let a = 0;
    for (let i = 0; i < n; i++) { const v = b.readInt16LE(o + i * 2) / 32768; a += v * v; }
    rms.push(Math.sqrt(a / n));
  }
  return {t0: s, rms};
}

/** Quiet = below 12% of the speech level (p75), floor 0.002. */
export const quietThreshold = (rms: number[]) => Math.max(0.002, 0.12 * ([...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.75)] ?? 0));

/** Quiet runs [from,to) in frame indices lasting >= minFrames. */
function quietRuns(rms: number[], thr: number, minFrames: number): [number, number][] {
  const out: [number, number][] = [];
  let a = -1;
  for (let i = 0; i <= rms.length; i++) {
    const q = i < rms.length && rms[i] < thr;
    if (q && a < 0) a = i;
    if (!q && a >= 0) { if (i - a >= minFrames) out.push([a, i]); a = -1; }
  }
  return out;
}

/**
 * Move a cut point onto real silence. `kind` 'end': nearest quiet run starting in [t-0.15, t+0.45], cut 70% into it (max 0.25 s of air).
 * 'start': nearest quiet run ending in [t-0.45, t+0.15], cut that much before its end. Unchanged when no silence is found.
 */
export function snapCut(e: {t0: number; rms: number[]}, t: number, kind: 'start' | 'end'): number {
  const runs = quietRuns(e.rms, quietThreshold(e.rms), 3).map(([a, b]) => [e.t0 + a * FRAME, e.t0 + b * FRAME] as [number, number]);
  const air = (a: number, b: number) => Math.min(0.25, (b - a) * 0.7);
  if (kind === 'end') {
    const r = runs.filter(([a, b]) => b > t - 0.15 && a < t + 0.45).sort((x, y) => Math.abs(Math.max(x[0], t - 0.15) - t) - Math.abs(Math.max(y[0], t - 0.15) - t))[0];
    return r ? Math.max(r[0], t - 0.15) + air(r[0], r[1]) : t;
  }
  const r = runs.filter(([a, b]) => a < t + 0.15 && b > t - 0.45).sort((x, y) => Math.abs(Math.min(x[1], t + 0.15) - t) - Math.abs(Math.min(y[1], t + 0.15) - t))[0];
  return r ? Math.min(r[1], t + 0.15) - air(r[0], r[1]) : t;
}

/** Snap both cut points of a clip to silence (audio-based; whisper word times can be contiguous across sentences). */
export function snapClip(file: string, start: number, end: number): {start: number; end: number} {
  const f = (t: number, k: 'start' | 'end') => snapCut(loadEnergy(file, t - 0.7, t + 0.7), t, k);
  return {start: Math.max(0, f(start, 'start')), end: f(end, 'end')};
}
