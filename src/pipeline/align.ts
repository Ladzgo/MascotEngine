import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type RelWord = {w: string; start: number; end: number};
export type AlignerName = 'whisper-cli' | 'whisperx' | 'whisper';

const has = (bin: string) => spawnSync('sh', ['-c', `command -v ${bin}`], {stdio: 'ignore'}).status === 0;

const ROOT = new URL('../../', import.meta.url).pathname;
/** ggml model for whisper.cpp: WHISPER_MODEL, else data/models/ggml-base.en.bin (free download from huggingface.co/ggerganov/whisper.cpp). */
export function whisperModel(): string | null {
  const m = process.env.WHISPER_MODEL || `${ROOT}data/models/ggml-base.en.bin`;
  return fs.existsSync(m) ? m : null;
}

/** First installed aligner, or null. Nothing is ever installed automatically. whisper.cpp only counts when a model file exists. */
export function detectAligner(): AlignerName | null {
  if ((has('whisper-cli') || has('whisper-cpp')) && whisperModel()) return 'whisper-cli';
  if (has('whisperx')) return 'whisperx';
  if (has('whisper')) return 'whisper';
  return null;
}

export function probeDuration(file: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], {encoding: 'utf8'});
  const d = parseFloat(out);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`Cannot read duration of ${file}`);
  return d;
}

const tokenize = (t: string) => t.split(/\s+/).filter(Boolean);
const weightOf = (w: string) => Math.max(3, w.replace(/\W/g, '').length) + (/[.,!?;:]$/.test(w) ? 3 : 0);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Spread narration words over [from, to] by length weight (same idea as SilentTTS). */
export function proportionalWords(narration: string, from: number, to: number): RelWord[] {
  const toks = tokenize(narration);
  const ws = toks.map(weightOf);
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  let cur = from;
  return toks.map((w, i) => {
    const d = (ws[i] / sum) * (to - from);
    const o = {w, start: r3(cur), end: r3(cur + d)};
    cur += d;
    return o;
  });
}

/** Map recognised words onto narration tokens: 1:1 when counts match, else proportional over the spoken span. */
export function mapToNarration(narration: string, rec: RelWord[]): RelWord[] {
  const toks = tokenize(narration);
  if (!rec.length) return [];
  if (rec.length === toks.length) return toks.map((w, i) => ({w, start: r3(rec[i].start), end: r3(rec[i].end)}));
  // hyphenated words ("get-rich-quick" vs "get rich quick"): compare at the level of hyphen-free atoms
  const split = (w: string) => w.split(/[-\u2013\u2014/]+/).filter(Boolean);
  const recAtoms = rec.flatMap(r => { const a = split(r.w); const n = Math.max(1, a.length); return Array.from({length: n}, (_, k) => ({start: r.start + (r.end - r.start) * k / n, end: r.start + (r.end - r.start) * (k + 1) / n})); });
  const counts = toks.map(t => Math.max(1, split(t).length));
  if (recAtoms.length === counts.reduce((a, b) => a + b, 0)) {
    let k = 0;
    return toks.map((w, i) => { const a = recAtoms[k], b = recAtoms[k + counts[i] - 1]; k += counts[i]; return {w, start: r3(a.start), end: r3(b.end)}; });
  }
  return proportionalWords(narration, rec[0].start, rec[rec.length - 1].end);
}

function sh(bin: string, args: string[]) {
  const r = spawnSync(bin, args, {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(`${bin} failed: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
}

/** Run the aligner; returns recognised words relative to the start of the recording. */
export function runAligner(name: AlignerName, file: string, language?: string): RelWord[] {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'align-'));
  try {
    if (name === 'whisper-cli') {
      const model = whisperModel();
      if (!model) throw new Error('whisper.cpp needs a ggml model: set WHISPER_MODEL=/path/to/ggml-*.bin');
      const wav = path.join(tmp, 'in.wav');
      sh('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ar', '16000', '-ac', '1', wav]);
      const bin = has('whisper-cli') ? 'whisper-cli' : 'whisper-cpp';
      sh(bin, ['-m', model, '-f', wav, '-ml', '1', '-sow', '-oj', '-of', path.join(tmp, 'out'), ...(language ? ['-l', language] : [])]);
      const j = JSON.parse(fs.readFileSync(path.join(tmp, 'out.json'), 'utf8'));
      return (j.transcription as {text: string; offsets: {from: number; to: number}}[])
        .filter(s => s.text.trim() && !/^\[.*\]$/.test(s.text.trim()))
        .map(s => ({w: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000}));
    }
    const model = process.env.WHISPER_MODEL_NAME ?? 'small';
    const args = name === 'whisperx'
      ? [file, '--model', model, '--output_format', 'json', '--output_dir', tmp, '--compute_type', 'int8', '--device', 'cpu']
      : [file, '--model', model, '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', tmp];
    if (language) args.push('--language', language);
    sh(name, args);
    const jf = fs.readdirSync(tmp).find(f => f.endsWith('.json'));
    if (!jf) throw new Error(`${name} produced no JSON`);
    const j = JSON.parse(fs.readFileSync(path.join(tmp, jf), 'utf8'));
    const out: RelWord[] = [];
    for (const seg of j.segments ?? []) for (const w of seg.words ?? []) {
      if (typeof w.start === 'number' && typeof w.end === 'number') out.push({w: String(w.word).trim(), start: w.start, end: w.end});
    }
    return out;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
