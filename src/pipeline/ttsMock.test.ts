// CliTTS branches (espeak-ng, piper) against mock CLIs: runs everywhere, no installs. The mocks write a sine "voice" whose length follows the text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CliTTS, autoEngineName, getEngine, piperAvailable} from './tts.js';
import {Episode} from '../schema.js';

const SINE = (out: string, textExpr: string) => `LEN=$(printf %s ${textExpr} | wc -c); DUR=$(awk "BEGIN{print 0.4+0.05*$LEN}"); ffmpeg -y -v error -f lavfi -i "sine=frequency=220:duration=$DUR" -ar 22050 -ac 1 ${out}`;
function mockBin(kind: 'espeak' | 'piper' | 'broken'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockbin-'));
  const w = (name: string, body: string) => { fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${body}\n`, {mode: 0o755}); };
  if (kind === 'espeak') w('espeak-ng', `echo "$@" > "${dir}/espeak.args"; OUT=; while [ $# -gt 1 ]; do case "$1" in -w) OUT="$2"; shift;; esac; shift; done; TEXT="$1"\n${SINE('"$OUT"', '"$TEXT"')}`);
  if (kind === 'piper') w('piper', `OUT=; while [ $# -gt 0 ]; do case "$1" in --output_file) OUT="$2"; shift;; esac; shift; done; TEXT=$(cat)\n${SINE('"$OUT"', '"$TEXT"')}`);
  if (kind === 'broken') { w('espeak-ng', 'echo "voice data missing" >&2; exit 3'); }
  return dir;
}
const ep = (n: number) => Episode.parse({id: 'm', title: 'm', scenes: Array.from({length: n}, (_, i) => ({type: 'talk', narration: `Scene number ${i + 1} says something short and clear.`}))});
const env = (over: Record<string, string | undefined>) => { const old: Record<string, string | undefined> = {}; for (const k of Object.keys(over)) { old[k] = process.env[k]; if (over[k] === undefined) delete process.env[k]; else process.env[k] = over[k]; } return () => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }; };
const NO_ALIGN = {WHISPER_MODEL: '/nonexistent/model.bin'}; // forces proportional timing, deterministic and fast

test('espeak-ng branch: mock CLI -> wav -> mp3, monotonic timings, args passed', async () => {
  const bin = mockBin('espeak');
  const back = env({PATH: `${bin}:${process.env.PATH}`, ESPEAK_VOICE: 'hu', ESPEAK_SPEED: '170', ...NO_ALIGN});
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-')) + '/';
    const t = await new CliTTS('espeak-ng').synthesize(ep(2), dir);
    assert.equal(t.engine, 'espeak-ng');
    assert.equal(t.scenes.length, 2);
    assert.ok(t.scenes[1].start >= t.scenes[0].end);
    assert.ok(t.scenes.every(s => s.words.length >= 6 && fs.existsSync(s.audioFile!) && s.audioFile!.endsWith('.mp3')));
    assert.ok(!fs.existsSync(`${dir}audio/scene-1.wav`), 'temporary wav removed');
    assert.match(fs.readFileSync(`${bin}/espeak.args`, 'utf8'), /-v hu -s 170 -w .*scene-2\.wav -- Scene number 2/);
  } finally { back(); }
});

test('piper branch: needs PIPER_MODEL, reads text from stdin, honours PIPER_BIN', async () => {
  const bin = mockBin('piper');
  const model = path.join(bin, 'voice.onnx'); fs.writeFileSync(model, '');
  const back = env({PATH: `${bin}:${process.env.PATH}`, PIPER_BIN: path.join(bin, 'piper'), PIPER_MODEL: model, ...NO_ALIGN});
  try {
    assert.ok(piperAvailable());
    const t = await new CliTTS('piper').synthesize(ep(1), fs.mkdtempSync(path.join(os.tmpdir(), 'tts-')) + '/');
    assert.equal(t.engine, 'piper');
    assert.ok(t.scenes[0].end - t.scenes[0].start > 1.5, 'duration follows the (stdin) text length');
  } finally { back(); }
  const back2 = env({PATH: `${bin}:${process.env.PATH}`, PIPER_BIN: path.join(bin, 'piper'), PIPER_MODEL: '/no/such.onnx', ...NO_ALIGN});
  try { await assert.rejects(new CliTTS('piper').synthesize(ep(1), '/tmp/x/'), /PIPER_MODEL/); } finally { back2(); }
});

test('a failing CLI surfaces its stderr with the scene number', async () => {
  const bin = mockBin('broken');
  const back = env({PATH: `${bin}:${process.env.PATH}`, ...NO_ALIGN});
  try { await assert.rejects(new CliTTS('espeak-ng').synthesize(ep(1), fs.mkdtempSync(path.join(os.tmpdir(), 'tts-')) + '/'), /espeak-ng failed on scene 1: voice data missing/); } finally { back(); }
});

test('auto engine on Linux: piper before espeak-ng before say; getEngine maps names', () => {
  const plat = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', {value: 'linux'});
  const eBin = mockBin('espeak'), pBin = mockBin('piper');
  const model = path.join(pBin, 'v.onnx'); fs.writeFileSync(model, '');
  try {
    let back = env({PATH: `${eBin}:${process.env.PATH}`, PIPER_BIN: undefined, PIPER_MODEL: undefined});
    assert.equal(autoEngineName(), 'espeak-ng'); back();
    back = env({PATH: `${pBin}:${eBin}:${process.env.PATH}`, PIPER_MODEL: model});
    assert.equal(autoEngineName(), 'piper'); assert.equal(getEngine('auto').name, 'piper'); back();
  } finally { Object.defineProperty(process, 'platform', plat); }
  assert.equal(getEngine('espeak-ng').name, 'espeak-ng');
  assert.throws(() => getEngine('nope'), /Unknown TTS engine/);
});
