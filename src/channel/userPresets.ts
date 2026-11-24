import fs from 'node:fs';
import path from 'node:path';
import {Channel} from './channel.js';
import {PRESETS, type Preset} from './presets.js';

const ID = /^[a-z0-9-]{1,40}$/;
/** User presets live in data/presets/<id>.json (local, never committed); PRESETS_DIR overrides (tests). */
const dir = () => process.env.PRESETS_DIR ?? new URL('../../data/presets/', import.meta.url).pathname;

export type PresetRow = {id: string; builtin: boolean; preset: Preset};

export function listPresets(): PresetRow[] {
  const mine: PresetRow[] = fs.existsSync(dir()) ? fs.readdirSync(dir()).filter(f => f.endsWith('.json') && ID.test(f.slice(0, -5))).flatMap(f => {
    try { const {id: _i, createdAt: _c, ...p} = Channel.parse({...JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8')), id: f.slice(0, -5)}); return [{id: f.slice(0, -5), builtin: false, preset: p}]; } catch { return []; }
  }) : [];
  return [...Object.entries(PRESETS).map(([id, preset]) => ({id, builtin: true, preset})), ...mine.filter(m => !(m.id in PRESETS))];
}

/** Save a channel's profile as a user preset. Built-in ids cannot be overwritten. */
export function savePreset(id: string, ch: Omit<Channel, 'id' | 'createdAt'> & Partial<Pick<Channel, 'id' | 'createdAt'>>): string {
  if (!ID.test(id)) throw new Error('Preset id: lowercase letters, numbers and dashes only (max 40).');
  if (id in PRESETS) throw new Error(`"${id}" is a built-in preset; pick another id.`);
  const {id: _i, createdAt: _c, ...rest} = Channel.parse({...ch, id: 'x'});
  fs.mkdirSync(dir(), {recursive: true});
  fs.writeFileSync(path.join(dir(), `${id}.json`), JSON.stringify(rest, null, 2));
  return id;
}

export function deletePreset(id: string): void {
  if (!ID.test(id) || id in PRESETS) throw new Error('Only your own presets can be deleted.');
  fs.rmSync(path.join(dir(), `${id}.json`), {force: true});
}
