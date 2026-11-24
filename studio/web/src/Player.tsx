import React, {useEffect, useRef, useState} from 'react';
import {arrowNav, type EpisodeData} from './api';
import {Download, Film, Phone, Play} from './icons';

type Tab = 'preview' | 'final' | 'shorts';

/** seek: bump k to jump the video to t seconds (scene selection in the workspace). */
export function Player({data, v, onGenerate, busy, seek}: {data: EpisodeData; v: number; onGenerate: () => void; busy: boolean; seek?: {t: number; k: number}}) {
  const vid = useRef<HTMLVideoElement>(null);
  const id = data.summary.id, st = data.summary.stages;
  const first: Tab = st.final ? 'final' : st.preview ? 'preview' : 'shorts';
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab ?? first;
  useEffect(() => { const e = vid.current; if (seek && e && Number.isFinite(seek.t)) { const go = () => { e.currentTime = seek.t; }; if (e.readyState > 0) go(); else e.addEventListener('loadedmetadata', go, {once: true}); } }, [seek?.k]); // eslint-disable-line react-hooks/exhaustive-deps
  const src = (f: string) => `/api/episodes/${id}/media/${f}?v=${v}`;
  return (
    <section className="panel player" aria-label="Video">
      <div className="tabs" role="tablist" aria-label="Video" onKeyDown={e => arrowNav(e, '[role=tab]')}>
        {(['preview', 'final'] as const).map(t => (
          <button key={t} role="tab" tabIndex={active === t ? 0 : -1} aria-selected={active === t} className="tab" onClick={() => setTab(t)} disabled={!st[t]}>
            <Film size={16} />{t === 'preview' ? 'Preview' : 'Final'}<span className="res"> {t === 'preview' ? '720p' : '1080p'}</span>{data.summary.stale[t] && <span className="stale" title="Out of date: the script changed since this render"><span className="stale-t">out of date</span></span>}
          </button>
        ))}
        <button role="tab" tabIndex={active === 'shorts' ? 0 : -1} aria-selected={active === 'shorts'} className="tab" onClick={() => setTab('shorts')} disabled={!data.shorts.length}>
          <Phone size={16} />Shorts <span className="count">{data.shorts.length}</span>
        </button>
        <span className="grow" />
        {active !== 'shorts' && st[active] && (
          <>
            <a className="btn ghost sm" href={src(`${id}-${active}.mp4`)} download title="Download MP4" aria-label="Download MP4"><Download size={15} /><span className="dl">MP4</span></a>
            <a className="btn ghost sm" href={src(`${id}.srt`)} download title="Download SRT subtitles" aria-label="Download SRT subtitles"><Download size={15} /><span className="dl">SRT</span></a>
          </>
        )}
      </div>
      <div className="stage">
        {active === 'shorts' ? (
          <div className="shorts">
            {data.shorts.map(f => (
              <figure key={f}>
                <video controls preload="metadata" src={`/api/episodes/${id}/shorts/${f}?v=${v}`} />
                <figcaption>{f.replace(`${id}-short-`, '').replace('.mp4', '').replace(/-/g, ' · ')}</figcaption>
              </figure>
            ))}
          </div>
        ) : st[active] ? (
          <video ref={vid} key={`${active}${v}`} className="video" controls preload="metadata" src={`${src(`${id}-${active}.mp4`)}#t=0.1`} />
        ) : (
          <div className="empty">
            <p className="display">Nothing rendered yet</p>
            <p>Press Generate to voice, direct and render this episode.</p>
            <button className="btn primary" onClick={onGenerate} disabled={busy}><Play size={16} />Generate video</button>
          </div>
        )}
      </div>
    </section>
  );
}
