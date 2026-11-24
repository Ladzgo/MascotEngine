import fs from 'node:fs';
import path from 'node:path';
import {Episode} from '../schema.js';
import {autoFixEpisode, lintEpisode, repeatedPhrases} from './lint.js';
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

export function buildSystem(voice: string, channelCtx?: string): string {
  return `You write draft scripts for an explainer YouTube channel.${channelCtx ? `\n\nChannel profile:\n${channelCtx}` : ''}

Follow this voice guide verbatim:

${voice}

Shape example (a DIFFERENT topic, only to show structure and pacing; never reuse its words or numbers):
{"title":"Renting Is Not Throwing Money Away","scenes":[
 {"type":"title","emotion":"smug","narration":"Renting is not burning money. Owning has bills too."},
 {"type":"talk","emotion":"explaining","narration":"Rent buys you a place to live and zero surprise repair bills."},
 {"type":"big_number","emotion":"shocked","value":1,"prefix":"","suffix":"%","label":"typical yearly upkeep cost of a home, as a share of its price","decimals":0,"narration":"Owners spend about one percent of the home's price every year just on upkeep."},
 {"type":"compare","emotion":"thinking","left":{"title":"Rent","value":"predictable"},"right":{"title":"Own","value":"surprises"},"narration":"One bill is predictable. The other arrives with a leaking roof."},
 {"type":"list","emotion":"explaining","items":["Count the full cost","Compare to rent","Keep an emergency fund"],"narration":"So count everything before you decide."}]}

Output ONLY one JSON object (no prose, no code fences) matching this episode schema:
{"id": string, "title": string, "series": "money-myths", "seed": 0, "disclaimer": true, "sources": [url...],
 "scenes": [scene...]}
Scene types (pick what fits the content): 
- title {narration, emotion}
- talk {narration, emotion, emphasis?: string[]}
- big_number {narration, emotion, value:number, prefix, suffix, label, decimals}
- chart {narration, emotion, chart:{kind:"line"|"bar", labels:[...], values:[...] same length, yLabel}}
- compare {narration, emotion, left:{title,value}, right:{title,value}}
- list {narration, emotion, items: 1-6 strings}
emotion is one of: neutral, smug, worried, shocked, happy, excited, thinking, explaining, angry, sad, confused, sweating.
Rules: the FIRST scene is the hook, 15 words or fewer, with one surprising fact or claim. One clear angle. Every number shown (big_number, chart, or quoted in narration) must come from a real source whose URL is listed in "sources". Never invent URLs or data; if unsure, leave the number out. Never repeat a metaphor, simile, joke or phrase across scenes: each scene brings a fresh image or a plain fact. No guarantees, no advice phrasing. Narration is spoken text: spell out numbers naturally. This is a draft a human will rewrite.`;
}

export function buildUser(topic: string, id: string, angle?: string): string {
  return `Topic: ${topic}\nEpisode id: ${id}${angle ? `\nAngle: ${angle}` : ''}\nWrite the episode JSON about THIS topic only. Do not reuse sentences or numbers from the voice guide examples; every scene must be about "${topic}". Use 9 to 12 scenes, narration 2 short sentences each, about 180 to 260 words in total (a 1.5 to 2 minute video). Include at least one compare or chart scene.`;
}

const EMO_ALIAS: Record<string, string> = {surprised: 'shocked', anxious: 'worried', nervous: 'worried', concerned: 'worried', curious: 'thinking', serious: 'neutral', calm: 'neutral', playful: 'smug', ironic: 'smug', sarcastic: 'smug', cynical: 'smug', mad: 'angry', frustrated: 'angry', upset: 'sad', confident: 'smug', amused: 'happy', hopeful: 'happy', skeptical: 'thinking'};
const EMOTIONS = ['neutral', 'smug', 'worried', 'shocked', 'happy', 'excited', 'thinking', 'explaining', 'angry', 'sad', 'confused', 'sweating'];
const str = (v: unknown) => v === undefined || v === null ? '' : String(v);

