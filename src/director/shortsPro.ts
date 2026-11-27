import {spoken} from '../pipeline/speech.js';
import type {Episode} from '../schema.js';

type Sc = Episode['scenes'][number] & {visuals?: {kind: string; at?: string}[]; visual?: {kind: string}};
const firstKind = (s: Sc) => s.visuals?.[0]?.kind ?? s.visual?.kind;
const lastKind = (s: Sc) => s.visuals?.at(-1)?.kind ?? s.visual?.kind;

/** shorts-pro: never the same visual kind in consecutive beats. Rotates a multi-visual beat, else drops the pick so the renderer chooses from the narration. */
export function spreadVisuals(ep: Episode): {ep: Episode; fixed: number} {
  let fixed = 0;
  const scenes = (ep.scenes as Sc[]).map(x => ({...x}));
  for (let i = 1; i < scenes.length; i++) {
    const k = firstKind(scenes[i]), prev = lastKind(scenes[i - 1]);
    if (!k || k !== prev) continue;
    fixed++;
    const v = scenes[i].visuals;
    if (v && v.length > 1) scenes[i].visuals = [...v.slice(1), v[0]];
    else { delete scenes[i].visuals; delete scenes[i].visual; }
  }
  return {ep: {...ep, scenes: scenes as Episode['scenes']}, fixed};
}

/** Drop the longest plain talk beats (never the hook or the last two) until the estimated read fits `maxSec`. */
export function fitDuration(ep: Episode, maxSec = 52): {ep: Episode; dropped: number} {
  const scenes = [...ep.scenes];
  let dropped = 0;
  const total = () => scenes.reduce((a, s) => a + estSec(s) + SCENE_PAD, 0);
  while (total() > maxSec && scenes.length > 8) {
    const cand = scenes.map((s, i) => ({s, i})).filter(({s, i}) => s.type === 'talk' && !(s as {quote?: unknown}).quote && i >= 2 && i < scenes.length - 2).sort((a, b) => estSec(b.s) - estSec(a.s))[0];
    if (!cand) break;
    scenes.splice(cand.i, 1); dropped++;
  }
  return {ep: {...ep, scenes: scenes as Episode['scenes']}, dropped};
}

/** Spoken seconds of a scene before TTS exists: spoken words ("$1,825" = six) at 164 wpm, the kokoro rate with in-scene pauses at speed 0.83-0.94 (zzb-h3: 101 words, 11 beats, 40.9 s real). */
export const estSec = (s: {narration: string}, wpm = 164) => spoken(s.narration).split(/\s+/).filter(Boolean).length * 60 / wpm;
/** Lead, tail and gap per scene, measured on rendered Shorts (0.35-0.37 s). */
export const SCENE_PAD = 0.36;
