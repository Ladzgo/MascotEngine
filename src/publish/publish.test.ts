import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Episode} from '../schema.js';
import {buildChapters, buildDescription, buildPack, fmtTime, fallbackTags, shortTitle} from './publish.js';

const talk = (n: string) => ({type: 'talk', narration: n});
const ep = Episode.parse({
  id: 'e', title: 'Inflation explained', disclaimer: true, sources: ['https://www.bls.gov/cpi/'],
  scenes: [
    {type: 'title', narration: 'Your cash loses value.'}, talk('Prices go up every year.'),
    {type: 'big_number', narration: 'Three percent.', value: 3, label: 'CPI', suffix: '%'},
    talk('Savings pay less.'), talk('So what now?'), talk('That is it.'),
  ],
});
const times = [0, 5, 12, 20, 26, 33].map((startSec, index) => ({index, startSec}));

test('chapters obey YouTube rules', () => {
  const ch = buildChapters(ep.scenes, times, 40, ep.title);
  assert.equal(ch[0].startSec, 0);
  assert.ok(ch.length >= 3);
  ch.forEach((c, i) => { if (i) assert.ok(c.startSec - ch[i - 1].startSec >= 10); });
  assert.ok(40 - ch[ch.length - 1].startSec >= 10);
  assert.equal(ch[1].title, 'CPI');
  assert.deepEqual(buildChapters(ep.scenes, times, 20), []);
  assert.equal(fmtTime(75), '1:15');
});

test('description has all parts', () => {
  const d = buildDescription(ep, buildChapters(ep.scenes, times, 40, ep.title));
  assert.match(d, /^Your cash loses value\./);
  assert.match(d, /0:00 Inflation explained/);
  assert.match(d, /1\. https:\/\/www\.bls\.gov/);
  assert.match(d, /not financial advice/);
  assert.match(d, /AI-generated voice/);
  assert.doesNotMatch(buildDescription({...ep, disclaimer: false}, []), /not financial advice/);
});

const good = {titles: ['a title','b title','c title','d title','e title'], tags: ['money','cpi','prices'], thumbnailText: ['Cash is melting', 'Prices up', 'Why']};
const mk = (outs: string[]) => {
  const calls: any[] = [];
  return {calls, messages: {async create(a: any) {
    calls.push(JSON.parse(JSON.stringify(a)));
    return {content: [{type: 'text', text: outs[calls.length - 1]}]};
  }}};
};
const o = {ep, timings: times, totalSec: 40, warn: () => {}};

test('ai path, retry, and fallback', async () => {
  const p = await buildPack({...o, client: mk([JSON.stringify(good)])});
  assert.equal(p.source, 'ai');
  assert.equal(p.titles.length, 5);
  const c = mk([JSON.stringify({...good, thumbnailText: ['one two three four five', 'a', 'b']}), JSON.stringify(good)]);
  assert.equal((await buildPack({...o, client: c})).source, 'ai');
  assert.equal(c.calls.length, 2);
  const bad = mk(['x', 'y']);
  const f = await buildPack({...o, client: bad});
  assert.equal(f.source, 'fallback');
  assert.equal(f.titles.length, 5);
  assert.ok(f.chapters.length >= 3);
  const none = await buildPack(o);
  assert.equal(none.source, 'fallback');
  assert.ok(none.thumbnailText.every(t => t.split(/\s+/).length <= 4));
});

test('chapter titles are human readable', () => {
  const e = Episode.parse({id: 'x', title: 'Why Your Savings Are Quietly Shrinking', sources: [], scenes: [
    {type: 'title', narration: 'a'}, {type: 'talk', narration: 'b', emphasis: ['goes down']},
    {type: 'big_number', narration: 'c', value: 7441, prefix: '$', label: 'real value of $10,000 after 10 years at 3% inflation'},
    {type: 'chart', narration: 'd', chart: {kind: 'line', labels: ['0', '1'], values: [1, 2], yLabel: 'buying power ($)'}},
    {type: 'compare', narration: 'e', left: {title: 'Typical savings rate', value: '0.5%'}, right: {title: 'Inflation', value: '3%'}},
    {type: 'list', narration: 'f', items: ['High-yield savings for your emergency fund']},
    {type: 'talk', narration: "Let's go through each one."},
  ]});
  const ts = [0, 3.5, 7.5, 16.8, 21.6, 26.9, 33.8].map((startSec, index) => ({index, startSec}));
  const ch = buildChapters(e.scenes, ts, 37, e.title);
  assert.deepEqual(ch.map(c => [c.startSec, c.title]), [[0, 'Savings Are Shrinking'], [16, 'Buying power over time'], [26, 'What to do: High-yield savings']]);
  assert.equal(shortTitle(e.title), 'Savings Are Shrinking');
  const wide = buildChapters(e.scenes, ts.map((t, k) => ({...t, startSec: k * 12})), 100, e.title).map(c => c.title);
  assert.equal(wide.length, 7);
  wide.forEach(t => assert.doesNotMatch(t, /[$%()\d]/));
  assert.ok(wide.includes('Real value'));
  assert.ok(wide.includes('Typical savings rate vs Inflation'));
});

