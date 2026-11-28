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
  assert.ok(ph.some(p => /\$2,000/.test(p)), ph.join(' | ')); // spoken number words come back as one numeral token
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
  scenes[3].shot = {subject: 'house', action: 'sink', setting: 'street'}; // (a statement picture like 'anchor' is honoured only when the sentence says it)
  const plan = planEpisode(scenes, scenes.map(s => words(s.narration)), scenes.map(() => 4));
  assert.equal(plan[3].shots[0].kind, 'house'); assert.equal(plan[3].shots[0].action, 'sink'); assert.equal(plan[3].env, 'street');
  plan.forEach((p, i) => {
    if (i) { assert.notEqual(p.env, plan[i - 1].env, `env repeats at ${i}`); assert.notEqual(p.camera, plan[i - 1].camera); if (!p.matchCut) assert.notEqual(p.layout, plan[i - 1].layout, `layout repeats at ${i}`); assert.notEqual(p.pal, plan[i - 1].pal); }
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
  const sc = {narration: n, emphasis: [], emotion: 'neutral', type: 'talk', shot: {subject: 'heart', action: 'pulse', at: 'heart'}}, title = {narration: 'Hook line.', emphasis: [], emotion: 'neutral', type: 'talk'};
  const q = planEpisode([title, sc], [w('Hook line.'), w(n)], [3, 5]), p = [q[1]];
  assert.equal(p[0].shots[0].kind, 'heart'); assert.ok(Math.abs(p[0].shots[0].at - 1.2) < 1e-6);
  p[0].shots.forEach((s, i) => { if (i) assert.ok(s.at > p[0].shots[i - 1].at); });
  assert.equal(planEpisode([sc], [w(n)], [5])[0].shots[0].at, 0); // the hook beat shows its picture on frame 0
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

test('fitText: whole words only, fits the box, hook key is the number or longest content word', async () => {
  const {fitText} = await import('./kit');
  const {hookKey} = await import('./FullBleedScene');
  const r = fitText('COLD DRAINS YOUR BATTERY FAST', 900, 460, 194, 1);
  assert.equal(r.lines.join(' '), 'COLD DRAINS YOUR BATTERY FAST');
  assert.ok(r.lines.length * r.fs <= 460 && Math.max(...r.lines.map(l => l.length)) * r.fs * 0.8 <= 900);
  assert.equal(hookKey('Stop charging in freezing temps'), 'charging');
  assert.equal(hookKey('Why 600 mAh loss? Not just cold'), '600');
});

test('punch cadence: at most one punch word per 6.5 s', async () => {
  const {punchSchedule, PUNCH_GAP} = await import('../fx/punch.js');
  const ph = Array.from({length: 20}, (_, i) => ({start: i * 1.5, end: i * 1.5 + 1.2, words: [{w: 'thousands', start: i * 1.5, end: i * 1.5 + 0.5}]}));
  const s = [...punchSchedule(ph)].map(i => ph[i].start);
  assert.ok(s.length >= 3 && s.every((t, k) => !k || t - s[k - 1] >= PUNCH_GAP));
});

test('reselect: a swap is kept only when its re-score rises', async () => {
  const {keepImproved, changedBeats} = await import('./reselect.js');
  const before = {scenes: [{narration: 'a', shot: {subject: 'lock'}}, {narration: 'b', shot: {subject: 'clock'}}, {narration: 'c'}]};
  const after = {scenes: [{narration: 'a', shot: {subject: 'bus'}}, {narration: 'b', shot: {subject: 'battery'}}, {narration: 'c'}]};
  assert.deepEqual(changedBeats(before, after), [0, 1]);
  const r = keepImproved(before, after, new Map([[0, 5], [1, 5]]), new Map([[0, 3], [1, 7]]));
  assert.deepEqual(r.kept, [1]); assert.deepEqual(r.reverted, [0]);
  assert.equal(r.ep.scenes[0].shot?.subject, 'lock'); assert.equal(r.ep.scenes[1].shot?.subject, 'battery');
});

test('tech notification: system app name and a short first-clause line', async () => {
  const {notice} = await import('./FullBleedScene');
  assert.deepEqual(notice('So stop charging your phone in the freezing cold.'), {app: 'Battery', text: 'Stop charging your phone in the freezing cold.'});
  assert.deepEqual(notice('Cold screens lag, forcing you to tap twice.'), {app: 'Settings', text: 'Cold screens lag.'});
});

test('match cut: same silhouette in a row cuts hard and keeps the framing', async () => {
  const {markMatchCuts} = await import('./episodePlan.js');
  const p = (kind: string, zoom: 'wide' | 'close') => ({env: 'room', pal: 0, camera: 0, zoom, layout: 'hero', shots: [{kind, at: 0, action: 'pop_in'}]}) as any;
  const plans = [p('battery', 'wide'), p('thermometer', 'close'), p('clock', 'wide')];
  markMatchCuts(plans, [{type: 'talk'}, {type: 'talk'}, {type: 'talk'}]);
  assert.equal(plans[1].matchCut, true); assert.equal(plans[1].zoom, 'wide'); assert.equal(plans[2].matchCut, undefined);
});

test('uncross: leader lines from a left column never cross', async () => {
  const {uncross} = await import('./FullBleedScene');
  assert.deepEqual(uncross([[0, 0], [0, 10]], [[10, 10], [10, 0]]), [1, 0]);
});

test('concept hero: charge -> plug, freezing -> snowflake, repeats avoided', async () => {
  const {conceptHero} = await import('./episodePlan.js');
  assert.equal(conceptHero("Don't charge in cold.", new Set())?.kind, 'asset:fluent-electric-plug');
  assert.equal(conceptHero('So stop charging your phone in the freezing cold.', new Set(['asset:fluent-electric-plug']))?.kind, 'asset:fluent-snowflake');
  assert.equal(conceptHero('Prices went up.', new Set()), undefined);
});

test('kinetic headline never a bare small number', async () => {
  const {kineticWord} = await import('./FullBleedScene');
  assert.equal(kineticWord('That is a 2 dollar surcharge per basket.', []), 'surcharge');
  assert.equal(kineticWord('It costs $1,825 a year.', []), '$1,825');
});

test('screen numbers and bare verbs', async () => {
  const {screenNumber, isBareVerb} = await import('../fx/punch.js');
  const {kineticWord} = await import('./FullBleedScene');
  assert.equal(screenNumber('$10000000'), '$10M'); assert.equal(screenNumber('1825'), '1,825'); assert.equal(screenNumber('2024'), '2024'); assert.equal(screenNumber('1500000000'), '1.5B');
  assert.ok(isBareVerb('CREATES') && isBareVerb('keeping') && !isBareVerb('pressure') && !isBareVerb('windows'));
  assert.equal(kineticWord('A broken pane can cost $10,000,000.', []), '$10M');
  assert.notEqual(kineticWord('That gap creates huge stress on the window.', []).toLowerCase(), 'creates');
});

test('kinetic headline: a number label beats a spelled-out number', async () => {
  const {kineticWord} = await import('./FullBleedScene');
  assert.equal(kineticWord('It creates a seven point four psi gap to manage.', [], '7.4 psi'), '7.4 psi');
});

test('kinetic headline: no connectives, dollar labels as $', async () => {
  const {kineticWord} = await import('./FullBleedScene');
  assert.notEqual(kineticWord('Follow Money Myths, because the reason you lose money isn’t what you think.', []).toLowerCase(), 'because');
  assert.equal(kineticWord('A 2 dollars surcharge per basket.', [], '2 dollars'), '$2');
});

test('reselect: dropping stock is kept on a tie', async () => {
  const {keepImproved} = await import('./reselect.js');
  const before = {scenes: [{narration: 'a', stock: {query: 'x'}}]}, after = {scenes: [{narration: 'a'}]};
  assert.deepEqual(keepImproved(before as any, after as any, new Map([[0, 5]]), new Map([[0, 5]])).kept, [0]);
  assert.deepEqual(keepImproved(before as any, after as any, new Map([[0, 5]]), new Map([[0, 3]])).kept, []);
});

test('captions: spoken number words become one numeral token', async () => {
  const {numeralWords} = await import('../fx/punch.js');
  const w = (t: string) => t.split(' ').map((x, i) => ({w: x, start: i, end: i + 0.5}));
  const r = numeralWords(w('You could spend one thousand eight hundred twenty five dollars a year.'));
  assert.equal(r.map(x => x.w).join(' '), 'You could spend $1,825 a year.');
  assert.equal(r[3].start, 3); assert.equal(r[3].end, 9.5);
  assert.equal(numeralWords(w('It lasts ten days.')).map(x => x.w).join(' '), 'It lasts ten days.');
});

test('homographs never pick a literal picture: prices rose (no flower), camel train (no dumbbell)', async () => {
  const {objectAsset} = await import('./assetPick.js');
  assert.equal(objectAsset('prices on average rose perhaps sixfold'), undefined);
  assert.ok(!'a king with a camel train'.split(' ').flatMap(candidatesFor).includes('dumbbell'));
});
test('16:9 stock rule: score >= 7 full-frame alone, <= 5 a drawn hero, Shorts unchanged', () => {
  const mk = (score: number) => ({type: 'talk', narration: 'Savings in a bank are safe.', emphasis: [], emotion: 'neutral', stockFile: 'a.mp4', stockScore: score, shot: {subject: 'bank'}});
  const sc3 = [mk(8), mk(4), mk(6)], ws = sc3.map(s => words(s.narration));
  const wide = planEpisode(sc3, ws, [4, 4, 4], {wide: true}), tall = planEpisode(sc3, ws, [4, 4, 4]);
  assert.deepEqual(wide.map(p => [p.layout, !!p.noStock]), [['broll', false], ['hero', true], ['pip', false]]);
  assert.deepEqual(tall.map(p => p.layout), ['pip', 'pip', 'pip']);
});
test('named things pick a specific picture before topic/money symbols', async () => {
  const {entityHero} = await import('./entities.js');
  const k = (t: string) => entityHero(t)?.kind;
  assert.equal(k('Hyperinflation in Venezuela reached 833,997% in 2018.'), 'flag:venezuela');
  assert.equal(entityHero("Venezuela's inflation rate hit 833,997%.")?.headline, '833,997%');
  assert.equal(k('A year later, your $100 could buy you a mere $50 worth of goods.'), 'tags:$100|$50');
  assert.equal(k('If you had 100 dollars, it would be worth only 50 dollars the next year.'), 'tags:$100|$50');
  assert.equal(k('Imagine a king traveling with a camel train the size of a city.'), 'asset:fluent-person-with-crown');
  assert.equal(k('Even in the 16th century, prices in Europe rose sixfold.'), 'asset:fluent-globe-showing-europe-africa');
  assert.equal(k('From 2013 to 2023, the inflation rate was about 130%.'), 'arrow_up');
  assert.equal(k('Roast the turkey and let us eat.'), undefined); // the bird, the pronoun
  assert.equal(k('That is a 43% loss to inflation.'), undefined);
  const n = 'Hyperinflation in Venezuela reached 833,997% in 2018.', p = planEpisode([{type: 'talk', narration: n, emphasis: [], emotion: 'neutral', shot: {subject: 'coin_stacks'}}], [words(n)], [4]);
  assert.equal(p[0].shots[0].kind, 'flag:venezuela'); assert.equal(p[0].headline, '833,997%');
  assert.ok((await import('./assetObj.js')).objectOf('flag:venezuela') && (await import('./assetObj.js')).objectOf('tags:$100|$50'));
});
