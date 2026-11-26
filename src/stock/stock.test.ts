import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chooseStock, creditLines, fetchStock, rank, searchStock, stockForEpisode} from './index.js';
import type {StockHit} from './providers.js';

const png = Buffer.from('89504e470d0a1a0a', 'hex');
/** Fake network: routes by hostname, counts hits. */
const net = (routes: Record<string, any>) => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    if (url.includes('/img/')) return new Response(png);
    const host = new URL(url).hostname, r = routes[host];
    if (r === undefined) return new Response('nope', {status: 404});
    return new Response(JSON.stringify(typeof r === 'function' ? r(url) : r));
  };
  return {calls, fetcher};
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stock-'));
const wiki = {query: {pages: {'1': {pageid: 1, title: 'File:Coins.jpg', imageinfo: [{thumburl: 'https://upload.wikimedia.org/img/coins.jpg', thumbwidth: 1200, thumbheight: 1600, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Coins.jpg', extmetadata: {LicenseShortName: {value: 'CC BY 4.0'}, Artist: {value: '<a>Jane</a>'}}}]},
  '2': {pageid: 2, title: 'File:Nc.jpg', imageinfo: [{thumburl: 'https://upload.wikimedia.org/img/nc.jpg', thumbwidth: 1200, thumbheight: 1600, descriptionurl: 'x', extmetadata: {LicenseShortName: {value: 'CC BY-NC 2.0'}}}]},
  '3': {pageid: 3, title: 'File:Sa.jpg', imageinfo: [{thumburl: 'https://upload.wikimedia.org/img/sa.jpg', thumbwidth: 1200, thumbheight: 1600, descriptionurl: 'x', extmetadata: {LicenseShortName: {value: 'CC BY-SA 3.0'}}}]}}}};

test('keyless: Wikimedia only yields CC0/PD/CC BY, downloads once and caches by hash', async () => {
  const n = net({'commons.wikimedia.org': wiki, 'api.openverse.org': {results: []}}), dir = tmp();
  const a = await fetchStock({query: 'coins', kind: 'photo', format: 'short', env: {}, fetcher: n.fetcher, cacheDir: dir});
  assert.equal(a?.hit.provider, 'wikimedia'); assert.equal(a?.hit.license, 'CC BY 4.0'); assert.equal(a?.hit.author, 'Jane');
  assert.ok(fs.existsSync(a!.file));
  const downloads = () => n.calls.filter(c => c.includes('/img/')).length;
  assert.equal(downloads(), 1);
  await fetchStock({query: 'coins', kind: 'photo', format: 'short', env: {}, fetcher: n.fetcher, cacheDir: dir});
  assert.equal(downloads(), 1, 'second fetch reads the cache');
});

test('Pixabay is preferred when keyed; a provider error falls through to the keyless ones', async () => {
  const hit = {hits: [{id: 7, imageWidth: 1600, imageHeight: 2400, pageURL: 'https://pixabay.com/photos/7', user: 'Sam', tags: 'coins, table', largeImageURL: 'https://pixabay.com/img/7.jpg'}]};
  const n = net({'pixabay.com': hit}), dir = tmp();
  const a = await fetchStock({query: 'coins', kind: 'photo', format: 'short', env: {PIXABAY_API_KEY: 'k'}, fetcher: n.fetcher, cacheDir: dir});
  assert.equal(a?.hit.provider, 'pixabay'); assert.equal(a?.hit.license, 'Pixabay License');
  assert.equal((await fetchStock({query: 'coins', kind: 'photo', format: 'short', env: {}, fetcher: net({'commons.wikimedia.org': wiki}).fetcher, cacheDir: tmp()}))?.hit.provider, 'wikimedia', 'no key: keyless providers');
  const down = net({'commons.wikimedia.org': wiki}); // pixabay host 404s -> falls back
  const b = await fetchStock({query: 'x', kind: 'photo', format: 'short', env: {PIXABAY_API_KEY: 'k'}, fetcher: down.fetcher, cacheDir: tmp()});
  assert.equal(b?.hit.provider, 'wikimedia');
});

test('video without a keyed provider falls back to a photo; nothing found = null', async () => {
  const n = net({'commons.wikimedia.org': wiki});
  assert.equal((await fetchStock({query: 'coins', kind: 'video', format: 'short', env: {}, fetcher: n.fetcher, cacheDir: tmp()}))?.hit.kind, 'photo');
  assert.equal(await fetchStock({query: 'zzz', kind: 'photo', format: 'wide', env: {}, fetcher: net({}).fetcher, cacheDir: tmp()}), null);
});

test('rank: right orientation and no faces/logos first, tiny images dropped', () => {
  const h = (id: string, w: number, hh: number, title: string): StockHit => ({id, provider: 'pexels', kind: 'photo', url: `https://x/${id}.jpg`, width: w, height: hh, pageUrl: 'p', author: 'a', license: 'l', title});
  const r = rank([h('face', 1080, 1920, 'portrait of a woman'), h('wide', 2400, 1600, 'coins'), h('tiny', 300, 400, 'coins'), h('ok', 1080, 1920, 'coins on table')], {query: 'coins', kind: 'photo', orientation: 'portrait'}, 'short');
  assert.deepEqual(r.map(x => x.id), ['ok', 'wide']); // the face photo shares no word with the query, so it is dropped while relevant hits exist
});

test('stockForEpisode writes stock.json with credit lines, skips beats without stock', async () => {
  const n = net({'commons.wikimedia.org': wiki}), dir = tmp(), ep = tmp();
  const items = await stockForEpisode(ep, [{}, {stock: {query: 'coins', kind: 'photo'}}], 'short', {env: {}, fetcher: n.fetcher, cacheDir: dir});
  assert.equal(items.length, 1); assert.equal(items[0].scene, 1);
  const j = JSON.parse(fs.readFileSync(path.join(ep, 'stock.json'), 'utf8'));
  assert.match(j.credits[0], /by Jane \(CC BY 4\.0\) https:\/\/commons\.wikimedia\.org/);
  assert.equal(creditLines([...items, ...items]).length, 1);
  // second run: same query and file present -> no network at all, progress still reported
  let calls = 0, prog = 0;
  const again = await stockForEpisode(ep, [{}, {stock: {query: 'coins', kind: 'photo'}}], 'short', {env: {}, fetcher: async () => { calls++; throw new Error('offline'); }, cacheDir: dir, progress: () => { prog++; }});
  assert.equal(calls, 0); assert.equal(prog, 1); assert.equal(again.length, 1);
});

import {pixabayGateForTests, resetPixabayGate, testPixabayKey} from './providers.js';
test('Pixabay rate gate waits instead of exceeding 100 requests per minute; key test maps statuses', async () => {
  resetPixabayGate();
  let now = 1_000_000, slept = 0;
  const sleep = async (ms: number) => { slept += ms; now += ms; };
  for (let i = 0; i < 96; i++) await pixabayGateForTests(() => now, sleep);
  assert.ok(slept > 0 && slept <= 61000, `waited ${slept} ms for the 96th request`);
  const f = (status: number, body: any = {totalHits: 5}) => async () => new Response(JSON.stringify(body), {status});
  resetPixabayGate();
  assert.equal((await testPixabayKey('k', f(200))).ok, true);
  assert.match((await testPixabayKey('k', f(400))).message, /rejected/);
  assert.match((await testPixabayKey('k', f(429))).message, /Rate limit/);
});

test('Swap image: searchStock lists ranked candidates, chooseStock rewrites that beat and survives a re-run', async () => {
  const n = net({'commons.wikimedia.org': wiki, 'api.openverse.org': {results: []}}), dir = tmp(), ep = tmp();
  const hits = await searchStock({query: 'coins', kind: 'photo', format: 'short', env: {}, fetcher: n.fetcher, cacheDir: dir});
  assert.ok(hits.length >= 1);
  const rec = await chooseStock(ep, 2, {query: 'coins', kind: 'photo'}, hits[hits.length - 1], 'short', {fetcher: n.fetcher, cacheDir: dir});
  assert.equal(rec?.scene, 2); assert.equal(JSON.parse(fs.readFileSync(path.join(ep, 'stock.json'), 'utf8')).items[0].file, rec!.file);
  const again = await stockForEpisode(ep, [{}, {}, {stock: {query: 'coins', kind: 'photo'}}], 'short', {env: {}, fetcher: async () => { throw new Error('offline'); }, cacheDir: dir});
  assert.equal(again[0].file, rec!.file);
});

test('topic gate: a hit must name the video topic; the retry anchors the query on it (en-sleep: "hands writing" for a sleep video)', async () => {
  const h = (id: string, tags: string): StockHit => ({id, provider: 'pixabay', kind: 'photo', url: `https://x/img/${id}.jpg`, width: 1080, height: 1920, pageUrl: 'p', author: 'a', license: 'l', title: tags, tags});
  const a = {query: 'hands writing diary', kind: 'photo' as const, orientation: 'portrait' as const};
  assert.deepEqual(rank([h('pen', 'hand, writing, pen'), h('bed', 'sleep, hands, writing, diary, bed')], a, 'short', ['sleep']).map(x => x.id), ['bed']);
  // an idea beat may leave the topic when the hit names every word of the concept ("if you invested" -> stock market screen in a coffee video)
  assert.deepEqual(rank([h('mkt', 'stock market, screen, trading')], {...a, query: 'stock market screen'}, 'short', ['coffee']).map(x => x.id), ['mkt']);
  assert.equal(rank([h('pen', 'hand, writing, pen')], a, 'short').length, 1); // no topic = old behaviour
  const seen: string[] = [];
  const {fetcher} = net({'pixabay.com': (u: string) => { const q = new URL(u).searchParams.get('q')!; seen.push(q); return {hits: q.startsWith('sleep') ? [{id: 9, largeImageURL: 'https://x/img/b.jpg', imageWidth: 1080, imageHeight: 1920, pageURL: 'p', user: 'u', tags: 'sleep, open, book'}] : [{id: 1, largeImageURL: 'https://x/img/a.jpg', imageWidth: 1080, imageHeight: 1920, pageURL: 'p', user: 'u', tags: 'open, book, library'}]}; }}); // names 2 of 3 words, no topic: rejected
  const got = await fetchStock({query: 'open book desk', kind: 'photo', format: 'short', env: {PIXABAY_API_KEY: 'k'}, fetcher, cacheDir: tmp(), topic: ['sleep', 'memory']});
  assert.equal(got?.hit.id, 'pixabay-9');
  assert.deepEqual(seen, ['open book desk', 'sleep open book']);
});
