import {langInfo} from '../channel/lang.js';

export type Headline = {title: string; url: string; source: string};

const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** Parse a Google News RSS document (keyless public feed). */
export function parseNewsRss(xml: string): Headline[] {
  const out: Headline[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const g = (tag: string) => dec(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '');
    const source = g('source');
    let title = g('title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = g('link');
    if (title && url) out.push({title, url, source});
  }
  return out;
}

const key = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 6).join(' ');

/** Extra news queries per niche family (the niche text itself is always searched too). */
export function nicheSeeds(niche: string, lang = 'en'): string[] {
  const L = langInfo(lang).seeds;
  if (/finance|money|invest|saving|pénz|befektet|megtakar/i.test(niche)) return L.finance;
  if (/tech|software|ai\b|computer|gadget|internet|számítógép|mesterséges/i.test(niche)) return L.tech;
  if (/histor|ancient|war|empire|történe|ókor|háború/i.test(niche)) return L.history;
  return [];
}

const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(w => w.length > 3));
/** Drops headlines that overlap an already used episode/idea title (>= 50% shared long words), so scout never re-suggests our own topics. */
export function dropUsed(hs: Headline[], used: string[]): Headline[] {
  const u = used.map(words);
  return hs.filter(h => { const w = words(h.title); if (!w.size) return true; return !u.some(x => { let n = 0; w.forEach(t => { if (x.has(t)) n++; }); return n / Math.min(w.size, x.size || 1) >= 0.5 && n >= 2; }); });
}

/** Fresh headlines for a niche from Google News RSS (last 7 days). No key, no account. Drops banned topics and near-duplicates. */
export async function fetchHeadlines(o: {niche: string; extra?: string[]; banned?: string[]; limit?: number; fetchFn?: typeof fetch; lang?: string}): Promise<Headline[]> {
  const f = o.fetchFn ?? fetch;
  const seeds = nicheSeeds(o.niche, o.lang), nw = langInfo(o.lang).news;
  const queries = [o.niche, ...seeds, ...(o.extra ?? [])].filter(Boolean).map(q => `${q} when:7d`);
  const seen = new Set<string>(), all: Headline[] = [];
  for (const q of queries) {
    try {
      const r = await f(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${nw.hl}&gl=${nw.gl}&ceid=${nw.ceid}`, {signal: AbortSignal.timeout(8000)});
      if (!r.ok) continue;
      for (const h of parseNewsRss(await r.text())) {
        const k = key(h.title);
        if (!k || seen.has(k) || (o.banned ?? []).some(b => b.trim() && h.title.toLowerCase().includes(b.trim().toLowerCase()))) continue;
        seen.add(k); all.push(h);
      }
    } catch { /* offline: just fewer headlines */ }
  }
  return all.slice(0, o.limit ?? 12);
}

/** Text appended to the ideas prompt so the model reacts to real, current stories (it must not copy them). */
export const scoutFocus = (hs: Headline[]) => hs.length ? `Fresh news this week (use as inspiration for timely angles; never copy a headline, never invent facts):\n${hs.map(h => `- ${h.title} (${h.source})`).join('\n')}` : '';
