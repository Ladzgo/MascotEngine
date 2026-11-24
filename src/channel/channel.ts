import {z} from 'zod';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CHANNEL_ID = 'default';

/** Optional watermark + end-screen for Shorts and Clipper clips. Absent = no branding (output unchanged). */
export const BrandingConfig = z.object({
  handle: z.string().max(40).optional(),    // shown in the corner and on the end card, e.g. "@MoneyMyths"
  cta: z.string().max(60).optional(),       // end-card line, e.g. "Subscribe for the next myth"
  outroSec: z.number().min(0).max(6).default(2), // end-card length (0 = no end card)
  watermark: z.boolean().default(true),
});
export type BrandingConfig = z.infer<typeof BrandingConfig>;

export const Channel = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().default(''),
  niche: z.string().default(''),
  audience: z.string().default(''),
  tone: z.string().default(''),
  language: z.string().default('en'),
  voiceId: z.string().optional(),
  accent: z.string().optional(),     // episode accent colour name (src/accents.ts); read by the drafter/director once wired
  sayVoice: z.string().optional(),   // macOS `say` voice for this channel (SAY_VOICE overrides)
  branding: BrandingConfig.optional(),
  voiceStyle: z.string().optional(), // speaking-style note for the script prompt and for picking a TTS voice
  bannedTopics: z.array(z.string()).default([]),
  postingPerWeek: z.number().default(2),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Channel = z.infer<typeof Channel>;

/** Root of all channels; CHANNELS_DIR overrides (tests). Read at call time. */
export function channelsRoot(): string {
  return process.env.CHANNELS_DIR ?? new URL('../../channels/', import.meta.url).pathname;
}
export function channelDir(id: string): string {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid channel id: ${id}`);
  return path.join(channelsRoot(), id) + '/';
}

function defaultChannel(): Channel {
  return Channel.parse({
    id: DEFAULT_CHANNEL_ID,
    name: 'Money Myths',
    description: 'Short explainers that debunk personal finance myths, spoken by a cartoon mascot.',
    niche: 'personal finance',
    audience: 'Adults new to money topics who want plain explanations',
    tone: 'Casual, dry humour, no hype. Smart friend over coffee. No promises of returns, no personalised advice. Every number sourced.',
    bannedTopics: ['guaranteed returns', 'get-rich-quick schemes', 'specific stock picks'],
    postingPerWeek: 2,
  });
}

export function saveChannel(ch: Channel): Channel {
  const c = Channel.parse(ch);
  fs.mkdirSync(channelDir(c.id), {recursive: true});
  fs.writeFileSync(`${channelDir(c.id)}channel.json`, JSON.stringify(c, null, 2) + '\n');
  return c;
}

export function loadChannel(id: string = DEFAULT_CHANNEL_ID): Channel {
  const file = `${channelDir(id)}channel.json`;
  if (!fs.existsSync(file)) {
    if (id === DEFAULT_CHANNEL_ID) return saveChannel(defaultChannel());
    throw new Error(`Channel not found: ${id}`);
  }
  return Channel.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function listChannels(): Channel[] {
  loadChannel(DEFAULT_CHANNEL_ID); // ensure default exists
  return fs.readdirSync(channelsRoot(), {withFileTypes: true})
    .filter(d => d.isDirectory() && fs.existsSync(`${channelsRoot()}${d.name}/channel.json`))
    .map(d => loadChannel(d.name));
}

export function channelContext(ch: Channel): string {
  const lines = [
    `Channel: ${ch.name}`,
    `Niche: ${ch.niche}`,
    `Audience: ${ch.audience}`,
    `Tone: ${ch.tone}`,
    `Language: ${ch.language}`,
    ...(ch.voiceStyle ? [`Speaking style: ${ch.voiceStyle}`] : []),
    `Banned topics: ${ch.bannedTopics.length ? ch.bannedTopics.join(', ') : 'none'}`,
  ];
  if (ch.description) lines.push(`Description: ${ch.description}`);
  return lines.join('\n');
}
