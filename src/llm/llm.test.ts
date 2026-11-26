import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chat, resolveProvider, extractJson, pickModel, pickGemini, testProvider} from './llm.js';

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
    await assert.rejects(chat({system: 's', json: true, messages: [{role: 'user', content: 'u'}], env: {LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', LLM_RETRY_MS: '1'}}), /Gemini free quota reached, try later/);
    assert.equal(n, 2);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    mockFetch(() => j({candidates: [{content: {parts: [{text: '{"ok":1}'}]}}]}));
    assert.equal(await chat({system: 's', messages: [{role: 'user', content: 'u'}], env: {LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm'}}), '{"ok":1}');
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

test('gemini model comes from the key\'s /models list; AQ. keys get a plain message', () => {
  assert.equal(pickGemini(['models/gemini-2.5-flash-lite', 'models/gemini-3.0-flash', 'models/gemini-2.5-pro', 'models/gemini-3.0-flash-preview', 'models/embedding-001']), 'gemini-3.0-flash');
  assert.equal(pickGemini(['models/text-bison']), null);
});

test('gemini auto model: lists models once, then generates; AQ. 401 is explained', async () => {
  const urls: string[] = [];
  mockFetch(u => { urls.push(u); return u.includes('generateContent') ? j({candidates: [{content: {parts: [{text: 'yo'}]}}]}) : j({models: [{name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent']}]}); });
  try {
    const env = {LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k-auto'};
    assert.equal(await chat({system: 's', messages: [{role: 'user', content: 'u'}], env}), 'yo');
    assert.ok(urls.some(u => u.includes('models/gemini-3.0-flash:generateContent')));
    mockFetch(() => j({error: {status: 'ACCESS_TOKEN_TYPE_UNSUPPORTED'}}, 401));
    await assert.rejects(chat({system: 's', messages: [{role: 'user', content: 'u'}], env: {...env, GEMINI_API_KEY: 'AQ.x'}}), /AIza/);
  } finally { restore(); }
});

test('groq and openrouter: OpenAI format, bearer key, json mode, testProvider never throws', async () => {
  let seen: any;
  mockFetch((u, init) => { seen = {u, auth: init.headers.Authorization, body: JSON.parse(init.body)}; return j({choices: [{message: {content: 'OK'}}]}); });
  try {
    const m = [{role: 'user' as const, content: 'u'}];
    assert.equal(await chat({system: 's', messages: m, json: true, env: {LLM_PROVIDER: 'groq', GROQ_API_KEY: 'gsk_1'}}), 'OK');
    assert.match(seen.u, /api\.groq\.com/); assert.equal(seen.auth, 'Bearer gsk_1'); assert.equal(seen.body.response_format.type, 'json_object');
    await chat({system: 's', messages: m, env: {LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'or', OPENROUTER_MODEL: 'x/y'}});
    assert.match(seen.u, /openrouter\.ai/); assert.equal(seen.body.model, 'x/y');
    assert.equal((await testProvider('groq', {GROQ_API_KEY: 'gsk_1'})).ok, true);
    const bad = await testProvider('groq', {});
    assert.equal(bad.ok, false); assert.match(bad.message, /GROQ_API_KEY is missing/);
    mockFetch(() => j({}, 401));
    assert.match((await testProvider('openrouter', {OPENROUTER_API_KEY: 'k'})).message, /rejected the key/);
    assert.equal((await testProvider('bogus')).ok, false);
  } finally { restore(); }
});

test('groq: a 429 on one model (per-model daily quota) falls through to the next ranked model', async () => {
  const used: string[] = [];
  mockFetch((u, init) => {
    if (u.endsWith('/models')) return j({data: [{id: 'openai/gpt-oss-120b'}, {id: 'qwen/qwen3-32b'}]});
    const model = JSON.parse(init.body).model; used.push(model);
    return model.includes('gpt-oss') ? j({}, 429) : j({choices: [{message: {content: 'next'}}]});
  });
  try {
    assert.equal(await chat({system: 's', messages: [{role: 'user', content: 'u'}], env: {LLM_PROVIDER: 'groq', GROQ_API_KEY: 'gsk_fb', LLM_RETRY_MS: '1'}}), 'next');
    assert.deepEqual([...new Set(used)], ['openai/gpt-oss-120b', 'qwen/qwen3-32b']);
  } finally { restore(); }
});
