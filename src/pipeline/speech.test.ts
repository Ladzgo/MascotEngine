import test from 'node:test';
import assert from 'node:assert/strict';
import {numEn, numHu, segmentize, spoken} from './speech.js';

test('English numbers, currency, percent, years, abbreviations', () => {
  assert.equal(spoken('$1,000 at 6% for 20 years'), 'one thousand dollars at six percent for twenty years');
  assert.equal(spoken('A $1.5 million loan, 3.5% APR'), 'A one point five million dollar loan, three point five percent A P R');
  assert.equal(spoken('In 2024 and 1999.'), 'In twenty twenty four and nineteen ninety nine.');
  assert.equal(numEn(21450), 'twenty one thousand four hundred fifty');
});
test('Hungarian numerals', () => {
  assert.equal(numHu(21), 'huszonegy'); assert.equal(numHu(1000), 'ezer'); assert.equal(numHu(2000), 'kétezer');
  assert.equal(numHu(35), 'harmincöt'); assert.equal(numHu(250), 'kétszázötven'); assert.equal(numHu(3500), 'háromezer-ötszáz');
  assert.equal(spoken('6% kamat, 1 000 Ft', 'hu'), 'hat százalék kamat, ezer forint');
});
test('segmentize: clauses, speeds in range, pauses jittered, none after the last', () => {
  const s = segmentize('Pay the minimum, and the debt barely moves. Really? Yes.', {seed: 3});
  assert.ok(s.length >= 3 && s.every(x => x.speed >= 0.81 && x.speed <= 0.92));
  assert.equal(s.at(-1)!.pauseMs, 0);
  assert.ok(s.slice(0, -1).every(x => x.pauseMs >= 40));
  assert.deepEqual(segmentize('One. Two.', {seed: 3}), segmentize('One. Two.', {seed: 3}));
});

test('segmentize: a clause full of spelled-out numbers is read slower than plain talk', () => {
  const [lead, n] = segmentize(spoken('You could spend $1,825 a year.'), {seed: 2}), [t] = segmentize('You could spend all of it this year.', {seed: 2});
  assert.ok(n.speed <= 0.8 && n.speed >= 0.78 && t.speed >= 0.81 && n.speed < t.speed, `${n.speed} vs ${t.speed}`);
  assert.deepEqual([lead.text, lead.pauseMs], ['You could spend', 90]); // the small beat before the key amount
});

test('segmentize: emphasis given as digits matches the spoken words; a short punch sentence is slower than a long one', () => {
  const plain = segmentize('Prices went up by a lot over the last few years and nobody noticed it.', {seed: 3})[0], punch = segmentize('Nobody noticed.', {seed: 3})[0];
  assert.ok(punch.speed < plain.speed + 0.03, `${punch.speed} vs ${plain.speed}`);
  const [a] = segmentize(spoken('Fees take 7% each year.'), {seed: 4}), [b] = segmentize(spoken('Fees take 7% each year.'), {seed: 4, emphasis: ['7%']});
  assert.ok(b.speed < a.speed, `${b.speed} vs ${a.speed}`);
});

test('spoken: "a $5 coffee" is a five dollar coffee', () => {
  assert.equal(spoken('A $5 coffee costs $5.'), 'A five dollar coffee costs five dollars.');
});
