import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chunkKeys, chunkRanges} from './renderCache.js';

const L = {froms: [0, 60, 150], ends: [60, 150, 240]};
test('chunkRanges: contiguous scene chunks + end card; gaps fall back to null', () => {
  const r = chunkRanges(L, 300, true)!;
  assert.deepEqual(r.map(x => [x.from, x.to]), [[0, 59], [60, 149], [150, 239], [240, 299]]);
  assert.equal(chunkRanges({froms: [0, 70], ends: [60, 150]}, 150, false), null);
  assert.equal(chunkRanges(L, 240, false)!.length, 3);
});

test('chunkKeys: editing a scene invalidates it and its neighbours, a far scene with the same frames stays cached', () => {
  const mk = (txt: string) => ({
    episode: {title: 't', scenes: [{n: 'a'}, {n: txt}, {n: 'c'}, {n: 'd'}]},
    decisions: {accent: 'x', scenes: [{p: 0}, {p: 1}, {p: 2}, {p: 3}]},
    timings: {fps: 30, scenes: [{w: 0}, {w: 1}, {w: 2}, {w: 3}]},
  });
  const ranges = chunkRanges({froms: [0, 60, 150, 240], ends: [60, 150, 240, 300]}, 300, false)!;
  const a = chunkKeys({ranges, ...mk('b'), code: 'c1', mode: 'preview'}), b = chunkKeys({ranges, ...mk('B!'), code: 'c1', mode: 'preview'});
  assert.deepEqual(a.map((k, i) => k === b[i]), [false, false, false, true]);
  assert.notEqual(chunkKeys({ranges, ...mk('b'), code: 'c2', mode: 'preview'})[3], a[3], 'code change invalidates all');
  assert.notEqual(chunkKeys({ranges, ...mk('b'), code: 'c1', mode: 'final'})[3], a[3]);
});

test('chunkKeys with a layout: lengthening scene 1 keeps scenes 3+ cached even though they start later', () => {
  const mk = (len: number) => {
    const froms = [0, 60, 60 + len, 150 + len], ends = [60, 60 + len, 150 + len, 210 + len];
    const sc = (i: number, extra = {}) => ({startSec: froms[i] / 30, speechStart: 0.1, ...extra});
    const tm = (i: number) => ({start: froms[i] / 30, end: ends[i] / 30, words: [{w: 'a', start: froms[i] / 30 + 0.5, end: froms[i] / 30 + 0.9}]});
    return {
      layout: {froms, ends, starts: froms, ts: [0, 0, 0, 0]},
      episode: {title: 't', scenes: [{n: 'a'}, {n: 'b' + len}, {n: 'c'}, {n: 'd'}]},
      decisions: {accent: 'x', totalSec: (210 + len) / 30, scenes: [sc(0), sc(1, {durSec: len / 30}), sc(2), sc(3)]},
      timings: {fps: 30, scenes: [tm(0), tm(1), tm(2), tm(3)]},
    };
  };
  const key = (len: number) => { const m = mk(len); return chunkKeys({ranges: chunkRanges(m.layout, m.layout.ends[3], false)!, ...m, code: 'c', mode: 'preview'}); };
  const a = key(90), b = key(120);
  assert.deepEqual(a.map((k, i) => k === b[i]), [false, false, false, true]);
});
