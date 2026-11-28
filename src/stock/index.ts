import crypto from 'node:crypto';
import {withOllamaLock} from '../llm/ollamaLock.js';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {contentWords} from '../fullbleed/assetPick.js';
import {openverse, pexels, pixabay, setApiCacheDir, wikimedia, type Fetcher, type Query, type StockHit} from './providers.js';

const ROOT = new URL('../../', import.meta.url).pathname;
export const CACHE_DIR = `${ROOT}assets/stock-cache/`;
type Env = Record<string, string | undefined>;
export type Format = 'short' | 'wide';

// b-roll should not show faces, logos, brands or text: such hits rank last. In an episode (topic known) logos/text/posed fashion shots are
// dropped outright (the drawn subject is better); people stay possible (a sleep video needs a sleeping person), only ranked lower
const AVOID = /\b(person|people|man|woman|men|women|girl|boy|child|portrait|face|selfie|model|lady|fashion|cigarette|logo|brand|sign|text|poster|banner|screenshot|advert\w*)\b/i;
const HARD = /\b(selfie|model|fashion|cigarette|logo|brand|text|poster|banner|screenshot|advert\w*)\b/i;
// a cat or a baby matches "sleep" but not "person taking a nap": in an episode such hits need the query to ask for them
const OFF_SUBJECT = /\b(cats?|kitten|kitty|dogs?|puppy|pets?|animals?|baby|newborn|child|children|kids?|toys?|fantasy|cartoon|illustration)\b/i;
const VAGUE = new Set(['person', 'people', 'someone', 'man', 'woman']); // query filler: never counts as a matching word

