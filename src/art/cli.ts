import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadEpisode} from '../schema.js';
import {accentFor, artDir, parseScenes, plan, runArt, selectProvider} from './art.js';

const episodesRoot = path.resolve(new URL('../../episodes/', import.meta.url).pathname);
const {values, positionals} = parseArgs({
  allowPositionals: true,
  options: {scenes: {type: 'string'}, dry: {type: 'boolean'}, budget: {type: 'string'}},
});
function die(msg: string): never { console.error(msg); process.exit(1); }

const idArg = positionals[0];
if (!idArg) die('Usage: npm run art -- <episode-id> [--scenes 1,3] [--dry] [--budget N]');
let budget: number | undefined;
if (values.budget !== undefined) {
  budget = Number(values.budget);
  if (!Number.isInteger(budget) || budget < 0) die('--budget must be a whole number >= 0');
}
try {
  const ep = loadEpisode(idArg);
  const indices = parseScenes(values.scenes, ep.scenes.length);
  const accent = accentFor(episodesRoot, ep.id);
  const dir = artDir(episodesRoot, ep.id);
  if (values.dry) {
    const p = plan(ep, dir, indices, accent);
    for (const x of p) console.log(`--- scene ${x.index + 1}${x.cached ? ' (cached)' : ''}\n${x.prompt}\n`);
    const todo = p.filter(x => !x.cached).length;
    console.log(`Estimated images: ${budget === undefined ? todo : Math.min(todo, budget)} of ${p.length} scenes (${p.length - todo} cached)`);
    process.exit(0);
  }
  const provider = selectProvider();
  if (!provider) die('ART_PROVIDER is none. Set ART_PROVIDER to openai or replicate in Settings.');
  const r = await runArt({ep, episodesRoot, provider, indices, budget, accent, log: m => console.log(m)});
  console.log(`ART_OK ${r.dir}`);
} catch (e) {
  die((e as Error).message);
}
