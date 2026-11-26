import type {Episode} from '../schema.js';
import {spoken} from '../pipeline/speech.js';

type Sc = Episode['scenes'][number];
const wc = (t: string) => spoken(t).split(/\s+/).filter(Boolean).length; // spoken length: numerals are read out, so "$1,825" counts as six words
const MAX_BEAT = 22; // words (about 8 s spoken): longer talk scenes become several beats

/**
 * Storyboard split: a long talk scene becomes consecutive beats of one or two sentences, each a scene of its own
 * (new picture, new illustration pick, fresh caption block). Text is only cut at sentence ends, never rewritten.
 * The hook (scene 1), the closing scene, quotes and every non-talk scene are left alone.
 */
export function splitBeats(ep: Episode, o: {max?: number; clauses?: boolean} = {}): Episode {
  const MAX = o.max ?? MAX_BEAT;
  const last = ep.scenes.length - 1;
  const out: Sc[] = [];
  ep.scenes.forEach((s, i) => {
    const real = s.narration.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g)?.map(x => x.trim()).filter(Boolean) ?? [];
    let sents = real;
    // shorts-pro: a sentence longer than the cap is cut after a comma/semicolon near its middle
    if (o.clauses) sents = sents.flatMap(x => {
      if (wc(x) <= MAX) return [x];
      const parts = x.split(/(?<=[,;:])\s+/);
      if (parts.length < 2) return [x];
      let best = 1, bestD = Infinity, acc = 0;
      for (let k = 1; k < parts.length; k++) { acc += wc(parts[k - 1]); const d = Math.abs(acc - wc(x) / 2); if (d < bestD) { bestD = d; best = k; } }
      const a = parts.slice(0, best).join(' '), b = parts.slice(best).join(' ');
      return wc(a) >= 4 && wc(b) >= 4 ? [a, b] : [x]; // no 2-word fragments as beats of their own
    });
    // shorts-pro: a long data scene keeps its first sentence(s); the rest becomes a talk beat after it (a list or compare is never cut mid-sentence)
    if (o.clauses && s.type !== 'talk' && s.type !== 'title' && i > 0 && real.length >= 2 && wc(s.narration) > MAX) {
      let k = 1;
      while (k < real.length - 1 && wc(real.slice(0, k + 1).join(' ')) <= MAX) k++;
      const head = real.slice(0, k).join(' '), tail = real.slice(k).join(' ');
      const em = (t: string) => ((s as {emphasis?: string[]}).emphasis ?? []).filter(e => t.toLowerCase().includes(e.toLowerCase()));
      out.push({...s, narration: head, ...('emphasis' in s ? {emphasis: em(head)} : {})} as Sc);
      out.push({type: 'talk', emotion: (s as {emotion?: string}).emotion ?? 'neutral', emphasis: em(tail), narration: tail} as Sc);
      return;
    }
    if (s.type !== 'talk' || s.quote || i === 0 || (i === last && !o.clauses) || sents.length < 2 || wc(s.narration) <= MAX) { out.push(s); return; }
    const groups: string[][] = [[]];
    for (const x of sents) { const g = groups[groups.length - 1]; if (g.length && wc(g.join(' ')) + wc(x) > MAX) groups.push([x]); else g.push(x); }
    groups.forEach((g, k) => {
      const text = g.join(' ');
      const emphasis = (s.emphasis ?? []).filter(e => text.toLowerCase().includes(e.toLowerCase()));
      if (k === 0) out.push({...s, narration: text, emphasis} as Sc);
      else { const {visual, visuals, layout, camera, transition, pose, art, chapter, ...rest} = s as Sc & Record<string, unknown>; void chapter; void visual; void visuals; void layout; void camera; void transition; void pose; void art; out.push({...rest, narration: text, emphasis} as Sc); }
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
