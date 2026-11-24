import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHORTS_SAFE, captionLayout} from './captions.js';
import {CaptionPrefs} from '../schema.js';
import {Channel} from '../channel/channel.js';

test('wide defaults keep the old look', () => {
  assert.deepEqual(captionLayout(undefined, 'wide'), {size: 58, maxWidth: 1560, anchor: 'bottom', offset: 50});
});

test('shorts: captions never enter the Shorts UI zones, whatever the preset asks', () => {
  for (const position of ['bottom', 'top', 'middle'] as const) {
    const l = captionLayout(CaptionPrefs.parse({position, size: 120}), 'short');
    assert.ok(l.size <= 96, 'size capped');
    assert.ok(l.maxWidth <= 1080 - 2 * SHORTS_SAFE.side, 'clear of the right button column, symmetric');
    if (position === 'bottom') assert.ok(l.offset >= SHORTS_SAFE.bottom);
    if (position === 'top') assert.ok(l.offset >= SHORTS_SAFE.top);
  }
});

test('preset: size and highlight round-trip through the channel schema; bad values rejected', () => {
  const ch = Channel.parse({id: 'x', name: 'X', captions: {style: 'pill', size: 70, highlight: 'underline'}});
  assert.equal(ch.captions?.position, 'bottom');
  assert.equal(captionLayout(ch.captions, 'wide').size, 70);
  assert.equal(CaptionPrefs.safeParse({size: 10}).success, false);
});
