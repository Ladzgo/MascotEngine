import {spoken} from '../pipeline/speech.js';
import type {Episode} from '../schema.js';
import {scrubSlop} from './critic.js';
import {HU_BANNED, huWordValue} from './lang.js';

const BANNED = [
  ...HU_BANNED,
  /guarantee/i, /risk[- ]free/i, /can'?t lose/i, /get rich quick/i, /you should (buy|sell|invest)/i,
  /financial advice/i, /sure thing/i, /will (double|triple) your/i, /act now/i,
];
// Allow "get rich quick" only when mocked in a title scene is not worth the nuance: keep it strict.

/** Words as the voice says them: "$1,825" is six words, not one. */
export const spokenWords = (t: string) => spoken(t).split(/\s+/).filter(Boolean).length;

export function lintEpisode(ep: Episode): string[] {
  const errs: string[] = [];
  const hook = ep.scenes[0]?.narration ?? '';
  const words = hook.trim().split(/\s+/).length;
  if (words > 15) errs.push(`Hook (scene 1 narration) has ${words} words; must be 15 or fewer.`);
  // numerals are spoken out ("$10k" = ten thousand dollars): a hook that takes over ~4.3 s to say makes the first beat the longest one
  const spokenN = spokenWords(hook);
  if (spokenN > 13) errs.push(`Hook takes about ${(spokenN * 60 / 165).toFixed(1)} s to say once numbers are spelled out; keep it under 4.3 s (about 12 spoken words).`);
  // Shorts: every beat stays under ~5 s on screen; data scenes are never split later, so their narration must already be short
  // Shorts beats over ~5 s are no lint error any more: as an error it threw away whole outline drafts (the one-shot fallback then came out 16:9, ep014); the CLI's tightenLong + splitBeats shorten them
  const hasNumbers = ep.scenes.some(s => s.type === 'big_number' || s.type === 'chart');
  if (hasNumbers && ep.sources.length === 0) errs.push('big_number/chart scenes need at least one URL in "sources".');
  ep.scenes.forEach((s, i) => {
    for (const re of BANNED) {
      if (re.test(s.narration)) errs.push(`Scene ${i + 1} uses banned advice/guarantee wording (${re}).`);
    }
  });
  if (talkRuns(ep.scenes).length) errs.push('7 or more short talk scenes in a row; merge or vary them.');
  if (closingContradiction(ep.scenes.at(-1)?.narration ?? '')) errs.push('The closing scene contradicts the video (reversal wording).');
  if (similes(ep.scenes.map(s => s.narration)) > MAX_SIMILES) errs.push(`More than ${MAX_SIMILES} "like a X" similes; keep the best ones.`);
  if (!ep.disclaimer) errs.push('"disclaimer" must be true for finance content.');
  return errs;
}

/** Deterministic fixes for what small models get wrong: drop banned sentences, force the disclaimer, shorten a long hook. Never rewrites numbers. */
const NUM_W: Record<string, number> = {zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const SCALE_W: Record<string, number> = {hundred: 100, thousand: 1000, million: 1e6, billion: 1e9};
const NUM_RUN = new RegExp(`\\b(?:a\\s+(?=(?:hundred|thousand|million|billion)\\b))?(?:(?:${[...Object.keys(NUM_W), ...Object.keys(SCALE_W)].join('|')})(?:[\\s-]+(?:and[\\s-]+)?(?=(?:${[...Object.keys(NUM_W), ...Object.keys(SCALE_W)].join('|')})\\b))?)+\\b(\\s+(?:dollars?|bucks|percent)\\b)?`, 'gi');
/** English number words as numerals ("eighteen hundred dollars" = "$1,800") so captions, labels and grounding see digits; TTS spells them out again. Small bare counts ("ten years") stay words. */
export function numeralize(text: string): string {
  // "two point five million" -> "2.5 million" first; the run matcher below would read only "five million" and leave "two point 5,000,000"
  text = text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+point\s+(zero|one|two|three|four|five|six|seven|eight|nine)\b(\s+(?:million|billion|thousand))?/gi, (_m, a: string, b: string, sc?: string) => `${NUM_W[a.toLowerCase()]}.${NUM_W[b.toLowerCase()]}${sc ? `_${sc.trim()}` : ''}`); // '_' (a word char) hides the scale word from the run matcher's \b; restored below
  return text.replace(NUM_RUN, (m: string, unit?: string) => {
    const words = m.slice(0, unit ? m.length - unit.length : m.length).toLowerCase().split(/[\s-]+/).filter(w => w !== 'and');
    // "one two three" is a list, not a number: a word-number may only follow a tens word ("twenty five") or a scale
    for (let k = 1; k < words.length; k++) if (words[k] in NUM_W && words[k - 1] in NUM_W && !(NUM_W[words[k - 1]] >= 20 && NUM_W[words[k - 1]] % 10 === 0 && NUM_W[words[k]] < 10)) return m;
    let total = 0, cur = 0;
    for (const w of words) {
      if (w === 'a') cur = 1;
      else if (w in NUM_W) cur += NUM_W[w];
      else if (w === 'hundred') cur = (cur || 1) * 100;
      else { total += (cur || 1) * SCALE_W[w]; cur = 0; }
    }
    const n = total + cur, u = unit?.trim().toLowerCase();
    if (!u && n < 100) return m;
    const f = n.toLocaleString('en-US');
    return u === 'percent' ? `${f}%` : u ? `$${f}` : f;
  }).replace(/(\d\.\d)_(million|billion|thousand)\b/gi, '$1 $2');
}