test('fallback tags: no junk, phrases, limits', () => {
  const e = Episode.parse({id: 'x', title: 'Why Your Savings Are Quietly Shrinking', series: 'money-myths', sources: ['https://www.bls.gov/cpi/'], scenes: [{type: 'title', narration: 'a', emphasis: ['goes down']}]});
  const tags = fallbackTags(e);
  assert.ok(tags.length <= 15 && tags.join(',').length < 450);
  for (const bad of ['your', 'quietly', 'why', 'are']) assert.ok(!tags.some(t => t.split(' ').includes(bad)), bad);
  assert.ok(tags.includes('money myths') && tags.includes('savings shrinking') && tags.includes('bls'));
});

import {fixPack, validatePack, fallbackMeta} from './publish.js';
test('validatePack flags YouTube rule violations; fixPack repairs the fixable ones', () => {
  const bad: any = {titles: ['x'.repeat(101), 'ok <b>'], description: 'a <b> ' + 'word '.repeat(1100), tags: ['fine', 'y'.repeat(31)], chapters: [{startSec: 5, title: 'a'}, {startSec: 8, title: ''}]};
  const msgs = validatePack(bad);
  for (const m of ['max 100', 'contains < or >', 'max 5000', 'over 30', '0:00', 'at least 3', 'shorter than']) assert.ok(msgs.some(x => x.includes(m)), m);
  const fixed = fixPack({...bad, thumbnailText: [], source: 'fallback'});
  assert.ok(!validatePack({...fixed, chapters: []}).some(x => /max 100|< or >|max 5000|over 30/.test(x)));
});

import {toVtt, vttTime} from './subtitles.js';
test('vtt: header, timestamps with dots, word tags', () => {
  assert.equal(vttTime(3723.5), '01:02:03.500');
  const v = toVtt([{start: 1, end: 2, words: [{w: 'Hello', start: 1, end: 1.4}, {w: 'world.', start: 1.5, end: 2}]}]);
  assert.match(v, /^WEBVTT\n\n00:00:01\.000 --> 00:00:02\.200\nHello <00:00:01\.500><c>world\.<\/c>/);
});

import {buildPack, categoryFor, kindOf, pinnedComment} from './publish.js';
import {PRESETS} from '../channel/presets.js';
import {Channel} from '../channel/channel.js';
test('publish pack follows the channel voice: titles, category, pinned comment, AI prompt', async () => {
  const ep = Episode.parse({id: 'x', title: 'How Wi-Fi Reaches Your Phone', series: 's', sources: ['https://example.org/a'], scenes: [{type: 'title', narration: 'Your router shouts in a language your phone understands.'}]});
  const tech = Channel.parse({id: 't', ...PRESETS.tech});
  assert.equal(kindOf(tech.niche), 'tech');
  assert.equal(kindOf(PRESETS.finance.niche), 'finance');
  assert.equal(kindOf(PRESETS.history.niche), 'history');
  assert.equal(categoryFor('tech').id, 28);
  const p = await buildPack({ep, timings: [{index: 0, startSec: 0}], totalSec: 40, channel: tech, warn: () => {}});
  assert.ok(p.titles.some(t => /How it works|explained simply|really happening/.test(t)), p.titles.join(' | '));
  assert.ok(!p.titles.some(t => /the maths/.test(t)));
  assert.deepEqual(p.category, {id: 28, name: 'Science & Technology'});
  assert.match(p.pinnedComment!, /explain next/);
  assert.match(p.pinnedComment!, /Sources are listed/);
  assert.ok(p.uploadNotes!.some(n => /pin/i.test(n)));
  assert.equal(p.titles.length >= 5 ? p.titles.length : 5, 5);
  const fin = pinnedComment(Episode.parse({...ep, disclaimer: true}), 'finance');
  assert.match(fin, /not financial advice/);
  // AI prompt carries the channel's voice
  let sys = '';
  const client = {messages: {async create(a: any) { sys = a.system; return {content: [{type: 'text', text: JSON.stringify({titles: ['a long title one', 'a long title two', 'a long title three', 'a long title four', 'a long title five'], tags: ['one', 'two', 'three'], thumbnailText: ['Wi-Fi', 'Radio waves', 'Why slow']})}]}; }}};
  const q = await buildPack({ep, timings: [{index: 0, startSec: 0}], totalSec: 40, channel: tech, client: client as any, warn: () => {}});
  assert.equal(q.source, 'ai');
  assert.match(sys, /How It Works/);
  assert.match(sys, /Friendly and precise/);
});
