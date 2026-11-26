import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {episodeDir, loadEpisode} from '../../src/schema.js';
import {checkShots} from '../../src/draft/storyboard.js';
import {SCORE_FAIL_BELOW, scoreScript} from '../../src/draft/score.js';
import {planShots} from '../../src/fullbleed/shots.js';
import {buildPhrases} from '../../src/fx/captions.js';
import {activeRmsDb} from '../../src/pipeline/audio.js';

/** Thresholds (documented in docs/QA.md). */
export const LIMITS = {
  lufs: [-16, -12.5], truePeak: -1.0, lra: 14,
  maxPause: 1.5, pauseShare: 0.25, // voice track: longest silence, silence / total
  blankStd: 4, marginEdge: 0.12, captionEdge: 0.02, captionCover: 0.9,
  minSec: 45, maxSec: 20 * 60, shortSec: [15, 62], shortWpm: [150, 175], shortChange: 3, wideChange: 6, // Shorts: duration, speaking pace, seconds per visual change
  preRoll: [0.15, 1.0], outro: 0.5, sceneSpreadDb: 4, // voice: first word start (s), silence after the last word (s), max level gap between scenes (dB)
};
export type Check = {name: string; ok: boolean; value: string; limit?: string};

const run = (bin: string, args: string[], opts: {raw?: boolean} = {}) => {
  const r = spawnSync(bin, args, {maxBuffer: 1 << 28});
  return {code: r.status, out: r.stdout, err: String(r.stderr)};
};

/** Silence segments from ffmpeg silencedetect stderr. */
export function parseSilence(log: string): {start: number; end: number}[] {
  const out: {start: number; end: number}[] = [];
  let s = -1;
  for (const l of log.split('\n')) {
    const a = l.match(/silence_start: (-?[\d.]+)/), b = l.match(/silence_end: ([\d.]+)/);
    if (a) s = Math.max(0, +a[1]);
    if (b && s >= 0) { out.push({start: s, end: +b[1]}); s = -1; }
  }
  return out;
}

/** Silence before the first and after the last speech, from a silencedetect log (an unterminated final silence runs to `total`). */
export function edgeSilence(log: string, total: number): {lead: number; tail: number} {
  let lead = 0, tail = 0, open = -1;
  for (const l of log.split('\n')) {
    const a = l.match(/silence_start: (-?[\d.]+)/), b = l.match(/silence_end: ([\d.]+)/);
    if (a) open = Math.max(0, +a[1]);
    if (b && open === 0) lead = +b[1];
    if (b && open > 0 && +b[1] >= total - 0.05) tail = total - open; // ffmpeg closes a trailing silence with an end at EOF
    if (b) open = -1;
  }
  if (open >= 0) tail = total - open;
  return {lead, tail};
}

/** Active speech level (dB RMS) per scene from the voice track samples. */
export function sceneLevels(voice: Float32Array, sr: number, scenes: {startSec: number; durSec: number}[]): number[] {
  return scenes.map(d => activeRmsDb(voice.subarray(Math.floor(d.startSec * sr), Math.floor((d.startSec + d.durSec) * sr)))).filter(Number.isFinite);
}

/** Pause stats between speech: leading/trailing silence is ignored. */
export function pauseStats(sil: {start: number; end: number}[], total: number) {
  const mid = sil.filter(x => x.start > 0.3 && x.end < total - 0.3);
  const durs = mid.map(x => x.end - x.start);
  const sum = durs.reduce((a, b) => a + b, 0);
  return {count: mid.length, max: Math.max(0, ...durs), avg: durs.length ? sum / durs.length : 0, share: total ? sum / total : 0};
}

/** Share of pixels whose gradient is strong, within a rectangle (fractions of the frame) of a gray image. */
export function edgeDensity(g: Uint8Array, w: number, h: number, r: {x0: number; x1: number; y0: number; y1: number}, thr = 40): number {
  let n = 0, e = 0;
  for (let y = Math.max(1, Math.floor(r.y0 * h)); y < Math.min(h - 1, Math.ceil(r.y1 * h)); y++)
    for (let x = Math.max(1, Math.floor(r.x0 * w)); x < Math.min(w - 1, Math.ceil(r.x1 * w)); x++) {
      n++;
      if (Math.abs(g[y * w + x + 1] - g[y * w + x - 1]) + Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x]) > thr) e++;
    }
  return n ? e / n : 0;
}
export const stdDev = (g: Uint8Array) => { let m = 0; for (const v of g) m += v; m /= g.length; let s = 0; for (const v of g) s += (v - m) ** 2; return Math.sqrt(s / g.length); };

/** Fraction of speech seconds covered by a visible caption phrase (same window the renderer uses). */
export function captionCoverage(words: {start: number; end: number}[], phrases: {start: number; end: number}[]): number {
  let tot = 0, cov = 0;
  for (const w of words) {
    const d = w.end - w.start; if (d <= 0) continue;
    tot += d;
    const mid = (w.start + w.end) / 2;
    if (phrases.some(p => mid >= p.start - 0.05 && mid <= p.end + 0.35)) cov += d;
  }
  return tot ? cov / tot : 1;
}

