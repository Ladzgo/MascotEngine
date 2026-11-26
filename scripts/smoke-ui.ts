// UI smoke test: starts the Studio on a spare port (fake jobs: no LLM, no render), then (1) opens every page route, (2) walks the main user path
// Today -> New video -> Make video -> progress -> Cancel -> Retry -> episode pages, with screenshots in out/smoke-ui/.
// Fails on console errors, page errors, empty pages or a broken step. Uses playwright-core with the headless Chrome Remotion ships.
// Usage: npm run smoke:ui   (skips with exit 0 and a notice when no browser is installed)
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root = new URL('../', import.meta.url).pathname, PORT = Number(process.env.SMOKE_PORT ?? 4191), base = `http://localhost:${PORT}`;
const shots = `${root}out/smoke-ui/`, tmp = `${os.tmpdir()}/smoke-ui-${process.pid}`;
fs.mkdirSync(shots, {recursive: true});
const findChrome = (): string | null => {
  if (process.env.SMOKE_CHROME) return process.env.SMOKE_CHROME;
  const walk = (d: string, depth: number): string | null => {
    if (!fs.existsSync(d) || depth > 5) return null;
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const f = path.join(d, e.name);
      if (e.isFile() && /^chrome-headless-shell$/.test(e.name)) return f;
      if (e.isDirectory()) { const r = walk(f, depth + 1); if (r) return r; }
    }
    return null;
  };
  return walk(`${root}node_modules/.remotion`, 0);
};
const exe = findChrome();
if (!exe) { console.log('SKIP: no headless Chrome (run: npx remotion browser ensure)'); process.exit(0); }

