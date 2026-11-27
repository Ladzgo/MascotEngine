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

test('repairDraft: timeline and before_after shapes', async () => {
  const {repairDraft} = await import('./draft.js');
  const {Episode} = await import('../schema.js');
  const r = repairDraft({scenes: [
    {type: 'timeline', narration: 'a', events: [{year: 1971, label: 'Gold standard ends'}, {when: '2008', what: 'Crisis'}]},
    {type: 'timeline', narration: 'b', events: [{when: '1999', what: 'only one'}]},
    {type: 'before_after', narration: 'c', left: {title: 'Then', value: '1%'}, right: {title: 'Now', value: '5%'}}]});
  assert.deepEqual(r.scenes.map((s: any) => s.type), ['timeline', 'talk', 'before_after']);
  assert.ok(Episode.safeParse({id: 'x-1', title: 't', scenes: r.scenes}).success);
});

test('repairDraft drops placeholder-narration scenes', async () => {
  const {repairDraft} = await import('./draft.js');
  const mk = (n: string) => ({type: 'talk', narration: n});
  const r = repairDraft({scenes: [mk('Hook.'), mk('...'), mk('Real one.'), mk('Another.'), mk('Last.')]});
  assert.deepEqual(r.scenes.map((s: any) => s.narration), ['Hook.', 'Real one.', 'Another.', 'Last.']);
});

const sc = (type: string, narration: string, x: any = {}): any => ({type, narration, emotion: 'neutral', emphasis: [], ...x});
const short = (n: string) => sc('talk', n);

test('talk-run merge, closing reversal, simile cap, chart grounding', async () => {
  const {talkRuns, mergeTalkRuns, closingContradiction, fixClosing, limitSimiles, similes, groundCharts} = await import('./lint.js');
  const ep: any = {sources: ['https://www.bls.gov/x'], scenes: [sc('title', 'Hook.'), ...['A one.', 'B two.', 'C three.', 'D four.', 'E five.', 'F six.', 'G seven.', 'H eight.'].map(short)]};
  assert.equal(talkRuns(ep.scenes).length, 1);
  const m = mergeTalkRuns(ep);
  assert.equal(talkRuns(m.scenes).length, 0); assert.equal(m.scenes.map((s: any) => s.narration).join(' ').replace(/\s+/g, ' '), 'Hook. A one. B two. C three. D four. E five. F six. G seven. H eight.');
  assert.ok(closingContradiction('Save early. But actually, never mind.'));
  assert.equal(fixClosing({...ep, scenes: [sc('talk', 'Save early. However, forget it.')]}).scenes[0].narration, 'Save early.');
  const sim = limitSimiles({...ep, scenes: [sc('talk', 'It is like a tide. Fine.'), sc('talk', 'It is like a fog. Plain fact.'), sc('talk', 'It is like a storm. Another fact.'), sc('talk', 'Plain. Like a rock.')]});
  assert.equal(similes(sim.scenes.map((s: any) => s.narration)), 2);
  const chart = (narr: string) => sc('chart', narr, {chart: {kind: 'line', labels: ['a', 'b'], values: [3, 5], yLabel: ''}});
  assert.deepEqual(groundCharts({...ep, scenes: [chart('Rates went from three to five percent.'), chart('Rates rose a lot.')]}).scenes.map((s: any) => s.type), ['chart', 'talk']);
  assert.equal(groundCharts({...ep, sources: ['https://blog.example.com'], scenes: [chart('From three to five.')]}).scenes[0].type, 'talk');
});

test('spoken length: numerals count as said; a long Short data scene is no lint error (tightenLong shortens it)', async () => {
  const {spokenWords, lintEpisode} = await import('./lint.js');
  assert.equal(spokenWords('Save $1,825 a year.'), 10); // save one thousand eight hundred twenty five dollars a year
  const base: any = {format: 'short', disclaimer: true, sources: [], scenes: [{type: 'title', narration: 'Coffee costs more than you think.'}, {type: 'talk', narration: 'Five dollars a day adds up.'}]};
  assert.ok(!lintEpisode(base).some(e => /Short beats/.test(e)));
  base.scenes.push({type: 'list', narration: 'Daily coffee $5, yearly $1,825, beats the national average of $1,100.', items: ['a', 'b']});
  assert.ok(!lintEpisode(base).some(e => /Short beats must stay under 5 s/.test(e)));
});

test('numeralize: spelled-out amounts become numerals for captions; small bare counts and other languages stay', async () => {
  const {numeralize} = await import('./lint.js');
  assert.equal(numeralize('A five dollar coffee? That is over eighteen hundred dollars a year.'), 'A $5 coffee? That is over $1,800 a year.');
  assert.equal(numeralize('You could spend one thousand eight hundred twenty-five dollars.'), 'You could spend $1,825.');
  assert.equal(numeralize('Ten years at seven percent, a hundred dollars a month.'), 'Ten years at 7%, $100 a month.');
  assert.equal(numeralize('Three hundred sixty five days.'), '365 days.');
  assert.equal(numeralize('One coffee and two habits.'), 'One coffee and two habits.');
  assert.equal(numeralize('Egy kettő három.'), 'Egy kettő három.');
});

test('numeralize leaves word lists alone', async () => {
  const {numeralize} = await import('./lint.js');
  assert.equal(numeralize('One two three four five six seven.'), 'One two three four five six seven.');
});

test('schema keeps hookOverlay up to 7 words and drops longer ones without failing the load', async () => {
  const {Episode} = await import('../schema.js');
  const base = {id: 'x', title: 't', scenes: [{type: 'title', narration: 'Hi.', emotion: 'neutral'}]};
  assert.equal(Episode.parse({...base, hookOverlay: 'Stop charging in freezing temps'}).hookOverlay, 'Stop charging in freezing temps');
  assert.equal(Episode.parse({...base, hookOverlay: 'one two three four five six seven eight'}).hookOverlay, undefined);
  assert.equal(Episode.parse(base).hookOverlay, undefined);
});

test('autoFix merges talk runs AFTER grounding, so demoted big_numbers cannot leave a run of 7', async () => {
  const {autoFixEpisode, talkRuns} = await import('./lint.js');
  const t = (n: string) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration: n});
  const scenes = [t('Hook here.'), t('One a.'), t('Two b.'), t('Three c.'), {type: 'big_number', emotion: 'neutral', emphasis: [], narration: 'Big rise.', value: 999}, t('Four d.'), t('Five e.'), t('Six f.'), t('Seven g.'), t('End.')];
  const out = autoFixEpisode({id: 'x', title: 't', series: 's', seed: 0, channel: 'default', sources: [], disclaimer: true, format: 'wide', look: 'paper', scenes} as any);
  assert.equal(talkRuns(out.scenes).length, 0);
});
test('fixClosing: a closing that is one "But..." sentence loses the turn word instead of failing the draft', async () => {
  const {fixClosing, closingContradiction} = await import('./lint.js');
  const t = (n: string) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration: n});
  const out = fixClosing({scenes: [t('Hook.'), t('But rent control keeps tenants in place.')]} as any);
  assert.equal(out.scenes[1].narration, 'Rent control keeps tenants in place.');
  assert.ok(!closingContradiction(out.scenes[1].narration));
});
