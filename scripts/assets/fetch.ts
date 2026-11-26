// npx tsx scripts/assets/fetch.ts [--only fluent,noto,peeps,bg,pixabay]
// Downloads the free asset library into assets/lib/ (gitignored) and rewrites src/assets/catalog.json (committed).
// Sources (all free, commercial use allowed): Microsoft Fluent Emoji 3D (MIT), Google Noto animated emoji (Lottie, CC BY 4.0),
// Open Peeps + Notionists via DiceBear (CC0), procedural SVG backdrops (original), Pixabay background loops (Pixabay licence, key needed).
// Sources that are skipped or fail keep their previous catalog entries. Network only here: CI and tests read catalog.json.
try { process.loadEnvFile(); } catch { /* .env optional */ }
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {Asset} from '../../src/assets/catalog.js';
import {pixabay} from '../../src/stock/providers.js';
import {backdrops} from './backdrops.js';

const ROOT = `${path.resolve(new URL('../../', import.meta.url).pathname)}/`;
const LIB = `${ROOT}assets/lib/`, SRC = `${ROOT}data/asset-src/`, CAT = `${ROOT}src/assets/catalog.json`;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : ['fluent', 'noto', 'peeps', 'bg', 'pixabay'];
for (const d of [LIB, SRC]) { fs.mkdirSync(d, {recursive: true}); if (!fs.existsSync(`${d}.gitignore`)) fs.writeFileSync(`${d}.gitignore`, '*\n'); }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function download(url: string, file: string): Promise<boolean> {
  if (fs.existsSync(file)) return true;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(30000)});
      if (!r.ok) { if (r.status === 404) return false; throw new Error(`HTTP ${r.status}`); }
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(`${file}.part`, Buffer.from(await r.arrayBuffer())); fs.renameSync(`${file}.part`, file);
      return true;
    } catch { await sleep(1000 * (t + 1)); }
  }
  return false;
}
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) { let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < items.length) await fn(items[i++]); })); }

