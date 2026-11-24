import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CH, CW, judge, type Rgb} from './shortsCheck.js';

const solid = (r: number, g: number, b: number): Rgb => { const f = new Uint8Array(CW * CH * 3); for (let i = 0; i < f.length; i += 3) { f[i] = r; f[i + 1] = g; f[i + 2] = b; } return f; };
const withInk = (f: Rgb, share: number): Rgb => { const o = new Uint8Array(f); for (let p = 0; p < CW * CH * share; p++) o[p * 3] = o[p * 3 + 1] = o[p * 3 + 2] = 20; return o; };
const paper = solid(246, 241, 228);

test('judge passes a looping hook-first short and flags empty hook, empty frames and loop jump', () => {
  const body = withInk(paper, 0.2);
  assert.ok(judge({first: paper, hook: body, p15: body, p50: body, p90: body, last: paper}).ok);
  const bad = judge({first: paper, hook: paper, p15: paper, p50: body, p90: body, last: solid(20, 20, 20)});
  assert.ok(!bad.ok);
  assert.equal(bad.problems.length, 3); // hook empty, p15 empty, loop jump
});
