import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseTopics, runBatch, slug, stageArgs} from './batch.js';

test('slug is safe, short and unique', () => {
  const taken = new Set(['why-prices-rise']);
  assert.equal(slug('Why prices rise?!', taken), 'why-prices-rise-2');
  assert.match(slug('A very long topic title that keeps going and going forever', taken), /^[a-z0-9-]{1,40}$/);
  assert.equal(slug('???', taken), 'episode');
});

test('parseTopics skips comments, blanks, duplicates', () => {
  assert.deepEqual(parseTopics('# x\nA\n\n  B \nA\n'), ['A', 'B']);
});

test('runBatch continues after a failing topic and writes the report', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b-')), 'r.json');
  const calls: string[] = [];
  const run = async (a: string[]) => { calls.push(a.slice(1, 2).concat(a.includes('bad-topic') ? ['bad'] : []).join(':')); return a[1] === 'tts' && a.includes('bad-topic') ? {code: 1, out: 'boom\n'} : {code: 0, out: ''}; };
  const rep = await runBatch({topics: ['good one', 'bad topic', 'good two'], channel: 'default', engine: 'auto', run, reportFile: file, log: () => {}});
  assert.equal(rep.ok, 2); assert.equal(rep.failed, 1);
  const bad = rep.items[1];
  assert.deepEqual(bad.stages.map(s => s.stage), ['draft', 'voice']); // stops this topic after the failure
  assert.equal(bad.stages[1].error, 'boom');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).items.length, 3);
  assert.equal(stageArgs('draft', {topic: 't', id: 'i', channel: 'c', engine: 'e'})[2], '--');
});
