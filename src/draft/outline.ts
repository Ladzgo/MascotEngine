import {Episode, VISUAL_KINDS} from '../schema.js';
import {extractJson, type Client} from '../llm/llm.js';
import {EMOTIONS, MODEL, SCENE_TYPES, langNote, repairDraft, validate, type DraftStats} from './draft.js';
import {FB_FOR, FB_KINDS} from '../fullbleed/objects.js';
import {HU_SHAPE_EXAMPLE, LANG_RULES, isHu} from './lang.js';
import {spokenNumbers} from './lint.js';
import {styleGaps} from './critic.js';
import {deviceById, extraNumbers, pickDevice, pickHook, recentDevices, type Device} from './story.js';

type Sc = Episode['scenes'][number];
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const text = (r: {content: Array<{type: string; text?: string}>}) => r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');

export type Outline = {
  title: string; sources: string[]; hook: string; stakes: string;
  sections: {heading: string; point: string; fact: string; numbers: number[]; calc?: {expr: string; result: number}}[];
  twist: string; recap: string; cta: string;
  /** results of calc expressions that did not check out; numbers equal to these are never allowed in narration */
  badResults: number[];
  /** story engine: device id and its device-specific facts (character, myth/truth, simulation start, ...) */
  device?: string; extras?: unknown;
};

/** Evaluate +-*x/() arithmetic only; anything else is rejected (no eval of model text). */
export function safeCalc(expr: string): number | undefined {
  const e = expr.replace(/[x×]/gi, '*').replace(/,/g, '').replace(/(\d)\s*%/g, '($1/100)').replace(/\s+/g, '');
  if (!e || !/^[0-9.+\-*/()^]+$/.test(e) || e.length > 80) return undefined;
  try { const v = Function(`"use strict";return (${e.replace(/\^/g, '**')})`)(); return Number.isFinite(v) ? v : undefined; } catch { return undefined; }
}
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-9);
const sig2 = (n: number) => (n === 0 ? 0 : Number(n.toPrecision(2)));

/** lenient: arithmetic that does not check out only blacklists the wrong result instead of failing the outline. */
export function parseOutline(raw: any, lenient = false, minSections = 4): {outline?: Outline; errors: string[]} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') return {errors: ['Output is not a JSON object.']};
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).filter((u: unknown) => { try { new URL(String(u)); return true; } catch { return false; } });
  const badResults: number[] = [];
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 6).map((x: any, i: number) => {
    const nums = (Array.isArray(x?.numbers) ? x.numbers : []).map((n: any) => Number(typeof n === 'object' ? n?.value : n)).filter(Number.isFinite);
    let calc: {expr: string; result: number} | undefined;
    if (x?.calc && typeof x.calc === 'object' && s(x.calc.expr)) {
      const got = safeCalc(String(x.calc.expr)), said = Number(x.calc.result);
      if (got === undefined) { if (!lenient) errors.push(`Section ${i + 1} calc "${x.calc.expr}" is not plain arithmetic.`); }
      else if (!Number.isFinite(said) || !near(got, said, 0.005)) { if (!lenient) errors.push(`Section ${i + 1} calc: ${x.calc.expr} = ${+got.toFixed(4)}, not ${x.calc.result}. Fix the arithmetic.`); if (Number.isFinite(said)) badResults.push(said); }
      else calc = {expr: String(x.calc.expr), result: got};
    }
    return {heading: s(x?.heading), point: s(x?.point), fact: s(x?.fact), numbers: nums, ...(calc ? {calc} : {})};
  }).filter((x: {heading: string; fact: string}) => x.heading && x.fact);
  const o = {title: s(raw.title), sources, hook: s(raw.hook), stakes: s(raw.stakes), sections, twist: s(raw.twist), recap: s(raw.recap), cta: s(raw.cta), badResults, ...(raw.extras && typeof raw.extras === 'object' ? {extras: raw.extras} : {})};
  if (!o.title || !o.hook || !o.twist || !o.recap || !o.cta || !o.stakes) errors.push('title, hook, stakes, twist, recap and cta are all required, non-empty strings.');
  if (wc(o.hook) > 15) errors.push(`hook has ${wc(o.hook)} words; 15 or fewer.`);
  if (sections.length < minSections) errors.push(`Only ${sections.length} usable sections (each needs heading and fact); write ${minSections} to 6.`);
  return {outline: errors.length ? undefined : o, errors};
}

