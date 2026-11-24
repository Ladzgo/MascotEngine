import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

// Starts the real Studio server on a spare port (no Ollama auto-start) and checks guard, queue, readiness and clip endpoints.
const PORT = 4197, BASE = `http://localhost:${PORT}`;
const ROOT = new URL('../', import.meta.url).pathname;
let child: ChildProcess;
const J = {'Content-Type': 'application/json'};

before(async () => {
  child = spawn(`${ROOT}node_modules/.bin/tsx`, [`${ROOT}studio/server.ts`], {cwd: ROOT, env: {...process.env, STUDIO_PORT: String(PORT), STUDIO_TEST: '1'}, stdio: 'ignore'});
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${BASE}/api/readiness`)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('server did not start');
});
after(() => { child?.kill(); fs.rmSync(`${ROOT}data/uploads/zz-test.mp4`, {force: true}); });

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
