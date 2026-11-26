import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

// Starts the real Studio server on a spare port (no Ollama auto-start) and checks guard, queue, readiness and clip endpoints.
const PORT = 4200 + (process.pid % 1500), BASE = `http://localhost:${PORT}`;
const ROOT = new URL('../', import.meta.url).pathname;
let child: ChildProcess;
const JOBS_TMP = `${os.tmpdir()}/studio-test-jobs-${process.pid}.json`;
const J = {'Content-Type': 'application/json'};

before(async () => {
  child = spawn(`${ROOT}node_modules/.bin/tsx`, [`${ROOT}studio/server.ts`], {cwd: ROOT, env: {...process.env, STUDIO_PORT: String(PORT), STUDIO_TEST: '1', STUDIO_TEST_FAKE_JOBS: '1', STUDIO_JOBS_FILE: JOBS_TMP, STUDIO_DRAFTS_FILE: JOBS_TMP + '.drafts', STUDIO_PID_FILE: JOBS_TMP + '.pids'}, stdio: 'ignore'});
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${BASE}/api/readiness`)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('server did not start');
});
after(() => { child?.kill(); fs.rmSync(JOBS_TMP, {force: true}); fs.rmSync(JOBS_TMP + '.drafts', {force: true}); fs.rmSync(`${ROOT}data/uploads/zz-test.mp4`, {force: true}); });

test('guard: bad host, foreign origin and non-JSON mutations are rejected', async () => {
  assert.equal((await fetch(`${BASE}/api/queue`)).status, 200);
  const code = await new Promise<number>(ok => http.get({host: '127.0.0.1', port: PORT, path: '/api/queue', headers: {Host: 'evil.example'}}, r => { r.resume(); ok(r.statusCode ?? 0); })); // fetch cannot spoof Host
  assert.equal(code, 403);
  assert.equal((await fetch(`${BASE}/api/make`, {method: 'POST', headers: {...J, Origin: 'http://evil.example'}, body: '{}'})).status, 403);
  assert.equal((await fetch(`${BASE}/api/make`, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{"topic":"x"}'})).status, 415);
});

test('readiness lists required items with fixes for the missing ones', async () => {
  const r = await (await fetch(`${BASE}/api/readiness`)).json() as {items: {id: string; ok: boolean; required: boolean; fix: string}[]};
  assert.ok(r.items.some(i => i.id === 'ffmpeg'));
  for (const i of r.items) assert.ok(i.ok || i.fix, `${i.id} has no fix text`);
});

test('queue: unknown episode and bad stages are plain 4xx errors', async () => {
  const q = await fetch(`${BASE}/api/queue`, {method: 'POST', headers: J, body: JSON.stringify({episode: 'no-such-ep', stages: ['preview']})});
  assert.ok([400, 404].includes(q.status));
  assert.ok(((await q.json()) as {error: string}).error.length > 5);
  const state = await (await fetch(`${BASE}/api/queue`)).json() as {running: unknown; queued: unknown[]};
  assert.ok('running' in state && Array.isArray(state.queued));
});

test('clip: validation, root restriction, upload and listing', async () => {
  const post = (b: unknown) => fetch(`${BASE}/api/clip`, {method: 'POST', headers: J, body: JSON.stringify(b)});
  assert.equal((await post({})).status, 400);
  assert.equal((await post({path: '/etc/passwd.mp4'})).status, 400); // not found
  assert.equal((await post({upload: '../x.mp4'})).status, 400);
  const bad = await fetch(`${BASE}/api/clips/upload?name=notes.txt`, {method: 'POST', body: 'x'});
  assert.equal(bad.status, 400);
  const up = await fetch(`${BASE}/api/clips/upload?name=zz-test.mp4`, {method: 'POST', headers: {'Content-Type': 'video/mp4'}, body: 'not a real video'});
  assert.equal(up.status, 201);
  assert.equal((await fetch(`${BASE}/api/clips/upload?name=zz-test.mp4`, {method: 'POST', body: 'again'})).status, 409);
  const list = await (await fetch(`${BASE}/api/clips`)).json() as {sources: string[]; items: unknown[]};
  assert.ok(list.sources.includes('zz-test.mp4'));
  assert.equal((await fetch(`${BASE}/api/clips/../etc/x.mp4`)).status, 404);
});

test('episode ZIP: export, import under a new id, rejects traversal and duplicates', async () => {
  const del = () => { for (const id of ['zz-ziptest', 'zz-ziptest2']) fs.rmSync(`${ROOT}episodes/${id}`, {recursive: true, force: true}); };
  del();
  try {
    assert.equal((await fetch(`${BASE}/api/episodes`, {method: 'POST', headers: J, body: JSON.stringify({id: 'zz-ziptest'})})).status, 201);
    fs.writeFileSync(`${ROOT}episodes/zz-ziptest/audio/scene-1.wav`, 'RIFFx');
    fs.mkdirSync(`${ROOT}episodes/zz-ziptest/build/chunks`, {recursive: true});
    fs.writeFileSync(`${ROOT}episodes/zz-ziptest/build/video-preview.mp4`, 'big');
    const z = await fetch(`${BASE}/api/episodes/zz-ziptest/export`);
    assert.equal(z.headers.get('content-type'), 'application/zip');
    const buf = Buffer.from(await z.arrayBuffer());
    const imp = (b: Buffer, q = '') => fetch(`${BASE}/api/episodes/import${q}`, {method: 'POST', headers: {'Content-Type': 'application/zip'}, body: new Uint8Array(b)});
    assert.equal((await imp(buf)).status, 409); // same id exists
    assert.equal((await imp(buf, '?id=zz-ziptest2')).status, 201);
    assert.ok(fs.existsSync(`${ROOT}episodes/zz-ziptest2/audio/scene-1.wav`));
    assert.ok(!fs.existsSync(`${ROOT}episodes/zz-ziptest2/build/video-preview.mp4`));
    assert.equal(JSON.parse(fs.readFileSync(`${ROOT}episodes/zz-ziptest2/episode.json`, 'utf8')).id, 'zz-ziptest2');
    assert.equal((await imp(Buffer.from('nope'), '?id=zz-ziptest3')).status, 422);
    const evil = new Uint8Array(await new Promise<Buffer>(ok => { const p = spawn('python3', ['-c', "import zipfile,sys,io;b=io.BytesIO();z=zipfile.ZipFile(b,'w');z.writestr('episode.json','{}');z.writestr('../evil.txt','x');z.close();sys.stdout.buffer.write(b.getvalue())"]); const c: Buffer[] = []; p.stdout.on('data', d => c.push(d)); p.on('close', () => ok(Buffer.concat(c))); }));
    assert.equal((await imp(Buffer.from(evil), '?id=zz-ziptest3')).status, 422);
    assert.ok(!fs.existsSync(`${ROOT}episodes/zz-ziptest3`) && !fs.existsSync(`${ROOT}episodes/evil.txt`));
  } finally { del(); }
});

test('path traversal: ids with dots/slashes never reach the filesystem', async () => {
  for (const u of ['/api/episodes/..%2f..%2fpackage.json', '/api/episodes/..%2fchannels', '/api/channels/..%2f..', '/api/episodes/x/versions/..%2f..%2fepisode', '/api/episodes/x/audio/..%2f1']) {
    const r = await fetch(`${BASE}${u}`);
    assert.ok([400, 404].includes(r.status), `${u} -> ${r.status}`);
  }
  assert.equal((await fetch(`${BASE}/api/episodes`, {method: 'POST', headers: J, body: JSON.stringify({id: '../evil'})})).status, 400);
});

test('validation: non-object JSON bodies are 400, not 500', async () => {
  for (const b of ['[]', 'null', '"x"', '12']) assert.equal((await fetch(`${BASE}/api/queue`, {method: 'POST', headers: J, body: b})).status, 400, b);
});

test('channels keep profile fields (accent, voice, branding); presets list built-ins', async () => {
  const id = 'zz-test-chan';
  try {
    const mk = await fetch(`${BASE}/api/channels`, {method: 'POST', headers: J, body: JSON.stringify({id, name: 'ZZ', accent: 'green', sayVoice: 'Tünde', branding: {cta: 'Hi', handle: '@zz'}})});
    assert.equal(mk.status, 201);
    const put = await fetch(`${BASE}/api/channels/${id}`, {method: 'PUT', headers: J, body: JSON.stringify({...(await mk.json() as object), niche: 'cats'})});
    const c = await put.json() as {accent: string; sayVoice: string; niche: string; branding: {cta: string; outroSec: number}};
    assert.deepEqual([c.accent, c.sayVoice, c.niche, c.branding.cta, c.branding.outroSec], ['green', 'Tünde', 'cats', 'Hi', 2]);
    const presets = await (await fetch(`${BASE}/api/presets`)).json() as {id: string; builtin: boolean}[];
    assert.ok(presets.some(p => p.id === 'finance' && p.builtin));
  } finally { await fetch(`${BASE}/api/channels/${id}`, {method: 'DELETE', headers: J}); }
});

test('POST bodies are schema-validated: wrong types give 400', async () => {
  const post = (p: string, b: unknown) => fetch(`${BASE}/api${p}`, {method: 'POST', headers: J, body: JSON.stringify(b)});
  assert.equal((await post('/make', {topic: 5})).status, 400);
  assert.equal((await post('/draft', {topic: 'x', channel: 7})).status, 400);
  assert.equal((await post('/channels/default/ideas/generate', {count: 'many'})).status, 400);
  assert.equal((await post('/channels/default/ideas/generate', {count: 99})).status, 400);
  assert.equal((await post('/presets', {id: 3})).status, 400);
  assert.equal((await post('/episodes/none/generate', {stages: 'voice'})).status, 404); // unknown episode checked first
  assert.equal((await fetch(`${BASE}/api/make`, {method: 'POST', headers: J, body: '[1]'})).status, 400);
});

test('queue: 20 active runs max (429), identical queued run is 409, cancel frees a slot (fake jobs)', async () => {
  const ids = Array.from({length: 21}, (_, i) => `zz-qtest-${process.pid}-${i}`);
  for (const id of ids) { fs.mkdirSync(`${ROOT}episodes/${id}`, {recursive: true}); fs.writeFileSync(`${ROOT}episodes/${id}/episode.json`, '{}'); }
  const enq = (episode: string) => fetch(`${BASE}/api/queue`, {method: 'POST', headers: J, body: JSON.stringify({episode, stages: ['preview']})});
  const jobIds: string[] = [];
  try {
    for (const id of ids.slice(0, 20)) { const r = await enq(id); assert.equal(r.status, 202, id); jobIds.push(((await r.json()) as {jobId: string}).jobId); }
    assert.equal((await enq(ids[20])).status, 429);
    assert.equal((await enq(ids[19])).status, 429); // limit is checked before the duplicate rule
    const del = await fetch(`${BASE}/api/queue/${jobIds[19]}`, {method: 'DELETE'}); assert.equal(del.status, 200);
    assert.equal((await enq(ids[18])).status, 409); // same episode + stages already waiting
    assert.equal((await enq(ids[20])).status, 202);
  } finally {
    const q = await (await fetch(`${BASE}/api/queue`)).json() as {running: {jobId: string} | null; queued: {jobId: string}[]};
    for (const j of [...q.queued, ...(q.running ? [q.running] : [])]) await fetch(`${BASE}/api/queue/${j.jobId}`, {method: 'DELETE'});
    for (const id of ids) fs.rmSync(`${ROOT}episodes/${id}`, {recursive: true, force: true});
  }
});

test('interrupted job: after a restart a running run is an error with Retry text, queued runs resume', async () => {
  const file = `${os.tmpdir()}/studio-test-jobs-restart-${process.pid}.json`, port = 5800 + (process.pid % 1500);
  const base = {stages: ['preview'], current: 'preview', done: [], log: [], engine: 'auto', progress: 0.4};
  fs.writeFileSync(file, JSON.stringify([{...base, id: 'j-run', episode: 'zz-x', status: 'running', createdAt: 1}, {...base, id: 'j-wait', episode: 'zz-y', status: 'queued', current: null, createdAt: 2}]));
  const c = spawn(`${ROOT}node_modules/.bin/tsx`, [`${ROOT}studio/server.ts`], {cwd: ROOT, env: {...process.env, STUDIO_PORT: String(port), STUDIO_TEST: '1', STUDIO_TEST_FAKE_JOBS: '1', STUDIO_JOBS_FILE: file}, stdio: 'ignore'});
  try {
    let q: {running: {jobId: string} | null; recent: {jobId: string; status: string; error?: string}[]} | undefined;
    for (let i = 0; i < 100 && !q; i++) { try { q = await (await fetch(`http://localhost:${port}/api/queue`)).json() as typeof q; } catch { await new Promise(r => setTimeout(r, 300)); } }
    assert.ok(q);
    const dead = q.recent.find(j => j.jobId === 'j-run');
    assert.equal(dead?.status, 'error'); assert.match(dead?.error ?? '', /Interrupted.*Retry/);
    assert.equal(q.running?.jobId, 'j-wait');
  } finally { c.kill(); fs.rmSync(file, {force: true}); }
});

