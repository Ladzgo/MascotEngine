// Script score (0-100): a deterministic rubric over the written narration, plus a rewrite pass for the weakest beats.
import {extractJson, type Client} from '../llm/llm.js';
import type {Episode} from '../schema.js';
import {slopHits} from './critic.js';
import {isHu} from './lang.js';
import {spokenNumbers} from './lint.js';
import {hookHeuristic} from './story.js';

export const SCORE_REWRITE_BELOW = 75, SCORE_FAIL_BELOW = 60;
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
const FILLER = /^(so|well|basically|actually|now|okay|ok|alright|anyway|honestly|essentially)\b[, ]/i;
const CONTRACTION = /\b\w+'(?:s|re|ve|ll|d|t|m)\b/i;
const STOP = new Set(['that', 'this', 'with', 'your', 'from', 'they', 'have', 'what', 'when', 'will', 'about', 'than', 'then', 'into', 'were', 'been', 'does', 'more', 'most', 'every']);
const kw = (t: string) => [...new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w)))];

export type ScoreItem = {name: string; got: number; max: number; note: string};
export type ScriptScore = {total: number; items: ScoreItem[]; weak: {beat: number; why: string}[]; pass: boolean};

export function scoreScript(ep: Pick<Episode, 'scenes'>): ScriptScore {
  const sc = ep.scenes, narr = sc.map(s => s.narration), hu = isHu(/[áéíóöőúüű]/i.test(narr.join(' ')) ? 'hu' : 'en'), n = Math.max(1, narr.length);
  const items: ScoreItem[] = [], weak: {beat: number; why: string}[] = [];
  const add = (name: string, got: number, max: number, note: string) => items.push({name, got: Math.round(Math.max(0, Math.min(max, got)) * 10) / 10, max, note});
  const hook = narr[0] ?? '';
  add('hook', hookHeuristic(hook) * 2, 20, `${wc(hook)} words; ${hookHeuristic(hook)}/10 on length, number, plain opener, person/stake`);
  const withNum = narr.filter(t => spokenNumbers(t).length || /\d/.test(t)).length, named = narr.filter(t => /(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/.test(t)).length;
  add('concrete', Math.min(1, withNum / (n * 0.45)) * 14 + Math.min(1, named / Math.max(1, n * 0.15)) * 6, 20, `${withNum}/${n} beats carry a number, ${named} a name`);
  const you = narr.filter(t => /\b(you|your|you're|you'll)\b|\b(te|neked|tied|téged|ön)\b/i.test(t)).length, contr = narr.filter(t => CONTRACTION.test(t)).length;
  add('voice', hu ? 15 : Math.min(1, you / (n * 0.3)) * 8 + Math.min(1, contr / (n * 0.35)) * 7, 15, hu ? 'Hungarian: contractions not scored' : `${you}/${n} address the viewer, ${contr}/${n} use contractions`);
  const lens = narr.flatMap(t => sentences(t).map(wc)), mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length), sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length));
  const short = lens.filter(l => l <= 5).length, long = lens.filter(l => l >= 14).length;
  add('rhythm', Math.min(1, sd / 4.5) * 9 + (short >= 2 ? 3 : short ? 1.5 : 0) + (long >= 2 ? 3 : long ? 1.5 : 0), 15, `sentence length sd ${sd.toFixed(1)}, ${short} short, ${long} long`);
  let slop = 0, filler = 0;
  narr.forEach((t, i) => { const h = slopHits(t); if (h.length) { slop += h.length; weak.push({beat: i, why: `stock phrase: ${h[0]}`}); } if (FILLER.test(t.trim())) { filler++; weak.push({beat: i, why: 'filler opener'}); } });
  add('clean', 10 - slop * 3 - filler * 2, 10, `${slop} stock phrases, ${filler} filler openers`);
  const key = kw(hook), tail = narr.slice(-2).join(' ').toLowerCase(), called = key.some(w => tail.includes(w));
  add('payoff', (called ? 6 : 0) + (/(takeaway|so |next time|remember|check|tanuls|lényeg|ellenőrizd|legközelebb)/i.test(tail) ? 4 : 0), 10, called ? 'the ending echoes the hook' : 'the ending does not echo the hook');
  const firsts = narr.map(t => t.split(/\s+/)[0]?.toLowerCase()), repeats = firsts.filter((f, i) => i > 0 && f === firsts[i - 1]).length, types = new Set(sc.map(s => s.type)).size;
  add('variety', 10 - repeats * 2 - (types < 4 ? 3 : 0), 10, `${repeats} beats start like the one before, ${types} scene types`);
  narr.forEach((t, i) => { if (i > 0 && wc(t) >= 8 && !/\d/.test(t) && !/\b(you|your)\b/i.test(t) && !hu && !CONTRACTION.test(t) && !weak.some(w => w.beat === i)) weak.push({beat: i, why: 'flat: no number, no "you", no contraction'}); });
  const total = Math.round(items.reduce((a, b) => a + b.got, 0));
  return {total, items, weak, pass: total >= SCORE_FAIL_BELOW};
}

/** Ask the model to rewrite the weakest beats (stock phrases, filler, flat lines). Numbers must stay identical; the result is kept only when the score improves. */
export async function rewriteWeak(client: Client, ep: Episode, o: {model?: string; lang?: string; log?: (m: string) => void}): Promise<Episode> {
  const before = scoreScript(ep);
  const targets = before.weak.filter(w => w.beat > 0 && w.beat < ep.scenes.length - 1 && ep.scenes[w.beat].type === 'talk').slice(0, 6);
  if (!targets.length) return ep;
  const list = targets.map(w => `${w.beat}: (${w.why}) ${ep.scenes[w.beat].narration}`).join('\n');
  try {
    const r = await client.messages.create({model: o.model ?? 'claude-sonnet-5-5', max_tokens: 1500, system: `You punch up lines of a spoken explainer script.${isHu(o.lang) ? ' Write in natural spoken Hungarian.' : ''} Rewrite each line: conversational, direct "you", contractions, concrete, no stock phrases, no filler opener. Keep every number and every fact exactly, keep the length within 30 percent. Output ONLY JSON: {"rewrites": [{"i": number, "narration": string}]}`, messages: [{role: 'user', content: list}]});
    const j = extractJson(r.content.filter(c => c.type === 'text').map(c => (c as {text?: string}).text ?? '').join('')) as {rewrites?: {i: number; narration: string}[]};
    const scenes = ep.scenes.map(s => ({...s}));
    for (const w of j.rewrites ?? []) {
      const s = scenes[w.i]; if (!s || !targets.some(t => t.beat === w.i) || typeof w.narration !== 'string') continue;
      const a = spokenNumbers(s.narration).sort().join(), b = spokenNumbers(w.narration).sort().join(), r = wc(w.narration) / wc(s.narration);
      if (a === b && r > 0.6 && r < 1.4) s.narration = w.narration.trim();
    }
    const next = {...ep, scenes: scenes as Episode['scenes']}, after = scoreScript(next);
    o.log?.(`script score ${before.total} -> ${after.total} after rewriting weak beats`);
    return after.total >= before.total ? next : ep;
  } catch (e) { o.log?.(`rewrite pass skipped (${(e as Error).message.slice(0, 80)})`); return ep; }
}
