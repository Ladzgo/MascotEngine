import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Episode, loadEpisode} from './schema.js';

const scene = {type: 'talk', narration: 'hi'};
const ep = (scenes: unknown[]) => ({id: 'x-1', title: 't', scenes});

test('both episodes load', () => {
  for (const id of ['ep001-inflation', 'ep002-compound-interest']) {
    const e = loadEpisode(id);
    assert.equal(e.id, id);
    assert.ok(e.scenes.length > 0);
  }
  assert.equal(loadEpisode('ep001').id, 'ep001-inflation');
});

test('chart labels/values mismatch rejected', () => {
  const bad = {type: 'chart', narration: 'n', chart: {kind: 'line', labels: ['a', 'b', 'c'], values: [1, 2]}};
  assert.throws(() => Episode.parse(ep([bad])), /length mismatch/);
  const ok = {type: 'chart', narration: 'n', chart: {kind: 'bar', labels: ['a', 'b'], values: [1, 2]}};
  assert.doesNotThrow(() => Episode.parse(ep([ok])));
});

test('unknown scene type rejected', () => {
  assert.throws(() => Episode.parse(ep([{type: 'banana', narration: 'n'}])));
  assert.doesNotThrow(() => Episode.parse(ep([scene])));
});

test('on-screen numbers come from file', () => {
  const e = loadEpisode('ep001-inflation');
  const bn = e.scenes.find(s => s.type === 'big_number');
  assert.ok(bn && bn.type === 'big_number');
  assert.equal(bn.value, 7441);
  const ch = e.scenes.find(s => s.type === 'chart');
  assert.ok(ch && ch.type === 'chart');
  assert.equal(ch.chart.values.at(-1), 7441);
});

test('parseDecisions accepts a director output and rejects overlapping scenes', async () => {
  const {parseDecisions} = await import('./schema.js');
  const sc = (i: number, startSec: number) => ({index: i, type: 'talk', layout: 'a', charSide: 'left', pose: 'neutral', camera: 'static', transition: 'cut', startSec, durSec: 2, speechStart: -0.2, speechEnd: 1.5, punchIns: [], sfx: [], elements: []});
  const d = {episodeId: 'x', seed: 0, accent: 'blue', background: 'plain', captionStyle: 'bar', intro: 'pop', music: {mood: 'calm', track: null}, totalSec: 4, scenes: [sc(0, 0), sc(1, 2)]};
  assert.equal(parseDecisions(JSON.stringify(d)).scenes.length, 2);
  assert.throws(() => parseDecisions(JSON.stringify({...d, scenes: [sc(0, 0), sc(1, 1)]})), /before the previous/);
});

test('talk scene accepts an optional quote, rejects an overlong one', () => {
  assert.ok(Episode.safeParse(ep([{...scene, quote: {text: 'Short line.', by: 'Someone'}}])).success);
  assert.ok(!Episode.safeParse(ep([{...scene, quote: {text: 'x'.repeat(141)}}])).success);
});
