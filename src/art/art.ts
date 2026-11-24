import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import type {Episode, Scene} from '../schema.js';
import {ACCENT_HEX} from '../accents.js';

export type GenOpts = {width: number; height: number; seed?: number};
export interface ImageProvider {
  name: string;
  model: string;
  generate(prompt: string, o: GenOpts): Promise<Buffer>;
}
export type ManifestEntry = {index: number; prompt: string; provider: string; model: string; file: string; createdAt: string};
export type Manifest = {scenes: ManifestEntry[]};
type F = typeof fetch;

export const DEFAULT_MODEL = 'gpt-image-1';
export class MissingKeyError extends Error {}

export function styleBlock(accent?: string): string {
  const col = accent ? `ONE single accent colour ${accent}` : 'no accent colour, black ink only';
  return `Style: hand-drawn ink illustration on paper, off-white #f6f1e4 background, black wobbly outlines, flat limited palette, ${col}, no text, no letters, no numbers, no people faces, no logos, no brands. Keep the central and lower-left area empty and calm so overlay text stays readable.`;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Scene content -> subject line. Only generic concepts: the style block forbids faces, logos and brands. */
export function buildPrompt(scene: Scene, accent?: string): string {
  const parts: string[] = [];
  switch (scene.type) {
    case 'title': parts.push('Opening illustration, a bold simple symbolic scene'); break;
    case 'talk': parts.push('Simple symbolic background illustration'); break;
    case 'big_number': parts.push(`Illustration of the concept: ${clean(scene.label)}`); break;
    case 'chart': parts.push(`Illustration of the topic behind a ${scene.chart.kind} chart: ${clean(scene.chart.yLabel) || clean(scene.chart.labels.join(', '))}`); break;
    case 'compare': parts.push(`Illustration contrasting two ideas: ${clean(scene.left.title)} versus ${clean(scene.right.title)}`); break;
    case 'list': parts.push(`Illustration of objects hinting at: ${scene.items.map(clean).join(', ')}`); break;
  }
  parts.push(`Narration context: ${clean(scene.narration).replace(/[.!?]+$/, '')}`);
  return `${parts.join('. ')}.\n${styleBlock(accent)}`;
}

export function artDir(episodesRoot: string, id: string) { return path.join(episodesRoot, id, 'art'); }
export const artFile = (index: number) => `scene-${index + 1}.png`; // 1-based, as in the CLI

export function readManifest(dir: string): Manifest {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    if (Array.isArray(m?.scenes)) return m;
  } catch { /* none yet */ }
  return {scenes: []};
}

export function accentFor(episodesRoot: string, id: string): string | undefined {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(episodesRoot, id, 'build', 'decisions.json'), 'utf8'));
    const a = typeof d.accent === 'string' ? d.accent : '';
    return a ? (ACCENT_HEX[a] ?? (/^#[0-9a-f]{6}$/i.test(a) ? a : undefined)) : undefined;
  } catch { return undefined; }
}

export function parseScenes(arg: string | undefined, count: number): number[] {
  if (!arg) return Array.from({length: count}, (_, i) => i);
  const out = [...new Set(arg.split(',').map(s => Number(s.trim())))];
  for (const n of out) if (!Number.isInteger(n) || n < 1 || n > count) throw new Error(`Invalid scene number "${n}" (1-${count})`);
  return out.sort((a, b) => a - b).map(n => n - 1);
}

export type Plan = {index: number; prompt: string; file: string; cached: boolean};

export function plan(ep: Episode, dir: string, indices: number[], accent?: string): Plan[] {
  const man = readManifest(dir);
  return indices.map(index => {
    const prompt = buildPrompt(ep.scenes[index], accent);
    const file = artFile(index);
    const prev = man.scenes.find(s => s.index === index);
    return {index, prompt, file, cached: !!prev && prev.prompt === prompt && fs.existsSync(path.join(dir, file))};
  });
}

/** Cover-scale then centre-crop to exactly 1920x1080 (ffmpeg). */
export function fitTo1080(buf: Buffer): Buffer {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'art-'));
  try {
    fs.writeFileSync(path.join(tmp, 'in.img'), buf);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'in.img'), '-vf',
      'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080', '-frames:v', '1', path.join(tmp, 'out.png')]);
    return fs.readFileSync(path.join(tmp, 'out.png'));
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

export type RunOpts = {
  ep: Episode; episodesRoot: string; provider: ImageProvider; indices: number[]; budget?: number;
  accent?: string; fit?: (b: Buffer) => Buffer; now?: () => string; log?: (m: string) => void;
};

