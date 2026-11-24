import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deletePreset, listPresets, savePreset} from './userPresets.js';

test('user presets: save, list next to built-ins, delete; built-ins protected', () => {
  process.env.PRESETS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-'));
  const builtin = listPresets().length;
  savePreset('mine', {name: 'Mine', niche: 'cats', language: 'hu', accent: 'green', branding: {cta: 'Hi', outroSec: 2, watermark: true}} as never);
  const rows = listPresets();
  assert.equal(rows.length, builtin + 1);
  const m = rows.find(r => r.id === 'mine')!;
  assert.deepEqual([m.builtin, m.preset.name, m.preset.accent, m.preset.branding?.cta], [false, 'Mine', 'green', 'Hi']);
  assert.throws(() => savePreset('finance', {name: 'x'} as never), /built-in/);
  assert.throws(() => savePreset('../x', {name: 'x'} as never), /lowercase/);
  deletePreset('mine');
  assert.equal(listPresets().length, builtin);
  assert.throws(() => deletePreset('finance'));
});
