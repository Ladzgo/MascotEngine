import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeCalc, parseOutline, allowedNumbers, unsupportedNumbers, planParts, draftByOutline} from './outline.js';
import {FALLBACK_VOICE} from './draft.js';

const sec = (i: number, extra: any = {}) => ({heading: `Part ${i}`, point: 'p', fact: `A loan of 20000 dollars at 6 percent costs 1200 dollars a year`, numbers: [20000, 6, 1200], calc: {expr: '20000*0.06', result: 1200}, ...extra});
const outline = (over: any = {}) => ({title: 'Car Loans', sources: ['https://www.federalreserve.gov/x'], hook: 'Your car loan hides a second price tag.', stakes: 'It can add 3000 dollars.', sections: [sec(1), sec(2), sec(3), sec(4)], twist: 'The catch is the term.', recap: 'Check the term.', cta: 'Follow for more.', ...over});

test('safeCalc evaluates arithmetic only', () => {
  assert.equal(safeCalc('20000*0.06'), 1200);
  assert.equal(safeCalc('1,000 x 12'), 12000);
  assert.equal(safeCalc('process.exit()'), undefined);
});

test('parseOutline rejects wrong arithmetic, lenient mode blacklists it', () => {
  const bad = outline({sections: [sec(1, {calc: {expr: '20000*0.06', result: 1500}}), sec(2), sec(3), sec(4)]});
  assert.match(parseOutline(bad).errors.join(), /= 1200, not 1500/);
  const l = parseOutline(bad, true);
  assert.ok(l.outline && l.outline.badResults.includes(1500));
});

test('unsupportedNumbers flags invented and wrongly computed numbers', () => {
  const o = parseOutline(outline()).outline!, al = allowedNumbers(o);
  assert.deepEqual(unsupportedNumbers('You pay twelve hundred dollars, so 1,200 a year.', al).filter(n => n > 100), []);
  assert.deepEqual(unsupportedNumbers('Over five years that is 6,000 dollars.', al), []); // 1200 * 5
  assert.deepEqual(unsupportedNumbers('It costs 7,300 dollars.', al), [7300]);
  assert.deepEqual(unsupportedNumbers('There are two ways to see it.', al), []);
});

const beat = (n: string, type = 'talk') => ({type, emotion: 'explaining', narration: n});
const mkClient = () => {
  const calls: string[] = [];
  return {calls, messages: {async create(a: any) {
    calls.push(a.messages.at(-1).content);
    const last = a.messages.at(-1).content as string;
    if (a.system.startsWith('You plan')) return {content: [{type: 'text', text: JSON.stringify(outline())}]};
    const k = calls.length, w = (s: string) => `${s} lorem${k} ipsum${k} dolor${k} amet${k} elit${k} tempor${k} magna${k} aliqua${k} veniam${k}.`;
    const hook = last.includes('Hook') ? [beat('Your car loan hides a second price tag.', 'title')] : [];
    return {content: [{type: 'text', text: JSON.stringify({beats: [...hook, beat(w('First idea here')), beat(w('Second idea there')), beat(w('Third idea once more'))]})}]};
  }}};
};

test('draftByOutline expands each part and reports progress', async () => {
  const c = mkClient(), prog: string[] = [];
  const ep = await draftByOutline({client: c as any, topic: 't', id: 'ep-o', voice: FALLBACK_VOICE, progress: (d, n, l) => prog.push(`${d}/${n} ${l}`)});
  assert.equal(planParts(parseOutline(outline()).outline!).length, 7);
  assert.equal(prog.length, 8);
  assert.equal(prog.at(-1), '7/7 Recap and call to action');
  assert.ok(ep.scenes.length >= 10);
  assert.equal(ep.scenes[0].type, 'title');
});

test('a part that keeps inventing numbers falls back to the outline words', async () => {
  const c = {messages: {async create(a: any) {
    if (a.system.startsWith('You plan')) return {content: [{type: 'text', text: JSON.stringify(outline())}]};
    return {content: [{type: 'text', text: JSON.stringify({beats: [beat('You will pay 9,999 dollars in hidden fees on this loan every single year.'), beat('Another bad line with 8,888 dollars of nonsense and more words here ok.'), beat('Third line with 7,777 dollars of invented numbers and some more words.')]})}]};
  }}};
  const ep = await draftByOutline({client: c as any, topic: 't', id: 'ep-o', voice: FALLBACK_VOICE});
  assert.ok(!ep.scenes.some(s => /9,999|8,888|7,777/.test(s.narration)));
});

test('long-form plan: chapters open with their mini-hook, 4-8 beats / 100+ words each, a re-hook after the middle chapter', async () => {
  const {planParts} = await import('./outline.js');
  const sec = (i: number) => ({heading: `Chapter ${i}`, point: 'p', fact: `${i} dollars`, numbers: [i], tease: `Why ${i}?`});
  const o = {title: 't', sources: [], hook: 'h', stakes: 's', sections: [1, 2, 3, 4, 5].map(sec), twist: 'tw', recap: 'r', cta: 'c', badResults: [], rehook: 'But the real surprise is still coming.'} as any;
  const parts = planParts(o, false);
  const keys = parts.map(p => p.key);
  assert.deepEqual(keys, ['opening', 's1', 's2', 's3', 'rehook', 's4', 's5', 'twist', 'closing']);
  const s1 = parts.find(p => p.key === 's1')!;
  assert.ok(s1.min === 4 && s1.max === 8 && s1.minWords === 100 && /mini-hook/.test(s1.brief) && /Why 1\?/.test(s1.facts));
  assert.ok(!planParts(o, true).some(p => p.key === 'rehook')); // Shorts keep their tight shape
});
