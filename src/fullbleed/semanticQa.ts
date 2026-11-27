// npm run qa:semantic -- <episode-id> [--file video.mp4] [--model qwen2.5vl:7b]
// One frame per beat (mid-point) goes to the local vision model: "does this picture illustrate the sentence?" -> score 0-10 + what is shown.
// Prints a table of the weakest beats and writes episodes/<id>/build/semantic.json. Free: Ollama only.
import {withOllamaLock} from '../llm/ollamaLock.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {episodeDir, loadEpisode} from '../schema.js';
import {changedBeats, keepImproved, median, reselect} from './reselect.js';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {Episode, parseDecisions} from '../schema.js';
import {loadCharacterAssets, withArt, withStock} from '../pipeline/render.js';
import {chromiumTuning} from '../pipeline/renderOpts.js';

/** Scores of re-chosen beats, rendered from the changed episode with the current timings/decisions (a dropped stock clip stays off). */
async function rescore(raw: unknown, beats: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(), e0 = Episode.parse(raw), st = withStock(e0, dir);
  const e1 = {...st, scenes: st.scenes.map((x, i) => (beats.includes(i) && !(e0.scenes[i] as {stock?: unknown}).stock ? {...x, stockFile: undefined} : x))} as typeof st;
  const {episode, publicDir, cleanup} = withArt(e1, dir), root = new URL('../../', import.meta.url).pathname;
  let served: string;
  try { served = await bundle({entryPoint: `${root}src/index.ts`, publicDir}); } finally { cleanup(); }
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'semfix-'));
  try {
    const timings = JSON.parse(fs.readFileSync(`${b}timings.json`, 'utf8')), decisions = parseDecisions(fs.readFileSync(`${b}decisions.json`, 'utf8'));
    const inputProps = {episode, timings, decisions, assets: loadCharacterAssets()}, comp = await selectComposition({serveUrl: served, id: 'Episode', inputProps});
    for (const i of beats) {
      const d = decisions.scenes[i], png = path.join(tmp2, `r${i}.png`);
      await renderStill({composition: comp, serveUrl: served, output: png, frame: Math.round((d.startSec + d.durSec * 0.5) * comp.fps), inputProps, scale: 540 / comp.width, chromiumOptions: chromiumTuning()});
      try { out.set(i, (await ask(png, episode.scenes[i].narration)).score); } catch (e) { console.error(`re-score beat ${i + 1}: ${(e as Error).message}`); }
    }
  } finally { fs.rmSync(served, {recursive: true, force: true}); fs.rmSync(tmp2, {recursive: true, force: true}); }
  return out;
}

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const id = process.argv[2];
if (!id || id.startsWith('-')) { console.error('Usage: npm run qa:semantic -- <episode-id> [--file video.mp4] [--model qwen2.5vl:7b]'); process.exit(2); }
const ep = loadEpisode(id), dir = episodeDir(ep.id), b = `${dir}build/`;
const file = arg('file') ?? [`${b}${ep.id}-final.mp4`, `${b}${ep.id}-preview.mp4`].filter(f => fs.existsSync(f)).sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs)[0]; // the newest render: a stale final hid every preview change
if (!file) { console.error(`no rendered video in ${b}`); process.exit(2); }
const dec = JSON.parse(fs.readFileSync(`${b}decisions.json`, 'utf8'));
const model = arg('model') ?? process.env.VLM_MODEL ?? 'qwen2.5vl:7b', host = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
// the model host is shared (agent B falls back to a local text model): start only when no other model is loaded, else every call times out (max 10 min)
async function waitForFreeOllama(maxMs = 600000): Promise<boolean> {
  for (const t0 = Date.now(); Date.now() - t0 < maxMs; await new Promise(r => setTimeout(r, 10000))) {
    try { const ps = await (await fetch(`${host}/api/ps`, {signal: AbortSignal.timeout(5000)})).json() as {models?: {name: string}[]}; if (!(ps.models ?? []).some(m => m.name !== model)) return true; } catch { return true; } // no /api/ps: just try
    console.error('ollama busy with another model, waiting...');
  }
  return false;
}
if (!(await waitForFreeOllama())) { console.error(`semantic QA ${ep.id}: busy (another model stayed loaded for 10 min), no result written`); process.exit(3); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'semqa-'));

