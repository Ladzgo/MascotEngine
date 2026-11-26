// Automatic re-choice for beats the vision model scored too low: stock footage is dropped (the drawn subject takes over), a drawn subject is swapped
// for another one the sentence points at, else for a neighbour in its group. Pure: returns the changed episode JSON and a log line per change.
import {candidatesFor} from './shots.js';
import {GROUPS} from './catalog.js';
import {OBJECTS} from './objects.js';

type Raw = {scenes: {narration: string; stock?: unknown; shot?: {subject?: string}; visuals?: {kind: string}[]}[]};
export const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

export function reselect<T extends Raw>(ep: T, items: {scene: number; score: number}[], below = 6): {ep: T; log: string[]} {
  const log: string[] = [], scenes = ep.scenes.map(s => ({...s}));
  for (const {scene, score} of items) {
    if (score >= below) continue;
    const i = scene - 1, s = scenes[i];
    if (!s) continue;
    if (s.stock) { delete s.stock; log.push(`#${scene} (${score}): stock dropped, drawn subject stays`); continue; }
    const cur = s.shot?.subject, near = new Set(scenes.slice(Math.max(0, i - 6), i + 7).map(x => x.shot?.subject));
    const words = s.narration.split(/\s+/), group = Object.values(GROUPS).find(g => cur && g.includes(cur)) ?? [];
    const pick = [...words.flatMap(w => candidatesFor(w)), ...group].find(k => OBJECTS[k] && k !== cur && !near.has(k));
    if (!pick) { log.push(`#${scene} (${score}): no better subject found`); continue; }
    s.shot = {...s.shot, subject: pick};
    if (s.visuals?.length) s.visuals = [{kind: pick}];
    log.push(`#${scene} (${score}): ${cur} -> ${pick}`);
  }
  return {ep: {...ep, scenes}, log};
}
