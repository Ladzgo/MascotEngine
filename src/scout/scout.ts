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

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 6).join(' ');

/** Fresh headlines for a niche from Google News RSS (last 7 days). No key, no account. Drops banned topics and near-duplicates. */
export async function fetchHeadlines(o: {niche: string; extra?: string[]; banned?: string[]; limit?: number; fetchFn?: typeof fetch}): Promise<Headline[]> {
  const f = o.fetchFn ?? fetch;
  const seeds = /finance|money|invest|saving/i.test(o.niche) ? ['inflation savings rates', 'credit score debt', 'index fund retirement'] : [];
  const queries = [o.niche, ...seeds, ...(o.extra ?? [])].filter(Boolean).map(q => `${q} when:7d`);
  const seen = new Set<string>(), all: Headline[] = [];
  for (const q of queries) {
    try {
      const r = await f(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, {signal: AbortSignal.timeout(8000)});
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
