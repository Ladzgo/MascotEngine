// Story engine: a rotating set of narrative devices (each with its own outline extras and section roles) and a hook generator
// that writes 5 candidates, judges them against a rubric and keeps the best.
import fs from 'node:fs';
import path from 'node:path';
import {extractJson, type Client} from '../llm/llm.js';
import {MODEL} from './draft.js';
import {isHu, LANG_RULES} from './lang.js';
import {slopHits} from './critic.js';

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
/** One device not used in the last N episodes; the topic picks among the rest deterministically (same topic, same device). */
export function pickDevice(topic: string, recent: string[], force?: string): Device {
  const f = deviceById(force); if (f) return f;
  const free = DEVICES.filter(d => !recent.includes(d.id));
  const pool = free.length ? free : DEVICES.filter(d => d.id !== recent[0]);
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
/** Deterministic part of the hook rubric (0-10): length, a number, no stock phrases, no throat-clearing opener, a person or a stake. */
export function hookHeuristic(h: string): number {
  let s = 0;
  if (wcount(h) <= 12) s += 3; else if (wcount(h) <= 15) s += 1;
  if (NUMW.test(h)) s += 3;
  if (!slopHits(h).length && !/^(did you know|have you ever|welcome|in this video|today|so |well )/i.test(h.trim())) s += 2;
  if (/[$€£]|\b[A-Z][a-z]+,? \d{2}\b|\b(you|your|te|neked)\b/i.test(h)) s += 2;
  return s;
}

/** 5 hook candidates, rubric-judged by the model (specificity, curiosity gap, stakes, number, <= 12 words), blended with the heuristic. Numbers must be in `allowed`. */
export async function pickHook(o: {client: Client; topic: string; outlineHook: string; stakes: string; device?: Device; lang?: string; model?: string; allowedOk: (h: string) => boolean; log?: (m: string) => void}): Promise<string> {
  const text = (r: {content: Array<{type: string; text?: string}>}) => r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
  const sys = `You write opening lines for short explainer videos.${isHu(o.lang) ? `\n${LANG_RULES.hu}` : ''} The first spoken sentence must stop a scroll: specific, concrete, one number or an everyday first-name person (never a real celebrity or public figure), 12 words or fewer, plain spoken, no hype words, no "Did you know". Use only numbers that appear in the given facts. Output ONLY JSON: {"hooks": [5 different strings, each built differently: a number first, a person first, a contradiction, a question that implies a number, a flat claim]}`;
  let cands: string[] = [];
  try { const j = extractJson(text(await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 600, system: sys, messages: [{role: 'user', content: `Topic: ${o.topic}\nDevice: ${o.device?.name ?? 'any'}\nCurrent hook: ${o.outlineHook}\nStakes: ${o.stakes}`}]}))) as {hooks?: unknown}; cands = (Array.isArray(j.hooks) ? j.hooks : []).map(x => String(x).trim()).filter(Boolean); } catch (e) { o.log?.(`hook candidates failed (${(e as Error).message.slice(0, 60)}); keeping the outline hook`); return o.outlineHook; }
  cands = [...new Set([o.outlineHook, ...cands])].filter(h => wcount(h) <= 15 && o.allowedOk(h) && !fullName(h));
  if (cands.length < 2) return cands[0] ?? o.outlineHook;
  let judged: number[] = cands.map(() => 5);
  try {
    const j = extractJson(text(await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 500, system: 'You are a strict editor. Score each opening line 1-10 on: specificity (a concrete thing, not a topic), curiosity gap (makes you need the next sentence), stakes (what it costs or gains the viewer), a number, brevity (12 words or fewer). Output ONLY JSON: {"scores": [one number per line, same order]}', messages: [{role: 'user', content: cands.map((h, i) => `${i + 1}. ${h}`).join('\n')}]}))) as {scores?: unknown};
    if (Array.isArray(j.scores) && j.scores.length === cands.length) judged = j.scores.map(x => Math.max(1, Math.min(10, Number(x) || 5)));
  } catch { /* heuristic only */ }
  const total = cands.map((h, i) => ({h, s: judged[i] * 0.6 + hookHeuristic(h) * 0.4}));
  total.sort((a, b) => b.s - a.s);
  o.log?.(`hook chosen from ${cands.length}: "${total[0].h}"`);
  return total[0].h;
}

const keyWords = (t: string) => t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !/^(that|this|with|your|from|they|have|what|when|will|about|than|then|into|were|been|does|more|most|every|there|their|which|would|could|should)$/.test(w));
/** Closing line that loops back to the hook (reuses one of its key words) instead of a stock closer; null when the model cannot give a valid one. */
export async function closeLoop(o: {client: Client; hook: string; topic: string; lang?: string; model?: string; log?: (m: string) => void}): Promise<string | null> {
  if (isHu(o.lang)) return null; // shortcut: English only (the product is English-only now), Hungarian keeps the stock closer
  const hookKeys = keyWords(o.hook);
  try {
    const r = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 300, system: 'You write the last spoken line of a short explainer video. 12 words or fewer, plain spoken English, starts with "So" or "Next time", reuses one key word from the opening line so the video loops, lands the one thing to remember. No advice or guarantee wording, no new numbers, no "follow" or "subscribe". Output ONLY JSON: {"lines": [3 different lines]}', messages: [{role: 'user', content: `Topic: ${o.topic}\nOpening line: ${o.hook}`}]});
    const j = extractJson(r.content.filter(c => c.type === 'text').map(c => (c as {text?: string}).text ?? '').join('')) as {lines?: unknown};
    const ok = (Array.isArray(j.lines) ? j.lines : []).map(x => String(x).trim()).find(l => wcount(l) <= 14 && !/\d/.test(l) && !slopHits(l).length && !/follow|subscribe/i.test(l) && keyWords(l).some(w => hookKeys.includes(w)));
    o.log?.(ok ? `closing line loops to the hook: "${ok}"` : 'no closing line reused the hook; keeping the stock closer');
    return ok ?? null;
  } catch (e) { o.log?.(`closing line skipped (${(e as Error).message.slice(0, 60)})`); return null; }
}