/** Numbers the script may say: everything in the outline plus simple arithmetic between two of them (sum, difference, product, ratio, percent of). */
export function allowedNumbers(o: Outline): number[] {
  const base = new Set<number>();
  const bad = o.badResults;
  const addText = (t: string) => spokenNumbers(t).filter(n => !bad.some(b => near(n, b, 0.001))).forEach(n => base.add(n));
  [o.title, o.hook, o.stakes, o.twist, o.recap, o.cta].forEach(addText);
  extraNumbers(o.extras).filter(n => !bad.some(b => near(n, b, 0.001))).forEach(n => base.add(n));
  for (const x of o.sections) { addText(`${x.heading} ${x.point} ${x.fact}`); x.numbers.forEach(n => base.add(n)); if (x.calc) base.add(x.calc.result); }
  const b = [...base].filter(n => n > 0 && n < 1e13).slice(0, 40), all = new Set(b);
  for (const x of b) for (const y of b) { all.add(x + y); all.add(Math.abs(x - y)); all.add(x * y); all.add(x * y / 100); all.add(x / 100); if (y) all.add(x / y); if (x) all.add(y / x); all.add(x * 12); all.add(x / 12); }
  return [...all].filter(Number.isFinite);
}

/** Spoken numbers in a narration that the outline does not support (invented or wrong math). Small whole numbers (up to ten) are filler ("two ways") unless they are money or a percent. */
export function unsupportedNumbers(narration: string, allowed: number[]): number[] {
  const t = narration.toLowerCase();
  return spokenNumbers(narration).filter(n => {
    if (allowed.some(a => near(a, n) || (n >= 100 && sig2(a) === sig2(n)))) return false;
    if (Number.isInteger(n) && n <= 10 && !/[$€£%]|percent|dollar|euro|pound|százalék|forint/.test(t)) return false;
    return true;
  });
}

const OUTLINE_SHAPE = `{"title": string, "sources": [real URLs of official statistics or reputable outlets], "hook": "surprising claim, 15 words max", "stakes": "what this costs or gains the viewer, with one number",
 "sections": [{"heading": "3-6 words", "point": "the one idea of this section", "fact": "ONE concrete number or worked example with named amounts, e.g. a 20,000 dollar loan at 6 percent over 60 months", "numbers": [every number used in fact, as plain numbers], "calc": {"expr": "plain arithmetic using those numbers, e.g. 20000*0.06", "result": the number it gives}}  (4 to 6 sections; calc only when the fact derives a number)],
 "twist": "the catch or myth-bust", "recap": "one line", "cta": "one line, follow the channel"}`;

export async function draftOutline(o: {device?: Device; short?: boolean; client: Client; topic: string; angle?: string; voice: string; channelContext?: string; lang?: string; model?: string; log?: (m: string) => void}): Promise<Outline> {
  const system = `You plan explainer YouTube videos.${o.channelContext ? `\n\nChannel profile:\n${o.channelContext}` : ''}${isHu(o.lang) ? `\n\n${LANG_RULES.hu}` : ''}\n\nVoice guide:\n${o.voice}\n\nOutput ONLY one JSON object (no prose, no code fences): ${OUTLINE_SHAPE}${o.device ? `\nAlso add the key "extras": ${o.device.extras}.\n\nNARRATIVE DEVICE (${o.device.name}): ${o.device.plan}` : ''}\nRules: use only facts you are sure about; never invent URLs or statistics; do the arithmetic carefully, every derived number needs a calc. No guarantees, no advice.`;
  const messages: {role: 'user' | 'assistant'; content: string}[] = [{role: 'user', content: `Topic: ${o.topic}${o.angle ? `\nAngle: ${o.angle}` : ''}\n${o.short ? 'Plan a 40 second vertical Short: hook, stakes, exactly 3 sections (each with one concrete number or worked example), a twist, a recap, a call to action. Keep every field short.' : 'Plan a 4 minute video: hook, stakes, 4 to 6 sections (each with one concrete number or worked example), a twist, a recap, a call to action.'}`}];
  let errors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let out = '';
    try { out = text(await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 3000, system, messages})); } catch (e) { errors = [`LLM call failed: ${(e as Error).message.slice(0, 160)}`]; continue; }
    let parsed: {outline?: Outline; errors: string[]};
    try { parsed = parseOutline(extractJson(out), attempt === 2, o.short ? 3 : 4); } catch (e) { parsed = {errors: [`Output is not valid JSON: ${(e as Error).message}`]}; }
    if (parsed.outline) return parsed.outline;
    errors = parsed.errors;
    o.log?.(`outline attempt ${attempt + 1}: ${errors[0]}`);
    messages.push({role: 'assistant', content: out.slice(0, 6000)}, {role: 'user', content: `Fix these problems and output the full corrected JSON only:\n- ${errors.join('\n- ')}`});
  }
  throw new Error(`Outline failed after 3 tries:\n- ${errors.join('\n- ')}`);
}