export function autoFixEpisode(ep: Episode): Episode {
  const scenes = ep.scenes.map((s, i) => {
    let n = numeralize(scrubSlop(s.narration));
    if (BANNED.some(re => re.test(n))) {
      const kept = (n.match(/[^.!?]+[.!?]*/g) ?? [n]).filter(x => !BANNED.some(re => re.test(x)));
      n = kept.join('').trim() || 'Here is what the numbers actually say.';
    }
    if (i === 0 && n.trim().split(/\s+/).length > 15) {
      const first = (n.match(/[^.!?]+[.!?]*/) ?? [n])[0].trim();
      n = first.split(/\s+/).length <= 15 ? first : n.trim().split(/\s+/).slice(0, 15).join(' ').replace(/[,;:]$/, '') + '.';
    }
    return {...s, narration: n};
  }) as Episode['scenes'];
  return fixClosing(mergeTalkRuns(groundCharts(groundNumbers(limitSimiles(fixClosing({...ep, scenes, disclaimer: true})))))); // merge last: grounding demotes big_number/chart scenes to talk and can build a new run of 7 (killed zzb-long2); closing fixed again because a merge can pull a "But..." sentence into it (zzb-s1)
}

const SHORT_TALK = 30, RUN = 7; // beat-split scripts have many short talk scenes (each with its own illustration), so only a run of 7 is a problem
const isShortTalk = (s: Episode['scenes'][number]) => s.type === 'talk' && s.narration.trim().split(/\s+/).length < SHORT_TALK;
/** Start indexes of runs of 4+ consecutive short talk scenes (the hook, scene 1, is never part of a run). */
export function talkRuns(scenes: Episode['scenes']): number[] {
  const out: number[] = []; let run = 0;
  scenes.forEach((s, i) => { run = i > 0 && isShortTalk(s) ? run + 1 : 0; if (run === RUN) out.push(i - RUN + 1); });
  return out;
}
/** Merge neighbouring short talk scenes (text joined, never rewritten) until no run of 4 remains. */
export function mergeTalkRuns(ep: Episode): Episode {
  const scenes = [...ep.scenes];
  for (let at = talkRuns(scenes)[0]; at !== undefined; at = talkRuns(scenes)[0]) {
    const [a, b] = [scenes[at + 1], scenes[at + 2]]; // merge the middle pair so the run shrinks
    scenes.splice(at + 1, 2, {...a, narration: `${a.narration.trim()} ${b.narration.trim()}`, emphasis: [...((a as any).emphasis ?? []), ...((b as any).emphasis ?? [])]} as Episode['scenes'][number]);
  }
  return {...ep, scenes: scenes as Episode['scenes']};
}

