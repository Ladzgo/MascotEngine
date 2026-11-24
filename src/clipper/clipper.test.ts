import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findCandidates, normalizeWords, toSentences} from './segment.js';
import {smoothPath, ffmpegXExpr, type Pt} from './smooth.js';
import {centroidX, cropPath, cropWidth, trackFrames} from './crop.js';
import {TimelineSchema, type Word} from './timeline.js';

// synthetic transcript: sentences with 0.1 s word gaps, 0.8 s pauses between sentences
function transcript(sents: string[], wordDur = 0.4): Word[] {
  const out: Word[] = [];
  let t = 1;
  for (const s of sents) {
    for (const w of s.split(' ')) { out.push({w, start: t, end: t + wordDur}); t += wordDur + 0.1; }
    t += 0.7;
  }
  return out;
}
const S = [
  'Why do 90 percent of startups fail?',
  'Because they never talk to a single customer before building.',
  'That is a huge mistake and it costs millions.',
  'And so they run out of money',
  'Here is what the best founders do instead of guessing.',
  'They talk to ten people every single week without fail.',
  'It sounds simple but almost nobody actually does it.',
];

test('sentences split on punctuation and pauses; stray punctuation merged', () => {
  const ws = normalizeWords([{w: 'Hi', start: 0, end: 0.2}, {w: '.', start: 0.2, end: 0.25}, {w: 'there', start: 0.3, end: 0.5}]);
  assert.deepEqual(ws.map(w => w.w), ['Hi.', 'there']);
  const s = toSentences(transcript(S));
  assert.equal(s.length, S.length); // 'And so ... money' split by pause only
  assert.equal(s[3].closed, false);
});

test('candidates start/end on sentence boundaries, padded 0.15-0.3, never half a thought', () => {
  const ws = transcript(S);
  const cs = findCandidates(ws, {min: 8, max: 25, count: 3}, 100);
  assert.ok(cs.length > 0);
  const startsOk = new Set(toSentences(ws).map(s => s.words[0].start));
  for (const c of cs) {
    const first = c.words[0], last = c.words.at(-1)!;
    assert.ok(startsOk.has(first.start));
    assert.match(last.w, /[.!?]$/);
    const padB = first.start - c.start, padA = c.end - last.end;
    for (const p of [padB, padA]) assert.ok(p >= 0.15 - 1e-9 && p <= 0.3 + 1e-9, `pad ${p}`);
    const d = c.end - c.start;
    assert.ok(d >= 8 && d <= 25);
  }
  for (let i = 1; i < cs.length; i++) assert.ok(cs[i].start >= cs[i - 1].end);
  assert.ok(cs[0].words[0].w === 'Why' || cs.some(c => c.words[0].w === 'Why'), 'question hook ranked in');
});

test('smoothPath: spike removed, deadband holds, speed limited, clamped', () => {
  const pts: Pt[] = Array.from({length: 41}, (_, i) => ({t: i / 4, x: 100 + (i === 20 ? 400 : 0) + (i % 2 ? 2 : -2)}));
  const sm = smoothPath(pts, {deadband: 5, maxSpeed: 50, min: 0, max: 1000});
  assert.ok(sm.every(p => Math.abs(p.x - 100) < 6), 'jitter+spike ignored');
  const jump: Pt[] = [{t: 0, x: 100}, {t: 2, x: 100}, {t: 2.01, x: 900}, {t: 6, x: 900}];
  const j = smoothPath(jump, {maxSpeed: 100, min: 0, max: 1000});
  for (let i = 1; i < j.length; i++) assert.ok(Math.abs(j[i].x - j[i - 1].x) <= 100 * 0.1 + 1e-6, 'no sudden jump');
  assert.ok(j.at(-1)!.x > j[0].x);
  assert.ok(smoothPath(jump, {maxSpeed: 1e6, min: 0, max: 500}).every(p => p.x <= 500));
  assert.deepEqual(smoothPath([], {maxSpeed: 1}), []);
});

