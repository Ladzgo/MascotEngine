import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Episode} from '../schema.js';
import {buildPrompt, runArt, plan, readManifest, selectProvider, openaiProvider, parseScenes, type ImageProvider} from './art.js';

const ep = Episode.parse({
  id: 'x', title: 'T', scenes: [
    {type: 'title', narration: 'Cash loses value.'},
    {type: 'big_number', narration: 'Prices rose.', value: 3, suffix: '%', label: 'Yearly price rise'},
    {type: 'list', narration: 'Three things.', items: ['rent', 'food']},
  ],
});
const mkProvider = () => {
  const calls: string[] = [];
  const p: ImageProvider = {name: 'mock', model: 'm1', async generate(prompt) { calls.push(prompt); return Buffer.from('png'); }};
  return {p, calls};
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));

test('prompt has content and the fixed style block, accent, no faces/logos', () => {
  const p = buildPrompt(ep.scenes[1], '#e4572e');
  assert.match(p, /Yearly price rise/);
  assert.match(p, /#f6f1e4/);
  assert.match(p, /#e4572e/);
  assert.match(p, /no people faces, no logos/);
  assert.match(buildPrompt(ep.scenes[2]), /rent, food/);
  assert.match(buildPrompt(ep.scenes[0]), /black ink only/);
});

test('generate, manifest, cache skip, changed prompt regenerates, budget', async () => {
  const root = tmp();
  const {p, calls} = mkProvider();
  const fit = (b: Buffer) => b;
  const r1 = await runArt({ep, episodesRoot: root, provider: p, indices: [0, 1, 2], budget: 2, fit, now: () => 'T'});
  assert.deepEqual(r1.generated, [0, 1]);
  const man = readManifest(path.join(root, 'x', 'art'));
  assert.deepEqual(man.scenes.map(s => [s.index, s.file, s.provider, s.model, s.createdAt]), [[0, 'scene-1.png', 'mock', 'm1', 'T'], [1, 'scene-2.png', 'mock', 'm1', 'T']]);
  assert.ok(fs.existsSync(path.join(root, 'x', 'art', 'scene-1.png')));
  const r2 = await runArt({ep, episodesRoot: root, provider: p, indices: [0, 1, 2], fit});
  assert.deepEqual(r2.skipped, [0, 1]);
  assert.deepEqual(r2.generated, [2]);
  assert.equal(calls.length, 3);
  // missing file -> regenerate; accent change -> prompt changes -> regenerate
  fs.rmSync(path.join(root, 'x', 'art', 'scene-1.png'));
  assert.equal(plan(ep, path.join(root, 'x', 'art'), [0, 1], '#fff000').filter(x => x.cached).length, 0);
  assert.equal(plan(ep, path.join(root, 'x', 'art'), [0, 1]).filter(x => x.cached).length, 1);
});

test('missing key message, before any network call', () => {
  let called = false;
  const f = (async () => { called = true; throw new Error('net'); }) as any;
  assert.throws(() => openaiProvider({}, f), {message: 'OPENAI_API_KEY is missing. Add it in Settings.'});
  assert.throws(() => selectProvider({ART_PROVIDER: 'replicate', ART_MODEL: 'a/b'}, f), {message: 'REPLICATE_API_TOKEN is missing. Add it in Settings.'});
  assert.equal(selectProvider({}, f), null);
  assert.equal(called, false);
});

test('openai adapter uses env model and decodes b64', async () => {
  let body: any;
  const f = (async (_u: string, init: any) => { body = JSON.parse(init.body); return {ok: true, json: async () => ({data: [{b64_json: Buffer.from('hi').toString('base64')}]})}; }) as any;
  const p = openaiProvider({OPENAI_API_KEY: 'k', ART_MODEL: 'gpt-image-2'}, f);
  assert.equal((await p.generate('x', {width: 1920, height: 1080})).toString(), 'hi');
  assert.equal(body.model, 'gpt-image-2');
});

test('scene arg parsing', () => {
  assert.deepEqual(parseScenes('3,1', 3), [0, 2]);
  assert.throws(() => parseScenes('4', 3));
});
