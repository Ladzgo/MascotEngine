// Lane W: episode-workspace endpoints that lane S may not have shipped yet.
// 404/501 (or a non-JSON reply) throw Unsupported so the UI can hide the feature.
import type {Scene} from './api';

export class Unsupported extends Error {}
export const unsupported = (e: unknown) => e instanceof Unsupported;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {...init, headers: {'Content-Type': 'application/json'}});
  if (res.status === 404 || res.status === 501) throw new Unsupported(`${url} not available`);
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson && res.ok) throw new Unsupported(`${url} not available`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}
const j = (b: unknown): RequestInit => ({method: 'POST', body: JSON.stringify(b)});

export type Version = {id: string; at: string; scenes: number; titleChanged?: boolean};
export type Cost = {chars: number; cachedChars: number; images: number; estUsd: number; budget?: number};
export type EpState = 'draft' | 'scheduled' | 'published';
export type EpStatus = {state: EpState; youtubeUrl?: string; publishedAt?: string; scheduledFor?: string};
export type Notes = Record<string, string[]>;

export const apiWs = {
  versions: async (id: string) => { const r = await req<Version[] | {versions: Version[]}>(`/api/episodes/${id}/versions`); return Array.isArray(r) ? r : r.versions ?? []; },
  restore: (id: string, vid: string) => req<{ok: boolean}>(`/api/episodes/${id}/versions/${encodeURIComponent(vid)}/restore`, {method: 'POST'}),
  cost: (id: string) => req<Cost>(`/api/episodes/${id}/cost`),
  status: (id: string) => req<EpStatus>(`/api/episodes/${id}/status`),
  setStatus: (id: string, s: EpStatus) => req<EpStatus>(`/api/episodes/${id}/status`, {method: 'PUT', body: JSON.stringify(s)}),
  notes: async (id: string) => (await req<{notes: Notes}>(`/api/episodes/${id}/notes`)).notes ?? {},
  saveNotes: (id: string, notes: Notes) => req<{ok: boolean}>(`/api/episodes/${id}/notes`, {method: 'PUT', body: JSON.stringify({notes})}),
  regenerate: (id: string, n: number, kind: 'voice' | 'preview', confirm?: boolean) => req<{jobId: string}>(`/api/episodes/${id}/scenes/${n}/regenerate`, j({kind, confirm})),
  duplicate: (id: string, newId: string) => req<unknown>(`/api/episodes/${id}/duplicate`, j({id: newId})),
  archive: (id: string) => req<unknown>(`/api/episodes/${id}/archive`, {method: 'POST'}),
};
export const cloneScene = (s: Scene): Scene => JSON.parse(JSON.stringify(s));
export const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
export const usd = (n: number) => `$${n < 1 ? n.toFixed(2) : n.toFixed(1)}`;
