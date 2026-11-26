import type {Episode} from '../schema.js';

type Sc = Episode['scenes'][number];
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const MAX_BEAT = 22; // words (about 8 s spoken): longer talk scenes become several beats

/**
 * Storyboard split: a long talk scene becomes consecutive beats of one or two sentences, each a scene of its own
 * (new picture, new illustration pick, fresh caption block). Text is only cut at sentence ends, never rewritten.
 * The hook (scene 1), the closing scene, quotes and every non-talk scene are left alone.
 */
export function splitBeats(ep: Episode): Episode {
  const last = ep.scenes.length - 1;
  const out: Sc[] = [];
  ep.scenes.forEach((s, i) => {
    const sents = s.narration.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g)?.map(x => x.trim()).filter(Boolean) ?? [];
    if (s.type !== 'talk' || s.quote || i === 0 || i === last || sents.length < 2 || wc(s.narration) <= MAX_BEAT) { out.push(s); return; }
    const groups: string[][] = [[]];
    for (const x of sents) { const g = groups[groups.length - 1]; if (g.length && wc(g.join(' ')) + wc(x) > MAX_BEAT) groups.push([x]); else g.push(x); }
    groups.forEach((g, k) => {
      const text = g.join(' ');
      const emphasis = (s.emphasis ?? []).filter(e => text.toLowerCase().includes(e.toLowerCase()));
      if (k === 0) out.push({...s, narration: text, emphasis} as Sc);
      else { const {visual, layout, camera, transition, pose, art, chapter, ...rest} = s as Sc & Record<string, unknown>; void chapter; void visual; void layout; void camera; void transition; void pose; void art; out.push({...rest, narration: text, emphasis} as Sc); }
    });
  });
  return {...ep, scenes: out as Episode['scenes']};
}

/** Share of scenes that are plain talk and the longest run of equal types; used by the critic and the drafter retry. */
export function varietyStats(ep: Episode) {
  const n = ep.scenes.length;
  let run = 1, maxRun = 1;
  for (let i = 1; i < n; i++) { run = ep.scenes[i].type === ep.scenes[i - 1].type ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  return {talkShare: n ? ep.scenes.filter(s => s.type === 'talk').length / n : 0, maxRun, kinds: new Set(ep.scenes.map(s => s.type)).size};
}
