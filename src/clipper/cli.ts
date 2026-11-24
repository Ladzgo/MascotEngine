import fs from 'node:fs';
import path from 'node:path';
import {detectAligner, probeDuration, runAligner} from '../pipeline/align.js';
import {spawnSync} from 'node:child_process';
import {findCandidates} from './segment.js';
import {cropPath, cropWidth, sampleTrack} from './crop.js';
import {renderClip} from './render.js';
import {cleanupCaptions, renderCaptionVideos} from './captions.js';
import {snapClip} from './snap.js';
import {TimelineSchema, WordSchema, type Timeline} from './timeline.js';

function arg(name: string, def: string) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; }

async function main() {
  const file = process.argv.slice(2).find(a => !a.startsWith('--') && !/^\d+(\.\d+)?$/.test(a));
  if (!file || !fs.existsSync(file)) throw new Error('usage: npm run clip -- <file> [--min 20 --max 60 --count 5] [--words words.json] [--no-render]');
  const min = +arg('min', '20'), max = +arg('max', '60'), count = +arg('count', '5');
  const dir = path.resolve(arg('out', `out/clips/${path.basename(file, path.extname(file))}`));
  fs.mkdirSync(dir, {recursive: true});

  const wf = arg('words', '');
  let words;
  if (wf) words = WordSchema.array().parse(JSON.parse(fs.readFileSync(wf, 'utf8')));
  else {
    const al = detectAligner();
    if (al !== 'whisper-cli') throw new Error('whisper.cpp + data/models/ggml-base.en.bin needed (or pass --words words.json)');
    words = runAligner(al, file).map(r => ({w: r.w, start: r.start, end: r.end}));
    fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(words));
  }

  const dims = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout.trim().split(',').map(Number);
  const [W, H] = dims;
  if (!W || !H) throw new Error('cannot read video size');
  const cw = cropWidth(W, H);
  const dur = probeDuration(file);
  const cands = findCandidates(words, {min, max, count}, dur).map(c => { const s = snapClip(file, c.start, c.end); return {...c, start: s.start, end: Math.min(dur, s.end)}; });
  const tl: Timeline = {version: 1, source: path.resolve(file), width: W, height: H, clips: cands.map((c, i) => ({
    id: `clip${i + 1}`, start: +c.start.toFixed(3), end: +c.end.toFixed(3), score: c.score, reasons: c.reasons,
    text: c.words.map(w => w.w).join(' '), words: c.words,
    crop: {w: cw, h: H, path: cropPath(sampleTrack(file, c.start, c.end, W, H), W, cw)},
  }))};
  if (!cands.length) console.warn('no clip candidates found (try wider --min/--max)');
  const render = !process.argv.includes('--no-render');
  const caps = render && !process.argv.includes('--no-captions') ? await renderCaptionVideos(tl.clips, dir) : new Map<string, string | null>();
  for (const c of tl.clips) {
    if (render) { c.file = path.join(dir, `${c.id}.mp4`); renderClip(file, c, c.file, caps.get(c.id) ?? null); }
    console.log(`${c.id} ${c.start.toFixed(1)}-${c.end.toFixed(1)}s score ${c.score} [${c.reasons.join(', ')}]`);
  }
  cleanupCaptions(caps);
  fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(TimelineSchema.parse(tl), null, 2));
  console.log(`timeline: ${path.join(dir, 'timeline.json')}`);
}
main().catch(e => { console.error((e as Error).message); process.exit(1); });
