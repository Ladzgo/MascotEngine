import type {Episode} from '../schema.js';

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
    let n = s.narration;
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