/** Small local models drift from the schema in harmless ways; fix those before validating (never invents numbers). */
export function repairDraft(raw: any): any {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) return raw;
  if (Array.isArray(raw.sources)) raw.sources = raw.sources.filter((u: unknown) => { try { new URL(String(u)); return true; } catch { return false; } });
  raw.scenes = raw.scenes.filter((sc: any) => sc && typeof sc === 'object').map((sc: any) => {
    const e = str(sc.emotion).toLowerCase().trim();
    sc.emotion = EMOTIONS.includes(e) ? e : EMO_ALIAS[e] ?? 'neutral';
    if (typeof sc.narration !== 'string' || !sc.narration.trim()) sc.narration = str(sc.text ?? sc.script ?? sc.label ?? '...');
    if (!['title', 'talk', 'big_number', 'chart', 'compare', 'list'].includes(sc.type)) sc.type = 'talk';
    for (const k of ['left', 'right']) if (sc.type === 'compare') { const x = sc[k] && typeof sc[k] === 'object' ? sc[k] : {}; sc[k] = {title: str(x.title ?? x.label ?? x.name), value: str(x.value ?? x.number ?? x.amount)}; }
    if (sc.type === 'big_number') { if (typeof sc.value === 'string') sc.value = Number(sc.value.replace(/[^0-9.\-]/g, '')); sc.label = str(sc.label); }
    if (sc.type === 'list' && Array.isArray(sc.items)) sc.items = sc.items.map(str).filter(Boolean).slice(0, 6);
    if (sc.emphasis !== undefined && !Array.isArray(sc.emphasis)) sc.emphasis = [str(sc.emphasis)];
    return sc;
  });
  return raw;
}

function validate(text: string, id: string, channel?: string): {ep?: Episode; errors: string[]} {
  let raw: any;
  try { raw = extractJson(text); } catch (e) { return {errors: [`Output is not valid JSON: ${(e as Error).message}`]}; }
  if (raw && typeof raw === 'object') { raw.id = id; if (channel) raw.channel = channel; repairDraft(raw); }
  const r = Episode.safeParse(raw);
  if (!r.success) return {errors: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)};
  const fixed = autoFixEpisode(r.data);
  const errors = lintEpisode(fixed);
  return errors.length ? {errors} : {ep: fixed, errors: []};
}

export async function draftEpisode(o: {
  client: Client; topic: string; id: string; angle?: string; voice: string; model?: string; channel?: string; channelContext?: string;
}): Promise<Episode> {
  const system = buildSystem(o.voice, o.channelContext);
  const messages: Msg[] = [{role: 'user', content: buildUser(o.topic, o.id, o.angle)}];
  let last: string[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    let text = '';
    try {
      const res = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 8000, system, messages});
      text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    } catch (e) { last = [`LLM call failed: ${(e as Error).message.slice(0, 160)}`]; if (attempt === 3) break; continue; }
    const {ep, errors} = validate(text, o.id, o.channel);
    if (ep) return ep;
    last = errors;
    const unparsable = errors.length === 1 && errors[0].startsWith('Output is not valid JSON');
    // unusable output: start over with a fresh, clearly worded request instead of piling on a broken reply
    if (unparsable) { messages.splice(0, messages.length, {role: 'user', content: `${buildUser(o.topic, o.id, o.angle)}\nReturn ONLY one complete JSON object, nothing before or after it, and keep it short enough to finish.`}); continue; }
    messages.push({role: 'assistant', content: text.slice(0, 12000)}, {
      role: 'user',
      content: `The JSON failed validation. Fix these errors and output the full corrected JSON only:\n- ${errors.join('\n- ')}`,
    });
  }
  throw new Error(`Draft failed validation after retry (4 tries):\n- ${last.join('\n- ')}`);
}

export function writeDraft(root: string, ep: Episode): string {
  const file = path.join(root, ep.id, 'episode.json');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(ep, null, 2) + '\n', {flag: 'wx'});
  return file;
}

