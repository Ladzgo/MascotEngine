import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadChannel, channelContext, DEFAULT_CHANNEL_ID} from '../channel/channel.js';
import {requireClient} from '../llm/llm.js';
import {splitBeats} from './beats.js';
import {researchFacts, type Fact} from './facts.js';
import {closeLoop, concreteGaps, dropFlat, fillConcrete, improveStory, judgeStory, lastHookPick, pickTitle} from './story.js';
import {criticNotes, criticPass, ensurePayoff} from './critic.js';
import {editPass, fixEpisode} from './editor.js';
import {isHu} from './lang.js';
import {sourceFlags} from './lint.js';
import {draftByOutline, lastAllowed} from './outline.js';
import {rewriteWeak, scoreScript, SCORE_REWRITE_BELOW} from './score.js';
import {storyboard} from './storyboard.js';
import {estSec, fitDuration, SCENE_PAD, spreadVisuals} from '../director/shortsPro.js';
import {addScenes, fixCta, topicFitsChannel, tightenLong, expandThin, punchUpHook, draftEpisode, loadVoice, buildSystem, buildUser, writeDraft, MODEL} from './draft.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {values, positionals} = parseArgs({
  allowPositionals: true,
  options: {id: {type: 'string'}, angle: {type: 'string'}, dry: {type: 'boolean'}, channel: {type: 'string'}, 'no-punchup': {type: 'boolean'}, 'no-expand': {type: 'boolean'}, 'no-edit': {type: 'boolean'}, legacy: {type: 'boolean'}, short: {type: 'boolean'}, device: {type: 'string'}, 'no-storyboard': {type: 'boolean'}, 'no-rewrite': {type: 'boolean'}, 'no-facts': {type: 'boolean'}},
});
const topic = positionals.join(' ').trim();
const id = values.id;

function die(msg: string): never { console.error(msg); process.exit(1); }

if (!topic || !id) die('Usage: npm run draft -- "<topic>" --id <episode-id> [--channel <id>] [--angle "<text>"] [--dry]');
if (!/^[a-z0-9-]+$/.test(id)) die('Episode id must match [a-z0-9-]+');

