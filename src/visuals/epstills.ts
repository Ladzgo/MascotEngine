// Dev tool: stills of an episode's scenes using its existing build/ files. usage: npx tsx src/visuals/epstills.ts <episodeId> <outDir> [sceneIdx,...] [scale]
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../schema.js';
import {loadCharacterAssets} from '../pipeline/render.js';
const root = new URL('../../', import.meta.url).pathname;
const [id, out, idx, sc] = process.argv.slice(2);
const ep = loadEpisode(id), dir = episodeDir(ep.id);
const decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')), timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
const serveUrl = await bundle({entryPoint: `${root}src/index.ts`, publicDir: `${root}assets`});
const inputProps = {episode: ep, timings, decisions, assets: loadCharacterAssets()};
const composition = await selectComposition({serveUrl, id: 'Episode', inputProps});
fs.mkdirSync(out, {recursive: true});
const which = idx ? idx.split(',').map(Number) : decisions.scenes.map((_, i) => i);
for (const i of which) {
  const s = decisions.scenes[i];
  await renderStill({composition, serveUrl, output: `${out}/s${i}-${s.type}-${s.layout}.png`, frame: Math.round((s.startSec + Math.min(s.durSec * 0.8, 3.5)) * 30), inputProps, scale: Number(sc ?? 0.5)});
}