// Regression: "Create draft" on an idea used to hold one HTTP call open for the whole (minutes-long) LLM run, with no feedback. Drafts are now background jobs.
test('make: returns at once, draft progress is polled, success enqueues the render run, failure carries a plain message', async () => {
  const slug = `zz-test-${process.pid}`;
  try {
    const t0 = Date.now(), r = await fetch(`${BASE}/api/make`, {method: 'POST', headers: J, body: JSON.stringify({topic: slug, format: 'short'})});
    assert.equal(r.status, 202); assert.ok(Date.now() - t0 < 1000, 'must not wait for the draft');
    const {id} = await r.json() as {id: string};
    let st: {state: string; progress: {total: number}; jobId?: string} = {state: 'running', progress: {total: 0}};
    for (let i = 0; i < 40 && st.state === 'running'; i++) { await new Promise(r => setTimeout(r, 100)); st = await (await fetch(`${BASE}/api/drafts/${id}`)).json() as typeof st; }
    assert.equal(st.state, 'done'); assert.equal(st.progress.total, 2); assert.ok(st.jobId);
    const bad = await (await fetch(`${BASE}/api/make`, {method: 'POST', headers: J, body: JSON.stringify({topic: 'will fail'})})).json() as {id: string};
    let e: {state: string; error?: string} = {state: 'running'};
    for (let i = 0; i < 40 && e.state === 'running'; i++) { await new Promise(r => setTimeout(r, 100)); e = await (await fetch(`${BASE}/api/drafts/${bad.id}`)).json() as typeof e; }
    assert.equal(e.state, 'error'); assert.match(e.error ?? '', /outline/);
    assert.equal((await fetch(`${BASE}/api/drafts/nope`)).status, 404);
  } finally { for (const d of fs.readdirSync(`${ROOT}episodes`)) if (d.includes(slug) || d.includes('will-fail')) fs.rmSync(`${ROOT}episodes/${d}`, {recursive: true, force: true}); }
});

