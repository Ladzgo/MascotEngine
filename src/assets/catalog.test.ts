import assert from 'node:assert/strict';
import test from 'node:test';
import {CATALOG, LICENSES, credits, search} from './catalog.js';
import {backdrops} from '../../scripts/assets/backdrops.js';

test('every catalog entry is free to use and credits what needs credit', () => {
  const ids = new Set<string>();
  for (const a of CATALOG) {
    assert.ok((LICENSES as readonly string[]).includes(a.license), `${a.id}: ${a.license}`);
    assert.ok(a.attribution.length > 3, a.id);
    assert.ok(/^lib\/[a-z0-9/_.-]+$/.test(a.file), a.file);
    assert.ok(!ids.has(a.id), `duplicate ${a.id}`); ids.add(a.id);
  }
});

test('search ranks tag hits, filters by kind, and is deterministic', () => {
  if (!CATALOG.length) return; // catalog not fetched yet
  const coin = search('coins', {kind: 'object'});
  assert.ok(coin.length && coin.every(a => a.kind === 'object'));
  assert.ok(coin.slice(0, 5).some(a => a.tags.some(t => t.includes('coin'))));
  assert.deepEqual(search('happy person').map(a => a.id), search('happy person').map(a => a.id));
  assert.equal(search('').length, 0);
  assert.ok(search('night city', {kind: 'background'}).length);
  const noto = CATALOG.find(a => a.license === 'CC-BY-4.0');
  if (noto) assert.ok(credits([noto.id, noto.id])[0].includes('CC BY'));
});

test('procedural backdrops are deterministic, valid-looking SVG', () => {
  const a = backdrops(), b = backdrops();
  assert.equal(a.length, 80);
  assert.equal(a[17].svg, b[17].svg);
  assert.ok(a.every(x => x.svg.startsWith('<svg') && x.svg.endsWith('</svg>') && !/NaN/.test(x.svg)));
});
