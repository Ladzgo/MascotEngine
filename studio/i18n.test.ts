import test from 'node:test';
import assert from 'node:assert/strict';
import {HU, translate} from './web/src/i18n.js';

test('translate: hu uses the dictionary, unknown and en stay English', () => {
  assert.equal(translate('Library', 'hu'), 'Könyvtár');
  assert.equal(translate('Library', 'en'), 'Library');
  assert.equal(translate('No such string', 'hu'), 'No such string');
});
test('every nav page and step label has a Hungarian entry', () => {
  for (const k of ['Today', 'Pipeline', 'Library', 'Ideas', 'Clipper', 'Analytics', 'Channels', 'Settings', 'Queue', 'Calendar', 'Script', 'Voice', 'Visuals', 'Render', 'Publish']) assert.ok(HU[k], k);
});

// every t('literal') / tr('literal') in the pages has a Hungarian entry (keys are the English text)
test('every translated literal in the Studio pages has a Hungarian entry', async () => {
  const fs = await import('node:fs'), dir = new URL('./web/src/', import.meta.url).pathname;
  const missing: string[] = [];
  for (const f of fs.readdirSync(dir).filter(x => /\.tsx?$/.test(x) && x !== 'i18n.ts')) {
    const src = fs.readFileSync(dir + f, 'utf8');
    for (const m of src.matchAll(/\bt[r]?\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) { const k = m[1].replace(/\\'/g, "'"); if (!HU[k]) missing.push(`${f}: ${k}`); }
  }
  assert.deepEqual(missing, []);
});
test('no empty Hungarian values', () => { for (const [k, v] of Object.entries(HU)) assert.ok(v.trim(), k); });
