import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type Range = {from: number; to: number; scene: number | 'end'}; // inclusive frames

const sha = (...parts: unknown[]) => crypto.createHash('sha1').update(parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join('\u0001')).digest('hex').slice(0, 20);

/** One render chunk per scene (froms[i]..ends[i]-1) plus the end card. Null when the layout has gaps or overlaps (then render in one piece). */
export function chunkRanges(L: {froms: number[]; ends: number[]}, totalFrames: number, hasEndCard: boolean): Range[] | null {
  const out: Range[] = L.froms.map((from, i) => ({from, to: L.ends[i] - 1, scene: i}));
  if (hasEndCard && L.ends.length && L.ends[L.ends.length - 1] < totalFrames) out.push({from: L.ends[L.ends.length - 1], to: totalFrames - 1, scene: 'end'});
  let next = 0;
  for (const r of out) { if (r.from !== next || r.to < r.from) return null; next = r.to + 1; }
  return next === totalFrames ? out : null;
}

/** Hash of everything that can change how the composition looks: all non-test source files, package.json, font and character asset names + sizes. */
export function codeHash(root: string): string {
  const h = crypto.createHash('sha1');
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) h.update(f.slice(root.length)).update(fs.readFileSync(f));
    }
  };
  walk(path.join(root, 'src'));
  h.update(fs.readFileSync(path.join(root, 'package.json')));
  for (const sub of ['fonts', 'character', 'props']) {
    const d = path.join(root, 'assets', sub);
    if (fs.existsSync(d)) for (const n of fs.readdirSync(d).sort()) { const st = fs.statSync(path.join(d, n)); h.update(`${sub}/${n}:${st.size}:${Math.round(st.mtimeMs)}`); }
  }
  return h.digest('hex').slice(0, 20);
}

/**
 * Cache key per chunk. A scene's frames depend on its own episode scene, decisions and word timings, on the previous/next scene's
 * (captions hold across the cut, transitions), on the absolute frame range (the paper boil animates with the global frame), and on
 * every episode-level setting. Editing one sentence therefore invalidates that scene and its neighbours, plus every later scene whose
 * start frame moved because the edited scene got longer or shorter.
 */
export function chunkKeys(o: {ranges: Range[]; episode: any; decisions: any; timings: any; code: string; mode: string; extra?: unknown}): string[] {
  const {episode, decisions, timings} = o;
  const global = sha({...episode, scenes: undefined}, {...decisions, scenes: undefined}, o.code, o.mode, o.extra ?? null, timings.fps);
  const per = (i: number) => (i < 0 || i >= episode.scenes.length ? null : {s: episode.scenes[i], d: decisions.scenes[i], t: timings.scenes[i]});
  return o.ranges.map(r => {
    const i = r.scene === 'end' ? decisions.scenes.length : r.scene;
    return sha(global, r.from, r.to, r.scene === 'end' ? null : per(i), per(i - 1), per(i + 1));
  });
}
