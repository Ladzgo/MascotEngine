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

test('spokenNumbers + groundNumbers: invented big_number becomes talk', async () => {
  const {spokenNumbers, groundNumbers} = await import('./lint.js');
  assert.ok(spokenNumbers('You pay $86,542 or 2.5 million, about one percent, five hundred thousand, twenty-five.').every(Boolean));
  const s = spokenNumbers('You pay $86,542 or 2.5 million, about one percent, five hundred thousand, twenty-five.');
  for (const n of [86542, 2.5e6, 1, 5e5, 25]) assert.ok(s.includes(n), String(n));
  const ep: any = {scenes: [
    {type: 'big_number', value: 7, narration: 'Savings earn about seven percent.', emotion: 'neutral', emphasis: []},
    {type: 'big_number', value: 42, narration: 'Prices keep rising.', emotion: 'neutral', emphasis: []}]};
  assert.deepEqual(groundNumbers(ep).scenes.map((x: any) => x.type), ['big_number', 'talk']);
});

test('repairDraft: chart without data becomes talk, flat chart fields are rescued', async () => {
  const {repairDraft} = await import('./draft.js');
  const r = repairDraft({scenes: [{type: 'chart', narration: 'a'}, {type: 'chart', narration: 'b', labels: ['x', 'y'], values: ['1', '2'], kind: 'bar'}, {type: 'big_number', narration: 'c', value: 'many'}]});
  assert.deepEqual(r.scenes.map((s: any) => s.type), ['talk', 'chart', 'talk']);
  assert.deepEqual(r.scenes[1].chart.values, [1, 2]);
});
