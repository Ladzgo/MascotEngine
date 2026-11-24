import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chat, resolveProvider, extractJson, pickModel} from './llm.js';

const realFetch = globalThis.fetch;
const mockFetch = (fn: (url: string, init?: any) => Response | Promise<Response>) => { globalThis.fetch = ((u: any, i: any) => Promise.resolve(fn(String(u), i))) as any; };
const restore = () => { globalThis.fetch = realFetch; };
const j = (o: unknown, status = 200) => new Response(JSON.stringify(o), {status});

test('extractJson tolerates fences, prose and trailing commas', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": [1,2,],}\n```\nDone'), {a: [1, 2]});
});

test('extractJson repairs truncated and smart-quote output', () => {
  assert.deepEqual(extractJson('{"a": [1, 2], "b": {"c": "x"}'), {a: [1, 2], b: {c: 'x'}});
  assert.deepEqual(extractJson('noise {"t": "a } b"} trailing {x}'), {t: 'a } b'});
});

test('pickModel prefers good installed instruct models, skips vision/embedding', () => {
  assert.equal(pickModel(['llava:latest', 'qwen2.5vl:7b', 'llama3.2:latest', 'qwen2.5:1.5b']), 'llama3.2:latest');
  assert.equal(pickModel(['llama3.2:latest', 'qwen2.5:7b']), 'qwen2.5:7b');
  assert.equal(pickModel(['llava:latest', 'nomic-embed-text:latest']), null);
  assert.equal(pickModel(['llama3.2:latest'], 'mistral'), null);
});

test('provider is keyless ollama by default; keys need explicit LLM_PROVIDER', async () => {
  assert.equal(await resolveProvider({ANTHROPIC_API_KEY: 'x', GEMINI_API_KEY: 'y'}), 'ollama');
  assert.equal(await resolveProvider({}), 'ollama');
  assert.equal(await resolveProvider({LLM_PROVIDER: 'gemini'}), 'gemini');
  await assert.rejects(resolveProvider({LLM_PROVIDER: 'nope'}), /Unknown LLM_PROVIDER/);
});

test('gemini: json mode, 429 retry then clear error', async () => {
  let n = 0, body: any;
  mockFetch((_u, init) => { n++; body = JSON.parse(init.body); return j({}, 429); });
  try {
    await assert.rejects(chat({system: 's', json: true, messages: [{role: 'user', content: 'u'}], env: {LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', LLM_RETRY_MS: '1'}}), /Gemini free quota reached, try later/);
    assert.equal(n, 2);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    mockFetch(() => j({candidates: [{content: {parts: [{text: '{"ok":1}'}]}}]}));
    assert.equal(await chat({system: 's', messages: [{role: 'user', content: 'u'}], env: {LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k'}}), '{"ok":1}');
  } finally { restore(); }
});

test('ollama: not running, model listing and chat', async () => {
  const env = {LLM_PROVIDER: 'ollama', OLLAMA_MODEL: 'llama3.2', OLLAMA_AUTOSTART: '0'};
  const msgs = [{role: 'user' as const, content: 'u'}];
  mockFetch(() => { throw new Error('ECONNREFUSED'); });
  try {
    await assert.rejects(chat({system: 's', messages: msgs, env}), /not running/);
    mockFetch(u => u.endsWith('/api/tags') ? j({models: [{name: 'llama3.2:latest'}]}) : j({message: {content: 'hi'}}));
    assert.equal(await chat({system: 's', messages: msgs, env}), 'hi');
  } finally { restore(); }
});
