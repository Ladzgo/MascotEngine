import fs from 'node:fs';
import path from 'node:path';
import {buildPhrases, toSrt, type CaptionWord, type Phrase} from '../fx/captions.js';
import {buildChapters, fmtTime, loadEpisodeFile, loadTimings} from './publish.js';

const pad = (n: number, l = 2) => String(n).padStart(l, '0');
export const vttTime = (s: number) => { const ms = Math.round(Math.max(0, s) * 1000); return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`; };

/** WebVTT with word-level timing tags (`<00:00:01.200><c>word</c>`); players without karaoke support show plain phrases. */
export function toVtt(phrases: Phrase[]): string {
  const cues = phrases.map((p, i) => {
    const end = Math.min(p.end + 0.2, phrases[i + 1]?.start ?? Infinity);
    const text = p.words.map((w, k) => (k ? `<${vttTime(w.start)}><c>${w.w}</c>` : w.w)).join(' ');
    return `${vttTime(p.start)} --> ${vttTime(end)}\n${text}\n`;
  });
  return `WEBVTT\n\n${cues.join('\n')}`;
}

/** Absolute-time words per scene from decisions.json + timings.json (the same mapping the renderer uses). */
export function sceneWords(dec: any, tim: any): CaptionWord[][] {
  return dec.scenes.map((d: any, i: number) => tim.scenes[i].words.map((w: any) => ({w: w.w, start: d.startSec + w.start - tim.scenes[i].start + d.speechStart, end: d.startSec + w.end - tim.scenes[i].start + d.speechStart})));
}

export function exportSubtitles(root: string, id: string): {srt: string; vtt: string; chapters: string | null} {
  const {ep, dir} = loadEpisodeFile(root, id), b = path.join(dir, 'build');
  const dec = JSON.parse(fs.readFileSync(path.join(b, 'decisions.json'), 'utf8')), tim = JSON.parse(fs.readFileSync(path.join(b, 'timings.json'), 'utf8'));
  const phrases = buildPhrases(sceneWords(dec, tim));
  const srt = path.join(b, `${ep.id}.srt`), vtt = path.join(b, `${ep.id}.vtt`);
  fs.writeFileSync(srt, toSrt(phrases));
  fs.writeFileSync(vtt, toVtt(phrases));
  const {timings, totalSec} = loadTimings(dir);
  const ch = buildChapters(ep.scenes, timings, totalSec, ep.title);
  let chapters: string | null = null;
  if (ch.length) { chapters = path.join(b, 'chapters.txt'); fs.writeFileSync(chapters, ch.map(c => `${fmtTime(c.startSec)} ${c.title}`).join('\n') + '\n'); }
  return {srt, vtt, chapters};
}
