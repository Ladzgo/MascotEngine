// Neural TTS engines behind one adapter: kokoro (local, Apache-2.0), piper (local, MIT), edge (online, Microsoft neural voices, keyless).
// Python lives in the project venv (.venv-tts, `npm run setup:voice`); scripts/tts/bridge.py does the synthesis, this file does
// text preparation (speech.ts), clause assembly with pauses, post-processing, alignment and caching.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {Episode} from '../schema.js';
import {detectAligner, mapToNarration, probeDuration, proportionalWords, runAligner, type RelWord} from './align.js';
import {segmentize, spoken} from './speech.js';
import {FPS, LEAD_IN, MIN_SCENE, SCENE_GAP, TRIM_AF, alignLang, audioKey, cacheGet, cachePut, episodeLang, type SceneTiming, type TTSAdapter, type Timings} from './tts.js';

const ROOT = new URL('../../', import.meta.url).pathname;
export type NeuralName = 'kokoro' | 'piper' | 'edge';
const py = () => process.env.TTS_PYTHON || path.join(ROOT, '.venv-tts/bin/python');
const modelsDir = () => (process.env.TTS_MODELS || path.join(ROOT, 'data/models/tts')).replace(/\/?$/, '/');
const hasPkg = (mod: string) => fs.existsSync(py()) && spawnSync(py(), ['-c', `import importlib.util as u,sys;sys.exit(0 if u.find_spec("${mod}") else 1)`]).status === 0;

/** Default voices per engine and language; TTS_VOICE (or a per-engine TTS_VOICE_<ENGINE>) overrides. */
const VOICES: Record<NeuralName, Record<string, string>> = {
  kokoro: {en: 'af_heart', gb: 'bf_emma'},
  piper: {en: 'en_US-ryan-high', hu: 'hu_HU-anna-medium'},
  edge: {en: 'en-US-AvaMultilingualNeural', hu: 'hu-HU-NoemiNeural', de: 'de-DE-ConradNeural', es: 'es-ES-ElviraNeural'},
};
export const neuralVoice = (e: NeuralName, lang: string, env: NodeJS.ProcessEnv = process.env) => env[`TTS_VOICE_${e.toUpperCase()}`] || env.TTS_VOICE_ALL || VOICES[e][lang] || VOICES[e].en;

/** Why an engine can or cannot run for a language, and the one command that fixes it (shown by doctor and the Studio). */
export function neuralStatus(e: NeuralName, lang = 'en'): {ok: boolean; detail: string; fix: string; online?: boolean} {
  const fix = 'npm run setup:voice';
  if (process.env.TTS_NEURAL === '0') return {ok: false, detail: 'disabled (TTS_NEURAL=0)', fix: ''};
  if (!fs.existsSync(py())) return {ok: false, detail: 'Python voice environment (.venv-tts) is not installed', fix};
  if (e === 'kokoro') {
    if (lang !== 'en') return {ok: false, detail: 'Kokoro is used for English only here', fix: ''};
    if (!fs.existsSync(`${modelsDir()}kokoro-v1.0.onnx`) || !fs.existsSync(`${modelsDir()}voices-v1.0.bin`)) return {ok: false, detail: 'Kokoro model files are missing (data/models/tts)', fix};
    return hasPkg('kokoro_onnx') ? {ok: true, detail: `Kokoro-82M, voice ${neuralVoice('kokoro', lang)}`, fix: ''} : {ok: false, detail: 'kokoro-onnx is not installed in .venv-tts', fix};
  }
  if (e === 'piper') {
    const v = neuralVoice('piper', lang);
    if (!VOICES.piper[lang]) return {ok: false, detail: `no Piper voice configured for "${lang}"`, fix: ''};
    if (!fs.existsSync(`${modelsDir()}${v}.onnx`)) return {ok: false, detail: `Piper voice ${v} is missing (data/models/tts)`, fix};
    return hasPkg('piper') ? {ok: true, detail: `Piper, voice ${v}`, fix: ''} : {ok: false, detail: 'piper-tts is not installed in .venv-tts', fix};
  }
  return hasPkg('edge_tts') ? {ok: true, detail: `Microsoft neural voice ${neuralVoice('edge', lang)} (online: the script text is sent to Microsoft)`, fix: '', online: true} : {ok: false, detail: 'edge-tts is not installed in .venv-tts', fix, online: true};
}
export const neuralReady = (e: NeuralName, lang = 'en') => neuralStatus(e, lang).ok;
/** Best offline neural engine for the language. edge sends text to Microsoft, so auto never picks it unless TTS_ONLINE=1. */
export function bestNeural(lang = 'en'): NeuralName | null {
  const order: NeuralName[] = lang === 'en' ? ['kokoro', 'piper'] : ['piper'];
  if (process.env.TTS_ONLINE === '1') order.push('edge');
  return order.find(e => neuralReady(e, lang)) ?? null;
}

const f32 = (file: string): Float32Array => { // any audio file -> mono 44.1k float
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '44100', '-'], {maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${String(r.stderr).slice(0, 160)}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength - (r.stdout.byteLength % 4)));
};
/** Voice sits in a room: 70 Hz high-pass, a faint short early reflection, then the usual edge trim. */
export const neuralPost = () => `highpass=f=70,aecho=0.9:0.9:23|41:0.10|0.06,${TRIM_AF}`; // a function: tts.ts and neural.ts import each other

