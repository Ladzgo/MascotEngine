import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editPass, fixEpisode, huFix} from './editor.js';

test('huFix: doubled words, spacing, repeated sentences, Hungarian number format', () => {
  assert.equal(huFix('A a kamat , hogy hogy nő.'), 'A kamat, hogy nő.');
  assert.equal(huFix('Ez fontos. Ez fontos. Másik mondat.'), 'Ez fontos. Másik mondat.');
  assert.equal(huFix('Az összeg 1,234,567 forint és 3.5 százalék.'), 'Az összeg 1 234 567 forint és 3,5 százalék.');
  assert.equal(huFix('Costs 1,234 and 3.5 percent.', false), 'Costs 1,234 and 3.5 percent.');
});

const ep: any = {disclaimer: true, sources: [], scenes: ['Hook line.', 'Képzel, 3% inflációban.', 'A pénzed 54,3% lesz.'].map(n => ({type: 'talk', narration: n, emotion: 'neutral', emphasis: []}))};

test('fixEpisode keeps digits; editPass accepts a clean rewrite, rejects changed numbers and wild length', async () => {
  assert.equal(fixEpisode(ep, 'hu').scenes[2].narration, 'A pénzed 54,3% lesz.');
  const replies = ['{"narration":"Képzeld el: 3% inflációban."}', '{"narration":"A pénzed 99% lesz."}'];
  const client: any = {messages: {create: async () => ({content: [{type: 'text', text: replies.shift()}]})}};
  const r = await editPass(client, ep, {lang: 'hu'});
  assert.equal(r.changed, 1);
  assert.equal(r.ep.scenes[1].narration, 'Képzeld el: 3% inflációban.');
  assert.equal(r.ep.scenes[2].narration, 'A pénzed 54,3% lesz.'); // 99% rejected
  assert.equal(r.ep.scenes[0].narration, 'Hook line.'); // hook untouched
});

test('huRules: gemma/qwen filler, tag questions and case slips; digits untouched', () => {
  assert.equal(huFix('Nos, a kamat 7,8 százalék. Hát, ez sok.'), 'A kamat 7,8 százalék. Ez sok.');
  assert.equal(huFix('Ez bizony stresszes helyzet, nem, de? Kezdj spórolni, tudod.'), 'Ez stresszes helyzet. Kezdj spórolni.');
  assert.equal(huFix('Nézd meg ezt a grafikonon a kamatot.'), 'Nézd meg ezt a grafikont a kamatot.');
  assert.equal(huFix('Ebben a chartban látjuk a kamatot. Nézd a chartot.'), 'Ezen a grafikonon látjuk a kamatot. Nézd a grafikont.');
  assert.equal(huFix('Nos, hogy nem.', false), 'Nos, hogy nem.'); // other languages untouched
});
