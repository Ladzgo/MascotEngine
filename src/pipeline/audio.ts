import fs from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import type {Episode} from '../schema.js';
import type {EpisodeDecisions, SfxKind} from '../director/types.js';
import type {Timings} from './tts.js';

const SR = 44100;

/** Tiny deterministic noise source so synthesised SFX are identical on every render. */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

/** Pentatonic note ratios: ding/chime variants stay consonant with each other and with the music. */
const PENTA = [1, 1.122, 1.26, 1.498, 1.682, 1.888];

/** Synthesised SFX (no sample files needed). Variants 0-5 change pitch, sweep direction and character so neighbouring cues never sound identical. */
export function synth(kind: SfxKind, variant: number): Float32Array {
  const dur = {pop: 0.16, whoosh: 0.5, tick: 0.035, ding: 1.0, chime: 1.3}[kind];
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  const noise = lcg(1000 + variant);
  const v6 = ((variant % 6) + 6) % 6;
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    let v = 0;
    switch (kind) {
      case 'pop': { // soft bubble: pitch drops, tiny click on the attack, higher variants are brighter
        const f = 380 + v6 * 70 - (220 + v6 * 20) * u;
        v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (24 + v6 * 3)) * 0.55 + noise() * Math.exp(-t * 900) * 0.12;
        break;
      }
      case 'whoosh': { // filtered noise sweep; even variants rise, odd variants fall; band-passed so it never sounds like hiss
        const a = Math.sin(Math.PI * u) ** 2.2, k = v6 % 2 ? 0.32 - 0.27 * u : 0.05 + 0.27 * u;
        lp += (noise() - lp) * k * (1 + v6 * 0.08);
        lp2 += (lp - lp2) * 0.35;
        v = (lp - lp2) * a * 2.4;
        break;
      }
      case 'tick':
        v = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 160) * 0.35;
        break;
      case 'ding': {
        const f = 880 * PENTA[v6] * 0.75;
        v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t) + 0.12 * Math.sin(2 * Math.PI * f * 3.97 * t)) * Math.exp(-t * (4.5 + v6 * 0.4)) * Math.min(1, t * 900) * 0.32;
        break;
      }
      case 'chime': { // chapter start: two soft notes, a rising fifth
        const f = 523 * PENTA[v6 % 3], g = f * 1.498, t2 = Math.max(0, t - 0.16);
        v = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4) + (t > 0.16 ? Math.sin(2 * Math.PI * g * t2) * Math.exp(-t2 * 4) : 0)) * Math.min(1, t * 600) * 0.22;
        break;
      }
    }
    out[i] = v;
  }
  return out;
}

function readWav16(file: string): Float32Array {
  // narration files are converted to mono 44.1k s16 raw by ffmpeg, then read as raw PCM
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', String(SR), '-'], {maxBuffer: 1 << 29});
  const s = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
  return Float32Array.from(s, x => x / 32768);
}

function writeWav(file: string, data: Float32Array) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const add = (dst: Float32Array, src: Float32Array, at: number, gain = 1) => {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
};

/** RMS in dB over the active samples only (above a -45 dBFS gate), so pauses do not make a scene look quiet. -Infinity when there is no speech. */
export function activeRmsDb(x: Float32Array): number {
  const gate = 10 ** (-45 / 20);
  let sum = 0, n = 0;
  for (const v of x) if (Math.abs(v) > gate) { sum += v * v; n++; }
  return n ? 10 * Math.log10(sum / n) : -Infinity;
}

/** Linear gains that pull every scene's speech level to the episode median (clamped to +-6 dB, never past -0.5 dBFS peak). Silent scenes get 1. */
export function sceneGains(scenes: Float32Array[]): number[] {
  const db = scenes.map(activeRmsDb), live = db.filter(Number.isFinite).sort((a, b) => a - b);
  if (live.length < 2) return scenes.map(() => 1);
  const target = live[Math.floor((live.length - 1) / 2)];
  return scenes.map((x, i) => {
    if (!Number.isFinite(db[i])) return 1;
    let g = 10 ** (Math.max(-6, Math.min(6, target - db[i])) / 20), peak = 0;
    for (const v of x) peak = Math.max(peak, Math.abs(v));
    if (peak * g > 0.944) g = Math.max(0.5, 0.944 / peak);
    return g;
  });
}

/** Narration clean-up: rumble cut, a little warmth and presence, de-ess (synthetic sibilants are harsh), gentle compression so quiet words stay audible under music. */
const VOICE_FX = 'highpass=f=85,equalizer=f=170:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.8,deesser=i=0.35:m=0.5:f=0.5,lowpass=f=12000,acompressor=threshold=0.125:ratio=3:attack=5:release=120:makeup=2,';

/** Music gain curve: +4 dB lift (1.6x) with 0.6 s ramps over the cold open, every big_number/stats beat and the outro, 1.0 elsewhere. */
export function swellExpr(dec: EpisodeDecisions, total: number): string {
  const win: [number, number][] = [[0, 3.5]];
  for (const d of dec.scenes) if (d.type === 'big_number' || d.type === 'stats') win.push([d.startSec + Math.max(0, (d.elements?.[0] ?? 0) - 0.4), d.startSec + d.durSec]);
  win.push([Math.max(0, total - 5), total]);
  const R = 0.6;
  return '1+' + win.slice(0, 40).map(([a, b]) => `0.6*clip(min((t-${a.toFixed(2)})/${R},(${b.toFixed(2)}-t)/${R}),0,1)`).join('+');
}

