import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Channel, loadChannel, saveChannel, listChannels, channelContext} from './channel.js';
import {recentForChannel} from '../director/direct.js';
import {pickVoiceId} from '../pipeline/tts.js';
import {Episode} from '../schema.js';

const tmp = () => { process.env.CHANNELS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-')) + '/'; };
const ep = (channel?: string) => Episode.parse({
  id: 'x', title: 't', ...(channel ? {channel} : {}), scenes: [{type: 'talk', narration: 'hi'}],
});

test('default channel auto-created; episodes default to it', () => {
  tmp();
  const c = loadChannel();
  assert.equal(c.name, 'Money Myths');
  assert.ok(fs.existsSync(path.join(process.env.CHANNELS_DIR!, 'default/channel.json')));
  assert.equal(ep().channel, 'default');
  assert.deepEqual(listChannels().map(x => x.id), ['default']);
});

test('save/load roundtrip, validation, context', () => {
  tmp();
  saveChannel(Channel.parse({id: 'cats', name: 'Cats', niche: 'pets', bannedTopics: ['dogs']}));
  const c = loadChannel('cats');
  assert.equal(c.language, 'en');
  assert.match(channelContext(c), /Banned topics: dogs/);
  assert.throws(() => loadChannel('nope'));
  assert.throws(() => loadChannel('Bad_ID'));
  assert.equal(listChannels().length, 2);
});

test('history is isolated per channel', () => {
  const e = (id: string, channel?: string) => ({id, ...(channel ? {channel} : {}), accent: 'a', background: 'b', captionStyle: 'c', intro: 'i', music: 'm', scenes: []});
  const h = {episodes: [e('a1'), e('a2', 'default'), e('b1', 'cats')]};
  assert.deepEqual(recentForChannel(h, 'default', 'zz').map(x => x.id), ['a1', 'a2']);
  assert.deepEqual(recentForChannel(h, 'cats', 'zz').map(x => x.id), ['b1']);
  assert.deepEqual(recentForChannel(h, 'other', 'zz'), []);
});

test('voiceId: channel wins, env fallback', () => {
  tmp();
  saveChannel(Channel.parse({id: 'cats', name: 'Cats', voiceId: 'VOICE_C'}));
  const env = {ELEVENLABS_VOICE_ID: 'ENV'} as NodeJS.ProcessEnv;
  assert.equal(pickVoiceId(ep('cats'), env), 'VOICE_C');
  assert.equal(pickVoiceId(ep(), env), 'ENV');
  assert.equal(pickVoiceId(ep('missing'), env), 'ENV');
});

import {PRESETS, fromPreset} from './presets.js';
import {ACCENT_HEX} from '../accents.js';
test('presets: three valid profiles with known accents; unknown preset errors; save/load works', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['finance', 'history', 'tech']);
  for (const k of Object.keys(PRESETS)) {
    const c = fromPreset(k, `my-${k}`);
    assert.ok(c.accent && ACCENT_HEX[c.accent], `${k} accent`);
    assert.ok(c.tone.length > 40 && c.bannedTopics.length >= 2 && c.voiceStyle);
  }
  assert.equal(fromPreset('tech', 'x', {name: 'My Tech'}).name, 'My Tech');
  assert.throws(() => fromPreset('cooking', 'x'), /Unknown preset/);
  tmp();
  saveChannel(fromPreset('history', 'hist'));
  assert.equal(loadChannel('hist').niche, 'history and ancient civilisations');
});

import {loadBranding} from './branding.js';
test('branding is opt-in: none without config, accent/handle/cta/image when configured, bad values rejected', () => {
  tmp();
  assert.equal(loadBranding('default'), null);
  const c = Channel.parse({id: 'b', name: 'B', accent: 'teal', branding: {handle: '@b', cta: 'Subscribe'}});
  assert.equal(c.branding?.outroSec, 2);
  saveChannel(c);
  fs.writeFileSync(path.join(process.env.CHANNELS_DIR!, 'b/watermark.png'), Buffer.from([137, 80, 78, 71]));
  const b = loadBranding('b')!;
  assert.deepEqual([b.handle, b.cta, b.accent, b.outroSec], ['@b', 'Subscribe', ACCENT_HEX.teal, 2]);
  assert.match(b.image!, /^data:image\/png;base64,/);
  assert.equal(loadBranding('nope'), null);
  assert.throws(() => Channel.parse({id: 'x', name: 'X', branding: {outroSec: 30}}));
});
