import React, {useCallback, useEffect, useState} from 'react';
import {api, nice, type Channel, type ChannelRow, type Idea, type IdeasData, type Settings} from './api';
import {Alert, Bulb, Trash, Undo, Wand} from './icons';
import {setRoute} from './router';
import {t} from './i18n';
import {toast} from './toast';

type Filter = 'new' | 'drafted' | 'dismissed';

export function Ideas({channel, cfg, chans, f}: {channel: Channel | null; cfg: Settings | null; chans: ChannelRow[]; f: string}) {
  const [data, setData] = useState<IdeasData | null>(null);
  const filter: Filter = f === 'drafted' || f === 'dismissed' ? f : 'new';
  const setFilter = (x: Filter) => setRoute({f: x === 'new' ? '' : x}, true);
  const [focus, setFocus] = useState(''), [count, setCount] = useState(10);
  const [gen, setGen] = useState(false), [genT0, setGenT0] = useState(0), [tick, setTick] = useState(0), [err, setErr] = useState<string | null>(null);
  const [work, setWork] = useState<string | null>(null), [fmt, setFmt] = useState<'short' | 'wide'>('short');
  useEffect(() => { if (!gen) return; const i = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(i); }, [gen]);
  const id = channel?.id;
  const load = useCallback(() => { if (id) api.ideas(id).then(setData).catch(e => setErr(e.message)); }, [id]);
  useEffect(() => { setData(null); setErr(null); load(); }, [load]);
  if (!channel) return (
    <div className="page"><div className="page-head"><div><h1 className="display" tabIndex={-1}>Ideas</h1><p className="muted">Ideas live on one channel at a time. Pick a channel to see its board.</p></div></div>
      {chans.length ? <div className="row">{chans.map(c => <button key={c.id} className="btn" onClick={() => setRoute({ch: c.id})}>{c.name}</button>)}</div> : <p className="muted">Loading…</p>}</div>
  );

  const block = cfg && !cfg.ideasInstalled ? 'The ideas command is not installed yet.' : null;
  const run = async (e: React.FormEvent) => {
    e.preventDefault(); setGen(true); setGenT0(Date.now()); setErr(null);
    try { setData(await api.genIdeas(channel.id, count, focus)); setFilter('new'); } catch (x) { setErr((x as Error).message); } finally { setGen(false); }
  };
  const act = async (i: Idea, f: () => Promise<unknown>) => {
    setWork(i.id); setErr(null);
    try { await f(); load(); } catch (x) { setErr((x as Error).message); } finally { setWork(null); }
  };
  const draft = async (i: Idea) => {
    setWork(i.id); setErr(null);
    try { const r = await api.draftIdea(channel.id, i.id, fmt); toast(t('Started. Your video is being made.')); setRoute({page: 'new', ep: r.id, ch: channel.id}); } // the draft runs in the background; the progress page shows each step
    catch (x) { setErr((x as Error).message); toast((x as Error).message, 'bad'); setWork(null); }
  };

  const ideas = data?.ideas ?? [];
  const n = (s: Filter) => ideas.filter(i => i.status === s).length;
  const shown = ideas.filter(i => i.status === filter);
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Ideas</h1><p className="muted">Video ideas for {channel.name}. Pick one and the video is made for you.</p></div></div>
      <form className="panel idea-gen" onSubmit={run}>
        <label className="field grow"><span>Focus <em>· optional</em></span><input value={focus} onChange={e => setFocus(e.target.value)} placeholder="e.g. mortgage myths, or what happened this month" disabled={gen} maxLength={300} /></label>
        <label className="field cnt"><span>How many</span><input type="number" min={1} max={20} value={count} onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="num" disabled={gen} /></label>
        <label className="field cnt"><span>{t('Format')}</span><select value={fmt} onChange={e => setFmt(e.target.value as 'short' | 'wide')}><option value="short">{t('Short')} 9:16</option><option value="wide">{t('Long')} 16:9</option></select></label>
        <button className={`btn ${shown.length ? '' : 'primary'}`} type="submit" disabled={gen || !!block}><Wand size={16} />{gen ? 'Thinking…' : 'Generate ideas'}</button>
        {gen && <span className="small muted" role="status" data-t={tick}>{Math.round((Date.now() - genT0) / 1000)} s · usually 1 to 2 minutes <button type="button" className="btn sm" onClick={() => void api.ideasCancel()}>{t('Cancel')}</button></span>}
        {block && <p className="hint idea-block"><Alert size={13} />{block}</p>}
      </form>
      {err && <div className="alert" role="alert"><Alert size={18} /><span className="pre">{err}</span><button className="btn ghost sm" onClick={() => setErr(null)}>Dismiss</button></div>}
      <div className="seg" role="radiogroup" aria-label="Filter ideas">
        {(['new', 'drafted', 'dismissed'] as Filter[]).map(s => <button key={s} role="radio" aria-checked={filter === s} onClick={() => setFilter(s)}>{s[0].toUpperCase() + s.slice(1)} <span className="num">{n(s)}</span></button>)}
      </div>
      {data && !ideas.length ? (
        <div className="panel empty-box">
          <Bulb size={28} />
          <h2 className="display">No ideas yet</h2>
          <p>Press Generate ideas above to fill this board (free, runs on this Mac). Each idea comes with an angle, an opening hook and a note on sources.</p>
          {data.generatedAt === '' && <p className="hint">Nothing has been generated for {channel.name} so far.</p>}
        </div>
      ) : data && !shown.length ? <p className="muted">No {filter} ideas.</p> : (
        <ul className="ideas">
          {shown.map((i, k) => (
            <li key={i.id} className="panel idea">
              <h2>{i.title}</h2>
              <p className="angle"><b>Angle</b> {i.angle}</p>
              <p className="hook">“{i.hook}”</p>
              <p className="small why">{i.whyInteresting}</p>
              {i.viewer && <p className="small"><b>{t('For')}</b> {i.viewer}</p>}
              {i.facts && i.facts.length > 0 && <div className="small"><b>{t('Surprising facts')}</b><ul className="src">{i.facts.map((f, k) => <li key={k}>{f.fact}{f.source ? <span className="muted"> ({f.source})</span> : null}</li>)}</ul></div>}
              <div className="chips">{i.device && <i>{nice(i.device)}</i>}{i.format && <i>{nice(i.format)}</i>}{i.difficulty && <i>{nice(i.difficulty)}</i>}</div>
              {i.needsSources.length > 0 && <div className="small"><b>Needs sources</b><ul className="src">{i.needsSources.map((s, k) => <li key={k}>{s}</li>)}</ul></div>}
              <div className="row idea-actions">
                {i.status === 'new' && <><button className={`btn sm ${k === 0 ? 'primary' : ''}`} disabled={work !== null} onClick={() => draft(i)}><Wand size={15} />{work === i.id ? t('Starting…') : t('Make video')}</button><button className="btn ghost sm" disabled={work !== null} onClick={() => act(i, () => api.setIdea(channel.id, i.id, 'dismissed'))}><Trash size={15} />Dismiss</button></>}
                {i.status === 'drafted' && (i.episodeId ? <a className="btn sm" href={`#/ep/${i.episodeId}?ch=${channel.id}`}>Open episode</a> : <span className="muted small">Drafted</span>)}
                {i.status === 'dismissed' && <button className="btn sm" disabled={work !== null} onClick={() => act(i, () => api.setIdea(channel.id, i.id, 'new'))}><Undo size={15} />Restore</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
