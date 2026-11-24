import React, {useState} from 'react';
import type {JobState, Stage, Summary} from './api';
import {Alert, Check, Film, Mic, Phone, Reel, Wand, X} from './icons';

const STAGES: {id: Stage; label: string; Icon: (p: {size?: number}) => React.ReactElement}[] = [
  {id: 'voice', label: 'Voice', Icon: Mic},
  {id: 'direct', label: 'Direct', Icon: Wand},
  {id: 'preview', label: 'Preview', Icon: Reel},
  {id: 'final', label: 'Final', Icon: Film},
  {id: 'shorts', label: 'Shorts', Icon: Phone},
];

export function StageTrack({summary, job, onCancel, onRetry}: {summary: Summary; job: JobState | null; onCancel: () => void; onRetry: (from: Stage) => void}) {
  const [open, setOpen] = useState(false);
  const running = job?.status === 'running';
  const failed = job?.status === 'error';
  const doneNow = (s: Stage) => (job && job.episode === summary.id && job.done.includes(s)) || (!running && !!summary.stages[s]);
  const planned = (s: Stage) => !job || job.stages.includes(s);
  return (
    <footer className="track" aria-label="Pipeline status">
      <ol className="steps">
        {STAGES.map(({id, label, Icon}) => {
          const cur = running && job?.current === id;
          const err = failed && job?.current === id;
          const done = doneNow(id) && !cur;
          const state = err ? 'error' : cur ? 'running' : done ? 'done' : 'idle';
          return (
            <li key={id} className={`step ${state}`} data-skipped={running && !planned(id)}>
              <span className="ico">{state === 'done' ? <Check size={16} /> : state === 'error' ? <Alert size={16} /> : <Icon size={16} />}</span>
              <span className="lbl">{label}</span>
              <span className="state num">{state === 'running' ? `${Math.round((job?.progress ?? 0) * 100)}%` : state === 'done' ? 'done' : state === 'error' ? 'failed' : ''}</span>
              {state === 'running' && <svg className="ink" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3 H98" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - (job?.progress ?? 0.05)} /></svg>}
            </li>
          );
        })}
      </ol>
      <div className="msg" role="status" aria-live="polite">
        {failed ? <span className="err-text">{job?.error}</span> : running ? <span>Working on {job?.current}… {job?.log.filter(l => !l.startsWith('render ')).slice(-1)[0] ?? ''}</span> : job?.status === 'done' ? <span>Finished. Everything is up to date.</span> : job?.status === 'cancelled' ? <span>Cancelled.</span> : <span className="muted">Idle.</span>}
      </div>
      <div className="track-actions">
        {failed && job?.current && <button className="btn sm" onClick={() => onRetry(job.current!)}>Retry {job.current}</button>}
        {running && <button className="btn ghost sm" onClick={onCancel}><X size={15} />Stop</button>}
        {job && <button className="btn ghost sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide log' : 'Log'}</button>}
      </div>
      {open && job && <pre className="log" tabIndex={0}>{job.log.join('\n') || 'No output yet.'}</pre>}
    </footer>
  );
}
