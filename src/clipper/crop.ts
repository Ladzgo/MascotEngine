import {spawnSync} from 'node:child_process';
import {decimate, smoothPath, type Pt} from './smooth.js';

export const SW = 96; // analysis frame width (px); height follows aspect

/** Skin-tone likelihood (classic RGB rule) for interleaved rgb24 pixels -> 0/1 mask. */
export function skinMask(rgb: Uint8Array): Uint8Array {
  const m = new Uint8Array(rgb.length / 3);
  for (let i = 0; i < m.length; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    m[i] = r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b ? 1 : 0;
  }
  return m;
}

/**
 * Motion-weighted horizontal centroid (0..1) between two gray frames; conf = share of motion energy above noise.
 * colW weights columns (background suppression), skin weights moving pixels that look like skin (x1) vs not (x0.35).
 */
export function centroidX(prev: Uint8Array, cur: Uint8Array, w: number, h: number, noise = 12, colW?: number[], skin?: Uint8Array): {x: number; conf: number} {
  // pass 1: is there real moving skin? then non-skin motion (screens, tickers, foliage) is ignored, else it only counts x0.35
  let skinE = 0, skinPx = 0;
  if (skin) for (let i = 0; i < w * h; i++) { if (skin[i]) skinPx++; const d = Math.abs(cur[i] - prev[i]); if (skin[i] && d > noise) skinE += d * (colW?.[i % w] ?? 1); }
  const person = skinPx >= 20; // a person-like blob is in frame: only their motion counts, otherwise the track holds
  const other = skin ? (person ? 0.005 : 0.35) : 1;
  let sum = 0, wx = 0, raw = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(cur[y * w + x] - prev[y * w + x]);
    if (d > noise) { raw += d; const k = d * (colW?.[x] ?? 1) * (skin && !skin[y * w + x] ? other : 1); sum += k; wx += k * (x + 0.5); }
  }
  // motion that is mostly suppressed background carries no confidence (the track holds)
  return {x: sum ? wx / sum / w : 0.5, conf: raw && sum / raw >= 0.15 && !(person && skinE < 100) ? Math.min(1, sum / (w * h * 8)) : 0};
}

/** Column weights: columns that move in most frames (ticker, screen, fan, flashing light) are not the speaker. */
export function backgroundWeights(frames: Uint8Array[], w: number, h: number, noise = 12): number[] {
  const act = new Array(w).fill(0), n = frames.length - 1;
  if (n < 6) return act.map(() => 1);
  for (let i = 1; i < frames.length; i++) for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = 0; y < h; y++) if (Math.abs(frames[i][y * w + x] - frames[i - 1][y * w + x]) > noise) c++;
    if (c >= 2) act[x]++;
  }
  // a window of columns (+-2) is "busy" if it moves in > 60% of frames; weight falls to 0.02 by 90%
  const w0 = act.map((_, x) => {
    const f = Math.max(...act.slice(Math.max(0, x - 2), x + 3)) / n;
    return 1 - 0.98 * Math.min(1, Math.max(0, (f - 0.6) / 0.3));
  });
  return w0.filter(v => v < 0.5).length > 0.6 * w ? act.map(() => 1) : w0; // everything moves (busy scene): nothing stands out, keep all columns
}

/** Raw track from consecutive frames; low-confidence frames hold the previous position (starts centered). */
export function trackFrames(frames: Uint8Array[], w: number, h: number, hz: number, minConf = 0.01, skin?: Uint8Array[]): Pt[] {
  const out: Pt[] = [{t: 0, x: 0.5}];
  const colW = backgroundWeights(frames, w, h);
  for (let i = 1; i < frames.length; i++) {
    const {x, conf} = centroidX(frames[i - 1], frames[i], w, h, 12, colW, skin?.[i]);
    out.push({t: i / hz, x: conf >= minConf ? x : out[out.length - 1].x});
  }
  return out;
}

/** Sample the source with ffmpeg (tiny gray frames) and return a normalized (0..1) subject track, t relative to `start`. */
export function sampleTrack(file: string, start: number, end: number, srcW: number, srcH: number, hz = 4): Pt[] {
  const h = Math.max(2, Math.round((SW * srcH) / srcW / 2) * 2);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(start), '-t', String(end - start), '-i', file, '-an', '-vf', `fps=${hz},scale=${SW}:${h},format=rgb24`, '-f', 'rawvideo', '-'], {maxBuffer: 1 << 29});
  if (r.status !== 0) throw new Error(`ffmpeg sampling failed: ${String(r.stderr).slice(0, 200)}`);
  const buf = r.stdout, size = SW * h * 3, frames: Uint8Array[] = [], skin: Uint8Array[] = [];
  for (let o = 0; o + size <= buf.length; o += size) {
    const rgb = new Uint8Array(buf.subarray(o, o + size)), g = new Uint8Array(SW * h);
    for (let i = 0; i < g.length; i++) g[i] = (rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8;
    frames.push(g); skin.push(skinMask(rgb));
  }
  return frames.length ? trackFrames(frames, SW, h, hz, 0.01, skin) : [{t: 0, x: 0.5}];
}

/** Crop window width for 9:16 (even), capped by the source width. */
export const cropWidth = (srcW: number, srcH: number) => Math.min(srcW, 2 * Math.floor((srcH * 9) / 32));

/** Normalized track -> smoothed left-edge pixel path with ~0.5 s knots. maxSpeed is in window-widths per second. */
export function cropPath(track: Pt[], srcW: number, cw: number, o: {maxSpeed?: number; deadband?: number} = {}): Pt[] {
  const range = srcW - cw;
  const px = track.map(p => ({t: p.t, x: p.x * srcW - cw / 2}));
  const sm = smoothPath(px, {hz: 10, alpha: 0.2, deadband: o.deadband ?? cw * 0.04, maxSpeed: (o.maxSpeed ?? 0.35) * cw, min: 0, max: range});
  return decimate(sm, 0.5).map(p => ({t: Math.round(p.t * 1000) / 1000, x: Math.round(p.x)}));
}