const REVERSAL = /^\s*(but|however|actually|then again|on the other hand)\b|\b(just kidding|never ?mind|scratch that|forget (all of )?(that|what i said)|on second thought)\b/i;
export const closingContradiction = (n: string) => (n.match(/[^.!?]+[.!?]*/g) ?? [n]).some(x => REVERSAL.test(x));
/** Drop reversal sentences from the closing scene; if nothing is left the scene is kept untouched. */
export function fixClosing(ep: Episode): Episode {
  const last = ep.scenes.at(-1);
  if (!last || !closingContradiction(last.narration)) return ep;
  const kept = (last.narration.match(/[^.!?]+[.!?]*/g) ?? []).filter(x => !REVERSAL.test(x)).join('').trim();
  // every sentence is a reversal ("But it pays off."): drop the turn word instead of failing the whole draft
  const unturned = kept || last.narration.replace(/^\s*(but|however|actually|then again|on the other hand),?\s*/i, '').replace(/^./, c => c.toUpperCase()).trim();
  return unturned && !closingContradiction(unturned) ? {...ep, scenes: [...ep.scenes.slice(0, -1), {...last, narration: unturned}] as Episode['scenes']} : ep;
}

export const MAX_SIMILES = 2;
const SIMILE = /\b(?:like|as) (?:a|an|the) [a-z-]+/gi;
export const similes = (ns: string[]) => ns.reduce((n, t) => n + (t.match(SIMILE)?.length ?? 0), 0);
/** Keep the first MAX_SIMILES similes; later sentences that carry one are dropped (unless that would empty the scene). */
export function limitSimiles(ep: Episode): Episode {
  let seen = 0;
  const scenes = ep.scenes.map(s => {
    const sents = s.narration.match(/[^.!?]+[.!?]*/g) ?? [s.narration];
    const kept = sents.filter(x => { const c = x.match(SIMILE)?.length ?? 0; if (!c) return true; if (seen < MAX_SIMILES) { seen += c; return true; } return false; });
    return kept.length && kept.length < sents.length ? {...s, narration: kept.join('').trim()} : s;
  });
  return {...ep, scenes: scenes as Episode['scenes']};
}

/** A chart must rest on a vetted source and on at least one value the narration says out loud; otherwise (invented data) it becomes a talk scene. */
export function groundCharts(ep: Episode): Episode {
  const vetted = ep.sources.some(isVettedSource);
  const scenes = ep.scenes.map(s => {
    if (s.type !== 'chart') return s;
    const heard = spokenNumbers(s.narration);
    const ok = vetted && s.chart.values.some(v => heard.some(n => Math.abs(n - v) <= 1e-9 * Math.max(1, Math.abs(v))));
    return ok ? s : {type: 'talk' as const, narration: s.narration, emotion: s.emotion, emphasis: s.emphasis};
  });
  return {...ep, scenes: scenes as Episode['scenes']};
}

/** Hosts we trust for finance numbers: governments, central banks, statistics offices, international bodies, universities, major wires. */
const VETTED = [/\.gov$/, /\.gov\.[a-z]{2}$/, /\.edu$/, /\.ac\.uk$/, /(^|\.)(europa\.eu|worldbank\.org|imf\.org|oecd\.org|bis\.org|nber\.org|stlouisfed\.org|federalreserve\.gov|reuters\.com|apnews\.com|bloomberg\.com|ft\.com|wsj\.com|nytimes\.com|economist\.com|morningstar\.com|vanguard\.com|statista\.com|ourworldindata\.org|pewresearch\.org|brookings\.edu|investopedia\.com)$/];
export const isVettedSource = (u: string): boolean => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return VETTED.some(re => re.test(h)); } catch { return false; } };

/** Split sources into vetted and unvetted, and say which scenes show a number with no vetted source behind them. */
export function sourceFlags(ep: Episode): {vetted: string[]; dropped: string[]; notes: Record<number, string[]>} {
  const vetted = ep.sources.filter(isVettedSource), dropped = ep.sources.filter(u => !isVettedSource(u));
  const notes: Record<number, string[]> = {};
  if (!vetted.length) ep.scenes.forEach((s, i) => { if (s.type === 'big_number' || s.type === 'chart' || /\d/.test(s.narration)) (notes[i] ??= []).push('Verify this number: no vetted source (gov, central bank, stats office, major wire) is listed.'); });
  if (dropped.length) (notes[0] ??= []).push(`Removed unvetted sources: ${dropped.join(', ')}`);
  return {vetted, dropped, notes};
}

const STOP = new Set('a an the of to in on at for and or but is are was were be it its this that with as by from you your they them their we our not no so if than then there here have has had do does did will would can could just about into over out up'.split(' '));
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);

