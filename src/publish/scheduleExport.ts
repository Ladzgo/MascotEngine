import fs from 'node:fs';
import path from 'node:path';
import {buildPack, loadEpisodeFile, loadTimings, type Pack} from './publish.js';
import {loadChannel} from '../channel/channel.js';

export type Row = {kind: 'episode' | 'short' | 'clip'; title: string; description: string; tags: string; file: string; language: string; scheduledFor: string; episode: string};
export const COLUMNS: (keyof Row)[] = ['title', 'description', 'tags', 'file', 'language', 'scheduledFor', 'kind', 'episode'];

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** RFC 4180 CSV (CRLF, quotes doubled) with a header row; opens correctly in Sheets, Excel and YouTube bulk tools. */
export const toCsv = (rows: Row[]): string => [COLUMNS.join(','), ...rows.map(r => COLUMNS.map(c => cell(String(r[c] ?? ''))).join(','))].join('\r\n') + '\r\n';

const readJson = <T,>(f: string): T | null => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const files = (d: string, re: RegExp) => (fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort() : []);

/** One row per finished episode video, per Short and per Clipper clip: the sheet to upload from. Offline: titles/description come from build/publish.json or the offline pack. */
export async function scheduleRows(root: string): Promise<Row[]> {
  const rows: Row[] = [];
  const epRoot = path.join(root, 'episodes');
  for (const id of files(epRoot, /^[a-z0-9-]+$/)) {
    const dir = path.join(epRoot, id), build = path.join(dir, 'build');
    const status = readJson<{archived?: boolean; scheduledFor?: string; state?: string}>(path.join(dir, 'status.json')) ?? {};
    const final = path.join(build, `${id}-final.mp4`);
    if (status.archived || !fs.existsSync(final) || !fs.existsSync(path.join(dir, 'episode.json'))) continue;
    let pack = readJson<Pack>(path.join(build, 'publish.json'));
    let lang = 'en';
    try { const ch = loadChannel(loadEpisodeFile(root, id).ep.channel ?? 'default'); lang = ch.language; if (!pack) { const {ep} = loadEpisodeFile(root, id); const t = loadTimings(dir); pack = await buildPack({ep, timings: t.timings, totalSec: t.totalSec, channel: ch, warn: () => {}}); } } catch { /* no pack: title only */ }
    const ep = loadEpisodeFile(root, id).ep;
    const title = pack?.titles?.[0] ?? ep.title, tags = (pack?.tags ?? []).join(';');
    const when = status.scheduledFor ?? '';
    rows.push({kind: 'episode', title, description: pack?.description ?? '', tags, file: final, language: lang, scheduledFor: when, episode: id});
    for (const s of files(path.join(build, 'shorts'), /\.mp4$/)) rows.push({kind: 'short', title: `${title} #Shorts`.slice(0, 100), description: pack?.description?.split('\n')[0] ?? title, tags: [...(pack?.tags ?? []), 'shorts'].join(';'), file: path.join(build, 'shorts', s), language: lang, scheduledFor: '', episode: id});
  }
  const clipRoot = path.join(root, 'out', 'clips');
  for (const name of files(clipRoot, /^[A-Za-z0-9._-]+$/)) {
    const tl = readJson<{clips?: {id: string; text: string; file?: string}[]}>(path.join(clipRoot, name, 'timeline.json'));
    for (const c of tl?.clips ?? []) if (c.file && fs.existsSync(c.file)) rows.push({kind: 'clip', title: c.text.split(/(?<=[.!?])\s/)[0].slice(0, 90), description: c.text.slice(0, 400), tags: 'shorts', file: c.file, language: 'en', scheduledFor: '', episode: name});
  }
  return rows;
}
