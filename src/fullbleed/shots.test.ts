import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planShots, objectFor} from './shots.js';
import {buildPunchPhrases, punchWord} from '../fx/punch.js';

const words = (t: string) => t.split(' ').map((w, i) => ({w, start: i * 0.5, end: i * 0.5 + 0.4}));
const sc = (n: string, extra: any = {}) => ({narration: n, emphasis: [], emotion: 'neutral', ...extra});

test('shots switch on the spoken keyword, 1.5 s apart, never the same object twice', () => {
  const n = 'Your car loan adds interest every month and the bank keeps the difference for years';
  const s = planShots(sc(n), words(n), 8);
  assert.equal(s[0].at, 0);
  assert.ok(s.length >= 2 && s.length <= 4);
  s.forEach((x, i) => { if (i) { assert.ok(x.at - s[i - 1].at >= 1.5); assert.notEqual(x.kind, s[i - 1].kind); } });
});
test('explicit visuals use the keyword time; unknown kinds fall back; skip avoids repeating the previous object', () => {
  const n = 'Seven percent interest costs a lot';
  const s = planShots(sc(n, {visuals: [{kind: 'car'}, {kind: 'percent', at: 'percent'}]}), words(n), 4);
  assert.deepEqual(s.map(x => [x.kind, x.at]), [['car', 0], ['percent', 0.5]]);
  assert.equal(objectFor('nonsense'), 'coin_stacks');
  assert.notEqual(planShots(sc('hello there'), words('hello there'), 3, {skip: 'percent'})[0].kind, 'percent');
});
test('punch captions: at most three words, punch word only on every 4th number-ish phrase', () => {
  const ph = buildPunchPhrases([words('Over sixty months that is about three thousand eight hundred dollars in interest.')]);
  assert.ok(ph.every(p => p.words.length <= 3));
  assert.equal(punchWord(ph[0], 1), undefined);
});

import {candidatesFor} from './shots.js';
test('word -> object relevance: minimums are bills, not clocks; money words offer several objects', () => {
  assert.ok(candidatesFor('minimums').includes('receipts') && !candidatesFor('minimums').includes('clock'));
  assert.ok(candidatesFor('money').length >= 2);
  assert.deepEqual(candidatesFor('the'), []);
});
