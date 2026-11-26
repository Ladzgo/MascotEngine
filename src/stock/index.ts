import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openverse, pexels, pixabay, setApiCacheDir, wikimedia, type Fetcher, type Query, type StockHit} from './providers.js';

const ROOT = new URL('../../', import.meta.url).pathname;
export const CACHE_DIR = `${ROOT}assets/stock-cache/`;
type Env = Record<string, string | undefined>;
export type Format = 'short' | 'wide';

// finance b-roll should not show faces, logos, brands or text: such hits rank last (never silently dropped, a result beats none)
const AVOID = /\b(person|people|man|woman|men|women|girl|boy|child|portrait|face|selfie|logo|brand|sign|text|poster|banner|screenshot|advert\w*)\b/i;

/** Rank hits: right orientation, enough pixels, no faces/logos/text, then bigger. Hits below the minimum size are dropped. */
export function rank(hits: StockHit[], a: Query, format: Format): StockHit[] {
  const minW = format === 'short' ? 720 : 1280, minH = format === 'short' ? 1280 : 720;
  const words = a.query.toLowerCase().split(/\W+/).filter(x => x.length > 2).map(x => x.replace(/(ing|es|s)$/, ''));
  const overlap = (h: StockHit) => { const t = `${h.title} ${h.tags ?? ''}`.toLowerCase(); return words.filter(x => t.includes(x)).length; };
  const sized = hits.filter(h => h.url && (!h.width || !h.height || (h.kind === 'video' ? Math.max(h.width, h.height) >= 1280 : h.width >= minW * 0.9 && h.height >= minH * 0.9)));
  const scored = sized.map((h, idx) => ({h, ov: overlap(h), s: ((h.height >= h.width) === (a.orientation === 'portrait') || h.kind === 'video' ? 2 : 0) + (AVOID.test(`${h.title} ${h.tags ?? ''}`) ? -3 : 1) + Math.min(1, (h.width * h.height) / (minW * minH * 2)) + overlap(h) * 2.5 - idx * 0.15}));
  // a hit must share enough words with the query (half, at least one): an off-topic picture is worse than the drawn subject, so no match = no stock
  const need = words.length >= 3 ? 2 : 1, relevant = scored.filter(x => x.ov >= need || !words.length);
  return relevant.sort((x, y) => y.s - x.s).map(x => x.h);
}

/** Provider registry, in order of preference. Adding a source = one function `(fetcher, query, env) => StockHit[]` plus one line here.
 *  Pixabay (PIXABAY_API_KEY, photos + videos) is primary; Openverse and Wikimedia Commons are the keyless fallback; Pexels only when a key already exists (new keys paused). */
export const PROVIDERS: {name: string; needsKey?: string; search: (f: Fetcher, a: Query, env: Env) => Promise<StockHit[]>}[] = [
  {name: 'pixabay', needsKey: 'PIXABAY_API_KEY', search: pixabay},
  {name: 'openverse', search: (f, a) => openverse(f, a)},
  {name: 'wikimedia', search: (f, a) => wikimedia(f, a)},
  {name: 'pexels', needsKey: 'PEXELS_API_KEY', search: pexels},
];

/** Muted, cropped to the frame, looped to 20 s: a beat never outlasts its clip and Remotion decodes a small file. Falls back to the raw download. */
export function prepVideo(raw: string, format: Format, dir: string): string {
  const out = path.join(dir, `${path.basename(raw, '.mp4')}-${format}.mp4`);
  if (fs.existsSync(out)) return out;
  const [w, h] = format === 'short' ? [1080, 1920] : [1920, 1080];
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', raw, '-t', '20', '-an', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30`, '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', `${out}.part.mp4`]);
  if (r.status !== 0) { fs.rmSync(`${out}.part.mp4`, {force: true}); return raw; }
  fs.renameSync(`${out}.part.mp4`, out);
  return out;
}

export type Fetched = {file: string; hit: StockHit};
/** Download one hit into the cache (once) and prepare video for the frame; null when the download fails. */
export async function downloadHit(hit: StockHit, f: Fetcher, dir: string, format: Format): Promise<string | null> {
  const ext = (/\.(jpe?g|png|webp|mp4)(\?|$)/i.exec(hit.url)?.[1] ?? (hit.kind === 'video' ? 'mp4' : 'jpg')).toLowerCase().replace('jpeg', 'jpg');
  const file = path.join(dir, `${crypto.createHash('sha1').update(hit.url).digest('hex').slice(0, 20)}.${ext}`);
  if (!fs.existsSync(file)) {
    try {
      const r = await f(hit.url, {signal: AbortSignal.timeout(60000)});
      if (!r.ok) return null;
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(`${file}.part`, Buffer.from(await r.arrayBuffer()));
      fs.renameSync(`${file}.part`, file);
    } catch { return null; }
  }
  return hit.kind === 'video' ? prepVideo(file, format, dir) : file;
}

/** Ranked candidates for the Studio's "Swap image" grid: the first provider that has results, best first. */
export async function searchStock(o: {query: string; kind: 'photo' | 'video'; format: Format; limit?: number; env?: Env; fetcher?: Fetcher; cacheDir?: string}): Promise<StockHit[]> {
  const f = o.fetcher ?? fetch, env = o.env ?? process.env;
  setApiCacheDir(path.join(o.cacheDir ?? CACHE_DIR, 'api'));
  const a: Query = {query: o.query, kind: o.kind, orientation: o.format === 'short' ? 'portrait' : 'landscape'};
  for (const p of PROVIDERS) {
    if (p.needsKey && !env[p.needsKey]) continue;
    try { const r = rank(await p.search(f, a, env), a, o.format); if (r.length) return r.slice(0, o.limit ?? 12); } catch { /* next provider */ }
  }
  return [];
}