export type Part = {key: string; label: string; brief: string; min: number; max: number; facts: string; minWords?: number; maxBeat?: number; /** hook text the closing must echo */ callback?: string; feature?: string; /** number a big_number can land on (calc result or the section's last number) */ focus?: number; unit?: string};
/** Split the outline into the parts that are expanded one LLM call each. Feature scene types rotate so the whole video has variety. */
export function planParts(o: Outline, short = false, device?: Device): Part[] {
  const FEATURES = ['big_number', 'compare', 'list', 'timeline', 'before_after', 'checklist', 'stats'];
  const parts: Part[] = [{key: 'opening', label: 'Hook and stakes', min: 3, max: 4, feature: 'big_number', facts: `Hook (first beat, a title scene, 15 words max): ${o.hook}\nStakes: ${o.stakes}`, brief: 'beat 1 is the hook (type title). Then 2 or 3 beats on the stakes.'}];
  o.sections.forEach((x, i) => parts.push({key: `s${i + 1}`, label: x.heading, min: 3, max: 5, feature: FEATURES[(i + 1) % FEATURES.length], focus: x.calc?.result ?? x.numbers.at(-1), facts: `Section "${x.heading}"\nIdea: ${x.point}\nFact: ${x.fact}${x.calc ? `\nArithmetic: ${x.calc.expr} = ${x.calc.result}` : ''}`, brief: device ? `${device.roles[i % device.roles.length]}. Land the fact with its exact numbers.` : 'explain the idea, then land the fact with the exact numbers, then say what it means for the viewer.'}));
  parts.push({key: 'twist', label: 'The catch', min: 2, max: 4, feature: 'compare', facts: `Twist: ${o.twist}`, brief: 'start with a short turn ("but" is fine here), then explain the catch concretely.'});
  if (device && parts[0]) { parts[0].brief = `${device.opening} ${parts[0].brief}`; if (o.extras) parts[0].facts += `\nStory facts (use these exact names and numbers): ${JSON.stringify(o.extras)}`; }
  parts.push({key: 'closing', label: 'Recap and call to action', min: 2, max: 3, facts: `Recap: ${o.recap}\nCall to action: ${o.cta}`, brief: `a one-line recap (a checklist scene is good), then the call to action as the very last beat.${device ? ` The last beat must call back to the opening line ("${o.hook}") by reusing one of its key words, so the loop closes.` : ''}`, callback: o.hook});
  if (short) return parts.filter(p => p.key !== 'twist' || o.twist).map(p => ({...p, min: 2, max: p.key === 'opening' ? 3 : 2, minWords: p.key === 'closing' ? 12 : 16, maxBeat: 14, feature: p.key === 'opening' || p.key === 'closing' ? undefined : p.feature, brief: `${p.brief} Shorts pacing: every beat is ONE short sentence of 6 to 14 words (about 3 seconds spoken).`}));
  return parts;
}