const channelId = values.channel ?? DEFAULT_CHANNEL_ID;
let ctx: string, lang = 'en', chanName = '', fits = true;
try { const chan = loadChannel(channelId); ctx = channelContext(chan); lang = chan.language; chanName = chan.name; fits = topicFitsChannel(topic, chan); } catch (e) { die((e as Error).message); }
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
  // free fact research (Wikipedia) first: the outline and the story rewrites may use these sourced numbers
  const facts: Fact[] = !values.legacy && !values['no-facts'] ? await researchFacts(client, topic, {model, log}) : [];
  const angle = [values.angle, facts.length ? `Sourced facts (use their exact numbers; at least one should be the surprising fact of the video): ${facts.map(f => f.text).join(' ')}` : ''].filter(Boolean).join('\n') || undefined;
  const ep0 = values.legacy && !values.short ? await legacy() : await draftByOutline({client, topic, id, angle, voice, channel: channelId, channelContext: ctx, lang, model, log, short: values.short, device: values.device, epsRoot: path.join(root, 'episodes'), progress: (d, n, label) => console.log(`DRAFT_PROGRESS ${d}/${n} ${label}`)}).catch(e => { log(`outline draft failed (${(e as Error).message.replace(/\s*\n- /g, ' | ').slice(0, 300)}); using the one-shot prompt`); return legacy(); });
  log(`first draft: ${ep0.scenes.length} beats, ${ep0.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0)} words`);
  // the one-shot fallback knows nothing about Shorts: a --short draft is a 9:16 full-bleed episode whichever path wrote it (ep014 came out 16:9)
  if (values.short) Object.assign(ep0, {format: 'short', look: 'fullbleed'});
  // the opening part call sometimes rewrites beat 1; the judged hook is the one that ships
  if (lastHookPick && ep0.scenes[0] && ep0.scenes[0].narration.trim() !== lastHookPick.hook) { log(`beat 1 reset to the judged hook (was: ${ep0.scenes[0].narration})`); ep0.scenes[0] = {...ep0.scenes[0], narration: lastHookPick.hook}; }
  // long-form target ~950 words (6-7 min at 140-160 wpm); zzb-long1 stopped at 567 because both passes quit at 560-600
  const ep1 = (values['no-expand'] || values.short) ? ep0 : await expandThin(client, ep0, {model: process.env.DRAFT_MODEL ?? MODEL, lang, targetWords: 950, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const ep1b = (values['no-expand'] || values.short) ? ep1 : await addScenes(client, ep1, {model: process.env.DRAFT_MODEL ?? MODEL, lang, minWords: 950, max: 16, spread: true, log: m => console.log(`DRAFT_NOTE ${m}`)});
  const storyOn = !values.legacy && !values.device?.startsWith('none');
  // the story engine already picked a judged hook, so the old punch-up is skipped
  const ep2 = values['no-punchup'] || storyOn ? ep1b : await punchUpHook(client, ep1b, process.env.DRAFT_MODEL ?? MODEL, lang);
  const ep3 = await criticPass(client, ep2, {model: process.env.DRAFT_MODEL ?? MODEL, log: m => console.log(`DRAFT_NOTE ${m}`)});
  // editor pass: grammar/word-form repair with the local model (on by default for Hungarian, DRAFT_EDIT=1 for other languages), then deterministic fixers
  let ep4 = ep3;
  if (!values['no-edit'] && (isHu(lang) || process.env.DRAFT_EDIT === '1')) {
    const r = await editPass(client, ep3, {model: process.env.DRAFT_MODEL ?? MODEL, lang, log: m => console.log(`DRAFT_NOTE ${m}`)});
    ep4 = r.ep; console.log(`DRAFT_NOTE editor pass: ${r.changed}/${r.tried} scenes rewritten`);
  }
  const fixed = fixEpisode(ep4, lang);
  // the last line loops back to the hook; the stock closer is only the fallback
  const closer = storyOn ? await closeLoop({client, hook: fixed.scenes[0]?.narration ?? '', topic, lang, model, log}) : null;
  const closed = closer ? {...fixed, scenes: [...fixed.scenes, {type: 'talk', emotion: 'neutral', emphasis: [], narration: closer}] as typeof fixed.scenes} : ensurePayoff(fixed, lang);
  // Shorts come back from the part calls at 25-35 s; below 40 s estimated, add plain beats (no new numbers) before recap + CTA up to ~48 s
  const secs = (e: typeof closed) => e.scenes.reduce((a, s) => a + estSec(s) + SCENE_PAD, 0);
  const padded = values.short && secs(closed) < 40 ? await addScenes(client, closed, {model, lang, log, minWords: closed.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0) + Math.round((46 - secs(closed)) * 2.3), max: 3, before: 2}) : closed;
  if (padded !== closed) log(`short length: est ${secs(closed).toFixed(1)} s -> ${secs(padded).toFixed(1)} s`);
  const split = splitBeats(padded, values.short ? {max: 11, clauses: true} : {max: 16, clauses: true}); // beats last: the fixers above merge short talk runs; caps keep a Short beat under 5 s (12 words at 168 wpm + padding was 5.02 s)
  // a data or talk beat over ~5 s ("3000 mAh ... 600 mAh at zero degrees" read 7.4 s) becomes two sentences, then splits again
  const tight = values.short ? splitBeats(await tightenLong(client, split, {model, est: estSec, maxSec: 4.4, log}), {max: 11, clauses: true}) : split;
  const spread = values.short ? spreadVisuals(tight) : {ep: tight, fixed: 0};
  const fit = values.short ? fitDuration(spread.ep) : {ep: spread.ep, dropped: 0};
  let ep = fit.ep;
  for (let round = 0; round < 2 && !values['no-rewrite'] && scoreScript(ep).total < SCORE_REWRITE_BELOW; round++) { const next = await rewriteWeak(client, ep, {model, lang, log}); if (next === ep) break; ep = next; } // up to 2 rounds while under 75
  if (storyOn && !values['no-rewrite'] && concreteGaps(ep.scenes.map(s => s.narration)).length) ep = await fillConcrete(client, ep, {model, log, maxWords: values.short ? 12 : 20});
  if (values.short && concreteGaps(ep.scenes.map(s => s.narration)).length) { const d = dropFlat(ep, estSec); if (d.dropped) { log(`concrete: ${d.dropped} flat beats dropped`); ep = d.ep; } }
  if (!values['no-storyboard']) ep = await storyboard(client, ep, {model, log: m => console.log(`DRAFT_NOTE ${m}`)});
  ep = fixCta(ep, chanName, fits); // never "Follow Money Myths" on a battery video
  // title and the first story verdict do not depend on each other: run them together
  const [titled, story0] = storyOn ? await Promise.all([pickTitle(client, ep, {model, log}), judgeStory(client, ep, model)]) : [{title: ep.title, score: 0}, {score: 0}];
  ep = {...ep, title: titled.title};
  // the judge quotes its weakest line: rewrite that line by its note, re-judge, keep only a gain (2 rounds)
  const improved = storyOn && !values['no-rewrite'] ? await improveStory(client, ep, story0, {model, log, maxWords: values.short ? 14 : 28, facts: [...facts.flatMap(f => f.numbers), ...lastAllowed.filter(n => Number.isInteger(n) || n < 100).slice(0, 40)], factLines: facts.map(f => f.text), ...(values.short ? {est: estSec, maxSec: 4.4} : {})}) : {ep, score: story0.score, history: [story0.score]};
  ep = improved.ep;
  const story = {...story0, score: improved.score, history: improved.history};
  if (storyOn) log(`story judge ${story.score}/100${story.score < 75 && story.fix ? ` (fix: ${story.fix})` : ''}`);
  const sc = scoreScript(ep);
  console.log(`DRAFT_NOTE script score ${sc.total}/100 (${sc.items.map(i => `${i.name} ${i.got}/${i.max}`).join(', ')})`);
  if (fit.dropped) console.log(`DRAFT_NOTE ${fit.dropped} beats dropped to fit a 50 s (est.) Short`);
  if (spread.fixed) console.log(`DRAFT_NOTE ${spread.fixed} repeated visual kinds changed`);
  for (const n of criticNotes(ep)) console.log(`DRAFT_WARN ${n}`);
  if (ep2 !== ep1b) console.log(`DRAFT_NOTE hook sharpened: ${ep.scenes[0].narration}`);
  const flags = sourceFlags(ep);
  const file = writeDraft(path.join(root, 'episodes'), {...ep, sources: flags.vetted, ...(lastHookPick?.overlay ? {hookOverlay: lastHookPick.overlay} : {})}); // 5-7 word on-screen line for muted viewers (renderer: beat 1)
  if (facts.length) fs.writeFileSync(path.join(path.dirname(file), 'facts.json'), JSON.stringify({topic, facts}, null, 2));
  fs.writeFileSync(path.join(path.dirname(file), 'script-score.json'), JSON.stringify({...sc, hook: lastHookPick, story, title: titled, concreteGaps: concreteGaps(ep.scenes.map(s => s.narration))}, null, 2));
  if (Object.keys(flags.notes).length) fs.writeFileSync(path.join(path.dirname(file), 'notes.json'), JSON.stringify({notes: flags.notes}, null, 2));
  for (const n of Object.values(flags.notes).flat()) console.log(`DRAFT_WARN ${n}`);
  console.log(`DRAFT_OK ${file}`);
} catch (e) {
  die(`Draft failed: ${(e as Error).message}`);
}
