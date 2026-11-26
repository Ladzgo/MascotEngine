/**
 * Procedural music beds (original work, no third-party rights): chord pad, bass, soft beat, plucks, riser, per mood.
 * `npx tsx scripts/music/gen.ts` writes assets/music/<mood>-<n>.mp3 (16 bars at 100-120 bpm, loop-safe: every tail wraps
 * around the end, so -stream_loop is seamless), loudness-normalised to about -20 LUFS (audio.ts ducks them under the voice).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const SR = 44100, BARS = 16;
type Mood = 'curious' | 'tense' | 'upbeat' | 'warm' | 'serious' | 'calm';
type Spec = {mood: Mood; n: number; bpm: number; root: number; prog: number[][]; kick: number; hat: number; pluck: 'arp' | 'sparse' | 'none'; bright: number; riser: boolean; seed: number};
// chords as semitone offsets from the root (one per bar, repeated)
const MIN = [[0, 3, 7, 10], [8, 12, 15, 19], [5, 8, 12, 15], [7, 10, 14, 17]], MAJ = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];
const DARK = [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5, 8]], OPEN = [[0, 7, 14, 16], [5, 12, 16, 19], [9, 12, 16, 19], [7, 11, 14, 19]];
const SPECS: Spec[] = [
  {mood: 'curious', n: 1, bpm: 104, root: 57, prog: MIN, kick: 0, hat: 0.3, pluck: 'arp', bright: 0.6, riser: false, seed: 11},
  {mood: 'curious', n: 2, bpm: 112, root: 62, prog: OPEN, kick: 0, hat: 0.4, pluck: 'arp', bright: 0.8, riser: false, seed: 12},
  {mood: 'tense', n: 1, bpm: 100, root: 45, prog: DARK, kick: 0.5, hat: 0, pluck: 'sparse', bright: 0.3, riser: true, seed: 21},
  {mood: 'tense', n: 2, bpm: 108, root: 43, prog: MIN, kick: 0.7, hat: 0.3, pluck: 'sparse', bright: 0.4, riser: true, seed: 22},
  {mood: 'upbeat', n: 1, bpm: 118, root: 60, prog: MAJ, kick: 0.9, hat: 0.7, pluck: 'arp', bright: 1, riser: true, seed: 31},
  {mood: 'upbeat', n: 2, bpm: 120, root: 55, prog: OPEN, kick: 0.8, hat: 0.6, pluck: 'arp', bright: 0.9, riser: true, seed: 32},
  {mood: 'warm', n: 1, bpm: 100, root: 53, prog: MAJ, kick: 0.4, hat: 0.2, pluck: 'sparse', bright: 0.4, riser: false, seed: 41},
  {mood: 'warm', n: 2, bpm: 106, root: 57, prog: OPEN, kick: 0.3, hat: 0, pluck: 'arp', bright: 0.5, riser: false, seed: 42},
  {mood: 'serious', n: 1, bpm: 100, root: 48, prog: MIN, kick: 0.5, hat: 0, pluck: 'none', bright: 0.3, riser: true, seed: 51},
  {mood: 'serious', n: 2, bpm: 110, root: 50, prog: DARK, kick: 0.6, hat: 0.2, pluck: 'sparse', bright: 0.35, riser: false, seed: 52},
  {mood: 'calm', n: 1, bpm: 100, root: 52, prog: OPEN, kick: 0, hat: 0, pluck: 'sparse', bright: 0.4, riser: false, seed: 61},
  {mood: 'calm', n: 2, bpm: 104, root: 59, prog: MAJ, kick: 0.2, hat: 0, pluck: 'arp', bright: 0.5, riser: false, seed: 62},
];
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function render(s: Spec): {l: Float32Array; r: Float32Array} {
  const rand = rng(s.seed), beat = 60 / s.bpm, bar = beat * 4, N = Math.round(bar * BARS * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  /** adds a mono signal at time t, wrapping past the end (loop-safe), with a stereo pan */
  const put = (t: number, sig: Float32Array, pan = 0.5, g = 1) => {
    const o = Math.round(t * SR);
    for (let i = 0; i < sig.length; i++) { const k = (o + i) % N; L[k] += sig[i] * g * (1 - pan) * 1.4; R[k] += sig[i] * g * pan * 1.4; }
  };
  const env = (i: number, n: number, a: number, rel: number) => Math.min(1, i / (a * SR)) * Math.min(1, (n - i) / (rel * SR));
  const tone = (f: number, dur: number, a: number, rel: number, harm: number[]) => {
    const n = Math.round(dur * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = 0; harm.forEach((h, k) => { v += h * Math.sin(2 * Math.PI * f * (k + 1) * i / SR); }); out[i] = v * env(i, n, a, rel); }
    return out;
  };
  const harm = (b: number) => [1, 0.3 * b, 0.15 * b * b, 0.06 * b];
  for (let b = 0; b < BARS; b++) {
    const t0 = b * bar, chord = s.prog[b % s.prog.length];
    // pad: two detuned voices per note, slow attack/release (tail wraps)
    chord.forEach((c, k) => { const f = mtof(s.root + 12 + c); put(t0, tone(f * 1.003, bar + 1.2, 0.5, 1.2, harm(s.bright)), 0.3 + 0.1 * k, 0.07); put(t0, tone(f / 1.003, bar + 1.2, 0.5, 1.2, harm(s.bright)), 0.7 - 0.1 * k, 0.07); });
    // bass root on beat 1 (and the offbeat of beat 3 for the beat moods)
    put(t0, tone(mtof(s.root - 12 + chord[0]), beat * 1.8, 0.01, 0.4, [1, 0.25]), 0.5, 0.22);
    if (s.kick > 0.5) put(t0 + beat * 2.5, tone(mtof(s.root - 12 + chord[0]), beat * 0.7, 0.01, 0.2, [1, 0.2]), 0.5, 0.15);
    for (let q = 0; q < 4; q++) {
      const tb = t0 + q * beat;
      if (s.kick > 0 && (q % 2 === 0 || (s.kick > 0.8 && q === 3))) { // soft kick: sine sweep 110 -> 45 Hz
        const n = Math.round(0.28 * SR), k = new Float32Array(n);
        for (let i = 0; i < n; i++) { const tt = i / SR; k[i] = Math.sin(2 * Math.PI * (45 * tt + 65 * (1 - Math.exp(-tt * 28)) / 28)) * Math.exp(-tt * 12); }
        put(tb, k, 0.5, 0.3 * s.kick);
      }
      if (s.hat > 0) for (const off of [0.5, ...(s.hat > 0.5 ? [0.25, 0.75] : [])]) { // hat: short high-passed noise tick on the offbeats
        const n = Math.round(0.04 * SR), h = new Float32Array(n); let p = 0;
        for (let i = 0; i < n; i++) { const w = rand() * 2 - 1; h[i] = (w - p) * Math.exp(-i / (0.008 * SR)); p = w; }
        put(tb + off * beat, h, 0.6, 0.1 * s.hat * (off === 0.5 ? 1 : 0.5));
      }
      if (s.pluck !== 'none') { // pluck: decaying tone on chord tones; arp = every eighth, sparse = random quarters
        const steps = s.pluck === 'arp' ? [0, 0.5] : [rand() < 0.4 ? 0 : -1, rand() < 0.25 ? 0.5 : -1];
        steps.forEach(off => { if (off < 0) return; const note = chord[Math.floor(rand() * chord.length)] + (rand() < 0.5 ? 12 : 24); put(tb + off * beat, tone(mtof(s.root + note), beat * 1.5, 0.003, beat * 1.2, [1, 0.5 * s.bright, 0.2 * s.bright]), 0.2 + rand() * 0.6, 0.11); });
      }
    }
    // riser: filtered-noise swell across the last bar of every 8, landing on the loop point
    if (s.riser && b % 8 === 7) {
      const n = Math.round(bar * SR), x = new Float32Array(n); let lp = 0;
      for (let i = 0; i < n; i++) { const u = i / n, a = 0.02 + 0.5 * u * u; lp += (rand() * 2 - 1 - lp) * a; x[i] = lp * u * u * 1.6; }
      put(t0, x, 0.5, 0.35);
    }
  }
  return {l: L, r: R};
}

function writeWav(file: string, {l, r}: {l: Float32Array; r: Float32Array}) {
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(l[i] / peak * 30000), 44 + i * 4); buf.writeInt16LE(Math.round(r[i] / peak * 30000), 46 + i * 4); }
  fs.writeFileSync(file, buf);
}

if (process.argv[1]?.endsWith('gen.ts')) {
  const out = path.resolve(new URL('../../assets/music/', import.meta.url).pathname), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'music-'));
  const idx: Record<string, {mood: string; bpm: number}> = {};
  for (const s of SPECS) {
    const wav = path.join(tmp, `${s.mood}-${s.n}.wav`), file = `${s.mood}-${s.n}.mp3`;
    writeWav(wav, render(s));
    // linear loudnorm to -20 LUFS (the old beds sit at -19..-20); lowpass keeps beds from competing with the voice's presence band
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', 'lowpass=f=7000,loudnorm=I=-20:TP=-3:LRA=7', '-ar', '44100', '-b:a', '160k', path.join(out, file)]);
    idx[file] = {mood: s.mood, bpm: s.bpm};
    console.log(`${file}  ${s.bpm} bpm  ${(BARS * 240 / s.bpm).toFixed(1)} s`);
  }
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(idx, null, 1));
}