export type Item = {scene: number; sentence: string; score: number; shown: string; reason: string};
async function ask(png: string, sentence: string): Promise<{score: number; shown: string; reason: string}> {
  const prompt = `This is one frame of an explainer video. At this moment the narrator says: "${sentence}"\nDoes the picture illustrate what is said (the objects, scene or data shown make sense for those words)? Ignore captions and text overlays when judging; judge the artwork. Reply with JSON only: {"score": integer 0-10 (0 = unrelated, 5 = loosely related, 10 = exactly what is described), "shown": "what the picture shows, in 8 words", "reason": "one short sentence"}`;
  const res = await withOllamaLock('semantic-qa', () => fetch(`${host}/api/chat`, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(240000),
    body: JSON.stringify({model, stream: false, keep_alive: '30s', format: 'json', options: {temperature: 0.1}, messages: [{role: 'user', content: prompt, images: [fs.readFileSync(png).toString('base64')]}]})}));
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status} (is ${model} pulled?)`);
  const j: any = JSON.parse(((await res.json()) as any).message?.content ?? '{}');
  return {score: Math.max(0, Math.min(10, Number(j.score) || 0)), shown: String(j.shown ?? '').slice(0, 80), reason: String(j.reason ?? '').slice(0, 140)};
}

const items: Item[] = [], missing: number[] = [];
for (const [i, d] of dec.scenes.entries()) {
  const t = d.startSec + d.durSec * 0.5, png = path.join(tmp, `s${i}.png`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=540:-1', png]);
  if (r.status !== 0) continue;
  // one retry (the model is shared: another agent's model swap times a call out); a beat that still fails makes the run invalid
  for (let k = 0; k < 2; k++) {
    try { items.push({scene: i + 1, sentence: ep.scenes[i].narration, ...(await ask(png, ep.scenes[i].narration))}); break; }
    catch (e) { console.error(`beat ${i + 1}${k ? ' (retry)' : ''}: ${(e as Error).message}`); if (k) missing.push(i + 1); }
  }
  const it = items[items.length - 1];
  if (it?.scene === i + 1) console.log(`#${String(i + 1).padStart(2)} ${String(it.score).padStart(2)}/10  ${it.shown.padEnd(40)} | ${it.sentence.slice(0, 60)}`);
}
fs.rmSync(tmp, {recursive: true, force: true});
const mean = items.length ? items.reduce((a, x) => a + x.score, 0) / items.length : 0;
const med = median(items.map(x => x.score));
const valid = !missing.length;
fs.writeFileSync(`${b}semantic.json`, JSON.stringify({model, file: path.basename(file), valid, missing, mean: +mean.toFixed(2), median: med, items}, null, 2));
if (process.argv.includes('--fix') && !valid) console.log(`\n--fix skipped: beats ${missing.join(', ')} were not scored`);
else if (process.argv.includes('--fix')) { // beats below the threshold get another stock query/subject; render again afterwards
  const f = `${dir}episode.json`, before = JSON.parse(fs.readFileSync(f, 'utf8')), r = reselect(before, items, Number(arg('below') ?? 6));
  const swapped = changedBeats(before, r.ep);
  if (swapped.length) {
    // never worse: render each re-chosen beat (same frame as above), score it, keep the swap only if the score rises
    const scores = await rescore(r.ep, swapped), old = new Map(items.map(x => [x.scene - 1, x.score]));
    const k = keepImproved(before, r.ep, old, scores);
    console.log(`\nre-chosen:\n${r.log.join('\n')}\nre-scored: ${swapped.map(i => `#${i + 1} ${old.get(i)} -> ${scores.get(i) ?? '?'}`).join(', ')}; kept ${k.kept.map(i => `#${i + 1}`).join(' ') || 'none'}, reverted ${k.reverted.map(i => `#${i + 1}`).join(' ') || 'none'}`);
    if (k.kept.length) { fs.writeFileSync(f, JSON.stringify(k.ep, null, 2)); console.log(`now: npm run direct -- ${ep.id} && npm run render -- ${ep.id}`); }
  }
}
console.log(`\nsemantic QA ${ep.id}${valid ? '' : ` INVALID (beats ${missing.join(', ')} timed out twice; re-run when \`ollama ps\` shows no other model)`}: median ${med}/10, mean ${mean.toFixed(1)}/10 over ${items.length} beats; weakest: ${[...items].sort((a, b) => a.score - b.score).slice(0, 3).map(x => `#${x.scene} (${x.score})`).join(', ')}  (build/semantic.json)`);
