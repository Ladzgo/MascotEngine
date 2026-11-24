import test from 'node:test';
import assert from 'node:assert/strict';
import {conflicts, dayKey, nextSlots} from './web/src/cadence.js';

test('nextSlots: Mon/Wed/Fri from a Tuesday, skipping a taken day', () => {
  const tue = new Date(2026, 10, 24); // Tuesday
  assert.deepEqual(nextSlots(tue, [1, 3, 5], 4).map(dayKey), ['2026-11-25', '2026-11-27', '2026-11-30', '2026-12-02']);
  assert.deepEqual(nextSlots(tue, [1, 3, 5], 2, new Set(['2026-11-25'])).map(dayKey), ['2026-11-27', '2026-11-30']);
  assert.deepEqual(nextSlots(tue, [], 3), []);
});
test('conflicts: two episodes of one channel on one day, other channels do not clash', () => {
  const at = (h: number) => new Date(2026, 10, 25, h).toISOString();
  const c = conflicts([{id: 'a', channel: 'x', when: at(9)}, {id: 'b', channel: 'x', when: at(18)}, {id: 'c', channel: 'y', when: at(9)}]);
  assert.deepEqual(c, {'2026-11-25': ['a', 'b']});
});
