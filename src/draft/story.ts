// Story engine: a rotating set of narrative devices (each with its own outline extras and section roles) and a hook generator
// that writes 5 candidates, judges them against a rubric and keeps the best.
import fs from 'node:fs';
import path from 'node:path';
import {extractJson, type Client} from '../llm/llm.js';
import {MODEL} from './draft.js';
import {isHu, LANG_RULES} from './lang.js';
import {slopHits} from './critic.js';
import {spokenNumbers} from './lint.js';
import type {Episode} from '../schema.js';

export type Device = {
  id: string; name: string;
  /** added to the outline prompt: how to plan this kind of video */
  plan: string;
  /** device-specific outline fields: the JSON fragment for "extras" */
  extras: string;
  /** one brief per section (cycled): the job of that section in this device */
  roles: string[];
  opening: string;
};

export const DEVICES: Device[] = [
  {id: 'anecdote', name: 'Cold-open anecdote', plan: 'Open INSIDE a short true-to-life story of one named person (first name, age, one concrete situation, 2 or 3 amounts). The sections follow what happened to them step by step and explain the money mechanics behind each step. The twist is what Anna (or whoever) could have done differently. Label the person as an example, never as a real individual.',
    extras: '{"name": "first name", "age": number, "situation": "one sentence", "numbers": [amounts used]}',
    roles: ['show the next moment of the person\'s story with the amount, then explain the mechanism in one plain sentence', 'what the numbers did to the person; say the number, then what it means to them', 'the turning point: what they noticed or changed'], opening: 'Beat 1 introduces the named person and the situation with a number. Beats 2-3 raise the stakes in their life.'},
  {id: 'myth_reality', name: 'Myth vs reality', plan: 'State the popular belief in the viewer\'s own words, then test it piece by piece against numbers. Each section is one claim of the myth and the fact that breaks (or confirms) it. The twist is the part of the myth that is actually true.',
    extras: '{"myth": "the belief in one sentence", "truth": "what is really the case, one sentence"}',
    roles: ['say what people believe about this part, then the number that checks it', 'the evidence: a worked example with named amounts', 'what is left standing of the myth'], opening: 'Beat 1 says the myth flatly. Beats 2-3 say why everybody believes it and what it would cost to be wrong.'},
  {id: 'simulation', name: 'What if you did X for 10 years', plan: 'Pick one habit or choice and simulate it over time with a fixed starting point (amount, rate, period). Sections are checkpoints on the timeline (year 1, year 5, year 10 or similar) with the running total. The twist compares with a small change. Keep every calc to one or two simple operations (multiplication, division, percent of an amount), no exponents or compounding formulas; use round numbers.',
    extras: '{"start": "starting amount or action", "years": number, "rate": "rate or assumption in words"}',
    roles: ['the first checkpoint: what you put in and what you have', 'the middle checkpoint: the total and what drove it', 'the final checkpoint and the gap versus the alternative'], opening: 'Beat 1 poses the what-if with the exact amount and period. Beats 2-3 set the rules of the simulation.'},
  {id: 'mistake_reveal', name: 'The mistake you are probably making', plan: 'Name a very common mistake early without explaining it yet. Walk through the typical thinking that leads to it, then reveal what it really costs with a worked example, then what to do instead (as an option, no advice).',
    extras: '{"mistake": "the mistake in 8 words", "cost": "what it costs, with a number"}',
    roles: ['the reasonable-sounding thinking behind the mistake', 'the reveal: the worked example showing the cost', 'the alternative, said as what some people do'], opening: 'Beat 1 teases the mistake and that most people make it. Beats 2-3 make it feel personal.'},
  {id: 'countdown', name: 'Countdown / ranking', plan: 'A ranked list counted down from the smallest effect to the biggest (3 to 5 items). Each section is one rank with a number attached and one surprising reason. Number 1 is the twist.',
    extras: '{"items": ["rank label with its number"]}',
    roles: ['say the rank out loud ("Number three"), the item and its number', 'say the rank, the item, and the surprising reason it ranks here', 'save the strongest for last: the biggest number and why it beats the others'], opening: 'Beat 1 promises the countdown and the biggest number is still to come. Beat 2 says how it was measured.'},
  {id: 'banks_trick', name: 'The trick the fine print hides', plan: 'Explain one pricing or product mechanism that works against the customer by showing the fine print in numbers: what is advertised, what is charged, who profits. Neutral tone, no accusations.',
    extras: '{"advertised": "what the ad says", "actual": "what the numbers say"}',
    roles: ['what is advertised, in the offer\'s own words and numbers', 'what is charged in practice, as a worked example', 'who gains from the gap and how large it is'], opening: 'Beat 1 shows the offer. Beats 2-3 ask what the catch could be.'},
  {id: 'before_after', name: 'Before and after', plan: 'Show two versions of the same person or budget: before a change and after, with exact amounts. Sections alternate before-state, the change, the after-state.',
    extras: '{"before": "state with a number", "after": "state with a number", "change": "what changed"}',
    roles: ['the before state with its numbers', 'the one change and what it did', 'the after state and the difference'], opening: 'Beat 1 shows the before picture in one number. Beats 2-3 make the viewer wonder what changed.'},
  {id: 'question_chain', name: 'Question chain', plan: 'The video is a chain of questions where each answer leads to the next question, ending on the question the viewer did not know to ask. Each section starts with its question.',
    extras: '{"questions": ["the question chain, 3 to 5 questions"]}',
    roles: ['ask the question, answer it with a number', 'the answer raises the next question: ask it and answer it', 'the last question, the one that matters most, and its answer'], opening: 'Beat 1 is the first question, short. Beats 2-3 say why it matters.'},
];
export const deviceById = (id?: string) => DEVICES.find(d => d.id === id);

