// Draft check without TTS: estimated Short length and pace, script score, and the share of beat pairs that carry a number or a name.
// Usage: npx tsx scripts/draft-measure.ts <episode-id>...
import fs from 'node:fs';
import {estSec, SCENE_PAD} from '../src/director/shortsPro.js';
import {spokenWords} from '../src/draft/lint.js';
import {scoreScript} from '../src/draft/score.js';
import {concreteGaps} from '../src/draft/story.js';
for (const id of process.argv.slice(2)) {
  const ep = JSON.parse(fs.readFileSync(`episodes/${id}/episode.json`, 'utf8'));
  const words = ep.scenes.reduce((a: number, s: {narration: string}) => a + spokenWords(s.narration), 0);
  const sec = ep.scenes.reduce((a: number, s: {narration: string}) => a + estSec(s) + SCENE_PAD, 0);
  const sc = scoreScript(ep), hookScore = fs.existsSync(`episodes/${id}/script-score.json`) ? JSON.parse(fs.readFileSync(`episodes/${id}/script-score.json`, 'utf8')).hook : undefined;
  console.log(`${id}: ${ep.scenes.length} beats, ${words} spoken words, est ${sec.toFixed(1)} s, ${(words / sec * 60).toFixed(0)} wpm overall, score ${sc.total}, hook judge ${hookScore?.score ?? '-'}, concrete gaps ${concreteGaps(ep.scenes.map((s: {narration: string}) => s.narration)).length}, device ${ep.device}`);
  console.log(`  hook: ${ep.scenes[0].narration}`);
}
