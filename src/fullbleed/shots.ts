import {FB_FOR, OBJECTS} from './objects';

export type Shot = {kind: string; at: number; why?: string}; // seconds from scene start
type W = {w: string; start: number; end: number};
const MIN_GAP = 1.5, MAX_SHOTS = 4;

/** Narration word -> candidate objects, most specific first. A word can point at several (money -> coins, cash, wallet): the planner takes the first one not just shown. */
const RULES: [string, RegExp][] = [
  ['debt_counter', /^(debts?|owe[sd]?|owing|loans?|borrow\w*)$/], ['card_swipe', /^(credit|cards?|swipe[sd]?)$/], ['gauge', /^(rates?|apr|interest|yield)$/], ['snowball', /^(compound\w*|snowball\w*|grow\w*|accumulat\w*)$/],
  ['jar_fill', /^(savings?|saved?|saving|savers?|jar)$/], ['price_up', /^(prices?|inflation|costs?|fees?|expensive|pricey)$/], ['bars_arrow', /^(invest\w*|stocks?|markets?|returns?|index|portfolio|profits?|growth)$/], ['pie', /^(share|split|portion|most|half|majority)$/],
  ['card', /^(credit|cards?|swipe[sd]?|apr|balances?)$/], ['receipts', /^(minimum\w*|bills?|receipts?|statements?|invoices?|owe[sd]?|debts?|expenses?|payments?)$/],
  ['calendar', /^(months?|monthly|weeks?|dates?|schedule[sd]?|due|calendar|annual\w*)$/], ['clock', /^(clock|hours?|minutes?|decades?)$/],
  ['percent', /^(percent|%|rates?|interest|yield|fees?|tax\w*)$/], ['coin_stacks', /^(coins?|savings?|saved?|compound\w*|wealth|money|dollars?|thousands?|millions?)$/],
  ['cash', /^(cash|paychecks?|income|salary|earn\w*|money|dollars?|bucks)$/], ['wallet', /^(wallets?|afford\w*|spend\w*|spent|budget\w*|pocket)$/], ['piggy', /^(piggy|nest|save|savers?)$/],
  ['house', /^(house|houses|home|homes|mortgages?|rent\w*|propert\w+|housing)$/], ['car', /^(cars?|autos?|vehicles?|driv\w+|leas\w+|dealer\w*)$/], ['bank', /^(banks?|lenders?|lending|loans?|borrow\w*|deposits?)$/],
  ['vault', /^(vault|secure\w*|emergency|funds?)$/], ['lock', /^(lock\w*|stuck|trap\w*|fixed|commit\w*)$/], ['shield', /^(protect\w*|insur\w*|safe\w*|guard\w*)$/],
  ['bars3d', /^(invest\w*|stocks?|markets?|returns?|index|portfolio|profits?|charts?|growth)$/], ['arrow_up', /^(ris\w+|increas\w+|grow\w*|gains?|climb\w*|soar\w*|doubl\w*|higher|more)$/],
  ['arrow_down', /^(fall\w*|drops?|dropp\w*|los\w+|decreas\w*|declin\w*|crash\w*|inflation|less|shrink\w*|lower|erod\w*)$/], ['scale', /^(compar\w*|versus|vs|better|worse|weigh\w*|choice|choose|fair|trade\w*)$/],
  ['people', /^(people|persons?|famil\w+|friends?|customers?|investors?|folks|households?|americans?|workers?|borrowers?)$/], ['phone', /^(apps?|phones?|online|digital|mobile|notif\w+|automat\w+|text)$/],
  ['cart', /^(shop\w*|buy\w*|bought|purchas\w+|stores?|retail\w*|cart)$/], ['pricetag', /^(prices?|priced|costs?|sticker|discounts?|sales?|cheap\w*|expensive|pricey)$/],
  ['bulb', /^(ideas?|tips?|tricks?)$/], ['handshake', /^(deals?|handshake|negotiat\w+|partner\w*)$/],
  ['gradcap', /^(school|college|students?|degrees?|educat\w+|tuition|university)$/], ['gears', /^(process|machine|engine|mechanism|gears?)$/], ['pin', /^(where|locat\w+|local|cit(y|ies)|nearby|map)$/],
  ['magnifier', /^(print|inspect\w*|magnif\w*|hidden)$/], ['doc', /^(documents?|polic(y|ies)|paperwork|agreements?|forms?)$/],
  ['skyline', /^(econom\w+|business\w*|compan(y|ies)|corporat\w+|recession|industry)$/],
];
const POOL = ['coin_stacks', 'bars_arrow', 'skyline', 'cash', 'pie', 'receipts', 'wallet', 'calendar']; // neutral, on-topic fillers only (no people/clock/bulb unless the text is about them)
const GENERIC = new Set(['people', 'clock', 'bulb', 'gears', 'pin', 'handshake', 'magnifier', 'scale', 'shield', 'lock']);
const DET = new Set(['the', 'a', 'an', 'your', 'their', 'this', 'that', 'its', 'every', 'each', 'any', 'of', 'on', 'in', 'at', 'for', 'with']);
const DEBT = /\b(debts?|owe[sd]?|owing|loans?|borrow\w*)\b/i; // red 'you owe' styling only when the beat is about owing
const cleanWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9%$]/g, '');
/** Objects a single spoken word points at, most specific first. */
export const candidatesFor = (word: string): string[] => { const c = cleanWord(word); return c ? RULES.filter(([, re]) => re.test(c)).map(([k]) => k) : []; };


