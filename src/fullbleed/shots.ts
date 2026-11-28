import {FB_FOR, OBJECTS} from './objects';

export type Shot = {kind: string; at: number; why?: string}; // seconds from scene start
type W = {w: string; start: number; end: number};
const MIN_GAP = 1.5, MAX_SHOTS = 4;

/** Narration word -> candidate objects, most specific first. A word can point at several (money -> coins, cash, wallet): the planner takes the first one not just shown. */
const RULES: [string, RegExp][] = [
  ['battery', /^(batter(y|ies)|charg\w*|recharg\w*|drain\w*|lithium|ions?|cells?)$/], ['bed', /^(sleep\w*|asleep|bed\w*|mattress(es)?|naps?|napping|rest|resting|rested|insomnia|tired|night|nights|overnight|rem)$/], ['orbit', /^(orbit\w*|rotat\w*|revolv\w*|gravit\w*|tidal\w*|tides?)$/], ['moon', /^(night\w*|midnight|dark|moon\w*|lunar|dreams?|dreaming|slow-wave)$/],
  ['brain', /^(brains?|memor(y|ies)|recall\w*|remember\w*|mind|focus\w*|neurons?|cognit\w+|learn\w*|facts?|think\w*|concentrat\w+)$/],
  ['shoe', /^(run\w*|jog\w*|sneakers?|shoes?|marathon|sprint\w*|stride|footwear)$/], ['dumbbell', /^(gym|lift\w*|workouts?|strength|muscles?|weights?|training|exercis\w+)$/], ['stopwatch', /^(pace|stopwatch|timer|speed|laps?|seconds)$/], ['medal', /^(medals?|race|podium|finish\w*)$/],
  ['heart', /^(heart|health\w*|cardio|pulse|wellness|healthy)$/], ['apple', /^(apples?|fruits?|vegetables?|nutrition|diet|fiber|vitamins?)$/], ['pill', /^(pills?|medicine|medic\w+|drugs?|supplements?|doctor)$/], ['drop', /^(water|hydrat\w+|drink\w*|sweat\w*)$/],
  ['plane', /^(fl(y|ight|ights|ying)|plane|airline|airport|travel\w*|trip|vacation|abroad)$/], ['globe', /^(world\w*|global\w*|countries|country|planets?|earths?|international)$/], ['suitcase', /^(luggage|suitcase|pack\w*|hotel|tourist\w*)$/], ['mountain', /^(mountains?|hik\w+|summit|peak|trail|climb\w*|nature)$/],
  ['laptop', /^(laptops?|computers?|software|code|coding|programm\w+|developer\w*|websites?)$/], ['chip', /^(chips?|ai|processor|hardware|algorithms?|robots?|semiconductors?)$/], ['flask', /^(science|experiments?|chemi\w+|lab|research\w*|study|studies)$/], ['atom', /^(atoms?|physics|energy|quantum|molecul\w+)$/],
  ['sprout', /^(sprout\w*|garden\w*|green|organic|environment\w*|sustainab\w+|plants?)$/], ['sun', /^(suns?|sunny|sunlight|sunshine|sunrise|sunset|summer|morning|daylight|solar|weather)$/], ['burger', /^(burgers?|junk|restaurants?|cook\w*|recipes?|meals?|dinner|lunch|breakfast)$/], ['book', /^(books?|read\w*|learn\w*|lessons?|courses?|knowledge|study)$/],
  ['person_atm', /^(atm|withdraw\w*)$/], ['atm', /^(atm|withdraw\w*|machine)$/], ['paycheck', /^(paychecks?|salary|wages?|income|earn\w*|paid|payday)$/], ['bills', /^(bills?|utilit\w+|invoices?|statements?)$/],
  ['person_bills', /^(stress\w*|worr\w*|anxious|anxiety|panic\w*|overwhelm\w*)$/], ['person_celebrate', /^(celebrat\w+|freedom|joy\w*|thrilled|happy|party)$/], ['person_shocked', /^(shock\w*|surpris\w*|wow|unbelievable|stunned)$/],
  ['person_thinking', /^(think\w*|decid\w+|decision|consider\w*|wonder\w*|choos\w+)$/], ['person_walking', /^(walk\w*|journey|begin\w*|beginner\w*)$/], // not 'first': 'the first half of the 16th century' is no walk
  ['shopping_bag', /^(shopp\w+|retail|purchas\w+|buy\w*|bought|spree|spend\w*|splurg\w+)$/], ['keys', /^(keys?|landlord|tenants?|lease|renter|renting|rent)$/], ['tax_form', /^(tax\w*|irs|deduct\w*|filing|returns?)$/],
  ['ticker', /^(stocks?|shares?|ticker|trad(e|es|ing|er|ers)|dividends?|nasdaq|s&p)$/], ['rocket', /^(skyrocket\w*|rocket\w*|soar\w*|moon|boom\w*|surg\w+)$/], ['ladder', /^(ladder|climb\w*|steps?|rungs?|career|promotion)$/],
  ['safe', /^(safe|stash\w*|savings|secure\w*)$/], ['hourglass', /^(wait\w*|patien\w*|years?|decades?|eventually|slowly|deadline|forever|retire\w*|long-term)$/], ['thermometer', /^(inflation|heat\w*|hot|overheat\w*|temperatures?|prices|degrees|celsius|fahrenheit|cold|colder|freez\w*|frozen|warm\w*|winter)$/],
  ['gas_pump', /^(gas|fuel|petrol|gasoline)$/], ['groceries', /^(grocer\w*|food|supermarket|meals?|eggs|milk|bread)$/], ['coffee', /^(coffee|latte|lattes|cafe|espresso|cups?|mugs?|barista)$/], ['subscriptions', /^(subscri\w+|streaming|netflix|memberships?|recurring)$/],
  ['trophy', /^(win|wins|winning|winners?|champion\w*|trophy|trophies|medals?|award\w*|achiev\w+)$/], ['tree', /^(tree|seeds?|plant\w*|compound\w*|decades)$/], ['anchor', /^(anchor\w*|burden\w*|drag\w*|heavy|weigh\w*)$/], ['hole', /^(hole|pit|spiral\w*|drain\w*|sink\w*|trapped)$/],
  ['flame', /^(burn\w*|wast\w+|fire|blow\w*|squander\w*)$/], ['dice', /^(risks?|risky|gambl\w*|luck\w*|chance|odds|bets?|volatil\w*)$/], ['umbrella', /^(rainy|emergenc\w+|cushion|buffer|unexpected)$/],
  ['calculator', /^(calculat\w+|math\w*|maths|compute\w*|totals?|sum|add\w*|multipl\w*|divid\w*|equals)$/], ['map_route', /^(route|path|roadmap|map|road)$/], ['donut', /^(breakdown|portion|percentage|slices?|allocat\w+)$/], ['line_chart', /^(trend\w*|history|historical\w*|curve|chart\w*)$/],
  ['stacked_bars', /^(mix|categor\w+|budgets?)$/], ['clipboard', /^(checklist|steps|list|plan\w*|tasks?)$/], ['coin_spin', /^(coin|penny|dollar)$/],
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
  ['gradcap', /^(school|college|students?|educat\w+|tuition|university)$/], ['gears', /^(process|machine|engine|mechanism|gears?)$/], ['pin', /^(where|locat\w+|local|cit(y|ies)|nearby|map)$/],
  ['magnifier', /^(print|inspect\w*|magnif\w*|hidden|check|checks|checking|verify|verif\w+|research)$/], ['doc', /^(documents?|polic(y|ies)|paperwork|agreements?|forms?)$/],
  ['skyline', /^(econom\w+|business\w*|compan(y|ies)|corporat\w+|recession|industry)$/],
];
const POOL = ['coin_stacks', 'bars_arrow', 'skyline', 'cash', 'pie', 'receipts', 'wallet', 'calendar']; // neutral, on-topic fillers only (no people/clock/bulb unless the text is about them)
const GENERIC = new Set(['people', 'clock', 'hourglass', 'calendar', 'bulb', 'gears', 'pin', 'handshake', 'magnifier', 'scale', 'shield', 'lock']);
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
    // one storyboard picture on a long beat: the next object the voice names takes over (a 7.9 s beat held one cash pile, ep011-v3)
    for (const w of words) {
      const last = shots[shots.length - 1];
      if (shots.length >= Math.ceil(durSec / 2.6) || shots.length >= MAX_SHOTS) break;
      const k = candidatesFor(w.w).find(x => !GENERIC.has(x) && x !== 'debt_counter' && !shots.some(s => s.kind === x));
      if (k && w.start - last.at >= MIN_GAP && durSec - w.start >= 1.0) shots.push({kind: k, at: w.start, why: `word "${w.w.replace(/[^\w$%]/g, '')}"`});
    }
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
