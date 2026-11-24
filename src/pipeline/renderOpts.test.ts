import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromiumTuning} from './renderOpts.js';

test('chromiumTuning: angle on macOS, default elsewhere, RENDER_GL overrides', () => {
  assert.deepEqual(chromiumTuning({}, 'darwin'), {gl: 'angle'});
  assert.deepEqual(chromiumTuning({}, 'linux'), {});
  assert.deepEqual(chromiumTuning({RENDER_GL: 'angle'}, 'linux'), {gl: 'angle'});
  assert.deepEqual(chromiumTuning({RENDER_GL: 'default'}, 'darwin'), {});
});