/** Resolve an explicit `visuals` entry or a word to a full-bleed object name. */
export const objectFor = (kind: string): string => (OBJECTS[kind] ? kind : FB_FOR[kind] ?? 'coin_stacks');

/**
 * Shots inside one scene: 2-4 visuals that switch on word timestamps. Explicit `visuals` (with an `at` keyword) win; otherwise the
 * kind each spoken word points at (narration order), at least MIN_GAP apart, never the same object twice in a row. First shot is at 0.
 * `skip` = the previous scene's last object, so a new scene never opens on the picture the old one ended with.
 */
export function planShots(scene: {narration: string; emphasis: string[]; emotion: any; visual?: any; visuals?: {kind: string; at?: string}[]}, words: W[], durSec: number, o: {seed?: number; skip?: string} = {}): Shot[] {
  const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9%$'-]/g, '');
  const timeOf = (kw: string | undefined, fallback: number) => {
    if (!kw) return fallback;
    const k = clean(kw), w = words.find(x => clean(x.w) === k || clean(x.w).startsWith(k));
    return w ? Math.max(0, w.start) : fallback;
  };
  let shots: Shot[] = [];
  if (scene.visuals?.length) {
    const n = scene.visuals.length;
    shots = scene.visuals.map((v, i) => ({kind: objectFor(v.kind), at: i === 0 ? 0 : timeOf(v.at, (durSec * i) / n), why: `visuals[]=`}));
  } else {
    const seen = new Set<string>();
    const free = (c: string[], last?: string) => c.find(k => k !== last && !seen.has(k)) ?? c.find(k => k !== last);
    const own = scene.visual?.kind ? objectFor(scene.visual.kind) : undefined;
    // the drafter's visual.kind wins; otherwise score every keyword by how noun-like it is (follows a determiner) and how specific its object is
    const allowed = (k: string) => k !== 'debt_counter' || DEBT.test(scene.narration);
    let best: {k: string; score: number; w: string} | undefined;
    words.forEach((w, i) => {
      const k = candidatesFor(w.w).filter(allowed).find(x => x !== o.skip && (!GENERIC.has(x) || true));
      if (!k) return;
      const prev = cleanWord(words[i - 1]?.w ?? ''), sc = (DET.has(prev) ? 2 : 0) + (GENERIC.has(k) ? -1.5 : 1) + (/^[A-Z]/.test(w.w) ? 0.3 : 0) - i * 0.02;
      if (!best || sc > best.score) best = {k, score: sc, w: w.w};
    });
    const bestHit = best as {k: string; score: number; w: string} | undefined;
    const hero = own ?? bestHit?.k ?? POOL[((o.seed ?? 0) * 5 + 2) % POOL.length];
    const heroWhy = own ? `visual.kind=${scene.visual.kind}` : bestHit ? `noun "${bestHit.w.replace(/[^\w$%]/g, '')}" (score ${bestHit.score.toFixed(1)})` : 'fallback pool (no keyword)';
    shots = [{kind: hero, at: 0, why: heroWhy}]; seen.add(hero);
    for (const w of words) {
      const obj = free(candidatesFor(w.w).filter(allowed).filter(k => !GENERIC.has(k) || candidatesFor(w.w)[0] === k), shots[shots.length - 1].kind), last = shots[shots.length - 1];
      if (!obj || obj === last.kind || w.start - last.at < MIN_GAP || durSec - w.start < 1.0) continue;
      shots.push({kind: obj, at: w.start, why: `word "${w.w.replace(/[^\w$%]/g, '')}"`}); seen.add(obj);
      if (shots.length >= MAX_SHOTS) break;
    }
    if (shots.length === 1 && durSec > 3.2) { // no second keyword: still change the picture mid-scene (no shot is held static)
      const alt = POOL.find(k => k !== hero && k !== o.skip && !seen.has(k) && !GENERIC.has(k)); const mid = words[Math.floor(words.length / 2)]?.start ?? durSec / 2;
      if (alt) shots.push({kind: alt, at: Math.max(MIN_GAP, mid), why: 'mid-scene change (fallback pool)'});
    }
  }
  shots.sort((a, b) => a.at - b.at);
  const out: Shot[] = [];
  for (const s of shots) if (!out.length || s.kind !== out[out.length - 1].kind) out.push(s);
  if (o.skip && out[0].kind === o.skip) { // never open on the previous scene's last picture
    const alt = out.length > 1 ? undefined : POOL.find(k => k !== o.skip && k !== out[0].kind);
    if (alt) out[0] = {...out[0], kind: alt};
  }
  return out;
}

/** Last object a scene shows (used so the next scene never opens on it). */
export const pickFbKind = (scene: any, words: W[], durSec: number, index: number): string => planShots(scene, words, durSec, {seed: index}).at(-1)!.kind;
