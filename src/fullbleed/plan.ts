// Debug tool: what each beat gets and why. usage: npx tsx src/fullbleed/plan.ts <episodeId>
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../schema.js';
import {planEpisode} from './episodePlan.js';

const ep = loadEpisode(process.argv[2] ?? ''), dir = episodeDir(ep.id);
const dec = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
const words = ep.scenes.map((_, i) => { const d = dec.scenes[i], tm = tim.scenes[i]; return tm.words.map((w: any) => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart})); });
const plans = planEpisode(ep.scenes, words, dec.scenes.map((d: any) => d.durSec));
ep.scenes.forEach((s, i) => {
  const p = plans[i];
  console.log(`#${i + 1} ${s.type.padEnd(11)} ${p.layout.padEnd(8)} ${p.env.padEnd(8)} cam${p.camera} ${p.zoom.padEnd(5)} ${s.narration.slice(0, 55)}\n   ${p.shots.map(x => `${x.at.toFixed(1)}s ${x.kind}/${x.action} [${x.why ?? ''}]`).join('  ->  ')}${p.companion ? `  (companion ${p.companion})` : ''}`);
});
