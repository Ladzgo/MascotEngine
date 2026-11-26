/** Licensed stock providers. Keyless: Openverse, Wikimedia Commons (CC0 / public domain / CC BY only). Optional keys: PIXABAY_API_KEY (recommended), PEXELS_API_KEY (Pexels paused new keys; kept for existing ones). */
export type StockHit = {
  id: string; provider: 'pexels' | 'pixabay' | 'openverse' | 'wikimedia'; kind: 'photo' | 'video';
  url: string; width: number; height: number; pageUrl: string; author: string; license: string; title: string; tags?: string;
};
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type Query = {query: string; kind: 'photo' | 'video'; orientation: 'portrait' | 'landscape'};
type Env = Record<string, string | undefined>;

const j = async (f: Fetcher, url: string, init?: RequestInit): Promise<any> => {
  const r = await f(url, {...init, signal: init?.signal ?? AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).hostname}`);
  return r.json();
};
const q = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
const strip = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, '').trim();

export async function pexels(f: Fetcher, a: Query, env: Env): Promise<StockHit[]> {
  const key = env.PEXELS_API_KEY; if (!key) return [];
  const h = {headers: {Authorization: key}};
  if (a.kind === 'video') {
    const d = await j(f, `https://api.pexels.com/videos/search?${q({query: a.query, orientation: a.orientation, per_page: 12})}`, h);
    return (d.videos ?? []).flatMap((v: any) => {
      const file = (v.video_files ?? []).filter((x: any) => /mp4/.test(x.file_type ?? '') && x.width >= 720).sort((p: any, o: any) => Math.abs(p.width - 1080) - Math.abs(o.width - 1080))[0];
      return file ? [{id: `pexels-v${v.id}`, provider: 'pexels', kind: 'video', url: file.link, width: file.width, height: file.height, pageUrl: v.url, author: v.user?.name ?? 'Pexels', license: 'Pexels License', title: strip(v.url.split('/').filter(Boolean).pop())} as StockHit] : [];
    });
  }
  const d = await j(f, `https://api.pexels.com/v1/search?${q({query: a.query, orientation: a.orientation, per_page: 15})}`, h);
  return (d.photos ?? []).map((p: any): StockHit => ({id: `pexels-${p.id}`, provider: 'pexels', kind: 'photo', url: p.src?.large2x ?? p.src?.large ?? p.src?.original, width: p.width, height: p.height, pageUrl: p.url, author: p.photographer ?? 'Pexels', license: 'Pexels License', title: strip(p.alt)}));
}

/** Pixabay allows 100 requests per 60 s: a sliding window in this process waits instead of tripping the limit. */
const sent: number[] = [];
async function pixabayGate(now = () => Date.now(), sleep = (ms: number) => new Promise(r => setTimeout(r, ms))) {
  for (;;) {
    const t = now(); while (sent.length && t - sent[0] > 60000) sent.shift();
    if (sent.length < 95) { sent.push(t); return; } // 5 spare for other tools sharing the key
    await sleep(sent[0] + 60000 - t + 50);
  }
}
export const pixabayGateForTests = pixabayGate;
export const resetPixabayGate = () => { sent.length = 0; };

/** Cheap key check for the Studio "Test key" button. */
export async function testPixabayKey(key: string, f: Fetcher = fetch): Promise<{ok: boolean; message: string}> {
  try {
    await pixabayGate();
    const r = await f(`https://pixabay.com/api/?${q({key, q: 'coins', per_page: 3, safesearch: 'true'})}`, {signal: AbortSignal.timeout(10000)});
    if (r.status === 429) return {ok: false, message: 'Rate limit reached (100 requests per minute). Try again in a minute.'};
    if (r.status === 400 || r.status === 401 || r.status === 403) return {ok: false, message: 'Pixabay rejected this key. Copy it again from pixabay.com/api/docs.'};
    if (!r.ok) return {ok: false, message: `Pixabay answered HTTP ${r.status}.`};
    const d: any = await r.json();
    return {ok: true, message: `Key works (${d.totalHits ?? 0} results for a test search).`};
  } catch (e) { return {ok: false, message: `Could not reach Pixabay: ${(e as Error).message}`}; }
}