/** Use `hit` for scene `scene`: downloads it and rewrites that beat's record in stock.json (kept on later runs because the query is unchanged). */
export async function chooseStock(epDir: string, scene: number, stock: {query: string; kind: 'photo' | 'video'}, hit: StockHit, format: Format, o: {fetcher?: Fetcher; cacheDir?: string} = {}): Promise<StockRecord | null> {
  const file = await downloadHit(hit, o.fetcher ?? fetch, o.cacheDir ?? CACHE_DIR, format);
  if (!file) return null;
  const prev = readStock(epDir).items.filter(x => x.scene !== scene);
  const rec: StockRecord = {scene, query: stock.query, file: `stock-cache/${path.basename(file)}`, provider: hit.provider, pageUrl: hit.pageUrl, author: hit.author, license: hit.license, title: hit.title, kind: hit.kind};
  const items = [...prev, rec].sort((x, y) => x.scene - y.scene);
  fs.writeFileSync(path.join(epDir, 'stock.json'), JSON.stringify({items, credits: creditLines(items)}, null, 2));
  return rec;
}
/** Best licensed match for one query. Provider order: Pexels, Pixabay (when keyed), then Openverse, Wikimedia Commons. Downloads once into assets/stock-cache/<sha1>.<ext>. */
export async function fetchStock(o: {query: string; kind: 'photo' | 'video'; format: Format; env?: Env; fetcher?: Fetcher; cacheDir?: string}): Promise<Fetched | null> {
  const f = o.fetcher ?? fetch, env = o.env ?? process.env, dir = o.cacheDir ?? CACHE_DIR;
  setApiCacheDir(path.join(dir, 'api'));
  const a: Query = {query: o.query, kind: o.kind, orientation: o.format === 'short' ? 'portrait' : 'landscape'};
  for (const kinds of o.kind === 'video' ? [a, {...a, kind: 'photo' as const}] : [a]) { // a video query falls back to a photo when no keyed provider has one
    for (const p of PROVIDERS) {
      if (p.needsKey && !env[p.needsKey]) continue;
      const t = () => p.search(f, kinds, env);
      let hits: StockHit[] = [];
      try { hits = await t(); } catch { continue; } // a provider being down is never an error
      for (const hit of rank(hits, kinds, o.format).slice(0, 3)) {
        const file = await downloadHit(hit, f, dir, o.format);
        if (file) return {file, hit};
      }
    }
  }
  return null;
}

export type StockRecord = {scene: number; query: string; file: string; provider: string; pageUrl: string; author: string; license: string; title: string; kind: string};
/** Credit lines for the video description: one per distinct source that needs or deserves attribution. */
export function creditLines(items: StockRecord[]): string[] {
  const seen = new Set<string>();
  return items.flatMap(i => { const l = `${i.title ? `"${i.title.slice(0, 60)}" ` : ''}by ${i.author} (${i.license}) ${i.pageUrl}`; return seen.has(l) ? [] : (seen.add(l), [l]); });
}

/** Fetch stock for every scene with `stock`, write episodes/<id>/stock.json and return the records.
 *  Idempotent: a beat whose query is unchanged and whose file still exists keeps its record (so a "Swap image" choice survives re-runs).
 *  A beat without a result is skipped silently (procedural visuals stay). Progress goes to `o.progress(done, total, query)`. */
export async function stockForEpisode(epDir: string, scenes: {stock?: {query: string; kind: 'photo' | 'video'}}[], format: Format, o: {env?: Env; fetcher?: Fetcher; cacheDir?: string; log?: (m: string) => void; progress?: (done: number, total: number, query: string) => void} = {}): Promise<StockRecord[]> {
  const items: StockRecord[] = [], prev = readStock(epDir).items, total = scenes.filter(s => s.stock).length, cache = o.cacheDir ?? CACHE_DIR;
  let done = 0;
  for (const [i, s] of scenes.entries()) {
    if (!s.stock) continue;
    const keep = prev.find(x => x.scene === i && x.query === s.stock!.query && x.kind === s.stock!.kind && fs.existsSync(path.join(cache, path.basename(x.file))));
    const got = keep ? null : await fetchStock({query: s.stock.query, kind: s.stock.kind, format, env: o.env, fetcher: o.fetcher, cacheDir: o.cacheDir});
    o.progress?.(++done, total, s.stock.query);
    if (keep) { items.push(keep); continue; }
    if (!got) { o.log?.(`scene ${i + 1}: no licensed match for "${s.stock.query}", procedural visuals stay`); continue; }
    items.push({scene: i, query: s.stock.query, file: `stock-cache/${path.basename(got.file)}`, provider: got.hit.provider, pageUrl: got.hit.pageUrl, author: got.hit.author, license: got.hit.license, title: got.hit.title, kind: got.hit.kind});
  }
  fs.writeFileSync(path.join(epDir, 'stock.json'), JSON.stringify({items, credits: creditLines(items)}, null, 2));
  return items;
}

export const readStock = (epDir: string): {items: StockRecord[]; credits: string[]} => { try { return JSON.parse(fs.readFileSync(path.join(epDir, 'stock.json'), 'utf8')); } catch { return {items: [], credits: []}; } };
