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

/** Estimated spoken seconds of a scene at 160 wpm (scene-length cap check before TTS exists). */
export const estSec = (s: {narration: string}, wpm = 160) => s.narration.trim().split(/\s+/).filter(Boolean).length * 60 / wpm;
