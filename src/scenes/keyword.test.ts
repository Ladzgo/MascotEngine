import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickKeyword} from './keyword.js';

test('pickKeyword: emphasis, number, short sentence, longest content word', () => {
  assert.equal(pickKeyword('Anything at all.', ['rate']), 'rate');
  assert.equal(pickKeyword('It costs about 40 dollars every month for years on end.', []), '40');
  assert.equal(pickKeyword("Let's go through each one.", []), "Let's go through each one");
  assert.equal(pickKeyword('Prices rise a little every year so the same bills buy less food.', []), 'Prices');
});
