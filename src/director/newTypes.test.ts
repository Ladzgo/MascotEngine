import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {direct} from './direct.js';
import {Episode, episodeDir} from '../schema.js';
import {SilentTTS, writeTimings} from '../pipeline/tts.js';
import type {EpisodeDecisions} from './types.js';

const ID = 'zz-newtypes-test';
const scenes = [
  {type: 'title', narration: 'Three new ways to show things.'},
  {type: 'table', narration: 'Savings pay little, bonds pay more, stocks pay most.', columns: ['Account', 'Rate'], rows: [['Savings', '0.5%'], ['Bonds', '4%'], ['Stocks', '7%']], highlight: 2},
  {type: 'checklist', narration: 'Open the account, automate the deposit, then wait.', steps: ['Open the account', 'Automate the deposit', 'Wait']},
  {type: 'stats', narration: 'Inflation is three percent and savings pay half a percent.', stats: [{value: 3, suffix: '%', label: 'Inflation'}, {value: 0.5, suffix: '%', decimals: 1, label: 'Savings'}]},
  {type: 'checklist', narration: 'Check the fees, check the rate, check again next year.', steps: ['Check the fees', 'Check the rate', 'Check next year', 'Repeat']},
  {type: 'table', narration: 'Fees differ a lot between funds.', columns: ['Fund', 'Fee', 'Style'], rows: [['Index', '0.1%', 'Passive'], ['Active', '1%', 'Managed']]},
  {type: 'stats', narration: 'Two numbers, one story, a third thing.', stats: [{value: 10, label: 'Years'}, {value: 20, label: 'Percent'}, {value: 30, label: 'Dollars'}]},
  {type: 'talk', narration: 'That is all.'},
];

test('table / checklist / stats: schema, element timing, no repeated layout or transition', async () => {
  const ep = Episode.parse({id: ID, title: 'New types', scenes});
  const dir = episodeDir(ID);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir + 'build', {recursive: true});
  fs.writeFileSync(dir + 'episode.json', JSON.stringify(ep));
  const log = console.log; console.log = () => {};
  try {
    writeTimings(dir, await new SilentTTS().synthesize(ep));
    for (const seed of [1, 2, 3, 4]) {
      fs.writeFileSync(dir + 'episode.json', JSON.stringify({...ep, seed}));
      await direct(ID, {final: false, weights: {}});
      const d: EpisodeDecisions = JSON.parse(fs.readFileSync(dir + 'build/decisions.json', 'utf8'));
      d.scenes.forEach((s, i) => {
        const sc = ep.scenes[i];
        if (sc.type === 'table') assert.equal(s.elements.length, sc.rows.length);
        if (sc.type === 'checklist') assert.equal(s.elements.length, sc.steps.length);
        if (sc.type === 'stats') assert.equal(s.elements.length, sc.stats.length);
        if (['table', 'checklist', 'stats'].includes(sc.type)) {
          assert.ok(s.elements.every((e, k) => k === 0 || e >= s.elements[k - 1]), `elements ascend, scene ${i}`);
          assert.ok(s.durSec >= Math.max(...s.elements), `scene ${i} lasts until its last element`);
        }
        if (i > 0 && s.camera !== 'static') assert.notEqual(s.camera, d.scenes[i - 1].camera, `camera repeat ${seed}/${i}`);
        if (i > 0) { assert.notEqual(s.layout, d.scenes[i - 1].layout, `layout repeat ${seed}/${i}`); assert.notEqual(s.transition, d.scenes[i - 1].transition, `transition repeat ${seed}/${i}`); }
      });
    }
  } finally { console.log = log; fs.rmSync(dir, {recursive: true, force: true}); }
});

test('table rejects ragged rows and a highlight out of range', () => {
  const t = {type: 'table', narration: 'x', columns: ['a', 'b']};
  assert.equal(Episode.safeParse({id: 'a', title: 't', scenes: [{...t, rows: [['1', '2'], ['3']]}]}).success, false);
  assert.equal(Episode.safeParse({id: 'a', title: 't', scenes: [{...t, rows: [['1', '2'], ['3', '4']], highlight: 5}]}).success, false);
});
