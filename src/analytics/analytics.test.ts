import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hms, mergeImport, parseCsv, parseStudioCsv, type RetentionData} from './retention.js';
import {sceneRetention} from './summary.js';

test('parseCsv handles BOM, quotes, commas, CRLF', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
});

test('table export: per-video stats, total row dropped, durations parsed', () => {
  const p = parseStudioCsv('Content,Video title,Views,Average view duration,Average percentage viewed (%),Impressions click-through rate (%)\nTotal,,100,0:30,40,5\nabc,Why Cash Melts,"1,200",1:05,52.5,6.1\n');
  assert.equal(p.kind, 'table');
  if (p.kind === 'table') { assert.equal(p.videos.length, 1); assert.deepEqual([p.videos[0].views, p.videos[0].avgViewSec, p.videos[0].avgPctViewed, p.videos[0].ctr], [1200, 65, 52.5, 6.1]); }
  assert.equal(hms('1:02:03'), 3723);
});

test('curve export (percent positions) resamples to 101 points; merge needs an episode id', () => {
  const rows = ['Video position (%),Absolute audience retention (%)', ...Array.from({length: 21}, (_, i) => `${i * 5},${100 - i * 3}`)].join('\n');
  const p = parseStudioCsv(rows);
  assert.equal(p.kind, 'curve');
  if (p.kind !== 'curve') return;
  assert.equal(p.curve.length, 101); assert.equal(p.curve[0], 100); assert.equal(p.curve[100], 40);
  const d: RetentionData = {version: 1, videos: {}};
  assert.throws(() => mergeImport(d, p));
  mergeImport(d, p, {episode: 'ep1'});
  assert.equal(d.videos.ep1.curve?.length, 101);
  assert.throws(() => parseStudioCsv('foo,bar\n1,2'), /Unrecognised/);
});

test('sceneRetention: loss per 10 s per scene', () => {
  const curve = Array.from({length: 101}, (_, i) => 100 - i * 0.5); // linear 100 -> 50
  const r = sceneRetention(curve, [{index: 0, type: 'title', startSec: 0, durSec: 20}, {index: 1, type: 'talk', startSec: 20, durSec: 80}], 100);
  assert.equal(r[0].startPct, 100); assert.equal(r[0].endPct, 90);
  assert.equal(r[0].lossPer10s, 5); assert.equal(r[1].lossPer10s, 5);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {retentionWeights, summarize} from './summary.js';
test('retentionWeights is neutral ({}) with no data; with 3 curves it stays within 0.9..1.1', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-'));
  assert.deepEqual(retentionWeights(root), {});
  const videos: Record<string, unknown> = {};
  for (let n = 1; n <= 3; n++) {
    fs.mkdirSync(`${root}/episodes/e${n}/build`, {recursive: true});
    fs.writeFileSync(`${root}/episodes/e${n}/build/decisions.json`, JSON.stringify({totalSec: 60, hook: {kind: 'punch_in'}, scenes: [{index: 0, type: 'title', startSec: 0, durSec: 10}, {index: 1, type: 'talk', startSec: 10, durSec: 25}, {index: 2, type: 'chart', startSec: 35, durSec: 25}]}));
    // talk scenes lose viewers faster than chart scenes
    videos[`e${n}`] = {title: 't', episode: `e${n}`, importedAt: '', curve: Array.from({length: 101}, (_, i) => { const s = (i / 100) * 60; return 100 - (s < 10 ? s * 0.5 : s < 35 ? 5 + (s - 10) * 1.2 : 35 + (s - 35) * 0.2); })};
  }
  fs.mkdirSync(`${root}/data`);
  fs.writeFileSync(`${root}/data/retention.json`, JSON.stringify({version: 1, videos}));
  const s = summarize(root);
  assert.equal(s.best, 'chart'); assert.equal(s.worst, 'talk');
  const w = retentionWeights(root);
  assert.ok(w.chart > w.talk && w.chart <= 1.1 && w.talk >= 0.9);
});
