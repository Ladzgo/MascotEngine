// Picks library assets (src/assets catalog: Fluent Emoji 3D, MIT) for a beat: a 3D object for a word the drawn set has no picture for,
// and a character (a person doing the thing, or a face reacting) beside the hero. Browser-safe (the catalog is JSON).
import {CATALOG, byId, search, type Asset} from '../assets/catalog';

const STOP = new Set('about after again because before being could does doesn every going little makes making might never other really should since still their there these thing think those through until where which while would years your yours actually most much more what when that this with from have just they them then than into over only even also each next first last same such very will want like keep take make made know need feel feels says said here every eight seven three seventy hundred thousand million twenty thirty forty fifty sixty ninety eleven twelve zero four five nine score scores beats double doubles slows drop drops down stop stops print prints'.split(' '));
export const contentWords = (t: string) => t.toLowerCase().replace(/[^a-z' -]/g, ' ').split(/[\s-]+/).map(w => w.replace(/'s$/, '')).filter(w => w.length >= 4 && !STOP.has(w));
const isFace = (a: Asset) => /face/.test(a.id) || a.tags.includes('smileys & emotion');

// the word must BE the thing: it names the asset's head noun ("snow" -> cloud with snow), never a side tag ("american" -> american football, "drop" -> droplet,
// "five" -> five o'clock); a few common topic words map to their picture directly
const SYN: Record<string, string> = {coffee: 'fluent-hot-beverage', latte: 'fluent-hot-beverage', espresso: 'fluent-hot-beverage', sleep: 'fluent-person-in-bed', sleeping: 'fluent-person-in-bed', asleep: 'fluent-person-in-bed', nap: 'fluent-person-in-bed',
  chemistry: 'fluent-alembic', chemical: 'fluent-alembic', money: 'fluent-money-bag', cash: 'fluent-money-with-wings', invest: 'fluent-chart-increasing', invested: 'fluent-chart-increasing', investing: 'fluent-chart-increasing', stocks: 'fluent-chart-increasing',
  phone: 'fluent-mobile-phone', smartphone: 'fluent-mobile-phone', research: 'fluent-microscope', researchers: 'fluent-microscope', scientists: 'fluent-microscope', study: 'fluent-microscope', memory: 'fluent-brain', brain: 'fluent-brain',
  cold: 'fluent-snowflake', freezing: 'fluent-snowflake', heat: 'fluent-fire', warm: 'fluent-fire', budget: 'fluent-ledger', bank: 'fluent-bank', house: 'fluent-house', rent: 'fluent-house', car: 'fluent-automobile', food: 'fluent-shopping-cart', groceries: 'fluent-shopping-cart'};
