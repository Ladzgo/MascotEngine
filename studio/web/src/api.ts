import type React from 'react';
export type Scene = {
  type: 'title' | 'talk' | 'big_number' | 'chart' | 'compare' | 'list';
  narration: string; emotion: string; emphasis: string[];
  layout?: string; camera?: string; transition?: string; pose?: string;
  value?: number; prefix?: string; suffix?: string; label?: string; decimals?: number;
  chart?: {kind: 'line' | 'bar'; labels: string[]; values: number[]; yLabel: string};
  left?: {title: string; value: string}; right?: {title: string; value: string};
  items?: string[];
};
export type EpisodeDoc = {id: string; channel?: string; title: string; series: string; seed: number; scenes: Scene[]; sources: string[]; disclaimer: boolean};
export type SceneDecision = {index: number; type: string; layout: string; pose: string; camera: string; transition: string; startSec: number; durSec: number};
export type Decisions = {accent: string; background: string; captionStyle: string; intro: string; music: {mood: string}; totalSec: number; scenes: SceneDecision[]};
export type Summary = {status?: {state: 'draft' | 'scheduled' | 'published'}; archived?: boolean; channel: string; stale: {preview: boolean; final: boolean}; id: string; title: string; scenes: number; accent: string | null; totalSec: number | null; stages: {voice: boolean; direct: boolean; preview: boolean; final: boolean; shorts: number}};
export type EpisodeData = {episode: EpisodeDoc; decisions: Decisions | null; variety: string | null; summary: Summary; shorts: string[]; audio: SceneAudio[]};
export type SceneAudio = {file: string; size: number; source: 'generated' | 'recording'} | null;
export type Stage = 'voice' | 'direct' | 'preview' | 'final' | 'shorts';
export type JobState = {id: string; episode: string; status: 'running' | 'done' | 'error' | 'cancelled'; current: Stage | null; done: Stage[]; stages: Stage[]; progress: number; error?: string; log: string[]};
export type LlmStatus = {phase: 'idle' | 'starting' | 'pulling' | 'ready' | 'error'; model?: string; pct?: number; message?: string; reachable: boolean; models: string[]; chosen: string | null};
export type Settings = {elevenKeySet: boolean; voiceId: string; model: string; engine: string; ffmpeg: boolean; draftInstalled: boolean; ideasInstalled: boolean; publishInstalled: boolean};
export type Readiness = {ok: boolean; items: {id: string; label: string; ok: boolean; detail: string; fix: string}[]};
export type Channel = {id: string; name: string; description: string; niche: string; audience: string; tone: string; language: string; voiceId?: string; bannedTopics: string[]; postingPerWeek: number; createdAt: string};
export type ChannelRow = Channel & {episodes: number};
export type Idea = {id: string; title: string; angle: string; hook: string; whyInteresting: string; format: string; difficulty: string; needsSources: string[]; status: 'new' | 'drafted' | 'dismissed'; episodeId?: string; createdAt: string};
export type IdeasData = {generatedAt: string; ideas: Idea[]; installed: boolean};
export type PublishPack = {titles: string[]; description: string; tags: string[]; chapters: {startSec: number; title: string}[]; thumbnailText: string[]; source: 'ai' | 'fallback'};
export type OverviewRow = {channel: Channel; episodes: number; rendered: number; ideasNew: number; lastRender: {id: string; at: string} | null; unfinished: {id: string; title: string} | null};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {...init, headers: {'Content-Type': 'application/json'}});
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}
async function audioCall<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}
export const AUDIO_ACCEPT = '.wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4';
export type QueueItem = {id: string; episode?: string; status?: string};
export type SearchResult = {episodes?: {id: string; title: string; channel?: string; status?: string}[]; ideas?: {id: string; title: string; channel?: string; episodeId?: string; status?: string}[]; scenes?: {ep: string; n: number; text: string}[]};
/** GET that returns null on any non-200 (endpoint not shipped yet). */
async function soft<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}
export const api = {
  queue: () => soft<unknown>('/api/queue'),
  search: (q: string, ch: string) => soft<SearchResult>(`/api/search?q=${encodeURIComponent(q)}${ch && ch !== 'all' ? `&ch=${encodeURIComponent(ch)}` : ''}`),
  uploadAudio: (id: string, n: number, file: File, confirmGenerated = false) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return audioCall<{file: string; size: number}>(`/api/episodes/${id}/audio/${n}?ext=${encodeURIComponent(ext)}${confirmGenerated ? '&confirm=generated' : ''}`, {method: 'POST', body: file});
  },
  removeAudio: (id: string, n: number, confirmGenerated = false) => audioCall<{ok: boolean}>(`/api/episodes/${id}/audio/${n}${confirmGenerated ? '?confirm=generated' : ''}`, {method: 'DELETE'}),
  episodes: (channel?: string) => call<Summary[]>(`/api/episodes${channel ? `?channel=${encodeURIComponent(channel)}` : ''}`),
  episode: (id: string) => call<EpisodeData>(`/api/episodes/${id}`),
  create: (id: string, channel: string) => call<Summary>('/api/episodes', {method: 'POST', body: JSON.stringify({id, channel})}),
  save: (ep: EpisodeDoc) => call<{ok: boolean}>(`/api/episodes/${ep.id}`, {method: 'PUT', body: JSON.stringify(ep)}),
  generate: (id: string, stages: Stage[], engine: string) => call<{jobId: string}>(`/api/episodes/${id}/generate`, {method: 'POST', body: JSON.stringify({stages, engine})}),
  makeVideo: (topic: string, angle: string, channel: string, stopAtPreview = true) => call<{id: string; jobId: string}>('/api/make', {method: 'POST', body: JSON.stringify({topic, angle, channel, stopAtPreview})}),
  readiness: () => call<Readiness>('/api/readiness'),
  makeThumb: (id: string, text?: string) => call<{ok: boolean; at: number}>(`/api/episodes/${id}/thumbnail`, {method: 'POST', body: JSON.stringify({text})}),
  draft: (topic: string, angle: string, channel: string) => call<{id: string}>('/api/draft', {method: 'POST', body: JSON.stringify({topic, angle, channel})}),
  channels: () => call<ChannelRow[]>('/api/channels'),
  createChannel: (c: Partial<Channel>) => call<Channel>('/api/channels', {method: 'POST', body: JSON.stringify(c)}),
  saveChannel: (c: Channel) => call<Channel>(`/api/channels/${c.id}`, {method: 'PUT', body: JSON.stringify(c)}),
  deleteChannel: (id: string) => call<{ok: boolean}>(`/api/channels/${id}`, {method: 'DELETE'}),
  overview: () => call<{channels: OverviewRow[]}>('/api/overview'),
  ideas: (ch: string) => call<IdeasData>(`/api/channels/${ch}/ideas`),
  genIdeas: (ch: string, count: number, focus: string) => call<IdeasData>(`/api/channels/${ch}/ideas/generate`, {method: 'POST', body: JSON.stringify({count, focus})}),
  setIdea: (ch: string, id: string, status: 'new' | 'dismissed') => call<Idea>(`/api/channels/${ch}/ideas/${id}`, {method: 'PATCH', body: JSON.stringify({status})}),
  draftIdea: (ch: string, id: string) => call<{id: string}>(`/api/channels/${ch}/ideas/${id}/draft`, {method: 'POST'}),
  pack: (id: string) => call<{pack: PublishPack | null}>(`/api/episodes/${id}/publish`),
  makePack: (id: string) => call<{pack: PublishPack}>(`/api/episodes/${id}/publish`, {method: 'POST'}),
  cancel: (jobId: string) => call<{ok: boolean}>(`/api/jobs/${jobId}/cancel`, {method: 'POST'}),
  running: () => call<{running: string | null}>('/api/jobs'),
  settings: () => call<Settings>('/api/settings'),
  llm: () => call<LlmStatus>('/api/llm'),
  llmSetup: () => call<LlmStatus>('/api/llm/setup', {method: 'POST'}),
  saveSettings: (b: Partial<{apiKey: string; llmModel: string; voiceId: string; model: string; engine: string}>) => call<{ok: boolean}>('/api/settings', {method: 'PUT', body: JSON.stringify(b)}),
};

