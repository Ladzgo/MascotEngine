import React, {useCallback, useEffect, useRef, useState} from 'react';
import {api, type ChannelRow, type JobState, type QueueItem} from './api';
import {PAGE_LABEL, STEP_LABEL, hashFor, setRoute, type Route} from './router';
import {t} from './i18n';

// ---- jobs ----
export type Jobs = {running: JobState | null; queue: QueueItem[]; hasQueue: boolean; finished: {episode: string; status: string} | null; clear: () => void};
const normQueue = (q: unknown): QueueItem[] => {
  const o = q as {queue?: unknown[]; jobs?: unknown[]} | null;
  const a = Array.isArray(q) ? q : o?.queue ?? o?.jobs ?? [];
  return (a as Record<string, unknown>[]).map(j => ({id: String(j.jobId ?? j.id ?? ''), episode: j.episode as string | undefined, status: j.status as string | undefined})).filter(j => j.id && j.status !== 'running');
};

export function useJobs(): Jobs {
  const [id, setId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [hasQueue, setHasQueue] = useState(false);
  const [finished, setFinished] = useState<Jobs['finished']>(null);
  const prev = useRef<JobState | null>(null);
  useEffect(() => {
    let on = true, queueOk = true;
    const tick = async () => {
      if (document.hidden) return;
      api.running().then(x => on && setId(x.running)).catch(() => {});
      if (queueOk) { const q = await api.queue(); if (!on) return; if (q === null) { queueOk = false; setHasQueue(false); } else { setHasQueue(true); setQueue(normQueue(q)); } }
    };
    void tick(); const t = setInterval(tick, 4000);
    return () => { on = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!id) { setJob(null); return; }
    const src = new EventSource(`/api/jobs/${id}/events`);
    src.onmessage = m => setJob(JSON.parse(m.data));
    src.onerror = () => src.close();
    return () => src.close();
  }, [id]);
  useEffect(() => {
    const was = prev.current; prev.current = job;
    if (was?.status === 'running' && job && job.status !== 'running') {
      setFinished({episode: job.episode, status: job.status});
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(job.status === 'done' ? 'Render finished' : `Run ${job.status}`, {body: job.episode});
    }
  }, [job]);
  useEffect(() => { const f = () => setFinished(null); window.addEventListener('focus', f); return () => window.removeEventListener('focus', f); }, []);
  const running = job?.status === 'running' ? job : id && !job ? ({id, episode: '', status: 'running', current: null, done: [], stages: [], progress: 0, log: []} as JobState) : null;
  return {running, queue, hasQueue, finished, clear: useCallback(() => setFinished(null), [])};
}

function JobsChip({jobs}: {jobs: Jobs}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const {running, queue, hasQueue, finished} = jobs;
  const close = useCallback(() => setOpen(false), []);
  useModalLite(pop, open, close, ref);
  const pct = running ? Math.round(running.progress * 100) : 0;
  const label = running ? `Running ${pct}%` : queue.length ? `${queue.length} queued` : finished ? (finished.status === 'done' ? 'Finished' : 'Failed') : 'Idle';
  return (
    <div className="jobs" ref={ref}>
      <button type="button" className={`chip jobs-chip ${running ? 'busy' : finished?.status === 'error' ? 'bad' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => { setOpen(o => !o); jobs.clear(); }}>
        <span className="dot" aria-hidden="true" />Jobs <b className="num">{label}</b>{running && queue.length > 0 && <span className="num"> +{queue.length}</span>}
      </button>
      {open && (
        <div className="jobs-pop" ref={pop} role="group" aria-label="Jobs">
          {running ? (
            <div className="job"><b>{running.episode ? <a className="link" href={hashFor({page: 'ep', ep: running.episode})}>{running.episode}</a> : 'Run in progress'}</b>
              <span className="small muted">{running.current ? `Stage: ${running.current}` : 'Starting…'} · {pct}%</span>
              <progress max={100} value={pct} aria-label="Progress" />
              <button className="btn sm" onClick={() => api.cancel(running.id)}>Cancel run</button></div>
          ) : <p className="small muted">{finished ? `${finished.episode} ${finished.status === 'done' ? 'finished.' : `ended: ${finished.status}.`}` : 'Nothing running.'}</p>}
          {queue.length > 0 && <ul className="jobq">{queue.map(j => <li key={j.id}><span>{j.episode ?? j.id}</span><span className="muted small">{j.status ?? 'queued'}</span></li>)}</ul>}
          <div className="row">
            {hasQueue && <a className="btn sm" href="#/queue">Open queue</a>}
            {'Notification' in window && Notification.permission === 'default' && <button className="btn sm ghost" onClick={() => void Notification.requestPermission().then(() => setOpen(o => o))}>Notify me when done</button>}
          </div>
        </div>
      )}
    </div>
  );
}
/** Popover variant: Esc and outside click close; focus returns to the trigger. No trap. */
function useModalLite(pop: React.RefObject<HTMLElement | null>, open: boolean, close: () => void, wrap: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); wrap.current?.querySelector<HTMLElement>('button')?.focus(); } };
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', key); document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, [open, close, wrap, pop]);
}

// ---- top bar ----
export function TopBar({route, chans, epTitle, epChannel, jobs, onPalette}: {route: Route; chans: ChannelRow[]; epTitle?: string; epChannel?: string; jobs: Jobs; onPalette: () => void}) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const chId = route.page === 'ep' && epChannel ? epChannel : route.ch;
  const chName = chId === 'all' ? 'All channels' : chans.find(c => c.id === chId)?.name ?? chId;
  const crumbs: {label: string; href?: string}[] = [{label: chName, href: hashFor({page: 'today', ch: chId})}];
  if (route.page === 'ep') { crumbs.push({label: epTitle ?? route.ep ?? 'Episode', href: route.step ? hashFor({page: 'ep', ep: route.ep, ch: route.chRaw}) : undefined}); if (route.step) crumbs.push({label: t(STEP_LABEL[route.step])}); }
  else crumbs.push({label: t(PAGE_LABEL[route.page])});
  return (
    <header className="top">
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>{crumbs.map((c, i) => <li key={i} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.href && i < crumbs.length - 1 ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}</li>)}</ol>
      </nav>
      <span className="grow" />
      <div className="scope">
        <label className="sr" htmlFor="scope">Channel scope</label>
        <select id="scope" value={route.ch} onChange={e => setRoute({ch: e.target.value})}>
          <option value="all">All channels</option>
          {chans.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {route.ch !== 'all' && !chans.some(c => c.id === route.ch) && <option value={route.ch}>{route.ch}</option>}
        </select>
      </div>
      <button type="button" className="pal-btn" onClick={onPalette} aria-keyshortcuts="Control+K Meta+K" aria-label="Search and commands">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <span className="pal-ph">Search or run a command</span><kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <JobsChip jobs={jobs} />
    </header>
  );
}
