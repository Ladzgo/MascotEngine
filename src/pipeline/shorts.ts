import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode} from '../schema.js';
import type {EpisodeDecisions} from '../director/types.js';
import type {Timings} from './tts.js';
import {loadCharacterAssets} from './render.js';
import {checkShort} from './shortsCheck.js';

const WEIGHT: Record<string, number> = {big_number: 5, compare: 4, chart: 3, list: 2, title: 1, talk: 1};
const MAX_SEC = 55;
const ROOT = new URL('../../', import.meta.url).pathname;

/** Native 1080x1920 Remotion "Short" per top scene; audio sliced from the final render. */
export async function shorts(idArg: string, count = 3) {
  const ep = loadEpisode(idArg);
  const dir = episodeDir(ep.id);
  const src = `${dir}build/${ep.id}-final.mp4`;
  if (!fs.existsSync(src)) throw new Error(`Render final first: ${src}`);
  const dec: EpisodeDecisions = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
  const timings: Timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
  // hook (scene 1) first, then one strong scene; at most `count` clips, each under MAX_SEC
  const hook = dec.scenes[0];
  const picks = dec.scenes
    .filter(s => s.index !== 0 && (WEIGHT[s.type] ?? 0) >= 2 && s.durSec + hook.durSec <= MAX_SEC)
    .sort((a, b) => (WEIGHT[b.type] ?? 0) - (WEIGHT[a.type] ?? 0) || a.index - b.index)
    .slice(0, count);
  if (!picks.length) { console.log('no suitable scenes'); return; }
  const outDir = `${dir}build/shorts/`;
  fs.mkdirSync(outDir, {recursive: true});
  const assets = loadCharacterAssets();
  const bundled = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  for (const s of picks) {
    const idx = [0, s.index];
    const out = `${outDir}${ep.id}-short-s${s.index + 1}-${s.type}.mp4`;
    const silent = `${outDir}.silent-${s.index}.mp4`;
    const inputProps = {episode: ep, timings, decisions: dec, assets, sceneIndexes: idx};
    const comp = await selectComposition({serveUrl: bundled, id: 'Short', inputProps});
    await renderMedia({composition: comp, serveUrl: bundled, codec: 'h264', outputLocation: silent, inputProps, muted: true, crf: 18, pixelFormat: 'yuv420p'});
    // audio: the same slices of the final mix, joined, with a short fade-out for a clean loop
    const segs = idx.map(i => dec.scenes[i]);
    const total = segs.reduce((a, x) => a + x.durSec, 0);
    const chains = segs.map((x, k) => `[0:a]atrim=${x.startSec}:${x.startSec + x.durSec},asetpts=PTS-STARTPTS[a${k}]`).join(';');
    const fc = `${chains};${segs.map((_, k) => `[a${k}]`).join('')}concat=n=${segs.length}:v=0:a=1,afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, total - 0.3).toFixed(3)}:d=0.3[a]`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-i', silent, '-filter_complex', fc, '-map', '1:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out]);
    fs.rmSync(silent, {force: true});
    console.log(`short: ${out}`);
    const rep = checkShort(out);
    for (const p of rep.problems) console.warn(`  check: ${p}`);
    if (rep.ok) console.log(`  check ok (loop diff ${rep.loopDelta.toFixed(1)}, hook coverage ${(rep.coverage.hook * 100).toFixed(0)}%)`);
  }
}