test('synthetic crop path: moving blob is followed smoothly inside bounds', () => {
  const W = 96, H = 54, hz = 4, n = 40;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const f = new Uint8Array(W * H);
    const cx = i < 20 ? 24 : 72; // speaker switches side at 5 s
    for (let y = 10; y < 40; y++) for (let x = cx - 6 + (i % 2); x < cx + 6 + (i % 2); x++) f[y * W + x] = 200;
    frames.push(f);
  }
  const c = centroidX(frames[0], frames[1], W, H);
  assert.ok(c.x < 0.4);
  const track = trackFrames(frames, W, H, hz);
  const srcW = 1920, cw = cropWidth(srcW, 1080);
  assert.equal(cw, 606);
  const path = cropPath(track, srcW, cw);
  assert.ok(path.every(p => p.x >= 0 && p.x <= srcW - cw));
  for (let i = 1; i < path.length; i++) assert.ok(Math.abs(path[i].x - path[i - 1].x) <= 0.35 * cw * 0.5 + 1, 'speed limit');
  assert.ok(path[2].x < srcW / 2 - cw / 2 && path.at(-1)!.x > srcW / 2 - cw / 2, 'follows speaker');
  assert.match(ffmpegXExpr(path), /^\d+/);
});

test('timeline schema validates and rejects bad clips', () => {
  const clip = {id: 'c1', start: 1, end: 5, score: 3, reasons: [], text: 'hi', words: [{w: 'hi', start: 1, end: 1.2}], crop: {w: 606, h: 1080, path: [{t: 0, x: 10}]}};
  const tl = {version: 1, source: '/a.mp4', width: 1920, height: 1080, clips: [clip]};
  assert.ok(TimelineSchema.parse(tl));
  assert.throws(() => TimelineSchema.parse({...tl, clips: [{...clip, end: 0.5}]}));
  assert.throws(() => TimelineSchema.parse({...tl, clips: [{...clip, crop: {...clip.crop, path: []}}]}));
});

import {snapCut} from './snap.js';
test('snapCut moves an end onto the following silence and a start onto the preceding one', () => {
  // frames: speech 0-1.0 s, silence 1.0-1.4 s, speech 1.4-2.0 s
  const rms = Array.from({length: 200}, (_, i) => (i >= 100 && i < 140 ? 0.0005 : 0.1));
  const e = {t0: 0, rms};
  const end = snapCut(e, 0.98, 'end');
  assert.ok(end >= 1.0 && end <= 1.3, `end ${end}`);
  const start = snapCut(e, 1.42, 'start');
  assert.ok(start >= 1.1 && start <= 1.4, `start ${start}`);
  assert.equal(snapCut({t0: 0, rms: rms.map(() => 0.1)}, 1, 'end'), 1); // no silence -> unchanged
});

test('background filter: a constantly flashing far-right light does not pull the track off a slow speaker', () => {
  const W = 96, H = 54, hz = 4, n = 60;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const f = new Uint8Array(W * H);
    for (let y = 10; y < 40; y++) for (let x = 20 + (i % 4 < 2 ? 0 : 1); x < 32 + (i % 4 < 2 ? 0 : 1); x++) f[y * W + x] = 200; // speaker, motion every 2nd frame
    if (i % 2) for (let y = 5; y < 25; y++) for (let x = 84; x < 94; x++) f[y * W + x] = 255; // blinking light
    frames.push(f);
  }
  const raw = frames.slice(1).map((f, i) => centroidX(frames[i], f, W, H).x);
  assert.ok(raw.every(x => x > 0.5), 'unfiltered, the light dominates');
  const t = trackFrames(frames, W, H, hz);
  assert.ok(t.slice(4).every(p => p.x < 0.45), 'filtered track stays on the speaker');
});

test('crop path: jumping track is rate-limited, jitter inside the deadband holds still', () => {
  const srcW = 1920, cw = 606;
  const jump: Pt[] = Array.from({length: 80}, (_, i) => ({t: i / 4, x: i % 2 ? 0.85 : 0.15}));
  const p = cropPath(jump, srcW, cw);
  for (let i = 1; i < p.length; i++) assert.ok(Math.abs(p[i].x - p[i - 1].x) / (p[i].t - p[i - 1].t) <= 0.35 * cw + 5, 'max speed');
  const jitter: Pt[] = Array.from({length: 80}, (_, i) => ({t: i / 4, x: 0.5 + (i % 2 ? 0.004 : -0.004)}));
  const q = cropPath(jitter, srcW, cw);
  assert.ok(Math.max(...q.map(r => r.x)) - Math.min(...q.map(r => r.x)) <= 2, 'deadband holds');
});