export async function runArt(o: RunOpts): Promise<{generated: number[]; skipped: number[]; dir: string}> {
  const dir = artDir(o.episodesRoot, o.ep.id);
  fs.mkdirSync(dir, {recursive: true});
  const man = readManifest(dir);
  const generated: number[] = [], skipped: number[] = [];
  const log = o.log ?? (() => {});
  for (const p of plan(o.ep, dir, o.indices, o.accent)) {
    if (p.cached) { skipped.push(p.index); log(`scene ${p.index + 1}: cached`); continue; }
    if (o.budget !== undefined && generated.length >= o.budget) { log(`scene ${p.index + 1}: skipped (budget ${o.budget})`); continue; }
    const raw = await o.provider.generate(p.prompt, {width: 1536, height: 1024, seed: o.ep.seed + p.index});
    fs.writeFileSync(path.join(dir, p.file), (o.fit ?? fitTo1080)(raw));
    const entry: ManifestEntry = {index: p.index, prompt: p.prompt, provider: o.provider.name, model: o.provider.model, file: p.file, createdAt: (o.now ?? (() => new Date().toISOString()))()};
    man.scenes = [...man.scenes.filter(s => s.index !== p.index), entry].sort((a, b) => a.index - b.index);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(man, null, 2) + '\n'); // saved per image so a crash keeps paid work
    generated.push(p.index);
    log(`scene ${p.index + 1}: generated`);
  }
  return {generated, skipped, dir};
}

// ---------------------------------------------------------------- providers
export function requireKey(env: string, e: NodeJS.ProcessEnv = process.env): string {
  const v = e[env];
  if (!v) throw new MissingKeyError(`${env} is missing. Add it in Settings.`);
  return v;
}

export function openaiProvider(e: NodeJS.ProcessEnv = process.env, f: F = fetch): ImageProvider {
  const key = requireKey('OPENAI_API_KEY', e);
  const model = e.ART_MODEL || DEFAULT_MODEL;
  return {
    name: 'openai', model,
    async generate(prompt, o) {
      const size = o.width >= o.height ? '1536x1024' : '1024x1536';
      const r = await f('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({model, prompt, size, n: 1}),
      });
      if (!r.ok) throw new Error(`OpenAI Images ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j: any = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, 'base64');
      const url = j?.data?.[0]?.url;
      if (!url) throw new Error('OpenAI Images: no image in response');
      return Buffer.from(await (await f(url)).arrayBuffer());
    },
  };
}

export function replicateProvider(e: NodeJS.ProcessEnv = process.env, f: F = fetch, sleep = (ms: number) => new Promise(r => setTimeout(r, ms))): ImageProvider {
  const key = requireKey('REPLICATE_API_TOKEN', e);
  const model = e.ART_MODEL;
  if (!model) throw new MissingKeyError('ART_MODEL is missing. Add it in Settings.');
  const h = {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'};
  return {
    name: 'replicate', model,
    async generate(prompt, o) {
      const input: Record<string, unknown> = {prompt, aspect_ratio: o.width >= o.height ? '16:9' : '9:16'};
      if (o.seed !== undefined) input.seed = o.seed;
      let r = await f(`https://api.replicate.com/v1/models/${model}/predictions`, {method: 'POST', headers: {...h, Prefer: 'wait'}, body: JSON.stringify({input})});
      if (!r.ok) throw new Error(`Replicate ${r.status}: ${(await r.text()).slice(0, 300)}`);
      let j: any = await r.json();
      for (let i = 0; i < 60 && (j.status === 'starting' || j.status === 'processing'); i++) {
        await sleep(2000);
        r = await f(j.urls.get, {headers: h});
        if (!r.ok) throw new Error(`Replicate ${r.status}`);
        j = await r.json();
      }
      if (j.status !== 'succeeded') throw new Error(`Replicate prediction ${j.status}: ${String(j.error ?? '').slice(0, 200)}`);
      const url = Array.isArray(j.output) ? j.output[0] : j.output;
      if (typeof url !== 'string') throw new Error('Replicate: no image in output');
      const img = await f(url);
      if (!img.ok) throw new Error(`Replicate download ${img.status}`);
      return Buffer.from(await img.arrayBuffer());
    },
  };
}

export function selectProvider(e: NodeJS.ProcessEnv = process.env, f: F = fetch): ImageProvider | null {
  const p = (e.ART_PROVIDER || 'none').toLowerCase();
  if (p === 'none') return null;
  if (p === 'openai') return openaiProvider(e, f);
  if (p === 'replicate') return replicateProvider(e, f);
  throw new Error(`Unknown ART_PROVIDER "${p}" (openai|replicate|none)`);
}
