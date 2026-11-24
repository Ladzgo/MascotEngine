import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchHeadlines, parseNewsRss, scoutFocus} from './scout.js';

const xml = (items: string[]) => `<rss><channel>${items.map(t => `<item><title>${t}</title><link>https://x.test/${encodeURIComponent(t)}</link><source url="https://s">Src</source></item>`).join('')}</channel></rss>`;

test('parses items, strips publisher suffix, decodes entities', () => {
  const h = parseNewsRss(xml(['Fed holds rates &amp; markets shrug - Src']));
  assert.equal(h[0].title, 'Fed holds rates & markets shrug'); assert.equal(h[0].source, 'Src');
});

test('fetchHeadlines dedupes, drops banned topics, survives failures', async () => {
  let n = 0;
  const fetchFn = (async () => { n++; if (n === 2) throw new Error('offline'); return new Response(xml(['Inflation cools again in October', 'Inflation cools again in October!', 'Crypto casino bonanza'])); }) as typeof fetch;
  const hs = await fetchHeadlines({niche: 'personal finance', extra: ['savings'], banned: ['crypto'], fetchFn});
  assert.deepEqual(hs.map(h => h.title), ['Inflation cools again in October']);
  assert.match(scoutFocus(hs), /Fresh news/);
  assert.equal(scoutFocus([]), '');
});

import {dropUsed, nicheSeeds} from './scout.js';
test('dropUsed removes headlines that overlap our own titles; niche seeds per family', () => {
  const hs = [{title: 'Why inflation is eating your savings account', url: 'u', source: 's'}, {title: 'Mortgage rates fall again this week', url: 'u2', source: 's'}];
  assert.deepEqual(dropUsed(hs, ['Why Your Savings Are Quietly Shrinking: inflation']).map(h => h.url), ['u2']);
  assert.ok(nicheSeeds('consumer tech explained').some(q => /chip/.test(q)));
  assert.ok(nicheSeeds('ancient history').some(q => /archaeology/.test(q)));
  assert.deepEqual(nicheSeeds('cooking'), []);
});

test('Hungarian channel: news query uses hl=hu and Hungarian seeds; accented words count for dedup', async () => {
  const urls: string[] = [];
  const fetchFn = (async (u: string) => { urls.push(u); return {ok: true, text: async () => '<rss><channel><item><title>Infláció: mennyit ér a megtakarításod - Portfolio</title><link>l</link><source>Portfolio</source></item></channel></rss>'}; }) as unknown as typeof fetch;
  const hs = await fetchHeadlines({niche: 'személyes pénzügyek', lang: 'hu', fetchFn});
  assert.ok(urls.length >= 4 && urls.every(u => /hl=hu&gl=HU&ceid=HU:hu/.test(u)));
  assert.ok(urls.some(u => /infl%C3%A1ci%C3%B3/.test(u)));
  assert.equal(hs[0].title, 'Infláció: mennyit ér a megtakarításod');
  assert.equal(dropUsed(hs, ['Mennyit ér a megtakarításod az infláció mellett']).length, 0);
});
