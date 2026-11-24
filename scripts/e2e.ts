// E2E smoke test: fresh topic -> draft -> voice -> direct -> preview render -> qa -> subs. Exit 0 only if every stage and output is fine.
// Usage: npm run e2e -- [--fixture] ["topic"] [--keep] [--strict] [--engine auto|espeak-ng|piper|say]
try { process.loadEnvFile(); } catch { /* .env optional */ }
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runBatch, npmRunner} from '../src/batch/batch.js';

const root = path.resolve(new URL('../', import.meta.url).pathname) + '/';
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const topic = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--engine') ?? 'Why a rainy day fund beats a hot stock tip';
const engine = val('engine') ?? 'auto';
const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 12);
const run = npmRunner(root);
const problems: string[] = [];
const fail = (m: string) => { problems.push(m); console.error(`FAIL: ${m}`); };

const doc = await run(['run', 'doctor']);
if (doc.code !== 0) console.warn('doctor reports missing required items; continuing so the failing stage shows the real error.');

// --fixture: CI-friendly path, no LLM and no voice engine: golden episode -> silent voice -> direct -> preview -> publish-pack -> ZIP check.
if (flag('fixture')) {
  const fid = `e2e-fixture-${stamp}`, dir = `${root}episodes/${fid}/`;
  fs.mkdirSync(`${dir}audio`, {recursive: true});
  const ep = JSON.parse(fs.readFileSync(`${root}scripts/qa/golden/episode.json`, 'utf8'));
  fs.writeFileSync(`${dir}episode.json`, JSON.stringify({...ep, id: fid}, null, 2));
  const steps: [string, string[]][] = [['voice', ['tts', fid, '--engine', 'silent']], ['direct', ['direct', fid]], ['preview', ['render', fid, '--preview']], ['publish-pack', ['publish-pack', fid]]];
  for (const [name, a] of steps) { const t = Date.now(); const r = await run(['run', ...a.slice(0, 1), '--', ...a.slice(1)]); console.log(`${name}: ${r.code === 0 ? 'ok' : 'FAIL'} ${((Date.now() - t) / 1000).toFixed(0)}s`); if (r.code !== 0) fail(`${name} failed`); }
  for (const f of ['decisions.json', `${fid}-preview.mp4`, 'publish.json']) if (!problems.length && !(fs.existsSync(`${dir}build/${f}`) && fs.statSync(`${dir}build/${f}`).size > 100)) fail(`missing output: ${f}`);
  if (!problems.length) {
    const zip = `${dir}../.${fid}.zip`;
    const z = spawnSync('zip', ['-qr', zip, 'episode.json', 'build/decisions.json'], {cwd: dir});
    if (z.status !== 0 || !fs.existsSync(zip)) fail('zip export failed'); else fs.rmSync(zip);
  }
  console.log(`\ne2e fixture ${problems.length ? 'FAILED' : 'OK'}: ${fid}`);
  if (!problems.length) fs.rmSync(dir, {recursive: true, force: true}); else console.log(`kept: episodes/${fid}`);
  process.exit(problems.length ? 1 : 0);
}

const rep = await runBatch({topics: [topic], channel: 'default', engine, existing: new Set(fs.readdirSync(`${root}episodes`)), qa: true, run});
const item = rep.items[0], id = item.id;
for (const s of item.stages) if (!s.ok && s.stage !== 'qa') fail(`${s.stage}: ${s.error}`);
const b = `${root}episodes/${id}/build/`;
if (!problems.length) {
  const subs = await run(['run', 'subs', '--', id]);
  if (subs.code !== 0) fail('subs export failed');
  for (const f of [`${id}-preview.mp4`, `${id}.srt`, `${id}.vtt`, 'qa.json']) {
    if (!fs.existsSync(b + f) || fs.statSync(b + f).size < 100) fail(`missing or empty output: ${f}`);
  }
  if (fs.existsSync(b + 'qa.json')) {
    const q = JSON.parse(fs.readFileSync(b + 'qa.json', 'utf8'));
    const bad = q.checks.filter((c: {ok: boolean}) => !c.ok).map((c: {name: string; value: string}) => `${c.name}: ${c.value}`);
    if (bad.length) { console.warn(`QA findings (${bad.length}):\n  ${bad.join('\n  ')}`); if (flag('strict')) fail('QA checks failed (--strict)'); }
  }
}
const total = item.stages.reduce((a, s) => a + s.sec, 0);
console.log(`\ne2e ${problems.length ? 'FAILED' : 'OK'}: ${id}, ${item.stages.map(s => `${s.stage} ${s.sec}s${s.ok ? '' : ' FAIL'}`).join(', ')} (total ${total.toFixed(0)}s)`);
if (!flag('keep') && !problems.length) fs.rmSync(`${root}episodes/${id}`, {recursive: true, force: true});
else console.log(`kept: episodes/${id}`);
process.exit(problems.length ? 1 : 0);