/** Devices used by the most recent episodes (episode.json `device`), newest first. */
export function recentDevices(epsRoot: string, n = 3): string[] {
  try {
    return fs.readdirSync(epsRoot).map(d => path.join(epsRoot, d, 'episode.json')).filter(f => fs.existsSync(f))
      .map(f => ({m: fs.statSync(f).mtimeMs, d: (JSON.parse(fs.readFileSync(f, 'utf8')) as {device?: string}).device})).filter(x => x.d)
      .sort((a, b) => b.m - a.m).slice(0, n).map(x => x.d as string);
  } catch { return []; }
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Retention loop: mean audience retention (%) per story device from data/retention.json (YouTube curves imported by `npm run analytics`); {} below 3 videos. */
export function deviceRetention(root = new URL('../../', import.meta.url).pathname): Record<string, number> {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data/retention.json'), 'utf8')) as {videos?: Record<string, {curve?: number[]; episode?: string}>};
    const acc: Record<string, number[]> = {};
    for (const v of Object.values(data.videos ?? {})) {
      if (!v.curve?.length || !v.episode) continue;
      const dev = (JSON.parse(fs.readFileSync(path.join(root, 'episodes', v.episode, 'episode.json'), 'utf8')) as {device?: string}).device;
      if (dev) (acc[dev] ??= []).push(v.curve.reduce((a, b) => a + b, 0) / v.curve.length);
    }
    if (Object.values(acc).flat().length < 3) return {};
    return Object.fromEntries(Object.entries(acc).map(([k, xs]) => [k, xs.reduce((a, b) => a + b, 0) / xs.length]));
  } catch { return {}; }
}
/** One device not used in the last N episodes; the topic picks among the rest deterministically (same topic, same device). Devices whose measured retention is more than 5 points under the median sit out. */
export function pickDevice(topic: string, recent: string[], force?: string, retention: Record<string, number> = deviceRetention()): Device {
  const f = deviceById(force); if (f) return f;
  const free = DEVICES.filter(d => !recent.includes(d.id));
  let pool = free.length ? free : DEVICES.filter(d => d.id !== recent[0]);
  const known = Object.values(retention).sort((a, b) => a - b);
  if (known.length >= 2) { const med = known[Math.floor(known.length / 2)], kept = pool.filter(d => !(d.id in retention) || retention[d.id] >= med - 5); if (kept.length) pool = kept; }
  return pool[hash(topic) % pool.length];
}

/** Every number in an extras object (numbers and digits in strings): they are facts the narration may use. */
export function extraNumbers(x: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) out.push(v); else if (typeof v === 'string') (v.match(/\d[\d,]*\.?\d*/g) ?? []).forEach(m => { const n = Number(m.replace(/,/g, '')); if (Number.isFinite(n)) out.push(n); }); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(x); return out;
}

