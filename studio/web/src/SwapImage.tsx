import React, {useState} from 'react';
import {call} from './api';

type Hit = {id: string; provider: string; kind: 'photo' | 'video'; thumb: string; title: string; author: string; license: string; pageUrl: string};
type Stock = {query: string; kind: 'photo' | 'video'};

/** Per-beat "Swap image": search licensed stock (Pixabay first), pick a result; the server downloads it and records the credit. */
export function SwapImage({ep, scene, stock, onPicked}: {ep: string; scene: number; stock?: Stock; onPicked: (s: Stock) => void}) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(stock?.query ?? ''), [kind, setKind] = useState<'photo' | 'video'>(stock?.kind ?? 'photo');
  const [hits, setHits] = useState<Hit[] | null>(null), [busy, setBusy] = useState<string | null>(null), [err, setErr] = useState<string | null>(null), [done, setDone] = useState(false);
  const post = (path: string, b: object) => call<any>(`/api/episodes/${ep}/stock/${path}`, {method: 'POST', body: JSON.stringify(b)});
  const search = async () => { setBusy('search'); setErr(null); setDone(false); try { setHits((await post('search', {scene, query: q, kind})).hits); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); } };
  const pick = async (h: Hit) => {
    setBusy(h.id); setErr(null);
    try { const r = await post('swap', {scene, id: h.id, provider: h.provider, query: q}); onPicked({query: r.item.query, kind: h.kind}); setDone(true); setOpen(false); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <fieldset className="swap"><legend>Background picture</legend>
      <p className="small muted">{stock ? `Now: "${stock.query}" (${stock.kind}).` : 'This beat uses the drawn visuals.'} {done && <b className="ok-text">Swapped. Re-render the preview to see it.</b>}</p>
      {!open ? <button type="button" className="btn sm" onClick={() => { setOpen(true); if (!hits && q.length > 1) void search(); }}>Swap image</button> : (
        <>
          <div className="row">
            <input aria-label="Search stock" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} placeholder="English search word, e.g. credit card" maxLength={80} />
            <select aria-label="Photo or video" value={kind} onChange={e => setKind(e.target.value as 'photo' | 'video')}><option value="photo">Photo</option><option value="video">Video</option></select>
            <button type="button" className="btn sm primary" disabled={busy === 'search' || q.trim().length < 2} onClick={() => void search()}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
            <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          {err && <p className="err-text" role="alert">{err} <button type="button" className="btn sm" onClick={() => void search()}>Try again</button></p>}
          {hits && !hits.length && <p className="small muted">No licensed pictures found. Try a simpler English word.</p>}
          {hits && hits.length > 0 && <ul className="swap-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, listStyle: 'none', padding: 0}}>
            {hits.map(h => <li key={`${h.provider}${h.id}`}>
              <button type="button" className="btn ghost" style={{padding: 0, width: '100%'}} disabled={busy !== null} title={`${h.title} · ${h.author} · ${h.license}`} onClick={() => void pick(h)} aria-label={`Use: ${h.title || h.provider}`}>
                {h.kind === 'video' ? <video src={h.thumb} muted preload="metadata" style={{width: '100%', aspectRatio: '9/14', objectFit: 'cover'}} /> : <img src={h.thumb} alt="" loading="lazy" style={{width: '100%', aspectRatio: '9/14', objectFit: 'cover'}} />}
                <span className="small muted" style={{display: 'block'}}>{busy === h.id ? 'Downloading…' : h.provider}</span>
              </button></li>)}
          </ul>}
        </>
      )}
    </fieldset>
  );
}
