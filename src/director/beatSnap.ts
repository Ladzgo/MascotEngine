// Music-aware cuts: the bed starts at an episode-hash bar (audio.ts), so the director knows where every beat of the music falls
// and nudges a cut forward onto the next beat when it is at most 80 ms away (a frame or two of extra tail, never shorter speech).
import fs from 'node:fs';

const musicDir = new URL('../../assets/music/', import.meta.url).pathname;
export const bedBpm = (track: string | null | undefined, dir = musicDir): number | undefined => {
  if (!track) return undefined;
  try { return JSON.parse(fs.readFileSync(`${dir}index.json`, 'utf8'))[track]?.bpm as number | undefined; } catch { return undefined; }
};
/** Seconds into the bed where the episode's music starts: a whole bar picked from the episode id and seed (beds loop, so any bar works). */
export const musicOffset = (id: string, seed: number, bpm: number | undefined) => {
  if (!bpm) return 0;
  const bar = [...(id ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 16, (seed ?? 0) % 16);
  return bar * 240 / bpm;
};

/** Extends scene durations so cuts land on the music's beat grid when the next beat is within `maxShift` s; start times follow. Returns how many cuts moved. */
export function snapCuts(scenes: {startSec: number; durSec: number}[], bpm: number | undefined, offset: number, maxShift = 0.08, fps = 30): number {
  if (!bpm || scenes.length < 2) return 0;
  const period = 60 / bpm;
  let moved = 0, cursor = scenes[0].startSec;
  scenes.forEach((s, i) => {
    s.startSec = Math.round(cursor * 1e4) / 1e4;
    if (i < scenes.length - 1) {
      const cut = cursor + s.durSec, phase = (cut + offset) % period, delta = phase < 1e-6 ? 0 : period - phase;
      const frames = Math.ceil(delta * fps - 1e-6);
      if (frames > 0 && delta <= maxShift) { s.durSec = Math.round((s.durSec + frames / fps) * 1e4) / 1e4; moved++; }
    }
    cursor += s.durSec;
  });
  return moved;
}