export async function pixabay(f: Fetcher, a: Query, env: Env): Promise<StockHit[]> {
  const key = env.PIXABAY_API_KEY; if (!key) return [];
  const o = a.orientation === 'portrait' ? 'vertical' : 'horizontal';
  if (a.kind === 'video') {
    await pixabayGate();
    const d = await j(f, `https://pixabay.com/api/videos/?${q({key, q: a.query, per_page: 12, video_type: 'film', safesearch: 'true'})}`);
    return (d.hits ?? []).flatMap((v: any) => { const x = v.videos?.large?.url ? v.videos.large : v.videos?.medium; return x?.url ? [{id: `pixabay-v${v.id}`, provider: 'pixabay', kind: 'video', url: x.url, width: x.width, height: x.height, pageUrl: v.pageURL, author: v.user ?? 'Pixabay', license: 'Pixabay License', title: strip(v.tags), tags: v.tags} as StockHit] : []; });
  }
  await pixabayGate();
  const d = await j(f, `https://pixabay.com/api/?${q({key, q: a.query, image_type: 'photo', orientation: o, per_page: 15, safesearch: 'true'})}`);
  return (d.hits ?? []).map((p: any): StockHit => ({id: `pixabay-${p.id}`, provider: 'pixabay', kind: 'photo', url: p.largeImageURL, width: p.imageWidth, height: p.imageHeight, pageUrl: p.pageURL, author: p.user ?? 'Pixabay', license: 'Pixabay License', title: strip(p.tags), tags: p.tags}));
}

export async function openverse(f: Fetcher, a: Query): Promise<StockHit[]> {
  if (a.kind === 'video') return [];
  const d = await j(f, `https://api.openverse.org/v1/images/?${q({q: a.query, license: 'cc0,pdm,by', page_size: 15, aspect_ratio: a.orientation === 'portrait' ? 'tall' : 'wide', mature: 'false'})}`);
  return (d.results ?? []).map((p: any): StockHit => ({id: `openverse-${p.id}`, provider: 'openverse', kind: 'photo', url: p.url, width: p.width ?? 0, height: p.height ?? 0, pageUrl: p.foreign_landing_url ?? p.url, author: p.creator ?? 'unknown', license: p.license === 'cc0' ? 'CC0' : p.license === 'pdm' ? 'Public Domain Mark' : `CC BY${p.license_version ? ' ' + p.license_version : ''}`, title: strip(p.title), tags: (p.tags ?? []).map((t: any) => t.name).join(' ')}));
}

const OK_LICENSE = /^(cc0|public domain|pd\b|cc[- ]by[- ]?\d)/i; // CC BY-SA/NC/ND are not used: attribution only, no share-alike surprises
export async function wikimedia(f: Fetcher, a: Query): Promise<StockHit[]> {
  if (a.kind === 'video') return [];
  const d = await j(f, `https://commons.wikimedia.org/w/api.php?${q({action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `filetype:bitmap ${a.query}`, gsrnamespace: 6, gsrlimit: 15, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: a.orientation === 'portrait' ? 1200 : 1920})}`);
  return Object.values<any>(d.query?.pages ?? {}).flatMap(p => {
    const ii = p.imageinfo?.[0], m = ii?.extmetadata ?? {}, lic = strip(m.LicenseShortName?.value);
    if (!ii || !OK_LICENSE.test(lic) || /-sa\b|-nc|-nd/i.test(lic)) return [];
    return [{id: `wikimedia-${p.pageid}`, provider: 'wikimedia', kind: 'photo', url: ii.thumburl ?? ii.url, width: ii.thumbwidth ?? ii.width, height: ii.thumbheight ?? ii.height, pageUrl: ii.descriptionurl, author: strip(m.Artist?.value) || 'unknown', license: lic, title: strip(p.title).replace(/^File:/, ''), tags: strip(m.ImageDescription?.value)} as StockHit];
  });
}