import {captionChunks} from '../ClipCaptions.js';
test('captionChunks: <=3 words, contiguous, visible while spoken', () => {
  const ws = Array.from({length: 10}, (_, i) => ({w: i === 4 ? 'infrastructure' : 'word' + i, start: i * 0.4, end: i * 0.4 + 0.3}));
  const ch = captionChunks(ws);
  assert.equal(ch.flatMap(c => c.words).length, 10);
  assert.ok(ch.every(c => c.words.length <= 3 && c.to > c.from));
  for (const w of ws) assert.ok(ch.some(c => w.start + 0.1 >= c.from && w.start + 0.1 < c.to), `word at ${w.start} uncovered`);
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i].from >= ch[i - 1].to - 1e-9, 'no overlap');
});

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {snapClip} from './snap.js';
test('snapClip on real audio: cuts land inside the silent gap (1.0-1.6 s)', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')), 't.wav');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-af', "volume=enable='between(t,1,1.6)':volume=0", f]);
  assert.equal(r.status, 0);
  const s = snapClip(f, 0.4, 0.98 + 0.0); // end near the start of the gap
  assert.ok(s.end >= 1.0 && s.end <= 1.6, `end ${s.end}`);
  const t = snapClip(f, 1.62, 2.8); // start just after the gap
  assert.ok(t.start >= 1.0 && t.start <= 1.62, `start ${t.start}`);
  fs.rmSync(path.dirname(f), {recursive: true, force: true});
});

test('person blob: motion of the densest skin cluster wins over louder skin-coloured clutter and non-skin motion', () => {
  const W = 96, H = 54, a = new Uint8Array(W * H), b = new Uint8Array(W * H), skin = new Uint8Array(W * H);
  for (let y = 10; y < 30; y++) for (let x = 10; x < 24; x++) { skin[y * W + x] = 1; a[y * W + x] = 100; b[y * W + x] = y < 12 ? 100 : 100 + (x < 12 ? 60 : 0); } // person, small motion
  for (let y = 40; y < 43; y++) for (let x = 80; x < 90; x++) { skin[y * W + x] = 1; b[y * W + x] = 255; } // skin-coloured clutter, bigger change but sparse
  for (let y = 0; y < H; y++) for (let x = 50; x < 70; x++) b[y * W + x] = 255; // non-skin background motion
  const r = centroidX(a, b, W, H, 12, undefined, skin);
  assert.ok(r.x < 0.3 && r.conf > 0, `x ${r.x}`);
  // person present but motionless -> hold (conf 0), no pull from the background
  const still = centroidX(a, a.map((v, i) => (i % W >= 50 && i % W < 70 ? 255 : v)), W, H, 12, undefined, skin);
  assert.equal(still.conf, 0);
});

import {whisperLang} from './lang.js';
test('whisperLang: en for .en models, auto for multilingual, errors on mismatch or junk', () => {
  assert.equal(whisperLang('/m/ggml-base.en.bin'), 'en');
  assert.equal(whisperLang('/m/ggml-base.bin'), 'auto');
  assert.equal(whisperLang('/m/ggml-small.bin', 'HU'), 'hu');
  assert.equal(whisperLang('/m/ggml-base.en.bin', 'en'), 'en');
  assert.throws(() => whisperLang('/m/ggml-base.en.bin', 'hu'), /English-only/);
  assert.throws(() => whisperLang('/m/ggml-base.bin', 'hu; rm'), /--lang must be/);
});

test('captionLayout keeps a gap wider than stroke + pop and fits the safe width', async () => {
  const {captionLayout} = await import('../ClipCaptions.js');
  for (const ws of [['I', 'QUIT', 'MY'], ['CHICKENS', 'EVERYWHERE', 'NOW'], ['ELSŐ', 'MILLIÓ', 'FORINT']]) {
    const {size, gap} = captionLayout(ws.map(w => ({w, start: 0, end: 1})));
    assert.ok(gap >= size * (0.16 + 0.08 * 2) + 1);
    const width = ws.reduce((a, w) => a + w.length * 0.84 * size * 1.08, 0) + gap * (ws.length - 1);
    assert.ok(width <= 960, `${ws} ${width}`);
  }
});
