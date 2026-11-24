try { process.loadEnvFile(); } catch { /* .env optional */ }
import fs from 'node:fs';
import {episodeDir, loadEpisode} from '../schema.js';
import {getEngine, writeTimings} from './tts.js';

const [cmd, id, ...rest] = process.argv.slice(2);
const flag = (n: string) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] ?? true : undefined;
};

async function main() {
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
      console.log(`THUMB_OK ${await makeThumbnail(id, typeof flag('text') === 'string' ? String(flag('text')) : undefined)}`);
      break;
    }
    case 'tts': {
      const ep = loadEpisode(id);
      const engine = getEngine(String(flag('engine') ?? 'auto'));
      const timings = await engine.synthesize(ep, episodeDir(ep.id));
      writeTimings(episodeDir(ep.id), timings);
      console.log(`${ep.id}: ${timings.scenes.length} scenes, ${timings.total.toFixed(1)}s (${engine.name})`);
      break;
    }
    case 'direct': {
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