/** Repeated 3-word phrases (with at least 2 content words) and repeated "like a X" similes across different scenes. Advisory: never blocks a draft. */
export function repeatedPhrases(narrations: string[], size = 3): string[] {
  const seen = new Map<string, Set<number>>();
  narrations.forEach((n, i) => {
    const w = words(n);
    for (let k = 0; k + size <= w.length; k++) {
      const g = w.slice(k, k + size);
      if (g.filter(x => !STOP.has(x)).length < 2) continue;
      const key = g.join(' ');
      (seen.get(key) ?? seen.set(key, new Set()).get(key)!).add(i);
    }
    for (const m of n.toLowerCase().matchAll(/\b(?:like|as) (?:a|an|the) ([a-z-]+)/g)) {
      const key = `like a ${m[1]}`;
      (seen.get(key) ?? seen.set(key, new Set()).get(key)!).add(i);
    }
  });
  return [...seen].filter(([, v]) => v.size > 1).map(([k]) => k);
}

const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS: Record<string, number> = {twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const SCALE: Record<string, number> = {thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12};
const lookup = (w: string): number | undefined => (ONES.indexOf(w) >= 0 ? ONES.indexOf(w) : TENS[w]);

/** Every number a listener would hear in a narration: digits ("86,542", "2.5 million") and spelled-out ("one percent", "five hundred thousand"). */
export function spokenNumbers(text: string): number[] {
  const out: number[] = [];
  const t = text.toLowerCase().replace(/(\d)[ \u00a0](?=\d{3}(?!\d))/g, '$1').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/(\d),(?=\d{1,2}(?!\d))/g, '$1.').replace(/[$%€£]/g, ' ');
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|k|ezer|millió|milliárd)(?![\p{L}]))?/gu)) out.push(Number(m[1]) * (m[2] ? (m[2] === 'k' ? 1e3 : SCALE[m[2]] ?? ({ezer: 1e3, millió: 1e6, milliárd: 1e9} as Record<string, number>)[m[2]]) : 1));
  let prev: number | null = null;
  for (const w of t.split(/[^\p{L}]+/u)) {
    const v = w.length > 1 ? huWordValue(w) : null;
    if (v !== null && prev !== null && ['ezer', 'millió', 'milliárd'].includes(w) && prev < 1000) { out.pop(); out.push(prev * v); prev = null; continue; } // "két millió"
    if (v !== null) out.push(v); // widens grounding only (an English 'hat' counts as 6, harmless)
    prev = v;
  }
  const toks = t.replace(/(?<=[a-z])-(?=[a-z])/g, ' ').replace(/[^a-z\s]+/g, ' | ').split(/\s+/).filter(Boolean); // '|' = punctuation or digits break a number phrase
  let total = 0, cur = 0, any = false;
  const flush = () => { if (any) out.push(total + cur); total = 0; cur = 0; any = false; };
  for (const w of toks) {
    const v = lookup(w);
    if (v !== undefined) { cur += v; any = true; }
    else if (w === 'hundred' && any) cur = (cur || 1) * 100;
    else if (SCALE[w] && any) { total += (cur || 1) * SCALE[w]; cur = 0; }
    else if (w !== 'and' || !any) flush();
  }
  flush();
  return out;
}

/** A big_number scene must show the number the narration actually says; an invented one (small models do this) is turned into a plain talk scene. */
export function groundNumbers(ep: Episode): Episode {
  const scenes = ep.scenes.map(s => {
    if (s.type === 'stats') {
      const said = spokenNumbers(s.narration);
      return s.stats.every(x => said.some(n => Math.abs(n - x.value) <= 1e-9 * Math.max(1, Math.abs(x.value)))) ? s : {type: 'talk' as const, narration: s.narration, emotion: s.emotion, emphasis: s.emphasis};
    }
    if (s.type !== 'big_number') return s;
    const heard = spokenNumbers(s.narration);
    const ok = heard.some(n => Math.abs(n - s.value) <= 1e-9 * Math.max(1, Math.abs(s.value)));
    return ok ? s : {type: 'talk' as const, narration: s.narration, emotion: s.emotion, emphasis: s.emphasis};
  }) as Episode['scenes'];
  return {...ep, scenes};
}
