import {test} from 'node:test';
import assert from 'node:assert/strict';
import {huWordValue, isHu} from './lang.js';
import {groundNumbers, lintEpisode, spokenNumbers} from './lint.js';
import {arcGaps, ensurePayoff, scrubSlop, slopHits} from './critic.js';
import {buildSystem} from './draft.js';

test('Hungarian number words and formats', () => {
  assert.equal(huWordValue('harmincöt'), 35);
  assert.equal(huWordValue('kétszázötven'), 250);
  assert.equal(huWordValue('ezer'), 1000);
  assert.equal(huWordValue('háromezer-ötszáz'.replace('-', '')), 3500);
  assert.equal(huWordValue('százalék'), null);
  const s = spokenNumbers('Az összeg 1 234 567 forint, 3,5 százalék, két millió, és tizenöt év.');
  for (const n of [1234567, 3.5, 2e6, 15]) assert.ok(s.includes(n), String(n));
  const ep: any = {scenes: [
    {type: 'big_number', value: 7, narration: 'A kamat hét százalék.', emotion: 'neutral', emphasis: []},
    {type: 'big_number', value: 42, narration: 'Az árak emelkednek.', emotion: 'neutral', emphasis: []}]};
  assert.deepEqual(groundNumbers(ep).scenes.map((x: any) => x.type), ['big_number', 'talk']);
});

test('Hungarian slop, banned wording, accents survive the scrub', () => {
  assert.ok(slopHits('Nem titok, hogy a kamat számít.').length);
  assert.equal(scrubSlop('Nem titok, hogy a kamat számít.'), 'A kamat számít.');
  const ep: any = {disclaimer: true, sources: [], scenes: [{type: 'talk', narration: 'Ez garantált nyereség.', emotion: 'neutral', emphasis: []}]};
  assert.ok(lintEpisode(ep).some(e => /banned/.test(e)));
});

test('ensurePayoff adds one closing line only when missing, in the channel language', () => {
  const mk = (last: string): any => ({scenes: ['Hook line.', 'Közepe, de baj van.', 'A kamat hét százalék.', last].map(n => ({type: 'talk', narration: n, emotion: 'neutral', emphasis: []}))});
  assert.ok(arcGaps(mk('Ennyi volt.')).some(g => /takeaway/.test(g)));
  const fixed = ensurePayoff(mk('Ennyi volt.'), 'hu');
  assert.match(fixed.scenes.at(-1)!.narration, /A tanulság/);
  assert.deepEqual(arcGaps(fixed).filter(g => /takeaway/.test(g)), []);
  assert.equal(ensurePayoff(mk('Szóval kezdd ma.'), 'hu').scenes.at(-1)!.narration, 'Szóval kezdd ma.');
  assert.match(ensurePayoff(mk('That is it.'), 'en').scenes.at(-1)!.narration, /So next time/);
});

test('buildSystem switches prompt and few-shot to Hungarian', () => {
  assert.ok(isHu('hu') && isHu('hu-HU') && !isHu('en'));
  const hu = buildSystem('voice', 'ctx', 'hu'), en = buildSystem('voice', 'ctx', 'en');
  assert.match(hu, /LANGUAGE: write EVERYTHING/); assert.match(hu, /A bérlés nem kidobott pénz/); assert.doesNotMatch(hu, /Renting Is Not/);
  assert.match(en, /Renting Is Not/); assert.doesNotMatch(en, /LANGUAGE:/);
});
