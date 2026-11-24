// Measures draft quality on real topics (local Ollama, free): tries per draft, validation failures, invented big_numbers dropped, word count.
// Usage: npx tsx scripts/draft-stats.ts "topic one" "topic two" ...
import path from 'node:path';
import {requireClient} from '../src/llm/llm.js';
import {loadVoice, draftEpisode, MODEL, type DraftStats} from '../src/draft/draft.js';

const client = await requireClient(m => { console.error(m); process.exit(1); });
const voice = loadVoice(path.resolve('docs/VOICE.md'));
let tot = {drafts: 0, attempts: 0, failedAttempts: 0, demoted: 0, words: 0, failed: 0};
for (const topic of process.argv.slice(2)) {
  const stats: DraftStats = {attempts: 0, failures: [], demoted: 0};
  try {
    const ep = await draftEpisode({client, topic, id: 'stats-x', voice, model: process.env.DRAFT_MODEL ?? MODEL, stats});
    const words = ep.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
    tot = {...tot, drafts: tot.drafts + 1, words: tot.words + words};
    console.log(`OK ${topic}: attempts=${stats.attempts} demoted=${stats.demoted} words=${words}`);
  } catch { tot.failed++; console.log(`FAIL ${topic}: attempts=${stats.attempts}`); }
  tot.attempts += stats.attempts; tot.failedAttempts += stats.failures.length; tot.demoted += stats.demoted;
  for (const f of stats.failures) console.log('  err:', f.slice(0, 2).join(' | ').slice(0, 160));
}
console.log(JSON.stringify(tot));