export const beatSystem = (voice: string, ctx: string | undefined, lang?: string, short = false) => `You write part of a script for an explainer YouTube channel.${ctx ? `\n\nChannel profile:\n${ctx}` : ''}${isHu(lang) ? `\n\n${LANG_RULES.hu}\n${HU_SHAPE_EXAMPLE.slice(0, 600)}` : ''}

Voice guide:

${voice}

${SCENE_TYPES}
emotion is one of: ${EMOTIONS.join(', ')}.
Visual kinds (optional "visual":{"kind":K} on talk, list and checklist beats): ${VISUAL_KINDS.join(', ')}.
Output ONLY one JSON object, every beat WITH its "type" field, e.g. {"beats":[{"type":"talk","emotion":"explaining","narration":"...","emphasis":["key word"],"visual":{"kind":"coins"}},{"type":"compare","emotion":"thinking","narration":"...","left":{"title":"A","value":"x"},"right":{"title":"B","value":"y"}}]}. Each beat is ONE visual moment: 1 or 2 short spoken sentences, 12 to 28 words, a fresh image or a plain fact, vary sentence length. Narration is spoken text: spell numbers out naturally. Use ONLY the numbers given in the facts (or plain arithmetic on them); never invent a number, name or statistic. Never repeat a phrase or metaphor from the lines already used. No filler openers ("so", "well", "basically"), no guarantees, no advice.${short ? ` SHORTS MODE: the video is a vertical Short of 30 to 55 seconds with full-screen pictures and no host. Every beat is ONE sentence of 6 to 14 words and MUST carry \"visuals\":[{\"kind\":K,\"at\":\"a word from the beat\"}] with 1 or 2 entries: K is the object that appears on screen, one of ${FB_KINDS.join(', ')}; at = the spoken word that brings that object in (omit at for the first entry). Neighbouring beats use different objects.` : ''}`;

const STOP = new Set(['that', 'this', 'with', 'your', 'from', 'they', 'have', 'what', 'when', 'will', 'about', 'than', 'then', 'into', 'were', 'been', 'does', 'more', 'most', 'every']);
export const keyWords = (t: string) => [...new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w)))];

/** Section-level check: what the model must fix before the beats are accepted. */
export function checkPart(beats: Sc[], p: Part, allowed: number[]): string[] {
  const errs: string[] = [];
  if (beats.length < p.min || beats.length > p.max) errs.push(`write ${p.min} to ${p.max} beats, you wrote ${beats.length}.`);
  beats.forEach((b, i) => {
    const n = wc(b.narration);
    if (n > (p.maxBeat ?? 40)) errs.push(`beat ${i + 1} has ${n} words; split it, ${p.maxBeat ? '6 to 14' : '12 to 28'} words per beat.`);
    const bad = unsupportedNumbers(b.narration, allowed);
    if (bad.length) errs.push(`beat ${i + 1} says ${bad.join(', ')}, which is not in the facts (or the arithmetic on them is wrong). Use only the given numbers.`);
  });
  const total = beats.reduce((a, b) => a + wc(b.narration), 0);
  const need = p.minWords ?? p.min * 14;
  if (total < need) errs.push(`only ${total} words in total; this part needs at least ${need}, so write fuller beats.`);
  if (p.callback && beats.length) { const kw = keyWords(p.callback), last = beats.slice(-2).map(b => b.narration.toLowerCase()).join(' '); if (kw.length && !kw.some(w => last.includes(w))) errs.push(`the closing must call back to the opening line ("${p.callback}"): reuse one of ${kw.slice(0, 4).join(', ')} in the last two beats.`); }
  if (p.key === 'opening' && beats[0] && wc(beats[0].narration) > 15) errs.push('beat 1 (the hook) must be 15 words or fewer.');
  return errs;
}

/** Small models often leave out "type"; infer it from the fields they did fill. */
export function inferType(b: any): any {
  if (!b || typeof b !== 'object' || (typeof b.type === 'string' && b.type)) return b;
  const t = b.chart ? 'chart' : b.left && b.right ? 'compare' : b.before && b.after ? 'before_after' : Array.isArray(b.events) ? 'timeline' : Array.isArray(b.columns) ? 'table' : Array.isArray(b.stats) ? 'stats' : Array.isArray(b.steps) ? 'checklist' : Array.isArray(b.items) ? 'list' : b.value !== undefined && b.label ? 'big_number' : 'talk';
  return {...b, type: t};
}

