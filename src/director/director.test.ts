import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {direct, distance, loadHistory, paceOf} from './direct.js';
import {episodeDir, loadEpisode} from '../schema.js';
import {SilentTTS, writeTimings} from '../pipeline/tts.js';
import type {HistoryEntry, EpisodeDecisions} from './types.js';

const HIST = new URL('../../data/history.json', import.meta.url).pathname;
const readHist = () => (fs.existsSync(HIST) ? fs.readFileSync(HIST, 'utf8') : null);
const quiet = async (f: () => Promise<void>) => {
  const log = console.log; console.log = () => {};
  try { await f(); } finally { console.log = log; }
};

async function run() {
  const ep = loadEpisode('ep001');
  const dir = episodeDir(ep.id);
  if (!fs.existsSync(`${dir}build/timings.json`)) writeTimings(dir, await new SilentTTS().synthesize(ep));
  await quiet(() => direct('ep001', {final: false}));
  return fs.readFileSync(`${dir}build/decisions.json`, 'utf8');
}

test('preview is deterministic and leaves history untouched', async () => {
  const before = readHist();
  try {
    const a = await run();
    const b = await run();
    assert.equal(a, b);
  } finally {
    const after = readHist();
    if (after !== before) { // safety restore
      if (before === null) fs.rmSync(HIST); else fs.writeFileSync(HIST, before);
    }
  }
  assert.equal(readHist(), before);
});

test('no consecutive same layout / transition', async () => {
  const d: EpisodeDecisions = JSON.parse(await run());
  for (let i = 1; i < d.scenes.length; i++) {
    assert.notEqual(d.scenes[i].layout, d.scenes[i - 1].layout, `layout repeat at ${i}`);
    assert.notEqual(d.scenes[i].transition, d.scenes[i - 1].transition, `transition repeat at ${i}`);
  }
});

test('loadHistory returns episodes array', () => {
  assert.ok(Array.isArray(loadHistory().episodes));
});

test('distance', () => {
  const mk = (p: string): HistoryEntry => ({
    id: p, accent: p + 'a', background: p + 'b', captionStyle: p + 'c', intro: p + 'i', music: p + 'm',
    scenes: [0, 1].map(() => ({type: 'talk', layout: p + 'l', camera: p + 'c', transition: p + 't', pose: p + 'p'})),
  } as HistoryEntry);
  assert.equal(distance(mk('x'), mk('x')), 0);
  assert.equal(distance(mk('x'), mk('y')), 1);
});

test('audio never truncated, hook recorded, old shape loads', async () => {
  const d: EpisodeDecisions = JSON.parse(await run());
  for (const sc of d.scenes) assert.ok(sc.durSec >= sc.speechEnd + 0.2 - 1e-6, `scene ${sc.index} cuts audio`);
  assert.ok(d.hook && d.hook.atSec <= 2 && ['punch_in', 'slow_open'].includes(d.hook.kind));
  assert.deepEqual(d.scenes[0].hook, d.hook);
  // old shape: no hook fields anywhere
  const old = JSON.parse(JSON.stringify(d, (k, v) => (k === 'hook' ? undefined : v))) as EpisodeDecisions;
  assert.equal(old.hook, undefined);
  assert.equal(old.scenes[0].hook, undefined);
  assert.equal(old.scenes.length, d.scenes.length);
});

test('paceOf classifies sentence length', () => {
  const w = (t: string) => t.split(' ').map(x => ({w: x}));
  assert.equal(paceOf(w('Prices rose. Fast. Very fast.'), 2), 'punchy');
  const long = 'Inflation is the gradual process by which the general level of prices across the whole economy rises over many months and years, quietly eroding what each unit of currency can buy.';
  assert.equal(paceOf(w(long), 12), 'explain');
});