/** Synthesise `text` (already spoken-form) as clause segments joined with pauses -> mono 44.1k wav at `outWav`. Used by scenes and by voice-test. */
export function renderSpeech(engine: NeuralName, text: string, lang: string, outWav: string, o: {seed?: number; emphasis?: string[]} = {}): void {
  const segs = segmentize(spoken(text, lang), {lang, seed: o.seed, emphasis: o.emphasis});
  const tmp = `${outWav}.parts`;
  fs.mkdirSync(tmp, {recursive: true});
  const ext = engine === 'edge' ? 'mp3' : 'wav';
  const job = {engine, voice: neuralVoice(engine, lang), lang, models: modelsDir(), segments: segs.map((s, i) => ({text: s.text, speed: s.speed, out: `${tmp}/${i}.${ext}`}))};
  const run = () => spawnSync(py(), [path.join(ROOT, 'scripts/tts/bridge.py')], {input: JSON.stringify(job), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24});
  let r = run();
  if (r.status !== 0 && /LibsndfileError|System error/.test(r.stderr ?? '')) { fs.mkdirSync(tmp, {recursive: true}); r = run(); } // a transient write error seen once on ep011; a second try passes
  if (r.status !== 0) throw new Error(`${engine} failed: ${(r.stderr || r.error?.message || '').split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300)}${engine === 'edge' ? ' (edge-tts needs an internet connection)' : ''}`);
  const parts = segs.map((s, i) => ({a: f32(`${tmp}/${i}.${ext}`), gap: Math.round(s.pauseMs * 44.1)}));
  const out = new Float32Array(parts.reduce((n, p) => n + p.a.length + p.gap, 0));
  let at = 0;
  for (const p of parts) { out.set(p.a, at); at += p.a.length + p.gap; }
  const pcm = Buffer.alloc(out.length * 2);
  for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), i * 2);
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(44100, 24); hdr.writeUInt32LE(88200, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(outWav, Buffer.concat([hdr, pcm]));
  fs.rmSync(tmp, {recursive: true, force: true});
}

/** Word times when the aligner heard the spoken form (numbers as words): group its words back onto the narration tokens. */
function mapSpoken(narration: string, lang: string, rec: RelWord[]): RelWord[] {
  const toks = narration.split(/\s+/).filter(Boolean), counts = toks.map(t => Math.max(1, spoken(t, lang).split(/\s+/).filter(Boolean).length));
  if (rec.length !== counts.reduce((a, b) => a + b, 0)) return mapToNarration(narration, rec);
  let k = 0;
  return toks.map((w, i) => { const g = rec.slice(k, k + counts[i]); k += counts[i]; return {w, start: g[0].start, end: g[g.length - 1].end}; });
}

export class NeuralTTS implements TTSAdapter {
  constructor(public name: NeuralName) {}
  async synthesize(ep: Episode, outDir: string): Promise<Timings> {
    const L = episodeLang(ep), st = neuralStatus(this.name, L);
    if (!st.ok) throw new Error(`${this.name} voice is not ready: ${st.detail}.${st.fix ? ` Fix: ${st.fix}` : ''}`);
    if (this.name === 'edge') console.warn('edge engine: the narration text is sent to Microsoft to be spoken.');
    fs.mkdirSync(`${outDir}audio`, {recursive: true});
    const aligner = detectAligner(), lang = aligner === 'whisper-cli' ? alignLang(ep) : L, voice = neuralVoice(this.name, L);
    let t = LEAD_IN;
    const scenes: SceneTiming[] = [];
    for (const [index, s] of ep.scenes.entries()) {
      const file = `${outDir}audio/scene-${index + 1}.mp3`, wav = `${outDir}audio/scene-${index + 1}.wav`;
      const key = audioKey(this.name, voice, 'neural3', neuralPost(), lang ?? '', aligner ?? '', s.narration), cached = cacheGet(file, key);
      let dur: number, rel: RelWord[];
      if (cached) { dur = cached.dur; rel = cached.rel; console.log(`scene ${index + 1}: audio cached`); } else {
        renderSpeech(this.name, s.narration, L, wav, {seed: index + 1, emphasis: 'emphasis' in s ? s.emphasis : []});
        const c = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', neuralPost(), '-ar', '44100', '-codec:a', 'libmp3lame', '-q:a', '3', file], {encoding: 'utf8'});
        fs.rmSync(wav, {force: true});
        if (c.status !== 0) throw new Error(`ffmpeg failed on scene ${index + 1}: ${(c.stderr || '').slice(0, 200)}`);
        dur = probeDuration(file);
        rel = [];
        if (aligner && lang) { try { rel = mapSpoken(s.narration, L, runAligner(aligner, file, lang)); } catch (e) { console.warn(`Aligner failed on scene ${index + 1}, using proportional timing: ${(e as Error).message.slice(0, 120)}`); } }
        if (!rel.length) rel = proportionalWords(s.narration, 0, dur);
        cachePut(file, {key, dur, rel});
      }
      const r9 = (n: number) => Math.round(n * 1e9) / 1e9;
      const words = rel.map(w => ({w: w.w, start: r9(t + w.start), end: r9(t + w.end)}));
      const end = Math.max(t + dur + 0.05, t + MIN_SCENE);
      scenes.push({index, start: r9(t), end: r9(end), audioFile: file, words});
      t = end + SCENE_GAP;
    }
    return {engine: this.name, fps: FPS, total: Math.round(t * 1e9) / 1e9, scenes};
  }
}
