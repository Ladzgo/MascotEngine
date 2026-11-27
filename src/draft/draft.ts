import fs from 'node:fs';
import path from 'node:path';
import {Episode, VISUAL_KINDS} from '../schema.js';
import {HU_SHAPE_EXAMPLE, LANG_RULES, isHu} from './lang.js';
import {styleGaps} from './critic.js';
import {autoFixEpisode, lintEpisode, repeatedPhrases, spokenNumbers} from './lint.js';
import {extractJson, type Client} from '../llm/llm.js';

export const MODEL = 'claude-sonnet-5-5';

export const FALLBACK_VOICE = `Tone: casual, dry humour, no hype. Never promise or guarantee returns, never give personalised advice. Short sentences. Explain like to a smart friend. Numbers always sourced.`;

export type {Client};
type Msg = {role: 'user' | 'assistant'; content: string};

export function loadVoice(voicePath: string, warn: (m: string) => void = console.error): string {
  if (fs.existsSync(voicePath)) return fs.readFileSync(voicePath, 'utf8');
  warn(`Warning: ${voicePath} missing, using built-in fallback tone.`);
  return FALLBACK_VOICE;
}

const EN_SHAPE_EXAMPLE = `{"title":"Renting Is Not Throwing Money Away","scenes":[
 {"type":"title","emotion":"smug","narration":"Renting is not burning money. Owning has bills too."},
 {"type":"talk","emotion":"explaining","narration":"Rent buys you a place to live and zero surprise repair bills."},
 {"type":"big_number","emotion":"shocked","value":1,"prefix":"","suffix":"%","label":"typical yearly upkeep cost of a home, as a share of its price","decimals":0,"narration":"Owners spend about one percent of the home's price every year just on upkeep."},
 {"type":"compare","emotion":"thinking","left":{"title":"Rent","value":"predictable"},"right":{"title":"Own","value":"surprises"},"narration":"One bill is predictable. The other arrives with a leaking roof."},
 {"type":"list","emotion":"explaining","items":["Count the full cost","Compare to rent","Keep an emergency fund"],"narration":"So count everything before you decide."}]}`;

export const langNote = (lang?: string) => (isHu(lang) ? ' Write the narration in natural spoken Hungarian (numbers: 1 234 567, decimal comma).' : '');

export const SCENE_TYPES = `Scene types (pick what fits the content): 
- title {narration, emotion}
- talk {narration, emotion, emphasis?: string[]}
- big_number {narration, emotion, value:number, prefix, suffix, label, decimals}
- chart {narration, emotion, chart:{kind:"line"|"bar", labels:[...], values:[...] same length, yLabel}}
- compare {narration, emotion, left:{title,value}, right:{title,value}}
- list {narration, emotion, items: 1-6 strings}
- timeline {narration, emotion, events:[{when:"1971", what:"short step"}...] 2-5 steps in time order; use when the script walks through dates or stages}
- before_after {narration, emotion, before:{title,value}, after:{title,value}; use for one thing then and now}
- table {narration, emotion, columns:[2-4 short headers], rows:[2-5 rows, one cell per column, first cell is the row label], highlight?: row index}
- checklist {narration, emotion, steps:[2-6 short steps]}
- stats {narration, emotion, stats:[{value:number, prefix, suffix, decimals, label}] 2-3 numbers, each said in the narration}
Any scene may also carry "visual":{"kind": illustration kind}.
emotion is one of: neutral, smug, worried, shocked, happy, excited, thinking, explaining, angry, sad, confused, sweating.`;

export function buildSystem(voice: string, channelCtx?: string, lang?: string): string {
  const hu = isHu(lang);
  return `You write draft scripts for an explainer YouTube channel.${channelCtx ? `\n\nChannel profile:\n${channelCtx}` : ''}${hu ? `\n\n${LANG_RULES.hu}` : ''}

Follow this voice guide verbatim:

${voice}

Shape example (a DIFFERENT topic, only to show structure and pacing; never reuse its words or numbers):
${hu ? HU_SHAPE_EXAMPLE : EN_SHAPE_EXAMPLE}

Output ONLY one JSON object (no prose, no code fences) matching this episode schema:
{"id": string, "title": string, "series": "money-myths", "seed": 0, "disclaimer": true, "sources": [url...],
 "scenes": [scene...]}
${SCENE_TYPES}
Rules: the FIRST scene is the hook, 15 words or fewer, with one surprising fact or claim. One clear angle. Every number shown (big_number, chart, or quoted in narration) must come from a real source whose URL is listed in "sources". Never invent URLs or data; if unsure, leave the number out. A big_number scene's "value" must be the exact number its own narration says out loud and must come from a source you list; if you do not know a real figure, write a talk scene instead (a big_number whose value the narration does not say is dropped). Never repeat a metaphor, simile, joke or phrase across scenes: each scene brings a fresh image or a plain fact. No guarantees, no advice phrasing. Narration is spoken text: spell out numbers naturally. This is a draft a human will rewrite.`;
}