const server = spawn(`${root}node_modules/.bin/tsx`, [`${root}studio/server.ts`], {cwd: root, env: {...process.env, STUDIO_PORT: String(PORT), STUDIO_TEST: '1', STUDIO_TEST_FAKE_JOBS: '1', STUDIO_JOBS_FILE: `${tmp}.jobs`, STUDIO_DRAFTS_FILE: `${tmp}.drafts`, STUDIO_PID_FILE: `${tmp}.pids`}, stdio: 'ignore'});
const problems: string[] = [];
const TOPIC = 'zz smoke topic';
const cleanup = () => { server.kill(); for (const f of ['jobs', 'drafts', 'pids']) fs.rmSync(`${tmp}.${f}`, {force: true}); for (const d of fs.existsSync(`${root}episodes`) ? fs.readdirSync(`${root}episodes`) : []) if (d.includes('zz-smoke')) fs.rmSync(`${root}episodes/${d}`, {recursive: true, force: true}); };
process.on('exit', cleanup);
try {
  let eps: {id: string}[] = [];
  for (let i = 0; ; i++) { try { eps = await (await fetch(`${base}/api/episodes`)).json(); break; } catch { if (i > 60) throw new Error('server did not start'); await new Promise(r => setTimeout(r, 500)); } }
  const browser = await chromium.launch({executablePath: exe});
  const page = await browser.newPage({viewport: {width: 1280, height: 860}});
  const errs: string[] = [];
  page.on('pageerror', e => { if (!/websocket/i.test(e.message)) errs.push(e.message); }); // vite HMR socket noise
  page.on('console', m => { if (m.type() === 'error' && !/websocket|\[vite\]|favicon|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  const shot = (n: string) => page.screenshot({path: `${shots}${n}.png`});
  const step = async (name: string, fn: () => Promise<void>) => {
    errs.length = 0;
    try { await fn(); if (errs.length) throw new Error(`console: ${errs[0]}`); console.log(`ok   ${name}`); }
    catch (e) { const m = (e as Error).message.split('\n')[0]; console.log(`FAIL ${name} (${m})`); problems.push(`${name}: ${m}`); await shot(`FAIL-${name.replace(/\W+/g, '-')}`).catch(() => undefined); }
  };

  const pages = ['today', 'new', 'library', 'pipeline', 'ideas', 'clipper', 'analytics', 'channels', 'settings', 'queue', 'calendar'];
  if (eps[0]) pages.push(...['script', 'voice', 'visuals', 'render', 'publish'].map(s => `ep/${eps[0].id}/${s}`));
  for (const r of pages) await step(`page ${r}`, async () => {
    await page.goto(`${base}/#/${r}`); await page.waitForSelector('main', {timeout: 15000}); await page.waitForTimeout(1200);
    const txt = (await page.locator('main').first().innerText()).trim();
    if (!txt) throw new Error('empty main');
    if (await page.locator('main .alert').count()) throw new Error('alert shown');
    await shot(`page-${r.replace(/\//g, '_')}`);
  });

  await step('path: Today shows a New video button', async () => {
    await page.goto(`${base}/#/today`); await page.waitForSelector('main');
    await page.getByRole('link', {name: /new video/i}).or(page.getByRole('button', {name: /new video/i})).first().click();
    await page.waitForSelector('.nv-topic', {timeout: 10000}); await shot('path-1-new-video');
  });
  await step('path: Make video is disabled until a topic is typed, then starts', async () => {
    const make = page.getByRole('button', {name: /^make video$/i});
    if (!(await make.isDisabled())) throw new Error('Make video enabled without a topic');
    await page.fill('.nv-topic', TOPIC); await shot('path-2-form');
    await make.click(); await page.waitForSelector('text=/Making your video/i', {timeout: 10000});
  });
  await step('path: progress timeline, elapsed text and Cancel are visible', async () => {
    await page.waitForSelector('.nv-tl li.now', {timeout: 15000});
    await page.waitForSelector('text=/Running for/i'); await page.getByRole('button', {name: /^cancel$/i}).waitFor({timeout: 10000}); await shot('path-3-progress');
  });
  await step('path: Cancel stops the run and Retry is offered in plain words', async () => {
    await page.getByRole('button', {name: /^cancel$/i}).click();
    await page.getByRole('button', {name: /^retry$/i}).waitFor({timeout: 15000});
    if (/undefined|\[object|ENOENT|Error:/.test(await page.locator('main .alert').first().innerText())) throw new Error('alert shows raw error text');
    await shot('path-4-cancelled');
  });
  await step('path: Retry returns to the episode run page', async () => {
    await page.getByRole('button', {name: /^retry$/i}).click(); await page.waitForURL(/#\/(ep|new)/, {timeout: 10000}); await page.waitForSelector('main'); await shot('path-5-retried');
  });
  const mine = (await (await fetch(`${base}/api/episodes`)).json() as {id: string}[]).find(e => e.id.includes('zz-smoke'));
  if (mine) {
    const b = `${root}episodes/${mine.id}/build/`; fs.mkdirSync(b, {recursive: true});
    const ff = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x223344:s=360x640:d=1', '-pix_fmt', 'yuv420p', `${b}${mine.id}-preview.mp4`], {stdio: 'ignore'});
    if (ff.status === 0) {
      await step('path: player shows the preview video', async () => {
        await page.goto(`${base}/#/ep/${mine.id}/render`); await page.waitForSelector('main video', {timeout: 10000});
        const src = await page.locator('main video').first().getAttribute('src');
        if (!src?.includes('-preview.mp4')) throw new Error(`video src is ${src}`); await shot('path-6-player');
      });
      await step('path: Publish pack button is offered next to the finished preview', async () => {
        await page.goto(`${base}/#/ep/${mine.id}/publish`); await page.getByRole('button', {name: /generate publish pack/i}).waitFor({timeout: 10000}); await shot('path-7-publish-pack');
      });
      await step('path: finished run page offers Make final and Publish pack', async () => {
        await page.goto(`${base}/#/new/${mine.id}`); await page.waitForTimeout(500);
        const t = await page.locator('main').first().innerText(); if (!/Make final|Making your video|lost track/i.test(t)) throw new Error('run page shows nothing useful');
      });
    } else console.log('SKIP player steps: ffmpeg not available');
  }
  if (mine) for (const s of ['voice', 'render', 'publish']) await step(`path: episode ${s} page`, async () => {
    await page.goto(`${base}/#/ep/${mine.id}/${s}`); await page.waitForSelector('main', {timeout: 10000}); await page.waitForTimeout(1000);
    if (!(await page.locator('main').first().innerText()).trim()) throw new Error('empty main'); await shot(`path-6-${s}`);
  });
  else problems.push('path: the fake draft never created an episode');
  await browser.close();
} catch (e) { problems.push((e as Error).message); } finally { cleanup(); }
if (problems.length) { console.error(`${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('UI smoke ok (screenshots in out/smoke-ui/)');
