try { process.loadEnvFile(); } catch { /* .env optional */ }
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../schema.js';
import {episodeLang, getEngine, writeTimings} from './tts.js';

const [cmd, id, ...rest] = process.argv.slice(2);
const flag = (n: string) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] ?? true : undefined;
};

/** `npm run shorts -- --all`: Shorts for every episode that has a final render and none yet. */
async function allShorts() {
  const {shorts} = await import('./shorts.js');
  const root = new URL('../../', import.meta.url).pathname;
  const ids = fs.readdirSync(`${root}episodes`).filter(d => /^[a-z0-9-]+$/.test(d) && fs.existsSync(`${root}episodes/${d}/build/${d}-final.mp4`) && !fs.existsSync(`${root}episodes/${d}/status.json.archived`));
  let n = 0;
  for (const d of ids) {
    const done = fs.existsSync(`${root}episodes/${d}/build/shorts`) && fs.readdirSync(`${root}episodes/${d}/build/shorts`).some(f => f.endsWith('.mp4'));
    if (done && !rest.includes('--force')) { console.log(`${d}: shorts exist (use --force to redo)`); continue; }
    console.log(`${d}: making shorts`); await shorts(d, Number(flag('count') ?? 3)); n++;
  }
  console.log(`shorts batch: ${n} episode(s) done, ${ids.length - n} skipped`);
}

/** Licensed b-roll between voice and preview: cached, live progress lines for the Studio, never fatal (a failure leaves the procedural visuals). */
async function stockStep(id: string) {
  const ep = loadEpisode(id);
  if (!ep.scenes.some(s => s.stock) || process.env.STOCK === '0') return;
  try {
    const {stockForEpisode} = await import('../stock/index.js');
    const {withOllamaLock} = await import('../llm/ollamaLock.js');
    // stock candidates are scored by the local vision model: hold data/ollama.lock so semantic QA and drafts wait their turn instead of evicting it
    const items = await withOllamaLock(`stock ${id}`, () => stockForEpisode(episodeDir(id), ep.scenes, ep.format, {log: m => console.warn(m), progress: (d, n, q) => console.log(`STOCK_PROGRESS ${d}/${n} ${q}`)}));
    console.log(`stock: ${items.length} of ${ep.scenes.filter(s => s.stock).length} beats have licensed footage`);
  } catch (e) { console.warn(`stock skipped: ${(e as Error).message.split('\n')[0]}`); }
}

async function main() {
  if (cmd === 'shorts' && id === '--all') return allShorts();
  if (!cmd || !id) {
    console.error('Usage: <new|tts|direct|render|shorts> <episode-id> [flags]');
    process.exit(1);
  }
  switch (cmd) {
    case 'new': {
      const dir = episodeDir(id);
      if (fs.existsSync(dir)) throw new Error(`Already exists: ${dir}`);
      fs.mkdirSync(`${dir}audio`, {recursive: true});
      fs.writeFileSync(`${dir}episode.json`, JSON.stringify({
        id, title: 'Untitled', series: 'money-myths',
        scenes: [{type: 'title', narration: 'Your hook goes here.', emotion: 'smug'}],
        sources: [], disclaimer: true,
      }, null, 2));
      console.log(`Created ${dir}`);
      break;
    }
    case 'thumbnail': {
      const {makeThumbnail} = await import('./thumbnail.js');
      console.log(`THUMB_OK ${await makeThumbnail(id, typeof flag('text') === 'string' ? String(flag('text')) : undefined, +(flag('variants') ?? 1) || 1)}`);
      break;
    }
    case 'tts': {
      const ep = loadEpisode(id);
      const engine = getEngine(String(flag('engine') ?? 'auto'), episodeLang(ep));
      const timings = await engine.synthesize(ep, episodeDir(ep.id));
      writeTimings(episodeDir(ep.id), timings);
      console.log(`${ep.id}: ${timings.scenes.length} scenes, ${timings.total.toFixed(1)}s (${engine.name})`);
      break;
    }
    case 'stock': { await stockStep(id); break; }
    case 'direct': {
      await stockStep(id);
      const {direct} = await import('../director/direct.js');
      await direct(id, {final: rest.includes('--final')});
      break;
    }
    case 'render': {
      const {render} = await import('./render.js');
      await render(id, rest.includes('--final') ? 'final' : 'preview');
      break;
    }
    case 'shorts': {
      const {shorts} = await import('./shorts.js');
      await shorts(id, Number(flag('count') ?? 3));
      break;
    }
    default:
      throw new Error(`Not implemented yet: ${cmd}`);
  }
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
