import React, {useEffect, useRef, useState} from 'react';
import type {Decisions, Scene, SceneAudio} from './api';
import {CAMERAS, EMOTIONS, SCENE_TYPES, TRANSITIONS, blankScene, nice} from './api';
import {Mic, Plus, typeIcon} from './icons';

export type Bulk = {selected: Set<number>; onToggle: (i: number) => void; onClear: () => void; onAll: () => void; onDelete: () => void; onDuplicate: () => void; onSet: (k: 'emotion' | 'camera' | 'transition', v: string) => void};

export function Storyboard({scenes, decisions, audio, sel, onSel, onAdd, onReorder, bulk}: {scenes: Scene[]; audio: SceneAudio[]; decisions: Decisions | null; sel: number; onSel: (i: number) => void; onAdd: (t: Scene['type']) => void; onReorder?: (from: number, to: number) => void; bulk?: Bulk}) {
  const [drag, setDrag] = useState<number | null>(null), [over, setOver] = useState<number | null>(null);
  const strip = useRef<HTMLOListElement>(null);
  const nSel = bulk?.selected.size ?? 0;
  const total = decisions?.totalSec;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) return; const f = (e: MouseEvent) => { if (!(e.target as Element).closest('.add-wrap')) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [open]);
  return (
    <section className="panel board" aria-label="Storyboard">
      <header className="board-head">
        <h2>Storyboard</h2>
        <span className="muted num board-meta">{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}{total ? ` · ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}` : ''}</span>
        <span className="grow" />
        {bulk && <button type="button" className="btn sm ghost" onClick={bulk.onAll}>Select all</button>}
        <div className="add-wrap" onKeyDown={e => { if (e.key === 'Escape' && open) { setOpen(false); btn.current?.focus(); } }}>
          <button ref={btn} type="button" className="btn sm add" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}><Plus size={16} />Add scene</button>
          {open && <ul className="add-menu" aria-label="Scene type">{SCENE_TYPES.map(t => { const I = typeIcon[t]; return <li key={t}><button type="button" autoFocus={false} onClick={() => { setOpen(false); onAdd(t); }}>{I && <I size={15} />}{nice(t)}</button></li>; })}</ul>}
        </div>
      </header>
      {bulk && nSel > 0 && (
        <div className="bulk" role="toolbar" aria-label="Bulk actions">
          <b className="num">{nSel} selected</b>
          <label className="sr" htmlFor="bk-em">Set emotion</label>
          <select id="bk-em" value="" onChange={e => { if (e.target.value) bulk.onSet('emotion', e.target.value); }}><option value="">Set emotion…</option>{EMOTIONS.map(o => <option key={o} value={o}>{nice(o)}</option>)}</select>
          <label className="sr" htmlFor="bk-cam">Set camera</label>
          <select id="bk-cam" value="" onChange={e => { if (e.target.value) bulk.onSet('camera', e.target.value); }}><option value="">Set camera…</option>{CAMERAS.map(o => <option key={o} value={o}>{nice(o)}</option>)}</select>
          <label className="sr" htmlFor="bk-tr">Set transition</label>
          <select id="bk-tr" value="" onChange={e => { if (e.target.value) bulk.onSet('transition', e.target.value); }}><option value="">Set transition…</option>{TRANSITIONS.map(o => <option key={o} value={o}>{nice(o)}</option>)}</select>
          <button type="button" className="btn sm" onClick={bulk.onDuplicate}>Duplicate</button>
          <button type="button" className="btn sm danger" onClick={bulk.onDelete} disabled={nSel >= scenes.length} title={nSel >= scenes.length ? 'An episode needs at least one scene' : undefined}>Delete</button>
          <button type="button" className="btn sm ghost" onClick={bulk.onClear}>Clear</button>
        </div>
      )}
      <ol className="strip" ref={strip} onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const j = Math.max(0, Math.min(scenes.length - 1, sel + (e.key === 'ArrowRight' ? 1 : -1)));
        if (j === sel) return; e.preventDefault(); onSel(j);
        requestAnimationFrame(() => strip.current?.querySelectorAll<HTMLButtonElement>('.card')[j]?.focus());
      }}>
        {scenes.map((s, i) => {
          const d = decisions?.scenes[i];
          const Icon = typeIcon[s.type];
          const w = d ? Math.max(150, Math.min(300, d.durSec * 30)) : 170;
          return (
            <li key={i} style={{width: w}} className={`${drag === i ? 'dragging' : ''}${over === i && drag !== null && drag !== i ? ' drop' : ''}`}
              draggable={!!onReorder} onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}
              onDragOver={e => { if (drag !== null) { e.preventDefault(); setOver(i); } }} onDrop={e => { e.preventDefault(); if (drag !== null && drag !== i) onReorder?.(drag, i); setDrag(null); setOver(null); }}>
              {bulk && <label className={`pick${bulk.selected.has(i) ? ' on' : ''}`}><input type="checkbox" checked={bulk.selected.has(i)} onChange={() => bulk.onToggle(i)} aria-label={`Select scene ${i + 1}`} /></label>}
              <button className="card" aria-pressed={sel === i} tabIndex={sel === i ? 0 : -1} onClick={() => onSel(i)} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">
                <span className="card-top"><span className="n num">{i + 1}</span><Icon size={16} /><b>{nice(s.type)}</b>{audio[i]?.source === 'recording' && <span className="mic" title="Own recording attached"><Mic size={14} /><span className="sr">Recording attached</span></span>}{audio[i]?.source === 'generated' && <span className="gen-badge" title="ElevenLabs voice">AI<span className="sr"> ElevenLabs voice</span></span>}{d && <span className="dur num">{d.durSec.toFixed(1)}s</span>}</span>
                <span className="snip">{s.narration}</span>
                {d && <span className="chips"><i>{nice(d.camera)}</i><i>{nice(d.transition)}</i></span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export {blankScene};
