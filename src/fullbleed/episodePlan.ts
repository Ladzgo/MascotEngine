import {planShots, objectFor, candidatesFor} from './shots';
import {OBJECTS} from './objects';
import {objectAsset, characterAsset, loopAsset, loopCats} from './assetPick';
import {byId} from '../assets/catalog';
import {ACTIONS, GROUPS, SETTINGS, CAMERAS, LAYOUTS, type Layout, type Setting} from './catalog';

type W = {w: string; start: number; end: number};
export type PlannedShot = {kind: string; at: number; why?: string; action: string};
export type ScenePlan = {env: Setting; pal: number; camera: number; zoom: 'wide' | 'close'; layout: Layout; shots: PlannedShot[]; companion?: string; character?: string; bgLoop?: string; matchCut?: boolean};

/** Where each kind of subject likes to live; the engine rotates through these so neighbouring scenes never share a setting. */
const ENV_BY_GROUP: Record<string, Setting[]> = {
  money: ['vault', 'office', 'room'], rate: ['abstract', 'sky'], time: ['room', 'sky', 'abstract'], debt: ['room', 'street', 'abstract'], growth: ['abstract', 'sky', 'city'], spending: ['street', 'kitchen', 'room'],
  card: ['room', 'office', 'street'], safety: ['vault', 'room', 'abstract'], place: ['city', 'street', 'sky'], docs: ['office', 'room'], compare: ['abstract', 'office'], fall: ['abstract', 'street'], people: ['street', 'office', 'room', 'sky'], ideas: ['office', 'abstract', 'sky'],
};
const ACTION_BY_GROUP: Record<string, string[]> = {
  money: ['drop', 'stack', 'pop_in', 'bounce'], rate: ['pulse', 'shake', 'grow'], time: ['pop_in', 'wobble', 'tilt'], debt: ['sink', 'shake', 'cross_out', 'fall'], growth: ['rise', 'grow', 'pulse', 'pop_in'],
  spending: ['slide_in_left', 'swipe', 'drop', 'cross_out'], card: ['swipe', 'slide_in_right', 'flip'], safety: ['lock', 'pop_in', 'check'], place: ['pop_in', 'pan_across', 'grow'], docs: ['slide_in_left', 'check', 'flip'],
  compare: ['compare_slide', 'pop_in', 'split'], fall: ['sink', 'fall', 'shake'], people: ['pop_in', 'bounce', 'slide_in_right'], ideas: ['pop_in', 'float', 'orbit'],
};
export const groupOf = (kind: string): string => Object.entries(GROUPS).find(([, v]) => v.includes(kind))?.[0] ?? 'ideas';

/** Same group first, then anything unused: a picture is only repeated when nothing else fits. */
const DEBT_TEXT = /\b(debts?|owe[sd]?|owing|loans?|borrow\w*)\b/i;
/** Pictures that only mean money (coins, cards, bills, rates): a battery or sleep video never gets them, not even as a variety fallback (after-tech had a DEBT HOLE). */
export const MONEY_ONLY = new Set(['coin_stacks', 'cash', 'wallet', 'piggy', 'jar_fill', 'coin_spin', 'vault', 'safe', 'bank', 'atm', 'card', 'card_swipe', 'paycheck', 'bills', 'receipts', 'tax_form', 'debt_counter', 'percent', 'price_up', 'pricetag', 'subscriptions', 'person_atm', 'person_bills', 'hole', 'snowball', 'ticker']);
// overdue bills / DUE stamps mean owing: a sentence about spending or a yearly total is not a bill (ep011: "You could spend $1,825 a year" over a DUE stack scored 5)
const BILLS = new Set(['bills', 'person_bills', 'receipts', 'debt_counter']), BILL_TEXT = /\b(bills?|due|overdue|owe[sd]?|owing|debts?|loans?|invoices?|receipts?|statements?|minimum)\b/i;
export const MONEY_TOPIC = /\$|\b(money|dollars?|cents?|debts?|loans?|invest\w*|sav(e|es|ed|ing|ings)|budget\w*|spend\w*|prices?|costs?|banks?|credit|tax(es)?|income|pay(s|ing|ment\w*)?|paid|cash|mortgage|rent|salary|wealth|retire\w*|stocks?|funds?|interest|cheap|expensive|afford\w*)\b/i;
function fresh(kind: string, recent: string[], also: string[] = [], text = '', home: string[] = [], money = true): string {
  const bad = new Set([...recent, ...also, ...(money ? [] : MONEY_ONLY)]);
  if (!DEBT_TEXT.test(text)) bad.add('debt_counter'); // the red 'you owe' panel only illustrates owing
  if (!bad.has(kind)) return kind;
  const pool = [...GROUPS[groupOf(kind)] ?? [], ...home.flatMap(g => GROUPS[g] ?? []), ...Object.values(GROUPS).flat()].filter(k => OBJECTS[k] && !bad.has(k));
  return pool[0] ?? kind;
}

