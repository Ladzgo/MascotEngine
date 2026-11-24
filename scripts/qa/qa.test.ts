import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captionCoverage, edgeDensity, parseSilence, pauseStats, stdDev} from './qa.js';

test('parseSilence + pauseStats ignore leading/trailing silence', () => {
  const log = 'silence_start: 0\nsilence_end: 0.4 | silence_duration: 0.4\nsilence_start: 5.0\nsilence_end: 6.2 | silence_duration: 1.2\nsilence_start: 9.5\nsilence_end: 10 | silence_duration: 0.5';
  const s = parseSilence(log);
  assert.equal(s.length, 3);
  const p = pauseStats(s, 10);
  assert.equal(p.count, 1);
  assert.ok(Math.abs(p.max - 1.2) < 1e-9 && Math.abs(p.share - 0.12) < 1e-9);
});

test('edgeDensity finds a bar in a region, stdDev flags blank frames', () => {
  const w = 100, h = 50, g = new Uint8Array(w * h).fill(200);
  assert.ok(stdDev(g) < 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) g[y * w + x] = 0; // black bar at the left edge
  assert.ok(edgeDensity(g, w, h, {x0: 0, x1: 0.05, y0: 0, y1: 1}) > 0.3);
  assert.equal(edgeDensity(g, w, h, {x0: 0.5, x1: 1, y0: 0, y1: 1}), 0);
});

test('captionCoverage counts words inside phrase windows', () => {
  const words = [{start: 0, end: 1}, {start: 1, end: 2}, {start: 5, end: 6}];
  assert.equal(captionCoverage(words, [{start: 0, end: 2}]), 2 / 3);
});

test('edgeSilence reads pre-roll and an unterminated outro; sceneLevels gates silence', async () => {
  const {edgeSilence, sceneLevels} = await import('./qa.js');
  const log = 'silence_start: 0\nsilence_end: 0.31 | silence_duration: 0.31\nsilence_start: 5.2\nsilence_end: 5.9\nsilence_start: 9.4';
  const e = edgeSilence(log, 10);
  assert.ok(Math.abs(e.lead - 0.31) < 1e-9 && Math.abs(e.tail - 0.6) < 1e-9);
  assert.deepEqual(edgeSilence('silence_start: 5\nsilence_end: 6', 10), {lead: 0, tail: 0});
  const v = new Float32Array(1000).map((_, i) => (i < 500 ? 0.2 * Math.sin(i) : 0));
  assert.equal(sceneLevels(v, 100, [{startSec: 0, durSec: 5}, {startSec: 5, durSec: 5}]).length, 1);
});
