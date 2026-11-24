// UI smoke test: starts the Studio on a spare port, opens every page route in headless Chrome (the one Remotion ships), fails on console errors, page errors or an empty page.
// Usage: npm run smoke:ui   (skips with exit 0 and a notice when no headless browser is installed)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {openBrowser} from '@remotion/renderer';

const root = new URL('../', import.meta.url).pathname, PORT = Number(process.env.SMOKE_PORT ?? 4191), base = `http://localhost:${PORT}`;
const eps: {id: string}[] = [];
const server = spawn(`${root}node_modules/.bin/tsx`, [`${root}studio/server.ts`], {cwd: root, env: {...process.env, STUDIO_PORT: String(PORT), STUDIO_TEST: '1', STUDIO_JOBS_FILE: '/dev/null'}, stdio: 'ignore'});
const stop = () => { server.kill(); };
process.on('exit', stop);
const problems: string[] = [];
try {
  for (let i = 0; ; i++) { try { eps.push(...(await (await fetch(`${base}/api/episodes`)).json())); break; } catch { if (i > 60) throw new Error('server did not start'); await new Promise(r => setTimeout(r, 500)); } }
  let browser;
  try { browser = await openBrowser('chrome', {browserExecutable: null, chromiumOptions: {}, forceDeviceScaleFactor: undefined, viewport: null, indent: false, logLevel: 'error'} as never); }
  catch (e) { console.log(`SKIP: no headless browser (${(e as Error).message.split('\n')[0]})`); process.exit(0); }
  const pages = ['today', 'library', 'pipeline', 'ideas', 'clipper', 'analytics', 'channels', 'settings', 'queue', 'calendar'];
  if (eps[0]) pages.push(...['script', 'voice', 'visuals', 'render', 'publish'].map(s => `ep/${eps[0].id}/${s}`));
  const page = await browser.newPage({context: null as never, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => undefined} as never);
  const errs: string[] = [];
  page.on('pageerror', (e: unknown) => errs.push(String((e as Error).message ?? e)));
  page.on('console', (m: {type: () => string; text: () => string}) => { if (m.type() === 'error' && !/websocket|\[vite\]|favicon/i.test(m.text())) errs.push(m.text()); });
  for (const r of pages) {
    errs.length = 0;
    await page.goto({url: `${base}/#/${r}`, timeout: 20000});
    await new Promise(r => setTimeout(r, 1500));
    const txt = await page.evaluate(() => `${document.querySelector('main')?.textContent ?? ''}|${document.querySelector('main .alert') ? 'ALERT' : ''}`) as string;
    const bad = errs.length ? `console: ${errs[0]}` : txt.startsWith('|') ? 'empty main' : txt.endsWith('ALERT') ? 'alert shown' : '';
    console.log(`${bad ? 'FAIL' : 'ok  '} ${r}${bad ? ` (${bad})` : ''}`);
    if (bad) problems.push(`${r}: ${bad}`);
  }
  await browser.close({silent: true});
} catch (e) { problems.push((e as Error).message); } finally { stop(); }
if (problems.length) { console.error(`${problems.length} problem(s)`); process.exit(1); }
console.log('UI smoke ok');
void fs;