export function buildUser(topic: string, id: string, angle?: string): string {
  return `Topic: ${topic}\nEpisode id: ${id}${angle ? `\nAngle: ${angle}` : ''}\nWrite the episode JSON about THIS topic only. Do not reuse sentences or numbers from the voice guide examples; every scene must be about "${topic}".
LENGTH: 16 to 22 scenes, 550 to 800 words in total (a 4 minute video). Each scene is ONE visual beat of 1 or 2 short sentences (12 to 30 words, 4 to 9 seconds spoken). Never put a whole paragraph in one scene.
STRUCTURE: 1) hook (surprising claim, 15 words max) 2) stakes: what this costs or gains the viewer 3) three to five concrete beats, each with a real number, a worked example with named amounts, or a plain analogy 4) a twist or myth-bust ("but here is the catch") 5) recap in one line 6) a one-line call to action to follow the channel.
VARIETY: no more than half of the scenes may be talk. Use at least one each of: big_number, compare or before_after, list or checklist, and (when the facts exist) table, stats, timeline or chart. Never two scenes of the same type in a row. Vary sentence length: mix a three-word sentence with a longer one. Be specific: "a 25,000 dollar loan at 7 percent over 72 months" beats "a loan". No filler openers ("so", "well", "basically"), no rhetorical "Have you ever wondered".
VISUAL: on talk, list and checklist scenes you may add "visual":{"kind":K} where K is one of ${VISUAL_KINDS.join(', ')}, picking the illustration that best shows that beat; use a different kind on neighbouring scenes.
Every scene, including list, needs real spoken narration (never "..."); the last scene is the call to action.`;
}

const EMO_ALIAS: Record<string, string> = {surprised: 'shocked', anxious: 'worried', nervous: 'worried', concerned: 'worried', curious: 'thinking', serious: 'neutral', calm: 'neutral', playful: 'smug', ironic: 'smug', sarcastic: 'smug', cynical: 'smug', mad: 'angry', frustrated: 'angry', upset: 'sad', confident: 'smug', amused: 'happy', hopeful: 'happy', skeptical: 'thinking'};
export const EMOTIONS = ['neutral', 'smug', 'worried', 'shocked', 'happy', 'excited', 'thinking', 'explaining', 'angry', 'sad', 'confused', 'sweating'];
const str = (v: unknown) => v === undefined || v === null ? '' : String(v);

