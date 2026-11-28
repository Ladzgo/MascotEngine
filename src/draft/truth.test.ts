import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arithmeticOk, danglingPronoun, ratioOk, truthGates, numbersIn, digits} from './truth.js';

test('numbersIn reads money, percent, decimals and scales', () => {
  assert.deepEqual(numbersIn('$1,825 a year, 17%, 2.5 million, 27.3 days'), [1825, 17, 2.5e6, 27.3]);
});

test('arithmetic: a stated wrong or missing result fails, a right one (same or next line) passes', () => {
  assert.equal(arithmeticOk(digits("That's 27.3 times 3600.")), false); // no result anywhere
  assert.equal(arithmeticOk(digits('Five dollars times 365 days?'), digits("That's $1,825 a year.")), true);
  assert.equal(arithmeticOk(digits('$5 daily, times fifty-two weeks.'), digits("That's $2,006 a year, Anna.")), false);
  assert.equal(arithmeticOk(digits('$5 a day times 365 is $1,825.')), true);
  assert.equal(arithmeticOk('Honey lasts 3000 years.'), null);
});

test('pronoun opening a beat needs a person before it', () => {
  assert.equal(danglingPronoun('She sees the same face every night.', ['Three things about the Moon.', 'It takes 27.3 days.']), true);
  assert.equal(danglingPronoun('She sees the same face every night.', ['Mia looks up at the Moon.']), false);
  assert.equal(danglingPronoun('He pays $5.', ['My neighbour buys coffee daily.']), false);
  assert.equal(danglingPronoun('The Moon spins.', []), false);
});

test('ratio claims need a sourced factor (or one computed from two sourced numbers)', () => {
  assert.equal(ratioOk("That's 1.5 times as fast as it orbits.", [27.3]), false);
  assert.equal(ratioOk('It is 2 times faster.', [30, 15]), true);
  assert.equal(ratioOk('Earthshine is 50 times brighter.', [50]), true);
  assert.equal(ratioOk('5 more minutes.', []), null);
});

test('truthGates drops failing middle beats, never the hook or the last line', () => {
  const s = (narration: string) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration});
  const ep = {scenes: [s('She knows. 2 times faster.'), s("That's 27.3 times 3600."), s('She sees it.'), s('It spins every 27.3 days.'), s("That's 1.5 times as fast.")]} as any;
  const r = truthGates(ep, [27.3]);
  assert.deepEqual(r.ep.scenes.map((x: any) => x.narration), ['She knows. 2 times faster.', 'It spins every 27.3 days.', "That's 1.5 times as fast."]);
  assert.equal(r.dropped.length, 2);
});
