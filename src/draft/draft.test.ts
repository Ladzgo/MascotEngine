import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {draftEpisode, writeDraft, FALLBACK_VOICE} from './draft.js';

const good = {
  id: 'x', title: 'T', disclaimer: true, sources: ['https://www.bls.gov/cpi/'],
  scenes: [
    {type: 'title', narration: 'Your cash loses value every single year.', emotion: 'smug'},
    {type: 'big_number', narration: 'Prices rose three percent.', value: 3, suffix: '%', label: 'CPI', emotion: 'worried'},
  ],
};
const mk = (outs: string[]) => {
  const calls: any[] = [];
  return {calls, messages: {async create(a: any) {
    calls.push(JSON.parse(JSON.stringify(a)));
    return {content: [{type: 'text', text: outs[calls.length - 1]}]};
  }}};
};

test('valid draft passes and is written, no overwrite', async () => {
  const c = mk(['```json\n' + JSON.stringify(good) + '\n```']);
  const ep = await draftEpisode({client: c, topic: 't', id: 'ep-test', voice: FALLBACK_VOICE});
  assert.equal(ep.id, 'ep-test');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-'));
  assert.ok(writeDraft(dir, ep).endsWith('ep-test/episode.json'));
  assert.throws(() => writeDraft(dir, ep));
});

test('retries once with errors fed back', async () => {
  const bad = {...good, sources: [], scenes: [{type: 'big_number', narration: 'Three percent.', value: 3, label: 'rate'}]};
  const c = mk([JSON.stringify(bad), JSON.stringify(good)]);
  await draftEpisode({client: c, topic: 't', id: 'ep-test', voice: FALLBACK_VOICE});
  assert.equal(c.calls.length, 2);
  assert.match(c.calls[1].messages[2].content, /sources/);
});

test('autoFix drops banned sentences, forces disclaimer, shortens a long hook', async () => {
  const {autoFixEpisode} = await import('./lint.js');
  const ep = autoFixEpisode({...good, disclaimer: false, scenes: [{type: 'talk', emotion: 'neutral', emphasis: [], narration: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen. Second.'}, {type: 'talk', emotion: 'neutral', emphasis: [], narration: 'Prices rose. This is not financial advice. Save more.'}]} as any);
  assert.equal(ep.disclaimer, true);
  assert.equal(ep.scenes[0].narration.split(' ').length, 15);
  assert.equal(ep.scenes[1].narration, 'Prices rose. Save more.');
});

test('fails after fourth invalid output', async () => {
  const c = mk(['nope', 'still nope', 'nope3', 'nope4']);
  await assert.rejects(draftEpisode({client: c, topic: 't', id: 'ep-test', voice: FALLBACK_VOICE}), /after retry/);
  assert.equal(c.calls.length, 4);
});

test('repairDraft fixes small-model schema drift without inventing numbers', async () => {
  const {repairDraft} = await import('./draft.js');
  const r = repairDraft({sources: ['not a url', 'https://a.com/x'], scenes: [
    {type: 'talk', narration: 'hi', emotion: 'Surprised'},
    {type: 'compare', narration: 'x', emotion: 'zzz', left: {label: 'A'}, right: {title: 'B', value: 5}},
    {type: 'weird', text: 'fallback text'}]});
  assert.deepEqual(r.sources, ['https://a.com/x']);
  assert.equal(r.scenes[0].emotion, 'shocked');
  assert.deepEqual(r.scenes[1].left, {title: 'A', value: ''});
  assert.equal(r.scenes[1].right.value, '5');
  assert.equal(r.scenes[2].type, 'talk'); assert.equal(r.scenes[2].narration, 'fallback text');
});

test('punchUpHook accepts a valid sharper hook, rejects a long one', async () => {
  const {punchUpHook} = await import('./draft.js');
  const ep: any = {...good, scenes: [{type: 'talk', emotion: 'neutral', emphasis: [], narration: 'Savings lose value.'}], disclaimer: true};
  const ok = await punchUpHook(mk([JSON.stringify({hook: 'Your savings lose three dollars of power every hundred.'})]), ep);
  assert.equal(ok.scenes[0].narration, 'Your savings lose three dollars of power every hundred.');
  const long = await punchUpHook(mk([JSON.stringify({hook: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'})]), ep);
  assert.equal(long.scenes[0].narration, 'Savings lose value.');
});

test('expandThin lengthens thin scenes, never the hook, rejects new numbers', async () => {
  const {expandThin} = await import('./draft.js');
  const sc = (n: string) => ({type: 'talk', emotion: 'neutral', emphasis: [], narration: n});
  const ep: any = {...good, scenes: [sc('Hook line.'), sc('Short one.'), sc('Another short.')], disclaimer: true};
  const long = 'This is a much longer line that explains the idea in plain words, with a little dry humour, so the viewer actually follows along.';
  const c = mk([JSON.stringify({narration: long}), JSON.stringify({narration: 'It grew by 99 percent every single year without fail, which is a number nobody gave us at all, honestly.'})]);
  const out = await expandThin(c, ep, {targetWords: 500});
  assert.equal(out.scenes[0].narration, 'Hook line.');
  assert.equal(out.scenes[1].narration, long);
  assert.equal(out.scenes[2].narration, 'Another short.');
});