/** Small local models drift from the schema in harmless ways; fix those before validating (never invents numbers). */
export function repairDraft(raw: any): any {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) return raw;
  if (Array.isArray(raw.sources)) raw.sources = raw.sources.filter((u: unknown) => { try { new URL(String(u)); return true; } catch { return false; } });
  raw.scenes = raw.scenes.filter((sc: any) => sc && typeof sc === 'object').map((sc: any) => {
    const e = str(sc.emotion).toLowerCase().trim();
    sc.emotion = EMOTIONS.includes(e) ? e : EMO_ALIAS[e] ?? 'neutral';
    if (typeof sc.narration !== 'string' || !sc.narration.trim() || /^[.\s…]+$/.test(sc.narration)) sc.narration = str(sc.text ?? sc.script ?? sc.label ?? (Array.isArray(sc.items) ? sc.items.map(str).join('. ') + '.' : '...'));
    if (!['title', 'talk', 'big_number', 'chart', 'compare', 'list', 'timeline', 'before_after', 'table', 'checklist', 'stats'].includes(sc.type)) sc.type = 'talk';
    for (const k of ['left', 'right']) if (sc.type === 'compare') { const x = sc[k] && typeof sc[k] === 'object' ? sc[k] : {}; sc[k] = {title: str(x.title ?? x.label ?? x.name), value: str(x.value ?? x.number ?? x.amount)}; }
    if (sc.type === 'big_number') { if (typeof sc.value === 'string') sc.value = parseFloat(sc.value.replace(/[^0-9.\-]/g, '')); sc.label = str(sc.label); }
    if (sc.type === 'chart') { // rescue flat chart fields; a chart without real data becomes a talk scene (never invented)
      const c = sc.chart && typeof sc.chart === 'object' ? sc.chart : {kind: sc.kind, labels: sc.labels, values: sc.values, yLabel: sc.yLabel};
      const vals = Array.isArray(c.values) ? c.values.map((v: unknown) => Number(typeof v === 'string' ? v.replace(/[^0-9.\-]/g, '') : v)) : [];
      const labels = Array.isArray(c.labels) ? c.labels.map(str) : [];
      if (labels.length >= 2 && labels.length === vals.length && vals.every(Number.isFinite)) sc.chart = {kind: c.kind === 'bar' ? 'bar' : 'line', labels, values: vals, yLabel: str(c.yLabel)};
      else { sc.type = 'talk'; delete sc.chart; }
    }
    if (sc.type === 'big_number' && !Number.isFinite(sc.value)) sc.type = 'talk';
    if (sc.type === 'before_after') for (const [k, alt] of [['before', 'left'], ['after', 'right']]) { const x = sc[k] && typeof sc[k] === 'object' ? sc[k] : sc[alt] && typeof sc[alt] === 'object' ? sc[alt] : {}; sc[k] = {title: str(x.title ?? x.label ?? x.name), value: str(x.value ?? x.number ?? x.amount)}; }
    if (sc.type === 'timeline') {
      const ev = (Array.isArray(sc.events) ? sc.events : []).map((e: any) => ({when: str(e?.when ?? e?.year ?? e?.date).slice(0, 16), what: str(e?.what ?? e?.label ?? e?.title ?? e?.text).slice(0, 60)})).filter((e: any) => e.when && e.what).slice(0, 5);
      if (ev.length >= 2) sc.events = ev; else { sc.type = 'talk'; delete sc.events; }
    }
    if (sc.visual !== undefined) { const k = str(sc.visual?.kind ?? sc.visual); if ((VISUAL_KINDS as readonly string[]).includes(k)) sc.visual = {kind: k}; else delete sc.visual; }
    if (sc.type === 'table') {
      const cols = (Array.isArray(sc.columns) ? sc.columns : []).map((c: unknown) => str(c).slice(0, 24)).filter(Boolean).slice(0, 4);
      const rows = (Array.isArray(sc.rows) ? sc.rows : []).filter(Array.isArray).map((r: unknown[]) => r.map(c => str(c).slice(0, 28))).filter((r: string[]) => r.length === cols.length).slice(0, 5);
      if (cols.length >= 2 && rows.length >= 2) { sc.columns = cols; sc.rows = rows; if (!(Number.isInteger(sc.highlight) && sc.highlight >= 0 && sc.highlight < rows.length)) delete sc.highlight; } else { sc.type = 'talk'; delete sc.columns; delete sc.rows; delete sc.highlight; }
    }
    if (sc.type === 'checklist') { const st = (Array.isArray(sc.steps) ? sc.steps : Array.isArray(sc.items) ? sc.items : []).map((x: unknown) => str(x).slice(0, 60)).filter(Boolean).slice(0, 6); if (st.length >= 2) sc.steps = st; else { sc.type = 'talk'; delete sc.steps; } }
    if (sc.type === 'stats') {
      const st = (Array.isArray(sc.stats) ? sc.stats : []).map((x: any) => ({value: typeof x?.value === 'string' ? parseFloat(x.value.replace(/[^0-9.\-]/g, '')) : x?.value, prefix: str(x?.prefix).slice(0, 4), suffix: str(x?.suffix).slice(0, 6), decimals: Number.isInteger(x?.decimals) ? Math.min(3, Math.max(0, x.decimals)) : 0, label: str(x?.label).slice(0, 40)})).filter((x: any) => Number.isFinite(x.value) && x.label).slice(0, 3);
      if (st.length >= 2) sc.stats = st; else { sc.type = 'talk'; delete sc.stats; }
    }
    if (sc.type === 'list' && Array.isArray(sc.items)) sc.items = sc.items.map(str).filter(Boolean).slice(0, 6);
    if (sc.emphasis !== undefined && !Array.isArray(sc.emphasis)) sc.emphasis = [str(sc.emphasis)];
    return sc;
  });
  // a scene with no real narration (placeholder dots) is dropped, never shown; keep the draft if that would leave fewer than 4 scenes
  const real = raw.scenes.filter((sc: any, i: number) => i === 0 || !/^[.\s…]*$/.test(str(sc.narration)));
  if (real.length >= 4) raw.scenes = real;
  return raw;
}

