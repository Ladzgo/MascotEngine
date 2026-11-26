// Storyboard step: for every beat the model writes a `shot` spec (subject, action, setting, label, number, mood, camera) from a controlled
// vocabulary; code repairs it and enforces: no subject repeated within 5 beats, >= 4 different actions, numbers only from the script.
import {extractJson, type Client} from '../llm/llm.js';
import type {Episode} from '../schema.js';
import {FB_FOR, FB_KINDS} from '../fullbleed/objects.js';
import {candidatesFor} from '../fullbleed/shots.js';
import {spokenNumbers} from './lint.js';

export const ACTIONS = ['drops', 'grows', 'shrinks', 'swipes', 'splits', 'counts', 'crosses', 'stacks', 'spins', 'pops', 'fills', 'drains', 'slides', 'flips'] as const;
export const MOODS = ['calm', 'curious', 'tense', 'upbeat', 'warm', 'serious'] as const;
export const CAMERAS = ['push', 'pull', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'orbit'] as const;
export const SUBJECT_GAP = 5, MIN_ACTIONS = 4;
type Sc = Episode['scenes'][number];
type Shot = NonNullable<Sc['shot']>;
const near = (a: number, b: number) => Math.abs(a - b) <= 0.01 * Math.max(Math.abs(a), Math.abs(b), 1e-9);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const subjectOf = (k: unknown): string | null => { const s = String(k ?? '').toLowerCase().replace(/\s+/g, '_'); return FB_KINDS.includes(s) ? s : FB_FOR[s] ?? null; };
const hint: Record<string, (typeof ACTIONS)[number]> = {big_number: 'counts', list: 'stacks', compare: 'splits', before_after: 'flips', timeline: 'slides', chart: 'grows', checklist: 'pops', title: 'drops'};

/** Numbers a shot may show: any number spoken anywhere in the script (the facts). */
const scriptFacts = (ep: Pick<Episode, 'scenes'>) => ep.scenes.flatMap(s => spokenNumbers(s.narration).concat((s as {value?: number}).value ?? []));
const numOf = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) && String(v ?? '') !== '' ? n : null; };

/** Constraint violations of a storyboarded episode (empty = fine). Used by repair, tests and QA. */
export function checkShots(ep: Pick<Episode, 'scenes'>): string[] {
  const errs: string[] = [], shots = ep.scenes.map(s => s.shot), facts = scriptFacts(ep);
  shots.forEach((s, i) => {
    if (!s) { errs.push(`beat ${i + 1} has no shot`); return; }
    if (!subjectOf(s.subject)) errs.push(`beat ${i + 1}: unknown subject "${s.subject}"`);
    if (!(ACTIONS as readonly string[]).includes(s.action)) errs.push(`beat ${i + 1}: unknown action "${s.action}"`);
    for (let k = Math.max(0, i - SUBJECT_GAP + 1); k < i; k++) if (shots[k]?.subject === s.subject) { errs.push(`beat ${i + 1}: subject "${s.subject}" repeats beat ${k + 1}`); break; }
    const n = numOf(s.number); if (n !== null && !facts.some(f => near(f, n))) errs.push(`beat ${i + 1}: number ${s.number} is not in the script`);
  });
  const acts = new Set(shots.map(s => s?.action).filter(Boolean));
  if (ep.scenes.length >= 6 && acts.size < MIN_ACTIONS) errs.push(`only ${acts.size} different actions (need ${MIN_ACTIONS})`);
  return errs;
}

