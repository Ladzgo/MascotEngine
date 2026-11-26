// Camera zoom per beat (QA "motion" bar: one visible move at a time, stock clips still-framed, photo move <= 4.5%, drawn push <= 6%, small sub-shot cuts).
//   npx tsx scripts/qa/zoom.ts <episode-id>
// Computed from the renderer's own camera functions (stageCamera/stockMove/SUB_FRAMES via beatZoom), so a code change that stacks zooms again fails QA.
// Measuring it from frames was tried and rejected: captions, titles and moving footage swamp a 4% Ken Burns (ep011: a 17% stock zoom read as 0%).
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../../src/schema.js';
import {beatZoom} from '../../src/fullbleed/FullBleedScene.js';
import {planEpisode} from '../../src/fullbleed/episodePlan.js';

export const ZOOM_LIMITS = {move: 0.062, photo: 0.046, cut: 0.05, layers: 1}; // |log scale|: drawn push, photo Ken Burns, scale jump at a sub-shot cut, layers zooming at once

export type BeatZoomRow = {beat: number; kind: 'drawn' | 'photo' | 'video'; move: number; cut: number; layers: number; over: string[]};
export function zoomRows(id: string): BeatZoomRow[] {
  const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
  const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${b}timings.json`, 'utf8'));
  let stock: {scene: number; file: string}[] = [];
  try { stock = JSON.parse(fs.readFileSync(`${dir}stock.json`, 'utf8')).items ?? []; } catch { /* no stock */ }
  const scenes = ep.scenes.map((s, i) => ({...s, stockFile: stock.find(x => x.scene === i)?.file}));
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
