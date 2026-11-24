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
  const ok = JSON.stringify({ideas: [idea('Fine idea')]});
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
  writeIdeas(f, {generatedAt: 'a', ideas: [mkI('One', 'drafted')]});
  const m = mergeIdeas(readIdeas(f), [mkI('One'), mkI('Two')], 'b');
  assert.deepEqual(m.ideas.map(i => [i.id, i.status]), [['one', 'drafted'], ['two', 'new']]);
  assert.equal(lintIdeas(m.ideas, {banned: [], used: []}).kept.length, 2);
});
