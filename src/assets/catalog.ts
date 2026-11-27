// Asset library: free, commercially usable assets (MIT / CC0 / CC BY with attribution / Pixabay licence) listed in catalog.json.
// Files live under assets/lib/ (gitignored, filled by `npx tsx scripts/assets/fetch.ts`); `file` is the staticFile() path.
// No fs here: this module is safe to import from the Remotion browser bundle.
import data from './catalog.json';

export type AssetKind = 'object' | 'character' | 'animated' | 'background' | 'sfx';
export type Asset = {
  id: string; file: string; kind: AssetKind; tags: string[];
  /** SPDX-ish: MIT, CC0-1.0, CC-BY-4.0, Pixabay */
  license: string; attribution: string;
  /** library the asset came from (fluent, noto, open-peeps, notionists, procedural, pixabay) */
  source: string;
  /** image | lottie | video | audio */
  format: 'image' | 'lottie' | 'video' | 'audio';
  /** unicode glyph for emoji-based assets */
  glyph?: string;
};

export const LICENSES = ['MIT', 'CC0-1.0', 'CC-BY-4.0', 'Pixabay'] as const;
export const CATALOG = data as Asset[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
// "coins" finds "coin", "batteries" finds "battery", "calories" finds "calorie": every word is indexed and queried with its plural-free forms
const forms = (w: string) => [w, ...(w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? [w.slice(0, -1)] : []), ...(w.length > 4 && w.endsWith('ies') ? [`${w.slice(0, -3)}y`] : [])];
const index = new Map<string, Set<string>>();
const tagsOf = (a: Asset) => { let t = index.get(a.id); if (!t) index.set(a.id, t = new Set(a.tags.flatMap(norm).flatMap(forms))); return t; };
const has = (t: Set<string>, w: string) => forms(w).some(f => t.has(f));

/** Script words with no literal emoji/asset: the concrete picture an editor would use (alias words are searched as tags). */
export const ALIASES: Record<string, string[]> = {
  interest: ['chart increasing', 'percent', 'money bag'], debt: ['money with wings', 'chains', 'receipt'], loan: ['bank', 'handshake'], mortgage: ['house', 'key'],
  fund: ['chart increasing', 'money bag'], investment: ['chart increasing', 'seedling'], invest: ['chart increasing', 'seedling'], market: ['chart increasing', 'chart decreasing'],
  return: ['chart increasing'], gain: ['chart increasing'], loss: ['chart decreasing'], recession: ['chart decreasing', 'factory'], inflation: ['chart increasing', 'balloon'],
  fee: ['receipt', 'coin'], payment: ['credit card', 'receipt'], price: ['label', 'dollar banknote'], minimum: ['credit card'], budget: ['clipboard', 'abacus'],
  saving: ['piggy bank'], save: ['piggy bank'], salary: ['dollar banknote', 'briefcase'], paycheck: ['dollar banknote', 'envelope'], tax: ['receipt', 'classical building'],
  unemployment: ['briefcase'], job: ['briefcase', 'office worker'], subscription: ['mobile phone', 'repeat button'], risk: ['warning'], insurance: ['shield', 'umbrella'],
  memory: ['brain'], recall: ['brain'], remember: ['brain'], focus: ['brain', 'bullseye'], study: ['books', 'graduation cap'], learn: ['books'], research: ['microscope'],
  sleep: ['sleeping face', 'bed'], sitting: ['chair', 'office worker'], exercise: ['person running'], step: ['footprints', 'person walking'], calorie: ['fire', 'fork and knife'], heart: ['anatomical heart'],
  minute: ['stopwatch'], hour: ['hourglass done', 'alarm clock'], decade: ['calendar'], year: ['calendar'], term: ['calendar'], degree: ['thermometer'], cold: ['snowflake', 'thermometer'],
  rate: ['percent', 'chart increasing'], average: ['bar chart'], myth: ['red question mark'], fact: ['check mark button'], performance: ['chart increasing'], financing: ['bank'],
  researcher: ['scientist', 'microscope'], word: ['speech balloon'], takeaway: ['light bulb'], compare: ['balance scale'], decide: ['balance scale'], thousand: ['money bag'], wealth: ['money bag', 'gem stone'],
  battery: ['battery', 'low battery'], power: ['high voltage', 'battery'], capacity: ['battery'], phone: ['mobile phone'], data: ['bar chart'], percent: ['bar chart'],
};
// an alias phrase hits only when all its words are tags ("money bag" must not match a plain "bag")
const aliasHit = (t: Set<string>, w: string) => forms(w).some(f => (ALIASES[f] ?? []).some(p => norm(p).every(x => has(t, x))));

/** Assets whose tags match the words (whole-tag hits count double), best first. Ties keep catalog order, so results are deterministic. */
export function search(query: string | string[], o: {kind?: AssetKind | AssetKind[]; limit?: number; source?: string} = {}): Asset[] {
  const words = [...new Set((Array.isArray(query) ? query.join(' ') : query).split(/\s+/).flatMap(norm))];
  if (!words.length) return [];
  const kinds = o.kind ? [o.kind].flat() : undefined;
  const phrase = norm(Array.isArray(query) ? query.join(' ') : query).join(' ');
  return CATALOG.flatMap((a, i) => {
    if (kinds && !kinds.includes(a.kind)) return [];
    if (o.source && a.source !== o.source) return [];
    // a literal tag hit counts 1, a hit through ALIASES 0.5 (so the real word wins when both exist)
    const t = tagsOf(a), hits = words.reduce((n, w) => n + (has(t, w) ? 1 : aliasHit(t, w) ? 0.5 : 0), 0);
    if (!hits) return [];
    const exact = a.tags.some(x => norm(x).join(' ') === phrase) ? 2 : 0;
    return [{a, s: hits / words.length + exact + (hits === words.length ? 1 : 0), i}];
  }).sort((x, y) => y.s - x.s || x.i - y.i).slice(0, o.limit ?? 20).map(x => x.a);
}

export const byId = (id: string) => CATALOG.find(a => a.id === id);
/** Credit lines for the assets a video used (CC BY needs them in the description). */
export const credits = (ids: string[]) => [...new Set(ids.map(byId).filter((a): a is Asset => !!a).map(a => a.attribution))];
export const counts = () => CATALOG.reduce((m, a) => ({...m, [a.kind]: (m[a.kind] ?? 0) + 1}), {} as Record<string, number>);
