import test from 'node:test';
import assert from 'node:assert/strict';
import {Episode} from '../schema.js';
import {checkShots, repairShots} from './storyboard.js';
import {scoreScript} from './score.js';
import {DEVICES, extraNumbers, hookHeuristic, pickDevice} from './story.js';

const sc = (narration: string, extra: object = {}) => ({type: 'talk', emotion: 'explaining', narration, emphasis: [], ...extra});
const mk = (n: string[]) => Episode.parse({id: 't', title: 't', series: 's', seed: 0, format: 'short', look: 'fullbleed', scenes: n.map(x => sc(x))});

test('pickDevice avoids recent devices and is deterministic per topic', () => {
  const recent = DEVICES.slice(0, 3).map(d => d.id);
  const d = pickDevice('credit cards', recent);
  assert.ok(!recent.includes(d.id)); assert.equal(pickDevice('credit cards', recent).id, d.id);
  assert.equal(pickDevice('x', [], 'simulation').id, 'simulation');
  assert.equal(new Set(DEVICES.map(x => x.id)).size, DEVICES.length);
});
test('extraNumbers reads numbers from fields and text', () => {
  assert.deepEqual(extraNumbers({name: 'Anna', age: 28, numbers: [4200], situation: 'owes $1,500 on a card'}).sort((a, b) => a - b), [28, 1500, 4200]);
});
test('hook heuristic likes short, numeric, concrete lines', () => {
  assert.ok(hookHeuristic('Anna, 28, owes $4,200 on one card.') > hookHeuristic('Did you know that finance is really very important to everyone today?'));
});
test('storyboard repair: subjects not repeated within 5 beats, 4+ actions, invented numbers dropped', () => {
  const ep = mk(['You owe a loan on your car.', 'The loan costs twelve thousand dollars.', 'Your car loses value fast.', 'A loan again, and the car keeps costing you.', 'Interest is the loan on top of the loan.', 'Your car payment is five hundred dollars.', 'The car is worth less each year.', 'Check the loan before you sign.']);
  const out = repairShots(ep, {1: {subject: 'debt_counter', action: 'counts', number: 12000}, 2: {subject: 'car', action: 'counts', number: 999}});
  assert.deepEqual(checkShots(out), []);
  assert.equal(out.scenes[2].shot!.number, undefined);
});
test('stock spec: 40-55% of beats, English queries only, no repeat within 8 beats, data beats stay drawn', () => {
  const ep = mk(Array.from({length: 12}, (_, i) => `Beat ${i} about running in the park.`));
  const raw = Object.fromEntries(ep.scenes.map((_, i) => [i, {stock: {query: i % 3 === 0 ? 'runner morning park' : 'nem angol szöveg', kind: i === 3 ? 'video' : 'photo'}}]));
  const out = repairShots(ep, raw), n = out.scenes.filter(s => s.stock).length;
  assert.ok(n >= 5 && n <= 6, `got ${n}`);
  const q = out.scenes.flatMap((s, i) => s.stock ? [[i, s.stock.query] as const] : []);
  assert.ok(q.every(([, t]) => /^[a-z0-9 '-]+$/.test(t)));
  for (const [i, t] of q) assert.ok(!q.some(([j, u]) => j < i && i - j < 8 && u === t), `repeat ${t}`);
});
test('script score: stock phrases and flat lines score lower than a concrete conversational script', () => {
  const good = ['Anna, 28, owes $4,200 on one card.', "She's paying $85 a month and it barely moves.", "Here's why: 22 percent interest eats $77 of it.", 'Twelve months later she owes $4,100.', "You'd think that's progress. It isn't.", "So you're stuck unless you pay more.", 'Check your own card, because Anna did.'];
  const bad = ["In today's fast-paced world, money matters.", 'It is important to note that interest exists.', 'Let us delve into the topic of finance.', 'Basically the economy is complex and varied.', 'Well, banks do things with money.', 'In conclusion, finance is a game-changer.'];
  assert.ok(scoreScript(mk(good)).total > scoreScript(mk(bad)).total + 20);
});

test('closeLoop keeps a line that reuses a hook word and drops numbers, follow-asks and unrelated lines; full names never reach the hook', async () => {
  const {closeLoop, fullName} = await import('./story.js');
  const client = (lines: string[]) => ({messages: {create: async () => ({content: [{type: 'text', text: JSON.stringify({lines})}]})}}) as any;
  const hook = 'Your phone battery dies faster in the cold.';
  assert.equal(await closeLoop({client: client(['Follow for more battery tips.', 'So it costs 20% more.', 'So next time, keep your battery warm in a pocket.']), hook, topic: 't'}), 'So next time, keep your battery warm in a pocket.');
  assert.equal(await closeLoop({client: client(['So remember this one simple thing.']), hook, topic: 't'}), null);
  assert.ok(fullName('Elon Musk noticed his phone dies faster.') && !fullName('Alex, 35, sits ten hours a day.'));
});

test('score: too few short sentences marks plain mid beats for a punchy rewrite', () => {
  const s = scoreScript(mk(['Hook with 5 dollars here.', 'This sentence runs on for quite a few words in a row.', 'Another sentence that also runs on for many plain words.', 'Yet another long plain sentence with a lot of words in it.', 'One more long sentence here with plenty of words in it too.', 'So next time remember the hook.']));
  assert.ok(s.weak.some(w => /rhythm/.test(w.why)));
});

test('concreteGaps: a number or a name in every second beat', async () => {
  const {concrete, concreteGaps} = await import('./story.js');
  assert.ok(concrete('It costs $5.') && concrete('That is three cups.') && concrete('Sarah pays more.') && concrete('Most people in Ohio pay it.'));
  assert.ok(!concrete('It adds up quietly.') && !concrete('Batteries hate the cold.'));
  assert.deepEqual(concreteGaps(['Hook 5', 'It adds up.', 'Nobody notices.', 'Then $40 a month.', 'Plain line.', 'Another plain line.']), [1]);
});
test('pickHook: five formula candidates, judge blend, second round only under the target', async () => {
  const {pickHook} = await import('./story.js');
  let calls = 0;
  const client = {messages: {create: async (r: {system: string}) => { calls++; return {content: [{type: 'text', text: /strict short-form/.test(r.system)
    ? JSON.stringify({scores: [30, 90, 40, 30, 20, 10]})
    : JSON.stringify({hooks: [{formula: 'curiosity_gap', line: 'Your $5 coffee costs $1,825 a year.', overlay: 'the $1,825 cup'}, {formula: 'callout', line: 'Stop buying coffee'}, {formula: 'list_tease', line: 'Three coffee facts'}, {formula: 'controversy', line: 'Coffee is fine'}, {formula: 'transformation', line: 'From 5 to 1825'}]})}]}; }}} as any;
  const h = await pickHook({client, topic: 'coffee', outlineHook: 'Coffee adds up.', stakes: '', allowedOk: () => true});
  const {lastHookPick} = await import('./story.js');
  assert.equal(h, 'Your $5 coffee costs $1,825 a year.'); // outline hook is candidate 1; the numeric line wins the blend
  assert.ok(lastHookPick!.score >= 75 && calls === 2, `score ${lastHookPick!.score}, calls ${calls}`);
});