/**
 * Builds the final audio: narration (if audio/scene-N.wav exists) + SFX + music bed (if assets/music has a track,
 * ducked under the voice with sidechain compression), then loudnorm to about -14 LUFS.
 */
export async function mixAudio(dir: string, ep: Episode, dec: EpisodeDecisions, timings: Timings, totalSec: number): Promise<string> {
  const n = Math.ceil(totalSec * SR);
  const sfx = new Float32Array(n);
  const voice = new Float32Array(n);
  const cache = new Map<string, Float32Array>();
  let hasVoice = false;
  const takes = dec.scenes.map((_, i) => { const f = ['wav', 'mp3', 'm4a'].map(e => `${dir}audio/scene-${i + 1}.${e}`).find(p => fs.existsSync(p)); return f ? readWav16(f) : null; });
  const gains = sceneGains(takes.map(t => t ?? new Float32Array(0))); // voice level consistency between scenes
  dec.scenes.forEach((d, i) => {
    for (const c of d.sfx) {
      const k = `${c.kind}${c.variant}`;
      if (!cache.has(k)) cache.set(k, synth(c.kind, c.variant));
      add(sfx, cache.get(k)!, d.startSec + c.t, ({tick: 0.3, chime: 0.55, whoosh: 0.42} as Partial<Record<SfxKind, number>>)[c.kind] ?? 0.5);
    }
    if (takes[i]) { hasVoice = true; add(voice, takes[i]!, d.startSec + d.speechStart, gains[i]); }
  });
  void timings;

  fs.mkdirSync(`${dir}build`, {recursive: true});
  const sfxWav = `${dir}build/sfx.wav`, voiceWav = `${dir}build/voice.wav`, mixed = `${dir}build/mix-raw.wav`, out = `${dir}build/mix.wav`;
  writeWav(sfxWav, sfx);
  writeWav(voiceWav, voice);

  const musicDir = process.env.YT_MUSIC_DIR ? process.env.YT_MUSIC_DIR.replace(/\/?$/, '/') : new URL('../../assets/music/', import.meta.url).pathname;
  const beds = fs.existsSync(musicDir) ? fs.readdirSync(musicDir).filter(f => /\.(mp3|wav|m4a|ogg)$/i.test(f)) : [];
  const track = dec.music?.track && beds.includes(dec.music.track) ? dec.music.track : beds[0]; // director's mood bed, else any bed
  // room tone: a very quiet brown-noise floor so pauses are not digital silence (about -52 dBFS)
  const args = ['-y', '-loglevel', 'error', '-i', voiceWav, '-i', sfxWav, '-f', 'lavfi', '-i', `anoisesrc=color=brown:amplitude=0.004:sample_rate=${SR}:duration=${totalSec.toFixed(3)}`];
  // voice is the sidechain key for both the SFX duck and the (optional) music duck
  const sfxDuck = 'sidechaincompress=threshold=0.03:ratio=4:attack=5:release=200';
  let filter: string;
  if (track) {
    // per-episode variation: the bed starts at a seed-chosen bar (beds are loop-safe, so any bar works)
    const bpm = (() => { try { return JSON.parse(fs.readFileSync(`${musicDir}index.json`, 'utf8'))[track]?.bpm as number | undefined; } catch { return undefined; } })();
    const bar = [...(ep.id ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 16, (ep.seed ?? 0) % 16), offset = bpm ? bar * 240 / bpm : 0;
    args.push('-stream_loop', '-1', '-i', `${musicDir}${track}`);
    const swell = swellExpr(dec, totalSec);
    // music at -22 dB, sidechain-ducked by the voice, then summed with voice + ducked sfx
    filter = '[0:a]' + VOICE_FX + 'asplit=3[v][k1][k2];[1:a][k1]' + sfxDuck + '[sfxd];' +
      '[3:a]' + (offset ? `atrim=start=${offset.toFixed(3)},asetpts=PTS-STARTPTS,` : '') + 'volume=0.12,volume=\'' + swell + '\':eval=frame,atrim=0:' + totalSec.toFixed(3) + '[m];[m][k2]sidechaincompress=threshold=0.02:ratio=2.6:attack=20:release=400:makeup=1[duck];' +
      '[v][sfxd][duck][2:a]amix=inputs=4:normalize=0[o]';
  } else {
    filter = '[0:a]' + VOICE_FX + 'asplit=2[v][k1];[1:a][k1]' + sfxDuck + '[sfxd];[v][sfxd][2:a]amix=inputs=3:normalize=0[o]';
  }
  execFileSync('ffmpeg', [...args, '-filter_complex', filter, '-map', '[o]', '-t', totalSec.toFixed(3), mixed]);

  // soft pre-limit tames hot voice peaks so linear two-pass loudnorm can reach -14.0 LUFS; final alimiter enforces the ceiling
  const pre = 'alimiter=limit=0.5:level=disabled:attack=5:release=50,';
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mixed, '-af', pre + 'loudnorm=I=-13.8:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26});
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(probe.stderr ?? '');
  let norm = 'loudnorm=I=-13.8:TP=-1.5:LRA=11';
  if (m) {
    const j = JSON.parse(m[0]) as Record<string, string>;
    if (Number.isFinite(Number(j.input_i)))
      norm += `:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mixed, '-af', `${pre}${norm},aresample=44100,alimiter=limit=0.7:level=disabled:attack=5:release=50`, '-ar', '44100', out]);
  void hasVoice;
  return out;
}
