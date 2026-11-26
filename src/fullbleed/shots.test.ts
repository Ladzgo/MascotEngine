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
test('punch captions: at most four words, punch word only on every 4th number-ish phrase', () => {
  const ph = buildPunchPhrases([words('Over sixty months that is about three thousand eight hundred dollars in interest.')]);
  assert.ok(ph.every(p => p.words.length <= 4));
  assert.equal(punchWord(ph[0], 1), undefined);
});

import {candidatesFor} from './shots.js';
test('word -> object relevance: minimums are bills, not clocks; money words offer several objects', () => {
  assert.ok(candidatesFor('minimums').includes('receipts') && !candidatesFor('minimums').includes('clock'));
  assert.ok(candidatesFor('money').length >= 2);
  assert.deepEqual(candidatesFor('the'), []);
});

test('punch chunks: number+unit stay together, no chunk ends on a function word', () => {
  const ph = buildPunchPhrases([words('It takes eighteen years to pay off two thousand dollars at the typical rate.')]).map(p => p.words.map(w => w.w).join(' '));
  assert.ok(ph.some(p => /eighteen years/.test(p)), ph.join(' | '));
  assert.ok(!ph.some(p => /\b(to|the|at)$/.test(p)), ph.join(' | '));
  assert.ok(ph.some(p => /two thousand dollars/.test(p)), ph.join(' | '));
});
test('debt object only for debt narration; generic objects need literal words', () => {
  const n = 'Prices rise every year, so plan ahead.', s = planShots(sc(n), words(n), 5);
  assert.ok(!s.some(x => x.kind === 'debt_counter'));
  assert.ok(!s.some(x => ['clock', 'people', 'bulb'].includes(x.kind)));
  const d = 'You owe a lot on that loan.';
  assert.equal(planShots(sc(d), words(d), 5)[0].kind, 'debt_counter');
});
