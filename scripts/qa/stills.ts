// One full-size still per beat (at 60% of the beat) plus a contact sheet, from an episode's existing build (no TTS, no direct).
//   npx tsx scripts/qa/stills.ts <id> [outDir]   -> <outDir>/NN.png + sheet.png (default episodes/<id>/build/stills)
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../../src/schema.js';
import {loadCharacterAssets, withArt, withStock} from '../../src/pipeline/render.js';
import {chromiumTuning} from '../../src/pipeline/renderOpts.js';

const root = new URL('../../', import.meta.url).pathname;
const [id, outArg] = process.argv.slice(2);
if (!id) { console.error('usage: tsx scripts/qa/stills.ts <episode-id> [outDir]'); process.exit(1); }
const ep0 = loadEpisode(id), dir = episodeDir(ep0.id), out = outArg ?? `${dir}build/stills`;
fs.mkdirSync(out, {recursive: true});
const {episode, publicDir, cleanup} = withArt(withStock(ep0, dir), dir);
let bundled: string;
try { bundled = await bundle({entryPoint: `${root}src/index.ts`, publicDir}); } finally { cleanup(); }
const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
const decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
const inputProps = {episode, timings, decisions, assets: loadCharacterAssets()};
const comp = await selectComposition({serveUrl: bundled, id: 'Episode', inputProps});
const files: string[] = [];
for (const [i, s] of decisions.scenes.entries()) {
  const f = path.join(out, `${String(i + 1).padStart(2, '0')}.png`);
  await renderStill({composition: comp, serveUrl: bundled, output: f, frame: Math.round((s.startSec + s.durSec * 0.6) * 30), inputProps, scale: 0.5, chromiumOptions: chromiumTuning()});
  files.push(f);
}
const cols = Math.min(8, files.length), rows = Math.ceil(files.length / cols);
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-reinit_filter', '0', '-i', path.join(out, '%02d.png'), '-vf', `scale=240:-1,tile=${cols}x${rows}`, '-frames:v', '1', path.join(out, 'sheet.png')]);
console.log(`stills: ${files.length} beats -> ${out}/ (sheet.png, ${cols}x${rows})`);
