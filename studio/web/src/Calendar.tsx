import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {dataApi, useHashParam, type CalEpisode} from './api-data';
import './data.css';

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const when = (e: CalEpisode) => (e.status.state === 'published' ? e.status.publishedAt : e.status.state === 'scheduled' ? e.status.scheduledFor : undefined);

export default function Calendar({ch}: {ch?: string}) {
  const param = useHashParam('ch'), channel = ch ?? param ?? 'all';
  const [eps, setEps] = useState<CalEpisode[] | null>(null), [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null), [date, setDate] = useState(day(new Date())), [url, setUrl] = useState('');
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []);
  const load = useCallback(() => dataApi.episodes().then(r => { setEps(r); setErr(null); }).catch(e => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  const list = useMemo(() => (eps ?? []).filter(e => !e.status.archived && (channel === 'all' || e.channel === channel)), [eps, channel]);
  const byDay = useMemo(() => { const m: Record<string, CalEpisode[]> = {}; for (const e of list) { const w = when(e); if (w) (m[day(new Date(w))] ??= []).push(e); } return m; }, [list]);
  const ready = list.filter(e => e.status.state === 'draft' && e.stages.final);
  const drafts = list.filter(e => e.status.state === 'draft' && !e.stages.final);
  const cur = list.find(e => e.id === sel) ?? null;
  const act = async (state: 'draft' | 'scheduled' | 'published') => {
    if (!cur) return;
    try { await dataApi.setStatus(cur.id, {state, ...(state === 'scheduled' ? {scheduledFor: new Date(`${date}T09:00`).toISOString()} : {}), ...(state === 'published' && url.trim() ? {youtubeUrl: url.trim()} : {})}); setUrl(''); await load(); } catch (e) { setErr((e as Error).message); }
  };
  // schedule export: every scheduled episode (current channel scope) as an iCalendar file for any calendar app
  const scheduled = list.filter(e => e.status.state === 'scheduled' && e.status.scheduledFor);
  const exportIcs = () => {
    const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (t: string) => t.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, ' ');
    const ev = scheduled.map(e => { const s = new Date(e.status.scheduledFor!); return ['BEGIN:VEVENT', `UID:${e.id}@mascot-engine`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(s)}`, `DTEND:${z(new Date(s.getTime() + 3600e3))}`, `SUMMARY:${esc(`Publish: ${e.title}`)}`, `DESCRIPTION:${esc(`Episode ${e.id}`)}`, 'END:VEVENT'].join('\r\n'); });
    const blob = new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mascot Engine//Schedule//EN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n'], {type: 'text/calendar'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'publishing-schedule.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const first = (month.getDay() + 6) % 7, dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({length: Math.ceil((first + dim) / 7) * 7}, (_, i) => (i < first || i >= first + dim ? null : new Date(month.getFullYear(), month.getMonth(), i - first + 1)));
  return (
    <div className="page data-page">
      <div className="page-head"><div><h1 ref={h1} tabIndex={-1} className="d-h1">Calendar</h1><p className="muted">Schedule rendered episodes and record what went live.</p></div>
        <div className="row"><a className="btn sm" href="/api/schedule.csv" download title="Titles, descriptions, tags, files and language of every finished video, Short and clip">Export upload sheet (.csv)</a>
        <button className="btn sm" onClick={exportIcs} disabled={!scheduled.length} title={scheduled.length ? 'Download scheduled episodes as .ics' : 'Schedule an episode first'}>Export schedule (.ics)</button>
        <button className="btn sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Prev</button>
          <b className="d-month" aria-live="polite">{month.toLocaleString(undefined, {month: 'long', year: 'numeric'})}</b>
          <button className="btn sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</button></div></div>
      {err && <div className="alert" role="alert"><span>{err}</span></div>}
      {!eps ? !err && <p className="muted">Loading…</p> : (
        <div className="d-cal-wrap">
          <div className="d-cal panel" role="grid" aria-label="Month">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => <div key={w} className="d-dow label" role="columnheader">{w}</div>)}
            {cells.map((c, i) => (
              <div key={i} role="gridcell" className={`d-day ${c ? '' : 'off'} ${c && day(c) === day(new Date()) ? 'today' : ''}`} onClick={() => c && setDate(day(c))}>
                {c && <span className="small d-num">{c.getDate()}</span>}
                {c && (byDay[day(c)] ?? []).map(e => <button key={e.id} className={`d-chip ${e.status.state}`} aria-pressed={sel === e.id} onClick={ev => { ev.stopPropagation(); setSel(e.id); }}>{e.title}</button>)}
              </div>
            ))}
          </div>
          <aside className="d-side">
            <section className="panel d-pad">
              <h2 className="label">{cur ? cur.title : 'Pick an episode'}</h2>
              {!cur ? <p className="small muted">Select an episode below or on the calendar.</p> : <>
                <p className="small muted">{cur.status.state}{when(cur) ? ` · ${new Date(when(cur)!).toLocaleDateString()}` : ''}{cur.status.youtubeUrl ? ' · ' : ''}{cur.status.youtubeUrl && <a href={cur.status.youtubeUrl} target="_blank" rel="noreferrer">YouTube</a>}</p>
                <label className="small" htmlFor="cal-date">Date</label>
                <input id="cal-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                <label className="small" htmlFor="cal-url">YouTube link (optional, for published)</label>
                <input id="cal-url" type="url" placeholder="https://youtu.be/..." value={url} onChange={e => setUrl(e.target.value)} />
                <div className="row">
                  <button className="btn sm primary" onClick={() => act('scheduled')}>Schedule</button>
                  <button className="btn sm" onClick={() => act('published')}>Mark published</button>
                  {cur.status.state !== 'draft' && <button className="btn sm" onClick={() => act('draft')}>Back to draft</button>}
                  <a className="btn sm ghost" href={`#/ep/${cur.id}`}>Open</a>
                </div>
              </>}
            </section>
            <section className="panel d-pad"><h2 className="label">Ready to schedule ({ready.length})</h2>
              {ready.length === 0 ? <div className="d-empty"><p className="small muted">No rendered episode is waiting.</p><a className="btn sm" href="#/pipeline">Open pipeline</a></div> :
                <ul className="d-pick">{ready.map(e => <li key={e.id}><button className={`btn sm ${sel === e.id ? 'primary' : ''}`} onClick={() => setSel(e.id)}>{e.title}</button></li>)}</ul>}
              {drafts.length > 0 && <p className="small muted">{drafts.length} more still need a final render.</p>}</section>
          </aside>
        </div>
      )}
    </div>
  );
}
