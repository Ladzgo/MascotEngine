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
// "coins" finds "coin", "batteries" finds "battery"
const stem = (w: string) => w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const index = new Map<string, Set<string>>();
const tagsOf = (a: Asset) => { let t = index.get(a.id); if (!t) index.set(a.id, t = new Set(a.tags.flatMap(norm).map(stem))); return t; };

/** Assets whose tags match the words (whole-tag hits count double), best first. Ties keep catalog order, so results are deterministic. */
export function search(query: string | string[], o: {kind?: AssetKind | AssetKind[]; limit?: number; source?: string} = {}): Asset[] {
  const words = [...new Set((Array.isArray(query) ? query.join(' ') : query).split(/\s+/).flatMap(norm).map(stem))];
  if (!words.length) return [];
  const kinds = o.kind ? [o.kind].flat() : undefined;
  const phrase = norm(Array.isArray(query) ? query.join(' ') : query).join(' ');
  return CATALOG.flatMap((a, i) => {
    if (kinds && !kinds.includes(a.kind)) return [];
    if (o.source && a.source !== o.source) return [];
    const t = tagsOf(a), hits = words.filter(w => t.has(w)).length;
    if (!hits) return [];
    const exact = a.tags.some(x => norm(x).join(' ') === phrase) ? 2 : 0;
    return [{a, s: hits / words.length + exact + (hits === words.length ? 1 : 0), i}];
  }).sort((x, y) => y.s - x.s || x.i - y.i).slice(0, o.limit ?? 20).map(x => x.a);
}

export const byId = (id: string) => CATALOG.find(a => a.id === id);
/** Credit lines for the assets a video used (CC BY needs them in the description). */
export const credits = (ids: string[]) => [...new Set(ids.map(byId).filter((a): a is Asset => !!a).map(a => a.attribution))];
export const counts = () => CATALOG.reduce((m, a) => ({...m, [a.kind]: (m[a.kind] ?? 0) + 1}), {} as Record<string, number>);