export type DraftStats = {attempts: number; failures: string[][]; demoted: number};
export function validate(text: string, id: string, channel?: string, stats?: DraftStats): {ep?: Episode; errors: string[]} {
  let raw: any;
  try { raw = extractJson(text); } catch (e) { return {errors: [`Output is not valid JSON: ${(e as Error).message}`]}; }
  if (raw && typeof raw === 'object') { raw.id = id; if (channel) raw.channel = channel; repairDraft(raw); }
  const r = Episode.safeParse(raw);
  if (!r.success) return {errors: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)};
  const fixed = autoFixEpisode(r.data);
  if (stats) stats.demoted += r.data.scenes.filter(x => x.type === 'big_number').length - fixed.scenes.filter(x => x.type === 'big_number').length;
  const errors = lintEpisode(fixed);
  return errors.length ? {errors} : {ep: fixed, errors: []};
}

export async function draftEpisode(o: {
  client: Client; topic: string; id: string; angle?: string; voice: string; model?: string; channel?: string; channelContext?: string; stats?: DraftStats; lang?: string;
}): Promise<Episode> {
  const system = buildSystem(o.voice, o.channelContext, o.lang);
  const messages: Msg[] = [{role: 'user', content: buildUser(o.topic, o.id, o.angle)}];
  let last: string[] = [], held: Episode | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    let text = '';
    try {
      const res = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 8000, system, messages});
      text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    } catch (e) { last = [`LLM call failed: ${(e as Error).message.slice(0, 160)}`]; if (attempt === 3) break; continue; }
    if (o.stats) o.stats.attempts++;
    const {ep, errors} = validate(text, o.id, o.channel, o.stats);
    if (ep) {
      // storyboard quality: ask twice for more variety (only when the script is long enough to judge), then accept the best effort
      const gaps = attempt < 2 && ep.scenes.length >= 10 ? styleGaps(ep) : [];
      if (!gaps.length) return ep;
      o.stats?.failures.push(gaps);
      messages.push({role: 'assistant', content: text.slice(0, 12000)}, {role: 'user', content: `Valid, but the storyboard needs work. Fix these and output the full corrected JSON only:\n- ${gaps.join('\n- ')}`});
      held = ep;
      continue;
    }
    last = errors;
    o.stats?.failures.push(errors);
    const unparsable = errors.length === 1 && errors[0].startsWith('Output is not valid JSON');
    // unusable output: start over with a fresh, clearly worded request instead of piling on a broken reply
    if (unparsable) { messages.splice(0, messages.length, {role: 'user', content: `${buildUser(o.topic, o.id, o.angle)}\nReturn ONLY one complete JSON object, nothing before or after it, and keep it short enough to finish.`}); continue; }
    messages.push({role: 'assistant', content: text.slice(0, 12000)}, {
      role: 'user',
      content: `The JSON failed validation. Fix these errors and output the full corrected JSON only:\n- ${errors.join('\n- ')}`,
    });
  }
  if (held) return held;
  throw new Error(`Draft failed validation after retry (4 tries):\n- ${last.join('\n- ')}`);
}

export function writeDraft(root: string, ep: Episode): string {
  const file = path.join(root, ep.id, 'episode.json');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(ep, null, 2) + '\n', {flag: 'wx'});
  return file;
}

/** Second, narrow pass: ask for a sharper opening line only. Accepted only if it passes the same hard rules; otherwise the draft is kept as is. */
export async function punchUpHook(client: Client, ep: Episode, model?: string, lang?: string): Promise<Episode> {
  const first = ep.scenes[0];
  if (!first) return ep;
  try {
    const res = await client.messages.create({model: model ?? MODEL, max_tokens: 300, system: langNote(lang).trim() + ' You sharpen the opening line of an explainer video. Output ONLY JSON: {"hook": string}. The hook is at most 14 words, concrete, surprising, plain spoken, no hype, no advice, no questions that start with "Did you know".',
      messages: [{role: 'user', content: `Title: ${ep.title}\nCurrent hook: ${first.narration}\nWhat the video says: ${ep.scenes.slice(1, 4).map(s => s.narration).join(' ')}\nWrite a stronger hook about the same claim.`}]});
    const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    const hook = String((extractJson(text) as {hook?: unknown}).hook ?? '').trim();
    const cand = autoFixEpisode({...ep, scenes: [{...first, narration: hook} as Episode['scenes'][number], ...ep.scenes.slice(1)]});
    const heard = ep.scenes.flatMap(s => spokenNumbers(s.narration)); // a sharper hook may not invent a figure
    if (hook && spokenNumbers(hook).every(n => heard.includes(n)) && hook.split(/\s+/).length <= 14 && cand.scenes[0].narration === hook && !lintEpisode(cand).length) return cand;
  } catch { /* keep the original hook */ }
  return ep;
}