/** "Elon Musk noticed...": a first + last name in a hook is a claim about a real person the facts do not support. */
export const fullName = (h: string) => /\b[A-Z][a-z]+ [A-Z][a-z]{2,}\b/.test(h);

const NUMW = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|billion|half|double|egy|kettő|két|három|négy|öt|hat|hét|nyolc|kilenc|tíz|száz|ezer|millió)\b/i;
const wcount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const SETUP = /^(did you know|have you ever|hey|hi|welcome|in this video|today|let'?s talk|let me|here'?s (a|the) (thing|story)|so |well |imagine|ever wonder)/i;
/** Deterministic part of the hook rubric (0-10): under 12 words, a number, no stock phrases or setup opener, a person or a stake. */
export function hookHeuristic(h: string): number {
  let s = 0;
  if (wcount(h) < 12) s += 3; else if (wcount(h) <= 14) s += 1;
  if (NUMW.test(h)) s += 3;
  if (!slopHits(h).length && !SETUP.test(h.trim())) s += 2;
  if (/[$€£]|\b[A-Z][a-z]+,? \d{2}\b|\b(you|your|te|neked)\b/i.test(h)) s += 2;
  return s;
}

/** The six short-form hook formulas (video-hook-writer skill); every candidate uses a different one. */
export const HOOK_FORMULAS = {
  callout: 'addresses the viewer directly: "If you do X, stop."',
  curiosity_gap: '"The reason X happens is not what you think" (best on Shorts)',
  transformation: 'a result with a number and a timeframe: "X became Y in Z"',
  controversy: 'a genuinely contested take, said flatly',
  list_tease: '"Three things ..." with the count',
  visual_first: 'names a result the picture already shows, e.g. "This $5 cup costs $1,825."',
} as const;
export type HookPick = {hook: string; score: number; formula?: string; overlay?: string; tried: number};
// shortcut: the outline (other agent's lane) only takes the hook string; the CLI reads the score from here. Pass a callback if this goes concurrent.
export let lastHookPick: HookPick | undefined;
export const HOOK_TARGET = 75;

const text = (r: {content: Array<{type: string; text?: string}>}) => r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
type Cand = {h: string; formula?: string; overlay?: string};
/** Judge 0-100 per line (specific claim 25, open question 25, stakes 15, signal first 15, under 12 words 10, number or name 10), blended 60/40 with the heuristic (x10). */
export async function judgeHooks(client: Client, lines: string[], model?: string): Promise<number[]> {
  let judged = lines.map(() => 50);
  try {
    const j = extractJson(text(await client.messages.create({model: model ?? MODEL, max_tokens: 500, system: 'You are a strict short-form video editor. Score each spoken opening line 0-100: specific claim, not a vague one (25); opens a question the viewer needs answered (25); stakes for the viewer (15); signal first, no setup, greeting or backstory before the point (15); under 12 words (10, zero if 12 or more); a concrete number or name (10). Hollow shock ("you won\'t believe") scores under 40. Output ONLY JSON: {"scores": [one number per line, same order]}', messages: [{role: 'user', content: lines.map((h, i) => `${i + 1}. ${h}`).join('\n')}]}))) as {scores?: unknown};
    if (Array.isArray(j.scores) && j.scores.length === lines.length) judged = j.scores.map(x => Math.max(0, Math.min(100, Number(x) || 50)));
  } catch { /* heuristic only */ }
  return lines.map((h, i) => Math.round(judged[i] * 0.6 + hookHeuristic(h) * 10 * 0.4));
}

