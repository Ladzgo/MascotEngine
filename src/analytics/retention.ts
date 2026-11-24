import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
export const RETENTION_FILE = `${ROOT}data/retention.json`;

export type VideoStats = {
  title: string; episode?: string; views?: number; avgPctViewed?: number; avgViewSec?: number; ctr?: number;
  curve?: number[]; // audience retention, 0..100 at 101 evenly spaced positions (0%..100% of the video)
  importedAt: string;
};
export type RetentionData = {version: 1; videos: Record<string, VideoStats>};

/** Minimal RFC-4180 CSV reader (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0], sep = first.split(';').length > first.split(',').length ? ';' : ','; // hu/de Excel locales export ';'
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => { const n = parseFloat((s ?? '').replace(/^(\d+),(\d{1,2})%?$/, '$1.$2').replace(/[%,\s]/g, '')); return Number.isFinite(n) ? n : undefined; };
const col = (head: string[], ...needles: RegExp[]) => head.findIndex(h => needles.some(n => n.test(h.trim().toLowerCase())));
/** "1:23" or "0:01:23" or seconds -> seconds. */
export const hms = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const p = s.trim().split(':').map(Number);
  return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, b) => a * 60 + b, 0) : num(s);
};

export type Parsed = {kind: 'table'; videos: Omit<VideoStats, 'importedAt'>[]} | {kind: 'curve'; curve: number[]};

/** Detects YouTube Studio's per-video "Table data" export or an "Audience retention" curve export. */
export function parseStudioCsv(text: string): Parsed {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV is empty.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const pos = col(head, /video position/, /videópozíció/, /^time$/), ret = col(head, /audience retention/, /közönség megtartása/, /absolute audience retention/, /audience watching/);
  if (pos >= 0 && ret >= 0) {
    const pts = rows.slice(1).map(r => ({x: num(r[pos]), y: num(r[ret])})).filter((p): p is {x: number; y: number} => p.x !== undefined && p.y !== undefined);
    if (pts.length < 5) throw new Error('Retention CSV has too few rows.');
    const maxX = Math.max(...pts.map(p => p.x)), scale = maxX <= 100 ? 1 : 100 / maxX; // % positions or absolute seconds
    const curve = Array.from({length: 101}, (_, k) => {
      const x = k / scale; let best = pts[0];
      for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
      return best.y;
    });
    // some exports give 0..1 instead of percent
    return {kind: 'curve', curve: Math.max(...curve) <= 1.5 ? curve.map(v => v * 100) : curve};
  }
  const t = [/^video title$/, /^videó címe$/, /^title$/, /^content$/, /^tartalom$/].map(n => col(head, n)).find(i => i >= 0) ?? -1, // title beats the video-id 'Content' column
     v = col(head, /^views$/, /^megtekintések$/), pct = col(head, /average percentage viewed/, /átlagos megtekintett százalék/), dur = col(head, /average view duration/, /átlagos megtekintési időtartam/), ctr = col(head, /click-through rate/, /átkattintási arány/);
  if (t < 0 || (v < 0 && pct < 0)) throw new Error('Unrecognised CSV: expected a "Table data" export (Content/Video title + Views) or an "Audience retention" export (Video position + retention).');
  const videos = rows.slice(1).filter(r => r[t]?.trim() && !/^total$/i.test(r[t].trim())).map(r => ({title: r[t].trim(), views: v >= 0 ? num(r[v]) : undefined, avgPctViewed: pct >= 0 ? num(r[pct]) : undefined, avgViewSec: dur >= 0 ? hms(r[dur]) : undefined, ctr: ctr >= 0 ? num(r[ctr]) : undefined}));
  return {kind: 'table', videos};
}

export function loadRetention(file = RETENTION_FILE): RetentionData {
  try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); if (d?.videos) return d; } catch { /* none yet */ }
  return {version: 1, videos: {}};
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Merge a parsed export. Table rows are matched to episodes by title; a curve needs `episode`. Returns the keys touched. */
export function mergeImport(data: RetentionData, p: Parsed, o: {episode?: string; titles?: Record<string, string>} = {}): string[] {
  const now = new Date().toISOString(), touched: string[] = [];
  if (p.kind === 'curve') {
    if (!o.episode) throw new Error('A retention curve belongs to one video: pass --id <episode-id>.');
    const cur = data.videos[o.episode] ?? {title: o.titles?.[o.episode] ?? o.episode, importedAt: now};
    data.videos[o.episode] = {...cur, episode: o.episode, curve: p.curve, importedAt: now};
    return [o.episode];
  }
  const byTitle = new Map(Object.entries(o.titles ?? {}).map(([id, t]) => [norm(t), id]));
  for (const v of p.videos) {
    const ep = o.episode && p.videos.length === 1 ? o.episode : byTitle.get(norm(v.title));
    const key = ep ?? norm(v.title);
    data.videos[key] = {...data.videos[key], ...v, ...(ep ? {episode: ep} : {}), importedAt: now};
    touched.push(key);
  }
  return touched;
}

export function saveRetention(data: RetentionData, file = RETENTION_FILE) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
