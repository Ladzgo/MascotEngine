import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickDoodles} from './doodles.js';

test('pickDoodles maps narration keywords to icons in order, max 3', () => {
  assert.deepEqual(pickDoodles('Inflation eats your savings over the years'), ['down', 'calendar', 'clock']);
  assert.deepEqual(pickDoodles('Nothing relevant here'), []);
  assert.equal(pickDoodles('rent a house with credit card money and time', 3).length, 3);
});

test('captions never highlight function words', async () => {
  const {isFunctionWord} = await import('./captions.js');
  assert.ok(isFunctionWord('to') && isFunctionWord('The,') && !isFunctionWord('inflation'));
});
