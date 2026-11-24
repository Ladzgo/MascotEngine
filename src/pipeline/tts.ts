import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {loadChannel} from '../channel/channel.js';
import type {Episode} from '../schema.js';
import {detectAligner, mapToNarration, probeDuration, proportionalWords, runAligner, type AlignerName, type RelWord} from './align.js';

export type WordTiming = {w: string; start: number; end: number};
export type SceneTiming = {
  index: number;
  start: number; // seconds from episode start
  end: number;
  audioFile?: string;
  words: WordTiming[];
};
export type Timings = {engine: string; fps: number; total: number; scenes: SceneTiming[]};

/** Every TTS engine implements this; paid engines stay optional plug-ins. */
export interface TTSAdapter {
  name: string;
  synthesize(ep: Episode, outDir: string): Promise<Timings>;
}

const WPS = 2.6; // words per second for estimates
const LEAD_IN = 0.4;
const SCENE_GAP = 0.5;
const MIN_SCENE = 1.2;
/** Cut leading/trailing silence of synthesized speech (keeps pauses between sentences short). */
const TRIM_AF = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05,areverse';
export const FPS = 30;

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export class SilentTTS implements TTSAdapter {
  name = 'silent';
  async synthesize(ep: Episode): Promise<Timings> {
    let t = LEAD_IN;
    const scenes: SceneTiming[] = ep.scenes.map((s, index) => {
      const toks = tokenize(s.narration);
      // weight by length so long words take longer; add a small pause at punctuation
      const weights = toks.map(w => Math.max(3, w.replace(/\W/g, '').length) + (/[.,!?;:]$/.test(w) ? 3 : 0));
      const sum = weights.reduce((a, b) => a + b, 0);
      const speech = toks.length / WPS;
      let cursor = t;
      const words = toks.map((w, i) => {
        const d = (weights[i] / sum) * speech;
        const wt = {w, start: round(cursor), end: round(cursor + d)};
        cursor += d;
        return wt;
      });
      const end = Math.max(cursor + 0.05, t + MIN_SCENE);
      const st: SceneTiming = {index, start: round(t), end: round(end), words};
      t = end + SCENE_GAP;
      return st;
    });
    return {engine: this.name, fps: FPS, total: round(t), scenes};
  }
}

/** macOS say voice: SAY_VOICE env, else the channel preset, else Samantha. */
export function pickSayVoice(ep: Episode, env: NodeJS.ProcessEnv = process.env): string {
  let v: string | undefined;
  try { v = loadChannel(ep.channel ?? 'default').sayVoice; } catch { /* unknown channel */ }
  return env.SAY_VOICE || v || 'Samantha';
}

/** Channel voiceId wins over ELEVENLABS_VOICE_ID. */
export function pickVoiceId(ep: Episode, env: NodeJS.ProcessEnv = process.env): string | undefined {
  let id: string | undefined;
  try { id = loadChannel(ep.channel ?? 'default').voiceId; } catch { /* unknown channel: env fallback */ }
  return id || env.ELEVENLABS_VOICE_ID;
}