function parseBeats(out: string): Sc[] | string {
  let raw: any;
  try { raw = extractJson(out); } catch (e) { return `Output is not valid JSON: ${(e as Error).message}`; }
  if (Array.isArray(raw)) raw = {beats: raw};
  const list = raw?.beats ?? raw?.scenes;
  if (!Array.isArray(list) || !list.length) return 'Expected {"beats":[...]}.';
  const fixed = repairDraft({scenes: list.map(inferType)}).scenes as any[];
  const thou = (v: unknown) => (typeof v === 'string' && /^\d{4,}$/.test(v) ? Number(v).toLocaleString('en-US') : v);
  for (const b of fixed) { // tidy what small models get wrong on screen: long big-number labels (shrink to unreadable), bare 1000000
    if (b.type === 'big_number') { // unit repairs: no currency sign before years/months/%, a space before a word suffix
      const su = String(b.suffix ?? '');
      if (/^\s*(year|month|week|day|hour|%|percent|x\b)/i.test(su) && /[$€£]/.test(String(b.prefix ?? ''))) b.prefix = '';
      if (/^[A-Za-z]/.test(su)) b.suffix = ` ${su}`;
    }
    if (b.type === 'big_number' && String(b.label).length > 40) b.label = String(b.label).split(/[.,:;]| - /)[0].slice(0, 40).trim() || 'The number';
    for (const k of ['left', 'right', 'before', 'after']) if (b[k] && typeof b[k] === 'object') b[k].value = thou(b[k].value);
  }
  for (const b of fixed) { // full-bleed visuals: keep {kind, at?} entries with known objects only
    if (b.visuals === undefined) continue;
    const v = (Array.isArray(b.visuals) ? b.visuals : []).map((x: any) => ({kind: String(x?.kind ?? x), ...(x?.at ? {at: String(x.at).slice(0, 40)} : {})})).filter((x: any) => FB_KINDS.includes(x.kind) || FB_FOR[x.kind]).slice(0, 4);
    if (v.length) b.visuals = v; else delete b.visuals;
  }
  const ok = fixed.filter(b => typeof b.narration === 'string' && !/\d\s*[*=\/]\s*\d|=\s*\d/.test(b.narration) && Episode.shape.scenes.element.safeParse(b).success); // raw formulas are not narration
  return ok.length ? ok : 'No beat matched the scene schema.';
}

/** A section the model wrote as plain talk still lands its key number visually: the beat that says it becomes a big_number (value is spoken, so grounding keeps it). */
export function withFeature(beats: Sc[], p: Part): Sc[] {
  if (p.focus === undefined || !/^s\d+$/.test(p.key) || beats.some(b => b.type !== 'talk' && b.type !== 'title')) return beats;
  const i = beats.findIndex(b => spokenNumbers(b.narration).some(n => near(n, p.focus!, 0.001)));
  if (i < 0) return beats;
  const b = beats[i], m = /([$€£])\s?\d|\d\s?(%|percent)/i.exec(b.narration);
  const f = p.focus, decimals = Number.isInteger(f) ? 0 : Math.min(2, (String(f).split('.')[1] ?? '').length);
  const out = [...beats];
  out[i] = {type: 'big_number', emotion: b.emotion, emphasis: b.emphasis, narration: b.narration, value: f, prefix: m?.[1] && m[1] !== '%' && /[$€£]/.test(m[1]) ? m[1] : '', suffix: m?.[2] ? '%' : '', label: p.label.slice(0, 60), decimals} as Sc;
  return out;
}

export async function expandPart(o: {client: Client; part: Part; system: string; allowed: number[]; title: string; before: string; used: string; model?: string; log?: (m: string) => void}): Promise<Sc[]> {
  const {part: p} = o;
  const user = `Video: ${o.title}\nNow write: ${p.label}.\n${p.facts}\nInstructions: ${p.brief}\nWrite ${p.min} to ${p.max} beats. ${p.feature ? `Make exactly one beat a ${p.feature} scene (with complete data taken from the facts) if the facts allow it; otherwise use talk.` : ''} The other beats are talk (or list/checklist when it fits). No two neighbouring beats of the same type except talk. Give talk beats a "visual" kind that fits, different from the neighbouring beats.\nPrevious line (continue naturally, do not repeat it): ${o.before || '(start of video)'}\nAlready used (do not repeat these images or phrases): ${o.used.slice(-700)}`;
  const messages: {role: 'user' | 'assistant'; content: string}[] = [{role: 'user', content: user}];
  let best: Sc[] | undefined, bestErrs = 99;
  for (let attempt = 0; attempt < 3; attempt++) {
    let out = '';
    try { out = text(await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 2500, system: o.system, messages})); } catch (e) { o.log?.(`${p.label}: LLM call failed (${(e as Error).message.slice(0, 80)})`); continue; }
    const beats = parseBeats(out);
    if (typeof beats === 'string') { messages.push({role: 'assistant', content: out.slice(0, 4000)}, {role: 'user', content: `${beats} Output only {"beats":[...]}.`}); continue; }
    const errs = checkPart(beats, p, o.allowed);
    if (!errs.length) return withFeature(beats, p);
    // numbers that fail the check are never kept: a part with only count/length issues is a usable fallback, one with bad numbers is not
    if (!errs.some(e => /not in the facts/.test(e)) && errs.length < bestErrs) { best = beats.slice(0, p.max); bestErrs = errs.length; }
    o.log?.(`${p.label}: retry (${errs[0]})`);
    messages.push({role: 'assistant', content: out.slice(0, 4000)}, {role: 'user', content: `Fix and output the full {"beats":[...]} again:\n- ${errs.join('\n- ')}`});
  }
  if (best) return withFeature(best, p);
  // last resort: the outline's own words, always true to the facts
  const lines = p.facts.split('\n').filter(l => /^(Hook|Stakes|Idea|Fact|Twist|Recap|Call to action)/.test(l)).map(l => l.replace(/^[A-Za-z ()0-9,:]*?:\s*/, '').trim()).filter(Boolean);
  return lines.map((l, i) => ({type: i === 0 && p.key === 'opening' ? 'title' : 'talk', emotion: 'explaining', emphasis: [], narration: /[.!?]$/.test(l) ? l : `${l}.`}) as Sc);
}

