// npm run stock -- <episode-id>   fetches licensed b-roll for every scene with `stock: {query, kind}` and writes episodes/<id>/stock.json
try { process.loadEnvFile(); } catch { /* .env optional */ }
import {episodeDir, loadEpisode} from '../schema.js';
import {stockForEpisode} from './index.js';

const ep = loadEpisode(process.argv[2] ?? '');
const items = await stockForEpisode(episodeDir(ep.id), ep.scenes, ep.format, {log: m => console.warn(m)});
console.log(`stock: ${items.length} of ${ep.scenes.filter(s => s.stock).length} beats have licensed footage (episodes/${ep.id}/stock.json)`);
