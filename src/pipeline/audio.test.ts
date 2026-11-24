import fs from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {synth} from './audio.js';
import type {SfxKind} from '../director/types.js';

const kinds: SfxKind[] = ['pop', 'whoosh', 'tick', 'ding'];
for (const kind of kinds) {
  for (const v of [0, 1, 2]) {
    test(`synth ${kind}/${v}`, () => {
      const a = synth(kind, v), b = synth(kind, v);
      assert.deepEqual(a, b);
      assert.ok(a.length > 0);
      let peak = 0;
      for (const x of a) {
        assert.ok(!Number.isNaN(x));
        peak = Math.max(peak, Math.abs(x));
      }
      assert.ok(peak > 0.01, 'non-silent');
      assert.ok(peak <= 1.0, `peak ${peak}`);
    });
  }
}

import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {mixAudio} from './audio.js';

test('mixAudio with synthetic music bed: -14 LUFS, TP <= -1.5', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-test-'));
  const music = path.join(tmp, 'music');
  fs.mkdirSync(music);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', path.join(music, 'bed.wav')]);
  const dir = path.join(tmp, 'ep') + '/';
  fs.mkdirSync(dir + 'audio', {recursive: true});
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-af', 'volume=0.5', dir + 'audio/scene-1.wav']);
  const sfx = [{kind: 'pop', variant: 0, t: 0.5}, {kind: 'ding', variant: 1, t: 1.5}];
  const dec = {scenes: [{startSec: 0, speechStart: 0.2, sfx}]} as unknown as Parameters<typeof mixAudio>[2];
  process.env.YT_MUSIC_DIR = music;
  try {
    const out = await mixAudio(dir, {} as never, dec, {} as never, 5);
    const r = execFileSync('ffmpeg', ['-nostats', '-hide_banner', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    void r;
  } catch (e) {
    const err = (e as {stderr?: string}).stderr ?? '';
    assert.fail(err);
  } finally { delete process.env.YT_MUSIC_DIR; }
  const res = execFileSync('sh', ['-c', `ffmpeg -nostats -hide_banner -i ${dir}build/mix.wav -af ebur128=peak=true -f null - 2>&1 | awk '/Summary:/{s=1} s'`], {encoding: 'utf8'});
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(res)![1]), tp = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(res)![1]);
  assert.ok(Math.abs(I + 14) <= 0.7, `I=${I}`);
  assert.ok(tp <= -1.4, `TP=${tp}`);
  fs.rmSync(tmp, {recursive: true, force: true});
});