export class ElevenLabsTTS implements TTSAdapter {
  name = 'eleven';
  async synthesize(ep: Episode, outDir: string): Promise<Timings> {
    const key = process.env.ELEVENLABS_API_KEY;
    const voice = pickVoiceId(ep);
    if (!key || !voice) throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env');
    fs.mkdirSync(`${outDir}audio`, {recursive: true});
    let t = LEAD_IN;
    const scenes: SceneTiming[] = [];
    for (const [index, s] of ep.scenes.entries()) {
      const file = `${outDir}audio/scene-${index + 1}.mp3`;
      const cache = `${file}.json`;
      let data: {audio_base64: string; alignment: {characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[]}};
      if (fs.existsSync(file) && fs.existsSync(cache)) {
        data = JSON.parse(fs.readFileSync(cache, 'utf8')); // re-runs don't spend credits
      } else {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
          body: JSON.stringify({text: s.narration, model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2'}),
        });
        if (!res.ok) throw new Error(`ElevenLabs scene ${index + 1}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        data = await res.json();
        fs.writeFileSync(file, Buffer.from(data.audio_base64, 'base64'));
        fs.writeFileSync(cache, JSON.stringify({alignment: data.alignment, audio_base64: ''}));
      }
      const {characters: ch, character_start_times_seconds: cs, character_end_times_seconds: ce} = data.alignment;
      const words: WordTiming[] = [];
      let cur: {w: string; start: number; end: number} | null = null;
      ch.forEach((c, i) => {
        if (/\s/.test(c)) { if (cur) words.push(cur); cur = null; return; }
        if (!cur) cur = {w: '', start: round(t + cs[i]), end: 0};
        cur.w += c; cur.end = round(t + ce[i]);
      });
      if (cur) words.push(cur);
      const end = Math.max((words.at(-1)?.end ?? t) + 0.05, t + MIN_SCENE);
      scenes.push({index, start: round(t), end: round(end), audioFile: file, words});
      t = end + SCENE_GAP;
    }
    return {engine: this.name, fps: FPS, total: round(t), scenes};
  }
}

export class LocalRecordingTTS implements TTSAdapter {
  name = 'local';
  /** aligner: undefined = auto-detect, null = force proportional fallback (tests). */
  constructor(private aligner?: AlignerName | null) {}
  async synthesize(ep: Episode, outDir: string): Promise<Timings> {
    const found = ep.scenes.map((_, i) => {
      const base = `${outDir}audio/scene-${i + 1}`;
      return ['wav', 'mp3', 'm4a'].map(e => `${base}.${e}`).find(f => fs.existsSync(f)) ?? null;
    });
    const missing = found.flatMap((f, i) => (f ? [] : [`${outDir}audio/scene-${i + 1}.(wav|mp3|m4a)`]));
    if (missing.length) throw new Error(`Missing recording(s): ${missing.join(', ')}`);
    const aligner = this.aligner === undefined ? detectAligner() : this.aligner;
    if (!aligner) console.warn('WARNING: no aligner found (whisper-cli / whisperx / whisper). Using proportional word timing; captions will be approximate.');
    let t = LEAD_IN;
    const scenes: SceneTiming[] = [];
    for (const [index, s] of ep.scenes.entries()) {
      const file = found[index]!;
      const dur = probeDuration(file);
      let rel: RelWord[] = [];
      if (aligner) rel = mapToNarration(s.narration, runAligner(aligner, file));
      if (!rel.length) rel = proportionalWords(s.narration, 0, dur);
      const words = rel.map(w => ({w: w.w, start: round(t + w.start), end: round(t + w.end)}));
      const end = Math.max(t + dur + 0.05, t + MIN_SCENE);
      scenes.push({index, start: round(t), end: round(end), audioFile: file, words});
      t = end + SCENE_GAP;
    }
    return {engine: this.name, fps: FPS, total: round(t), scenes};
  }
}

/** Free macOS voice: `say` -> aiff -> mp3 (ffmpeg), proportional word timing. */
export class SayTTS implements TTSAdapter {
  name = 'say';
  async synthesize(ep: Episode, outDir: string): Promise<Timings> {
    const voice = pickSayVoice(ep);
    if (spawnSync('sh', ['-c', 'command -v say'], {stdio: 'ignore'}).status !== 0) {
      throw new Error('The macOS `say` command was not found. The say engine only works on macOS; use --engine silent or eleven.');
    }
    fs.mkdirSync(`${outDir}audio`, {recursive: true});
    const aligner = detectAligner();
    let t = LEAD_IN;
    const scenes: SceneTiming[] = [];
    for (const [index, s] of ep.scenes.entries()) {
      const file = `${outDir}audio/scene-${index + 1}.mp3`;
      const aiff = `${outDir}audio/scene-${index + 1}.aiff`;
      const r = spawnSync('say', ['-v', voice, '-o', aiff, '--', s.narration], {encoding: 'utf8'});
      if (r.error || r.status !== 0) throw new Error(`say failed on scene ${index + 1} (voice "${voice}"): ${(r.stderr || r.error?.message || '').slice(0, 200)}. List voices with: say -v '?'`);
      const c = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', aiff, '-af', TRIM_AF, '-ar', '44100', '-codec:a', 'libmp3lame', '-q:a', '4', file], {encoding: 'utf8'});
      fs.rmSync(aiff, {force: true});
      if (c.error || c.status !== 0) throw new Error(`ffmpeg failed on scene ${index + 1}: ${(c.stderr || c.error?.message || '').slice(0, 200)}`);
      const dur = probeDuration(file);
      let rel: RelWord[] = [];
      if (aligner) { try { rel = mapToNarration(s.narration, runAligner(aligner, file, 'en')); } catch (e) { console.warn(`Aligner failed on scene ${index + 1}, using proportional timing: ${(e as Error).message.slice(0, 120)}`); } }
      if (!rel.length) rel = proportionalWords(s.narration, 0, dur);
      const words = rel.map(w => ({w: w.w, start: round(t + w.start), end: round(t + w.end)}));
      const end = Math.max(t + dur + 0.05, t + MIN_SCENE);
      scenes.push({index, start: round(t), end: round(end), audioFile: file, words});
      t = end + SCENE_GAP;
    }
    return {engine: this.name, fps: FPS, total: round(t), scenes};
  }
}

const hasBin = (b: string) => spawnSync('sh', ['-c', `command -v "${b}"`], {stdio: 'ignore'}).status === 0;
export const piperBin = () => (process.env.PIPER_BIN && hasBin(process.env.PIPER_BIN) ? process.env.PIPER_BIN : hasBin('piper') ? 'piper' : null);
export const piperAvailable = () => !!piperBin() && !!process.env.PIPER_MODEL && fs.existsSync(process.env.PIPER_MODEL);

/** Keyless Linux voices: espeak-ng or piper -> wav -> mp3 (ffmpeg); whisper-aligned or proportional word timing. */
export class CliTTS implements TTSAdapter {
  constructor(public name: 'espeak-ng' | 'piper') {}
  private speak(text: string, wav: string) {
    if (this.name === 'piper') return spawnSync(piperBin()!, ['--model', process.env.PIPER_MODEL!, '--output_file', wav], {input: text, encoding: 'utf8', timeout: 120000});
    return spawnSync('espeak-ng', ['-v', process.env.ESPEAK_VOICE || 'en-us', '-s', process.env.ESPEAK_SPEED || '155', '-w', wav, '--', text], {encoding: 'utf8', timeout: 120000});
  }
  async synthesize(ep: Episode, outDir: string): Promise<Timings> {
    if (this.name === 'piper' ? !piperAvailable() : !hasBin('espeak-ng')) {
      throw new Error(this.name === 'piper' ? 'piper not found: set PIPER_BIN (or put piper on PATH) and PIPER_MODEL to a .onnx voice.' : 'espeak-ng not found. Install it (apt install espeak-ng) or use --engine silent.');
    }
    fs.mkdirSync(`${outDir}audio`, {recursive: true});
    const aligner = detectAligner();
    let t = LEAD_IN;
    const scenes: SceneTiming[] = [];
    for (const [index, s] of ep.scenes.entries()) {
      const file = `${outDir}audio/scene-${index + 1}.mp3`;
      const wav = `${outDir}audio/scene-${index + 1}.wav`;
      const r = this.speak(s.narration, wav);
      if (r.error || r.status !== 0) throw new Error(`${this.name} failed on scene ${index + 1}: ${(r.stderr || r.error?.message || '').slice(0, 200)}`);
      const c = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', TRIM_AF, '-ar', '44100', '-codec:a', 'libmp3lame', '-q:a', '4', file], {encoding: 'utf8'});
      fs.rmSync(wav, {force: true});
      if (c.error || c.status !== 0) throw new Error(`ffmpeg failed on scene ${index + 1}: ${(c.stderr || c.error?.message || '').slice(0, 200)}`);
      const dur = probeDuration(file);
      let rel: RelWord[] = [];
      if (aligner) { try { rel = mapToNarration(s.narration, runAligner(aligner, file, 'en')); } catch (e) { console.warn(`Aligner failed on scene ${index + 1}, using proportional timing: ${(e as Error).message.slice(0, 120)}`); } }
      if (!rel.length) rel = proportionalWords(s.narration, 0, dur);
      const words = rel.map(w => ({w: w.w, start: round(t + w.start), end: round(t + w.end)}));
      const end = Math.max(t + dur + 0.05, t + MIN_SCENE);
      scenes.push({index, start: round(t), end: round(end), audioFile: file, words});
      t = end + SCENE_GAP;
    }
    return {engine: this.name, fps: FPS, total: round(t), scenes};
  }
}

/** Default engine: say on macOS, piper/espeak-ng on Linux, else silent. */
export function autoEngineName(): string {
  if (process.platform === 'darwin' && hasBin('say')) return 'say';
  if (piperAvailable()) return 'piper';
  if (hasBin('espeak-ng')) return 'espeak-ng';
  return hasBin('say') ? 'say' : 'silent';
}

export function getEngine(name: string): TTSAdapter {
  switch (name) {
    case 'auto': return getEngine(autoEngineName());
    case 'silent': return new SilentTTS();
    case 'eleven': return new ElevenLabsTTS();
    case 'local': return new LocalRecordingTTS();
    case 'say': return new SayTTS();
    case 'espeak-ng': case 'piper': return new CliTTS(name);
    default: throw new Error(`Unknown TTS engine: ${name}`);
  }
}

export function writeTimings(dir: string, t: Timings) {
  fs.mkdirSync(`${dir}build`, {recursive: true});
  fs.writeFileSync(`${dir}build/timings.json`, JSON.stringify(t, null, 2));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
