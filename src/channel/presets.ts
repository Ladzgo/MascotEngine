import {Channel} from './channel.js';

export type Preset = Omit<Channel, 'id' | 'createdAt'>;

const base = {language: 'en', postingPerWeek: 2};

/** Ready-made channel profiles: niche, audience, tone, banned topics, accent colour and voice style. */
export const PRESETS: Record<string, Preset> = {
  finance: {
    ...base, name: 'Money Myths', niche: 'personal finance', accent: 'blue', sayVoice: 'Samantha',
    description: 'Short explainers that debunk personal finance myths with clear, sourced numbers, spoken by a cartoon mascot.',
    audience: 'Adults new to money topics who want plain explanations',
    tone: 'Casual, dry humour, no hype. Smart friend over coffee. No promises of returns, no personalised advice. Every number sourced.',
    voiceStyle: 'calm, dry, mid pace (about 2.6 words per second)',
    bannedTopics: ['guaranteed returns', 'get-rich-quick schemes', 'specific stock picks', 'crypto price predictions'],
  },
  tech: {
    ...base, name: 'How It Works', niche: 'consumer technology explained', accent: 'teal', sayVoice: 'Daniel',
    description: 'Explainers on how everyday technology actually works, from Wi-Fi to chips to AI, with simple analogies.',
    audience: 'Curious non-engineers who use technology every day and want to understand it',
    tone: 'Friendly and precise. One clear analogy per idea, plain words before jargon, honest about what is simplified. No product hype, no fear about gadgets.',
    voiceStyle: 'warm, clear, slightly quicker pace (about 2.9 words per second)',
    bannedTopics: ['product reviews', 'affiliate recommendations', 'unverified leaks', 'security exploits step by step'],
  },
  history: {
    ...base, name: 'Past Tense', niche: 'history and ancient civilisations', accent: 'mustard', sayVoice: 'Alex',
    description: 'Short, story-driven histories that separate popular myths from what evidence actually shows.',
    audience: 'Adults who like history and enjoy hearing what really happened',
    tone: 'Storyteller with a wry edge: concrete scenes, dates and people, clear about what is known versus debated. Never glorify atrocities, no partisan takes on current politics.',
    voiceStyle: 'measured, narrative, a little slower (about 2.4 words per second)',
    bannedTopics: ['conspiracy theories presented as fact', 'current election politics', 'graphic violence detail'],
  },
};

export function fromPreset(name: string, id: string, over: {name?: string} = {}): Channel {
  const p = PRESETS[name];
  if (!p) throw new Error(`Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
  return Channel.parse({...p, ...(over.name ? {name: over.name} : {}), id});
}
