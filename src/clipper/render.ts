import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {Clip} from './timeline.js';
import {ffmpegXExpr} from './smooth.js';

const run = (bin: string, args: string[]) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 1 << 26});
  if (r.status !== 0) throw new Error(`${bin} failed: ${(r.stderr || '').slice(-400)}`);
  return r.stderr;
};
const hasBin = (b: string) => spawnSync('sh', ['-c', `command -v ${b}`], {stdio: 'ignore'}).status === 0;

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

/** Caption frames (one PNG per active word, 3-word chunks) as a concat list; null when ImageMagick is missing. */
function captionList(clip: Clip, dir: string): string | null {
  if (!hasBin('magick')) return null;
  const dur = clip.end - clip.start;
  const lines: string[] = [];
  const blank = path.join(dir, 'blank.png');
  run('magick', ['-size', '1080x260', 'xc:none', blank]);
  const add = (f: string, d: number) => { if (d > 0.001) lines.push(`file '${f}'`, `duration ${d.toFixed(3)}`); };
  const ws = clip.words.map(w => ({w: w.w, s: w.start - clip.start, e: w.end - clip.start}));
  add(blank, ws[0]?.s ?? dur);
  ws.forEach((w, i) => {
    const c0 = i - (i % 3), chunk = ws.slice(c0, c0 + 3);
    const img = path.join(dir, `c${i}.png`);
    const parts = chunk.flatMap((cw, k) => ['(', '-background', 'none', '-fill', c0 + k === i ? '#FFD400' : 'white', '-stroke', 'black', '-strokewidth', '7', '-font', 'Helvetica-Bold', '-pointsize', '84', `label:${cw.w.toUpperCase().replace(/^@/, '\\@')}`, '-bordercolor', 'none', '-border', '12x0', ')']);
    run('magick', [...parts, '+append', '-gravity', 'center', '-background', 'none', '-extent', '1080x260', img]);
    const next = ws[i + 1];
    add(img, (next && next.s - w.e < 0.6 ? next.s : w.e + 0.15) - w.s);
    if (next && next.s - w.e >= 0.6) add(blank, next.s - w.e - 0.15);
  });
  add(blank, 0.1);
  const lst = path.join(dir, 'caps.txt');
  fs.writeFileSync(lst, lines.join('\n') + '\n');
  return lst;
}

export function renderClip(file: string, clip: Clip, outFile: string): void {
  const dur = clip.end - clip.start;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
  try {
    const caps = captionList(clip, tmp);
    const x = ffmpegXExpr(clip.crop.path);
    const af = loudnormFilter(file, clip.start, dur);
    const v = `[0:v]crop=${clip.crop.w}:${clip.crop.h}:x='${x}':y=0,scale=1080:1920,setsar=1,format=yuv420p`;
    const fc = caps ? `${v}[b];[1:v]format=rgba[c];[b][c]overlay=0:H-h-330:shortest=1[v]` : `${v}[v]`;
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(clip.start), '-t', String(dur), '-i', file,
      ...(caps ? ['-f', 'concat', '-safe', '0', '-i', caps] : []),
      '-filter_complex', fc, '-map', '[v]', '-map', '0:a:0', '-af', af, '-t', String(dur),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', outFile]);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