/** Fill gaps and fix violations deterministically. Never invents a number. */
export function repairShots(ep: Episode, raw: Record<number, Partial<Shot>> = {}): Episode {
  const facts = scriptFacts(ep), out: Shot[] = [];
  const recent = () => out.slice(-(SUBJECT_GAP - 1)).map(s => s.subject);
  ep.scenes.forEach((s, i) => {
    const r = raw[i] ?? s.shot ?? {}, words = s.narration.split(/\s+/);
    let subject = subjectOf(r.subject);
    const avoid = recent();
    if (!subject || avoid.includes(subject)) {
      const cands = [...words.flatMap(w => candidatesFor(w)), ...FB_KINDS.filter(k => !/^person_/.test(k))].filter(k => !avoid.includes(k));
      const first = words.flatMap(w => candidatesFor(w)).find(k => !avoid.includes(k));
      subject = first ?? cands[hash(s.narration) % Math.max(1, cands.length)] ?? 'coin_stacks';
    }
    let action = (ACTIONS as readonly string[]).includes(String(r.action)) ? String(r.action) : hint[s.type] ?? ACTIONS[hash(s.narration) % ACTIONS.length];
    if (out.length && out[i - 1].action === action) action = ACTIONS.find(a => a !== action && a !== out[i - 1].action && !out.slice(-3).some(o => o.action === a)) ?? action;
    const n = numOf(r.number);
    const shot: Shot = {subject, action, ...(r.setting ? {setting: String(r.setting).slice(0, 40)} : {}), ...(r.label ? {label: String(r.label).slice(0, 40)} : {}), ...(n !== null && facts.some(f => near(f, n)) ? {number: typeof r.number === 'number' ? r.number : String(r.number).slice(0, 24)} : {}),
      ...((MOODS as readonly string[]).includes(String(r.mood)) ? {mood: String(r.mood)} : {}), ...((CAMERAS as readonly string[]).includes(String(r.camera)) ? {camera: String(r.camera)} : {})};
    out.push(shot);
  });
  // at least MIN_ACTIONS different actions: re-assign repeats (never the neighbours' action)
  const used = () => new Set(out.map(o => o.action));
  for (let i = 0; i < out.length && out.length >= 6 && used().size < MIN_ACTIONS; i++) {
    if (out.findIndex(o => o.action === out[i].action) === i) continue;
    const a = ACTIONS.find(x => !used().has(x) && x !== out[i - 1]?.action && x !== out[i + 1]?.action);
    if (a) out[i] = {...out[i], action: a};
  }
  const scenes = ep.scenes.map((s, i) => ({...s, shot: out[i], ...(ep.look === 'fullbleed' && !(s as Sc).visuals?.length && !(s as Sc).visual ? {visuals: [{kind: out[i].subject}]} : {})}));
  return {...ep, scenes: scenes as Episode['scenes']};
}

const sys = `You are the storyboard artist of a short explainer video. For every numbered beat decide what the picture shows at that exact moment.
Output ONLY JSON: {"shots": [{"i": beat number, "subject": ..., "action": ..., "setting": "3-5 words", "label": "text to show on screen, max 4 words, optional", "number": a number that appears in the beat (optional), "mood": ..., "camera": ...}]}
subject = ONE concrete thing named or implied by the sentence, exactly one of: ${FB_KINDS.join(', ')}.
action = what happens to it, one of: ${ACTIONS.join(', ')}.
mood one of: ${MOODS.join(', ')}. camera one of: ${CAMERAS.join(', ')}.
Rules: never reuse a subject within 5 beats; use at least 4 different actions across the video; the picture must make sense for what is said right then; a number may only be one that is spoken in that beat.`;

export async function storyboard(client: Client, ep: Episode, o: {model?: string; log?: (m: string) => void} = {}): Promise<Episode> {
  const raw: Record<number, Partial<Shot>> = {};
  for (let from = 0; from < ep.scenes.length; from += 8) {
    const batch = ep.scenes.slice(from, from + 8).map((s, k) => `${from + k + 1}. [${s.type}] ${s.narration}`).join('\n');
    try {
      const r = await client.messages.create({model: o.model ?? 'claude-sonnet-5-5', max_tokens: 1800, system: sys, messages: [{role: 'user', content: `Beats:\n${batch}\n\nSubjects already used just before: ${Object.values(raw).slice(-4).map(x => x.subject).join(', ') || 'none'}`}]});
      const j = extractJson(r.content.filter(c => c.type === 'text').map(c => (c as {text?: string}).text ?? '').join('')) as {shots?: (Partial<Shot> & {i?: number})[]};
      for (const x of j.shots ?? []) if (typeof x.i === 'number' && x.i >= 1 && x.i <= ep.scenes.length) raw[x.i - 1] = x;
    } catch (e) { o.log?.(`storyboard batch ${from / 8 + 1} failed (${(e as Error).message.slice(0, 60)}); using keyword shots`); }
  }
  const fixed = repairShots(ep, raw), errs = checkShots(fixed);
  if (errs.length) o.log?.(`storyboard notes: ${errs.slice(0, 3).join('; ')}`);
  return fixed;
}
