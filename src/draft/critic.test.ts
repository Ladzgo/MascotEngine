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