/** 5 hook candidates, one per formula, judged; below HOOK_TARGET one more round gets the judge's best as the bar to beat. Numbers must pass `allowedOk`. */
export async function pickHook(o: {client: Client; topic: string; outlineHook: string; stakes: string; device?: Device; lang?: string; model?: string; allowedOk: (h: string) => boolean; log?: (m: string) => void}): Promise<string> {
  const formulas = Object.entries(HOOK_FORMULAS).map(([k, v]) => `${k}: ${v}`).join('\n');
  const sys = `You write the first spoken line of a vertical Short.${isHu(o.lang) ? `\n${LANG_RULES.hu}` : ''} It must stop a scroll in 3 seconds: under 12 words, a specific claim (a number or an everyday first-name person; never a real celebrity or public figure), opens a question the video answers, signal first: no greeting, no "in this video", no "did you know", no backstory, no hollow shock, no symbols like = or + (it is spoken). Use only numbers that appear in the given facts. Write 5 lines, each from a DIFFERENT formula:\n${formulas}\nAlso give a 5-7 word on-screen overlay per line that says the same promise in different words. Output ONLY JSON: {"hooks": [{"formula": "curiosity_gap", "line": "...", "overlay": "..."}, ... 5 items]}`;
  let pool: (Cand & {s: number})[] = [], tried = 0, bar = '';
  for (let round = 0; round < 2; round++) {
    let cands: Cand[] = [];
    try {
      const j = extractJson(text(await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 900, system: sys, messages: [{role: 'user', content: `Topic: ${o.topic}\nDevice: ${o.device?.name ?? 'any'}\nCurrent hook: ${o.outlineHook}\nStakes: ${o.stakes}${bar}`}]}))) as {hooks?: unknown};
      cands = (Array.isArray(j.hooks) ? j.hooks : []).map(x => typeof x === 'string' ? {h: x} : {h: String((x as {line?: unknown}).line ?? ''), formula: String((x as {formula?: unknown}).formula ?? '') || undefined, overlay: String((x as {overlay?: unknown}).overlay ?? '') || undefined}).map(c => ({...c, h: c.h.trim()})).filter(c => c.h);
    } catch (e) { o.log?.(`hook candidates failed (${(e as Error).message.slice(0, 60)})`); }
    if (round === 0) cands.unshift({h: o.outlineHook});
    cands = cands.filter((c, i, a) => wcount(c.h) <= 14 && !/[=+→<>|]/.test(c.h) && o.allowedOk(c.h) && !fullName(c.h) && !pool.some(p => p.h === c.h) && a.findIndex(x => x.h === c.h) === i);
    tried += cands.length;
    if (cands.length) { const s = await judgeHooks(o.client, cands.map(c => c.h), o.model); pool.push(...cands.map((c, i) => ({...c, s: s[i]}))); }
    pool.sort((a, b) => b.s - a.s);
    if (pool[0] && pool[0].s >= HOOK_TARGET) break;
    if (pool[0]) bar = `\nThe best line so far scored ${pool[0].s}/100: "${pool[0].h}". Write 5 sharper lines that beat it: more specific, shorter, a clearer open question.`;
  }
  const best = pool[0] ?? {h: o.outlineHook, s: 0};
  // the overlay must stand alone for muted viewers: 4-7 words, no question-only fragments like "Mind the cost?"
  const overlay = best.overlay && wcount(best.overlay) >= 4 && wcount(best.overlay) <= 7 ? best.overlay : undefined;
  lastHookPick = {hook: best.h, score: best.s, formula: best.formula, overlay, tried};
  o.log?.(`hook chosen from ${tried} (${best.formula ?? 'outline'}, ${best.s}/100${best.s < HOOK_TARGET ? `, under ${HOOK_TARGET}` : ''}): "${best.h}"`);
  return best.h;
}

// first names the concreteness check accepts at a sentence start (elsewhere any capitalised word counts as a name)
const FIRST_NAMES = new Set('anna alex ben clara david emma finn grace hugo ivy jack kate leo mia noah olivia paul quinn rosa sam sarah tara tom uma victor wendy zoe adam bella carl diana eric fiona george hana ian julia kevin lena mark maria nina oscar lisa john mike jane amy chris dan josh laura lucy max nick ryan sophie'.split(' '));
const SENT_START = /(^|[.!?]\s+)$/;
/** A number (digits or number words) or a name (a capitalised word mid-sentence, or a known first name). */
export function concrete(t: string): boolean {
  if (NUMW.test(t)) return true;
  for (const m of t.matchAll(/\b[A-Z][a-z]{2,}\b/g)) { if (!SENT_START.test(t.slice(0, m.index)) || FIRST_NAMES.has(m[0].toLowerCase())) return true; }
  return false;
}
/** Beat pairs (i, i+1) from beat 1 on where neither beat carries a number or a name: "a number or a name in every 2nd beat". Returns i. */
export function concreteGaps(narr: string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i + 1 < narr.length; i += 2) if (!concrete(narr[i]) && !concrete(narr[i + 1])) out.push(i);
  return out;
}

