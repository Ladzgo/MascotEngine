import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {questionText, readability, thumbScore, thumbTexts} from './thumbnail.js';

test('thumbTexts: 2-3 keywords, numbers first, filler dropped, distinct variants', () => {
  const t = thumbTexts('/nonexistent/', 'Why $500 a Month Can Make You a Millionaire', 2);
  assert.equal(t.length, 2);
  assert.notEqual(t[0], t[1]);
  assert.ok(t[0].split(' ').length <= 3 && t[0].includes('$500'));
  assert.ok(!/\b(why|a|can)\b/i.test(t[0]));
});

test('readability: dark text on paper passes at 150 px, low-contrast grey mush fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'th-'));
  const mk = (name: string, vf: string) => { const f = path.join(dir, name); spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xf6f1e4:s=1280x720', '-vf', vf, '-frames:v', '1', f]); return f; };
  const good = mk('g.png', 'drawbox=x=60:y=100:w=620:h=130:color=0x1b1b1f:t=fill,drawbox=x=60:y=300:w=500:h=130:color=0x1b1b1f:t=fill');
  const bad = mk('b.png', 'drawbox=x=60:y=100:w=620:h=130:color=0xd8d2c0:t=fill');
  assert.ok(readability(good).ok);
  assert.ok(!readability(bad).ok);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('questionText and thumbScore (best variant = most legible, weak ones lose)', () => {
  assert.equal(questionText('Why Your Savings Are Quietly Shrinking', 'Savings Shrinking'), 'Why Your Savings Are?');
  assert.equal(questionText('Compound interest explained', 'Compound Interest Explained'), 'Compound Interest?');
  assert.ok(thumbScore({contrast: 15, ink: 0.2, ok: true}) > thumbScore({contrast: 8, ink: 0.1, ok: true}));
  assert.ok(thumbScore({contrast: 15, ink: 0.2, ok: false}) < thumbScore({contrast: 15, ink: 0.2, ok: true}) - 0.4);
});

test('golden: all three variants stay legible at 150 px for short, long and accented hooks', async () => {
  const {bundle} = await import('@remotion/bundler');
  const {renderStill, selectComposition} = await import('@remotion/renderer');
  const {loadCharacterAssets} = await import('./render.js');
  const {chromiumTuning} = await import('./renderOpts.js');
  const {thumbSize, MIN_THUMB_SIZE} = await import('../Thumbnail.js');
  const root = new URL('../../', import.meta.url).pathname;
  const serveUrl = await bundle({entryPoint: `${root}src/index.ts`, publicDir: `${root}assets`});
  const assets = loadCharacterAssets(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thg-'));
  try {
    for (const text of ['$500 A MONTH', 'COMPOUND INTEREST?', 'VÉSZALAP MIÉRT?']) {
      for (const variant of ['a', 'b', 'c'] as const) {
        assert.ok(thumbSize(variant, text) >= MIN_THUMB_SIZE, `${text} ${variant} size`);
        const props = {text, accent: 'violet', pose: 'shocked', assets, variant}, out = path.join(dir, `${variant}.png`);
        const comp = await selectComposition({serveUrl, id: 'Thumbnail', inputProps: props});
        await renderStill({composition: comp, serveUrl, output: out, inputProps: props, frame: 0, chromiumOptions: chromiumTuning()});
        const r = readability(out, variant);
        assert.ok(r.ok && thumbScore(r) >= 0.35, `${text} ${variant} ${JSON.stringify(r)}`);
      }
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
