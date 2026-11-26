import type {Episode} from '../schema.js';
import {extractJson, type Client} from '../llm/llm.js';
import {varietyStats} from './beats.js';
import {CLOSERS, HU_NUMBERISH, HU_PAYOFF, HU_SLOP, HU_TENSION, isHu} from './lang.js';

type Sc = Episode['scenes'][number];

/** Stock AI phrases. [pattern, replacement]; '' removes the phrase. Only wording is touched, never digits. */
const SLOP: [RegExp, string][] = [
  [/\bin (?:today'?s|this) (?:fast[- ]paced|digital|modern|ever[- ]changing) (?:world|age|landscape|era)\s*,?\s*/gi, ''],
  [/\bin (?:the )?(?:ever[- ]evolving|ever[- ]changing) (?:world|landscape) of\b/gi, 'in'],
  [/\b(?:let'?s|let us) (?:dive|delve) (?:deep )?(?:in|into)\b/gi, "let's look at"],
  [/\b(?:dive|delve|dig) (?:deep )?(?:in)?to\b/gi, 'look at'],
  [/\b(?:let'?s|let us) unpack\b/gi, "let's look at"],
  [/\bunpack(?:ing)?\b/gi, 'explain'],
  [/\bgame[- ]chang(?:er|ing)\b/gi, 'big shift'],
  [/\b(?:it'?s|it is) (?:important|worth) (?:to note|noting) that\s*/gi, ''],
  [/\bat the end of the day\s*,?\s*/gi, ''],
  [/\bin conclusion\s*,?\s*/gi, ''],
  [/\bunlock(?:ing)? the (?:power|secrets?|potential) of\b/gi, 'use'],
  [/\b(?:a )?rich tapestry of\b/gi, 'a mix of'],
  [/\bnavigat(?:e|ing) the (?:complex )?(?:landscape|world|maze) of\b/gi, 'handle'],
  [/\bbuckle up\s*,?\s*/gi, ''],
  [/\bwithout further ado\s*,?\s*/gi, ''],
  [/\bthe (?:the )?(?:real )?(?:key|secret) (?:takeaway )?is\b/gi, 'the point is'],
  [/\bnot just (?:a|an) \w+,? but (?:a|an) \w+\b/gi, 'more than that'],
  [/\b(?:imagine|picture) this\s*[:,.]?\s*/gi, ''],
  [/\bhere'?s the (?:thing|kicker|catch|deal)\s*[:,.]?\s*/gi, ''],
  [/\blet'?s face it\s*,?\s*/gi, ''],
  [/\bthe truth is\s*,?\s*/gi, ''],
  [/\byou(?: might|'?ll| may) be wondering\b[^.?!]*[.?!]\s*/gi, ''],
  [/\bit turns out (?:that )?/gi, ''],
  [/\bwhen it comes to\b/gi, 'with'],
  [/\bat its core\s*,?\s*/gi, ''],
  [/\ba testament to\b/gi, 'proof of'],
  [/\blook no further\b[^.?!]*[.?!]\s*/gi, ''],
  [/\b(?:take|taking) (?:your \w+ )?to the next level\b/gi, 'improve'],
  [/\bstay tuned\b[^.?!]*[.?!]?\s*/gi, ''],
  [/\blet that sink in\b[.!]?\s*/gi, ''],
  [/\bwhether you'?re (?:a |an )?\w+ or (?:a |an )?\w+\s*,?\s*/gi, ''],
  [/\bin the (?:realm|world) of\b/gi, 'in'],
  [/\bthe (?:power|magic) of\b/gi, 'the effect of'],
  [/\b(?:crucial|vital|essential) (?:to|that) (?:understand|know|remember)\b/gi, 'worth knowing'],
  [/\bsimply put\s*,?\s*/gi, ''],
  [/\bneedless to say\s*,?\s*/gi, ''],
  [/\bfirst and foremost\s*,?\s*/gi, ''],
];

const ALL_SLOP = [...SLOP, ...HU_SLOP];
export const slopHits = (t: string): string[] => ALL_SLOP.flatMap(([re]) => (t.match(new RegExp(re.source, re.flags)) ?? []).map(m => m.trim().toLowerCase()));
const digits = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).join('|');
const upFirst = (t: string) => t.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase());

/** Deterministic scrub of stock phrases in one narration; digits are verified unchanged or the original is returned. */
export function scrubSlop(t: string): string {
  let out = t;
  for (const [re, rep] of ALL_SLOP) out = out.replace(re, rep);
  out = upFirst(out.replace(/\s{2,}/g, ' ')).trim();
  return out && digits(out) === digits(t) ? out : t;
}

const TENSION = /\b(but|however|yet|trap|mistake|problem|risk|costly|cost|hurts?|worse|catch|surprise|myth|wrong|actually)\b/i;
const NUMBERISH = /\d|\b(percent|dollars?|thousand|million|billion|hundred|double|twice|half)\b/i;
const PAYOFF = /\b(so|remember|takeaway|bottom line|next time|keep|start|try|check|that'?s)\b/i;

const hasPayoff = (sc: Sc) => PAYOFF.test(sc.narration) || HU_PAYOFF.test(sc.narration) || sc.type === 'list';

/** Deterministic payoff: when the last scene lands no takeaway, append one neutral closing sentence (no advice wording, no numbers). */
export function ensurePayoff(ep: Episode, lang?: string): Episode {
  const last = ep.scenes.at(-1);
  if (!last || ep.scenes.length < 4 || hasPayoff(last)) return ep;
  const scenes = [...ep.scenes];
  scenes[scenes.length - 1] = {...last, narration: `${last.narration.trim().replace(/[.!?]?$/, '.')} ${isHu(lang) ? CLOSERS.hu : CLOSERS.en}`} as Sc;
  return {...ep, scenes: scenes as Episode['scenes']};
}

/** Advisory arc check: Hook -> Tension -> Evidence -> Payoff. Returns human-readable gaps (empty = fine). */
export function arcGaps(ep: Episode): string[] {
  const s = ep.scenes, gaps: string[] = [];
  if (s.length < 4) return ['Too few scenes for a hook, tension, evidence and payoff arc.'];
  if (s[0].narration.trim().split(/\s+/).length > 15) gaps.push('Hook is longer than 15 words.');
  const mid = s.slice(1, -1);
  if (!mid.some(x => (TENSION.test(x.narration) || HU_TENSION.test(x.narration)) || ['worried', 'shocked', 'angry', 'sad', 'confused', 'sweating'].includes(x.emotion))) gaps.push('No tension scene (a problem, myth or "but").');
  if (!mid.some(x => x.type === 'big_number' || x.type === 'chart' || x.type === 'compare' || (NUMBERISH.test(x.narration) || HU_NUMBERISH.test(x.narration)))) gaps.push('No evidence scene (a number, chart or comparison).');
  if (!hasPayoff(s.at(-1)!) ) gaps.push('The last scene does not land a takeaway.');
  return gaps;
}

const FILLER = /^\s*(so|well|now|basically|actually|okay|ok|alright|right)\b[,.]?\s/i;
/** Variety, rhythm and specificity gaps of a whole script (advisory text for the drafter retry and the critic notes). */
export function styleGaps(ep: Episode): string[] {
  const g: string[] = [], n = ep.scenes.length, v = varietyStats(ep);
  if (n >= 10 && v.talkShare > 0.55) g.push(`${Math.round(v.talkShare * 100)}% of the scenes are plain talk; turn some into big_number, compare, before_after, list, checklist, table, stats, timeline or chart.`);
  if (n >= 10 && v.kinds < 4) g.push(`Only ${v.kinds} scene types used; use at least 4 different types.`);
  if (v.maxRun >= 3 && ep.scenes.some((s, i) => i > 1 && s.type !== 'talk' && s.type === ep.scenes[i - 1].type && s.type === ep.scenes[i - 2].type)) g.push('The same non-talk scene type appears three times in a row.');
  const lens = ep.scenes.flatMap(s => (s.narration.match(/[^.!?]+[.!?]*/g) ?? []).map(x => x.trim().split(/\s+/).length));
  if (lens.length >= 12) { const m = lens.reduce((a, b) => a + b, 0) / lens.length, sd = Math.sqrt(lens.reduce((a, b) => a + (b - m) ** 2, 0) / lens.length); if (sd < 3) g.push('Sentence lengths are all alike; mix very short sentences (2-5 words) with longer ones.'); }
  const filler = ep.scenes.filter((s, i) => i > 0 && FILLER.test(s.narration)).length;
  if (filler >= 3) g.push(`${filler} scenes open with filler ("so", "well", "now"); start with the fact.`);
  const concrete = ep.scenes.filter(s => /\d|\b(dollars?|percent|years?|months?|thousand|million)\b/i.test(s.narration)).length;
  if (n >= 10 && concrete < Math.ceil(n / 4)) g.push('Too few concrete numbers or worked examples; give real amounts, rates or durations.');
  return g;
}

/** Slop and arc problems as lint-style messages (advisory, never blocks). */
export function criticNotes(ep: Episode): string[] {
  const n = ep.scenes.flatMap((s, i) => slopHits(s.narration).map(h => `Scene ${i + 1}: stock phrase "${h}".`));
  return [...n, ...arcGaps(ep), ...styleGaps(ep)];
}

/** Deterministic scrub over the whole episode. */
export const scrubEpisode = (ep: Episode): Episode => ({...ep, scenes: ep.scenes.map(s => ({...s, narration: scrubSlop(s.narration)})) as Episode['scenes']});

/**
 * Optional one-call-per-scene LLM rewrite for scenes that still sound generic (stock phrase left after the scrub).
 * Accepted only when every digit sequence is identical and no slop remains; otherwise the scene is kept.
 */
export async function criticPass(client: Client, ep: Episode, o: {model?: string; log?: (m: string) => void} = {}): Promise<Episode> {
  const scenes = [...ep.scenes];
  for (const [i, s] of scenes.entries()) {
    if (i === 0 || !slopHits(s.narration).length) continue;
    try {
      const res = await client.messages.create({model: o.model ?? 'claude-sonnet-5-5', max_tokens: 300,
        system: 'You remove generic AI-sounding phrasing from one line of a video script. Output ONLY JSON: {"narration": string}. Same facts, same numbers, same length, plain concrete spoken words. Never add or change a number. Keep the language of the line.',
        messages: [{role: 'user', content: `Line: ${s.narration}`}]});
      const cand = String((extractJson(res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')) as {narration?: unknown}).narration ?? '').trim();
      if (cand && digits(cand) === digits(s.narration) && !slopHits(cand).length) scenes[i] = {...s, narration: cand} as Sc;
      else o.log?.(`critic: kept scene ${i + 1}`);
    } catch { /* keep */ }
  }
  return {...ep, scenes: scenes as Episode['scenes']};
}
