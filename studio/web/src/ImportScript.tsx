import React, {useState} from 'react';
import type {Scene} from './api';

/** Split pasted text into scenes: blank-line separated paragraphs (or one scene per line if there are no blank lines). */
export function splitScript(text: string): string[] {
  const t = text.replace(/\r/g, '').trim();
  if (!t) return [];
  const paras = t.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  return paras.length > 1 ? paras : t.split('\n').map(l => l.trim()).filter(Boolean);
}

export function ImportScript({onImport, hasContent}: {onImport: (narrations: string[], mode: 'replace' | 'append') => void; hasContent: boolean}) {
  const [text, setText] = useState(''), [mode, setMode] = useState<'replace' | 'append'>(hasContent ? 'append' : 'replace');
  const parts = splitScript(text);
  return (
    <details className="imp">
      <summary>Import a script</summary>
      <div className="imp-body">
        <label className="field"><span>Paste text. A blank line starts a new scene.</span>
          <textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your script here" />
        </label>
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Import mode">
            <button type="button" role="radio" aria-checked={mode === 'append'} onClick={() => setMode('append')}>Add to the end</button>
            <button type="button" role="radio" aria-checked={mode === 'replace'} onClick={() => setMode('replace')}>Replace all scenes</button>
          </div>
          <span className="muted small num">{parts.length} {parts.length === 1 ? 'scene' : 'scenes'} found</span>
          <span className="grow" />
          <button type="button" className="btn primary" disabled={!parts.length} onClick={() => { onImport(parts, mode); setText(''); }}>Create scenes</button>
        </div>
        {mode === 'replace' && hasContent && <p className="hint">Replacing removes the current scenes. Undo with Cmd/Ctrl+Z.</p>}
      </div>
    </details>
  );
}
export const sceneFrom = (n: string, blank: (t: Scene['type']) => Scene): Scene => ({...blank('talk'), narration: n});
