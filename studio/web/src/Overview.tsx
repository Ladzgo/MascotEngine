// Today page (file kept as Overview.tsx).
import React, {useEffect, useState} from 'react';
import {ago, api, initial, type ChannelRow, type OverviewRow, type Settings, type Summary} from './api';
import {Alert, Bulb, Check, Play, Plus} from './icons';
import {readiness, ReadinessPanel} from './Settings';
import {hashFor, nextStep, setRoute, STEP_LABEL} from './router';

function next(r: OverviewRow, cfg: Settings | null, eps: Summary[]): {text: string; href: string; label: string} {
  if (r.unfinished) { const s = eps.find(e => e.id === r.unfinished!.id); return {text: `Finish "${r.unfinished.title}". It has no final render yet.`, href: hashFor({page: 'ep', ep: r.unfinished.id, step: nextStep(s)}), label: 'Open episode'}; }
  if (r.ideasNew) return {text: `${r.ideasNew} ${r.ideasNew === 1 ? 'idea is' : 'ideas are'} waiting. Pick one to draft.`, href: hashFor({page: 'ideas', ch: r.channel.id}), label: 'Review ideas'};
  return {text: 'Everything is rendered. Generate a fresh batch of ideas.', href: hashFor({page: 'ideas', ch: r.channel.id}), label: 'Get ideas'};
}
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');

