import {test} from 'node:test';
import assert from 'node:assert/strict';
import {redact, secretValues} from './redact.js';

test('redact removes env secrets, token shapes and KEY= lines', () => {
  const env = {ELEVENLABS_API_KEY: 'abcdef123456', OLLAMA_MODEL: 'qwen2.5:7b'};
  const out = redact('call with abcdef123456 and sk-ant-aaaaaaaaaaaaaaaaaaaa\nANTHROPIC_API_KEY=whatever\nmodel qwen2.5:7b', secretValues(env));
  assert.ok(!/abcdef123456|sk-ant|whatever/.test(out));
  assert.ok(out.includes('qwen2.5:7b'));
});
