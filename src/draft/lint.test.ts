import {test} from 'node:test';
import assert from 'node:assert/strict';

test('sourceFlags vets hosts and flags number scenes without a vetted source', async () => {
  const {sourceFlags, isVettedSource} = await import('./lint.js');
  assert.ok(isVettedSource('https://www.bls.gov/cpi/') && isVettedSource('https://fred.stlouisfed.org/x') && !isVettedSource('https://myblog.example.com/a') && !isVettedSource('nope'));
  const ep: any = {sources: ['https://myblog.example.com/a'], scenes: [{type: 'talk', narration: 'Hi'}, {type: 'big_number', narration: 'Three percent.'}]};
  const f = sourceFlags(ep);
  assert.deepEqual(f.vetted, []); assert.ok(f.notes[1][0].includes('Verify')); assert.ok(f.notes[0][0].includes('Removed'));
  assert.deepEqual(sourceFlags({...ep, sources: ['https://www.bls.gov/cpi/']}).notes, {});
});

test('repeatedPhrases flags reused phrases and similes across scenes only', async () => {
  const {repeatedPhrases} = await import('./lint.js');
  assert.deepEqual(repeatedPhrases(['Inflation is like a thief at night.', 'Prices climb like a thief again.']), ['like a thief']);
  assert.ok(repeatedPhrases(['Money slowly loses buying power.', 'Cash loses buying power fast.']).includes('loses buying power'));
  assert.deepEqual(repeatedPhrases(['the cat sat on the mat the mat']), []);
});
