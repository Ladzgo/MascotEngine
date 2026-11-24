import React, {useEffect, useRef} from 'react';
import {setRoute} from './router';

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/** Trap focus in `ref` while open, close on Esc, restore focus to the opener on close. */
export function useModal(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const cb = useRef(onClose); cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cb.current(); return; }
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[n].focus();
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (opener && document.contains(opener)) opener.focus(); };
  }, [open, ref]);
}

const typing = (t: EventTarget | null) => { const e = t as HTMLElement | null; return !!e && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || e.isContentEditable); };
const GO: Record<string, Parameters<typeof setRoute>[0]> = {t: {page: 'today'}, p: {page: 'pipeline'}, l: {page: 'library'}, i: {page: 'ideas'}, c: {page: 'channels'}, s: {page: 'settings'}, q: {page: 'queue'}, k: {page: 'calendar'}};

/** Global keys: Cmd/Ctrl+K palette, ? sheet, `g` then t/p/l/i/s. Plain keys are ignored while typing. */
export function useGlobalShortcuts(openPalette: () => void, toggleHelp: () => void) {
  useEffect(() => {
    let g = 0;
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || e.defaultPrevented) return;
      if (document.querySelector('[role=dialog][aria-modal=true]')) return;
      if (e.key === '?') { e.preventDefault(); toggleHelp(); return; }
      if (g && Date.now() - g < 1200 && GO[e.key]) { e.preventDefault(); g = 0; setRoute(GO[e.key]); return; }
      g = e.key === 'g' ? Date.now() : 0;
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [openPalette, toggleHelp]);
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
const GROUPS: {title: string; rows: [string[], string][]}[] = [
  {title: 'Go to', rows: [[['g', 't'], 'Today'], [['g', 'p'], 'Pipeline'], [['g', 'l'], 'Library'], [['g', 'i'], 'Ideas'], [['g', 'c'], 'Channels'], [['g', 's'], 'Settings'], [['g', 'q'], 'Queue'], [['g', 'k'], 'Calendar']]},
  {title: 'Anywhere', rows: [[[mod, 'K'], 'Command palette'], [['?'], 'This sheet'], [['Esc'], 'Close dialog or palette']]},
  {title: 'Palette prefixes', rows: [[['>'], 'Actions only'], [['#'], 'Ideas only'], [['@'], 'Channels only']]},
  {title: 'Episode', rows: [[['1', '–', '5'], 'Jump to step'], [['[', ']'], 'Previous or next scene'], [[mod, 'Enter'], 'Generate'], [[mod, '⇧', 'Enter'], 'Preview'], [[mod, 'Z'], 'Undo'], [[mod, '⇧', 'Z'], 'Redo'], [[mod, 'D'], 'Duplicate scene'], [['Alt', '↑↓'], 'Move scene']]},
];

export function ShortcutSheet({open, onClose}: {open: boolean; onClose: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, open, onClose);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sc-h" ref={ref} tabIndex={-1}>
        <div className="modal-head"><h2 className="display" id="sc-h">Keyboard shortcuts</h2><button type="button" className="btn ghost sm" onClick={onClose} data-autofocus>Close</button></div>
        <p className="muted small">Single keys are off while you type in a field. {mod} combos always work.</p>
        <div className="sc-grid">
          {GROUPS.map(g => (
            <section key={g.title}><h3>{g.title}</h3>
              <dl>{g.rows.map(([k, d]) => <div key={d}><dt>{k.map((x, i) => <kbd key={i}>{x}</kbd>)}</dt><dd>{d}</dd></div>)}</dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
