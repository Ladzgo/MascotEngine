import path from 'node:path';
import {resolveProvider, providerClient} from '../llm/llm.js';
import {loadChannel} from '../channel/channel.js';
import {MODEL, buildPack, loadEpisodeFile, loadTimings, writePack} from './publish.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const id = process.argv[2];
function die(msg: string): never { console.error(msg); process.exit(1); }
if (!id || id.startsWith('-')) die('Usage: npm run publish-pack -- <episode-id>');

try {
  const {ep, dir} = loadEpisodeFile(root, id);
  const {timings, totalSec} = loadTimings(dir);
  let client: any;
  if (await resolveProvider()) client = providerClient();
  const pack = await buildPack({ep, timings, totalSec, client, model: process.env.DRAFT_MODEL ?? MODEL, channel: (() => { try { return loadChannel(ep.channel ?? 'default'); } catch { return undefined; } })()});
  console.log(`PACK_OK ${writePack(dir, pack)}`);
} catch (e) {
  die(`Publish pack failed: ${(e as Error).message}`);
}
