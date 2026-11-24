import React, {useEffect, useRef, useState} from 'react';
import {dataApi, useHashParam, type Card, type Columns} from './api-data';
import './data.css';

const COLS: {key: keyof Columns; label: string; empty: string; cta: [string, string]}[] = [
  {key: 'idea', label: 'Ideas', empty: 'No open ideas.', cta: ['Get ideas', '#/ideas']},
  {key: 'script', label: 'Script', empty: 'No episode is waiting on voice.', cta: ['Review ideas', '#/ideas']},
  {key: 'voiced', label: 'Voiced', empty: 'Nothing voiced and unrendered.', cta: ['Open library', '#/library']},
  {key: 'rendered', label: 'Rendered', empty: 'Nothing rendered, awaiting publish.', cta: ['Open library', '#/library']},
  {key: 'published', label: 'Published', empty: 'Nothing published yet.', cta: ['Open calendar', '#/calendar']},
];

export default function Pipeline({ch}: {ch?: string}) {
  const param = useHashParam('ch'), channel = ch ?? param ?? 'all';
  const [cols, setCols] = useState<Columns | null>(null), [err, setErr] = useState<string | null>(null);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []);
  useEffect(() => { setCols(null); dataApi.pipeline(channel).then(r => { setCols(r.columns); setErr(null); }).catch(e => setErr(e.message)); }, [channel]);
  const href = (c: Card) => (c.kind === 'idea' ? `#/ideas?ch=${c.channel}` : `#/ep/${c.id}`);
  return (
    <div className="page data-page">
      <div className="page-head"><div><h1 ref={h1} tabIndex={-1} className="d-h1">Pipeline</h1><p className="muted">Every idea and episode by stage{channel !== 'all' ? ` in ${channel}` : ''}.</p></div></div>
      {err && <div className="alert" role="alert"><span>{err}</span></div>}
      {!cols ? !err && <p className="muted">Loading…</p> : (
        <div className="d-board">
          {COLS.map(c => (
            <section key={c.key} className="d-col panel" aria-label={`${c.label}, ${cols[c.key].length}`}>
              <h2 className="label d-col-h">{c.label} <span className="d-count">{cols[c.key].length}</span></h2>
              {cols[c.key].length === 0 ? <div className="d-empty"><p className="small muted">{c.empty}</p><a className="btn sm" href={c.cta[1]}>{c.cta[0]}</a></div> : (
                <ul className="d-cards">
                  {cols[c.key].map(card => (
                    <li key={`${card.kind}-${card.id}`}>
                      <a className="d-card" href={href(card)}>
                        <b>{card.title}</b>
                        <span className="small muted">{card.kind === 'idea' ? 'Idea' : `${card.scenes} scenes${card.totalSec ? ` · ${Math.round(card.totalSec)}s` : ''}`}{channel === 'all' ? ` · ${card.channel}` : ''}</span>
                        {card.stale && (card.stale.preview || card.stale.final) && <span className="d-tag stale">Out of date</span>}
                        {card.state === 'scheduled' && card.scheduledFor && <span className="d-tag">Scheduled {card.scheduledFor.slice(0, 10)}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