/** Outline first, then one call per part; assembled, validated with the usual guards. Returns the episode (and the outline for tests/logs). */
export async function draftByOutline(o: {
  client: Client; topic: string; id: string; angle?: string; voice: string; model?: string; channel?: string; channelContext?: string; lang?: string; stats?: DraftStats;
  short?: boolean; device?: string; epsRoot?: string; log?: (m: string) => void; progress?: (done: number, total: number, label: string) => void;
}): Promise<Episode> {
  const device = o.device === 'none' ? undefined : pickDevice(o.topic, o.epsRoot ? recentDevices(o.epsRoot) : [], o.device);
  if (device) o.log?.(`story device: ${device.name}`);
  const outline = await draftOutline({device, short: o.short, client: o.client, topic: o.topic, angle: o.angle, voice: o.voice, channelContext: o.channelContext, lang: o.lang, model: o.model, log: o.log});
  if (device) {
    outline.device = device.id;
    const okH = (h: string) => unsupportedNumbers(h, allowedNumbers(outline)).length === 0;
    outline.hook = await pickHook({client: o.client, topic: o.topic, outlineHook: outline.hook, stakes: outline.stakes, device, lang: o.lang, model: o.model, allowedOk: okH, log: o.log});
  }
  const parts = planParts(outline, o.short, device), allowed = allowedNumbers(outline), system = beatSystem(o.voice, o.channelContext, o.lang, o.short) + langNote(o.lang);
  const scenes: Sc[] = [];
  o.progress?.(0, parts.length, 'Outline ready');
  for (const [i, part] of parts.entries()) {
    const beats = await expandPart({client: o.client, part, system, allowed, title: outline.title, before: scenes.at(-1)?.narration ?? '', used: scenes.map(s => s.narration).join(' '), model: o.model, log: o.log});
    if (!o.short && part.key.startsWith('s') && /^s\d+$/.test(part.key) && beats[0]) beats[0] = {...beats[0], chapter: part.label.slice(0, 40)} as Sc; // chapter tag on the first beat of each section
    const toks = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    const dup = (t: string) => scenes.some(x => { const a = toks(x.narration), b = toks(t); const inter = [...a].filter(w => b.has(w)).length; return b.size > 0 && inter / Math.min(a.size, b.size) >= 0.8; });
    scenes.push(...beats.filter(b => !dup(b.narration)));
    o.progress?.(i + 1, parts.length, part.label);
  }
  scenes[0] = {type: 'title', emotion: scenes[0].emotion, narration: scenes[0].narration} as Sc;
  const raw = {...(o.short ? {format: 'short', look: 'fullbleed'} : {}), ...(device ? {device: device.id} : {}), id: o.id, title: outline.title, series: 'money-myths', seed: 0, disclaimer: true, sources: outline.sources, scenes};
  const {ep, errors} = validate(JSON.stringify(raw), o.id, o.channel, o.stats);
  if (!ep) throw new Error(`Outline draft failed validation:\n- ${errors.join('\n- ')}`);
  const gaps = styleGaps(ep);
  if (gaps.length) o.log?.(`style notes: ${gaps.join('; ')}`);
  return ep;
}