/** Rank hits: right orientation, enough pixels, no faces/logos/text, then bigger. Hits below the minimum size are dropped. */
export function rank(hits: StockHit[], a: Query, format: Format, topic: string[] = []): StockHit[] {
  const minW = format === 'short' ? 720 : 1280, minH = format === 'short' ? 1280 : 720;
  const words = a.query.toLowerCase().split(/\W+/).filter(x => x.length > 2 && !VAGUE.has(x)).map(x => x.replace(/(ing|es|s)$/, ''));
  const wantsPeople = /\b(person|people|someone|man|woman|runner|worker|student|sleeping)\b/i.test(a.query); // "sleeping person bedroom" should find a person, not a cat
  const stem = (x: string) => x.replace(/(ing|es|s)$/, ''), overlap = (h: StockHit) => { const t = new Set(`${h.title} ${h.provider === 'pixabay' || h.provider === 'pexels' ? h.tags ?? '' : ''}`.toLowerCase().split(/\W+/).map(stem)); return words.filter(x => t.has(x)).length; }; // whole words only: 'sign' must not match 'design'
  const sized = hits.filter(h => h.url && (!h.width || !h.height || (h.kind === 'video' ? Math.max(h.width, h.height) >= 1280 : h.width >= minW * 0.9 && h.height >= minH * 0.9)));
  const scored = sized.map((h, idx) => ({h, ov: overlap(h), s: ((h.height >= h.width) === (a.orientation === 'portrait') ? 2 : h.kind === 'video' ? 1 : 0) + (h.kind === 'video' && h.duration ? (h.duration >= 8 ? 0.5 : h.duration < 5 ? -1 : 0) : 0) + (AVOID.test(`${h.title} ${h.tags ?? ''}`) && !wantsPeople ? -3 : 1) + Math.min(1, (h.width * h.height) / (minW * minH * 2)) + overlap(h) * 2.5 - idx * 0.15}));
  // a hit must share enough words with the query (half, at least one): an off-topic picture is worse than the drawn subject, so no match = no stock
  // and it must name the video's topic ("sleep", "credit"): a hand with a pen matches "hands writing" but says nothing about sleep (en-sleep)
  // with a topic, the match must come from the non-topic words: "sleep couch" -> a sailboat tagged "sleep" is not a couch
  // (prefix match both ways, 3+ letters: "bedroom" ~ "bed", "night" ~ "nightstand")
  const tw = topic.map(stem), subj = words.filter(x => !tw.includes(x)), subjOv = (h: StockHit) => { const t = `${h.title} ${h.tags ?? ''}`.toLowerCase().split(/\W+/).filter(x => x.length >= 3).map(stem); return subj.filter(x => t.some(y => y.startsWith(x) || x.startsWith(y))).length; };
  // an idea beat ("if you invested") may leave the topic: a hit naming EVERY word of a 2+ word concept query ("stock market screen") passes without the topic word
  const clean = (h: StockHit) => !HARD.test(`${h.title} ${h.tags ?? ''}`) && (!OFF_SUBJECT.test(`${h.title} ${h.tags ?? ''}`) || OFF_SUBJECT.test(a.query));
  const onTopic = (h: StockHit) => !tw.length || (clean(h) && (tw.some(w => new Set(`${h.title} ${h.tags ?? ''}`.toLowerCase().split(/\W+/).map(stem)).has(w)) || (subj.length >= 2 && subjOv(h) === subj.length)));
  // plain topic b-roll ("sleep"): the topic must be among the photo's first 3 tags (Pixabay orders tags by weight; a sailboat tagged "..., sleep" 5th is not sleep)
  const lead = (h: StockHit) => (h.tags ?? h.title).toLowerCase().split(',').slice(0, 3).some(x => tw.some(w => x.trim().split(/\s+/).map(stem).includes(w)));
  const need = words.length >= 3 ? 2 : 1, relevant = scored.filter(x => onTopic(x.h) && (tw.length && subj.length ? subjOv(x.h) >= (subj.length >= 3 ? 2 : 1) : (x.ov >= need || !words.length) && (!tw.length || lead(x.h))));
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
  // skip the first second of a longer clip (fade-ins, slates, the camera settling): the beat opens on the clip's moving part
  const len = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).stdout?.toString().trim()) || 0;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...(len >= 6 ? ['-ss', '1'] : []), '-stream_loop', '-1', '-i', raw, '-t', '20', '-an', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30`, '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', `${out}.part.mp4`]);
  if (r.status !== 0) { fs.rmSync(`${out}.part.mp4`, {force: true}); return raw; }
  fs.renameSync(`${out}.part.mp4`, out);
  return out;
}

export type Fetched = {file: string; hit: StockHit; score?: number};
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
const VLM_HOST = () => (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, ''), VLM_MODEL = () => process.env.VLM_MODEL ?? 'qwen2.5vl:7b';
export const VLM_MIN = 5, VLM_BUDGET = 10; // below 5 ("unrelated") a candidate is not used: the drawn subject is better than off-topic footage; at most 10 checks per beat, then the drawn subject stays
let vlmUp: boolean | undefined;
/** Is the local vision model there? Asked once per process. */
export async function vlmAvailable(): Promise<boolean> {
  if (vlmUp === undefined) try { const r = await fetch(`${VLM_HOST()}/api/tags`, {signal: AbortSignal.timeout(3000)}); vlmUp = r.ok && JSON.stringify(await r.json()).includes(VLM_MODEL().split(':')[0]); } catch { vlmUp = false; }
  return vlmUp;
}
/** Vision check of one candidate: its preview image, cropped to what the frame will show (centre 9:16 of a landscape clip in a Short), scored 0-10 against the
 *  sentence by the local model (same question as qa:semantic). Cached per (image, sentence) in <cache>/vlm/. null = could not check. */
export async function vlmScore(hit: StockHit, sentence: string, format: Format, dir: string, f: Fetcher = fetch): Promise<number | null> {
  if (!hit.thumb) return null;
  const key = crypto.createHash('sha1').update(`${hit.thumb}|${sentence}|${format}`).digest('hex').slice(0, 20), cf = path.join(dir, 'vlm', `${key}.json`);
  try { return JSON.parse(fs.readFileSync(cf, 'utf8')).score; } catch { /* not cached */ }
  try {
    const r = await f(hit.thumb, {signal: AbortSignal.timeout(30000)}); if (!r.ok) return null;
    fs.mkdirSync(path.dirname(cf), {recursive: true});
    const src = `${cf}.src`, png = `${cf}.png`; fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    const crop = format === 'short' ? 'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=-2:640' : 'crop=min(iw\\,ih*16/9):min(ih\\,iw*9/16),scale=640:-2';
    const c = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', crop, '-frames:v', '1', png]); fs.rmSync(src, {force: true});
    if (c.status !== 0) return null;
    const prompt = `This picture is b-roll in an explainer video. At this moment the narrator says: "${sentence}"\nDoes the picture illustrate what is said (the objects, people, place or action make sense for those words)? Reply with JSON only: {"score": integer 0-10 (0 = unrelated, 5 = loosely related, 10 = exactly what is described)}`;
    const res = await withOllamaLock('stock-vlm', () => fetch(`${VLM_HOST()}/api/chat`, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(240000),
      body: JSON.stringify({model: VLM_MODEL(), stream: false, keep_alive: '30s', format: 'json', options: {temperature: 0.1}, messages: [{role: 'user', content: prompt, images: [fs.readFileSync(png).toString('base64')]}]})}));
    fs.rmSync(png, {force: true});
    if (!res.ok) return null;
    const score = Math.max(0, Math.min(10, Number(JSON.parse(((await res.json()) as {message?: {content?: string}}).message?.content ?? '{}').score) || 0));
    fs.writeFileSync(cf, JSON.stringify({score, thumb: hit.thumb, sentence}));
    return score;
  } catch { return null; }
}

/** want: a vision score that ends the search at once (16:9 uses 7: a 5 is dropped there anyway); below it the search goes on and the best checked hit wins at the end. */
export async function fetchStock(o: {query: string; kind: 'photo' | 'video'; format: Format; env?: Env; fetcher?: Fetcher; cacheDir?: string; topic?: string[]; exclude?: Set<string>; sentence?: string; vlm?: boolean; want?: number; budget?: number; log?: (m: string) => void}): Promise<Fetched | null> {
  const f = o.fetcher ?? fetch, env = o.env ?? process.env, dir = o.cacheDir ?? CACHE_DIR, topic = o.topic ?? [];
  setApiCacheDir(path.join(dir, 'api'));
  const a: Query = {query: o.query, kind: o.kind, orientation: o.format === 'short' ? 'portrait' : 'landscape'};
  // later tries narrow toward the topic: "person taking nap couch" -> "woman nap couch" -> "sleep nap couch" -> "sleep couch" (Pixabay ANDs words;
  // its people photos are tagged woman/man, not person; helper verbs like "taking"/"using" only shrink the result)
  const who = o.query.length % 2 ? 'woman' : 'man', core = o.query.split(' ').filter(w => w && !VAGUE.has(w) && !topic.includes(w) && !/^(taking|using|doing|having|getting|making|holding)$/.test(w));
  const qs = topic[0] ? [o.query, ...(/\b(person|people|someone)\b/.test(o.query) ? [`${who} ${core.join(' ')}`] : []), `${topic[0]} ${core.slice(0, 2).join(' ')}`, `${topic[0]} ${core.at(-1) ?? ''}`, `${topic[0]} ${who}`, topic[0]] : [o.query];
  // the last two are plain topic b-roll ("sleep"): semantic QA scores an on-topic picture far above a drawn shield on an abstract sentence
  const tries = [...new Set(qs.map(x => x.trim()))].map(query => ({...a, query})).flatMap(x => (o.kind === 'video' ? [x, {...x, kind: 'photo' as const}] : [x])); // a video query falls back to a photo
  const keyed = PROVIDERS.some(p => p.needsKey && env[p.needsKey]);
  let checked = 0, best: {hit: StockHit; score: number} | undefined;
  const want = o.want ?? VLM_MIN, budget = o.budget ?? VLM_BUDGET;
  search: for (const kinds of tries) {
    for (const p of PROVIDERS) {
      if (p.needsKey && !env[p.needsKey]) continue;
      if (topic.length && keyed && !p.needsKey) continue; // with a Pixabay key the keyless archives only add paintings and plaques (en-sleep)
      const t = () => p.search(f, kinds, env);
      let hits: StockHit[] = [];
      try { hits = await t(); } catch { continue; } // a provider being down is never an error
      let cands = rank(hits, kinds, o.format, topic).filter(h => !o.exclude?.has(h.pageUrl)).slice(0, o.vlm && o.sentence ? 4 : 3); // one picture once per video
      const sc = new Map<StockHit, number>();
      if (o.vlm && o.sentence && cands.length) { // the vision model re-orders the top candidates by how well their frame shows the sentence and drops weak ones
        if (checked >= budget) break search;
        for (const h of cands) { const v = await vlmScore(h, o.sentence, o.format, dir, f); checked++; sc.set(h, v ?? VLM_MIN); }
        o.log?.(`  vlm "${kinds.query}" ${kinds.kind}: ${cands.map(h => sc.get(h)).join(', ')}`);
        cands = cands.filter(h => sc.get(h)! >= VLM_MIN).sort((x, y) => sc.get(y)! - sc.get(x)!);
        if (cands.length && sc.get(cands[0])! < want) { if (!best || sc.get(cands[0])! > best.score) best = {hit: cands[0], score: sc.get(cands[0])!}; continue; }
      }
      for (const hit of cands) {
        const file = await downloadHit(hit, f, dir, o.format);
        if (file) return {file, hit, ...(sc.has(hit) ? {score: sc.get(hit)} : {})};
      }
    }
  }
  const file = best && await downloadHit(best.hit, f, dir, o.format);
  return best && file ? {file, hit: best.hit, score: best.score} : null;
}

export type StockRecord = {scene: number; query: string; file: string; provider: string; pageUrl: string; author: string; license: string; title: string; kind: string; /** vision score 0-10 against the sentence, when checked */ score?: number};
/** Credit lines for the video description: one per distinct source that needs or deserves attribution. */
export function creditLines(items: StockRecord[]): string[] {
  const seen = new Set<string>();
  return items.flatMap(i => { const l = `${i.title ? `"${i.title.slice(0, 60)}" ` : ''}by ${i.author} (${i.license}) ${i.pageUrl}`; return seen.has(l) ? [] : (seen.add(l), [l]); });
}

/** Fetch stock for every scene with `stock`, write episodes/<id>/stock.json and return the records.
 *  Idempotent: a beat whose query is unchanged and whose file still exists keeps its record (so a "Swap image" choice survives re-runs).
 *  A beat without a result is skipped silently (procedural visuals stay). Progress goes to `o.progress(done, total, query)`. */
export async function stockForEpisode(epDir: string, scenes: {stock?: {query: string; kind: 'photo' | 'video'}; narration?: string; type?: string}[], format: Format, o: {env?: Env; fetcher?: Fetcher; cacheDir?: string; log?: (m: string) => void; progress?: (done: number, total: number, query: string) => void} = {}): Promise<StockRecord[]> {
  const items: StockRecord[] = [], prev = readStock(epDir).items, cache = o.cacheDir ?? CACHE_DIR, topic = topicWords(epDir);
  let done = 0;
  // vision check of candidates: on for real runs (no env passed, model pulled; STOCK_VLM=0 turns it off), opt-in (STOCK_VLM=1) when a caller passes its own env (tests)
  const vlm = (o.env ? o.env.STOCK_VLM === '1' : process.env.STOCK_VLM !== '0') && await vlmAvailable(), wide = format === 'wide' && vlm;
  // 16:9 with the vision check: a talk beat without a query searches its own sentence; only a match (>= 7) is kept, it plays full-frame (lf-inflation-fb: 59 of 90 beats had no query)
  const jobs = scenes.map(s => s.stock ?? (wide && s.type === 'talk' && autoQuery(s.narration ?? '') ? {query: autoQuery(s.narration ?? ''), kind: 'video' as const, auto: true} : undefined));
  const total = jobs.filter(Boolean).length;
  for (const [i, s] of scenes.entries()) {
    const st = jobs[i];
    if (!st) continue;
    const prior = prev.find(x => x.scene === i && x.query === st.query && x.kind === st.kind && fs.existsSync(path.join(cache, path.basename(x.file))));
    const keep = prior && !(wide && typeof prior.score === 'number' && prior.score < WIDE_WANT) ? prior : undefined; // 16:9 drops a 5 anyway: look again for a match
    const got0 = keep ? null : await fetchStock({query: st.query, kind: st.kind, format, env: o.env, fetcher: o.fetcher, cacheDir: o.cacheDir, topic, exclude: new Set(items.map(x => x.pageUrl)), sentence: s.narration, vlm, log: o.log, ...(wide ? {want: WIDE_WANT, budget: 16} : {})});
    o.progress?.(++done, total, st.query);
    if (keep) { // a kept record from before the vision check gets its score from the local file (16:9 uses it: >= 7 full-frame, <= 5 drawn hero)
      const lp = path.join(cache, path.basename(keep.file)), v = vlm && typeof keep.score !== 'number' && s.narration ? await vlmScore({thumb: lp} as StockHit, s.narration, format, cache, async u => new Response(fs.readFileSync(u))) : null;
      items.push(typeof v === 'number' ? {...keep, score: v} : keep); continue;
    }
    const got = got0 && (!prior || (got0.score ?? 0) > (prior.score ?? 0)) ? got0 : null;
    if (!got && prior) { items.push(prior); continue; }
    if (!got || ('auto' in st && (got.score ?? 0) < WIDE_WANT)) { o.log?.(`scene ${i + 1}: no licensed match for "${st.query}", procedural visuals stay`); continue; }
    items.push({scene: i, query: st.query, file: `stock-cache/${path.basename(got.file)}`, provider: got.hit.provider, pageUrl: got.hit.pageUrl, author: got.hit.author, license: got.hit.license, title: got.hit.title, kind: got.hit.kind, ...(typeof got.score === 'number' ? {score: got.score} : {})});
  }
  fs.writeFileSync(path.join(epDir, 'stock.json'), JSON.stringify({items, credits: creditLines(items)}, null, 2));
  return items;
}

const WIDE_WANT = 7;
/** A b-roll query from the sentence itself: its first three content words ("Imagine a king traveling with a camel train" -> "king traveling camel"). */
export const autoQuery = (t: string) => [...new Set(contentWords(t).filter(w => !/^(imagine|picture|think|remember|maybe|perhaps|means|equals|happened)$/.test(w)))].slice(0, 3).join(' ');
const TOPIC_STOP = new Set('your this that with what when why how does from into will about tricking really actually truth secret adds year years makes make costs cost every daily quietly'.split(' '));
/** The episode title's content words ("Sleep & Memory" -> sleep, memory): every stock hit must carry one of them. */
export function topicWords(epDir: string): string[] {
  let title = '';
  try { title = String(JSON.parse(fs.readFileSync(path.join(epDir, 'episode.json'), 'utf8')).title ?? ''); } catch { return []; }
  return title.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !TOPIC_STOP.has(w)).slice(0, 3);
}

export const readStock = (epDir: string): {items: StockRecord[]; credits: string[]} => { try { return JSON.parse(fs.readFileSync(path.join(epDir, 'stock.json'), 'utf8')); } catch { return {items: [], credits: []}; } };
