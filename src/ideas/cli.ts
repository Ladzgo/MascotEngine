import path from 'node:path';
import {parseArgs} from 'node:util';
import {
  MODEL, buildSystem, buildUser, episodeTitles, generateIdeas, ideasPath,
  mergeIdeas, readIdeas, writeIdeas,
} from './ideas.js';
import {requireClient} from '../llm/llm.js';
import {loadChannel} from '../channel/channel.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {values} = parseArgs({
  options: {channel: {type: 'string'}, count: {type: 'string'}, focus: {type: 'string'}, scout: {type: 'boolean'}, dry: {type: 'boolean'}},
});
function die(msg: string): never { console.error(msg); process.exit(1); }

const chId = values.channel ?? 'default';
if (!/^[a-z0-9-]+$/.test(chId)) die('Channel id must match [a-z0-9-]+');
const count = values.count ? Number(values.count) : 10;
if (!Number.isInteger(count) || count < 1 || count > 30) die('--count must be an integer 1-30');

let channel;
try { channel = loadChannel(chId); } catch (e) { die((e as Error).message); }
const file = ideasPath(chId);
const existing = readIdeas(file);
const used = [...episodeTitles(root, chId), ...existing.ideas.map(i => i.title)];

if (values.dry) {
  console.log(buildSystem(channel) + '\n\n---\n' + buildUser(count, used, values.focus));
  process.exit(0);
}
let focus = values.focus;
if (values.scout) {
  const {fetchHeadlines, scoutFocus} = await import('../scout/scout.js');
  const sf = scoutFocus(await fetchHeadlines({niche: channel.niche, banned: channel.bannedTopics}));
  if (sf) focus = [focus, sf].filter(Boolean).join('\n'); else console.error('Scout: no headlines (offline?), continuing without.');
}
const client = await requireClient(die);

try {
  const {ideas, dropped} = await generateIdeas({
    client, channel, count, focus, used, model: process.env.DRAFT_MODEL ?? MODEL,
  });
  for (const d of dropped) console.error(`Dropped: ${d}`);
  const now = new Date().toISOString();
  writeIdeas(file, mergeIdeas(existing, ideas, now));
  console.log(`IDEAS_OK ${file}`);
} catch (e) {
  die(`Ideas failed: ${(e as Error).message}`);
}
