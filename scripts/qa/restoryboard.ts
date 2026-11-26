// npm run qa:restoryboard -- <episode-id> <new-id>
// Copies an episode (script + cached audio) to <new-id>, drops its shot/stock/visuals and runs the current storyboard step again.
// Used to measure a storyboard change against the same script and voice (then: npm run direct, render, qa:semantic on both ids).
try { process.loadEnvFile(); } catch { /* .env optional */ }
import fs from 'node:fs';
import {requireClient} from '../../src/llm/llm.js';
import {storyboard} from '../../src/draft/storyboard.js';
import {Episode, episodeDir, loadEpisode} from '../../src/schema.js';

const [from, to] = process.argv.slice(2);
if (!from || !to) { console.error('Usage: npm run qa:restoryboard -- <episode-id> <new-id>'); process.exit(2); }
const src = loadEpisode(from), dst = episodeDir(to);
if (fs.existsSync(dst)) { console.error(`${dst} exists`); process.exit(2); }
fs.mkdirSync(dst, {recursive: true});
if (fs.existsSync(`${episodeDir(from)}audio`)) fs.cpSync(`${episodeDir(from)}audio`, `${dst}audio`, {recursive: true});
const client = await requireClient(m => { console.error(m); process.exit(2); });
const bare = Episode.parse({...src, id: to, scenes: src.scenes.map(({shot, stock, stockFile, visuals, visual, ...s}: any) => s)});
const out = await storyboard(client, bare, {model: process.env.DRAFT_MODEL, log: m => console.log(m)});
fs.writeFileSync(`${dst}episode.json`, JSON.stringify(out, null, 2));
const n = out.scenes.length, st = out.scenes.filter(s => s.stock).length;
console.log(`${to}: ${n} beats, ${st} with stock (${Math.round(100 * st / n)}%), ${new Set(out.scenes.map(s => s.shot?.subject)).size} distinct subjects`);
