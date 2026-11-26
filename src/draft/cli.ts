import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadChannel, channelContext, DEFAULT_CHANNEL_ID} from '../channel/channel.js';
import {requireClient} from '../llm/llm.js';
import {splitBeats} from './beats.js';
import {criticNotes, criticPass, ensurePayoff} from './critic.js';
import {editPass, fixEpisode} from './editor.js';
import {isHu} from './lang.js';
import {sourceFlags} from './lint.js';
import {draftByOutline} from './outline.js';
import {spreadVisuals} from '../director/shortsPro.js';
import {addScenes, expandThin, punchUpHook, draftEpisode, loadVoice, buildSystem, buildUser, writeDraft, MODEL} from './draft.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {values, positionals} = parseArgs({
  allowPositionals: true,
  options: {id: {type: 'string'}, angle: {type: 'string'}, dry: {type: 'boolean'}, channel: {type: 'string'}, 'no-punchup': {type: 'boolean'}, 'no-expand': {type: 'boolean'}, 'no-edit': {type: 'boolean'}, legacy: {type: 'boolean'}, short: {type: 'boolean'}},
});
const topic = positionals.join(' ').trim();
const id = values.id;

function die(msg: string): never { console.error(msg); process.exit(1); }

if (!topic || !id) die('Usage: npm run draft -- "<topic>" --id <episode-id> [--channel <id>] [--angle "<text>"] [--dry]');
if (!/^[a-z0-9-]+$/.test(id)) die('Episode id must match [a-z0-9-]+');

const channelId = values.channel ?? DEFAULT_CHANNEL_ID;
let ctx: string, lang = 'en';
try { const chan = loadChannel(channelId); ctx = channelContext(chan); lang = chan.language; } catch (e) { die((e as Error).message); }
const voice = loadVoice(path.join(root, 'docs/VOICE.md'));
if (values.dry) {
  console.log(buildSystem(voice, ctx, lang) + '\n\n---\n' + buildUser(topic, id, values.angle));
  process.exit(0);
}
const dir = path.join(root, 'episodes', id);
if (fs.existsSync(path.join(dir, 'episode.json'))) die(`Episode ${id} already exists; refusing to overwrite.`);

const client = await requireClient(die);
if (/^hu/i.test(lang) && !/gemma3|14b|27b|32b|70b/i.test(process.env.DRAFT_MODEL ?? process.env.OLLAMA_MODEL ?? '')) console.log('DRAFT_WARN Hungarian from small local models (7B and below) is often ungrammatical. For real use set OLLAMA_MODEL to gemma3:12b or larger (ollama pull gemma3:12b), or a hosted model.');
try {
  const model = process.env.DRAFT_MODEL ?? MODEL, log = (m: string) => console.log(`DRAFT_NOTE ${m}`);
  const legacy = () => draftEpisode({client, topic, id, angle: values.angle, voice, channel: channelId, channelContext: ctx, lang, model});
  // outline first, then one call per section (progress lines feed the Studio); the one-shot storyboard prompt is the fallback
  const ep0 = values.legacy && !values.short ? await legacy() : await draftByOutline({client, topic, id, angle: values.angle, voice, channel: channelId, channelContext: ctx, lang, model, log, short: values.short, progress: (d, n, label) => console.log(`DRAFT_PROGRESS ${d}/${n} ${label}`)}).catch(e => { log(`outline draft failed (${(e as Error).message.split('\n')[0]}); using the one-shot prompt`); return legacy(); });
  const ep1 = (values['no-expand'] || values.short) ? ep0 : await expandThin(client, ep0, {model: process.env.DRAFT_MODEL ?? MODEL, lang, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const ep1b = (values['no-expand'] || values.short) ? ep1 : await addScenes(client, ep1, {model: process.env.DRAFT_MODEL ?? MODEL, lang, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const ep2 = values['no-punchup'] ? ep1b : await punchUpHook(client, ep1b, process.env.DRAFT_MODEL ?? MODEL, lang);
  const ep3 = await criticPass(client, ep2, {model: process.env.DRAFT_MODEL ?? MODEL, log: m => console.log(`DRAFT_NOTE ${m}`)});
  // editor pass: grammar/word-form repair with the local model (on by default for Hungarian, DRAFT_EDIT=1 for other languages), then deterministic fixers
  let ep4 = ep3;
  if (!values['no-edit'] && (isHu(lang) || process.env.DRAFT_EDIT === '1')) {
    const r = await editPass(client, ep3, {model: process.env.DRAFT_MODEL ?? MODEL, lang, log: m => console.log(`DRAFT_NOTE ${m}`)});
    ep4 = r.ep; console.log(`DRAFT_NOTE editor pass: ${r.changed}/${r.tried} scenes rewritten`);
  }
  const split = splitBeats(ensurePayoff(fixEpisode(ep4, lang), lang), values.short ? {max: 12, clauses: true} : {max: 16, clauses: true}); // beats last: the fixers above merge short talk runs; caps keep a new visual idea under ~5 s
  const spread = values.short ? spreadVisuals(split) : {ep: split, fixed: 0};
  const ep = spread.ep;
  if (spread.fixed) console.log(`DRAFT_NOTE ${spread.fixed} repeated visual kinds changed`);
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
