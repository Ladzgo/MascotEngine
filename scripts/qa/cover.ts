// Shorts cover frame (QUALITY-PLAN 16): beat 1 once the hook overlay and the hero have landed, full size, as build/cover.png (pick it in YouTube Studio).
//   npx tsx scripts/qa/cover.ts <id>
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../../src/schema.js';
import {loadCharacterAssets, withArt, withStock} from '../../src/pipeline/render.js';
import {chromiumTuning} from '../../src/pipeline/renderOpts.js';

const root = new URL('../../', import.meta.url).pathname, id = process.argv[2];
if (!id) { console.error('usage: tsx scripts/qa/cover.ts <episode-id>'); process.exit(1); }
const ep0 = loadEpisode(id), dir = episodeDir(ep0.id);
const {episode, publicDir, cleanup} = withArt(withStock(ep0, dir), dir);
let bundled: string;
try { bundled = await bundle({entryPoint: `${root}src/index.ts`, publicDir}); } finally { cleanup(); }
try {
  const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8')), decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
  const inputProps = {episode, timings, decisions, assets: loadCharacterAssets()}, comp = await selectComposition({serveUrl: bundled, id: 'Episode', inputProps});
  const d = decisions.scenes[0], frame = Math.round(Math.min(d.startSec + 1.1, d.startSec + d.durSec * 0.8) * comp.fps); // hook built (~0.4 s), hero popped in (~0.8 s)
  await renderStill({composition: comp, serveUrl: bundled, output: `${dir}build/cover.png`, frame, inputProps, chromiumOptions: chromiumTuning()});
  console.log(`cover: ${dir}build/cover.png (frame ${frame})`);
} finally { fs.rmSync(bundled, {recursive: true, force: true}); }