test('llm providers: status never echoes keys, bad provider and missing key are plain errors, test never throws', async () => {
  const st = await (await fetch(`${BASE}/api/llm/providers`)).json() as {active: string; providers: {id: string; keySet: boolean}[]};
  assert.deepEqual(st.providers.map(p => p.id).sort(), ['anthropic', 'cerebras', 'gemini', 'groq', 'openrouter']);
  assert.ok(!JSON.stringify(st).includes('gsk_'));
  const put = (b: object) => fetch(`${BASE}/api/llm/providers`, {method: 'PUT', headers: J, body: JSON.stringify(b)});
  assert.equal((await put({provider: 'nope', key: 'x'})).status, 422);
  const t = await (await fetch(`${BASE}/api/llm/test`, {method: 'POST', headers: J, body: JSON.stringify({provider: 'bogus'})})).json() as {ok: boolean; message: string};
  assert.equal(t.ok, false); assert.match(t.message, /Unknown provider/);
});

test('make: Cancel stops a running draft, Retry starts it again with the same settings', async () => {
  const topic = `zz-cancel-${process.pid}`, post = (u: string, b: object = {}) => fetch(`${BASE}${u}`, {method: 'POST', headers: J, body: JSON.stringify(b)});
  const poll = async (id: string) => { let st: {state: string; error?: string; retry?: {topic: string}} = {state: 'running'}; for (let i = 0; i < 60 && st.state === 'running'; i++) { await new Promise(r => setTimeout(r, 100)); st = await (await fetch(`${BASE}/api/drafts/${id}`)).json() as typeof st; } return st; };
  try {
    const {id} = await (await post('/api/make', {topic})).json() as {id: string};
    assert.equal(((await (await post(`/api/drafts/${id}/cancel`)).json()) as {ok: boolean}).ok, true);
    const c = await poll(id); assert.equal(c.state, 'error'); assert.match(c.error ?? '', /Cancelled/);
    assert.equal((await post(`/api/drafts/${id}/retry`)).status, 202);
    assert.equal((await post('/api/drafts/nope/retry')).status, 404);
  } finally { await new Promise(r => setTimeout(r, 800)); for (const d of fs.readdirSync(`${ROOT}episodes`)) if (d.includes('zz-cancel')) fs.rmSync(`${ROOT}episodes/${d}`, {recursive: true, force: true}); }
});

