import {spawn} from 'node:child_process';
import {extractJson} from './json.js';
export {extractJson};

export type Provider = 'anthropic' | 'gemini' | 'ollama' | 'groq' | 'openrouter' | 'cerebras';
export const PROVIDERS: Provider[] = ['ollama', 'gemini', 'groq', 'cerebras', 'openrouter', 'anthropic'];
export type ChatMsg = {role: 'user' | 'assistant'; content: string};
export const NO_PROVIDER = 'The free local AI (Ollama) is not available. Install it from ollama.com; the Studio starts it and downloads a model for you.';
export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';

const ollamaHost = (env: NodeJS.ProcessEnv) => (env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'http://');
/** Preferred small instruct models, best first (7B first: the 14B needs about 10 GB and stalls a 16 GB Mac). Already-installed ones are used before anything is downloaded. */
const PREFERRED = ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b', 'qwen3:8b', 'gemma2:9b', 'mistral', 'llama3.2', 'qwen2.5:3b', 'phi3', 'qwen2.5:1.5b'];
export const DEFAULT_PULL = 'llama3.1:8b';
/** Per-request limit for local models: bigger models are slower per token. LLM_TIMEOUT_MS overrides. */
export function ollamaTimeoutMs(model: string, env: NodeJS.ProcessEnv = process.env): number {
  const forced = Number(env.LLM_TIMEOUT_MS);
  if (forced > 0) return forced;
  const b = Number(/(\d+(?:\.\d+)?)b\b/i.exec(model)?.[1] ?? 8);
  return (b <= 4 ? 120 : b <= 9 ? 240 : b <= 15 ? 480 : 900) * 1000;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function ollamaReachable(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  try {
    const r = await fetch(`${ollamaHost(env)}/api/tags`, {signal: AbortSignal.timeout(1500)});
    return r.ok;
  } catch { return false; }
}

export type LlmSetup = {phase: 'idle' | 'starting' | 'pulling' | 'ready' | 'error'; model?: string; pct?: number; message?: string};
let setup: LlmSetup = {phase: 'idle'};
/** Progress of the keyless local-AI bootstrap (start server, pick or download a model), for the UI. */
export const llmSetupState = (): LlmSetup => setup;

async function installed(env: NodeJS.ProcessEnv): Promise<string[]> {
  const r = await fetch(`${ollamaHost(env)}/api/tags`, {signal: AbortSignal.timeout(4000)});
  const d: any = await r.json();
  return (d.models ?? []).map((m: any) => String(m.name));
}

/** Pick an installed chat model: OLLAMA_MODEL, else the best of PREFERRED, else any non-vision/embedding one, else null. */
export function pickModel(names: string[], want?: string): string | null {
  const has = (n: string) => names.find(x => x === n || x === `${n}:latest` || (!n.includes(':') && x.startsWith(`${n}:`)));
  if (want) return has(want) ?? null;
  for (const n of PREFERRED) { const h = has(n); if (h) return h; }
  return names.find(n => !/(embed|vl|llava|vision|bge|nomic)/i.test(n)) ?? null;
}

async function startServer(env: NodeJS.ProcessEnv): Promise<void> {
  if (env.OLLAMA_AUTOSTART === '0') throw new Error(`Ollama is not running at ${ollamaHost(env)}. ${NO_PROVIDER}`);
  setup = {phase: 'starting', message: 'Starting Ollama…'};
  for (const bin of ['ollama', '/opt/homebrew/bin/ollama', '/usr/local/bin/ollama']) {
    const ok = await new Promise<boolean>(res => {
      const c = spawn(bin, ['serve'], {detached: true, stdio: 'ignore'});
      c.once('error', () => res(false)); c.once('spawn', () => { c.unref(); res(true); });
    });
    if (!ok) continue;
    for (let i = 0; i < 40; i++) { if (await ollamaReachable(env)) return; await sleep(500); }
  }
  throw new Error(`Could not start Ollama. ${NO_PROVIDER}`);
}

async function pull(model: string, env: NodeJS.ProcessEnv, log: (m: string) => void): Promise<void> {
  setup = {phase: 'pulling', model, pct: 0, message: `Downloading ${model}…`};
  const res = await fetch(`${ollamaHost(env)}/api/pull`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: model, stream: true})});
  if (!res.ok || !res.body) throw new Error(`Could not download ${model} (HTTP ${res.status}). Check the name and your connection.`);
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', last = -1;
  for (;;) {
    const {done, value} = await rd.read(); if (done) break;
    buf += dec.decode(value, {stream: true});
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    for (const l of lines) {
      if (!l.trim()) continue;
      let o: any; try { o = JSON.parse(l); } catch { continue; }
      if (o.error) throw new Error(`Download of ${model} failed: ${o.error}`);
      const pct = o.total ? Math.round(100 * (o.completed ?? 0) / o.total) : (setup.pct ?? 0);
      setup = {phase: 'pulling', model, pct, message: `Downloading ${model}: ${o.status ?? ''} ${pct}%`};
      if (pct !== last && pct % 10 === 0) { last = pct; log(setup.message!); }
    }
  }
}

