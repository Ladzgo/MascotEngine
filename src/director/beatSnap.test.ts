import test from 'node:test';
import assert from 'node:assert/strict';
import {musicOffset, snapCuts} from './beatSnap.js';

test('snapCuts moves a cut forward onto the next beat only within 80 ms, in whole frames', () => {
  // 120 bpm: beats every 0.5 s. Cut 1 at 59 frames = 1.967 s (next beat 2.0, one frame away) moves; cut 2 at 2.0+1.2=3.2 (next beat 3.5, 300 ms) stays
  const sc = [{startSec: 0, durSec: 59 / 30}, {startSec: 59 / 30, durSec: 1.2}, {startSec: 3.167, durSec: 1}];
  assert.equal(snapCuts(sc, 120, 0), 1);
  assert.equal(sc[0].durSec, 2); assert.equal(sc[1].startSec, 2); assert.equal(sc[2].startSec, 3.2);
  assert.equal(snapCuts([{startSec: 0, durSec: 1}, {startSec: 1, durSec: 1}], undefined, 0), 0);
  assert.equal(musicOffset('ep1', 0, undefined), 0);
  assert.ok(musicOffset('ep1', 0, 120) % 2 === 0); // whole bars of 2 s at 120 bpm
});
