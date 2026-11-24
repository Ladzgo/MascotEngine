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

/** `caps` = transparent caption video from captions.ts (null = no captions). */
export function renderClip(file: string, clip: Clip, outFile: string, caps: string | null = null): void {
  const dur = clip.end - clip.start;
  {
    const x = ffmpegXExpr(clip.crop.path);
    const af = loudnormFilter(file, clip.start, dur);
    const v = `[0:v]crop=${clip.crop.w}:${clip.crop.h}:x='${x}':y=0,scale=1080:1920,setsar=1,format=yuv420p`;
    const fc = caps ? `${v}[b];[1:v]format=rgba[c];[b][c]overlay=0:H-h-340:shortest=1[v]` : `${v}[v]`;
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(clip.start), '-t', String(dur), '-i', file,
      ...(caps ? ['-i', caps] : []),
      '-filter_complex', fc, '-map', '[v]', '-map', '0:a:0', '-af', af, '-t', String(dur),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', outFile]);
  }
}
