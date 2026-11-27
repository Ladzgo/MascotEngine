// Fact research before the outline (free, keyless): the model names Wikipedia articles, we fetch their plain text,
// the model picks 3-6 surprising facts, and only facts whose numbers and wording appear in the fetched text survive.
// The story judge kept asking for "a surprising fact" the script could not have without inventing one.
import {extractJson, type Client} from '../llm/llm.js';
import {MODEL} from './draft.js';
import {spokenNumbers} from './lint.js';

export type Fact = {text: string; numbers: number[]; source: string; title: string};
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const UA = {'User-Agent': 'MascotEngine/0.1 (local explainer-video tool)'};
const text = (r: {content: Array<{type: string; text?: string}>}) => r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9.%\s]/g, ' ').replace(/\s+/g, ' ');

/** Plain text of a whole Wikipedia article and its canonical URL; null when it does not exist. */
export async function wikiText(title: string, f: Fetcher = fetch): Promise<{title: string; url: string; text: string} | null> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  try {
    const r = await f(u, {headers: UA, signal: AbortSignal.timeout(15000)});
    if (!r.ok) return null;
    const p = Object.values(((await r.json()) as {query?: {pages?: Record<string, {title?: string; extract?: string; fullurl?: string; missing?: string}>}}).query?.pages ?? {})[0];
    return p && !('missing' in p) && p.extract && p.fullurl ? {title: p.title ?? title, url: p.fullurl, text: p.extract} : null;
  } catch { return null; }
}

/** A fact is kept only when every number it states appears in the source and most of its content words do too. */
export function grounded(fact: string, source: string): boolean {
  const src = norm(source), srcNums = new Set(spokenNumbers(source));
  const nums = spokenNumbers(fact);
  if (!nums.length || !nums.every(n => srcNums.has(n))) return false;
  const words = norm(fact).split(' ').filter(w => w.length >= 5);
  return words.length > 0 && words.filter(w => src.includes(w)).length / words.length >= 0.6;
}

export async function researchFacts(client: Client, topic: string, o: {model?: string; log?: (m: string) => void; fetcher?: Fetcher} = {}): Promise<Fact[]> {
  const log = o.log ?? (() => {});
  let titles: string[] = [];
  try {
    const j = extractJson(text(await client.messages.create({model: o.model ?? MODEL, max_tokens: 300, system: 'Name the 3 English Wikipedia article titles most likely to contain surprising, numeric facts about this exact topic (specific articles, not broad ones like "Inflation" when a narrower one exists). Exact article titles only. Output ONLY JSON: {"titles": [3 strings]}', messages: [{role: 'user', content: `Topic: ${topic}`}]}))) as {titles?: unknown};
    titles = (Array.isArray(j.titles) ? j.titles : []).map(x => String(x).trim()).filter(Boolean).slice(0, 3);
  } catch (e) { log(`facts: no article titles (${(e as Error).message.slice(0, 60)})`); return []; }
  const pages = (await Promise.all(titles.map(t => wikiText(t, o.fetcher)))).filter((p): p is NonNullable<typeof p> => !!p);
  if (!pages.length) { log(`facts: none of ${titles.join(', ')} found on Wikipedia`); return []; }
  const out: Fact[] = [];
  for (const p of pages) {
    try {
      // only sentences with a figure go to the model: intros are mostly definitions (0 usable facts on 'Inflation' from the first 8000 characters)
      const numeric = (p.text.match(/[^.!?\n]+[.!?]/g) ?? []).filter(x => /\d/.test(x) && !/^\s*(\^|ISBN|doi)/i.test(x)).join(' ').slice(0, 7000);
      if (!numeric) continue;
      const j = extractJson(text(await client.messages.create({model: o.model ?? MODEL, max_tokens: 700, system: 'From the article text, copy up to 3 facts that would surprise a general viewer and relate to the topic. Each fact is ONE sentence close to the article wording and contains at least one number exactly as written in the text. Output ONLY JSON: {"facts": [strings]}', messages: [{role: 'user', content: `Topic: ${topic}\nArticle "${p.title}" (sentences with figures):\n${numeric}`}]}))) as {facts?: unknown};
      for (const t of (Array.isArray(j.facts) ? j.facts : []).map(x => String(x).trim())) {
        if (grounded(t, p.text)) out.push({text: t, numbers: spokenNumbers(t), source: p.url, title: p.title});
        else log(`facts: dropped (not in "${p.title}"): ${t.slice(0, 90)}`);
      }
    } catch { /* next page */ }
  }
  log(`facts: ${out.length} sourced facts from ${pages.map(p => p.title).join(', ')}`);
  return out.slice(0, 6);
}