export const ACCENT_HEX: Record<string, string> = {tomato: '#d9482a', teal: '#128c82', mustard: '#c98600', violet: '#7b4bb7', green: '#2e8a52', blue: '#2e6fdb', pink: '#d63f7e'};
export const CAMERAS = ['static', 'slow_push', 'slow_pull', 'pan_left', 'pan_right', 'drift'];
export const TRANSITIONS = ['cut', 'slide', 'wipe_ink', 'circle_reveal', 'zoom_through', 'paper_flip'];
export const LAYOUTS: Record<string, string[]> = {
  title: ['center', 'closeup'], talk: ['center', 'keyword_side', 'closeup', 'over_shoulder'],
  big_number: ['center', 'char_left', 'char_right'], chart: ['char_left', 'char_right', 'char_corner', 'fullscreen'],
  compare: ['split', 'split_char_center'], list: ['char_left', 'char_right', 'center_list'],
};
export const POSES = ['neutral', 'explain_left', 'explain_right', 'pointing_up', 'thinking', 'happy', 'excited', 'thumbs_up', 'smug', 'worried', 'shocked', 'sweating', 'sad', 'angry', 'confused', 'facepalm', 'counting_money', 'holding_sign', 'reading', 'writing'];
export const EMOTIONS = ['neutral', 'smug', 'worried', 'shocked', 'happy', 'excited', 'thinking', 'explaining', 'angry', 'sad', 'confused', 'sweating'];
export const SCENE_TYPES: Scene['type'][] = ['title', 'talk', 'big_number', 'chart', 'compare', 'list'];
export const nice = (s: string) => s.replace(/_/g, ' ');

export function blankScene(type: Scene['type']): Scene {
  const base = {narration: 'New scene narration.', emotion: 'neutral', emphasis: []};
  switch (type) {
    case 'big_number': return {...base, type, value: 100, prefix: '$', suffix: '', label: 'What this number means', decimals: 0};
    case 'chart': return {...base, type, chart: {kind: 'line', labels: ['0', '1', '2'], values: [1, 2, 3], yLabel: 'value'}};
    case 'compare': return {...base, type, left: {title: 'Left', value: '1%'}, right: {title: 'Right', value: '2%'}};
    case 'list': return {...base, type, items: ['First point', 'Second point']};
    default: return {...base, type};
  }
}

/** Arrow-key navigation for role=tablist / radiogroup children. */
export function arrowNav(e: React.KeyboardEvent<HTMLElement>, sel: string) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(sel)].filter(b => !b.disabled);
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const n = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
  n.focus(); n.click();
}

export const ACTIVE_KEY = 'studio.channel';
export const readActive = () => { try { return localStorage.getItem(ACTIVE_KEY) || 'default'; } catch { return 'default'; } };
export const saveActive = (id: string) => { try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* storage blocked */ } };
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
export const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
