import test from 'node:test';
import assert from 'node:assert/strict';
import {grounded, researchFacts} from './facts.js';

const SRC = 'Cabin pressure is kept at about 11.8 psi. The breather hole in the middle pane is roughly 1.5 mm across and equalises pressure between panes.';
test('grounded: numbers and most content words must be in the source', () => {
  assert.ok(grounded('The breather hole in the middle pane is about 1.5 mm across.', SRC));
  assert.ok(!grounded('The breather hole is 3 mm across.', SRC)); // number not in source
  assert.ok(!grounded('Pilots tap the windows twice before takeoff at 1.5 mm.', SRC)); // wording not in source
  assert.ok(!grounded('The hole equalises pressure between panes.', SRC)); // no number
});
test('researchFacts: article titles -> fetched text -> only grounded facts, with source URL', async () => {
  const client = {messages: {create: async (r: {system: string}) => ({content: [{type: 'text', text: /article titles/.test(r.system)
    ? JSON.stringify({titles: ['Aircraft cabin', 'Nope']})
    : JSON.stringify({facts: ['The breather hole in the middle pane is roughly 1.5 mm across.', 'Windows are 9 inches thick.']})}]})}} as any;
  const fetcher = async (u: string) => new Response(JSON.stringify({query: {pages: /Nope/.test(decodeURIComponent(u)) ? {'-1': {missing: ''}} : {'1': {title: 'Aircraft cabin', extract: SRC, fullurl: 'https://en.wikipedia.org/wiki/Aircraft_cabin'}}}}));
  const f = await researchFacts(client, 'airplane window holes', {fetcher: fetcher as any});
  assert.equal(f.length, 1);
  assert.equal(f[0].source, 'https://en.wikipedia.org/wiki/Aircraft_cabin');
  assert.deepEqual(f[0].numbers, [1.5]);
});
