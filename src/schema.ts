import {z} from 'zod';
import fs from 'node:fs';

export const Emotion = z.enum([
  'neutral', 'smug', 'worried', 'shocked', 'happy', 'excited', 'thinking',
  'explaining', 'angry', 'sad', 'confused', 'sweating',
]);
export type Emotion = z.infer<typeof Emotion>;

const Overrides = {
  layout: z.string().optional(),
  camera: z.string().optional(),
  transition: z.string().optional(),
  pose: z.string().optional(),
  /** Backdrop art, public-dir relative; injected by render.ts when episodes/<id>/art/scene-N.png exists. */
  art: z.string().regex(/^art\/scene-\d+\.png$/).optional(),
};

const base = {
  narration: z.string().min(1),
  emotion: Emotion.default('neutral'),
  emphasis: z.array(z.string()).default([]),
  ...Overrides,
};

const Side = z.object({title: z.string(), value: z.string()});

export const Scene = z.discriminatedUnion('type', [
  z.object({type: z.literal('title'), ...base}),
  z.object({type: z.literal('talk'), ...base, quote: z.object({text: z.string().min(1).max(140), by: z.string().max(60).optional()}).optional()}),
  z.object({
    type: z.literal('big_number'), ...base,
    value: z.number(), prefix: z.string().default(''), suffix: z.string().default(''),
    label: z.string(), decimals: z.number().int().min(0).default(0),
  }),
  z.object({
    type: z.literal('chart'), ...base,
    chart: z.object({
      kind: z.enum(['line', 'bar']),
      labels: z.array(z.string()).min(2),
      values: z.array(z.number()).min(2),
      yLabel: z.string().default(''),
    }).refine(c => c.labels.length === c.values.length, 'labels/values length mismatch'),
  }),
  z.object({type: z.literal('compare'), ...base, left: Side, right: Side}),
  z.object({type: z.literal('list'), ...base, items: z.array(z.string()).min(1).max(6)}),
]);
export type Scene = z.infer<typeof Scene>;
export type SceneType = Scene['type'];

export const Episode = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  channel: z.string().default('default'),
  series: z.string().default('money-myths'),
  seed: z.number().int().default(0),
  scenes: z.array(Scene).min(1),
  sources: z.array(z.string().url()).default([]),
  disclaimer: z.boolean().default(false),
});
export type Episode = z.infer<typeof Episode>;

export function episodeDir(id: string) {
  return new URL(`../episodes/${id}/`, import.meta.url).pathname;
}

export function loadEpisode(idOrPrefix: string): Episode {
  const root = new URL('../episodes/', import.meta.url).pathname;
  const match = fs.readdirSync(root).find(d => d === idOrPrefix) ??
    fs.readdirSync(root).find(d => d.startsWith(idOrPrefix));
  if (!match) throw new Error(`Episode not found: ${idOrPrefix}`);
  const raw = JSON.parse(fs.readFileSync(`${root}${match}/episode.json`, 'utf8'));
  const ep = Episode.parse(raw);
  // Numbers shown on screen must come from the file: sanity-check big_number values.
  for (const [i, s] of ep.scenes.entries()) {
    if (s.type === 'big_number' && !Number.isFinite(s.value)) {
      throw new Error(`Scene ${i}: invalid big_number value`);
    }
  }
  return ep;
}

// ---- Unified timeline schema (decisions.json): written by the director and by the clipper, validated before every render.
const sec = z.number().finite();
const Hook = z.object({kind: z.enum(['punch_in', 'slow_open']), atSec: sec});
export const SceneDecisionSchema = z.object({
  index: z.number().int().min(0), type: z.string(), layout: z.string(), charSide: z.enum(['left', 'right', 'center']), pose: z.string(), camera: z.string(), transition: z.string(),
  startSec: sec.min(0), durSec: sec.positive(), speechStart: sec, speechEnd: sec,
  punchIns: z.array(z.object({t: sec, scale: sec.positive(), dur: sec.positive()})),
  sfx: z.array(z.object({t: sec, kind: z.enum(['pop', 'whoosh', 'tick', 'ding']), variant: z.number().int().min(0)})),
  hook: Hook.optional(), elements: z.array(sec),
});
export const DecisionsSchema = z.object({
  episodeId: z.string(), seed: z.number(), accent: z.string(),
  background: z.enum(['plain', 'grid', 'dots', 'vignette']), captionStyle: z.enum(['bar', 'pill', 'outline']), intro: z.enum(['ink_draw', 'pop', 'slide']),
  music: z.object({mood: z.string(), track: z.string().nullable()}), totalSec: sec.positive(), hook: Hook.optional(),
  scenes: z.array(SceneDecisionSchema).min(1),
}).superRefine((d, ctx) => {
  d.scenes.forEach((s, i) => {
    const prev = d.scenes[i - 1];
    if (prev && s.startSec < prev.startSec + prev.durSec - 1e-3) ctx.addIssue({code: 'custom', path: ['scenes', i, 'startSec'], message: 'scene starts before the previous one ends'});
    if (s.startSec + s.durSec > d.totalSec + 1e-3) ctx.addIssue({code: 'custom', path: ['scenes', i, 'durSec'], message: 'scene runs past totalSec'});
  });
});
export type DecisionsParsed = z.infer<typeof DecisionsSchema>;

/** Parse + validate a decisions.json text; throws one readable error listing every problem. */
export function parseDecisions(text: string): DecisionsParsed {
  const r = DecisionsSchema.safeParse(JSON.parse(text));
  if (!r.success) throw new Error(`Invalid decisions.json:\n- ${r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n- ')}`);
  return r.data;
}
