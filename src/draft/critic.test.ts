import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrubSlop, slopHits, arcGaps, criticPass} from './critic.js';

test('scrubSlop removes stock phrases and keeps every digit', () => {
  assert.equal(scrubSlop("In today's fast-paced world, prices rose 3.2 percent."), 'Prices rose 3.2 percent.');
  assert.equal(scrubSlop("Let's dive into the 4 costs."), "Let's look at the 4 costs.");
  assert.equal(scrubSlop('Plain sentence stays.'), 'Plain sentence stays.');
  assert.deepEqual(slopHits('A game-changer.'), ['game-changer']);
});

test('arcGaps flags missing tension/evidence/payoff', () => {
  const sc = (narration: string, extra: any = {}) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration, ...extra});
  const ok: any = {scenes: [sc('Cash quietly shrinks.'), sc('But prices keep rising.'), sc('Three percent a year.', {type: 'big_number'}), sc('So keep some cash.')]};
  assert.deepEqual(arcGaps(ok), []);
  assert.ok(arcGaps({scenes: [sc('Hi there.'), sc('Fine.'), sc('Fine.'), sc('Fine.')]} as any).length >= 2);
});

test('criticPass rewrites only when digits are unchanged', async () => {
  const mk = (t: string) => ({messages: {async create() { return {content: [{type: 'text', text: t}]}; }}});
  const ep: any = {scenes: [{type: 'talk', narration: 'Hook.'}, {type: 'talk', narration: 'This is a rich tapestry of 5 facts, honestly.'}]};
  // scrubbed text is not applied here; the pass handles what remains
  assert.equal((await criticPass(mk('{"narration":"Here are 5 facts."}'), ep)).scenes[1].narration, 'Here are 5 facts.');
  assert.equal((await criticPass(mk('{"narration":"Here are 6 facts."}'), ep)).scenes[1].narration, ep.scenes[1].narration);
});

test('Hungarian payoff: inflected and imperative closings are not flagged', () => {
  const sc = (narration: string) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration});
  const ep = (last: string): any => ({scenes: [sc('Kamat.'), sc('De a díj drága.'), sc('Ez 5 százalék.'), sc(last)]});
  for (const t of ['A tanulsága egyszerű.', 'Érdemes összehasonlítani.', 'Kezdj a díjaknál.', 'Számolj utána!']) assert.ok(!arcGaps(ep(t)).includes('The last scene does not land a takeaway.'), t);
  assert.ok(arcGaps(ep('Ennyi volt a hitel.')).includes('The last scene does not land a takeaway.'));
});

test('splitBeats cuts long talk at sentence ends; styleGaps flags all-talk scripts', async () => {
  const {splitBeats} = await import('./beats.js');
  const {styleGaps} = await import('./critic.js');
  const t = (n: string): any => ({type: 'talk', narration: n, emotion: 'neutral', emphasis: []});
  const long = 'Loans cost money over time. A seventy two month loan at seven percent adds thousands. The monthly payment hides that fact. Dealers know it well.';
  const ep: any = {scenes: [t('Hook here.'), t(long), t('End.')]};
  const out = splitBeats(ep);
  assert.ok(out.scenes.length >= 4);
  assert.equal(out.scenes.slice(1, -1).map((s: any) => s.narration).join(' '), long);
  assert.ok(styleGaps({scenes: Array.from({length: 12}, () => t('Plain talk here.'))} as any).some(x => /plain talk/.test(x)));
});
