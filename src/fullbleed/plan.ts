// Debug tool: which object does each beat of an episode get, and why. usage: npx tsx src/fullbleed/plan.ts <episodeId>
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../schema.js';
import {planShots} from './shots.js';

const ep = loadEpisode(process.argv[2] ?? ''), dir = episodeDir(ep.id);
const dec = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
let prev: string | undefined;
ep.scenes.forEach((s, i) => {
  const d = dec.scenes[i], tm = tim.scenes[i];
  const words = tm.words.map((w: any) => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart}));
  const shots = planShots(s as any, words, d.durSec, {seed: i, skip: prev});
  prev = shots.at(-1)!.kind;
  console.log(`#${i + 1} ${s.type.padEnd(11)} ${s.narration.slice(0, 60)}\n   ${shots.map(x => `${x.at.toFixed(1)}s ${x.kind} [${x.why ?? ''}]`).join('  ->  ')}`);
});
