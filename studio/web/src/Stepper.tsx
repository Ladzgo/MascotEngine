import React from 'react';
import {Alert, Check} from './icons';

export type StepId = 'script' | 'voice' | 'visuals' | 'render' | 'publish';
export type StepState = 'empty' | 'ready' | 'running' | 'done' | 'stale' | 'failed';
export const STEPS: {id: StepId; label: string}[] = [{id: 'script', label: 'Script'}, {id: 'voice', label: 'Voice'}, {id: 'visuals', label: 'Visuals'}, {id: 'render', label: 'Render'}, {id: 'publish', label: 'Publish'}];
const WORD: Record<StepState, string> = {empty: 'empty', ready: 'ready', running: 'running', done: 'done', stale: 'out of date', failed: 'failed'};

export type StepAction = {label: string; onClick: () => void; disabled?: boolean; why?: string};

export function Stepper({states, current, onGo, action}: {states: Record<StepId, StepState>; current: StepId; onGo: (s: StepId) => void; action?: StepAction}) {
  return (
    <nav className="stepper" aria-label="Episode steps">
      <ol>
        {STEPS.map((s, i) => {
          const st = states[s.id];
          return (
            <li key={s.id}>
              <button type="button" className={`stp ${st}`} aria-current={current === s.id ? 'step' : undefined} onClick={() => onGo(s.id)} title={`${s.label} (key ${i + 1})`}>
                <span className="stp-n num" aria-hidden="true">{st === 'done' ? <Check size={14} /> : st === 'failed' ? <Alert size={14} /> : i + 1}</span>
                <span className="stp-l">{s.label}</span>
                <span className="stp-s">{WORD[st]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {action && (
        <div className="stp-act">
          {action.disabled && action.why && <span className="hint" id="stp-why">{action.why}</span>}
          <button type="button" className="btn primary" onClick={action.onClick} disabled={action.disabled} aria-describedby={action.disabled && action.why ? 'stp-why' : undefined}>{action.label}</button>
        </div>
      )}
    </nav>
  );
}
