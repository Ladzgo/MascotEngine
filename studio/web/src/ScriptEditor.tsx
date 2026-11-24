import React, {useLayoutEffect, useRef} from 'react';
import type {Decisions, Scene} from './api';
import {mmss, nice} from './api';
import {words} from './api-ws';
import {Plus} from './icons';

function Area({value, onChange, onFocus, label}: {value: string; onChange: (v: string) => void; onFocus: () => void; label: string}) {
  const r = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const e = r.current; if (e) { e.style.height = 'auto'; e.style.height = `${e.scrollHeight + 2}px`; } }, [value]);
  return <textarea ref={r} rows={2} className="se-area" aria-label={label} value={value} onChange={e => onChange(e.target.value)} onFocus={onFocus} />;
}

export function ScriptEditor({scenes, decisions, sel, onSel, onText, onAdd}: {scenes: Scene[]; decisions: Decisions | null; sel: number; onSel: (i: number) => void; onText: (i: number, t: string) => void; onAdd: () => void}) {
  const totalWords = scenes.reduce((n, s) => n + words(s.narration), 0);
  const est = decisions?.totalSec ?? Math.round(totalWords / 2.5);
  return (
    <section className="se" aria-label="Script">
      <div className="se-head">
        <h2>Script</h2>
        <span className="muted num small">{totalWords} words · {decisions?.totalSec ? '' : '≈ '}{mmss(est)} spoken</span>
        <span className="grow" />
        <button type="button" className="btn sm" onClick={onAdd}><Plus size={15} />Add scene</button>
      </div>
      <ol className="se-list">
        {scenes.map((s, i) => {
          const w = words(s.narration), d = decisions?.scenes[i];
          return (
            <li key={i} className={`se-row${sel === i ? ' on' : ''}`}>
              <div className="se-gut"><span className="n num">{i + 1}</span><span className="small muted">{nice(s.type)}</span><span className="small muted num">{w} w · {d ? '' : '≈ '}{(d ? d.durSec : w / 2.5).toFixed(1)}s</span></div>
              <Area value={s.narration} label={`Scene ${i + 1} narration`} onFocus={() => onSel(i)} onChange={t => onText(i, t)} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