export function loudness(file: string) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const m = r.err.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) throw new Error('loudness measurement failed');
  const j = JSON.parse(m[0]);
  return {lufs: parseFloat(j.input_i), tp: parseFloat(j.input_tp), lra: parseFloat(j.input_lra)};
}

function gray(file: string, t: number, w: number, h: number): Uint8Array {
  const r = run('ffmpeg', ['-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  if (r.code !== 0 || r.out.length < w * h) throw new Error(`no frame at ${t.toFixed(1)}s`);
  return new Uint8Array(r.out.subarray(0, w * h));
}

export function qa(id: string, fileArg?: string) {
  const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
  const file = fileArg ?? [`${b}${ep.id}-final.mp4`, `${b}${ep.id}-preview.mp4`].find(f => fs.existsSync(f));
  if (!file) throw new Error(`no rendered video in ${b} (run render first)`);
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, value: string, limit?: string) => checks.push({name, ok, value, limit});
  const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${b}timings.json`, 'utf8'));

  const dur = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).out.toString().trim();
  const short = ep.format === 'short'; // vertical Shorts have their own limits (docs/REFERENCE-ANALYSIS.md)
  const [dMin, dMax] = short ? LIMITS.shortSec : [LIMITS.minSec, LIMITS.maxSec];
  add('duration', dur >= dMin && dur <= dMax, `${dur.toFixed(1)} s`, `${dMin}-${dMax} s`);
  const hasAudio = run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file]).out.length > 0;
  add('audio stream', hasAudio, hasAudio ? 'yes' : 'missing');

  const newest = Math.max(...['decisions.json', 'timings.json'].map(f => fs.statSync(`${b}${f}`).mtimeMs));
  add('render is current', fs.statSync(file).mtimeMs >= newest, fs.statSync(file).mtimeMs >= newest ? 'newer than decisions/timings' : 'video is OLDER than decisions.json/timings.json: re-render before judging the rest');

  const L = loudness(file);
  add('loudness', L.lufs >= LIMITS.lufs[0] && L.lufs <= LIMITS.lufs[1], `${L.lufs} LUFS`, `${LIMITS.lufs[0]}..${LIMITS.lufs[1]}`);
  add('true peak', L.tp <= LIMITS.truePeak, `${L.tp} dBTP`, `<= ${LIMITS.truePeak}`);
  add('loudness range', L.lra <= LIMITS.lra, `${L.lra} LU`, `<= ${LIMITS.lra}`);

  const voice = fs.existsSync(`${b}voice.wav`) ? `${b}voice.wav` : file; // speech only, music would hide the gaps
  const sil = parseSilence(run('ffmpeg', ['-hide_banner', '-nostats', '-i', voice, '-vn', '-af', 'silencedetect=n=-38dB:d=0.35', '-f', 'null', '-']).err);
  const vdur = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice]).out.toString().trim();
  const P = pauseStats(sil, vdur);
  add('longest pause', P.max <= LIMITS.maxPause, `${P.max.toFixed(2)} s (${P.count} pauses, avg ${P.avg.toFixed(2)})`, `<= ${LIMITS.maxPause} s`);
  add('pause share', P.share <= LIMITS.pauseShare, `${(P.share * 100).toFixed(1)}%`, `<= ${LIMITS.pauseShare * 100}%`);

  // reference targets (docs/REFERENCE-ANALYSIS.md): 140-180 words per minute of speech, a new visual idea every <= 6 s on average
  const nWords = dec.scenes.reduce((a: number, _: any, i: number) => a + tim.scenes[i].words.length, 0);
  const wpm = nWords / Math.max(1, vdur * (1 - P.share)) * 60;
  const [wLo, wHi] = short ? LIMITS.shortWpm : [140, 180];
  add('speaking pace', wpm >= wLo && wpm <= wHi, `${wpm.toFixed(0)} wpm`, `${wLo}..${wHi} wpm`);
  // a visual change = every shot the renderer plans inside a scene (src/fullbleed/shots.ts), or one per scene for the paper look
  const changes = ep.look === 'fullbleed'
    ? ep.scenes.reduce((a, sc, i) => { const d = dec.scenes[i], t0 = tim.scenes[i].start; return a + planShots(sc as any, tim.scenes[i].words.map((w: any) => ({w: w.w, start: w.start - t0 + d.speechStart, end: w.end - t0 + d.speechStart})), d.durSec, {seed: i}).length; }, 0)
    : ep.scenes.length;
  const perChange = dur / Math.max(1, changes), cap = short ? LIMITS.shortChange : LIMITS.wideChange;
  add('visual change rate', perChange <= cap, `a new visual every ${perChange.toFixed(1)} s (${changes} changes)`, `<= ${cap} s`);
  const longest = Math.max(...dec.scenes.map((d: any) => d.durSec)), longCap = short ? 5 : 12;
  add('longest scene', longest <= longCap, `${longest.toFixed(1)} s`, `<= ${longCap} s`);
  const edge = edgeSilence((run('ffmpeg', ['-hide_banner', '-nostats', '-i', voice, '-vn', '-af', 'silencedetect=n=-38dB:d=0.1', '-f', 'null', '-']).err), vdur);
  add('pre-roll', edge.lead >= LIMITS.preRoll[0] && edge.lead <= LIMITS.preRoll[1], `${edge.lead.toFixed(2)} s before the first word`, `${LIMITS.preRoll[0]}..${LIMITS.preRoll[1]} s`);
  add('outro silence', voice === file || edge.tail >= LIMITS.outro, // with no voice.wav the music bed fills the tail: not measurable
    voice === file ? 'not measured (no voice.wav)' : `${edge.tail.toFixed(2)} s after the last word`, `>= ${LIMITS.outro} s`);
  const pcm = run('ffmpeg', ['-v', 'error', '-i', voice, '-f', 's16le', '-ac', '1', '-ar', '16000', '-']).out;
  const lv = sceneLevels(Float32Array.from(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2)), x => x / 32768), 16000, dec.scenes);
  const spread = lv.length ? Math.max(...lv) - Math.min(...lv) : 0;
  add('scene loudness spread', spread <= LIMITS.sceneSpreadDb, `${spread.toFixed(1)} dB between scenes`, `<= ${LIMITS.sceneSpreadDb} dB`);

  // captions vs speech (data) and in real frames (at the middle of spoken words)
  const sceneWords = dec.scenes.map((d: any, i: number) => tim.scenes[i].words.map((w: any) => ({w: w.w, start: d.startSec + w.start - tim.scenes[i].start + d.speechStart, end: d.startSec + w.end - tim.scenes[i].start + d.speechStart})));
  const words = sceneWords.flat();
  const cov = captionCoverage(words, buildPhrases(sceneWords));
  add('caption coverage', cov >= LIMITS.captionCover, `${(cov * 100).toFixed(1)}% of speech`, `>= ${LIMITS.captionCover * 100}%`);

  const W = short ? 180 : 320, H = short ? 320 : 180, probe = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).out.toString().trim().split(',').map(Number);
  const marginBand = [{x0: 0, x1: 0.02, y0: 0, y1: 1}, {x0: 0.98, x1: 1, y0: 0, y1: 1}];
  const probes = [0.1, 0.3, 0.5, 0.7, 0.9].map(p => {
    const target = dur * p, w = words.reduce((a: any, x: any) => (Math.abs((x.start + x.end) / 2 - target) < Math.abs((a.start + a.end) / 2 - target) ? x : a), words[0]);
    return (w.start + w.end) / 2;
  });
  const bad: string[] = [];
  probes.forEach(t => {
    const g = gray(file, t, W, H);
    if (stdDev(g) < LIMITS.blankStd) bad.push(`${t.toFixed(1)}s blank`);
    const m = short ? 0 : Math.max(...marginBand.map(r => edgeDensity(g, W, H, r))); // full-bleed Shorts touch the edges by design
    if (m > LIMITS.marginEdge) bad.push(`${t.toFixed(1)}s content touches the side margin (${(m * 100).toFixed(0)}%)`);
    const c = edgeDensity(g, W, H, short ? {x0: 0.05, x1: 0.95, y0: 0.62, y1: 0.86} : {x0: 0.1, x1: 0.9, y0: 0.86, y1: 0.99});
    if (c < LIMITS.captionEdge) bad.push(`${t.toFixed(1)}s caption zone empty during speech`);
  });
  add('frames @10/30/50/70/90%', !bad.length, bad.length ? bad.join('; ') : short ? 'not blank, captions visible (Shorts lower third)' : 'not blank, margins clear, captions visible', `size ${probe.join('x')}`);

  const script = scoreScript(ep);
  add('script score', script.total >= SCORE_FAIL_BELOW, `${script.total}/100 (${script.items.map(i => `${i.name} ${i.got}/${i.max}`).join(', ')})`, `>= ${SCORE_FAIL_BELOW}`);
  if (ep.scenes.some(s => s.shot)) { const se = checkShots(ep); add('storyboard', !se.length, se.length ? se.slice(0, 3).join('; ') : 'subjects vary, actions vary, numbers from the script'); }
  const ok = checks.every(c => c.ok);
  const report = {id: ep.id, file, at: new Date().toISOString(), ok, checks, loudness: L, pauses: P, script};
  fs.writeFileSync(`${b}qa.json`, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('qa.ts')) {
  const id = process.argv[2];
  if (!id || id.startsWith('-')) { console.error('Usage: npm run qa -- <episode-id> [--file video.mp4]'); process.exit(2); }
  const fi = process.argv.indexOf('--file');
  try {
    const r = qa(id, fi > 0 ? process.argv[fi + 1] : undefined);
    for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} ${c.value}${c.limit ? `  [${c.limit}]` : ''}`);
    console.log(`\nQA ${r.ok ? 'OK' : 'FAILED'}: ${r.checks.filter(c => !c.ok).length} failing of ${r.checks.length} (build/qa.json)`);
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(`QA error: ${(e as Error).message}`); process.exit(2); }
}
