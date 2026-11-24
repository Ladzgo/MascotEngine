import React, {useEffect, useState} from 'react';
import './data.css';

type Doc = {title: string; scenes: {type: string; narration: string}[]};
const fetchJson = async (u: string) => { const r = await fetch(u); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Request failed'); return j; };

/** Scene-by-scene narration diff between a saved version and the current episode (or between two versions via `otherVersionId`). */
export default function Compare({id, versionId, otherVersionId}: {id: string; versionId: string; otherVersionId?: string}) {
  const [a, setA] = useState<Doc | null>(null), [b, setB] = useState<Doc | null>(null), [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setA(null); setB(null);
    fetchJson(`/api/episodes/${id}/versions/${versionId}`).then(v => setA(v.episode)).catch(e => setErr(e.message));
    (otherVersionId ? fetchJson(`/api/episodes/${id}/versions/${otherVersionId}`).then(v => v.episode) : fetchJson(`/api/episodes/${id}`).then(v => v.episode)).then(setB).catch(e => setErr(e.message));
  }, [id, versionId, otherVersionId]);
  if (err) return <div className="alert" role="alert"><span>{err}</span></div>;
  if (!a || !b) return <p className="muted small">Loading…</p>;
  const n = Math.max(a.scenes.length, b.scenes.length);
  const changed = Array.from({length: n}, (_, i) => a.scenes[i]?.narration !== b.scenes[i]?.narration || a.scenes[i]?.type !== b.scenes[i]?.type);
  return (
    <div className="d-compare">
      <p className="small muted">Left: saved version. Right: {otherVersionId ? 'other version' : 'current'}. {changed.filter(Boolean).length} of {n} scenes differ{a.title !== b.title ? '; title differs' : ''}.</p>
      {a.title !== b.title && <div className="d-crow chg"><div><span className="label">Title</span><p>{a.title}</p></div><div><span className="label">Title</span><p>{b.title}</p></div></div>}
      {changed.every(c => !c) && a.title === b.title ? <p className="small">Identical.</p> : Array.from({length: n}, (_, i) => changed[i] && (
        <div key={i} className="d-crow chg">
          <div><span className="label">Scene {i + 1}{a.scenes[i] ? ` · ${a.scenes[i].type}` : ''}</span><p>{a.scenes[i]?.narration ?? <i className="muted">(no scene)</i>}</p></div>
          <div><span className="label">Scene {i + 1}{b.scenes[i] ? ` · ${b.scenes[i].type}` : ''}</span><p>{b.scenes[i]?.narration ?? <i className="muted">(no scene)</i>}</p></div>
        </div>
      ))}
    </div>
  );
}
