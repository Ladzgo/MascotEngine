import {z} from 'zod';

export const WordSchema = z.object({w: z.string(), start: z.number().min(0), end: z.number().min(0)});
export type Word = z.infer<typeof WordSchema>;

/** Crop path: t = seconds from clip start, x = left edge (source px) of the 9:16 window. */
export const CropSchema = z.object({
  w: z.number().int().positive(), h: z.number().int().positive(),
  path: z.array(z.object({t: z.number().min(0), x: z.number().min(0)})).min(1),
});

export const ClipSchema = z.object({
  id: z.string(),
  start: z.number().min(0), end: z.number().positive(), // absolute source seconds
  score: z.number(), reasons: z.array(z.string()),
  text: z.string(),
  words: z.array(WordSchema), // absolute source seconds
  crop: CropSchema,
  file: z.string().optional(),
}).refine(c => c.end > c.start, {message: 'end must be after start'});

export const TimelineSchema = z.object({
  version: z.literal(1),
  source: z.string(), width: z.number().int().positive(), height: z.number().int().positive(),
  clips: z.array(ClipSchema),
});
export type Clip = z.infer<typeof ClipSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
