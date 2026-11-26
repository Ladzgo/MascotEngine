import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fallbackQuery} from './storyboard.js';

test('fallback stock query: topic words + the sentence word, never the drawn setting (ep010 living-room photos)', () => {
  assert.equal(fallbackQuery('Your credit card is tricking you', 'Making minimum payments keeps you $10k in debt for 10 years.')[0], 'credit card payments');
  assert.equal(fallbackQuery('Your credit card is tricking you', 'Tiny interest rate.')[0], 'credit card interest');
  assert.ok(fallbackQuery('Sleep better tonight', 'Your bedroom should be cool.', 'moon').every(q => !/living/.test(q)));
});
