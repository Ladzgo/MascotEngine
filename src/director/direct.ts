import fs from 'node:fs';
import {episodeDir, loadEpisode, type Scene} from '../schema.js';
import type {Timings} from '../pipeline/tts.js';
import type {EpisodeDecisions, History, HistoryEntry, SceneDecision, SfxCue} from './types.js';

import {ACCENT_HEX as ACCENTS} from '../accents.js';
export {ACCENTS};
const BACKGROUNDS = ['plain', 'grid', 'dots', 'vignette'] as const;
const CAPTIONS = ['bar', 'pill', 'outline'] as const;
const INTROS = ['ink_draw', 'pop', 'slide'] as const;
const MOODS = ['calm', 'curious', 'tense', 'upbeat'] as const;
const CAMERAS = ['static', 'slow_push', 'slow_pull', 'pan_left', 'pan_right', 'drift'];
const TRANSITIONS = ['cut', 'slide', 'wipe_ink', 'circle_reveal', 'zoom_through', 'paper_flip'];

const LAYOUTS: Record<string, string[]> = {
  title: ['center', 'closeup'],
  talk: ['center', 'keyword_side', 'closeup', 'over_shoulder'],
  big_number: ['center', 'char_left', 'char_right'],
  chart: ['char_left', 'char_right', 'char_corner', 'fullscreen'],
  compare: ['split', 'split_char_center'],
  before_after: ['split', 'split_char_center'],
  timeline: ['char_corner', 'fullscreen'],
  list: ['char_left', 'char_right', 'center_list'],
};

const POSE_BY_EMOTION: Record<string, string[]> = {
  neutral: ['neutral', 'reading', 'explain_dir'],
  smug: ['smug', 'thumbs_up'],
  worried: ['worried', 'sweating'],
  shocked: ['shocked', 'sweating'],
  happy: ['happy', 'thumbs_up'],
  excited: ['excited', 'counting_money'],
  thinking: ['thinking', 'reading', 'writing'],
  explaining: ['explain_dir', 'pointing_up'],
  angry: ['angry', 'facepalm'],
  sad: ['sad'],
  confused: ['confused', 'thinking'],
  sweating: ['sweating', 'worried'],
};