const PEOPLE = /Smileys|People/, ANIMAL = /Animals/;
async function fluent(): Promise<Asset[]> {
  const dir = `${SRC}fluent/`;
  if (!fs.existsSync(dir)) execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', 'https://github.com/microsoft/fluentui-emoji.git', dir]);
  execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', '--no-cone', '/assets/*/metadata.json', '/assets/*/3D/*', '/assets/*/Default/3D/*', '/LICENSE']);
  const out: Asset[] = [];
  for (const name of fs.readdirSync(`${dir}assets`).sort()) {
    const d = `${dir}assets/${name}/`;
    if (!fs.existsSync(`${d}metadata.json`)) continue;
    const m = JSON.parse(fs.readFileSync(`${d}metadata.json`, 'utf8')) as {cldr?: string; glyph?: string; group?: string; keywords?: string[]};
    const png = [`${d}3D/`, `${d}Default/3D/`].filter(x => fs.existsSync(x)).flatMap(x => fs.readdirSync(x).filter(f => f.endsWith('.png')).map(f => x + f))[0];
    if (!png || m.group === 'Flags') continue;
    const id = `fluent-${slug(name)}`, file = `lib/fluent/${slug(name)}.png`;
    fs.mkdirSync(`${LIB}fluent`, {recursive: true}); fs.copyFileSync(png, `${ROOT}assets/${file}`);
    const animal = ANIMAL.test(m.group ?? '') && !/plant|flower|tree|leaf|herb|cactus|blossom|rose|tulip|sunflower|hibiscus|seedling|mushroom|shamrock|clover|maple|bouquet|lotus|nest|coral|feather/i.test(name);
    out.push({id, file, kind: PEOPLE.test(m.group ?? '') || animal ? 'character' : 'object', tags: [m.cldr ?? name, ...(m.keywords ?? []), m.group ?? ''].filter(Boolean),
      license: 'MIT', attribution: 'Fluent Emoji by Microsoft (MIT)', source: 'fluent', format: 'image', glyph: m.glyph});
  }
  return out;
}

async function noto(): Promise<Asset[]> {
  const api = (await (await fetch('https://googlefonts.github.io/noto-emoji-animation/data/api.json')).json()) as {icons: {codepoint: string; categories: string[]; tags: string[]}[]};
  // names come from the Fluent metadata when present (same unicode), else the :tag:
  const names = new Map<string, {name: string; keywords: string[]}>();
  const fdir = `${SRC}fluent/assets/`;
  if (fs.existsSync(fdir)) for (const n of fs.readdirSync(fdir)) { try { const m = JSON.parse(fs.readFileSync(`${fdir}${n}/metadata.json`, 'utf8')); names.set(String(m.unicode).replace(/ /g, '_'), {name: m.cldr ?? n, keywords: m.keywords ?? []}); } catch { /* no metadata */ } }
  const out: Asset[] = [];
  await pool(api.icons, 8, async ic => {
    const cp = ic.codepoint, file = `lib/noto/${cp}.json`;
    if (!(await download(`https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/lottie.json`, `${ROOT}assets/${file}`))) return;
    const nm = names.get(cp);
    out.push({id: `noto-${cp}`, file, kind: 'animated', tags: [nm?.name ?? '', ...(nm?.keywords ?? []), ...ic.tags.map(t => t.replace(/:/g, '').replace(/[-_]/g, ' ')), ...ic.categories].filter(Boolean),
      license: 'CC-BY-4.0', attribution: 'Noto Emoji Animation by Google (CC BY 4.0)', source: 'noto', format: 'lottie',
      glyph: String.fromCodePoint(...cp.split('_').map(h => parseInt(h, 16)))});
  });
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// DiceBear's CC0 styles; seeds are words so every person gets tags (mood + a first name for anecdote beats)
const MOODS = ['happy', 'calm', 'serious', 'surprised', 'worried', 'smiling', 'thinking', 'confident'];
const NAMES = 'anna ben clara david emma finn grace hugo ivy jack kate leo mia noah olivia paul quinn rosa sam tara uma victor wendy xavier yara zoe adam bella carl diana eric fiona george hana ian julia kevin lena mark nina oscar'.split(' ');
async function peeps(): Promise<Asset[]> {
  const styles = [{style: 'open-peeps', n: 120, attribution: 'Open Peeps by Pablo Stanley (CC0), via DiceBear'}, {style: 'notionists', n: 80, attribution: 'Notionists by Zoish (CC0), via DiceBear'}, {style: 'lorelei', n: 40, attribution: 'Lorelei by Lisa Wischofsky (CC0), via DiceBear'}];
  const out: Asset[] = [];
  for (const s of styles) {
    const jobs = Array.from({length: s.n}, (_, i) => ({i, name: NAMES[i % NAMES.length], mood: MOODS[i % MOODS.length]}));
    await pool(jobs, 4, async ({i, name, mood}) => {
      const seed = `${name}-${mood}-${i}`, file = `lib/people/${s.style}-${seed}.svg`;
      if (!(await download(`https://api.dicebear.com/9.x/${s.style}/svg?seed=${encodeURIComponent(seed)}`, `${ROOT}assets/${file}`))) return;
      out.push({id: `${s.style}-${seed}`, file, kind: 'character', tags: ['person', 'people', 'face', name, mood, s.style.replace('-', ' ')], license: 'CC0-1.0', attribution: s.attribution, source: s.style, format: 'image'});
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function bg(): Asset[] {
  return backdrops().map(b => {
    const file = `lib/bg/${b.id}.svg`;
    fs.mkdirSync(`${LIB}bg`, {recursive: true}); fs.writeFileSync(`${ROOT}assets/${file}`, b.svg);
    return {id: `bg-${b.id}`, file, kind: 'background', tags: b.tags, license: 'CC0-1.0', attribution: 'Procedural backdrop (original, MascotEngine)', source: 'procedural', format: 'image'};
  });
}

// Pixabay serves up to 4K: keep a 720x1280, 10 s, silent loop (~2-5 MB) because the whole assets/ folder is copied into every render bundle
function shrink(file: string): boolean {
  const done = `${file}.small`;
  if (fs.existsSync(done)) return true;
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-t', '10', '-an', '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30', '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${file}.tmp.mp4`]);
    fs.renameSync(`${file}.tmp.mp4`, file); fs.writeFileSync(done, '');
    return true;
  } catch { fs.rmSync(`${file}.tmp.mp4`, {force: true}); return false; }
}
const LOOPS = ['abstract background loop', 'bokeh background', 'gradient background', 'particles background', 'light rays', 'clouds timelapse', 'city night lights', 'ocean waves', 'money falling', 'stock market screen', 'office blur', 'kitchen blur', 'forest sunlight', 'rain window', 'neon lights', 'smoke background', 'snow falling', 'fire embers', 'starry sky', 'technology network'];
async function pixabayLoops(): Promise<Asset[]> {
  if (!process.env.PIXABAY_API_KEY) { console.log('pixabay: no PIXABAY_API_KEY, skipped'); return []; }
  const out: Asset[] = [];
  for (const q of LOOPS) {
    let hits: Awaited<ReturnType<typeof pixabay>> = [];
    try { hits = await pixabay(fetch, {query: q, kind: 'video', orientation: 'portrait'}, process.env); } catch (e) { console.log(`pixabay "${q}": ${(e as Error).message}`); continue; }
    for (const h of hits.slice(0, 4)) {
      const file = `lib/loops/${h.id}.mp4`;
      if (out.some(a => a.file === file) || !(await download(h.url, `${ROOT}assets/${file}`))) continue;
      if (!shrink(`${ROOT}assets/${file}`)) continue;
      out.push({id: h.id, file, kind: 'background', tags: [...q.split(' '), ...(h.tags ?? '').split(/,\s*/), 'loop', 'video'].filter(Boolean),
        license: 'Pixabay', attribution: `${h.author} on Pixabay (${h.pageUrl})`, source: 'pixabay', format: 'video'});
    }
  }
  return out;
}

const prev: Asset[] = fs.existsSync(CAT) ? JSON.parse(fs.readFileSync(CAT, 'utf8')) : [];
const steps: [string, string[], () => Asset[] | Promise<Asset[]>][] = [['fluent', ['fluent'], fluent], ['noto', ['noto'], noto], ['peeps', ['open-peeps', 'notionists', 'lorelei'], peeps], ['bg', ['procedural'], bg], ['pixabay', ['pixabay'], pixabayLoops]];
let all: Asset[] = [];
for (const [key, sources, fn] of steps) {
  const old = prev.filter(a => sources.includes(a.source));
  if (!only.includes(key)) { all.push(...old); continue; }
  try { const got = await fn(); all.push(...(got.length ? got : old)); console.log(`${key}: ${got.length} assets`); }
  catch (e) { all.push(...old); console.log(`${key} failed (${(e as Error).message.slice(0, 120)}); kept ${old.length} previous entries`); }
}
all = all.map(a => ({...a, tags: [...new Set(a.tags.map(t => t.toLowerCase().trim()).filter(Boolean))]}));
fs.writeFileSync(CAT, JSON.stringify(all, null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log(`catalog: ${all.length} assets -> src/assets/catalog.json`, all.reduce((m, a) => ({...m, [a.kind]: (m[a.kind] ?? 0) + 1}), {} as Record<string, number>));
