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
