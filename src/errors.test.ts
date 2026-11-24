import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendlyError} from './errors.js';

test('friendlyError names the problem and the fix, unknown errors pass through', () => {
  assert.match(friendlyError('Error: spawnSync ffmpeg ENOENT'), /ffmpeg is not installed/);
  assert.match(friendlyError('TypeError: fetch failed ... ECONNREFUSED 127.0.0.1:11434'), /Ollama\) is not running/);
  assert.match(friendlyError('model "qwen2.5:7b" not found, try pulling it first'), /ollama pull/);
  assert.match(friendlyError('whisper-cli: command not found ENOENT'), /whisper/);
  assert.equal(friendlyError('something unrelated'), 'something unrelated');
});
