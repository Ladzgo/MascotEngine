import React, {useEffect, useRef, useState} from 'react';
import {api, mmss, type PublishPack, type Settings} from './api';
import {Alert, Check, Copy, Send} from './icons';
import {apiWs, unsupported, type EpState, type EpStatus} from './api-ws';
import {t as tr} from './i18n';

/** Publish record. Hidden entirely when the status endpoint does not exist. */
function StatusBox({epId, onStatus}: {epId: string; onStatus?: (s: EpStatus) => void}) {
  const [st, setSt] = useState<EpStatus | null>(null), [off, setOff] = useState(false), [err, setErr] = useState<string | null>(null), [ok, setOk] = useState(false);
  useEffect(() => { setSt(null); setOff(false); apiWs.status(epId).then(s => { setSt(s); onStatus?.(s); }).catch(e => { if (unsupported(e)) setOff(true); else setSt({state: 'draft'}); }); }, [epId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (off || !st) return null;
  const set = (p: Partial<EpStatus>) => { setSt({...st, ...p}); setOk(false); };
  const save = async () => { setErr(null); try { const n = {...st, ...(st.state === 'published' && !st.publishedAt ? {publishedAt: new Date().toISOString()} : {})}; const r = await apiWs.setStatus(epId, n); setSt(r); onStatus?.(r); setOk(true); } catch (e) { setErr((e as Error).message); } };
  return (
    <fieldset className="pubstat"><legend>{tr('Publish record')}</legend>
      <div className="two">
        <label className="field"><span>{tr('State')}</span><select value={st.state} onChange={e => set({state: e.target.value as EpState})}><option value="draft">{tr('Draft')}</option><option value="scheduled">{tr('Scheduled')}</option><option value="published">{tr('Published')}</option></select></label>
        {st.state === 'scheduled' && <label className="field"><span>{tr('Scheduled for')}</span><input type="datetime-local" value={(st.scheduledFor ?? '').slice(0, 16)} onChange={e => set({scheduledFor: e.target.value})} /></label>}
        {st.state === 'published' && <label className="field"><span>{tr('YouTube URL')}</span><input type="url" value={st.youtubeUrl ?? ''} onChange={e => set({youtubeUrl: e.target.value})} placeholder="https://youtu.be/..." /></label>}
      </div>
      <div className="row"><button type="button" className="btn sm" onClick={save}>{tr('Save record')}</button><span className="small muted" role="status">{ok ? tr('Saved') : ''}</span>{err && <span className="err-text small" role="alert">{err}</span>}</div>
    </fieldset>
  );
}

function CopyBtn({text, label}: {text: string; label: string}) {
  const [ok, setOk] = useState(false), t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const go = async () => { try { await navigator.clipboard.writeText(text); setOk(true); clearTimeout(t.current); t.current = window.setTimeout(() => setOk(false), 1600); } catch { /* clipboard blocked */ } };
  return <button className="btn ghost sm" onClick={go} aria-label={`${tr('Copy')} ${label}`}>{ok ? <Check size={14} /> : <Copy size={14} />}<span aria-live="polite">{ok ? tr('Copied') : tr('Copy')}</span></button>;
}

export function Publish({epId, cfg, hasVideo, onStatus}: {epId: string; cfg: Settings | null; hasVideo: boolean; onStatus?: (s: EpStatus) => void}) {
  const [pack, setPack] = useState<PublishPack | null>(null), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { setPack(null); setLoaded(false); setErr(null); api.pack(epId).then(r => setPack(r.pack)).catch(e => setErr(e.message)).finally(() => setLoaded(true)); }, [epId]);
  const make = async () => { setBusy(true); setErr(null); try { setPack((await api.makePack(epId)).pack); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const [thumbV, setThumbV] = useState(0), [thumbBusy, setThumbBusy] = useState(false), [thumbMissing, setThumbMissing] = useState(false);
  const makeThumb = async (text?: string) => { setThumbBusy(true); setErr(null); try { await api.makeThumb(epId, text); setThumbMissing(false); setThumbV(Date.now()); } catch (e) { setErr((e as Error).message); } finally { setThumbBusy(false); } };
  const block = cfg && !cfg.publishInstalled ? tr('The publish pack command is not installed yet.') : null;
  const chapters = pack ? pack.chapters.map(c => `${mmss(c.startSec)} ${c.title}`).join('\n') : '';
  return (
    <>
      <StatusBox epId={epId} onStatus={onStatus} />
      <p className="muted small">{tr('Titles, description, tags, chapters and thumbnail text for YouTube. Review before you paste.')}</p>
      <div className="row">
        <button className="btn primary sm" onClick={make} disabled={busy || !!block || !loaded}><Send size={15} />{busy ? tr('Generating…') : pack ? tr('Regenerate pack') : tr('Generate publish pack')}</button>
        {pack && <span className={`pill ${pack.source === 'ai' ? 'ok' : 'bad'}`}>{pack.source === 'ai' ? tr('AI-generated') : tr('Fallback (no AI)')}</span>}
      </div>
      {block && <p className="hint">{block} <a href="#/settings">{tr('Settings')}</a></p>}
      {!hasVideo && !pack && <p className="hint">{tr('Chapters are most accurate after the voice step has run.')}</p>}
      <section className="pk"><div className="pk-h"><h3>{tr('Thumbnail')}</h3><button className="btn sm" disabled={thumbBusy} onClick={() => void makeThumb()}>{thumbBusy ? tr('Rendering…') : tr('Make thumbnail (free)')}</button></div>
        {!thumbMissing && <img key={thumbV} className="thumb-img" alt={tr('Thumbnail preview')} src={`/api/episodes/${epId}/media/thumbnail.png?v=${thumbV}`} onError={() => setThumbMissing(true)} style={{maxWidth: '100%', width: 480, borderRadius: 8, border: '2px solid var(--ink)'}} />}
        {thumbMissing && <p className="muted small">{tr('No thumbnail yet. It uses the first thumbnail text from the pack, or the title.')}</p>}</section>
      {err && <p className="err-text pre" role="alert"><Alert size={13} /> {err}</p>}
      {pack && (
        <>
          <section className="pk"><h3>{tr('Title options')}</h3>
            <ol className="titles">{pack.titles.map((t, i) => <li key={i}><span className="t">{t}</span><span className="small muted num">{t.length}</span><CopyBtn text={t} label={`title ${i + 1}`} /></li>)}</ol></section>
          <section className="pk"><div className="pk-h"><h3>{tr('Description')}</h3><CopyBtn text={pack.description} label={tr('description')} /></div><pre className="variety wrap">{pack.description}</pre></section>
          <section className="pk"><div className="pk-h"><h3>{tr('Tags')}</h3><CopyBtn text={pack.tags.join(', ')} label={tr('tags')} /></div><div className="chips">{pack.tags.map((t, i) => <i key={i}>{t}</i>)}</div></section>
          <section className="pk"><div className="pk-h"><h3>{tr('Chapters')}</h3>{pack.chapters.length > 0 && <CopyBtn text={chapters} label={tr('chapters')} />}</div>
            {pack.chapters.length ? <ul className="chaps">{pack.chapters.map((c, i) => <li key={i}><code className="num">{mmss(c.startSec)}</code>{c.title}</li>)}</ul> : <p className="muted small">{tr('No chapters.')}</p>}</section>
          <section className="pk"><h3>{tr('Thumbnail text')}</h3>
            <ul className="titles">{pack.thumbnailText.map((t, i) => <li key={i}><span className="t thumb">{t}</span><CopyBtn text={t} label={`thumbnail text ${i + 1}`} /><button className="btn sm" disabled={thumbBusy} onClick={() => void makeThumb(t)}>{tr('Use')}</button></li>)}</ul></section>
        </>
      )}
    </>
  );
}
