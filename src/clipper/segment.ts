import type {Word} from './timeline.js';

export type Sentence = {start: number; end: number; words: Word[]; closed: boolean};
export type Candidate = {start: number; end: number; words: Word[]; score: number; reasons: string[]};
export type SegOpts = {min: number; max: number; count: number; gap?: number};

const TERMINAL = /[.!?]["')\]]*$/;
const HOOK = /^(why|how|what|stop|never|secret|nobody|everyone|most|imagine|here'?s|this|truth|biggest|worst|best|warning|mistake|you)\b/i;
const EMO = /\b(love|hate|crazy|insane|shocking|amazing|incredible|terrible|afraid|fear|angry|huge|massive|brutal|painful|never|always|free|dead|secret|mistake|wrong|truth|lie|worst|best)\b/gi;
const NUMWORD = /\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|percent)\b/i;
const DANGLING = /^(and|but|so|because|which|that|then|or|also|however|anyway)\b/i;

/** Merge stray punctuation-only tokens into the previous word, drop empties, sort by time. */
export function normalizeWords(words: Word[]): Word[] {
  const out: Word[] = [];
  for (const raw of [...words].sort((a, b) => a.start - b.start)) {
    const w = raw.w.trim();
    if (!w) continue;
    if (!/[\p{L}\p{N}]/u.test(w) && out.length) { const p = out[out.length - 1]; p.w += w; p.end = Math.max(p.end, raw.end); continue; }
    out.push({w, start: raw.start, end: Math.max(raw.end, raw.start)});
  }
  return out;
}

/** Split into sentences at terminal punctuation or a pause >= gap seconds. */
export function toSentences(words: Word[], gap = 0.7): Sentence[] {
  const out: Sentence[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur, closed: TERMINAL.test(cur[cur.length - 1].w)});
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (TERMINAL.test(w.w) || !next || next.start - w.end >= gap) flush();
  });
  return out;
}

const text = (ws: Word[]) => ws.map(w => w.w).join(' ');

/** Score a run of whole sentences. Higher is better; reasons explain the score. */
export function scoreRun(run: Sentence[]): {score: number; reasons: string[]} {
  const reasons: string[] = [];
  let s = 0;
  const first = run[0], last = run[run.length - 1];
  const ft = text(first.words);
  const words = run.flatMap(r => r.words);
  const dur = last.end - first.start;
  // hook strength at the start
  if (/\?$/.test(ft.trim())) { s += 2; reasons.push('opens with question'); }
  if (HOOK.test(ft)) { s += 1.5; reasons.push('hook word'); }
  if (/\d|\b(one|two|three|five|ten|hundred|thousand|million|billion|percent)\b/i.test(ft)) { s += 1.5; reasons.push('number in hook'); }
  if (first.words.length <= 12) { s += 1; reasons.push('short hook'); }
  if (DANGLING.test(ft)) { s -= 3; reasons.push('starts mid-thought'); }
  // concision: speech density and no long internal dead air
  const wps = words.length / dur;
  if (wps >= 2.2) { s += 1; reasons.push('dense'); } else if (wps < 1.6) s -= 1.5;
  let maxPause = 0;
  for (let i = 1; i < words.length; i++) maxPause = Math.max(maxPause, words[i].start - words[i - 1].end);
  if (maxPause > 1.2) s -= 1.5;
  // content: numbers, questions, emotion across the whole run
  const joined = text(words);
  const nums = (joined.match(/\d+/g) ?? []).length + (NUMWORD.test(joined) ? 1 : 0);
  if (nums) { s += Math.min(1.5, 0.5 * nums); reasons.push('numbers'); }
  const qs = (joined.match(/\?/g) ?? []).length;
  if (qs) { s += Math.min(1, 0.5 * qs); reasons.push('questions'); }
  const emo = (joined.match(EMO) ?? []).length;
  if (emo) { s += Math.min(1.5, 0.5 * emo); reasons.push('emotion'); }
  // closed thought at the end
  if (last.closed) { s += 2; reasons.push('closed ending'); } else s -= 4;
  return {score: Math.round(s * 100) / 100, reasons};
}

/** Pad a run by 0.15-0.3 s of air, never cutting into the neighbouring words. */
export function padRun(run: Sentence[], all: Word[], media?: number): {start: number; end: number} {
  const a = run[0].words[0], b = run[run.length - 1].words.at(-1)!;
  const i = all.indexOf(a), j = all.indexOf(b);
  const before = i > 0 ? a.start - all[i - 1].end : Infinity;
  const after = j >= 0 && j < all.length - 1 ? all[j + 1].start - b.end : Infinity;
  const padB = Math.min(0.3, before / 2), padA = Math.min(0.3, after / 2);
  const end = b.end + padA;
  return {start: Math.max(0, a.start - padB), end: media ? Math.min(media, end) : end};
}

/** Best non-overlapping sentence-aligned clips. Every clip starts on a sentence start and ends on a sentence end. */
export function findCandidates(rawWords: Word[], o: SegOpts, mediaDuration?: number): Candidate[] {
  const all = normalizeWords(rawWords);
  const sents = toSentences(all, o.gap);
  const cands: Candidate[] = [];
  for (let i = 0; i < sents.length; i++) {
    for (let j = i; j < sents.length; j++) {
      const run = sents.slice(i, j + 1);
      const {start, end} = padRun(run, all, mediaDuration);
      const dur = end - start;
      if (dur > o.max) break;
      if (dur < o.min) continue;
      const {score, reasons} = scoreRun(run);
      if (!run[run.length - 1].closed) continue; // never end on a cut-off thought
      cands.push({start, end, words: run.flatMap(r => r.words), score, reasons});
    }
  }
  cands.sort((a, b) => b.score - a.score || a.start - b.start);
  const picked: Candidate[] = [];
  for (const c of cands) {
    if (picked.length >= o.count) break;
    if (picked.every(p => c.end <= p.start || c.start >= p.end)) picked.push(c);
  }
  return picked.sort((a, b) => a.start - b.start);
}
