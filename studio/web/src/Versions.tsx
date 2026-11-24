import React, {useCallback, useEffect, useState} from 'react';
import {dataApi, type VersionRow} from './api-data';
import Compare from './Compare';
import './data.css';
import {Loading} from './Loading';

/** Version history for one episode. onRestored: reload the episode in the workspace. */
export default function Versions({id, onRestored}: {id: string; onRestored?: () => void}) {
  const [rows, setRows] = useState<VersionRow[] | null>(null), [err, setErr] = useState<string | null>(null), [open, setOpen] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const load = useCallback(() => dataApi.versions(id).then(r => { setRows(r); setErr(null); }).catch(e => setErr(e.message)), [id]);
  useEffect(() => { setRows(null); setOpen(null); void load(); }, [load]);
  const restore = async (v: string) => {
    setBusy(true);
    try { await dataApi.restore(id, v); setOpen(null); await load(); onRestored?.(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="d-versions">
      {err && <div className="alert" role="alert"><span>{err}</span></div>}
      {!rows ? !err && <Loading /> : rows.length === 0 ? <p className="small muted">No earlier versions yet. One is saved each time you edit the script.</p> : (
        <ul className="d-vlist">
          {rows.map(v => (
            <li key={v.id}>
              <div className="d-vrow">
                <span><b>{new Date(v.at).toLocaleString()}</b> <span className="small muted">{v.scenes} scenes{v.titleChanged ? ' · title changed' : ''}</span></span>
                <span className="row">
                  <button className="btn sm" aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? 'Hide changes' : 'Compare'}</button>
                  <button className="btn sm" disabled={busy} onClick={() => restore(v.id)} title="Your current script is saved as a version first">Restore</button>
                </span>
              </div>
              {open === v.id && <Compare id={id} versionId={v.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