// ---------- seeded randomness ----------
function hash(str: string): number {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], score: (x: T) => number, rand: () => number): T {
  const w = items.map(i => Math.max(score(i), 0.0001));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
const noise = (rand: () => number) => 0.75 + rand() * 0.5;

// ---------- content-fit rules ----------
const surprising = (s: Scene) =>
  s.type === 'big_number' || ['shocked', 'excited', 'angry'].includes(s.emotion);

const musicDir = new URL('../../assets/music/', import.meta.url).pathname;
/** Bed file for a mood (calm = the original pad), null when that file is not installed. */
const moodTrack = (mood: string) => { const f = mood === 'calm' ? 'ambient-pad.mp3' : `ambient-${mood}.mp3`; return fs.existsSync(musicDir + f) ? f : null; };

function fitLayout(layout: string, s: Scene): number {
  if (s.type === 'big_number' && s.emotion === 'shocked' && layout === 'center') return 1.6;
  if (s.type === 'talk' && s.quote) return layout === 'keyword_side' ? 8 : 0.05; // quote card lives in the keyword_side content box
  if (s.type === 'talk' && s.emphasis.length && layout === 'keyword_side') return 1.8;
  if (s.type === 'talk' && ['worried', 'sad', 'sweating'].includes(s.emotion) && layout === 'closeup') return 1.6;
  if (s.type === 'chart' && layout === 'fullscreen') return 0.7;
  if (s.type === 'title' && layout === 'closeup') return 0.8;
  return 1;
}
type Pace = 'punchy' | 'normal' | 'explain';
/** Pace class from word timestamps: sentence length (split on . ! ?) and speaking rate. */
export function paceOf(words: {w: string}[], speechDur: number): Pace {
  if (!words.length || speechDur <= 0) return 'normal';
  const sentences = Math.max(1, words.filter(w => /[.!?…]["')\]]*$/.test(w.w)).length);
  const avg = words.length / sentences;
  const wps = words.length / speechDur;
  if (avg <= 9 || (wps > 3.4 && avg <= 12)) return 'punchy';
  if (avg >= 18 || (wps < 2.2 && avg >= 14)) return 'explain';
  return 'normal';
}
function paceCamera(cam: string, pace: Pace): number {
  if (pace === 'punchy') return cam === 'static' ? 1.5 : cam === 'drift' ? 0.6 : 1;
  if (pace === 'explain') return cam === 'drift' || cam === 'slow_pull' || cam === 'slow_push' ? 1.4 : cam === 'static' ? 0.7 : 0.9;
  return 1;
}
const HOOK_EMOTIONS = ['shocked', 'excited'];
const MIN_TAIL = 0.2;
const JCUT = 0.3;
const MAX_STILL = 4.5;
function fitCamera(cam: string, s: Scene): number {
  if (s.type === 'list' || s.type === 'chart' || s.type === 'timeline') return cam === 'static' || cam === 'slow_push' ? 1.5 : cam === 'drift' ? 0.4 : 0.8;
  if (s.type === 'compare' || s.type === 'before_after') return cam === 'static' ? 1.4 : cam.startsWith('pan') ? 0.3 : 0.9;
  if (surprising(s)) return cam === 'slow_push' ? 1.8 : cam === 'static' ? 0.5 : 0.9;
  if (['worried', 'sad'].includes(s.emotion)) return cam === 'slow_push' ? 1.6 : 0.8;
  if (s.emotion === 'happy' || s.emotion === 'smug') return cam === 'slow_pull' || cam === 'drift' ? 1.4 : 1;
  return 1;
}
function fitTransition(tr: string, s: Scene, prev?: Scene): number {
  if (tr === 'zoom_through' && s.type === 'big_number') return 1.8;
  if (tr === 'circle_reveal' && s.type === 'title') return 1.5;
  if (tr === 'paper_flip' && s.type === 'list') return 1.5;
  if (tr === 'wipe_ink' && s.type === 'chart') return 1.5;
  if (tr === 'cut' && prev?.type === 'talk' && s.type === 'talk') return 2;
  return 1;
}

// ---------- history ----------
const HISTORY_PATH = new URL('../../data/history.json', import.meta.url).pathname;
export function loadHistory(): History {
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); } catch { return {episodes: []}; }
}
const N_RECENT = 5;
/** Same-channel entries only (missing channel = 'default'), excluding the episode itself. */
export function recentForChannel(history: History, channel: string, selfId: string, n = N_RECENT): HistoryEntry[] {
  return history.episodes.filter(e => e.id !== selfId && (e.channel ?? 'default') === channel).slice(-n);
}

function freqPenalty(value: string, field: keyof HistoryEntry, recent: HistoryEntry[]) {
  const n = recent.filter(e => e[field] === value).length;
  return 1 / (1 + 0.7 * n);
}
function sceneFreqPenalty(value: string, field: 'layout' | 'camera' | 'transition' | 'pose', recent: HistoryEntry[]) {
  const all = recent.flatMap(e => e.scenes);
  if (!all.length) return 1;
  const n = all.filter(s => s[field] === value).length;
  return 1 / (1 + 2.5 * (n / all.length));
}
function trigrams(entries: HistoryEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    for (let i = 0; i + 2 < e.scenes.length; i++) {
      set.add(e.scenes.slice(i, i + 3).map(s => `${s.type}|${s.layout}|${s.camera}`).join('>'));
    }
  }
  return set;
}

// ---------- element timing ----------
const STOP = new Set(['with', 'your', 'that', 'this', 'from', 'what', 'have', 'they', 'will']);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, '');
function findWord(text: string, words: {w: string; start: number}[]): number | null {
  const keys = text.split(/\s+/).map(norm).filter(k => k.length >= 4 && !STOP.has(k));
  for (const k of keys) {
    const hit = words.find(w => norm(w.w) === k);
    if (hit) return hit.start;
  }
  return null;
}

