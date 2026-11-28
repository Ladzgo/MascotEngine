// Camera zoom per beat measured from RENDERED frames (QUALITY-PLAN 1), next to zoom.ts which derives it from the camera functions.
//   npx tsx scripts/qa/zoomFrames.ts <episode-id>
// A plain frame diff of the video can't see a 4% zoom under popping objects, captions and flat gradients (tried: every beat read 10-11%).
// So the episode is rendered with inputProps.qaMarks: each camera layer (stock, backdrop, drawn stage) carries four coloured squares and
// everything else is hidden. Scale = spread of a layer's squares at the end of a sub-shot / at its start; a cut = last frame before vs first after.
// Any transform on the way (layer, wrapper, transition, a future zoom someone adds above them) moves the squares, so stacked zooms show up.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../../src/schema.js';
import {loadCharacterAssets, withArt, withStock} from '../../src/pipeline/render.js';
import {chromiumTuning} from '../../src/pipeline/renderOpts.js';
import {subShots} from '../../src/fullbleed/FullBleedScene.js';
import {ZOOM_LIMITS} from './zoom.js';
import {frameLayout} from '../../src/Episode.js';

const root = new URL('../../', import.meta.url).pathname;
type Layer = 'stock' | 'backdrop' | 'stage';
const LAYERS: [Layer, (r: number, g: number, b: number) => boolean][] = [
  ['stock', (r, g, b) => g > 160 && r < 90 && b < 90], ['backdrop', (r, g, b) => r > 160 && g < 90 && b < 90], ['stage', (r, g, b) => b > 160 && r < 90 && g < 90],
];

/** Spread (mean distance of the marker pixels from their centroid) per layer; undefined when the layer isn't on screen. */
export function spreads(rgb: Uint8Array, w: number, h: number): Partial<Record<Layer, number>> {
  const out: Partial<Record<Layer, number>> = {};
  for (const [name, is] of LAYERS) {
    const xs: number[] = [], ys: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; if (is(rgb[i], rgb[i + 1], rgb[i + 2])) { xs.push(x); ys.push(y); } }
    if (xs.length < 40) continue;
    const cx = xs.reduce((a, v) => a + v, 0) / xs.length, cy = ys.reduce((a, v) => a + v, 0) / ys.length;
    out[name] = xs.reduce((a, x, k) => a + Math.hypot(x - cx, ys[k] - cy), 0) / xs.length;
  }
  return out;
}
const lg = (a?: number, b?: number) => (a && b ? Math.abs(Math.log(b / a)) : 0);

export type FrameZoomRow = {beat: number; kind: 'drawn' | 'photo' | 'video'; move: number; cut: number; layers: number; over: string[]};
export async function frameZoomRows(id: string, log: (m: string) => void = () => {}): Promise<FrameZoomRow[]> {
  const ep0 = loadEpisode(id), dir = episodeDir(ep0.id), tmp = `${dir}build/zoomframes/`;
  fs.mkdirSync(tmp, {recursive: true});
  const {episode, publicDir, cleanup} = withArt(withStock(ep0, dir), dir);
  let bundled: string;
  try { bundled = await bundle({entryPoint: `${root}src/index.ts`, publicDir, symlinkPublicDir: publicDir.endsWith('assets')}); } finally { cleanup(); }
  try {
    const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8')), decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
    const inputProps = {episode, timings, decisions, assets: loadCharacterAssets(), qaMarks: true};
    const comp = await selectComposition({serveUrl: bundled, id: 'Episode', inputProps});
    const L = frameLayout(decisions, comp.fps), scale = 0.25, W = Math.round(comp.width * scale), H = Math.round(comp.height * scale), fps = comp.fps, cache = new Map<number, Partial<Record<Layer, number>>>();
    const at = async (frame: number) => {
      if (cache.has(frame)) return cache.get(frame)!;
      const f = `${tmp}${frame}.png`;
      await renderStill({composition: comp, serveUrl: bundled, output: f, frame, inputProps, scale, chromiumOptions: chromiumTuning()});
      const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1 << 26});
      const sp = spreads(new Uint8Array(r.stdout), W, H);
      cache.set(frame, sp);
      return sp;
    };
    const rows: FrameZoomRow[] = [];
    for (const [i, d] of decisions.scenes.entries()) {
      const file = episode.scenes[i].stockFile, kind = !file ? 'drawn' : /\.mp4$/i.test(file) ? 'video' : 'photo';
      // the beat's own frames: after its transition-in (froms..starts) and before the next beat's transition starts (ends = next froms); scene time 0 = froms
      const n = subShots(d.durSec), len = d.durSec / n, f0 = L.starts[i] + 1, bounds = Array.from({length: n + 1}, (_, k) => (k === n ? L.ends[i] : L.froms[i] + Math.round(k * len * fps)));
      let move = 0, cut = 0;
      const moving = new Set<Layer>();
      for (let k = 0; k < n; k++) {
        if (bounds[k + 1] - 1 <= Math.max(bounds[k] + 1, f0)) continue;
        const a = await at(Math.max(bounds[k] + 1, f0)), b = await at(bounds[k + 1] - 1);
        for (const l of ['stock', 'backdrop', 'stage'] as Layer[]) { const m = lg(a[l], b[l]); if (m > 0.004) moving.add(l); move = Math.max(move, m); }
        if (k > 0) { const p = await at(bounds[k] - 1), q = await at(bounds[k] + 1); for (const l of ["stock", "backdrop", "stage"] as Layer[]) cut = Math.max(cut, lg(p[l], q[l])); if (process.env.ZDEBUG) log(`  cut ${k} @${bounds[k]}: ${JSON.stringify(p)} -> ${JSON.stringify(q)}`); }
      }
      const layers = moving.size, lim = kind === 'photo' ? ZOOM_LIMITS.photo : kind === 'video' ? 0.012 : ZOOM_LIMITS.move; // a clip: only the 2-frame scale rounding
      const over = [...(move > lim ? [`move ${(move * 100).toFixed(1)}%`] : []), ...(cut > ZOOM_LIMITS.cut ? [`cut ${(cut * 100).toFixed(1)}%`] : []), ...(layers > ZOOM_LIMITS.layers ? [`${layers} layers zoom`] : [])];
      rows.push({beat: i + 1, kind, move, cut, layers, over});
      log(`beat ${String(i + 1).padStart(2)} ${kind.padEnd(5)} move ${(move * 100).toFixed(1).padStart(4)}%  cut ${(cut * 100).toFixed(1).padStart(4)}%  layers ${layers}  ${over.join(', ')}`);
    }
    return rows;
  } finally {
    fs.rmSync(bundled, {recursive: true, force: true}); // a bundle is a ~1 GB copy of assets/
    if (!process.env.ZDEBUG) fs.rmSync(tmp, {recursive: true, force: true});
  }
}

if (process.argv[1]?.endsWith('zoomFrames.ts')) {
  const rows = await frameZoomRows(process.argv[2] ?? '', console.log);
  console.log(`frame zoom: max move ${(Math.max(...rows.map(r => r.move)) * 100).toFixed(1)}%, max cut ${(Math.max(...rows.map(r => r.cut)) * 100).toFixed(1)}%, beats over: ${rows.filter(r => r.over.length).length}/${rows.length}`);
}
