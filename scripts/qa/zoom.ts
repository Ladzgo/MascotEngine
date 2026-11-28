// Camera zoom per beat (QA "motion" bar: one visible move at a time, stock clips still-framed, photo move <= 4.5%, drawn push <= 6%, small sub-shot cuts).
//   npx tsx scripts/qa/zoom.ts <episode-id>
// Computed from the renderer's own camera functions (stageCamera/stockMove/SUB_FRAMES via beatZoom), so a code change that stacks zooms again fails QA.
// A plain frame diff of the video was rejected (captions, titles and moving footage swamp a 4% Ken Burns); zoomFrames.ts measures the rendered layers with marker squares.
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../../src/schema.js';
import {beatZoom, subShots} from '../../src/fullbleed/FullBleedScene.js';
import {planEpisode, wideStockDrop} from '../../src/fullbleed/episodePlan.js';

/** Scenes with their stock clip as the renderer shows it (a weak 16:9 clip is dropped for a drawn hero). */
const withStock = (ep: ReturnType<typeof loadEpisode>, stock: {scene: number; file: string; score?: number}[]) => ep.scenes.map((s, i) => {
  const it = stock.find(x => x.scene === i), x = {...s, stockFile: it?.file, stockScore: it?.score};
  return wideStockDrop(x, ep.format === 'wide') ? {...x, stockFile: undefined} : x;
});

export const ZOOM_LIMITS = {move: 0.062, photo: 0.046, cut: 0.05, layers: 1}; // |log scale|: drawn push, photo Ken Burns, scale jump at a sub-shot cut, layers zooming at once

/** Visible picture changes per beat as the renderer plays them: its planned shots, or its sub-shot framing cuts when those are more (beats with callouts/cards
 *  and clip footage hold their framing). QA's change rate counted only the raw shot planner and missed both (ep017 3.3 s). */
export function visualChanges(id: string): number[] {
  const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
  const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${b}timings.json`, 'utf8'));
  let stock: {scene: number; file: string}[] = [];
  try { stock = JSON.parse(fs.readFileSync(`${dir}stock.json`, 'utf8')).items ?? []; } catch { /* no stock */ }
  const scenes = withStock(ep, stock);
  const words = scenes.map((_, i) => { const d = dec.scenes[i], tm = tim.scenes[i]; return (tm?.words ?? []).map((w: any) => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart})); });
  const plans = planEpisode(scenes, words, dec.scenes.map((d: any) => d.durSec));
  return scenes.map((s, i) => {
    const holds = /\.mp4$/i.test(s.stockFile ?? '') || ['list', 'checklist', 'stats', 'table', 'timeline', 'compare', 'before_after'].includes(s.type);
    return Math.max(plans[i].shots.length, holds ? 1 : subShots(dec.scenes[i].durSec));
  });
}

export type BeatZoomRow = {beat: number; kind: 'drawn' | 'photo' | 'video'; move: number; cut: number; layers: number; over: string[]};
export function zoomRows(id: string): BeatZoomRow[] {
  const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
  const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${b}timings.json`, 'utf8'));
  let stock: {scene: number; file: string}[] = [];
  try { stock = JSON.parse(fs.readFileSync(`${dir}stock.json`, 'utf8')).items ?? []; } catch { /* no stock */ }
  const scenes = withStock(ep, stock);
  const words = scenes.map((_, i) => { const d = dec.scenes[i], tm = tim.scenes[i]; return (tm?.words ?? []).map((w: any) => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart})); });
  const plans = planEpisode(scenes, words, dec.scenes.map((d: any) => d.durSec));
  return scenes.map((s, i) => {
    const kind = !s.stockFile ? 'drawn' : /\.mp4$/i.test(s.stockFile) ? 'video' : 'photo';
    const z = beatZoom({mv: plans[i].camera, close: plans[i].zoom === 'close', index: i, stockFile: s.stockFile, fixedStage: false, dur: dec.scenes[i].durSec});
    const over = [
      ...(z.move > (kind === 'photo' ? ZOOM_LIMITS.photo : kind === 'video' ? 0.001 : ZOOM_LIMITS.move) ? [`move ${(z.move * 100).toFixed(1)}%`] : []),
      ...(z.cut > ZOOM_LIMITS.cut ? [`cut ${(z.cut * 100).toFixed(1)}%`] : []), ...(z.layers > ZOOM_LIMITS.layers ? [`${z.layers} layers zoom`] : []),
    ];
    return {beat: i + 1, kind, ...z, over};
  });
}

if (process.argv[1]?.endsWith('zoom.ts')) {
  const rows = zoomRows(process.argv[2] ?? '');
  for (const r of rows) console.log(`beat ${String(r.beat).padStart(2)} ${r.kind.padEnd(5)} move ${(r.move * 100).toFixed(1).padStart(4)}%  cut ${(r.cut * 100).toFixed(1).padStart(4)}%  layers ${r.layers}  ${r.over.join(', ')}`);
  console.log(`zoom: mean move ${(rows.reduce((a, r) => a + r.move, 0) / rows.length * 100).toFixed(1)}%, max move ${(Math.max(...rows.map(r => r.move)) * 100).toFixed(1)}%, max cut ${(Math.max(...rows.map(r => r.cut)) * 100).toFixed(1)}%, beats over: ${rows.filter(r => r.over.length).length}`);
}
