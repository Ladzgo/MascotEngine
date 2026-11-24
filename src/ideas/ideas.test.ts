import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Channel} from '../channel/channel.js';
import {generateIdeas, lintIdeas, mergeIdeas, readIdeas, writeIdeas, slug, } from './ideas.js';

const ch = Channel.parse({id: 'x', name: 'X', niche: 'money', bannedTopics: ['crypto']});
const idea = (title: string, extra: any = {}) => ({
  title, angle: 'An angle', hook: 'A hook here.', whyInteresting: 'Because.', format: 'explainer',
  difficulty: 2, needsSources: ['CPI'], ...extra,
});
const mk = (outs: string[]) => {
  const calls: any[] = [];
  return {calls, messages: {async create(a: any) {
    calls.push(JSON.parse(JSON.stringify(a)));
    return {content: [{type: 'text', text: outs[calls.length - 1]}]};
  }}};
};

test('generates, lints banned and duplicates', async () => {
  const c = mk([JSON.stringify({ideas: [
    idea('Why cash loses value'), idea('Crypto is the future'), idea('Why cash loses value!'),
    idea('Existing episode title here'), idea('Guaranteed returns explained'),
  ]})]);
  const r = await generateIdeas({client: c, channel: ch, count: 5, used: ['Existing episode title here']});
  assert.deepEqual(r.ideas.map(i => i.id), ['why-cash-loses-value']);
  assert.equal(r.dropped.length, 4);
  assert.match(c.calls[0].messages[0].content, /Existing episode title here/);
});

test('retries once on invalid, then fails', async () => {
  const ok = JSON.stringify({ideas: [idea('Why fine ideas need real numbers')]});
  const c = mk(['nope', ok]);
  assert.equal((await generateIdeas({client: c, channel: ch, count: 1, used: []})).ideas.length, 1);
  assert.equal(c.calls.length, 2);
  const c2 = mk([JSON.stringify({ideas: [idea('X title', {difficulty: 9})]}), 'bad']);
  await assert.rejects(generateIdeas({client: c2, channel: ch, count: 1, used: []}), /after retry/);
});

test('merge keeps existing ids and statuses', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideas-'));
  const f = path.join(dir, 'c', 'ideas.json');
  const mkI = (t: string, status: any = 'new') => ({...idea(t), id: slug(t), status, createdAt: 'now'}) as any;
  writeIdeas(f, {generatedAt: 'a', ideas: [mkI('Why one tiny fee matters', 'drafted')]});
  const m = mergeIdeas(readIdeas(f), [mkI('Why one tiny fee matters'), mkI('Why two small habits compound')], 'b');
  assert.deepEqual(m.ideas.map(i => [i.id, i.status]), [['why-one-tiny-fee-matters', 'drafted'], ['why-two-small-habits-compound', 'new']]);
  assert.equal(lintIdeas(m.ideas, {banned: [], used: []}).kept.length, 2);
});

import {specificity} from './ideas.js';
test('specificity: numbers up, vague and clickbait down; vague ideas are dropped', () => {
  assert.ok(specificity({title: 'Why $500 a month beats a $50,000 lump sum', needsSources: ['x']}) >= 3);
  assert.ok(specificity({title: 'Everything you need to know about money', needsSources: []}) < 0);
  assert.ok(specificity({title: 'Credit', needsSources: []}) < 0);
  assert.ok(specificity({title: 'The shocking secret banks hide from you today', needsSources: []}) < 0);
});

test('stemmed duplicate detection, and a top-up call fills the gap', async () => {
  const c = mk([
    JSON.stringify({ideas: [idea('Why index funds beat most stock pickers'), idea('Why index fund beats most stock picker'), idea('Everything about investing')]}),
    JSON.stringify({ideas: [idea('How a 0.5% fee quietly eats 12% of your pension'), idea('Why index funds beat most stock pickers')]}),
  ]);
  const r = await generateIdeas({client: c, channel: ch, count: 2, used: []});
  assert.equal(c.calls.length, 2);
  assert.deepEqual(r.ideas.map(i => i.title), ['How a 0.5% fee quietly eats 12% of your pension', 'Why index funds beat most stock pickers']);
  assert.match(c.calls[1].messages[0].content, /Why index funds beat most stock pickers/); // told what to avoid
  assert.ok(r.dropped.some(d => /duplicate/.test(d)) && r.dropped.some(d => /vague/.test(d)));
});

test('a failing top-up call does not lose the ideas already found', async () => {
  const c = mk([JSON.stringify({ideas: [idea('Why $500 a month beats waiting for a raise')]}), 'garbage']);
  const r = await generateIdeas({client: c, channel: ch, count: 3, used: []});
  assert.equal(r.ideas.length, 1);
});

test('slug strips accents instead of cutting words; Hungarian titles dedupe', async () => {
  assert.equal(slug('Miért marad szegény a legtöbb ember?'), 'miert-marad-szegeny-a-legtobb-ember');
  const c = mk([JSON.stringify({ideas: [idea('Miért veszít értéket a megtakarításod évente'), idea('Miért veszít értéket a megtakarításod'), idea('Hogyan nő a havi 50 ezer forint 30 év alatt')]})]);
  const r = await generateIdeas({client: c, channel: Channel.parse({id: 'h', name: 'H', language: 'hu'}), count: 3, used: []});
  assert.equal(r.ideas.length, 2);
  assert.match(c.calls[0].system, /channel's language/);
});
