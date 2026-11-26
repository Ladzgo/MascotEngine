import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickVisuals} from './pick';
import {VISUAL_KINDS} from './kinds';
import {ART} from './index';

const sc = (narration: string, visual?: {kind: any}) => ({narration, emphasis: [], emotion: 'neutral' as const, visual});
test('keywords pick relevant art, explicit visual wins, fallback exists', () => {
  assert.equal(pickVisuals(sc('Your credit card charges interest each month')).hero, 'credit_card');
  assert.equal(pickVisuals(sc('Hello there', {kind: 'lock'})).hero, 'lock');
  assert.ok(pickVisuals(sc('Zzz')).hero);
  assert.notEqual(pickVisuals(sc('Credit card interest every month'), '', 0).hero, pickVisuals(sc('Credit card interest every month'), '', 1).hero);
});
test('every kind has art', () => { for (const k of VISUAL_KINDS) assert.ok(ART[k], k); });
