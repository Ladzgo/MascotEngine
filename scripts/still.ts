// Frame check without a full render: npx tsx scripts/still.ts <episode-id> <scene-number> [seconds-into-scene=2] [Episode|Short] [out.png]
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../src/schema.js';
import {loadCharacterAssets} from '../src/pipeline/render.js';

const [id, sceneArg, secArg = '2', compId = 'Episode', outArg] = process.argv.slice(2);
if (!id || !sceneArg) { console.error('usage: still.ts <id> <scene#> [sec] [Episode|Short] [out.png]'); process.exit(1); }
const ep = loadEpisode(id), dir = episodeDir(ep.id), i = Number(sceneArg) - 1;
const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
const decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
const root = new URL('../', import.meta.url).pathname;
const bundled = await bundle({entryPoint: `${root}src/index.ts`, publicDir: `${root}assets`});
const inputProps: Record<string, unknown> = {episode: ep, timings, decisions, assets: loadCharacterAssets(), ...(compId === 'Short' ? {sceneIndexes: [i]} : {})};
const comp = await selectComposition({serveUrl: bundled, id: compId, inputProps});
const frame = compId === 'Short' ? Math.round(Number(secArg) * 30) : Math.round((decisions.scenes[i].startSec + Number(secArg)) * 30);
const out = outArg ?? `${dir}build/still-${compId}-s${sceneArg}.png`;
await renderStill({composition: comp, serveUrl: bundled, output: out, frame, inputProps});
console.log(out);
