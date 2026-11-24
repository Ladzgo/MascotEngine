import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadEpisode} from '../schema.js';
import {SilentTTS} from './tts.js';

for (const id of ['ep001-inflation', 'ep002-compound-interest']) {
  test(`SilentTTS timings monotonic: ${id}`, async () => {
    const t = await new SilentTTS().synthesize(loadEpisode(id));
    let prevStart = -1;
    for (const s of t.scenes) {
      assert.ok(s.start > prevStart, 'scene starts strictly increase');
      assert.ok(s.end > s.start);
      prevStart = s.start;
      let pw = -1;
      for (const w of s.words) {
        assert.ok(w.start >= pw, 'word starts monotonic');
        assert.ok(w.end >= w.start);
        pw = w.start;
      }
    }
    assert.ok(t.total > t.scenes.at(-1)!.end);
  });
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {LocalRecordingTTS} from './tts.js';

function localEp(n: number) {
  const ep = loadEpisode('ep001-inflation');
  return {...ep, scenes: ep.scenes.slice(0, n)};
}

test('LocalRecordingTTS fallback timing from synthetic wav', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loc-')) + '/';
  fs.mkdirSync(`${dir}audio`);
  const ep = localEp(2);
  for (let i = 1; i <= 2; i++) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', `${dir}audio/scene-${i}.wav`]);
  const t = await new LocalRecordingTTS(null).synthesize(ep, dir);
  assert.equal(t.scenes.length, 2);
  assert.ok(t.scenes[0].audioFile!.endsWith('scene-1.wav'));
  assert.ok(t.scenes[1].start >= t.scenes[0].end);
  for (const s of t.scenes) {
    assert.ok(s.end - s.start >= 3);
    assert.ok(s.words.length > 0);
    assert.ok(s.words[0].start >= s.start);
    assert.ok(s.words.at(-1)!.end <= s.end);
  }
});

test('LocalRecordingTTS names missing recording', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loc-')) + '/';
  await assert.rejects(new LocalRecordingTTS(null).synthesize(localEp(1), dir), /scene-1\.\(wav\|mp3\|m4a\)/);
});

import {getEngine} from './tts.js';
test('say engine is registered and errors clearly when `say` is missing', async () => {
  const eng = getEngine('say');
  assert.equal(eng.name, 'say');
  const old = process.env.PATH;
  process.env.PATH = '/nonexistent';
  try { await assert.rejects(eng.synthesize(loadEpisode('ep001-inflation'), '/tmp/x/'), /say.*not found/); }
  finally { process.env.PATH = old; }
});

test('mapToNarration aligns hyphenated recognised words to spaced narration', async () => {
  const {mapToNarration} = await import('./align.js');
  const m = mapToNarration('A get rich quick scheme', [{w: 'A', start: 0, end: 0.2}, {w: 'get-rich-quick', start: 0.2, end: 1.1}, {w: 'scheme', start: 1.1, end: 1.5}]);
  assert.deepEqual(m.map(w => [w.w, w.start]), [['A', 0], ['get', 0.2], ['rich', 0.5], ['quick', 0.8], ['scheme', 1.1]]);
});

import {spawnSync} from 'node:child_process';
import {CliTTS, autoEngineName} from './tts.js';
const espeak = spawnSync('sh', ['-c', 'command -v espeak-ng'], {stdio: 'ignore'}).status === 0;
test('espeak-ng engine produces monotonic timings', {skip: !espeak}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esp-')) + '/';
  const t = await new CliTTS('espeak-ng').synthesize(localEp(2), dir);
  assert.equal(t.engine, 'espeak-ng');
  assert.ok(t.scenes[1].start >= t.scenes[0].end);
  assert.ok(t.scenes.every(s => s.words.length > 0 && fs.existsSync(s.audioFile!)));
});
test('auto engine resolves to a registered engine; CliTTS errors clearly without binary', async () => {
  assert.equal(getEngine(autoEngineName()).name, autoEngineName());
  const old = process.env.PATH; process.env.PATH = '/nonexistent';
  try { await assert.rejects(new CliTTS('espeak-ng').synthesize(localEp(1), '/tmp/x/'), /espeak-ng not found/); }
  finally { process.env.PATH = old; }
});

test('sayRate: language default (hu slower, en system default), SAY_RATE wins', async () => {
  const {sayRate} = await import('./tts.js');
  const ep: any = {channel: 'no-such-channel'};
  assert.equal(sayRate(ep, {}), undefined); // unknown channel -> en
  assert.equal(sayRate(ep, {SAY_RATE: '150'}), 150);
});
