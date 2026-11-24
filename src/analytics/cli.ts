import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadRetention, mergeImport, parseStudioCsv, saveRetention} from './retention.js';
import {summarize} from './summary.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const {positionals, values} = parseArgs({allowPositionals: true, options: {id: {type: 'string'}}});
const [cmd, file] = positionals;
const die = (m: string): never => { console.error(m); process.exit(1); };

if (cmd === 'import') {
  if (!file || !fs.existsSync(file)) die('Usage: npm run analytics -- import <studio.csv> [--id <episode-id>]\n       npm run analytics -- summary');
  const titles: Record<string, string> = {};
  for (const id of fs.existsSync(`${root}episodes`) ? fs.readdirSync(`${root}episodes`) : []) {
    try { titles[id] = JSON.parse(fs.readFileSync(`${root}episodes/${id}/episode.json`, 'utf8')).title; } catch { /* not an episode */ }
  }
  try {
    const data = loadRetention(`${root}data/retention.json`);
    const keys = mergeImport(data, parseStudioCsv(fs.readFileSync(file, 'utf8')), {episode: values.id, titles});
    saveRetention(data, `${root}data/retention.json`);
    console.log(`imported ${keys.length} video(s) -> data/retention.json: ${keys.join(', ')}`);
  } catch (e) { die(`Import failed: ${(e as Error).message}`); }
} else if (cmd === 'summary' || !cmd) {
  const s = summarize(root);
  console.log(`${s.videos} videos, ${s.withCurve} with retention curves. ${s.note}`);
  for (const t of s.byType) console.log(`  ${t.type.padEnd(12)} loses ${t.avgLossPer10s}% per 10 s (${t.scenes} scenes)`);
  for (const h of s.hooks) console.log(`  hook ${h.kind.padEnd(10)} ${h.episode}: ${h.retentionAfterHook}% still watching after the hook scene`);
  if (s.best) console.log(`holds best: ${s.best}; loses fastest: ${s.worst}`);
} else die('Commands: import | summary');