/** Second, narrow pass: ask for a sharper opening line only. Accepted only if it passes the same hard rules; otherwise the draft is kept as is. */
export async function punchUpHook(client: Client, ep: Episode, model?: string): Promise<Episode> {
  const first = ep.scenes[0];
  if (!first) return ep;
  try {
    const res = await client.messages.create({model: model ?? MODEL, max_tokens: 300, system: 'You sharpen the opening line of an explainer video. Output ONLY JSON: {"hook": string}. The hook is at most 14 words, concrete, surprising, plain spoken, no hype, no advice, no questions that start with "Did you know".',
      messages: [{role: 'user', content: `Title: ${ep.title}\nCurrent hook: ${first.narration}\nWhat the video says: ${ep.scenes.slice(1, 4).map(s => s.narration).join(' ')}\nWrite a stronger hook about the same claim.`}]});
    const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    const hook = String((extractJson(text) as {hook?: unknown}).hook ?? '').trim();
    const cand = autoFixEpisode({...ep, scenes: [{...first, narration: hook} as Episode['scenes'][number], ...ep.scenes.slice(1)]});
    if (hook && hook.split(/\s+/).length <= 14 && cand.scenes[0].narration === hook && !lintEpisode(cand).length) return cand;
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
export async function expandThin(client: Client, ep: Episode, o: {model?: string; targetWords?: number; minWords?: number; log?: (m: string) => void} = {}): Promise<Episode> {
  const target = o.targetWords ?? 340, thin = o.minWords ?? 32;
  const scenes = [...ep.scenes];
  const count = () => scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
  for (let i = 1; i < scenes.length && count() < target; i++) {
    const s = scenes[i];
    if (s.narration.trim().split(/\s+/).length >= thin) continue;
    try {
      const res = await client.messages.create({model: o.model ?? MODEL, max_tokens: 400,
        system: 'You expand one line of narration in an explainer video script. Output ONLY JSON: {"narration": string}. 2 or 3 short spoken sentences, 28 to 45 words, plain words, dry humour allowed, no hype, no advice, no guarantees. Keep every fact; do not add any new number, name or statistic. Never reuse a metaphor, simile or phrase from the other lines.',
        messages: [{role: 'user', content: `Video: ${ep.title}\nPrevious line: ${scenes[i - 1].narration}\nThis scene (${s.type}) shows: ${sceneData(s)}\nCurrent narration: ${s.narration}\nNext line: ${scenes[i + 1]?.narration ?? '(end)'}\nAlready used elsewhere (do not repeat these images or phrases): ${scenes.filter((_, j) => j !== i).map(x => x.narration).join(' ').slice(0, 900)}\nExpand the current narration so it flows between the previous and next lines.`}]});
      const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
      const cand = String((extractJson(text) as {narration?: unknown}).narration ?? '').trim();
      const words = cand.split(/\s+/).length;
      const known = new Set([...numsIn(s.narration), ...numsIn(sceneData(s)), ...numsIn(ep.title)]);
      if (!cand || words <= s.narration.trim().split(/\s+/).length || words > 70 || numsIn(cand).some(n => !known.has(n))) { o.log?.(`expand: kept scene ${i + 1} as is`); continue; }
      const fixed = autoFixEpisode({...ep, scenes: [{...s, narration: 'x'}, {...s, narration: cand}] as Episode['scenes']}).scenes[1].narration; // slot 0 is a dummy: the fixer treats it as the hook
      const others = scenes.filter((_, j) => j !== i).map(x => x.narration);
      if (repeatedPhrases([...others, cand]).length > repeatedPhrases(others).length) { o.log?.(`expand: scene ${i + 1} repeats a phrase, kept as is`); continue; }
      if (fixed === cand) scenes[i] = {...s, narration: cand} as Episode['scenes'][number];
    } catch { /* keep the thin scene */ }
  }
  return {...ep, scenes: scenes as Episode['scenes']};
}
