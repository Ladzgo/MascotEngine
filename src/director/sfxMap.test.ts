import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sfxForShot} from './sfxMap.js';
import {synth} from '../pipeline/audio.js';

test('object sounds follow subject and action; data beats stay silent here; new cues are audible and finite', () => {
  assert.equal(sfxForShot({subject: 'coin_stacks', action: 'stack'}, 'talk'), 'coin');
  assert.equal(sfxForShot({subject: 'coin_stacks', action: 'drop'}, 'talk'), 'coin');
  assert.equal(sfxForShot({subject: 'anchor', action: 'sink'}, 'talk'), 'thud');
  assert.equal(sfxForShot({subject: 'trophy', action: 'pop_in'}, 'talk'), 'ding');
  assert.equal(sfxForShot({subject: 'card_swipe', action: 'swipe'}, 'talk'), 'click');
  assert.equal(sfxForShot({subject: 'heart', action: 'pulse'}, 'talk'), null);
  assert.equal(sfxForShot({subject: 'coin_stacks', action: 'drop'}, 'big_number'), null);
  for (const k of ['coin', 'click', 'thud'] as const) { const w = synth(k, 2); assert.ok(w.length > 100 && w.every(Number.isFinite) && Math.max(...w.map(Math.abs)) > 0.05, k); }
});
