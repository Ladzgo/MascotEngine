import React, {useEffect, useMemo, useRef, useState} from 'react';
import {mmss, type ChannelRow, type Summary} from './api';
import {Film, Plus} from './icons';
import {hashFor, nextStep, setRoute, STEP_LABEL, type Route} from './router';

const STATUSES: [string, string][] = [['', 'All'], ['draft', 'Draft'], ['rendered', 'Rendered'], ['scheduled', 'Scheduled'], ['published', 'Published']];
export const statusOf = (e: Summary): string => e.status?.state === 'published' ? 'published' : e.status?.state === 'scheduled' ? 'scheduled' : e.stages.final ? 'rendered' : 'draft';
const STAGES = [['voice', 'Voice'], ['direct', 'Direct'], ['preview', 'Preview'], ['final', 'Final']] as const;

export function Library({route, eps, chans, loaded}: {route: Route; eps: Summary[]; chans: ChannelRow[]; loaded: boolean}) {
  const {ch, status} = route;
  const [q, setQ] = useState(route.q);
  useEffect(() => { setQ(route.q); }, [route.q]);
  useEffect(() => { if (q === route.q) return; const t = setTimeout(() => setRoute({q}, true), 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = eps.filter(e => (ch === 'all' || e.channel === ch) && !e.archived);
  const rows = useMemo(() => scoped.filter(e => (!status || statusOf(e) === status) && (!q.trim() || `${e.title} ${e.id}`.toLowerCase().includes(q.trim().toLowerCase()))), [scoped, status, q]);
  const chName = (id: string) => chans.find(c => c.id === id)?.name ?? id;
  const list = useRef<HTMLUListElement>(null);
  const [focusI, setFocusI] = useState(0);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const links = [...list.current!.querySelectorAll<HTMLAnchorElement>('a.lib-row')];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement); if (i < 0) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : Math.max(0, Math.min(links.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    setFocusI(n); links[n].focus();
  };
  const count = (s: string) => scoped.filter(e => !s || statusOf(e) === s).length;
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Library</h1><p className="muted">Every episode{ch === 'all' ? ' in every channel' : ` in ${chName(ch)}`}. Press Enter on a row to open it.</p></div>
        <a className="btn primary" href={`${hashFor({page: 'today', ch})}`} onClick={() => setTimeout(() => document.getElementById('new')?.scrollIntoView(), 50)}><Plus size={16} />New episode</a></div>
      <div className="lib-tools">
        <label className="field lib-q"><span className="sr">Search episodes</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or id" /></label>
        <div className="seg" role="radiogroup" aria-label="Status">
          {STATUSES.filter(([k]) => !['scheduled', 'published'].includes(k) || count(k) > 0 || status === k).map(([k, l]) => <button key={k} role="radio" aria-checked={status === k} onClick={() => setRoute({status: k}, true)}>{l} <span className="num">{count(k)}</span></button>)}
        </div>
      </div>
      {!loaded ? <p className="muted">Loading…</p> : !rows.length ? (
        <div className="panel empty-box"><Film size={28} /><h2 className="display">{scoped.length ? 'No episodes match' : 'No episodes yet'}</h2>
          <p>{scoped.length ? 'Clear the search or pick another status.' : 'Draft one from a topic and it will show up here.'}</p>
          {scoped.length ? <button className="btn" onClick={() => { setQ(''); setRoute({q: '', status: ''}, true); }}>Clear filters</button> : <a className="btn primary" href={hashFor({page: 'today', ch})}>Start an episode</a>}
        </div>
      ) : (
        <ul className="lib" ref={list} onKeyDown={onKey}>
          {rows.map((e, i) => {
            const st = statusOf(e);
            return (
              <li key={e.id}><a className="lib-row" tabIndex={i === Math.min(focusI, rows.length - 1) ? 0 : -1} href={hashFor({page: 'ep', ep: e.id, step: nextStep(e)})}>
                <span className="lib-t"><b className={e.title.trim().toLowerCase() === 'untitled' ? 'untitled' : ''}>{e.title}</b><span className="small muted">{e.id}{ch === 'all' ? ` · ${chName(e.channel)}` : ''}</span></span>
                <span className="lib-stages" aria-label="Progress">{STAGES.map(([k, l]) => <i key={k} className={e.stages[k] ? 'on' : ''}><span className="sr">{l} {e.stages[k] ? 'done' : 'not done'}</span></i>)}</span>
                <span className="small num lib-n">{e.scenes} {e.scenes === 1 ? "scene" : "scenes"}{e.totalSec ? ` · ${mmss(e.totalSec)}` : ''}</span>
                <span className={`status ${st}`}>{e.stale.final || e.stale.preview ? 'Out of date' : st === 'draft' ? `Next: ${STEP_LABEL[nextStep(e)]}` : st[0].toUpperCase() + st.slice(1)}</span>
              </a></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