let inflight: Promise<string> | null = null;
/** Make sure Ollama is running and a model is available (no key, free). Starts the server and downloads a model if needed. Returns the model name. */
export function ensureOllama(env: NodeJS.ProcessEnv = process.env, log: (m: string) => void = m => console.error(m)): Promise<string> {
  if (!inflight) inflight = (async () => {
    try {
      if (!(await ollamaReachable(env))) await startServer(env);
      const want = env.OLLAMA_MODEL?.trim() || undefined;
      let model = pickModel(await installed(env), want);
      if (!model) { model = want ?? DEFAULT_PULL; await pull(model, env, log); }
      setup = {phase: 'ready', model, pct: 100, message: `Local AI ready (${model}).`};
      return model;
    } catch (e) { setup = {phase: 'error', message: (e as Error).message}; throw e; }
    finally { inflight = null; }
  })();
  return inflight;
}

/** Keyless Ollama is the default. Key-based providers only run when LLM_PROVIDER names them explicitly. */
export async function resolveProvider(env: NodeJS.ProcessEnv = process.env): Promise<Provider> {
  const p = env.LLM_PROVIDER?.trim().toLowerCase();
  if (!p || p === 'ollama') return 'ollama';
  if ((PROVIDERS as string[]).includes(p)) return p as Provider;
  throw new Error(`Unknown LLM_PROVIDER "${p}" (use ${PROVIDERS.join(', ')}).`);
}

/** Ranks Gemini model names for a script drafter: stable flash first, then pro, never lite/preview-only/embedding/image. */
export function pickGemini(names: string[]): string | null {
  const ok = names.map(n => n.replace(/^models\//, '')).filter(n => /^gemini-/.test(n) && !/(lite|embed|image|tts|live|audio|vision|thinking|exp|preview)/.test(n));
  const ver = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  const rank = (n: string) => ver(n) * 10 + (/flash/.test(n) ? 2 : /pro/.test(n) ? 1 : 0);
  return ok.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}
const geminiCache = new Map<string, string>();
/** The key's own /models list decides: gemini-2.0-flash is not offered to new accounts. */
async function geminiModel(key: string): Promise<string> {
  const hit = geminiCache.get(key); if (hit) return hit;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {headers: {'x-goog-api-key': key}, signal: AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error(geminiAuthMessage(r.status, await r.text()));
  const d: any = await r.json();
  const m = pickGemini((d.models ?? []).filter((x: any) => (x.supportedGenerationMethods ?? []).includes('generateContent')).map((x: any) => String(x.name)));
  if (!m) throw new Error('This Gemini key lists no usable chat model. Set GEMINI_MODEL.');
  geminiCache.set(key, m); return m;
}
function geminiAuthMessage(status: number, text: string): string {
  if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/.test(text)) return 'Gemini rejected this key type (keys starting with "AQ." are not accepted by the Gemini API). Create a normal key (starts with "AIza") at aistudio.google.com/apikey, or use Groq or OpenRouter instead.';
  return `Gemini HTTP ${status}: ${text.slice(0, 200)}`;
}

async function viaGemini(system: string, messages: ChatMsg[], json: boolean, env: NodeJS.ProcessEnv): Promise<string> {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is missing (only needed when LLM_PROVIDER=gemini).');
  const model = env.GEMINI_MODEL?.trim() || await geminiModel(key);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: {parts: [{text: system}]},
    contents: messages.map(m => ({role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]})),
    generationConfig: {...(json ? {responseMimeType: 'application/json'} : {}), maxOutputTokens: 8192},
  });
  let res: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body});
    if (res.status !== 429) break;
    if (attempt === 0) await new Promise(r => setTimeout(r, Number(env.LLM_RETRY_MS ?? 5000)));
  }
  if (res!.status === 429) throw new Error('Gemini free quota reached, try later');
  if (!res!.ok) throw new Error(geminiAuthMessage(res!.status, await res!.text()));
  const data: any = await res!.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  if (!text) throw new Error(`Gemini returned no text (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown reason'}).`);
  return text;
}