export function Overview({ch, chans, eps, cfg, onChanged}: {ch: string; chans: ChannelRow[]; eps: Summary[]; cfg: Settings | null; onChanged: () => void}) {
  const [rows, setRows] = useState<OverviewRow[] | null>(null), [err, setErr] = useState<string | null>(null);
  const [topic, setTopic] = useState(''), [angle, setAngle] = useState(''), [newId, setNewId] = useState('');
  const [drafting, setDrafting] = useState(false), [stop, setStop] = useState(true), [formErr, setFormErr] = useState<string | null>(null);
  useEffect(() => { api.overview().then(x => setRows(x.channels)).catch(e => setErr(e.message)); }, [eps.length]);
  const warn = cfg ? readiness(cfg, cfg.engine).filter(c => !c.ok) : [];
  const target = ch === 'all' ? chans[0]?.id ?? 'default' : ch;
  const shown = (rows ?? []).filter(r => ch === 'all' || r.channel.id === ch);
  const todo = eps.filter(e => (ch === 'all' || e.channel === ch) && !e.archived && !e.stages.final);
  const stale = eps.filter(e => (ch === 'all' || e.channel === ch) && (e.stale.preview || e.stale.final));
  const draftBlock = !cfg ? null : !cfg.draftInstalled ? 'Drafter not installed' : null;

  const draft = async (e: React.FormEvent) => {
    e.preventDefault(); if (!topic.trim() || drafting) return;
    setDrafting(true); setFormErr(null);
    try { const {id} = await api.draft(topic, angle, target); onChanged(); try { sessionStorage.setItem('studio.drafted', id); } catch { /* blocked */ } setRoute({page: 'ep', ep: id, ch: target}); }
    catch (x) { setFormErr((x as Error).message); } finally { setDrafting(false); }
  };
  const make = async () => {
    if (!topic.trim() || drafting) return;
    setDrafting(true); setFormErr(null);
    try { const {id} = await api.makeVideo(topic, angle, target, stop); onChanged(); setRoute({page: 'ep', ep: id, ch: target, step: 'render'}); }
    catch (x) { setFormErr((x as Error).message); } finally { setDrafting(false); }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); const id = slugify(newId); if (!id) return;
    try { const s = await api.create(id, target); onChanged(); setRoute({page: 'ep', ep: s.id, ch: target}); } catch (x) { setFormErr((x as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Today</h1><p className="muted">What needs you next{ch === 'all' ? ' across every channel' : ''}.</p></div><a className="btn" href="#/channels?new=1"><Plus size={16} />New channel</a></div>
      {err && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span></div>}
      {warn.length > 0 && (
        <div className="panel ready-warn"><h2 className="label">Setup needed</h2><ul>{warn.map(c => <li key={c.key}><Alert size={14} /><b>{c.label}</b> {c.fix}</li>)}</ul><p><a className="link" href="#/settings">Open Settings</a></p></div>
      )}
      <ReadinessPanel onlyMissing />
      <div className="today-grid">
        <section aria-labelledby="t-todo" className="panel today-card">
          <h2 id="t-todo" className="display">Unfinished</h2>
          {todo.length ? <ul className="mini">{todo.slice(0, 7).map(e => (
            <li key={e.id}><a href={hashFor({page: 'ep', ep: e.id, step: nextStep(e)})}><b>{e.title}</b><span className="small muted">Next: {STEP_LABEL[nextStep(e)]}{stale.includes(e) ? ' · out of date' : ''}</span></a></li>))}</ul>
            : <div className="empty-line"><p className="muted">Every episode here has a final render.</p><a className="btn sm" href={hashFor({page: 'ideas', ch})}><Bulb size={15} />Get ideas</a></div>}
          {todo.length > 7 && <a className="link small" href={hashFor({page: 'library', ch, status: 'draft'})}>See all {todo.length}</a>}
        </section>
        <form className="panel today-card" id="new" onSubmit={draft} aria-label="Start a new episode">
          <h2 className="display">Start something</h2>
          <p className="small muted">New episodes go to {chans.find(c => c.id === target)?.name ?? target}.</p>
          <label className="field"><span>From a topic</span><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. why savings accounts lose to inflation" disabled={drafting} /></label>
          <label className="field"><span>Angle <em>· optional</em></span><input value={angle} onChange={e => setAngle(e.target.value)} disabled={drafting} /></label>
          <div className="row"><button className="btn primary" type="submit" disabled={drafting || !topic.trim() || !!draftBlock}><Play size={15} />{drafting ? 'Drafting… (about a minute)' : 'Draft script'}</button><button type="button" className="btn" onClick={() => void make()} disabled={drafting || !topic.trim() || !!draftBlock} title="Draft, voice and preview in one go (free, local)"><Play size={15} />Make video</button>{draftBlock && <span className="small muted">{draftBlock}</span>}</div>
          <label className="small" style={{display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row'}}><input style={{width: 'auto', margin: 0}} type="checkbox" checked={stop} onChange={e => setStop(e.target.checked)} />Stop at preview <span className="muted">{stop ? '(voice, plan, preview)' : '(voice, plan, final render)'}</span></label>
          {formErr && <p className="err-text" role="alert">{formErr}</p>}
          <div className="row blank-ep"><label className="field grow"><span>Or a blank episode</span><input value={newId} onChange={e => setNewId(e.target.value)} placeholder="ep003-topic" /></label><button type="button" className="btn" onClick={create} disabled={!newId.trim()}>Create</button></div>
        </form>
      </div>
      {!rows ? <p className="muted">Loading…</p> : (
        <ul className="ov">
          {shown.map(r => { const n = next(r, cfg, eps); return (
            <li key={r.channel.id} className={`panel ov-card ${r.channel.id === ch ? 'on' : ''}`}>
              <div className="ov-head"><span className="badge" aria-hidden="true">{initial(r.channel.name)}</span><div><h2>{r.channel.name}</h2><span className="muted small">{r.channel.niche || 'No niche set'} · {r.channel.postingPerWeek}/week</span></div></div>
              <dl className="stats">
                <div><dd className="num">{r.episodes}</dd><dt>Episodes</dt></div>
                <div><dd className="num">{r.rendered}</dd><dt>Rendered</dt></div>
                <div><dd className="num">{r.ideasNew}</dd><dt>Ideas waiting</dt></div>
              </dl>
              <p className="small muted">{r.lastRender ? <>Last render: {r.lastRender.id}, {ago(r.lastRender.at)}</> : 'Nothing rendered yet.'}</p>
              <div className="next"><span className="small"><b>Next</b> {n.text}</span></div>
              <div className="row">
                <a className="btn primary sm" href={n.href}>{n.href.startsWith('#/ep') ? <Play size={15} /> : n.href.startsWith('#/ideas') ? <Bulb size={15} /> : <Check size={15} />}{n.label}</a>
                {ch === 'all' && <button className="btn ghost sm" onClick={() => setRoute({ch: r.channel.id})}>Switch to</button>}
              </div>
            </li>); })}
        </ul>
      )}
    </div>
  );
}
