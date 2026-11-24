import {useEffect, useState} from 'react';

export type EpStatus = {state: 'draft' | 'scheduled' | 'published'; youtubeUrl?: string; publishedAt?: string; scheduledFor?: string; archived?: boolean};
export type Card = {id: string; title: string; channel: string; kind: 'idea' | 'episode'; angle?: string; scenes?: number; totalSec?: number | null; state?: EpStatus['state']; stale?: {preview: boolean; final: boolean}; scheduledFor?: string; publishedAt?: string};
export type Columns = Record<'idea' | 'script' | 'voiced' | 'rendered' | 'published', Card[]>;
export type JobBrief = {jobId: string; episode: string; stages: string[]; status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'; current: string | null; done: string[]; progress: number; error?: string; engine: string; createdAt: number; position?: number};
export type QueueState = {running: JobBrief | null; queued: JobBrief[]; recent: JobBrief[]};
export type VersionRow = {id: string; at: string; scenes: number; titleChanged: boolean};
export type SearchResult = {episodes: {id: string; title: string; channel: string; status: string}[]; ideas: {id: string; title: string; channel: string; status: string}[]; scenes: {ep: string; n: number; text: string}[]};
export type Cost = {chars: number; cachedChars: number; images: number; estUsd: number; budget?: number};
export type CalEpisode = {id: string; title: string; channel: string; status: EpStatus; stages: {final: boolean}};

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {method, headers: body === undefined ? undefined : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as {error?: string}).error ?? `Request failed (${r.status})`);
  return j as T;
}
const ch = (c?: string) => (c && c !== 'all' ? `?ch=${encodeURIComponent(c)}` : '');

export const dataApi = {
  pipeline: (c?: string) => call<{columns: Columns}>('GET', `/api/pipeline${ch(c)}`),
  search: (q: string, c?: string) => call<SearchResult>('GET', `/api/search?q=${encodeURIComponent(q)}${c && c !== 'all' ? `&ch=${encodeURIComponent(c)}` : ''}`),
  status: (id: string) => call<EpStatus>('GET', `/api/episodes/${id}/status`),
  setStatus: (id: string, s: Partial<EpStatus> & {state: EpStatus['state']}) => call<EpStatus>('PUT', `/api/episodes/${id}/status`, s),
  versions: (id: string) => call<VersionRow[]>('GET', `/api/episodes/${id}/versions`),
  version: (id: string, v: string) => call<{at: string; episode: {title: string; scenes: {type: string; narration: string}[]}}>('GET', `/api/episodes/${id}/versions/${v}`),
  restore: (id: string, v: string) => call<{ok: true}>('POST', `/api/episodes/${id}/versions/${v}/restore`),
  cost: (id: string) => call<Cost>('GET', `/api/episodes/${id}/cost`),
  duplicate: (id: string, newId: string) => call<unknown>('POST', `/api/episodes/${id}/duplicate`, {id: newId}),
  archive: (id: string, archived = true) => call<{ok: true}>('POST', `/api/episodes/${id}/archive`, {archived}),
  trash: (id: string) => call<{ok: true}>('DELETE', `/api/episodes/${id}`),
  notes: (id: string) => call<{notes: Record<string, string[]>}>('GET', `/api/episodes/${id}/notes`),
  setNotes: (id: string, notes: Record<string, string[]>) => call<{notes: Record<string, string[]>}>('PUT', `/api/episodes/${id}/notes`, {notes}),
  regenerate: (id: string, n: number, kind: 'voice' | 'preview', confirm = false) => call<{jobId: string; position: number}>('POST', `/api/episodes/${id}/scenes/${n}/regenerate`, {kind, confirm}),
  queue: () => call<QueueState>('GET', '/api/queue'),
  enqueue: (episode: string, stages: string[], engine: string) => call<{jobId: string; position: number}>('POST', '/api/queue', {episode, stages, engine}),
  dequeue: (jobId: string) => call<{ok: true}>('DELETE', `/api/queue/${jobId}`),
  episodes: () => call<CalEpisode[]>('GET', '/api/episodes'),
};

/** Live queue state over SSE (falls back to polling). */
export function useQueue(): QueueState | null {
  const [q, setQ] = useState<QueueState | null>(null);
  useEffect(() => {
    let es: EventSource | null = null, timer = 0;
    const poll = () => { dataApi.queue().then(setQ).catch(() => undefined); timer = window.setTimeout(poll, 3000); };
    try { es = new EventSource('/api/queue/events'); es.onmessage = e => setQ(JSON.parse(e.data)); es.onerror = () => { es?.close(); es = null; poll(); }; } catch { poll(); }
    return () => { es?.close(); window.clearTimeout(timer); };
  }, []);
  return q;
}

/** Browser notification + tab-title badge when a job finishes or fails. Mount once (Queue page or app shell). */
export function useQueueNotifications() {
  const q = useQueue();
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    const n = q ? q.queued.length + (q.running ? 1 : 0) : 0;
    document.title = n ? `(${n}) ${base}` : base;
  }, [q]);
  useEffect(() => {
    if (!q) return;
    let seen: Record<string, string> = {};
    try { seen = JSON.parse(sessionStorage.getItem('studio.jobsSeen') ?? '{}'); } catch { /* storage blocked */ }
    const first = Object.keys(seen).length === 0 && !sessionStorage.getItem('studio.jobsInit');
    for (const j of q.recent) {
      if (seen[j.jobId]) continue;
      seen[j.jobId] = j.status;
      if (first || j.status === 'cancelled') continue;
      if ('Notification' in window && Notification.permission === 'granted') new Notification(j.status === 'done' ? `Done: ${j.episode}` : `Failed: ${j.episode}`, {body: j.error ?? j.stages.join(', ')});
    }
    try { sessionStorage.setItem('studio.jobsSeen', JSON.stringify(seen)); sessionStorage.setItem('studio.jobsInit', '1'); } catch { /* storage blocked */ }
  }, [q]);
  return q;
}
export const askNotifications = () => ('Notification' in window && Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(undefined));

/** Reads ?ch= from the hash route (#/pipeline?ch=x). */
export const hashParam = (k: string) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(k);
export const useHashParam = (k: string) => {
  const [v, setV] = useState(hashParam(k));
  useEffect(() => { const f = () => setV(hashParam(k)); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, [k]);
  return v;
};
