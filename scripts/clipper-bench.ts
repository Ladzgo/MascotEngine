// Clipper benchmark on synthetic multi-speaker video (macOS `say`, 3 voices, moving busy background).
// Usage: tsx scripts/clipper-bench.ts [workdir]. Prints cut quality and crop smoothness; no network, no paid API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {detectAligner, probeDuration, runAligner} from '../src/pipeline/align.js';
import {findCandidates, normalizeWords} from '../src/clipper/segment.js';
import {snapClip, loadEnergy, quietThreshold} from '../src/clipper/snap.js';
import {cropPath, cropWidth, sampleTrack} from '../src/clipper/crop.js';

const dir = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'clipbench-'));
fs.mkdirSync(dir, {recursive: true});
const sh = (bin: string, args: string[]) => { const r = spawnSync(bin, args, {encoding: 'utf8'}); if (r.status !== 0) throw new Error(`${bin} failed: ${r.stderr.slice(-300)}`); };

const PARA = [
  'Why do most people stay broke? Nobody tells you the truth about money. People spend first and save whatever is left. That never works, because there is never anything left. So pay yourself first, then live on the rest.',
  'Let me give you a real example. Imagine you earn three thousand dollars a month. If you save ten percent, that is three hundred dollars. Over twenty years at seven percent, that grows to more than one hundred and fifty thousand dollars.',
  'Now, what about debt? Credit cards charge around twenty percent interest. That is a brutal number. Paying off a card is a guaranteed return that beats almost any investment. So kill the expensive debt first.',
];
const VOICES = ['Samantha', 'Daniel', 'Karen'];
const X = [250, 640, 1030]; // speaker box left edge (1280x720 source), centre = X + 70
const ROUNDS = 2, GAP = 0.6;

// 1. audio: 6 turns (A B C A B C), silence between turns; ground truth = who speaks when
const turns: {voice: number; start: number; end: number; file: string}[] = [];
let t = 0;
for (let r = 0; r < ROUNDS; r++) for (let v = 0; v < 3; v++) {
  const f = path.join(dir, `t${turns.length}.wav`);
  sh('say', ['-v', VOICES[v], '-r', '175', '-o', path.join(dir, 'x.aiff'), PARA[(v + r) % 3]]);
  sh('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'x.aiff'), '-ar', '16000', '-ac', '1', f]);
  const d = probeDuration(f);
  turns.push({voice: v, start: t, end: t + d, file: f}); t += d + GAP;
}
const total = t;
const list = turns.map((x, i) => `file '${x.file}'\n${i < turns.length - 1 ? `file '${path.join(dir, 'gap.wav')}'\n` : ''}`).join('');
sh('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=16000:cl=mono`, '-t', String(GAP), path.join(dir, 'gap.wav')]);
fs.writeFileSync(path.join(dir, 'list.txt'), list);
sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', path.join(dir, 'speech.wav')]);

// 2. video: busy moving background (testsrc2, dimmed) + skin-coloured speaker box that jumps to the active speaker and bobs while talking
const xExpr = turns.map(x => `between(t,${x.start.toFixed(2)},${(x.end + GAP).toFixed(2)})*${X[x.voice]}`).join('+');
const video = path.join(dir, 'bench.mp4');
sh('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=s=1280x720:r=25:d=${total.toFixed(1)},eq=brightness=-0.25:saturation=0.4`, '-f', 'lavfi', '-i', `color=c=0xe0a880:s=140x180:r=25:d=${total.toFixed(1)}`, '-i', path.join(dir, 'speech.wav'),
  '-filter_complex', `[0][1]overlay=x='${xExpr}':y='250+12*sin(t*9)'`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video]);

// 3. pipeline
if (detectAligner() !== 'whisper-cli') throw new Error('whisper-cli + model needed');
const words = normalizeWords(runAligner('whisper-cli', video).map(r => ({w: r.w, start: r.start, end: r.end})));
const dur = probeDuration(video);
const cands = findCandidates(words, {min: 10, max: 30, count: 6}, dur).map(c => ({...c, ...snapClip(video, c.start, c.end)}));

// 4. cut quality
let endsClosed = 0, quietEnd = 0, quietStart = 0;
for (const c of cands) {
  if (/[.!?]["')\]]*$/.test(c.words.at(-1)!.w)) endsClosed++;
  const a = loadEnergy(video, c.start, c.end), th = quietThreshold(a.rms);
  if (Math.max(...a.rms.slice(-4)) < th) quietEnd++;
  if (Math.max(...a.rms.slice(0, 3)) < th || c.start === 0) quietStart++;
}

// 5. crop smoothness vs ground truth
const W = 1280, H = 720, cw = cropWidth(W, H);
const rows: string[] = [];
let errSum = 0, errN = 0, jerkSum = 0, jerkN = 0, maxSpeed = 0, reversals = 0;
for (const c of cands) {
  const path_ = cropPath(sampleTrack(video, c.start, c.end, W, H), W, cw);
  const speaker = (tt: number) => turns.find(x => tt >= x.start && tt <= x.end + GAP)?.voice ?? 0;
  const xs = Array.from({length: Math.floor((c.end - c.start) * 5)}, (_, i) => {
    const tt = i / 5; let k = 0; while (k < path_.length - 2 && path_[k + 1].t < tt) k++;
    const a = path_[k], b = path_[k + 1] ?? a, f = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
    return {tt, x: a.x + (b.x - a.x) * Math.min(1, Math.max(0, f))};
  });
  // error = distance of the crop centre from the speaker centre, ignoring 3 s after each speaker change (the follower is rate limited by design)
  for (const p of xs) {
    const abs = c.start + p.tt, tr = turns.find(x => abs >= x.start && abs <= x.end + GAP);
    if (!tr || abs - tr.start < 3) continue;
    errSum += Math.abs(p.x + cw / 2 - (X[speaker(abs)] + 70)); errN++;
  }
  for (let i = 1; i < xs.length; i++) maxSpeed = Math.max(maxSpeed, Math.abs(xs[i].x - xs[i - 1].x) * 5);
  for (let i = 2; i < xs.length; i++) { jerkSum += Math.abs(xs[i].x - 2 * xs[i - 1].x + xs[i - 2].x) * 25; jerkN++; if ((xs[i].x - xs[i - 1].x) * (xs[i - 1].x - xs[i - 2].x) < -0.5) reversals++; }
  rows.push(`  ${c.start.toFixed(1)}-${c.end.toFixed(1)}s knots ${path_.length}`);
}
const out = {clips: cands.length, endsClosed, quietEnd, quietStart, trackErrPx: +(errSum / Math.max(1, errN)).toFixed(0), meanJerkPxS2: +(jerkSum / Math.max(1, jerkN)).toFixed(1), maxSpeedPxS: +maxSpeed.toFixed(0), maxAllowedPxS: Math.round(0.35 * cw), reversals, cropWidth: cw};
console.log(rows.join('\n'));
console.log(JSON.stringify(out, null, 1));
