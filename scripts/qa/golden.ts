// Golden frames: one small still (480x270, JPEG) per scene type, compared by SSIM with the committed references in scripts/qa/golden/*.jpg.
//   npm run qa:golden            compare (exit 1 on a visible change)
//   npm run qa:golden -- --update   rewrite the references after an intended visual change
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../../src/schema.js';
import {SilentTTS, writeTimings} from '../../src/pipeline/tts.js';
import {direct} from '../../src/director/direct.js';
import {loadCharacterAssets} from '../../src/pipeline/render.js';
import {chromiumTuning} from '../../src/pipeline/renderOpts.js';

const root = new URL('../../', import.meta.url).pathname; // keeps the trailing slash
const GOLD = path.join(root, 'scripts/qa/golden'), ID = 'zz-golden', SCALE = 0.25, MIN_SSIM = 0.985;
const update = process.argv.includes('--update');
const epDir = path.join(root, 'episodes', ID);

fs.rmSync(epDir, {recursive: true, force: true});
fs.mkdirSync(epDir, {recursive: true});
fs.copyFileSync(path.join(GOLD, 'episode.json'), path.join(epDir, 'episode.json'));
try {
  const ep = loadEpisode(ID), dir = episodeDir(ID);
  writeTimings(dir, await new SilentTTS().synthesize(ep, dir));
  const log = console.log; console.log = () => {};
  try { await direct(ID, {final: false, weights: {}}); } finally { console.log = log; }
  // the director picks accent/background/captions from history; pin them so the references do not depend on it
  const decFile = `${dir}build/decisions.json`, dec = JSON.parse(fs.readFileSync(decFile, 'utf8'));
  Object.assign(dec, {accent: 'tomato', background: 'grid', captionStyle: 'bar', intro: 'pop'});
  fs.writeFileSync(decFile, JSON.stringify(dec));
  const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8')), decisions = parseDecisions(JSON.stringify(dec));
  const bundled = await bundle({entryPoint: `${root}src/index.ts`, publicDir: `${root}assets`});
  const inputProps = {episode: ep, timings, decisions, assets: loadCharacterAssets()};
  const comp = await selectComposition({serveUrl: bundled, id: 'Episode', inputProps});
  const tmp = fs.mkdtempSync(path.join(root, 'out-golden-'));
  let bad = 0;
  for (const [i, s] of decisions.scenes.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}-${s.type}${ep.scenes[i].type === 'talk' && (ep.scenes[i] as {quote?: unknown}).quote ? '-quote' : ''}.jpg`;
    const frame = Math.round((s.startSec + s.durSec * 0.8) * 30);
    const png = path.join(tmp, name.replace('.jpg', '.png')), out = path.join(tmp, name);
    await renderStill({composition: comp, serveUrl: bundled, output: png, frame, inputProps, scale: SCALE, chromiumOptions: chromiumTuning()});
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '5', out]); // small references: paper grain makes PNGs 150 KB each
    const ref = path.join(GOLD, name);
    if (update || !fs.existsSync(ref)) { fs.copyFileSync(out, ref); console.log(`${update ? 'updated' : 'created'} ${name} (${fs.statSync(ref).size} B)`); continue; }
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', out, '-i', ref, '-lavfi', 'ssim', '-f', 'null', '-'], {encoding: 'utf8'});
    const ssim = Number(/All:([\d.]+)/.exec(r.stderr)?.[1] ?? 0);
    const ok = ssim >= MIN_SSIM;
    if (!ok) { bad++; fs.copyFileSync(out, path.join(GOLD, `FAIL-${name}`)); }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ssim ${ssim.toFixed(4)}  [>= ${MIN_SSIM}]`);
  }
  fs.rmSync(tmp, {recursive: true, force: true});
  if (bad) { console.error(`${bad} golden frame(s) changed; see scripts/qa/golden/FAIL-*.jpg. If the change is intended: npm run qa:golden -- --update`); process.exitCode = 1; }
} finally { fs.rmSync(epDir, {recursive: true, force: true}); }
