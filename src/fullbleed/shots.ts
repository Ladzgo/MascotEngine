import {kindForWord, pickVisuals} from '../visuals/pick';
import {FB_FOR, OBJECTS} from './objects';

export type Shot = {kind: string; at: number}; // seconds from scene start
type W = {w: string; start: number; end: number};
const MIN_GAP = 1.5, MAX_SHOTS = 4;

/** Resolve an explicit `visuals` entry or a word to a full-bleed object name. */
export const objectFor = (kind: string): string => (OBJECTS[kind] ? kind : FB_FOR[kind] ?? 'coin_stacks');

/**
 * Shots inside one scene: 2-4 visuals that switch on word timestamps. Explicit `visuals` (with an `at` keyword) win; otherwise the
 * kind each spoken word points at (narration order), at least MIN_GAP apart, never the same object twice in a row. First shot is at 0.
 * `skip` = the previous scene's last object, so a new scene never opens on the picture the old one ended with.
 */
export function planShots(scene: {narration: string; emphasis: string[]; emotion: any; visual?: any; visuals?: {kind: string; at?: string}[]}, words: W[], durSec: number, o: {seed?: number; skip?: string} = {}): Shot[] {
  const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9%$'-]/g, '');
  const timeOf = (kw: string | undefined, fallback: number) => {
    if (!kw) return fallback;
    const k = clean(kw), w = words.find(x => clean(x.w) === k || clean(x.w).startsWith(k));
    return w ? Math.max(0, w.start) : fallback;
  };
  let shots: Shot[] = [];
  if (scene.visuals?.length) {
    const n = scene.visuals.length;
    shots = scene.visuals.map((v, i) => ({kind: objectFor(v.kind), at: i === 0 ? 0 : timeOf(v.at, (durSec * i) / n)}));
  } else {
    const hero = objectFor(pickVisuals(scene as any, '', o.seed ?? 0).hero);
    shots = [{kind: hero, at: 0}];
    for (const w of words) {
      const k = kindForWord(w.w);
      if (!k) continue;
      const obj = objectFor(k), last = shots[shots.length - 1];
      if (obj === last.kind || w.start - last.at < MIN_GAP || durSec - w.start < 1.0) continue;
      shots.push({kind: obj, at: w.start});
      if (shots.length >= MAX_SHOTS) break;
    }
  }
  shots.sort((a, b) => a.at - b.at);
  const out: Shot[] = [];
  for (const s of shots) if (!out.length || s.kind !== out[out.length - 1].kind) out.push(s);
  if (o.skip && out[0].kind === o.skip) { // never open on the previous scene's last picture
    const alt = out.length > 1 ? undefined : ['coin_stacks', 'skyline', 'percent', 'bars3d', 'clock'].find(k => k !== o.skip && k !== out[0].kind);
    if (alt) out[0] = {...out[0], kind: alt};
  }
  return out;
}

/** Last object a scene shows (used so the next scene never opens on it). */
export const pickFbKind = (scene: any, words: W[], durSec: number, index: number): string => planShots(scene, words, durSec, {seed: index}).at(-1)!.kind;
