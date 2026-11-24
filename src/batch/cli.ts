try { process.loadEnvFile(); } catch { /* .env optional */ }
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadChannel} from '../channel/channel.js';
import {fetchHeadlines} from '../scout/scout.js';
import {existingIds, npmRunner, parseTopics, runBatch} from './batch.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {values} = parseArgs({options: {topics: {type: 'string'}, scout: {type: 'string'}, channel: {type: 'string'}, engine: {type: 'string'}, qa: {type: 'boolean'}}});
const channel = values.channel ?? 'default';
const die = (m: string): never => { console.error(m); process.exit(1); };

let topics: string[] = [];
if (values.topics) { if (!fs.existsSync(values.topics)) die(`No such file: ${values.topics}`); topics = parseTopics(fs.readFileSync(values.topics, 'utf8')); }
else if (values.scout) {
  const ch = loadChannel(channel);
  const have = new Set([...existingIds(root)].map(x => x.toLowerCase()));
  topics = (await fetchHeadlines({niche: ch.niche, banned: ch.bannedTopics, limit: 3 * Number(values.scout)})).map(h => h.title).filter(t => !have.has(t.toLowerCase())).slice(0, Number(values.scout));
} else die('Usage: npm run batch -- --topics topics.txt | --scout N [--channel <id>] [--engine auto|say|espeak-ng|piper] [--qa]');
if (!topics.length) die('No topics (empty file, or scout found nothing: offline?).');

const rep = await runBatch({topics, channel, engine: values.engine ?? 'auto', existing: existingIds(root), qa: values.qa, run: npmRunner(root), reportFile: path.join(root, 'batch-report.json')});
console.log(`\nbatch done: ${rep.ok} ok, ${rep.failed} failed (batch-report.json)`);
process.exit(rep.failed ? 1 : 0);