export async function direct(idArg: string, opts: {final: boolean}) {
  const ep = loadEpisode(idArg);
  const dir = episodeDir(ep.id);
  const timings: Timings = JSON.parse(fs.readFileSync(`${dir}build/timings.json`, 'utf8'));
  const history = loadHistory();
  const recent = recentForChannel(history, ep.channel, ep.id);
  const rand = rng(hash(`${ep.id}:${ep.seed}`));

  // --- episode level ---
  const last3Accents = recent.slice(-3).map(e => e.accent);
  const accent = pick(Object.keys(ACCENTS), a => (last3Accents.includes(a) ? 0.03 : 1) * noise(rand), rand);
  const background = pick([...BACKGROUNDS], b => freqPenalty(b, 'background', recent) * noise(rand), rand);
  const captionStyle = pick([...CAPTIONS], c => freqPenalty(c, 'captionStyle', recent) * noise(rand), rand);
  const intro = pick([...INTROS], c => freqPenalty(c, 'intro', recent) * noise(rand), rand);
  // emotion arc: the closing third counts 1.5x (the bed should land on how the video ends)
  const arc = (set: string[]) => ep.scenes.reduce((n, s, i) => n + (set.includes(s.emotion) ? (i >= ep.scenes.length * 2 / 3 ? 1.5 : 1) : 0), 0);
  const tense = arc(['worried', 'angry', 'shocked', 'sweating', 'sad']);
  const upbeat = arc(['happy', 'excited', 'smug']);
  const curious = arc(['thinking', 'confused', 'explaining']);
  const mood = pick([...MOODS], m => {
    const fit = m === 'tense' ? 1 + tense : m === 'upbeat' ? 1 + upbeat : m === 'curious' ? 1 + curious * 0.6 : 1.5;
    return fit * freqPenalty(m, 'music', recent) * noise(rand);
  }, rand);

  // --- scene level ---
  const hookSignal = ep.scenes.slice(0, 2).some(s => s.type === 'big_number' || HOOK_EMOTIONS.includes(s.emotion));
  const seenTri = trigrams(recent);
  const treat: {type: string; layout: string; camera: string}[] = [];
  const decided: SceneDecision[] = [];
  let cursor = 0;
  let sfxVariantLast: Record<string, number[]> = {};
  let prevPose = '';

  ep.scenes.forEach((s, i) => {
    const prev = decided[i - 1];
    const prevScene = ep.scenes[i - 1];
    const tm = timings.scenes[i];

    const tmWords = tm.words.map(w => ({w: w.w}));
    const pace = paceOf(tmWords, tm.end - tm.start);
    const isHook = i === 0;

    // layout + camera chosen jointly so the n-gram penalty can see the combo
    const combos = (LAYOUTS[s.type] ?? ['center']).flatMap(l => CAMERAS.map(c => ({l, c})));
    const combo = pick(combos, ({l, c}) => {
      if (s.layout && l !== s.layout) return 0;
      if (s.camera && c !== s.camera) return 0;
      let sc = fitLayout(l, s) * fitCamera(c, s) * paceCamera(c, pace) * noise(rand);
      if (isHook && hookSignal) {
        if (l === 'closeup') sc *= 2;
        if (c === 'slow_push') sc *= 2;
      } else if (isHook && c === 'static') sc *= 0.6;
      if (prev && prev.layout === l) sc *= s.layout ? 0.15 : 0.001; // practically never the same layout twice (a single-layout type still falls back to it)
      if (prev && prev.camera === c && c !== 'static') sc *= 0.25;
      if (prev && prev.charSide !== 'center' && sideOf(l) === prev.charSide) sc *= 0.5;
      sc *= sceneFreqPenalty(l, 'layout', recent) * sceneFreqPenalty(c, 'camera', recent);
      if (i >= 2) {
        const tri = [...treat.slice(-2), {type: s.type, layout: l, camera: c}].map(x => `${x.type}|${x.layout}|${x.camera}`).join('>');
        if (seenTri.has(tri)) sc *= 0.2;
      }
      return sc;
    }, rand);
    treat.push({type: s.type, layout: combo.l, camera: combo.c});
    const charSide = sideOf(combo.l);

    const transition = i === 0 ? 'cut' : pick(TRANSITIONS, t => {
      if (s.transition && t !== s.transition) return 0;
      let sc = fitTransition(t, s, prevScene) * noise(rand) * sceneFreqPenalty(t, 'transition', recent);
      if (prev && prev.transition === t) sc *= s.transition ? 0.1 : 0; // never the same transition twice in a row unless the author pinned it
      return sc;
    }, rand);

    // pose from emotion + direction
    const dirPose = charSide === 'left' ? 'explain_right' : 'explain_left';
    const cands = (POSE_BY_EMOTION[s.emotion] ?? ['neutral']).map(p => (p === 'explain_dir' ? dirPose : p));
    const pose = s.pose ?? pick(cands, p => (p === prevPose ? 0.1 : 1) * sceneFreqPenalty(p, 'pose', recent) * noise(rand), rand);
    prevPose = pose;

    // timing (relative to scene start)
    const speechDur = tm.end - tm.start;
    const lead = i === 0 ? 0.3 : 0.1 - JCUT; // J-cut: narration starts JCUT s before the picture cut (the transition midpoint); the tail below pays it back
    const words = tm.words.map(w => ({w: w.w, start: w.start - tm.start + lead, end: w.end - tm.start + lead}));
    const speechEnd = lead + speechDur;
    let elements: number[] = [];
    let tail = MIN_TAIL;
    if (s.type === 'list') {
      const matched = s.items.map(it => findWord(it, words));
      elements = matched.map((m, k) => m ?? lead + 0.3 + (k / s.items.length) * speechDur * 0.85); // unmatched items land during speech, not after it
      tail = 0.3;
    } else if (s.type === 'compare') {
      const l = findWord(s.left.title, words) ?? lead + speechDur * 0.3;
      const r = findWord(s.right.title, words) ?? Math.max(l + 0.8, lead + speechDur * 0.65);
      elements = [l, r];
      tail = 0.3;
    } else if (s.type === 'before_after') {
      const l = findWord(s.before.title, words) ?? lead + speechDur * 0.3;
      const r = findWord(s.after.title, words) ?? Math.max(l + 0.8, lead + speechDur * 0.65);
      elements = [l, r];
      tail = 0.3;
    } else if (s.type === 'timeline') {
      elements = s.events.map((e, k) => findWord(e.when, words) ?? findWord(e.what, words) ?? lead + 0.3 + (k / s.events.length) * speechDur * 0.85);
      tail = 0.3;
    } else if (s.type === 'chart') {
      elements = [lead + 0.5, Math.max(speechEnd, lead + 1.8)];
      tail = 0.35;
    } else if (s.type === 'big_number') {
      const cs = 0.7;
      elements = [cs, cs + 2.2];
      tail = Math.min(0.8, Math.max(0.3, elements[1] + 0.3 - speechEnd));
    } else if (s.type === 'title') tail = 0.25;
    else tail = pace === 'punchy' ? MIN_TAIL : pace === 'explain' ? 0.3 : 0.2;
    // pacing tweak on type tails (never below the minimum tail, so audio is never cut)
    if (s.type !== 'big_number' && s.type !== 'list' && s.type !== 'talk') {
      tail *= pace === 'punchy' ? 0.8 : pace === 'explain' ? 1.2 : 1;
    }
    tail = Math.max(tail, MIN_TAIL);
    if (i < ep.scenes.length - 1) tail += JCUT; // next scene's voice starts early, so this scene's picture holds on (L-cut feel)
    const durSec = Math.max(speechEnd + tail, elements.length ? Math.max(...elements) + 0.3 + (i < ep.scenes.length - 1 ? JCUT : 0) : 0);

    // punch-ins: emphasis words + surprising numbers
    const punchIns: SceneDecision['punchIns'] = [];
    for (const e of s.emphasis) {
      const first = norm(e.split(/\s+/)[0]);
      const w = words.find(x => norm(x.w) === first);
      if (w) punchIns.push({t: w.start, scale: 1.12, dur: 0.9});
    }
    if (s.type === 'big_number' && ['shocked', 'excited'].includes(s.emotion)) {
      punchIns.push({t: elements[1], scale: 1.18, dur: 1.0});
    }
    // short punchy sentence -> punch-in on the first word
    if (pace === 'punchy' && s.type === 'talk' && !punchIns.some(p => Math.abs(p.t - lead) < 0.6)) {
      punchIns.push({t: round(words[0]?.start ?? lead), scale: 1.08, dur: 0.7});
    }
    let hook: SceneDecision['hook'];
    if (isHook) {
      const atSec = round(Math.min(1.8, hookSignal ? lead + 0.2 : lead));
      if (hookSignal && !punchIns.some(p => p.t <= 2)) punchIns.push({t: atSec, scale: 1.14, dur: 0.9});
      hook = {kind: hookSignal ? 'punch_in' : 'slow_open', atSec};
    }
    // pacing: no picture holds more than ~4.5 s without a motion event (scene start, element landing or punch-in): force a soft punch-in in the middle of any longer gap
    for (let guard = 0; guard < 8; guard++) {
      const ev = [0, ...elements, ...punchIns.map(p => p.t), durSec].filter(x => x >= 0).sort((a, b) => a - b);
      let gapAt = -1;
      for (let k = 1; k < ev.length; k++) if (ev[k] - ev[k - 1] > MAX_STILL) { gapAt = k; break; }
      if (gapAt < 0) break;
      const mid = (ev[gapAt] + ev[gapAt - 1]) / 2;
      const starts = words.filter((w, k) => k > 0 && /[.!?]$/.test(words[k - 1].w)).map(w => w.start).filter(t => t > ev[gapAt - 1] + 1 && t < ev[gapAt] - 1);
      const t = starts.length ? starts.reduce((b, x) => (Math.abs(x - mid) < Math.abs(b - mid) ? x : b)) : mid;
      punchIns.push({t: round(t), scale: 1.07, dur: 0.8});
    }
    punchIns.sort((a, b) => a.t - b.t);

    // sfx with variant selection (never the same variant twice in a row per kind)
    const variant = (kind: string) => {
      const last = sfxVariantLast[kind] ?? [];
      const free = [0, 1, 2].filter(x => !last.includes(x)); // never one of the last two variants of this kind (3 variants: leaves 1)
      const v = free[Math.floor(rand() * free.length)] ?? 0;
      sfxVariantLast[kind] = [...last, v].slice(-2);
      return v;
    };
    const sfx: SfxCue[] = [];
    if (i > 0 && transition !== 'cut') sfx.push({t: 0, kind: 'whoosh', variant: variant('whoosh')});
    if (s.type === 'list') elements.forEach(t => sfx.push({t, kind: 'pop', variant: variant('pop')}));
    if (s.type === 'compare' || s.type === 'before_after' || s.type === 'timeline') elements.forEach(t => sfx.push({t, kind: 'pop', variant: variant('pop')}));
    if (s.type === 'title') sfx.push({t: 0.15, kind: 'pop', variant: variant('pop')});
    if (s.type === 'big_number') {
      for (let t = elements[0]; t < elements[1]; t += 0.11) sfx.push({t: round(t), kind: 'tick', variant: 0});
      sfx.push({t: elements[1], kind: 'ding', variant: variant('ding')});
    }
    if (s.type === 'chart') sfx.push({t: elements[0], kind: 'pop', variant: variant('pop')});

    decided.push({
      index: i, type: s.type, layout: combo.l, charSide, pose, camera: combo.c, transition,
      startSec: round(cursor), durSec: round(durSec), speechStart: lead, speechEnd: round(speechEnd),
      punchIns, ...(hook ? {hook} : {}), sfx: sfx.sort((a, b) => a.t - b.t), elements: elements.map(round),
    });
    cursor += durSec;
  });

  const out: EpisodeDecisions = {
    episodeId: ep.id, seed: ep.seed, accent, background, captionStyle, intro,
    music: {mood, track: moodTrack(mood)}, totalSec: round(cursor), scenes: decided,
    ...(decided[0]?.hook ? {hook: decided[0].hook} : {}),
  };
  fs.writeFileSync(`${dir}build/decisions.json`, JSON.stringify(out, null, 2));

  const report = varietyReport(out, recent);
  fs.writeFileSync(`${dir}build/variety.md`, report);
  console.log(`${ep.id}: accent=${accent} bg=${background} captions=${captionStyle} intro=${intro} mood=${mood} total=${out.totalSec.toFixed(1)}s`);
  console.log(report);

  if (opts.final) {
    const entry: HistoryEntry = {
      id: ep.id, channel: ep.channel, accent, background, captionStyle, intro, music: mood,
      scenes: decided.map(d => ({type: d.type, layout: d.layout, camera: d.camera, transition: d.transition, pose: d.pose})),
    };
    history.episodes = [...history.episodes.filter(e => e.id !== ep.id), entry];
    fs.mkdirSync(new URL('../../data/', import.meta.url).pathname, {recursive: true});
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    console.log('history.json updated (--final)');
  } else {
    console.log('(preview: history.json not modified)');
  }
}