test('stock swap API: lists beats, rejects unknown scene / short query / hits that were never searched', async () => {
  const topic = `zz-stock-${process.pid}`, post = (u: string, b: object) => fetch(`${BASE}${u}`, {method: 'POST', headers: J, body: JSON.stringify(b)});
  try {
    const {id} = await (await post('/api/make', {topic})).json() as {id: string};
    for (let i = 0; i < 40; i++) { if ((await fetch(`${BASE}/api/episodes/${id}/stock`)).status === 200) break; await new Promise(r => setTimeout(r, 100)); }
    const st = await (await fetch(`${BASE}/api/episodes/${id}/stock`)).json() as {scenes: {scene: number}[]};
    assert.equal(st.scenes.length, 1);
    assert.equal((await post(`/api/episodes/${id}/stock/search`, {scene: 9, query: 'money'})).status, 422);
    assert.equal((await post(`/api/episodes/${id}/stock/search`, {scene: 0, query: ' '})).status, 422);
    assert.equal((await post(`/api/episodes/${id}/stock/swap`, {scene: 0, id: 'x', provider: 'pixabay'})).status, 409); // no SSRF: only our own search results can be downloaded
    assert.equal((await fetch(`${BASE}/api/stock-cache/..%2Fpackage.json`)).status === 200, false);
  } finally { await new Promise(r => setTimeout(r, 500)); for (const d of fs.readdirSync(`${ROOT}episodes`)) if (d.includes('zz-stock')) fs.rmSync(`${ROOT}episodes/${d}`, {recursive: true, force: true}); }
});