const validSetting = (s: unknown): s is Setting => (SETTINGS as readonly string[]).includes(String(s));

/**
 * Plans every scene of an episode at once, so variety rules can look across beats: no subject within the last 6 scenes (or 2 shots), settings, palettes, camera moves
 * and layouts rotate (never the same twice in a row), zoom alternates wide/close. A beat's explicit `shot` (subject, action, setting, camera, layout) wins over inference.
 */
export function planEpisode(scenes: any[], wordsPer: W[][], durs: number[]): ScenePlan[] {
  const perScene: string[][] = [], out: ScenePlan[] = [];
  // the topic's own groups (what the storyboard's subjects belong to) are tried first when a picture must change: a running video never falls back to coins
  const money = MONEY_TOPIC.test(scenes.map(s => s.narration ?? '').join(' '));
  const home = [...new Set(scenes.map(s => s.shot?.subject).filter((x): x is string => typeof x === 'string').map(groupOf))];
  const lastSix = () => perScene.slice(-8).flat(); // variety window = the last 8 beats (scenes), not 8 shots
  const envHist: Setting[] = []; // backdrops of drawn beats only (stock beats show footage)
  const usedAssets = new Set<string>();
  let prevEnv: Setting | undefined, prevLayout: Layout | undefined, prevCam = -1, talkN = 0;
  // real-footage loops behind drawn beats: the sentence's world, else the episode's most named one on every other drawn beat; never the same look within 3 beats
  const catCount = new Map<string, number>();
  for (const sc of scenes) for (const c of loopCats(sc.narration ?? '')) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  const topCat = [...catCount].sort((a, b) => b[1] - a[1])[0]?.[0], looks: string[] = [], usedLoops = new Set<string>();
  let prevLoop = false;
  scenes.forEach((s, i) => {
    const sh = s.shot ?? {}, words = wordsPer[i] ?? [], dur = durs[i] ?? 4;
    const billOk = BILL_TEXT.test(s.narration ?? ''), visuals = s.visuals?.filter((v: {kind: string}) => (money || !MONEY_ONLY.has(objectFor(v.kind))) && (billOk || !BILLS.has(objectFor(v.kind))));
    const raw = planShots({...s, visuals: visuals?.length ? visuals : undefined}, words, dur, {seed: i, skip: perScene.at(-1)?.at(-1)});
    // a topic word said in the sentence ("battery", "sleep", "coffee") beats a storyboard subject the sentence never names (after-tech: pie for "sluggish chemistry")
    const said = String(s.narration ?? '').split(/\s+/).flatMap(candidatesFor), topical = said.find(k => TOPICAL.has(k) && OBJECTS[k] && !perScene.slice(-1).flat().includes(k));
    if (typeof sh.subject === 'string' && OBJECTS[objectFor(sh.subject)] && (SUBJECT_SET.has(sh.subject)) && (money || !MONEY_ONLY.has(sh.subject)) && (!BILLS.has(sh.subject) || BILL_TEXT.test(s.narration ?? '')) && (!topical || (said.includes(sh.subject) && !WEAK.has(sh.subject)))) raw[0] = {kind: sh.subject, at: 0, why: `shot.subject=${sh.subject}`};
    else if (topical) raw[0] = {kind: topical, at: 0, why: `shot.topic word -> ${topical}`};
    // the drawn subject lands when the voice says its word (max 1.2 s in; before that the backdrop/footage carries the beat)
    if (typeof sh.at === 'string' && raw[0]?.why?.startsWith('shot.')) {
      const w = words.find(x => x.w.toLowerCase().replace(/[^\p{L}\p{N}%$'-]/gu, '') === sh.at);
      if (w) raw[0] = {...raw[0], at: i === 0 ? 0 : Math.min(1.2, Math.max(0, w.start)), why: `${raw[0].why} @"${sh.at}"`}; // the hook beat shows its picture on frame 0
      for (let k = raw.length - 1; k > 0; k--) if (raw[k].at < raw[0].at + 1.5) raw.splice(k, 1); // later shots keep their spacing
    }
    const shots: PlannedShot[] = [];
    for (const [k, r] of raw.entries()) {
      const explicit = !!r.why?.startsWith('shot.') || !!r.why?.startsWith('visual') ;
      const kind = explicit && k === 0 && r.why!.startsWith('shot.') ? r.kind : fresh(r.kind, lastSix(), shots.map(x => x.kind), s.narration ?? '', home, money);
      shots.push({kind, at: r.at, why: kind === r.kind ? r.why : `${r.why} -> ${kind} (variety)`, action: k === 0 && ACTIONS.includes(sh.action) ? sh.action : ACTION_BY_GROUP[groupOf(kind)]?.[(i + k) % (ACTION_BY_GROUP[groupOf(kind)]?.length ?? 1)] ?? 'pop_in'});
    }
    if (s.type === 'chart') shots.splice(1); // the chart IS the picture: a later object replaced the plot with a clock (fb-wide)
    // an action/condition the sentence names ("charge", "freezing", "heat", "save") is a concrete picture: it beats a device symbol, a variety pick or a repeat (ep015: a laptop for "Don't charge in cold")
    if (!s.stockFile && !['big_number', 'chart', 'title'].includes(s.type)) shots.forEach((x, k) => {
      if (!(DEVICE.has(x.kind) || WEAK.has(x.kind) || /variety|fallback|mid-scene/.test(x.why ?? '') || perScene.at(-1)?.includes(x.kind))) return;
      const c = conceptHero(s.narration ?? '', new Set([...(perScene.at(-1) ?? []), ...shots.map(y => y.kind), ...[...usedAssets].map(a => `asset:${a}`)]), money);
      if (c) { shots[k] = {...x, kind: c.kind, why: `${x.why} -> concept "${c.word}"`}; if (c.kind.startsWith('asset:')) usedAssets.add(c.kind.slice(6)); }
    });
    // a symbol any sentence could carry (shield, lock, magnifier...) loses the hero spot to a library object the sentence names (reference gap 2: a shield grid for 'the real reason')
    if (!s.stockFile && !['big_number', 'chart', 'title'].includes(s.type) && WEAK.has(shots[0]?.kind ?? '')) { const a = objectAsset(s.narration ?? '', usedAssets); if (a) { usedAssets.add(a.id); shots[0] = {...shots[0], kind: `asset:${a.id}`, why: `${shots[0].why} -> asset "${a.word}" (weak symbol)`}; } }
    // library assets (Fluent 3D, src/assets): a fallback/variety picture becomes the object the sentence names; a long one-picture beat gets it as its second shot
    if (!s.stockFile && !['big_number', 'chart', 'title'].includes(s.type)) {
      for (const x of shots) if (/fallback|variety|mid-scene/.test(x.why ?? '')) { const a = objectAsset(s.narration ?? '', usedAssets); if (a) { usedAssets.add(a.id); x.why = `${x.why} -> asset "${a.word}"`; x.kind = `asset:${a.id}`; } }
      const last = shots[shots.length - 1];
      if (shots.length < Math.ceil(dur / 2.6) && dur - last.at > 2.6) {
        const a = objectAsset(s.narration ?? '', usedAssets), w = a && words.find(x => x.w.toLowerCase().replace(/[^a-z]/g, '').startsWith(a.word));
        const at = Math.min(dur - 1.2, Math.max(last.at + 1.5, w?.start ?? (last.at + dur) / 2));
        if (a) { usedAssets.add(a.id); shots.push({kind: `asset:${a.id}`, at, why: `asset "${a.word}"`, action: 'pop_in'}); }
      }
    }
    // a character (a person doing it, or a face reacting) beside the hero in every third drawn beat
    const character = !s.stockFile && i % 3 === 1 && ['talk', 'list', 'checklist', 'timeline'].includes(s.type) ? characterAsset(s.narration ?? '', String(s.emotion ?? 'neutral'), usedAssets) : undefined;
    if (character) usedAssets.add(character);
    perScene.push(shots.map(x => x.kind));
    const g = groupOf(shots[0].kind), envs = ENV_BY_GROUP[g] ?? ['abstract'];
    // backdrop: the explicit/group choice unless it was seen in the last 8 drawn beats, then the least recently used one (group settings first)
    const recent = envHist.slice(-8), age = (e: Setting) => { const k = recent.lastIndexOf(e); return k < 0 ? Infinity : recent.length - k; };
    const pref = [...(validSetting(sh.setting) ? [sh.setting] : []), ...envs.slice(i % envs.length), ...envs, ...SETTINGS] as Setting[];
    let env: Setting = pref.find(e => age(e) === Infinity) ?? [...pref].sort((a, b) => age(b) - age(a))[0];
    if (env === prevEnv) env = pref.find(e => e !== prevEnv) ?? env;
    if (!s.stockFile) envHist.push(env);
    let camera = typeof sh.camera === 'string' && CAMERAS.includes(sh.camera as any) ? CAMERAS.indexOf(sh.camera as any) % 4 : (prevCam + 1 + (i % 2)) % 4;
    if (camera === prevCam) camera = (camera + 1) % 4;
    // layout: content decides first, talk beats rotate through the composed layouts
    let layout: Layout;
    const companion = GROUPS[g]?.find(k => OBJECTS[k] && (money || !MONEY_ONLY.has(k)) && !shots.some(x => x.kind === k) && !lastSix().includes(k));
    if (typeof sh.layout === 'string' && (LAYOUTS as readonly string[]).includes(sh.layout)) layout = sh.layout as Layout;
    else if (s.type === 'chart') layout = 'dataviz';
    else if (s.stockFile) layout = shots[0]?.why?.startsWith('shot.') ? 'pip' : 'broll'; // footage + the named object as an accent reads as "exactly this" (semantic QA: bare snow footage for "zero degrees" scored 5)
    else if (s.type !== 'talk') layout = 'hero';
    else {
      const order: Layout[] = ['hero', 'kinetic', 'split', 'grid', 'hero', 'kinetic'];
      layout = order[talkN % order.length]; talkN++;
      if (layout === 'split' && !companion) layout = 'grid';
      if (layout === prevLayout) layout = layout === 'hero' ? 'kinetic' : 'hero';
    }
    if ((layout === 'pip' || layout === 'broll') && !s.stockFile) layout = 'hero';
    if (layout === 'grid' && WEAK.has(shots[0]?.kind ?? '')) layout = 'kinetic'; // six shields for 'the real reason' read as clip art (ep016); a full-size lone symbol was clipped, so the headline carries it
    const own = loopCats(s.narration ?? ''), loop = !s.stockFile && layout !== 'dataviz' && s.type !== 'chart' && (own.length || !prevLoop) ? loopAsset([...own, ...(topCat ? [topCat] : [])], new Set(looks.slice(-2).filter(l => l.startsWith('loop:')).map(l => l.slice(5))), usedLoops) : undefined;
    if (loop) usedLoops.add(loop.file);
    if (!s.stockFile) prevLoop = !!loop;
    looks.push(s.stockFile ? `stock:${s.stockFile}` : loop ? `loop:${loop.cat}` : env);
    out.push({env, pal: (i + (g.length % 4)) % 4, camera, zoom: i % 2 ? 'close' : 'wide', layout, shots, companion, character, bgLoop: loop?.file});
    prevEnv = env; prevLayout = layout; prevCam = camera;
  });
  // palettes: never the same index twice in a row
  out.forEach((p, i) => { if (i && p.pal === out[i - 1].pal) p.pal = (p.pal + 1) % 4; });
  markMatchCuts(out, scenes);
  return out;
}
const SUBJECT_SET = new Set(Object.keys(OBJECTS));
// symbols any sentence could carry: a topic object the sentence names beats them (en-sleep title: a clock for "memory after missing eight hours of sleep" scored 5)
const WEAK = new Set(['clock', 'calendar', 'hourglass', 'gears', 'bulb', 'people', 'magnifier', 'shield', 'lock', 'scale', 'pie', 'percent', 'arrow_up', 'arrow_down', 'doc', 'clipboard']);
const TOPICAL = new Set(['sport', 'health', 'travel', 'tech', 'food', 'science', 'sleep'].flatMap(g => GROUPS[g]).filter(k => !WEAK.has(k) && !['person_walking', 'globe', 'sun'].includes(k)));

/** Variety numbers of a plan: share of plain beats (one centred object on a talk beat), distinct pictures, closest repeat, stock share, layout mix. Targets: plain <= 25%, distinct >= 60%, repeat gap >= 8. */
export function planStats(plans: ScenePlan[], scenes: {type: string; stockFile?: string; stock?: unknown}[]) {
  const n = plans.length, first = plans.map(p => p.shots[0]?.kind), layouts: Record<string, number> = {};
  plans.forEach(p => { layouts[p.layout] = (layouts[p.layout] ?? 0) + 1; });
  let gap = Infinity;
  first.forEach((k, i) => { for (let j = i - 1; j >= 0; j--) if (first[j] === k) { gap = Math.min(gap, i - j); break; } });
  return {
    beats: n, layouts, plainShare: n ? plans.filter((p, i) => p.layout === 'hero' && scenes[i].type === 'talk' && !scenes[i].stock).length / n : 0,
    distinct: n ? new Set(first).size / n : 0, minRepeatGap: gap === Infinity ? null : gap, stockShare: n ? scenes.filter(s => s.stock || s.stockFile).length / n : 0,
  };
}

/** Silhouette classes for match cuts: two beats in a row whose heroes share a silhouette cut hard on the shape (an editor's match cut), no camera transition. */
const SHAPES: Record<string, string[]> = {
  round: ['clock', 'coin_stacks', 'coin_spin', 'gauge', 'pie', 'donut', 'globe', 'sun', 'moon', 'apple', 'stopwatch', 'snowball', 'percent', 'atom', 'medal', 'burger', 'brain'],
  tall: ['battery', 'thermometer', 'phone', 'flask', 'hourglass', 'pill', 'drop', 'bulb', 'gas_pump', 'rocket', 'ladder', 'jar_fill', 'flame', 'trophy', 'coffee'],
  box: ['laptop', 'doc', 'card', 'card_swipe', 'calendar', 'calculator', 'clipboard', 'tax_form', 'receipts', 'bills', 'paycheck', 'book', 'safe', 'vault', 'atm', 'chip', 'subscriptions'],
};
export const shapeOf = (kind: string) => Object.entries(SHAPES).find(([, v]) => v.includes(kind))?.[0];
/** Marks beat i as a match cut when it and beat i-1 are drawn heroes of the same silhouette; it also takes the previous framing so the shapes line up. */
export function markMatchCuts(plans: ScenePlan[], scenes: {stockFile?: string; type?: string}[]): void {
  plans.forEach((p, i) => {
    const q = plans[i - 1], a = q?.shots.at(-1)?.kind, b = p.shots[0]?.kind;
    if (!q || !a || !b || scenes[i].stockFile || scenes[i - 1].stockFile || ![p.layout, q.layout].every(l => l === 'hero' || l === 'kinetic') || scenes[i].type !== 'talk' || scenes[i - 1].type !== 'talk' || !shapeOf(a) || shapeOf(a) !== shapeOf(b)) return;
    p.matchCut = true; p.zoom = q.zoom; p.layout = q.layout; p.shots[0] = {...p.shots[0], at: 0}; // the shape must be on screen on the cut frame
  });
}

/** Verbs/conditions with a concrete picture, in the order tried (procedural object or library asset). */
const CONCEPTS: [RegExp, string[]][] = [
  [/^(charg(e|es|ed|ing|er)|plug(s|ged)?|recharg\w*)$/, ['asset:fluent-electric-plug']],
  [/^(cold|colder|freez\w*|frozen|winter\w*|icy|frost\w*)$/, ['asset:fluent-snowflake', 'thermometer']],
  [/^(heat|hot|warm(s|er|ing|ed)?|burn\w*)$/, ['flame', 'asset:fluent-fire']],
  [/^(sav(e|es|ed|ing|ings))$/, ['piggy', 'jar_fill']],
  [/^(sleep\w*|asleep|nap\w*)$/, ['bed', 'moon']],
  [/^(fees?|surcharges?|charges)$/, ['receipts', 'bills']],
  [/^(calculat\w*|math|numbers|verify|check)$/, ['calculator']],
  [/^(lose|loses|losing|lost|wast(e|es|ed|ing))$/, ['asset:fluent-money-with-wings']],
  [/^(run|runs|running|walk\w*|steps?)$/, ['shoe', 'person_walking']],
];
const DEVICE = new Set(['phone', 'laptop', 'chip', 'gears', 'asset:fluent-mobile-phone', 'asset:fluent-laptop']);
export function conceptHero(text: string, avoid: Set<string>, money = true): {kind: string; word: string} | undefined {
  for (const w of text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/)) for (const [re, kinds] of CONCEPTS) {
    if (!re.test(w)) continue;
    const k = kinds.find(x => !avoid.has(x) && !avoid.has(x.slice(6)) && (x.startsWith('asset:') ? !!byId(x.slice(6)) : !!OBJECTS[x]) && (money || !MONEY_ONLY.has(x)));
    if (k) return {kind: k, word: w};
  }
  return undefined;
}
