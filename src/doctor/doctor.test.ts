import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkReadiness, type Probe} from './doctor.js';

const probe = (root: string, over: Partial<Probe> = {}): Probe => ({env: {}, platform: 'linux', root, nodeVersion: '22.1.0', onPath: () => false, ffmpegHas: () => false, ollamaModels: async () => [], ...over});

test('empty linux machine: required items missing, fixes given', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-'));
  const r = await checkReadiness(probe(root));
  assert.equal(r.ok, false);
  const by = Object.fromEntries(r.items.map(i => [i.id, i]));
  assert.ok(!by.ffmpeg.ok && by.ffmpeg.required && /apt install ffmpeg/.test(by.ffmpeg.fix));
  assert.ok(!by.chromium.ok && /remotion browser ensure/.test(by.chromium.fix));
  assert.ok(!by.voice.ok && !by.voice.required);
});

test('fully provisioned machine passes (espeak-ng voice, fake chromium, whisper model, music)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-'));
  for (const d of ['node_modules/remotion', 'node_modules/.remotion/chrome-headless-shell/v1', 'data/models', 'assets/music']) fs.mkdirSync(path.join(root, d), {recursive: true});
  fs.writeFileSync(path.join(root, 'node_modules/.remotion/chrome-headless-shell/v1/chrome-headless-shell'), '');
  fs.writeFileSync(path.join(root, 'data/models/ggml-base.en.bin'), '');
  fs.writeFileSync(path.join(root, 'assets/music/pad.mp3'), '');
  const r = await checkReadiness(probe(root, {onPath: b => ['ffmpeg', 'ffprobe', 'espeak-ng', 'whisper-cli'].includes(b), ffmpegHas: () => true, ollamaModels: async () => ['qwen2.5:7b']}));
  assert.deepEqual(r.items.filter(i => !i.ok && i.required).map(i => i.id), []);
  assert.ok(r.ok);
});

test('old node fails the required check', async () => {
  const r = await checkReadiness(probe(fs.mkdtempSync(path.join(os.tmpdir(), 'doc-')), {nodeVersion: '18.19.0'}));
  assert.equal(r.items.find(i => i.id === 'node')!.ok, false);
});
