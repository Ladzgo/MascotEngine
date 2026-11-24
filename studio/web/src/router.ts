/// <reference types="vite/client" />
import {useMemo, useSyncExternalStore} from 'react';
import {readActive, saveActive, type Summary} from './api';

export const STEPS = ['script', 'voice', 'visuals', 'render', 'publish'] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = {script: 'Script', voice: 'Voice', visuals: 'Visuals', render: 'Render', publish: 'Publish'};
export type Page = 'today' | 'pipeline' | 'library' | 'ideas' | 'channels' | 'settings' | 'queue' | 'calendar' | 'ep';
export const PAGES: Page[] = ['today', 'pipeline', 'library', 'ideas', 'channels', 'settings', 'queue', 'calendar', 'ep'];
export const PAGE_LABEL: Record<Page, string> = {today: 'Today', pipeline: 'Pipeline', library: 'Library', ideas: 'Ideas', channels: 'Channels', settings: 'Settings', queue: 'Queue', calendar: 'Calendar', ep: 'Episode'};

/** Everything a hash can say. `ch` null = not in URL. */
export type RouteInput = {page: Page; ch?: string | null; ep?: string; step?: Step; scene?: number; tab?: string; q?: string; status?: string; f?: string; chanId?: string; isNew?: boolean};
export type Route = {page: Page; ch: string; chRaw: string | null; ep?: string; step?: Step; scene?: number; tab?: string; q: string; status: string; f: string; chanId?: string; isNew: boolean; hash: string};

const ID = /^[A-Za-z0-9_-]+$/;
export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(query);
  const seg = path.split('/').filter(Boolean);
  let page: Page = (PAGES as string[]).includes(seg[0]) && seg[0] !== 'ep' ? (seg[0] as Page) : 'today';
  let ep: string | undefined, step: Step | undefined, chanId: string | undefined;
  if (seg[0] === 'ep' && seg[1] && ID.test(seg[1])) { page = 'ep'; ep = seg[1]; if ((STEPS as readonly string[]).includes(seg[2])) step = seg[2] as Step; }
  if (page === 'channels' && seg[1] && ID.test(seg[1])) chanId = seg[1];
  const chRaw = p.get('ch');
  const sc = p.get('scene');
  return {page, chRaw, ch: chRaw || readActive(), ep, step, chanId, scene: sc !== null && /^\d+$/.test(sc) ? Number(sc) : undefined, tab: p.get('tab') ?? undefined, q: p.get('q') ?? '', status: p.get('status') ?? '', f: p.get('f') ?? '', isNew: p.get('new') === '1', hash};
}

export function hashFor(r: RouteInput): string {
  const path = r.page === 'ep' && r.ep ? `/ep/${r.ep}${r.step ? `/${r.step}` : ''}` : r.page === 'channels' && r.chanId ? `/channels/${r.chanId}` : `/${r.page === 'ep' ? 'library' : r.page}`;
  const q = new URLSearchParams();
  if (r.ch) q.set('ch', r.ch);
  if (r.scene !== undefined) q.set('scene', String(r.scene));
  if (r.tab) q.set('tab', r.tab);
  if (r.q) q.set('q', r.q);
  if (r.status) q.set('status', r.status);
  if (r.f) q.set('f', r.f);
  if (r.isNew) q.set('new', '1');
  const s = q.toString();
  return `#${path}${s ? `?${s}` : ''}`;
}

const current = () => parseHash(location.hash);
const base = (c: Route): RouteInput => ({page: c.page, ch: c.chRaw, ep: c.ep, step: c.step, scene: c.scene, tab: c.tab, q: c.q, status: c.status, f: c.f, chanId: c.chanId});
/** Hash for `patch` applied on the current route. A page change drops page-specific params. */
export function linkTo(patch: Partial<RouteInput>, from: Route = current()): string {
  const b: RouteInput = patch.page && patch.page !== from.page ? {page: patch.page, ch: from.chRaw} : base(from);
  return hashFor({...b, ...patch});
}
export function setRoute(patch: Partial<RouteInput> | string, replace = false) {
  const h = typeof patch === 'string' ? patch : linkTo(patch);
  if (typeof patch !== 'string' && patch.ch && patch.ch !== 'all') saveActive(patch.ch);
  if (h === location.hash) return;
  if (replace) location.replace(`${location.pathname}${location.search}${h}`); else location.hash = h;
}

const subHash = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
/** Current route: {page, ch, ep, step, scene, tab, q, status, f, chanId}. */
export function useRoute(): Route {
  const h = useSyncExternalStore(subHash, () => location.hash, () => '');
  return useMemo(() => parseHash(h), [h]);
}

/** Old `#/ep/<id>` lands on the next step that still needs work. */
export function nextStep(s?: Summary): Step {
  if (!s || !s.scenes) return 'script';
  if (!s.stages.voice) return 'voice';
  if (!s.stages.direct || !s.stages.preview) return 'visuals';
  if (!s.stages.final) return 'render';
  return 'publish';
}

/** Palette/shortcut actions. Lanes call registerActions([...]) in an effect and use the returned disposer. */
export type Action = {id: string; label: string; hint?: string; group?: string; run: () => void};
let actions: Action[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
export function registerActions(list: Action[]): () => void {
  actions = [...actions, ...list]; emit();
  return () => { actions = actions.filter(a => !list.includes(a)); emit(); };
}
export function useActions(): Action[] { return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, () => actions, () => actions); }

/** Optional pages, present only when the lane that owns them has shipped the file. */
export const optionalPages = import.meta.glob('./{Workspace,Pipeline,Calendar,Queue}.tsx') as Record<string, () => Promise<Record<string, unknown>>>;
export const hasPage = (name: string) => `./${name}.tsx` in optionalPages;
