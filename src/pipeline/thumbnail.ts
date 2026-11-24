import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode} from '../schema.js';
import {loadCharacterAssets} from './render.js';
import {chromiumTuning} from './renderOpts.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const FILLER = new Set('a an the of to in on at for and or but is are was were be it its this that with as by from you your they them their we our so if than then there here do does did will would can could how why what who when which just really very about into over'.split(' '));

const clean = (t: string) => t.trim().replace(/[^\p{L}\p{N}$%'\s-]/gu, '').split(/\s+/).filter(Boolean);

/**
 * Thumbnail hook candidates (2-3 words, strongest first): publish-pack suggestions, else keywords of the title
 * (numbers/money first, filler dropped). Always returns at least `n` distinct strings.
 */
export function thumbTexts(dir: string, title: string, n = 2): string[] {
  const out: string[] = [];
  const add = (w: string[]) => { const t = w.slice(0, 3).join(' '); if (t && !out.includes(t)) out.push(t); };
  try {
    const t = JSON.parse(fs.readFileSync(`${dir}build/publish.json`, 'utf8')).thumbnailText;
    if (Array.isArray(t)) t.filter((x): x is string => typeof x === 'string').forEach(x => add(clean(x)));
  } catch { /* no pack yet */ }
  const kw = clean(title).filter(w => !FILLER.has(w.toLowerCase()));
  const num = kw.filter(w => /\d|\$|%/.test(w));
  add([...num, ...kw.filter(w => !num.includes(w))].slice(0, 3));
  add(kw.slice(-3));
  add(kw.slice(0, 2));
  add(clean(title).slice(0, 3));
  return out.slice(0, Math.max(n, 1));
}
export const thumbText = (dir: string, title: string) => thumbTexts(dir, title, 1)[0];

const POSE_BY_EMOTION: Record<string, string> = {shocked: 'shocked', worried: 'worried', sweating: 'sweating', smug: 'smug', excited: 'excited', happy: 'happy', angry: 'angry', sad: 'sad', confused: 'confused'};

/** Small-size legibility: luminance contrast of the text half at 150 px wide, plus how much of it is "ink" (not mid-tone mush). */
export function readability(file: string, variant: 'a' | 'b' = 'a'): {contrast: number; ink: number; ok: boolean} {
  const W = 150, H = 84;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], {maxBuffer: 1 << 22});
  if (r.status !== 0) throw new Error('ffmpeg failed reading thumbnail');
  const g = r.stdout, px: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < Math.floor(W * 0.55); x++) px.push(g[y * W + x] / 255);
  const lum = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const s = [...px].sort((a, b) => a - b), q = (p: number) => lum(s[Math.floor(s.length * p)]);
  const contrast = (q(0.97) + 0.05) / (q(0.03) + 0.05);
  const ink = px.filter(v => v < 0.25).length / px.length;
  return {contrast: +contrast.toFixed(2), ink: +ink.toFixed(3), ok: contrast >= 4.5 && ink >= 0.06 || variant === 'b' && contrast >= 3.5};
}

/** Free local still render: episodes/<id>/build/thumbnail.png (variant A) and thumbnail-b.png (B) when variants >= 2. */
export async function makeThumbnail(id: string, text?: string, variants = 1): Promise<string> {
  const ep = loadEpisode(id), dir = episodeDir(ep.id);
  let accent = 'violet';
  try { accent = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')).accent || accent; } catch { /* not directed yet */ }
  const hook = ep.scenes.find(s => s.emotion !== 'neutral');
  const pose = POSE_BY_EMOTION[hook?.emotion ?? ''] ?? 'shocked';
  const texts = text ? [text, text] : thumbTexts(dir, ep.title, 2);
  const assets = loadCharacterAssets();
  const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  fs.mkdirSync(`${dir}build`, {recursive: true});
  let first = '';
  for (let i = 0; i < Math.min(2, Math.max(1, variants)); i++) {
    const variant = i ? 'b' as const : 'a' as const;
    const props = {text: texts[i] ?? texts[0], accent, pose, assets, variant};
    const comp = await selectComposition({serveUrl, id: 'Thumbnail', inputProps: props});
    const out = `${dir}build/thumbnail${i ? '-b' : ''}.png`;
    await renderStill({composition: comp, serveUrl, output: out, inputProps: props, frame: 0, chromiumOptions: chromiumTuning()});
    const rd = readability(out, variant);
    console.log(`thumbnail ${variant.toUpperCase()} "${props.text}": contrast ${rd.contrast}:1, ink ${(rd.ink * 100).toFixed(0)}% at 150px ${rd.ok ? 'ok' : 'WEAK'}`);
    first ||= out;
  }
  return first;
}