const numsIn = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).map(n => n.replace(/[,.]+$/, ''));
const sceneData = (s: Episode['scenes'][number]) => JSON.stringify(s, (k, v) => (['narration', 'emotion', 'emphasis', 'type', 'art'].includes(k) ? undefined : v));

/**
 * Length pass for small models: scenes with thin narration are rewritten one call each (short prompt, easy for a 7B model) to ~28-45 words.
 * A rewrite is kept only if it is longer, not absurdly long, passes the banned-wording fixer, and adds no number that was not already in the scene.
 * Scene 1 (the hook) is never touched. Stops once the whole script reaches `targetWords`.
 */
export async function expandThin(client: Client, ep: Episode, o: {model?: string; targetWords?: number; minWords?: number; log?: (m: string) => void; lang?: string} = {}): Promise<Episode> {
  const target = o.targetWords ?? 600, thin = o.minWords ?? 14;
  const scenes = [...ep.scenes];
  const count = () => scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
  for (let i = 1; i < scenes.length && count() < target; i++) {
    const s = scenes[i];
    if (s.narration.trim().split(/\s+/).length >= thin) continue;
    try {
      const res = await client.messages.create({model: o.model ?? MODEL, max_tokens: 400,
        system: langNote(o.lang).trim() + ' You expand one line of narration in an explainer video script. Output ONLY JSON: {"narration": string}. 2 short spoken sentences (vary their length), 20 to 32 words, plain words, dry humour allowed, no hype, no advice, no guarantees. Keep every fact; do not add any new number, name or statistic. Never reuse a metaphor, simile or phrase from the other lines.',
        messages: [{role: 'user', content: `Video: ${ep.title}\nPrevious line: ${scenes[i - 1].narration}\nThis scene (${s.type}) shows: ${sceneData(s)}\nCurrent narration: ${s.narration}\nNext line: ${scenes[i + 1]?.narration ?? '(end)'}\nAlready used elsewhere (do not repeat these images or phrases): ${scenes.filter((_, j) => j !== i).map(x => x.narration).join(' ').slice(0, 900)}\nExpand the current narration so it flows between the previous and next lines.`}]});
      const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
      const cand = String((extractJson(text) as {narration?: unknown}).narration ?? '').trim();
      const words = cand.split(/\s+/).length;
      const known = new Set([...numsIn(s.narration), ...numsIn(sceneData(s)), ...numsIn(ep.title)]);
      if (!cand || words <= s.narration.trim().split(/\s+/).length || words > 45 || numsIn(cand).some(n => !known.has(n))) { o.log?.(`expand: kept scene ${i + 1} as is`); continue; }
      const fixed = autoFixEpisode({...ep, scenes: [{...s, narration: 'x'}, {...s, narration: cand}] as Episode['scenes']}).scenes[1].narration; // slot 0 is a dummy: the fixer treats it as the hook
      const others = scenes.filter((_, j) => j !== i).map(x => x.narration);
      if (repeatedPhrases([...others, cand], 4).length > repeatedPhrases(others, 4).length) { o.log?.(`expand: scene ${i + 1} repeats a phrase, kept as is`); continue; }
      if (fixed === cand) scenes[i] = {...s, narration: cand} as Episode['scenes'][number];
    } catch { /* keep the thin scene */ }
  }
  return {...ep, scenes: scenes as Episode['scenes']};
}

/**
 * Last resort for very short drafts: ask (one narrow call each) for extra talk scenes that explain the topic further.
 * Kept only if 25+ words, no new numbers, no banned wording and no repeated phrase; inserted before the closing scene.
 */