function sideOf(layout: string): 'left' | 'right' | 'center' {
  if (layout === 'char_left') return 'left';
  if (layout === 'char_right' || layout === 'char_corner' || layout === 'over_shoulder') return 'right';
  return 'center';
}
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Distance in [0,1]: share of differing categorical decisions, aligned scene by scene. */
export function distance(a: HistoryEntry, b: HistoryEntry): number {
  let diff = 0, total = 0;
  for (const f of ['accent', 'background', 'captionStyle', 'intro', 'music'] as const) { total++; if (a[f] !== b[f]) diff++; }
  const n = Math.min(a.scenes.length, b.scenes.length);
  for (let i = 0; i < n; i++) {
    for (const f of ['layout', 'camera', 'transition', 'pose'] as const) { total++; if (a.scenes[i][f] !== b.scenes[i][f]) diff++; }
  }
  return total ? diff / total : 1;
}

function varietyReport(d: EpisodeDecisions, recent: HistoryEntry[]): string {
  const me: HistoryEntry = {
    id: d.episodeId, accent: d.accent, background: d.background, captionStyle: d.captionStyle, intro: d.intro, music: d.music.mood,
    scenes: d.scenes.map(s => ({type: s.type, layout: s.layout, camera: s.camera, transition: s.transition, pose: s.pose})),
  };
  const lines = [`# Variety report: ${d.episodeId}`, ''];
  if (!recent.length) lines.push('No previous episodes in history.json, nothing to compare against yet.');
  else {
    const ds = recent.map(e => ({id: e.id, d: distance(me, e)}));
    for (const x of ds) lines.push(`- vs ${x.id}: ${(x.d * 100).toFixed(0)}% different`);
    const avg = ds.reduce((a, b) => a + b.d, 0) / ds.length;
    lines.push('', `Average distance from last ${recent.length}: ${(avg * 100).toFixed(0)}%${avg < 0.5 ? '  ⚠ drifting toward sameness' : ''}`);
  }
  return lines.join('\n');
}
