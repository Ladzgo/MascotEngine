import {spawnSync} from 'node:child_process';
import type {Clip} from './timeline.js';
import {ffmpegXExpr} from './smooth.js';

const run = (bin: string, args: string[]) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 1 << 26});
  if (r.status !== 0) throw new Error(`${bin} failed: ${(r.stderr || '').slice(-400)}`);
  return r.stderr;
};

const AF = 'highpass=f=80';
const LOUD = 'I=-14:TP=-1.5:LRA=11';

/** Two-pass loudnorm (measure, then linear apply) so the result lands on -14 LUFS. */
function loudnormFilter(file: string, start: number, dur: number): string {
  const log = run('ffmpeg', ['-hide_banner', '-ss', String(start), '-t', String(dur), '-i', file, '-vn', '-af', `${AF},loudnorm=${LOUD}:print_format=json`, '-f', 'null', '-']);
  const m = log.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) return `${AF},loudnorm=${LOUD}`;
  const j = JSON.parse(m[0]);
  if (!Number.isFinite(parseFloat(j.input_i))) return `${AF},loudnorm=${LOUD}`; // silent clip
  return `${AF},loudnorm=${LOUD}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
}

export type BrandLayers = {watermark: string | null; cta: string | null; outroSec: number};

/** `caps` = transparent caption video from captions.ts (null = no captions). `brand` = watermark/end-card PNGs: the end card extends the clip by outroSec (last frame held, audio padded with silence). */
export function renderClip(file: string, clip: Clip, outFile: string, caps: string | null = null, brand: BrandLayers | null = null): void {
  const dur = clip.end - clip.start;
  const outro = brand?.cta ? brand.outroSec : 0, total = dur + outro;
  const x = ffmpegXExpr(clip.crop.path);
  const af = loudnormFilter(file, clip.start, dur) + (outro ? `,apad=pad_dur=${outro}` : '');
  const inputs = ['-ss', String(clip.start), '-t', String(dur), '-i', file];
  let n = 1;
  const add = (...a: string[]) => { inputs.push(...a); return n++; };
  const capsIdx = caps ? add('-i', caps) : -1;
  const wmIdx = brand?.watermark ? add('-loop', '1', '-framerate', '30', '-t', String(total), '-i', brand.watermark) : -1;
  const ctaIdx = outro ? add('-loop', '1', '-framerate', '30', '-t', String(total), '-i', brand!.cta!) : -1;
  const chain: string[] = [`[0:v]crop=${clip.crop.w}:${clip.crop.h}:x='${x}':y=0,scale=1080:1920,setsar=1,format=yuv420p${outro ? `,tpad=stop_mode=clone:stop_duration=${outro}` : ''}[v0]`];
  let cur = 'v0';
  const over = (idx: number, extra: string, tag: string, pre = '') => { chain.push(`${pre}[${cur}][${tag}]overlay=${extra}[${tag}o]`); cur = `${tag}o`; void idx; };
  if (capsIdx >= 0) { chain.push(`[${capsIdx}:v]format=rgba[cap]`); over(capsIdx, '0:H-h-340:eof_action=pass', 'cap'); }
  if (wmIdx >= 0) { chain.push(`[${wmIdx}:v]format=rgba[wm]`); over(wmIdx, '0:0:eof_action=pass', 'wm'); }
  if (ctaIdx >= 0) { chain.push(`[${ctaIdx}:v]format=rgba,fade=t=in:st=${dur}:d=0.35:alpha=1[cta]`); over(ctaIdx, '0:0:eof_action=pass', 'cta'); }
  run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', chain.join(';'), '-map', `[${cur}]`, '-map', '0:a:0', '-af', af, '-t', String(total),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', outFile]);
}
