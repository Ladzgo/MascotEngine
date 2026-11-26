import {z} from 'zod';

// Request-body schemas for the Studio API. Loose objects: unknown keys pass, wrong types are a 400.
const str = z.string();
export const VoicePreviewBody = z.looseObject({engine: str.optional(), lang: str.optional()});
export const MakeBody = z.looseObject({topic: str.optional(), angle: str.optional(), channel: str.optional(), stopAtPreview: z.boolean().optional(), format: z.enum(['wide', 'short']).optional()});
export const DraftBody = z.looseObject({topic: str.optional(), angle: str.optional(), channel: str.optional(), id: str.optional(), format: z.enum(['wide', 'short']).optional()});
export const IdeasGenerateBody = z.looseObject({focus: str.optional(), count: z.number().int().min(1).max(20).optional()});
export const GenerateBody = z.looseObject({stages: z.array(str).optional(), engine: str.optional()});
export const ChannelBody = z.looseObject({id: str.optional(), name: str.optional()});
export const PresetBody = z.looseObject({id: str.optional(), channel: str.optional()});
export const ArchiveBody = z.looseObject({archived: z.boolean().optional()});
export const DuplicateBody = z.looseObject({id: str.optional()});
export const NotesBody = z.looseObject({notes: z.unknown().optional()}); // shape checked (422) next to the writer
export const RegenerateBody = z.looseObject({kind: str.optional(), confirm: z.unknown().optional(), engine: str.optional()});
export const QueueBody = z.looseObject({episode: str.optional(), stages: z.array(str).optional(), engine: str.optional()});
export const IdeaStatusBody = z.looseObject({status: str.optional()});
export const NewEpisodeBody = z.looseObject({id: str.optional(), channel: str.optional()});
export const ThumbBody = z.looseObject({text: str.optional()});
export const ClipStartBody = z.looseObject({path: str.optional(), upload: str.optional(), min: z.coerce.number().optional(), max: z.coerce.number().optional(), count: z.coerce.number().optional()});
export const SettingsBody = z.looseObject({apiKey: str.optional(), llmModel: str.optional(), voiceId: str.optional(), model: str.optional(), engine: str.optional()});
export const StatusBody = z.looseObject({});

export const parseBody = <S extends z.ZodType>(v: unknown, schema: S): z.infer<S> => {
  const r = schema.safeParse(v);
  if (r.success) return r.data;
  const i = r.error.issues[0];
  throw Object.assign(new Error(`Invalid request: ${i.path.join('.') || 'body'} ${i.message}`), {schemaError: true});
};
