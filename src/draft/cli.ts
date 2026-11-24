import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadChannel, channelContext, DEFAULT_CHANNEL_ID} from '../channel/channel.js';
import {requireClient} from '../llm/llm.js';
import {criticNotes, criticPass} from './critic.js';
import {sourceFlags} from './lint.js';
import {addScenes, expandThin, punchUpHook, draftEpisode, loadVoice, buildSystem, buildUser, writeDraft, MODEL} from './draft.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {values, positionals} = parseArgs({
  allowPositionals: true,
  options: {id: {type: 'string'}, angle: {type: 'string'}, dry: {type: 'boolean'}, channel: {type: 'string'}, 'no-punchup': {type: 'boolean'}, 'no-expand': {type: 'boolean'}},
});
const topic = positionals.join(' ').trim();
const id = values.id;

function die(msg: string): never { console.error(msg); process.exit(1); }

if (!topic || !id) die('Usage: npm run draft -- "<topic>" --id <episode-id> [--channel <id>] [--angle "<text>"] [--dry]');
if (!/^[a-z0-9-]+$/.test(id)) die('Episode id must match [a-z0-9-]+');

const channelId = values.channel ?? DEFAULT_CHANNEL_ID;
let ctx: string;
try { ctx = channelContext(loadChannel(channelId)); } catch (e) { die((e as Error).message); }
const voice = loadVoice(path.join(root, 'docs/VOICE.md'));
if (values.dry) {
  console.log(buildSystem(voice, ctx) + '\n\n---\n' + buildUser(topic, id, values.angle));
  process.exit(0);
}
const dir = path.join(root, 'episodes', id);
if (fs.existsSync(path.join(dir, 'episode.json'))) die(`Episode ${id} already exists; refusing to overwrite.`);

const client = await requireClient(die);
try {
  const ep0 = await draftEpisode({client, topic, id, angle: values.angle, voice, channel: channelId, channelContext: ctx, model: process.env.DRAFT_MODEL ?? MODEL});
  const ep1 = values['no-expand'] ? ep0 : await expandThin(client, ep0, {model: process.env.DRAFT_MODEL ?? MODEL, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const ep1b = values['no-expand'] ? ep1 : await addScenes(client, ep1, {model: process.env.DRAFT_MODEL ?? MODEL, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const ep2 = values['no-punchup'] ? ep1b : await punchUpHook(client, ep1b, process.env.DRAFT_MODEL ?? MODEL);
  const ep = await criticPass(client, ep2, {model: process.env.DRAFT_MODEL ?? MODEL, log: m => console.log(`DRAFT_NOTE ${m}`)});
  for (const n of criticNotes(ep)) console.log(`DRAFT_WARN ${n}`);
  if (ep2 !== ep1b) console.log(`DRAFT_NOTE hook sharpened: ${ep.scenes[0].narration}`);
  const flags = sourceFlags(ep);
  const file = writeDraft(path.join(root, 'episodes'), {...ep, sources: flags.vetted});
  if (Object.keys(flags.notes).length) fs.writeFileSync(path.join(path.dirname(file), 'notes.json'), JSON.stringify({notes: flags.notes}, null, 2));
  for (const n of Object.values(flags.notes).flat()) console.log(`DRAFT_WARN ${n}`);
  console.log(`DRAFT_OK ${file}`);
} catch (e) {
  die(`Draft failed: ${(e as Error).message}`);
}
