import fs from 'node:fs';
import path from 'node:path';
import {loadRetention, type RetentionData} from './retention.js';

export type SceneRet = {index: number; type: string; startSec: number; durSec: number; startPct: number; endPct: number; lossPer10s: number};
const at = (curve: number[], pctPos: number) => { const x = Math.min(100, Math.max(0, pctPos)), i = Math.floor(x), f = x - i; return curve[i] + ((curve[Math.min(100, i + 1)] - curve[i]) * f); };

/** Retention at each scene's start/end and the loss rate per 10 s; the video's total length maps the curve (0..100%) to seconds. */
export function sceneRetention(curve: number[], scenes: {index: number; type: string; startSec: number; durSec: number}[], totalSec: number): SceneRet[] {
  return scenes.map(s => {
    const a = at(curve, (s.startSec / totalSec) * 100), b = at(curve, ((s.startSec + s.durSec) / totalSec) * 100);
    return {index: s.index, type: s.type, startSec: s.startSec, durSec: s.durSec, startPct: +a.toFixed(1), endPct: +b.toFixed(1), lossPer10s: +(((a - b) / s.durSec) * 10).toFixed(2)};
  });
}

export type TypeStat = {type: string; scenes: number; avgLossPer10s: number};
export type Summary = {videos: number; withCurve: number; byType: TypeStat[]; hooks: {episode: string; kind: string; retentionAfterHook: number}[]; best?: string; worst?: string; note: string};

/** Which scene types hold viewers (lowest loss per 10 s) and how each hook kind retains. Needs curves AND build/decisions.json. */
export function summarize(root: string, data: RetentionData = loadRetention(path.join(root, 'data/retention.json'))): Summary {
  const acc = new Map<string, number[]>(), hooks: Summary['hooks'] = [];
  let withCurve = 0;
  for (const [key, v] of Object.entries(data.videos)) {
    if (!v.curve || !v.episode) continue;
    const f = path.join(root, 'episodes', v.episode, 'build/decisions.json');
    if (!fs.existsSync(f)) continue;
    const dec = JSON.parse(fs.readFileSync(f, 'utf8'));
    withCurve++;
    const sr = sceneRetention(v.curve, dec.scenes, dec.totalSec);
    for (const s of sr.slice(1)) acc.set(s.type, [...(acc.get(s.type) ?? []), s.lossPer10s]); // scene 0 is the hook, judged separately
    hooks.push({episode: key, kind: dec.hook?.kind ?? 'none', retentionAfterHook: sr[0].endPct});
  }
  const byType = [...acc].map(([type, xs]) => ({type, scenes: xs.length, avgLossPer10s: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)})).sort((a, b) => a.avgLossPer10s - b.avgLossPer10s);
  const enough = withCurve >= 3;
  return {videos: Object.keys(data.videos).length, withCurve, byType, hooks, best: enough ? byType[0]?.type : undefined, worst: enough ? byType.at(-1)?.type : undefined,
    note: enough ? 'Based on >= 3 videos with a retention curve.' : 'Fewer than 3 videos with a retention curve: treat as anecdotal; the director weights stay neutral.'};
}

/**
 * Read-only interface for the director: scene type -> multiplier in [0.9, 1.1] (>1 = viewers stay through this type).
 * Empty object (= no effect) until at least 3 videos have a retention curve. Never throws.
 */
export function retentionWeights(root = new URL('../../', import.meta.url).pathname): Record<string, number> {
  try {
    const s = summarize(root);
    if (!s.best || s.byType.length < 2) return {};
    const lo = s.byType[0].avgLossPer10s, hi = s.byType.at(-1)!.avgLossPer10s, span = hi - lo || 1;
    return Object.fromEntries(s.byType.map(t => [t.type, +(1.1 - 0.2 * ((t.avgLossPer10s - lo) / span)).toFixed(3)]));
  } catch { return {}; }
}
