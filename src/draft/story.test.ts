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
  assert.ok(lastHookPick!.score >= 75 && calls <= 4, `score ${lastHookPick!.score}, calls ${calls}`);
});
test('pickTitle: judged candidates, invented numbers and long titles lose', async () => {
  const {pickTitle} = await import('./story.js');
  const client = {messages: {create: async (r: {system: string; messages: {content: string}[]}) => ({content: [{type: 'text', text: /Score each/.test(r.system)
    ? JSON.stringify({scores: r.messages[0].content.split('\n').map(l => /1,825/.test(l) ? 90 : 40)})
    : JSON.stringify({titles: ['Your coffee costs $1,825 a year', 'Coffee costs $9,999 a year', 'Why this tiny daily habit quietly drains far more money than you think']})}]})}} as any;
  const ep = {title: 'Coffee money', scenes: [{narration: 'A $5 coffee is $1,825 a year.'}]} as any;
  const r = await pickTitle(client, ep);
  assert.equal(r.title, 'Your coffee costs $1,825 a year'); // the $9,999 title is dropped, the 70-char one is over the length cap
});
test('retention loop: a device viewers leave sits out of the rotation', () => {
  const all = DEVICES.map(d => d.id), weak = all[0];
  const ret = Object.fromEntries(all.map(id => [id, id === weak ? 20 : 50]));
  for (const t of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) assert.notEqual(pickDevice(t, [], undefined, ret).id, weak);
  assert.equal(pickDevice('x', [], undefined, {}).id, pickDevice('x', [], undefined, {}).id);
});
test('dropFlat removes a flat beat of an empty pair while the Short stays long enough; judgeStory caps a judge that quotes no real line', async () => {
  const {dropFlat, judgeStory, concreteGaps} = await import('./story.js');
  const ep = mk(['Hook 5.', 'It adds up quietly.', 'Nobody notices it.', 'Then $40 a month.', 'Plain line here.', 'So next time 5.', 'End 5.']);
  const r = dropFlat(ep, () => 10, 20);
  assert.equal(r.dropped, 1); assert.deepEqual(concreteGaps(r.ep.scenes.map(s => s.narration)), []);
  assert.equal(dropFlat(ep, () => 1, 36).dropped, 0); // too short to lose a beat
  const client = (o: object) => ({messages: {create: async () => ({content: [{type: 'text', text: JSON.stringify(o)}]})}}) as any;
  assert.equal((await judgeStory(client({score: 100, weakest: 'not in the script'}), ep)).score, 60);
  assert.equal((await judgeStory(client({score: 80, weakest: 'Nobody notices it.'}), ep)).score, 80);
});
test('improveStory rewrites the quoted weakest line and keeps it only when the re-judge scores higher', async () => {
  const {improveStory} = await import('./story.js');
  const ep = mk(['Hook $5.', 'It is a problem.', 'Then $40 a month.', 'So next time, $5.']);
  let judged = 0;
  const client = {messages: {create: async (r: {system: string}) => ({content: [{type: 'text', text: /tough YouTube/.test(r.system)
    ? JSON.stringify({score: [80, 80][judged++] ?? 70, weakest: 'Then $40 a month.'})
    : JSON.stringify({rewrites: [{i: 1, line: 'Anna pays $40 a month for it.'}]})}]})}} as any;
  const r = await improveStory(client, ep, {score: 50, weakest: 'It is a problem.', fix: 'add a person'});
  assert.equal(r.ep.scenes[1].narration, 'Anna pays $40 a month for it.');
  assert.equal(r.score, 80); assert.deepEqual(r.history, [50, 80]);
  const bad = {messages: {create: async () => ({content: [{type: 'text', text: JSON.stringify({rewrites: [{i: 1, line: 'It costs $999 now.'}, {i: 0, line: 'New hook.'}]})}]})}} as any;
  assert.equal((await improveStory(bad, ep, {score: 50, weakest: 'It is a problem.'})).ep, ep); // invented number and the hook: both rejected
});
test('hook and overlay shape rules', async () => {
  const {badHookShape, overlayOk} = await import('./story.js');
  assert.ok(badHookShape("The reason you lose 50 dollars isn't what you think—why?"));
  assert.ok(badHookShape('Your rent can double in 10.') && !badHookShape('Your rent can double in 10 years.') && badHookShape('Coffee? It costs $5.') && !badHookShape('Why does your $5 coffee cost $1,825?') && !badHookShape('Your $5 coffee costs $1,825.'));
  assert.ok(!overlayOk('Hidden fifty loss explained today') && !overlayOk('Mind the cost?') && overlayOk('Your coffee costs $1,825 a year'));
});
test('fullName: "Imagine Jane" is a first name, "Elon Musk" is a full name', async () => {
  const {fullName} = await import('./story.js');
  assert.ok(!fullName('Imagine Jane saves $10,000.') && fullName('Elon Musk saves $10,000.') && !fullName('Meet Anna, 28.'));
});