/** Rewrites one talk beat per gap so it carries a figure (number + unit) the script already says; kept per line only when valid. */
export async function fillConcrete(client: Client, ep: Episode, o: {model?: string; maxWords?: number; log?: (m: string) => void}): Promise<Episode> {
  const narr = ep.scenes.map(s => s.narration), gaps = concreteGaps(narr);
  const targets = gaps.map(i => [i + 1, i].find(k => k < narr.length - 2 && ep.scenes[k].type === 'talk' && !/follow|subscribe|channel/i.test(narr[k]))).filter((k): k is number => k !== undefined); // never the CTA or the closing line ("Follow Sam for more" happened)
  if (!targets.length) return ep;
  // only a figure WITH its unit, copied from the script ("80%", "$5", "0 degrees"): bare numbers and forced names read as nonsense ("It's 2 physics", "Sam's chemistry")
  const figures = [...new Set(narr.join(' ').match(/\$\d[\d,.]*(?:\s?(?:k|million|billion))?|\d[\d,.]*\s?(?:%|percent|degrees|°[CF]|dollars|hours|minutes|years|days|months|weeks|times)/gi) ?? [])];
  if (!figures.length) return ep;
  const max = o.maxWords ?? 14;
  try {
    const r = await client.messages.create({model: o.model ?? MODEL, max_tokens: 900, system: `You edit lines of a spoken explainer script. Rewrite each numbered line so it naturally carries one of these figures from the script, copied exactly: ${figures.join(', ')}. The sentence must make sense on its own and fit the line before it. Plain spoken, contractions are fine, ${max} words or fewer. No other numbers. If no figure fits naturally, return the line unchanged. Output ONLY JSON: {"rewrites": [{"i": number, "narration": string}]}`, messages: [{role: 'user', content: targets.map(i => `${i}: ${narr[i]}\n(before: ${narr[i - 1]})`).join('\n')}]});
    const j = extractJson(text(r)) as {rewrites?: {i: number; narration: string}[]};
    const scenes = ep.scenes.map(s => ({...s}));
    let n = 0;
    for (const w of j.rewrites ?? []) {
      if (!targets.includes(w.i) || typeof w.narration !== 'string') continue;
      const t = w.narration.trim();
      if (t === narr[w.i]) continue;
      const why = wcount(t) > max ? `${wcount(t)} words` : !figures.some(f => t.includes(f)) ? 'no script figure' : !spokenNumbers(t).every(x => spokenNumbers(narr.join(' ')).includes(x)) ? 'new number' : slopHits(t).length ? 'stock phrase' : '';
      if (why) { o.log?.(`concrete: beat ${w.i + 1} rewrite rejected (${why}): ${t}`); continue; }
      scenes[w.i].narration = t; n++;
    }
    o.log?.(`concrete: ${gaps.length} beat pairs without a number or name, ${n} lines rewritten`);
    return {...ep, scenes: scenes as Episode['scenes']};
  } catch (e) { o.log?.(`concrete pass skipped (${(e as Error).message.slice(0, 60)})`); return ep; }
}

const keyWords = (t: string) => t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !/^(that|this|with|your|from|they|have|what|when|will|about|than|then|into|were|been|does|more|most|every|there|their|which|would|could|should)$/.test(w));
/** Closing line that loops back to the hook (reuses one of its key words) instead of a stock closer; null when the model cannot give a valid one. */
export async function closeLoop(o: {client: Client; hook: string; topic: string; lang?: string; model?: string; log?: (m: string) => void}): Promise<string | null> {
  if (isHu(o.lang)) return null; // shortcut: English only (the product is English-only now), Hungarian keeps the stock closer
  const hookKeys = keyWords(o.hook);
  if (!hookKeys.length) return null;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 300, system: `You write the last spoken line of a short explainer video. One complete, grammatical sentence of 6 to 12 words, plain spoken English, starting with "So" or "Next time". It MUST contain one of these words from the opening line, so the video loops: ${hookKeys.join(', ')}. It lands the one thing to remember. No advice or guarantee wording, no numbers, no "follow" or "subscribe". Output ONLY JSON: {"lines": [3 different lines]}`, messages: [{role: 'user', content: `Topic: ${o.topic}\nOpening line: ${o.hook}`}]});
      const j = extractJson(r.content.filter(c => c.type === 'text').map(c => (c as {text?: string}).text ?? '').join('')) as {lines?: unknown};
      const ok = (Array.isArray(j.lines) ? j.lines : []).map(x => String(x).trim()).find(l => wcount(l) >= 5 && wcount(l) <= 14 && !/\d/.test(l) && !slopHits(l).length && !/follow|subscribe/i.test(l) && keyWords(l).some(w => hookKeys.includes(w)));
      if (ok) { o.log?.(`closing line loops to the hook: "${ok}"`); return ok; }
    }
    o.log?.('no closing line reused the hook; keeping the stock closer');
    return null;
  } catch (e) { o.log?.(`closing line skipped (${(e as Error).message.slice(0, 60)})`); return null; }
}

