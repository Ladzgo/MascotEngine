// Usage: tsx scripts/qa/benchRender.ts <episode-id> [frames=150]. Times renderMedia for a few settings (preview scale).
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode, parseDecisions} from '../../src/schema.js';
import {loadCharacterAssets} from '../../src/pipeline/render.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const [id, n = '150'] = process.argv.slice(2);
const ep = loadEpisode(id), dir = episodeDir(ep.id);
const timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
const decisions = parseDecisions(fs.readFileSync(`${dir}build/decisions.json`, 'utf8'));
const inputProps = {episode: ep, timings, decisions, assets: loadCharacterAssets()};
const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
const comp = await selectComposition({serveUrl, id: 'Episode', inputProps});
const from = Math.floor(comp.durationInFrames / 3);
const variants: {name: string; o: Record<string, unknown>}[] = JSON.parse(process.env.VARIANTS ?? '[{"name":"default","o":{}}]');
for (const v of variants) {
  const t0 = Date.now();
  await renderMedia({composition: comp, serveUrl, codec: 'h264', outputLocation: `/tmp/bench-${v.name}.mp4`, inputProps, scale: 2 / 3, muted: true, crf: 24, pixelFormat: 'yuv420p', frameRange: [from, from + Number(n) - 1], ...v.o});
  console.log(`${v.name.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)} s for ${n} frames`);
}
