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

import {SUBJECTS, ACTIONS, GROUPS} from './catalog.js';
import {OBJECTS} from './objects.js';
import {actionCopies} from './actions.js';
test('catalog stays in sync with the renderer; 60+ subjects, 30+ actions; groups only name real subjects', () => {
  assert.ok(SUBJECTS.length >= 60 && ACTIONS.length >= 30, `${SUBJECTS.length} subjects, ${ACTIONS.length} actions`);
  for (const s of SUBJECTS) assert.ok(OBJECTS[s], `no renderer for subject ${s}`);
  for (const g of Object.values(GROUPS)) for (const s of g) assert.ok((SUBJECTS as readonly string[]).includes(s), `group names unknown subject ${s}`);
  for (const a of ACTIONS) { const r = actionCopies(a, 1.3); assert.ok(r.copies.length >= 1 && r.copies.every(c => Number.isFinite(c.tx + c.ty + c.sc + c.rot + c.op)), a); }
});

import {planEpisode} from './episodePlan.js';
test('variety engine: no subject within 6 beats, no setting/camera/layout twice in a row, explicit shot wins', () => {
  const texts = ['You pay interest on a loan every month.', 'Savings grow when you wait.', 'Rates rise and prices follow.', 'Your card balance keeps growing.', 'Stocks can drop fast.', 'A budget keeps spending in check.', 'Interest on debt snowballs quickly.', 'Savings in a bank are safe.', 'The loan has fees.', 'Inflation eats savings.'];
  const scenes = texts.map(n => ({type: 'talk', narration: n, emphasis: [], emotion: 'neutral'})) as any[];
  scenes[3].shot = {subject: 'anchor', action: 'sink', setting: 'street'};
  const plan = planEpisode(scenes, scenes.map(s => words(s.narration)), scenes.map(() => 4));
  assert.equal(plan[3].shots[0].kind, 'anchor'); assert.equal(plan[3].shots[0].action, 'sink'); assert.equal(plan[3].env, 'street');
  plan.forEach((p, i) => {
    if (i) { assert.notEqual(p.env, plan[i - 1].env, `env repeats at ${i}`); assert.notEqual(p.camera, plan[i - 1].camera); assert.notEqual(p.layout, plan[i - 1].layout, `layout repeats at ${i}`); assert.notEqual(p.pal, plan[i - 1].pal); }
    const prior = plan.slice(Math.max(0, i - 6), i).flatMap(q => q.shots.map(x => x.kind));
    p.shots.forEach(sh => { if (i !== 3) assert.ok(!prior.includes(sh.kind), `${sh.kind} repeats within 6 beats at ${i}`); });
  });
  assert.ok(new Set(plan.map(p => p.layout)).size >= 3);
  // backdrops: none repeats within 8 drawn beats (ep011 showed the city three times)
  plan.forEach((p, i) => { if (i !== 3) assert.ok(!plan.slice(Math.max(0, i - 7), i).some((q, k) => q.env === p.env && Math.max(0, i - 7) + k !== 3), `env ${p.env} repeats within 8 at ${i}`); });
});

import {median, reselect} from './reselect.js';
test('reselect: weak stock beat loses its stock, weak drawn beat gets another subject, good beats untouched; median', () => {
  const ep = {scenes: [{narration: 'Run in the morning', stock: {query: 'x'}, shot: {subject: 'coin_stacks'}}, {narration: 'Your heart gets stronger', shot: {subject: 'coin_stacks'}}, {narration: 'fine', shot: {subject: 'trophy'}}]};
  const r = reselect(ep, [{scene: 1, score: 2}, {scene: 2, score: 3}, {scene: 3, score: 9}]);
  assert.equal(r.ep.scenes[0].stock, undefined); assert.equal(r.ep.scenes[1].shot!.subject, 'heart'); assert.equal(r.ep.scenes[2].shot!.subject, 'trophy');
  assert.equal(median([1, 9, 5, 7]), 6);
});

test('shot.at: the subject lands on its spoken word, later shots stay ordered', () => {
  const w = (t: string) => t.split(' ').map((x, i) => ({w: x, start: i * 0.4, end: i * 0.4 + 0.3}));
  const n = 'Every morning your heart pumps more blood';
  const p = planEpisode([{narration: n, emphasis: [], emotion: 'neutral', type: 'talk', shot: {subject: 'heart', action: 'pulse', at: 'heart'}}], [w(n)], [5]);
  assert.equal(p[0].shots[0].kind, 'heart'); assert.ok(Math.abs(p[0].shots[0].at - 1.2) < 1e-6);
  p[0].shots.forEach((s, i) => { if (i) assert.ok(s.at > p[0].shots[i - 1].at); });
});

import {planStats} from './episodePlan.js';
test('planStats: plain share, distinct pictures and closest repeat', () => {
  const pl = (k: string, layout = 'hero') => ({env: 'city', pal: 0, camera: 0, zoom: 'wide', layout, shots: [{kind: k, at: 0, action: 'pop_in'}]}) as any;
  const st = planStats([pl('a'), pl('b'), pl('a', 'split'), pl('c')], [{type: 'talk'}, {type: 'talk', stock: 1}, {type: 'talk'}, {type: 'chart'}]);
  assert.equal(st.plainShare, 0.25); assert.equal(st.distinct, 0.75); assert.equal(st.minRepeatGap, 2); assert.equal(st.stockShare, 0.25);
});

test('punch chunks follow sense units, not a fixed 3-word window', () => {
  const ph = (t: string) => buildPunchPhrases([words(t)]).map(p => p.words.map(w => w.w).join(' '));
  assert.deepEqual(ph('One coffee costs $5. A year of them costs $1,825.'), ['One coffee costs $5.', 'A year of them', 'costs $1,825.']);
  assert.deepEqual(ph('That single cup habit quietly eats your yearly budget.'), ['That single cup habit', 'quietly eats', 'your yearly budget.']);
});
