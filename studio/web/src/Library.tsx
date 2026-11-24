import React, {useEffect, useMemo, useRef, useState} from 'react';
import {api, mmss, type ChannelRow, type Summary} from './api';
import {dataApi} from './api-data';
import {Film, Plus} from './icons';
import {hashFor, nextStep, setRoute, STEP_LABEL, type Route} from './router';

const STATUSES: [string, string][] = [['', 'All'], ['draft', 'Draft'], ['rendered', 'Rendered'], ['scheduled', 'Scheduled'], ['published', 'Published']];
export const statusOf = (e: Summary): string => e.status?.state === 'published' ? 'published' : e.status?.state === 'scheduled' ? 'scheduled' : e.stages.final ? 'rendered' : 'draft';
const STAGES = [['voice', 'Voice'], ['direct', 'Direct'], ['preview', 'Preview'], ['final', 'Final']] as const;

export function Library({route, eps, chans, loaded, onChanged}: {route: Route; eps: Summary[]; chans: ChannelRow[]; loaded: boolean; onChanged?: () => void}) {
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
  // batch mode: tick episodes, then archive them or queue their previews in one go
  const [pick, setPick] = useState<Set<string> | null>(null), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPick(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const batch = async (kind: 'archive' | 'preview') => {
    if (!pick?.size) return;
    setBusy(true); setMsg(null);
    const ids = [...pick], failed: string[] = [];
    for (const id of ids) {
      try { if (kind === 'archive') await dataApi.archive(id); else await api.generate(id, ['voice', 'direct', 'preview'], 'auto'); } catch (e) { failed.push(`${id}: ${(e as Error).message}`); }
    }
    setBusy(false); setPick(failed.length ? new Set(ids.filter(id => failed.some(f => f.startsWith(`${id}:`)))) : null); onChanged?.();
    setMsg(failed.length ? `${ids.length - failed.length} done, ${failed.length} failed. ${failed.join(' ')}` : kind === 'archive' ? `Archived ${ids.length}.` : `Queued ${ids.length} ${ids.length === 1 ? 'preview' : 'previews'}. See the Queue.`);
  };
  const importZip = async (f?: File) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/episodes/import', {method: 'POST', headers: {'Content-Type': 'application/zip'}, body: f}), j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Import failed (${r.status})`);
      setMsg(`Imported ${j.id}.`); onChanged?.();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const count = (s: string) => scoped.filter(e => !s || statusOf(e) === s).length;
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Library</h1><p className="muted">Every episode{ch === 'all' ? ' in every channel' : ` in ${chName(ch)}`}. Press Enter on a row to open it.</p></div>
        <button type="button" className="btn" aria-pressed={!!pick} onClick={() => { setPick(p => (p ? null : new Set())); setMsg(null); }}>{pick ? 'Done selecting' : 'Select'}</button>
        <label className="btn" aria-disabled={busy}>Import ZIP<input type="file" accept=".zip,application/zip" className="sr" disabled={busy} onChange={e => { void importZip(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <a className="btn primary" href={`${hashFor({page: 'today', ch})}`} onClick={() => setTimeout(() => document.getElementById('new')?.scrollIntoView(), 50)}><Plus size={16} />New episode</a></div>
      <div className="lib-tools">
        <label className="field lib-q"><span className="sr">Search episodes</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or id" /></label>
        <div className="seg" role="radiogroup" aria-label="Status">
          {STATUSES.filter(([k]) => !['scheduled', 'published'].includes(k) || count(k) > 0 || status === k).map(([k, l]) => <button key={k} role="radio" aria-checked={status === k} onClick={() => setRoute({status: k}, true)}>{l} <span className="num">{count(k)}</span></button>)}
        </div>
      </div>
      {pick && (
        <div className="row" role="toolbar" aria-label="Batch actions">
          <span className="small" role="status">{pick.size} selected</span>
          <button type="button" className="btn sm" onClick={() => setPick(new Set(rows.map(r => r.id)))}>Select all shown</button>
          <button type="button" className="btn sm" disabled={!pick.size || busy} onClick={() => void batch('preview')}>Queue previews</button>
          <button type="button" className="btn sm" disabled={!pick.size || busy} onClick={() => void batch('archive')}>Archive</button>
          <button type="button" className="btn sm" disabled={!pick.size} onClick={() => [...pick].forEach((id, i) => setTimeout(() => { const a = document.createElement('a'); a.href = `/api/episodes/${id}/export`; a.download = `${id}.zip`; a.click(); }, i * 400))}>Export ZIP</button>
        </div>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
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
              <li key={e.id} style={pick ? {display: 'flex', alignItems: 'center', gap: 10} : undefined}>
                {pick && <input type="checkbox" checked={pick.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.title}`} style={{width: 'auto', flex: 'none'}} />}
                <a className="lib-row" style={pick ? {flex: 1} : undefined} tabIndex={i === Math.min(focusI, rows.length - 1) ? 0 : -1} href={hashFor({page: 'ep', ep: e.id, step: nextStep(e)})}>
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
