import fs from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import type {Episode} from '../schema.js';
import type {EpisodeDecisions, SfxKind} from '../director/types.js';
import type {Timings} from './tts.js';

const SR = 44100;

/** Tiny deterministic noise source so synthesised SFX are identical on every render. */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

/** Synthesised SFX (no sample files needed). variant 0-2 changes pitch/character. */
export function synth(kind: SfxKind, variant: number): Float32Array {
  const dur = {pop: 0.14, whoosh: 0.45, tick: 0.035, ding: 0.9}[kind];
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  const noise = lcg(1000 + variant);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    switch (kind) {
      case 'pop': {
        const f = 420 + variant * 90 - 260 * (t / dur);
        v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 28) * 0.6;
        break;
      }
      case 'whoosh': {
        const a = Math.sin(Math.PI * (t / dur)) ** 2;
        lp += (noise() - lp) * (0.05 + 0.25 * (t / dur) * (1 + variant * 0.3));
        v = lp * a * 1.1;
        break;
      }
      case 'tick':
        v = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 160) * 0.35;
        break;
      case 'ding': {
        const f = 880 * [1, 1.122, 1.26][variant];
        v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t)) * Math.exp(-t * 5) * 0.35;
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

/** Narration clean-up: rumble cut + gentle compression so quiet words stay audible under music. */
const VOICE_FX = 'highpass=f=80,acompressor=threshold=0.125:ratio=3:attack=5:release=120:makeup=2,';

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
  dec.scenes.forEach((d, i) => {
    for (const c of d.sfx) {
      const k = `${c.kind}${c.variant}`;
      if (!cache.has(k)) cache.set(k, synth(c.kind, c.variant));
      add(sfx, cache.get(k)!, d.startSec + c.t, c.kind === 'tick' ? 0.3 : 0.5);
    }
    const f = ['wav', 'mp3', 'm4a'].map(e => `${dir}audio/scene-${i + 1}.${e}`).find(p => fs.existsSync(p));
    if (f) { hasVoice = true; add(voice, readWav16(f), d.startSec + d.speechStart, 1); }
  });
  void timings; void ep;

  fs.mkdirSync(`${dir}build`, {recursive: true});
  const sfxWav = `${dir}build/sfx.wav`, voiceWav = `${dir}build/voice.wav`, mixed = `${dir}build/mix-raw.wav`, out = `${dir}build/mix.wav`;
  writeWav(sfxWav, sfx);
  writeWav(voiceWav, voice);

  const musicDir = process.env.YT_MUSIC_DIR ? process.env.YT_MUSIC_DIR.replace(/\/?$/, '/') : new URL('../../assets/music/', import.meta.url).pathname;
  const beds = fs.existsSync(musicDir) ? fs.readdirSync(musicDir).filter(f => /\.(mp3|wav|m4a|ogg)$/i.test(f)) : [];
  const track = dec.music?.track && beds.includes(dec.music.track) ? dec.music.track : beds[0]; // director's mood bed, else any bed
  const args = ['-y', '-loglevel', 'error', '-i', voiceWav, '-i', sfxWav];
  // voice is the sidechain key for both the SFX duck and the (optional) music duck
  const sfxDuck = 'sidechaincompress=threshold=0.03:ratio=4:attack=5:release=200';
  let filter: string;
  if (track) {
    args.push('-stream_loop', '-1', '-i', `${musicDir}${track}`);
    // music at -22 dB, sidechain-ducked by the voice, then summed with voice + ducked sfx
    filter = '[0:a]' + VOICE_FX + 'asplit=3[v][k1][k2];[1:a][k1]' + sfxDuck + '[sfxd];' +
      '[2:a]volume=0.12,atrim=0:' + totalSec.toFixed(3) + '[m];[m][k2]sidechaincompress=threshold=0.02:ratio=2.6:attack=20:release=400:makeup=1[duck];' +
      '[v][sfxd][duck]amix=inputs=3:normalize=0[o]';
  } else {
    filter = '[0:a]' + VOICE_FX + 'asplit=2[v][k1];[1:a][k1]' + sfxDuck + '[sfxd];[v][sfxd]amix=inputs=2:normalize=0[o]';
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
