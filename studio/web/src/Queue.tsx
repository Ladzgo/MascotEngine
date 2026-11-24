import React, {useEffect, useRef, useState} from 'react';
import {askNotifications, dataApi, useQueueNotifications, type JobBrief} from './api-data';
import './data.css';

const label = (j: JobBrief) => j.stages.join(' > ');
function Row({j, onCancel, onRetry, busy}: {j: JobBrief; onCancel?: () => void; onRetry?: () => void; busy?: boolean}) {
  return (
    <li className={`d-job ${j.status}`}>
      <div><a href={`#/ep/${j.episode}`}><b>{j.episode}</b></a> <span className="small muted">{label(j)} · {j.engine}</span>
        {j.status === 'running' && <div className="d-bar" role="progressbar" aria-label="Progress" aria-valuenow={Math.round(j.progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{width: `${Math.round(j.progress * 100)}%`}} /></div>}
        {j.error && <p className="small d-err">{j.error}</p>}
        {j.log?.length ? <details><summary className="small">Log</summary><pre className="small" style={{whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto'}}>{j.log.join('\n')}</pre></details> : null}
      </div>
      <span className="small">{j.status === 'running' ? `Running ${j.current ?? ''}${j.step ? ` (step ${j.step}` : ''}${j.step && j.status === 'running' ? `, ${Math.round(j.progress * 100)}%)` : j.step ? ')' : ''}` : j.status === 'queued' ? `Waiting (#${j.position})` : j.status}</span>
      {onRetry && j.status === 'error' && <button className="btn sm" onClick={onRetry} disabled={busy}>Retry</button>}
      {onCancel && <button className="btn sm" onClick={onCancel} disabled={busy}>{j.status === 'running' ? 'Cancel run' : 'Remove'}</button>}
    </li>
  );
}

export default function Queue() {
  const q = useQueueNotifications(), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'denied');
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []);
  const cancel = async (id: string) => { setBusy(true); try { await dataApi.dequeue(id); setErr(null); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const retry = async (j: JobBrief) => { setBusy(true); try { await dataApi.enqueue(j.episode, j.stages, j.engine); setErr(null); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const empty = q && !q.running && !q.queued.length;
  return (
    <div className="page data-page">
      <div className="page-head"><div><h1 ref={h1} tabIndex={-1} className="d-h1">Queue</h1><p className="muted">One run at a time; the rest wait here in order.</p></div>
        {perm === 'default' && <button className="btn sm" onClick={() => askNotifications().then(() => setPerm(Notification.permission))}>Notify me when runs finish</button>}</div>
      {err && <div className="alert" role="alert"><span>{err}</span></div>}
      {!q ? <p className="muted">Loading…</p> : <>
        {empty && <div className="d-empty panel"><p className="muted">Nothing is running or waiting.</p><a className="btn primary" href="#/library">Open library to generate</a></div>}
        {q.running && <section><h2 className="label">Running</h2><ul className="d-jobs"><Row j={q.running} busy={busy} onCancel={() => cancel(q.running!.jobId)} /></ul></section>}
        {q.queued.length > 0 && <section><h2 className="label">Waiting ({q.queued.length})</h2><ul className="d-jobs">{q.queued.map(j => <Row key={j.jobId} j={j} busy={busy} onCancel={() => cancel(j.jobId)} />)}</ul></section>}
        {q.recent.length > 0 && <section><h2 className="label">Recent</h2><ul className="d-jobs">{q.recent.map(j => <Row key={j.jobId} j={j} busy={busy} onRetry={() => retry(j)} />)}</ul></section>}
      </>}
    </div>
  );
}
