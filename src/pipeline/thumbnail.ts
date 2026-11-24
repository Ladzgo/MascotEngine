import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode} from '../schema.js';
import {loadCharacterAssets} from './render.js';
import {loadChannel} from '../channel/channel.js';
import {chromiumTuning} from './renderOpts.js';
import {MIN_THUMB_SIZE, thumbSize} from '../Thumbnail.js';

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
/** Question-style hook (variant C): the title's own question cut to 4 words, else the strongest keywords as a question. */
export function questionText(title: string, keywords: string): string {
  const w = clean(title);
  if (/^(why|how|what|is|are|does|do|can|should|will)$/i.test(w[0] ?? '')) return w.slice(0, 4).join(' ') + '?';
  return `${keywords.split(' ').slice(0, 2).join(' ')}?`;
}
export const thumbText = (dir: string, title: string) => thumbTexts(dir, title, 1)[0];

const POSE_BY_EMOTION: Record<string, string> = {shocked: 'shocked', worried: 'worried', sweating: 'sweating', smug: 'smug', excited: 'excited', happy: 'happy', angry: 'angry', sad: 'sad', confused: 'confused'};

/** Small-size legibility: luminance contrast of the text half at 150 px wide, plus how much of it is "ink" (the minority of dark/light pixels = the text). */
export function readability(file: string, variant: 'a' | 'b' | 'c' = 'a'): {contrast: number; ink: number; ok: boolean} {
  const W = 150, H = 84;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], {maxBuffer: 1 << 22});
  if (r.status !== 0) throw new Error('ffmpeg failed reading thumbnail');
  const g = r.stdout, px: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < Math.floor(W * 0.55); x++) px.push(g[y * W + x] / 255);
  const lum = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const s = [...px].sort((a, b) => a - b), q = (p: number) => lum(s[Math.floor(s.length * p)]);
  const contrast = (q(0.97) + 0.05) / (q(0.03) + 0.05);
  const dark = px.filter(v => v < 0.25).length / px.length, light = px.filter(v => v > 0.6).length / px.length;
  const ink = Math.min(dark, light); // text is the minority tone (dark on light or light on dark), the background does not count
  return {contrast: +contrast.toFixed(2), ink: +ink.toFixed(3), ok: contrast >= 4.5 && ink >= 0.06 || variant !== 'a' && contrast >= 3.5};
}

/** 0..1 legibility score at 150 px: contrast (capped at 15:1) 60%, ink share (capped at 20%) 40%; not-ok variants lose 0.5. */
export const thumbScore = (r: {contrast: number; ink: number; ok: boolean}) => Math.min(r.contrast, 15) / 15 * 0.6 + Math.min(r.ink, 0.2) / 0.2 * 0.4 - (r.ok ? 0 : 0.5);

/** Free local still render: episodes/<id>/build/thumbnail.png (variant A) and thumbnail-b.png (B) when variants >= 2. */
export async function makeThumbnail(id: string, text?: string, variants = 1): Promise<string> {
  const ep = loadEpisode(id), dir = episodeDir(ep.id);
  let accent = 'violet';
  try { accent = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')).accent || accent; } catch { /* not directed yet */ }
  try { accent = loadChannel(ep.channel ?? 'default').accent || accent; } catch { /* channel gone: keep episode accent */ } // channel accent = consistent branding
  const hook = ep.scenes.find(s => s.emotion !== 'neutral');
  const pose = POSE_BY_EMOTION[hook?.emotion ?? ''] ?? 'shocked';
  const texts = text ? [text, text, questionText(text, text)] : thumbTexts(dir, ep.title, 2);
  if (!text) texts[2] = questionText(ep.title, texts[0]);
  const assets = loadCharacterAssets();
  const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  fs.mkdirSync(`${dir}build`, {recursive: true});
  const names = ['a', 'b', 'c'] as const, results: {variant: string; file: string; text: string; contrast: number; ink: number; ok: boolean; score: number}[] = [];
  for (let i = 0; i < Math.min(3, Math.max(1, variants)); i++) {
    const variant = names[i];
    const props = {text: texts[i] ?? texts[0], accent, pose: variant === 'c' ? 'confused' : pose, assets, variant};
    const comp = await selectComposition({serveUrl, id: 'Thumbnail', inputProps: props});
    const out = `${dir}build/thumbnail-${variant}.png`;
    await renderStill({composition: comp, serveUrl, output: out, inputProps: props, frame: 0, chromiumOptions: chromiumTuning()});
    const px = thumbSize(variant, props.text);
    if (px < MIN_THUMB_SIZE) console.log(`thumbnail ${variant.toUpperCase()}: headline is only ${px}px (long word); use a shorter hook for small-screen legibility`);
    const rd = readability(out, variant);
    results.push({variant, file: out, text: props.text, ...rd, score: +thumbScore(rd).toFixed(3)});
    console.log(`thumbnail ${variant.toUpperCase()} "${props.text}": contrast ${rd.contrast}:1, ink ${(rd.ink * 100).toFixed(0)}% at 150px ${rd.ok ? 'ok' : 'WEAK'} score ${thumbScore(rd).toFixed(2)}`);
  }
  const best = results.reduce((a, b) => (b.score > a.score ? b : a));
  fs.copyFileSync(best.file, `${dir}build/thumbnail.png`);
  fs.writeFileSync(`${dir}build/thumbnail.json`, JSON.stringify({best: best.variant, variants: results.map(({file, ...r}) => ({...r, file: path.basename(file)}))}, null, 2));
  if (results.length > 1) console.log(`best: variant ${best.variant.toUpperCase()} -> thumbnail.png (all variants: thumbnail-a/b/c.png, scores in thumbnail.json)`);
  return `${dir}build/thumbnail.png`;
}
