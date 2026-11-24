import type {Episode} from '../schema.js';
import {scrubSlop} from './critic.js';

const BANNED = [
  /guarantee/i, /risk[- ]free/i, /can'?t lose/i, /get rich quick/i, /you should (buy|sell|invest)/i,
  /financial advice/i, /sure thing/i, /will (double|triple) your/i, /act now/i,
];
// Allow "get rich quick" only when mocked in a title scene is not worth the nuance: keep it strict.

export function lintEpisode(ep: Episode): string[] {
  const errs: string[] = [];
  const hook = ep.scenes[0]?.narration ?? '';
  const words = hook.trim().split(/\s+/).length;
  if (words > 15) errs.push(`Hook (scene 1 narration) has ${words} words; must be 15 or fewer.`);
  const hasNumbers = ep.scenes.some(s => s.type === 'big_number' || s.type === 'chart');
  if (hasNumbers && ep.sources.length === 0) errs.push('big_number/chart scenes need at least one URL in "sources".');
  ep.scenes.forEach((s, i) => {
    for (const re of BANNED) {
      if (re.test(s.narration)) errs.push(`Scene ${i + 1} uses banned advice/guarantee wording (${re}).`);
    }
  });
  if (!ep.disclaimer) errs.push('"disclaimer" must be true for finance content.');
  return errs;
}

/** Deterministic fixes for what small models get wrong: drop banned sentences, force the disclaimer, shorten a long hook. Never rewrites numbers. */
export function autoFixEpisode(ep: Episode): Episode {
  const scenes = ep.scenes.map((s, i) => {
    let n = scrubSlop(s.narration);
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
  return {...ep, scenes, disclaimer: true};
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
export function repeatedPhrases(narrations: string[]): string[] {
  const seen = new Map<string, Set<number>>();
  narrations.forEach((n, i) => {
    const w = words(n);
    for (let k = 0; k + 3 <= w.length; k++) {
      const g = w.slice(k, k + 3);
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
