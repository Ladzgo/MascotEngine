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