const stem = (w: string) => w.replace(/'s$/, '').replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
const head = (a: Asset) => stem(a.tags[0]?.toLowerCase().split(/\s+/).at(-1) ?? '');
const NOT_OBJECT = /keycap|flag|button|index-pointing|hand|thumbs|o-?clock|zodiac|symbol|sign$|-face$|^fluent-(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)$/;
/** The first word of the sentence (in spoken order) that names a library object; skips ids in `used`. Returns the asset id and the word. */
export function objectAsset(text: string, used: Set<string> = new Set()): {id: string; word: string} | undefined {
  for (const w of contentWords(text)) {
    const syn = SYN[w];
    if (syn && byId(syn) && !used.has(syn)) return {id: syn, word: w};
    const a = search(w, {kind: ['object', 'character'], source: 'fluent', limit: 8}).find(x => !used.has(x.id) && !isFace(x) && x.format === 'image' && !NOT_OBJECT.test(x.id) && head(x) === stem(w));
    if (a) return {id: a.id, word: w};
  }
  return undefined;
}

const FACE_BY_EMOTION: Record<string, string> = {shock: 'fluent-astonished-face', shocked: 'fluent-astonished-face', worried: 'fluent-worried-face', sad: 'fluent-pensive-face', happy: 'fluent-grinning-face-with-big-eyes', excited: 'fluent-star-struck', smug: 'fluent-smirking-face', thinking: 'fluent-thinking-face', explaining: 'fluent-face-with-monocle', neutral: 'fluent-thinking-face'};
/** A person doing what the sentence says (runner, technologist, cook...), else a face reacting with the beat's emotion. */
export function characterAsset(text: string, emotion = 'neutral', used: Set<string> = new Set()): string | undefined {
  for (const w of contentWords(text)) {
    const a = search(w, {kind: 'character', source: 'fluent', limit: 6}).find(x => !used.has(x.id) && !isFace(x) && /person|man|woman|worker|technologist|scientist|cook|student|teacher|office|runner|farmer|detective|judge/.test(x.id));
    if (a) return a.id;
  }
  const f = FACE_BY_EMOTION[emotion] ?? FACE_BY_EMOTION.neutral;
  return byId(f) && !used.has(f) ? f : ['fluent-thinking-face', 'fluent-face-with-monocle', 'fluent-astonished-face'].find(x => byId(x) && !used.has(x));
}

export const assetFile = (id: string) => byId(id)?.file;

/** Noto animated (Lottie) twin of a library emoji (same glyph): a reacting face moves instead of standing still (QUALITY-PLAN 7). */
export function animatedTwin(id: string): string | undefined {
  const g = byId(id)?.glyph;
  return g ? CATALOG.find(a => a.kind === 'animated' && a.format === 'lottie' && a.glyph === g)?.file : undefined;
}

// real-footage loops (Pixabay, catalog kind 'background') behind a drawn beat when the sentence (or the title) names their world; first tag = category
const LOOP_WORDS: Record<string, RegExp> = {
  snow: /^(snow\w*|cold|colder|freez\w*|winter\w*|frost\w*|ice|icy|degrees?)$/, money: /^(money|cash|dollars?|bills?|savings?|spend\w*|paid|pay\w*|salary|wealth|rich)$/,
  stock: /^(stocks?|market|invest\w*|shares?|index|funds?|portfolio|trading)$/, office: /^(office|work\w*|jobs?|boss|desk|career|meeting|employ\w*)$/,
  technology: /^(tech\w*|data|internet|network|wifi|computer|laptop|servers?|apps?|software|online|digital|chips?)$/, fire: /^(fire|heat|hot|warm\w*|burn\w*|calories?|flames?)$/,
  starry: /^(sleep\w*|night\w*|asleep|dreams?|bed|bedtime|stars?|insomnia|melatonin)$/, kitchen: /^(coffee|cook\w*|kitchen|food|meals?|eat\w*|latte|tea|breakfast|groceries)$/,
  rain: /^(rain\w*|storm\w*|wet|weather)$/, ocean: /^(ocean|sea|beach|waves?|water|swim\w*)$/, city: /^(city|cities|urban|commut\w*|traffic|rent|downtown)$/,
  forest: /^(forest|trees?|nature|hik\w*|walk\w*|outdoors?|park)$/, clouds: /^(sky|clouds?|air|breath\w*|oxygen)$/,
};
const loopsOf = (cat: string) => CATALOG.filter(a => a.kind === 'background' && a.format === 'video' && a.tags[0] === cat && !a.tags.includes('waterfall') && (cat !== 'money' || a.tags.includes('cash')));
/** Loop categories a text names, in spoken order. */
export const loopCats = (text: string) => [...new Set(contentWords(text).flatMap(w => Object.entries(LOOP_WORDS).filter(([, re]) => re.test(w)).map(([c]) => c)))];
/** A loop file of the first category not in `avoid` with a file not in `used`. */
export function loopAsset(cats: string[], avoid: Set<string>, used: Set<string>): {cat: string; file: string} | undefined {
  for (const cat of cats) { if (avoid.has(cat)) continue; const a = loopsOf(cat).find(x => !used.has(x.file)); if (a) return {cat, file: a.file}; }
  return undefined;
}
