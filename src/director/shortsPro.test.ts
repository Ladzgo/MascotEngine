import test from 'node:test';
import assert from 'node:assert/strict';
import {Episode} from '../schema.js';
import {splitBeats} from '../draft/beats.js';
import {spreadVisuals} from './shortsPro.js';

const sc = (narration: string, extra: object = {}) => ({type: 'talk', emotion: 'explaining', narration, emphasis: [], ...extra});
const mk = (scenes: object[]) => Episode.parse({id: 't', title: 't', series: 's', seed: 0, format: 'short', look: 'fullbleed', scenes});

test('splitBeats cuts long sentences at a comma when clauses are on', () => {
  const ep = mk([sc('Hook line here.'), sc('Pay only the minimum every single month for years, and the interest quietly eats almost everything you send in.'), sc('Bye.')]);
  const out = splitBeats(ep, {max: 12, clauses: true});
  assert.equal(out.scenes.length, 4);
  assert.ok(out.scenes.every(s => s.narration.split(/\s+/).length <= 12 || s.narration === 'Hook line here.'));
});

test('spreadVisuals never repeats a kind in neighbouring beats', () => {
  const ep = mk([sc('a b.', {visuals: [{kind: 'coins'}]}), sc('c d.', {visuals: [{kind: 'coins'}, {kind: 'cash', at: 'd'}]}), sc('e f.', {visuals: [{kind: 'cash'}]})]);
  const {ep: o, fixed} = spreadVisuals(ep);
  assert.equal(fixed, 1);
  const v = o.scenes.map((s: any) => s.visuals ?? []);
  assert.notEqual(v[0][0].kind, v[1][0].kind); assert.notEqual(v[1].at(-1).kind, v[2][0].kind);
});
