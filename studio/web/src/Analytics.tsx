import React, {useEffect, useState} from 'react';
import {api, type AnalyticsSummary} from './api';
import {Alert} from './icons';

/** What viewers do: retention by scene type and by hook kind, from YouTube Studio exports (npm run analytics). */
export function Analytics() {
  const [s, setS] = useState<AnalyticsSummary | null>(null), [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.analytics().then(setS).catch(e => setErr((e as Error).message)); }, []);
  const maxLoss = Math.max(1, ...(s?.byType.map(t => t.avgLossPer10s) ?? [1]));
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Analytics</h1><p className="muted">Which scene types keep viewers, and which hooks hold them. Needs YouTube Studio exports.</p></div></div>
      {err && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span></div>}
      {!s ? <p className="muted" role="status">Loading…</p> : s.withCurve === 0 ? (
        <section className="panel empty-box" aria-label="How to import">
          <h2 className="display">No retention data yet</h2>
          <p>After a video has been public for a few days, export its numbers from YouTube Studio and import them here.</p>
          <ol>
            <li>YouTube Studio, then Analytics, then the video, then Engagement. Open the Audience retention chart and choose Export current view, CSV.</li>
            <li>In a terminal: <code>npm run analytics -- import retention.csv --id &lt;episode-id&gt;</code></li>
            <li>Reload this page. With 3 or more videos the director starts nudging pacing by what held viewers (a gentle 0.9 to 1.1 weight).</li>
          </ol>
          <p className="small muted">{s.videos ? `${s.videos} ${s.videos === 1 ? 'video is' : 'videos are'} imported without a retention curve or without a matching episode.` : 'Nothing imported yet.'}</p>
        </section>
      ) : (
        <>
          <p className="small muted" role="status">{s.withCurve} {s.withCurve === 1 ? 'video' : 'videos'} with a retention curve. {s.note}</p>
          <section className="panel today-card" aria-label="Loss by scene type">
            <h2 className="display">Audience lost per 10 seconds, by scene type</h2>
            <table className="num"><thead><tr><th scope="col">Scene type</th><th scope="col">Scenes</th><th scope="col">Lost per 10 s</th><th scope="col"><span className="sr">Bar</span></th></tr></thead>
              <tbody>{s.byType.map(t => (
                <tr key={t.type}><th scope="row">{t.type.replace(/_/g, ' ')}{t.type === s.best ? ' (best)' : t.type === s.worst ? ' (worst)' : ''}</th><td>{t.scenes}</td><td>{t.avgLossPer10s}%</td>
                  <td><div role="img" aria-label={`${t.avgLossPer10s} percent`} style={{height: 10, width: `${Math.max(2, (t.avgLossPer10s / maxLoss) * 100)}%`, minWidth: 4, background: 'var(--accent)', borderRadius: 3}} /></td></tr>))}</tbody></table>
          </section>
          <section className="panel today-card" aria-label="Hooks">
            <h2 className="display">Hooks</h2>
            <table className="num"><thead><tr><th scope="col">Episode</th><th scope="col">Hook</th><th scope="col">Still watching after the hook</th></tr></thead>
              <tbody>{s.hooks.map(h => <tr key={h.episode}><th scope="row">{h.episode}</th><td>{h.kind.replace(/_/g, ' ')}</td><td>{h.retentionAfterHook}%</td></tr>)}</tbody></table>
          </section>
        </>
      )}
    </div>
  );
}
