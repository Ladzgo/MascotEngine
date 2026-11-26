// npm run qa:semantic -- <episode-id> [--file video.mp4] [--model qwen2.5vl:7b]
// One frame per beat (mid-point) goes to the local vision model: "does this picture illustrate the sentence?" -> score 0-10 + what is shown.
// Prints a table of the weakest beats and writes episodes/<id>/build/semantic.json. Free: Ollama only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {episodeDir, loadEpisode} from '../schema.js';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const id = process.argv[2];
if (!id || id.startsWith('-')) { console.error('Usage: npm run qa:semantic -- <episode-id> [--file video.mp4] [--model qwen2.5vl:7b]'); process.exit(2); }
const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
const file = arg('file') ?? [`${b}${ep.id}-final.mp4`, `${b}${ep.id}-preview.mp4`].find(f => fs.existsSync(f));
if (!file) { console.error(`no rendered video in ${b}`); process.exit(2); }
const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8'));
const model = arg('model') ?? process.env.VLM_MODEL ?? 'qwen2.5vl:7b', host = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'semqa-'));

export type Item = {scene: number; sentence: string; score: number; shown: string; reason: string};
async function ask(png: string, sentence: string): Promise<{score: number; shown: string; reason: string}> {
  const prompt = `This is one frame of an explainer video. At this moment the narrator says: "${sentence}"\nDoes the picture illustrate what is said (the objects, scene or data shown make sense for those words)? Ignore captions and text overlays when judging; judge the artwork. Reply with JSON only: {"score": integer 0-10 (0 = unrelated, 5 = loosely related, 10 = exactly what is described), "shown": "what the picture shows, in 8 words", "reason": "one short sentence"}`;
  const res = await fetch(`${host}/api/chat`, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(240000),
    body: JSON.stringify({model, stream: false, format: 'json', options: {temperature: 0.1}, messages: [{role: 'user', content: prompt, images: [fs.readFileSync(png).toString('base64')]}]})});
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status} (is ${model} pulled?)`);
  const j: any = JSON.parse(((await res.json()) as any).message?.content ?? '{}');
  return {score: Math.max(0, Math.min(10, Number(j.score) || 0)), shown: String(j.shown ?? '').slice(0, 80), reason: String(j.reason ?? '').slice(0, 140)};
}

const items: Item[] = [];
for (const [i, d] of dec.scenes.entries()) {
  const t = d.startSec + d.durSec * 0.5, png = path.join(tmp, `s${i}.png`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=540:-1', png]);
  if (r.status !== 0) continue;
  try { items.push({scene: i + 1, sentence: ep.scenes[i].narration, ...(await ask(png, ep.scenes[i].narration))}); }
  catch (e) { console.error(`beat ${i + 1}: ${(e as Error).message}`); }
  const it = items[items.length - 1];
  if (it?.scene === i + 1) console.log(`#${String(i + 1).padStart(2)} ${String(it.score).padStart(2)}/10  ${it.shown.padEnd(40)} | ${it.sentence.slice(0, 60)}`);
}
fs.rmSync(tmp, {recursive: true, force: true});
const mean = items.length ? items.reduce((a, x) => a + x.score, 0) / items.length : 0;
fs.writeFileSync(`${b}semantic.json`, JSON.stringify({model, file: path.basename(file), mean: +mean.toFixed(2), items}, null, 2));
console.log(`\nsemantic QA ${ep.id}: mean ${mean.toFixed(1)}/10 over ${items.length} beats; weakest: ${[...items].sort((a, b) => a.score - b.score).slice(0, 3).map(x => `#${x.scene} (${x.score})`).join(', ')}  (build/semantic.json)`);
