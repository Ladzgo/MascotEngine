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

import {fitDuration} from './shortsPro.js';
test('fitDuration drops the longest middle talk beats but keeps hook and ending', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve';
  const ep = mk(Array.from({length: 14}, (_, i) => sc(i % 2 ? long : 'short beat here now')));
  const {ep: o, dropped} = fitDuration(ep, 30);
  assert.ok(dropped > 0 && o.scenes.length >= 8);
  assert.equal(o.scenes[0].narration, 'short beat here now'); assert.equal(o.scenes.at(-1)!.narration, ep.scenes.at(-1)!.narration);
});

test('splitBeats: a long two-sentence Short data scene keeps its first sentence, the rest becomes a talk beat', () => {
  const ep = mk([sc('Hook.'), {type: 'list', emotion: 'explaining', narration: 'Mortality risk drops 30% at 7,500 steps. Then it plateaus for good.', items: ['30% lower risk', '7,500 steps'], emphasis: []}, sc('Bye.')]);
  const out = splitBeats(ep, {max: 11, clauses: true});
  assert.deepEqual(out.scenes.map(s => [s.type, s.narration]), [['talk', 'Hook.'], ['list', 'Mortality risk drops 30% at 7,500 steps.'], ['talk', 'Then it plateaus for good.'], ['talk', 'Bye.']]);
});

test('splitBeats: a one-sentence data scene is never cut at a comma; tiny clause fragments stay attached', () => {
  const ep = mk([sc('Hook.'), {type: 'compare', emotion: 'explaining', narration: 'On a 5,000 balance, that equals a $100 payment.', emphasis: [], left: {title: 'a', value: '1'}, right: {title: 'b', value: '2'}}, sc('Pay it off, done, and the interest stops piling up month after month for good.'), sc('Bye.')]);
  const out = splitBeats(ep, {max: 11, clauses: true});
  assert.equal(out.scenes[1].narration, 'On a 5,000 balance, that equals a $100 payment.');
  assert.ok(out.scenes.every(s => s.narration.split(/\s+/).length >= 3 || /^(Hook|Bye)/.test(s.narration)), out.scenes.map(s => s.narration).join(' | '));
});