export async function addScenes(client: Client, ep: Episode, o: {model?: string; minWords?: number; max?: number; log?: (m: string) => void; lang?: string; /** insert before the last N beats (Shorts keep recap + CTA last) */ before?: number} = {}): Promise<Episode> {
  const scenes = [...ep.scenes];
  const count = () => scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
  const asks = ['a concrete everyday example (no new numbers)', 'the most common mistake people make', 'what a sensible person does about it (no advice phrasing)', 'why it feels different from what people expect'];
  for (let k = 0; k < (o.max ?? 4) && count() < (o.minWords ?? 560) && scenes.length >= 3; k++) {
    try {
      const res = await client.messages.create({model: o.model ?? MODEL, max_tokens: 400,
        system: langNote(o.lang).trim() + ' You add one scene to an explainer video script. Output ONLY JSON: {"narration": string, "emotion": string}. 1 or 2 short spoken sentences, 14 to 30 words, plain words, dry humour allowed, no hype, no advice, no guarantees. Do not add any number, name or statistic. Never reuse a metaphor or phrase from the existing lines.',
        messages: [{role: 'user', content: `Video: ${ep.title}\nExisting lines: ${scenes.map(x => x.narration).join(' ').slice(0, 1800)}\nWrite one new scene about: ${asks[k % asks.length]}.`}]});
      const j = extractJson(res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')) as {narration?: unknown; emotion?: unknown};
      const cand = String(j.narration ?? '').trim();
      const known = new Set([...scenes.flatMap(x => numsIn(x.narration)), ...numsIn(ep.title)]);
      const others = scenes.map(x => x.narration);
      const emo = EMOTIONS.includes(String(j.emotion)) ? String(j.emotion) : 'explaining';
      const fixed = autoFixEpisode({...ep, scenes: [{...scenes[0], narration: 'x'}, {type: 'talk', emotion: emo, emphasis: [], narration: cand}] as Episode['scenes']}).scenes[1].narration;
      if (cand.split(/\s+/).length < 12 || cand.split(/\s+/).length > 70 || numsIn(cand).some(n => !known.has(n)) || fixed !== cand || repeatedPhrases([...others, cand], 4).length > repeatedPhrases(others, 4).length) { o.log?.(`addScenes: rejected candidate ${k + 1} (${cand.split(/\s+/).length}w${fixed !== cand ? ', banned wording' : ''}${numsIn(cand).some(n => !known.has(n)) ? ', new number' : ''}${repeatedPhrases([...others, cand], 4).length > repeatedPhrases(others, 4).length ? ', repeat' : ''}): ${cand.slice(0, 80)}`); continue; }
      scenes.splice(scenes.length - (o.before ?? 1), 0, {type: 'talk', emotion: emo, emphasis: [], narration: cand} as Episode['scenes'][number]);
    } catch { /* skip */ }
  }
  return {...ep, scenes: scenes as Episode['scenes']};
}

/** Shorts: a beat that takes longer than `maxSec` to say (estimate) is rewritten as two short sentences with the same numbers, then split by the caller. */
export async function tightenLong(client: Client, ep: Episode, o: {model?: string; maxSec?: number; est: (s: {narration: string}) => number; log?: (m: string) => void}): Promise<Episode> {
  const max = o.maxSec ?? 4.8, long = ep.scenes.map((s, i) => ({s, i})).filter(({s, i}) => i > 0 && o.est(s) > max);
  if (!long.length) return ep;
  try {
    const res = await client.messages.create({model: o.model ?? MODEL, max_tokens: 900, system: 'You tighten lines of a spoken vertical Short. Rewrite each numbered line as TWO short spoken sentences of 4 to 9 words each, same facts, every number kept exactly as written, no new numbers, units in plain words people say. Output ONLY JSON: {"rewrites": [{"i": number, "narration": string}]}', messages: [{role: 'user', content: long.map(({s, i}) => `${i}: ${s.narration}`).join('\n')}]});
    const j = extractJson(res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')) as {rewrites?: {i: number; narration: string}[]};
    const scenes = [...ep.scenes];
    let n = 0;
    for (const w of j.rewrites ?? []) {
      const s = scenes[w.i]; if (!s || !long.some(l => l.i === w.i) || typeof w.narration !== 'string') continue;
      const t = w.narration.trim(), same = spokenNumbers(t).sort().join() === spokenNumbers(s.narration).sort().join();
      if (same && (t.match(/[.!?](\s|$)/g) ?? []).length >= 2) { scenes[w.i] = {...s, narration: t} as Episode['scenes'][number]; n++; }
    }
    o.log?.(`${long.length} beats over ${max} s, ${n} tightened`);
    return {...ep, scenes: scenes as Episode['scenes']};
  } catch (e) { o.log?.(`tighten skipped (${(e as Error).message.slice(0, 60)})`); return ep; }
}
