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
