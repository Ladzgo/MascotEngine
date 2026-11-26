import {planShots, objectFor, candidatesFor} from './shots';
import {OBJECTS} from './objects';
import {ACTIONS, GROUPS, SETTINGS, CAMERAS, LAYOUTS, type Layout, type Setting} from './catalog';

type W = {w: string; start: number; end: number};
export type PlannedShot = {kind: string; at: number; why?: string; action: string};
export type ScenePlan = {env: Setting; pal: number; camera: number; zoom: 'wide' | 'close'; layout: Layout; shots: PlannedShot[]; companion?: string};

/** Where each kind of subject likes to live; the engine rotates through these so neighbouring scenes never share a setting. */
const ENV_BY_GROUP: Record<string, Setting[]> = {
  money: ['vault', 'office', 'room'], rate: ['abstract', 'sky'], time: ['room', 'sky', 'abstract'], debt: ['room', 'street', 'abstract'], growth: ['abstract', 'sky', 'city'], spending: ['street', 'kitchen', 'room'],
  card: ['room', 'office', 'street'], safety: ['vault', 'room', 'abstract'], place: ['city', 'street', 'sky'], docs: ['office', 'room'], compare: ['abstract', 'office'], fall: ['abstract', 'street'], people: ['street', 'office', 'room', 'sky'], ideas: ['office', 'abstract', 'sky'],
};
const ACTION_BY_GROUP: Record<string, string[]> = {
  money: ['drop', 'stack', 'pop_in', 'bounce'], rate: ['pulse', 'shake', 'grow'], time: ['pop_in', 'wobble', 'tilt'], debt: ['sink', 'shake', 'cross_out', 'fall'], growth: ['rise', 'grow', 'pulse', 'pop_in'],
  spending: ['slide_in_left', 'swipe', 'drop', 'cross_out'], card: ['swipe', 'slide_in_right', 'flip'], safety: ['lock', 'pop_in', 'check'], place: ['pop_in', 'pan_across', 'grow'], docs: ['slide_in_left', 'check', 'flip'],
  compare: ['compare_slide', 'pop_in', 'split'], fall: ['sink', 'fall', 'shake'], people: ['pop_in', 'bounce', 'slide_in_right'], ideas: ['pop_in', 'float', 'orbit'],
};
export const groupOf = (kind: string): string => Object.entries(GROUPS).find(([, v]) => v.includes(kind))?.[0] ?? 'ideas';

/** Same group first, then anything unused: a picture is only repeated when nothing else fits. */
const DEBT_TEXT = /\b(debts?|owe[sd]?|owing|loans?|borrow\w*)\b/i;
function fresh(kind: string, recent: string[], also: string[] = [], text = ''): string {
  const bad = new Set([...recent, ...also]);
  if (!DEBT_TEXT.test(text)) bad.add('debt_counter'); // the red 'you owe' panel only illustrates owing
  if (!bad.has(kind)) return kind;
  const pool = [...GROUPS[groupOf(kind)] ?? [], ...Object.values(GROUPS).flat()].filter(k => OBJECTS[k] && !bad.has(k));
  return pool[0] ?? kind;
}

const validSetting = (s: unknown): s is Setting => (SETTINGS as readonly string[]).includes(String(s));

/**
 * Plans every scene of an episode at once, so variety rules can look across beats: no subject within the last 6 scenes (or 2 shots), settings, palettes, camera moves
 * and layouts rotate (never the same twice in a row), zoom alternates wide/close. A beat's explicit `shot` (subject, action, setting, camera, layout) wins over inference.
 */
export function planEpisode(scenes: any[], wordsPer: W[][], durs: number[]): ScenePlan[] {
  const perScene: string[][] = [], out: ScenePlan[] = [];
  const lastSix = () => perScene.slice(-6).flat(); // variety window = the last 6 beats (scenes), not 6 shots
  let prevEnv: Setting | undefined, prevLayout: Layout | undefined, prevCam = -1, talkN = 0;
  scenes.forEach((s, i) => {
    const sh = s.shot ?? {}, words = wordsPer[i] ?? [], dur = durs[i] ?? 4;
    const raw = planShots(s, words, dur, {seed: i, skip: perScene.at(-1)?.at(-1)});
    if (typeof sh.subject === 'string' && OBJECTS[objectFor(sh.subject)] && (SUBJECT_SET.has(sh.subject))) raw[0] = {kind: sh.subject, at: 0, why: `shot.subject=${sh.subject}`};
    const shots: PlannedShot[] = [];
    for (const [k, r] of raw.entries()) {
      const explicit = !!r.why?.startsWith('shot.') || !!r.why?.startsWith('visual') ;
      const kind = explicit && k === 0 && r.why!.startsWith('shot.') ? r.kind : fresh(r.kind, lastSix(), shots.map(x => x.kind), s.narration ?? '');
      shots.push({kind, at: r.at, why: kind === r.kind ? r.why : `${r.why} -> ${kind} (variety)`, action: k === 0 && ACTIONS.includes(sh.action) ? sh.action : ACTION_BY_GROUP[groupOf(kind)]?.[(i + k) % (ACTION_BY_GROUP[groupOf(kind)]?.length ?? 1)] ?? 'pop_in'});
    }
    perScene.push(shots.map(x => x.kind));
    const g = groupOf(shots[0].kind), envs = ENV_BY_GROUP[g] ?? ['abstract'];
    let env: Setting = validSetting(sh.setting) ? sh.setting : envs[i % envs.length];
    if (env === prevEnv) env = envs.find(e => e !== prevEnv) ?? (SETTINGS.find(e => e !== prevEnv) as Setting);
    let camera = typeof sh.camera === 'string' && CAMERAS.includes(sh.camera as any) ? CAMERAS.indexOf(sh.camera as any) % 4 : (prevCam + 1 + (i % 2)) % 4;
    if (camera === prevCam) camera = (camera + 1) % 4;
    // layout: content decides first, talk beats rotate through the composed layouts
    let layout: Layout;
    const companion = GROUPS[g]?.find(k => OBJECTS[k] && !shots.some(x => x.kind === k) && !lastSix().includes(k));
    if (typeof sh.layout === 'string' && (LAYOUTS as readonly string[]).includes(sh.layout)) layout = sh.layout as Layout;
    else if (s.type === 'chart') layout = 'dataviz';
    else if (s.stockFile) layout = talkN % 2 ? 'pip' : 'broll';
    else if (s.type !== 'talk') layout = 'hero';
    else {
      const order: Layout[] = ['hero', 'kinetic', 'split', 'grid', 'hero', 'kinetic'];
      layout = order[talkN % order.length]; talkN++;
      if (layout === 'split' && !companion) layout = 'grid';
      if (layout === prevLayout) layout = layout === 'hero' ? 'kinetic' : 'hero';
    }
    if ((layout === 'pip' || layout === 'broll') && !s.stockFile) layout = 'hero';
    out.push({env, pal: (i + (g.length % 4)) % 4, camera, zoom: i % 2 ? 'close' : 'wide', layout, shots, companion});
    prevEnv = env; prevLayout = layout; prevCam = camera;
  });
  // palettes: never the same index twice in a row
  out.forEach((p, i) => { if (i && p.pal === out[i - 1].pal) p.pal = (p.pal + 1) % 4; });
  return out;
}
const SUBJECT_SET = new Set(Object.keys(OBJECTS));
void candidatesFor;