/** "Would a friend repeat this?" judge, 0-100: one surprising fact (25), a concrete person or example in the middle (20), a counter-intuitive turn (20), the ending pays off the hook (20), retellable in one sentence (15). */
export async function judgeStory(client: Client, ep: Pick<Episode, 'scenes'>, model?: string): Promise<{score: number; fix?: string}> {
  try {
    const j = extractJson(text(await client.messages.create({model: model ?? MODEL, max_tokens: 400, system: 'You are a tough YouTube Shorts editor. Score the script 0-100: one genuinely surprising fact (25); a concrete person or worked example in the middle (20); a counter-intuitive turn (20); the ending pays off the opening line (20); a viewer could retell it to a friend in one sentence (15). Output ONLY JSON: {"score": number, "fix": "the single change that would raise the score most, one sentence"}', messages: [{role: 'user', content: ep.scenes.map((s, i) => `${i + 1}. ${s.narration}`).join('\n')}]}))) as {score?: unknown; fix?: unknown};
    const score = Math.max(0, Math.min(100, Number(j.score) || 0));
    return {score, ...(typeof j.fix === 'string' && j.fix ? {fix: j.fix.slice(0, 200)} : {})};
  } catch { return {score: 0}; }
}

/** 5 title candidates (<= 50 characters), judged on curiosity + clarity; the outline title competes too. Numbers must already be in the script. */
export async function pickTitle(client: Client, ep: Pick<Episode, 'title' | 'scenes'>, o: {model?: string; log?: (m: string) => void} = {}): Promise<{title: string; score: number}> {
  const heard = new Set(ep.scenes.flatMap(s => spokenNumbers(s.narration)));
  try {
    const j = extractJson(text(await client.messages.create({model: o.model ?? MODEL, max_tokens: 500, system: 'You write YouTube Shorts titles. 5 different titles, each 50 characters or fewer, plain words, a specific promise the script keeps, curiosity without clickbait, no emoji, no hashtags, no ALL CAPS, numbers only if the script says them. Output ONLY JSON: {"titles": [5 strings]}', messages: [{role: 'user', content: `Current title: ${ep.title}\nScript: ${ep.scenes.map(s => s.narration).join(' ').slice(0, 1500)}`}]}))) as {titles?: unknown};
    const cands = [...new Set([ep.title, ...(Array.isArray(j.titles) ? j.titles.map(x => String(x).trim()) : [])])].filter(t => t && t.length <= 60 && !/#|[\u{1F300}-\u{1FAFF}]/u.test(t) && spokenNumbers(t).every(n => heard.has(n)));
    if (cands.length < 2) return {title: ep.title, score: 0};
    const s = extractJson(text(await client.messages.create({model: o.model ?? MODEL, max_tokens: 300, system: 'Score each YouTube Shorts title 0-100: curiosity (would you tap?) 40, clarity (you know what you get) 40, 50 characters or fewer 20 (zero if longer). Output ONLY JSON: {"scores": [one number per title, same order]}', messages: [{role: 'user', content: cands.map((t, i) => `${i + 1}. ${t}`).join('\n')}]}))) as {scores?: unknown};
    const sc = Array.isArray(s.scores) && s.scores.length === cands.length ? s.scores.map(x => Number(x) || 0) : cands.map(() => 0);
    const best = cands.map((t, i) => ({t, s: sc[i] - (t.length > 50 ? 30 : 0)})).sort((a, b) => b.s - a.s)[0];
    o.log?.(`title chosen from ${cands.length} (${best.s}/100): "${best.t}"`);
    return {title: best.t, score: best.s};
  } catch (e) { o.log?.(`title pick skipped (${(e as Error).message.slice(0, 60)})`); return {title: ep.title, score: 0}; }
}