const OPENAI_COMPAT = {
  groq: {url: 'https://api.groq.com/openai/v1/chat/completions', key: 'GROQ_API_KEY', model: 'GROQ_MODEL', def: 'openai/gpt-oss-120b', name: 'Groq'},
  cerebras: {url: 'https://api.cerebras.ai/v1/chat/completions', key: 'CEREBRAS_API_KEY', model: 'CEREBRAS_MODEL', def: 'gpt-oss-120b', name: 'Cerebras'},
  openrouter: {url: 'https://openrouter.ai/api/v1/chat/completions', key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL', def: 'meta-llama/llama-3.3-70b-instruct:free', name: 'OpenRouter'},
} as const;
/** Models come and go on free tiers, and Groq counts the daily quota per model: rank the usable ones (cached per process). */
const ranked = new Map<string, string[]>();
async function rankOpenAiModels(p: keyof typeof OPENAI_COMPAT, key: string): Promise<string[]> {
  if (p === 'openrouter') return []; // OpenRouter ids are stable enough; shortcut: extend when a :free id breaks
  const ck = p + key;
  if (ranked.has(ck)) return ranked.get(ck)!;
  let out: string[] = [];
  try {
    const r = await fetch(OPENAI_COMPAT[p].url.replace('/chat/completions', '/models'), {headers: {Authorization: `Bearer ${key}`}, signal: AbortSignal.timeout(15000)});
    const ids: string[] = ((await r.json()) as any).data?.filter((m: any) => m.active !== false && (m.output_modalities ?? ['text']).includes('text') && !/whisper|guard|tts|allam/.test(m.id)).map((m: any) => m.id) ?? [];
    out = [...new Set(['gpt-oss-120b', 'llama-3.3-70b', 'qwen', 'gpt-oss-20b', 'llama'].flatMap(k => ids.filter(i => i.includes(k))))];
  } catch { /* fall back to the default */ }
  ranked.set(ck, out);
  return out;
}
/** Groq (gsk_ keys, free tier), Cerebras (csk- keys, free tier) and OpenRouter speak the OpenAI chat format. */
async function viaOpenAi(p: keyof typeof OPENAI_COMPAT, system: string, messages: ChatMsg[], json: boolean, env: NodeJS.ProcessEnv): Promise<string> {
  const c = OPENAI_COMPAT[p], key = env[c.key]?.trim();
  if (!key) throw new Error(`${c.key} is missing (only needed when LLM_PROVIDER=${p}).`);
  const forced = env[c.model]?.trim();
  const models = forced ? [forced] : [...(await rankOpenAiModels(p, key)), c.def].filter((m, i, a) => a.indexOf(m) === i);
  let res: Response | undefined;
  for (const model of models) {
    const body = JSON.stringify({model, temperature: 0.6, max_tokens: 4096, ...(json ? {response_format: {type: 'json_object'}} : {}), messages: [{role: 'system', content: system}, ...messages]});
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(c.url, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`}, body, signal: AbortSignal.timeout(120000)});
      if (res.status !== 429) break;
      if (attempt === 0) await sleep(Number(env.LLM_RETRY_MS ?? 5000));
    }
    if (res!.status !== 429) break; // 429 on this model: its quota is used up, try the next one
  }
  if (res!.status === 429) throw new Error(`${c.name} free quota reached for every model, try later`);
  if (res!.status === 401 || res!.status === 403) throw new Error(`${c.name} rejected the key (HTTP ${res!.status}). Check it is copied completely.`);
  if (!res!.ok) throw new Error(`${c.name} HTTP ${res!.status}: ${(await res!.text()).slice(0, 200)}`);
  const text = ((await res!.json()) as any).choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error(`${c.name} returned no text.`);
  return text;
}

async function viaOllama(system: string, messages: ChatMsg[], json: boolean, env: NodeJS.ProcessEnv): Promise<string> {
  const host = ollamaHost(env), model = await ensureOllama(env);
  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(ollamaTimeoutMs(model, env)),
      body: JSON.stringify({model, stream: true, ...(json ? {format: 'json'} : {}), options: {temperature: 0.6, num_ctx: 8192}, messages: [{role: 'system', content: system}, ...messages]}),
    });
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new Error(`Ollama model "${model}" took longer than ${ollamaTimeoutMs(model, env) / 1000}s for one answer (set LLM_TIMEOUT_MS to allow more).`);
    throw new Error(`Ollama is not running at ${host}. ${NO_PROVIDER}`);
  }
  if (res.status === 404) throw new Error(`Ollama model "${model}" is not installed. Run: ollama pull ${model}`);
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // streamed (NDJSON) so a slow big model never trips the 5 min header timeout of fetch; the body is joined here
  let body: string;
  try { body = await res.text(); } catch (e) { throw new Error((e as Error).name === 'TimeoutError' ? `Ollama model "${model}" took longer than ${ollamaTimeoutMs(model, env) / 1000}s for one answer (set LLM_TIMEOUT_MS to allow more).` : `Ollama connection dropped: ${(e as Error).message}`); }
  const text = body.split('\n').filter(l => l.trim()).map(l => { try { return (JSON.parse(l) as any).message?.content ?? ''; } catch { return ''; } }).join('');
  if (typeof text !== 'string' || !text) throw new Error('Ollama returned no text.');
  return text;
}

async function viaAnthropic(system: string, messages: ChatMsg[], env: NodeJS.ProcessEnv): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is missing (only needed when LLM_PROVIDER=anthropic).');
  const {default: Anthropic} = await import('@anthropic-ai/sdk');
  const client = new Anthropic() as any;
  const res = await client.messages.create({model: env.DRAFT_MODEL || ANTHROPIC_MODEL, max_tokens: 8000, system, messages});
  return res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('');
}

/** Settings "Test provider" button: one tiny real request against the named provider, never throws. */
export async function testProvider(p: string, env: NodeJS.ProcessEnv = process.env): Promise<{ok: boolean; message: string; ms?: number}> {
  if (!(PROVIDERS as string[]).includes(p)) return {ok: false, message: `Unknown provider "${p}".`};
  const t0 = Date.now();
  try {
    const text = await chat({system: 'Reply with the single word OK.', messages: [{role: 'user', content: 'ping'}], env: {...env, LLM_PROVIDER: p, LLM_TIMEOUT_MS: '60000', LLM_FALLBACK: '0'}});
    return {ok: true, ms: Date.now() - t0, message: `Works (${((Date.now() - t0) / 1000).toFixed(1)} s): "${text.trim().slice(0, 40)}"`};
  } catch (e) { return {ok: false, ms: Date.now() - t0, message: (e as Error).message}; }
}

/** Smallest installed Ollama text model (no vision/embedding), or undefined when Ollama is not reachable. Cached per process. */
let fastCache: string | null | undefined;
export async function fastestOllama(env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  if (fastCache !== undefined) return fastCache ?? undefined;
  try {
    const r = await fetch(`${ollamaHost(env)}/api/tags`, {signal: AbortSignal.timeout(1500)});
    const ms = ((await r.json()) as {models?: {name: string; size: number}[]}).models ?? [];
    fastCache = ms.filter(m => !/(embed|vl|llava|vision|bge|nomic)/i.test(m.name)).sort((a, b) => a.size - b.size)[0]?.name ?? null;
  } catch { fastCache = null; }
  return fastCache ?? undefined;
}

/** Multi-turn variant used by retry-with-errors loops. */
export async function chat(o: {system: string; messages: ChatMsg[]; json?: boolean; env?: NodeJS.ProcessEnv}): Promise<string> {
  const env = o.env ?? process.env;
  const p = await resolveProvider(env);
  if (p === 'ollama') return viaOllama(o.system, o.messages, !!o.json, env);
  if (p === 'gemini' || p === 'groq' || p === 'openrouter' || p === 'cerebras') {
    // free tiers run out: the other keyed free providers, then local Ollama (never a paid API). LLM_FALLBACK=0 pins the named provider.
    const chain = env.LLM_FALLBACK === '0' ? [p] : [p, ...(['groq', 'cerebras', 'openrouter'] as const).filter(x => x !== p && env[OPENAI_COMPAT[x].key]?.trim())];
    let first: Error | undefined;
    for (const q of chain) {
      try { return q === 'gemini' ? await viaGemini(o.system, o.messages, !!o.json, env) : await viaOpenAi(q as keyof typeof OPENAI_COMPAT, o.system, o.messages, !!o.json, env); }
      catch (e) { first ??= e as Error; }
    }
    if (env.LLM_FALLBACK === '0') throw first!;
    // the fallback is a stopgap for a spent free quota: the smallest installed text model answers 2-3x faster than the 7B default (storyboard batches timed out at 240 s)
    const fast = env.LLM_FALLBACK_MODEL || await fastestOllama(env);
    try { return await viaOllama(o.system, o.messages, !!o.json, fast ? {...env, OLLAMA_MODEL: fast} : env); }
    catch (e) { throw new Error(`${first!.message} (local Ollama fallback: ${(e as Error).message})`); }
  }
  return viaAnthropic(o.system, o.messages, env);
}

export function complete(o: {system: string; user: string; json?: boolean}): Promise<string> {
  return chat({system: o.system, messages: [{role: 'user', content: o.user}], json: o.json});
}

/** Anthropic-SDK-shaped client backed by the selected provider (the drafters take this shape, so tests can inject mocks). */
export type Client = {
  messages: {create(args: any): Promise<{content: Array<{type: string; text?: string}>}>};
};
export function providerClient(json = true): Client {
  return {messages: {async create(a: any) {
    return {content: [{type: 'text', text: await chat({system: a.system, messages: a.messages, json})}]};
  }}};
}

/** For CLIs: returns a client or exits with the generic message before any generation call. */
export async function requireClient(die: (m: string) => never): Promise<Client> {
  try { await resolveProvider(); } catch (e) { return die((e as Error).message); }
  return providerClient();
}
