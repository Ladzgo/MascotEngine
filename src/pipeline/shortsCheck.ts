import {spawnSync} from 'node:child_process';
import {probeDuration} from './align.js';

export const CW = 54, CH = 96;
export type Rgb = Uint8Array; // CW*CH*3
export type ShortReport = {ok: boolean; problems: string[]; coverage: Record<string, number>; loopDelta: number};

/** Share of pixels differing from the paper colour by > 40 (sum of channels / 3). */
export function coverage(f: Rgb, paper = [246, 241, 228]): number {
  let n = 0;
  for (let i = 0; i < f.length; i += 3) if ((Math.abs(f[i] - paper[0]) + Math.abs(f[i + 1] - paper[1]) + Math.abs(f[i + 2] - paper[2])) / 3 > 40) n++;
  return n / (f.length / 3);
}
export const meanDiff = (a: Rgb, b: Rgb) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

/** Pure verdict from frames: [first, ~1.5 s, 15%, 50%, 90%, last]. */
export function judge(fr: {first: Rgb; hook: Rgb; p15: Rgb; p50: Rgb; p90: Rgb; last: Rgb}): ShortReport {
  const problems: string[] = [];
  const cov = {first: coverage(fr.first), hook: coverage(fr.hook), p15: coverage(fr.p15), p50: coverage(fr.p50), p90: coverage(fr.p90), last: coverage(fr.last)};
  const loopDelta = meanDiff(fr.first, fr.last);
  if (cov.hook < 0.03) problems.push(`nothing visible at 1.5 s (coverage ${(cov.hook * 100).toFixed(1)}%): hook is not on screen`);
  for (const k of ['p15', 'p50', 'p90'] as const) if (cov[k] < 0.02 || cov[k] > 0.97) problems.push(`frame ${k} looks ${cov[k] < 0.02 ? 'empty' : 'solid'} (coverage ${(cov[k] * 100).toFixed(1)}%)`);
  if (loopDelta > 20) problems.push(`last frame differs from first (mean diff ${loopDelta.toFixed(1)}): loop will jump`);
  return {ok: !problems.length, problems, coverage: cov, loopDelta};
}

function frameAt(file: string, t: number): Rgb {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${CW}:${CH}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 24});
  if (r.status !== 0 || r.stdout.length < CW * CH * 3) throw new Error(`cannot read frame at ${t}s of ${file}`);
  return new Uint8Array(r.stdout.subarray(0, CW * CH * 3));
}

/** Real frame check of a rendered Short: first, 1.5 s (hook), 15/50/90 %, last. */
export function checkShort(file: string): ShortReport {
  const d = probeDuration(file), at = (t: number) => frameAt(file, Math.min(Math.max(0, t), d - 0.04));
  return judge({first: at(0), hook: at(1.5), p15: at(d * 0.15), p50: at(d * 0.5), p90: at(d * 0.9), last: at(d - 0.05)});
}
