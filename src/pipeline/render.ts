import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions, type Episode} from '../schema.js';
import type {Timings} from './tts.js';
import type {EpisodeDecisions} from '../director/types.js';
import type {CharacterAssets} from '../character/Mascot.js';
import {buildPhrases, toSrt} from '../fx/captions.js';
import {mixAudio} from './audio.js';
import {chromiumTuning} from './renderOpts.js';
import {chunkKeys, chunkRanges, codeHash} from './renderCache.js';
import {frameLayout, ENDCARD_FRAMES} from '../Episode.js';

const ROOT = new URL('../../', import.meta.url).pathname;

/** Asset loader: assets/character/<pose>.png (+ _talk, _blink) overrides the placeholder per pose. */
export function loadCharacterAssets(): CharacterAssets {
  const dir = `${ROOT}assets/character/`;
  const out: CharacterAssets = {};
  if (!fs.existsSync(dir)) return out;
  let manifest: Record<string, {file?: string; talk?: string}> = {};
  try { manifest = JSON.parse(fs.readFileSync(`${dir}manifest.json`, 'utf8')).poses ?? {}; } catch { /* optional */ }
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^([a-z_]+?)\.png$/);
    if (!m || m[1].endsWith('_talk') || m[1].endsWith('_blink')) continue;
    const pose = m[1];
    const talk = `${pose}_talk.png`;
    out[pose] = {file: `character/${manifest[pose]?.file ?? f}`, talk: fs.existsSync(dir + talk) ? `character/${manifest[pose]?.talk ?? talk}` : undefined};
  }
  return out;
}

/**
 * Art backdrops: episodes/<id>/art/scene-N.png (N = 1-based scene number, exact file names only).
 * Returns the episode with scene.art set (public-relative) and a public dir = assets + art/, or the plain assets dir when there is no art.
 */
export function withArt(ep: Episode, dir: string): {episode: Episode; publicDir: string; cleanup: () => void} {
  const artSrc = path.join(dir, 'art');
  const found = ep.scenes.map((_, i) => `scene-${i + 1}.png`).map(f => {
    const p = path.join(artSrc, f);
    return fs.existsSync(p) && fs.lstatSync(p).isFile() ? f : null;
  });
  if (!found.some(Boolean)) return {episode: ep, publicDir: `${ROOT}assets`, cleanup: () => {}};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-'));
  fs.cpSync(`${ROOT}assets`, tmp, {recursive: true, dereference: true});
  fs.mkdirSync(path.join(tmp, 'art'), {recursive: true});
  for (const f of found) if (f) fs.copyFileSync(path.join(artSrc, f), path.join(tmp, 'art', f));
  return {
    episode: {...ep, scenes: ep.scenes.map((s, i) => (found[i] ? {...s, art: `art/${found[i]}`} : s)) as Episode['scenes']},
    publicDir: tmp, cleanup: () => fs.rmSync(tmp, {recursive: true, force: true}),
  };
}

export async function render(idArg: string, mode: 'preview' | 'final') {
  const ep0 = loadEpisode(idArg);
  const dir = episodeDir(ep0.id);
  const {episode: ep, publicDir, cleanup} = withArt(ep0, dir);
  const timings: Timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
  const decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')) as EpisodeDecisions;
  const assets = loadCharacterAssets();
  const fps = 30;

  let bundled: string;
  try { bundled = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir}); } finally { cleanup(); } // bundle holds its own copy
  const inputProps = {episode: ep, timings, decisions, assets};
  const comp = await selectComposition({serveUrl: bundled, id: 'Episode', inputProps});

  const silent = `${dir}build/video-${mode}.mp4`;
  const scale = mode === 'preview' ? 2 / 3 : 1; // 1280x720 preview, 1920x1080 final
  const L = frameLayout(decisions, fps);
  const bodyFrames = L.ends[L.ends.length - 1];
  const endCard = ep.disclaimer && ep.format !== 'short';
  const totalFrames = bodyFrames + (endCard ? ENDCARD_FRAMES : 0);
  const common = {
    composition: comp, serveUrl: bundled, codec: 'h264' as const, inputProps,
    scale, muted: true, crf: mode === 'final' ? 18 : 24, pixelFormat: 'yuv420p' as const, chromiumOptions: chromiumTuning(), ...(mode === 'preview' ? {x264Preset: 'veryfast' as const} : {}),
  };
  const ranges = process.env.RENDER_CACHE === '0' ? null : chunkRanges(L, totalFrames, !!endCard);
  if (!ranges) {
    let lastPct = -1;
    await renderMedia({...common, outputLocation: silent, onProgress: ({progress}) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastPct) { lastPct = pct; process.stdout.write(`render ${pct}%\n`); }
    }});
  } else {
    // scene chunks: unchanged chunks come from episodes/<id>/build/chunks/<mode>/<key>.mp4, the rest are rendered (one shared browser) and the lot is concatenated losslessly
    const cdir = `${dir}build/chunks/${mode}/`;
    fs.mkdirSync(cdir, {recursive: true});
    const keys = chunkKeys({ranges, layout: L, episode: ep, decisions, timings, code: codeHash(ROOT), mode, extra: [assets, process.env.RENDER_GL ?? '']});
    const todo = ranges.map((r, i) => ({r, file: `${cdir}${keys[i]}.mp4`})).filter(x => !fs.existsSync(x.file));
    const framesTodo = todo.reduce((a, x) => a + x.r.to - x.r.from + 1, 0);
    console.log(`render cache: ${ranges.length - todo.length}/${ranges.length} chunks reused, ${framesTodo}/${totalFrames} frames to render`);
    if (todo.length) {
      const browser = await openBrowser('chrome', {chromiumOptions: chromiumTuning()});
      let done = 0, lastPct = -1;
      try {
        for (const x of todo) {
          const base = done;
          await renderMedia({...common, puppeteerInstance: browser, frameRange: [x.r.from, x.r.to], outputLocation: `${x.file}.part.mp4`, onProgress: ({renderedFrames}) => {
            const pct = Math.floor(((base + renderedFrames) / framesTodo) * 10) * 10;
            if (pct !== lastPct) { lastPct = pct; process.stdout.write(`render ${pct}%\n`); }
          }});
          fs.renameSync(`${x.file}.part.mp4`, x.file);
          done += x.r.to - x.r.from + 1;
        }
      } finally { await browser.close({silent: true}).catch(() => {}); }
    }
    const list = `${cdir}.concat.txt`;
    fs.writeFileSync(list, keys.map(k => `file '${cdir}${k}.mp4'`).join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
    const keep = new Set(keys.map(k => `${k}.mp4`)); // drop chunks of older versions
    for (const f of fs.readdirSync(cdir)) if (f.endsWith('.mp4') && !keep.has(f)) fs.rmSync(`${cdir}${f}`, {force: true});
  }

  const totalSec = totalFrames / fps;
  const wav = await mixAudio(dir, ep, decisions, timings, totalSec);

  const out = `${dir}build/${ep.id}-${mode}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out]);

  // captions as .srt
  const phrases = buildPhrases(decisions.scenes.map((d, i) => timings.scenes[i].words.map(w => ({
    w: w.w, start: d.startSec + w.start - timings.scenes[i].start + d.speechStart, end: d.startSec + w.end - timings.scenes[i].start + d.speechStart,
  }))));
  fs.writeFileSync(`${dir}build/${ep.id}.srt`, toSrt(phrases));
  console.log(`done: ${out}  (${totalSec.toFixed(1)}s)`);
}
