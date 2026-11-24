import React, {useEffect, useMemo, useRef, useState} from 'react';
import {api, type ChannelRow, type Idea, type SearchResult, type Summary} from './api';
import {PAGE_LABEL, setRoute, useActions, type Action, type Page} from './router';
import {useModal} from './Shortcuts';

type Item = {id: string; group: string; label: string; sub?: string; hint?: string; run: () => void};
type IdeaRow = Idea & {channel: string};
const GO: Page[] = ['today', 'pipeline', 'library', 'ideas', 'channels', 'settings', 'queue', 'calendar'];
const match = (hay: string, q: string) => { const h = hay.toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every(t => h.includes(t)); };
const LIMIT = 6;

export function Palette({open, onClose, eps, chans, ch, onHelp}: {open: boolean; onClose: () => void; eps: Summary[]; chans: ChannelRow[]; ch: string; onHelp: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [found, setFound] = useState<SearchResult | null>(null);
  const registered = useActions();
  useModal(ref, open, onClose);

  useEffect(() => { if (open) { setQ(''); setAt(0); setFound(null); } }, [open]);
  useEffect(() => {
    if (!open) return;
    let on = true;
    const scope = ch === 'all' ? chans : chans.filter(c => c.id === ch);
    Promise.all(scope.map(c => api.ideas(c.id).then(d => d.ideas.map(i => ({...i, channel: c.id}))).catch(() => [] as IdeaRow[]))).then(r => on && setIdeas(r.flat()));
    return () => { on = false; };
  }, [open, ch, chans]);
  const term = /^[>#@]/.test(q) ? q.slice(1).trim() : q.trim();
  useEffect(() => {
    if (!open || term.length < 2) { setFound(null); return; }
    let on = true; const t = setTimeout(() => api.search(term, ch).then(r => on && setFound(r)), 220);
    return () => { on = false; clearTimeout(t); };
  }, [open, term, ch]);

  const items = useMemo(() => {
    const p = q[0];
    const chName = (id?: string) => chans.find(c => c.id === id)?.name ?? id;
    const epItems: Item[] = eps.filter(e => ch === 'all' || e.channel === ch).map(e => ({id: `ep:${e.id}`, group: 'Episodes', label: e.title, sub: `${e.id} · ${chName(e.channel)}`, run: () => setRoute({page: 'ep', ep: e.id})}));
    for (const e of found?.episodes ?? []) if (!epItems.some(x => x.id === `ep:${e.id}`)) epItems.push({id: `ep:${e.id}`, group: 'Episodes', label: e.title, sub: `${e.id} · ${chName(e.channel)}`, run: () => setRoute({page: 'ep', ep: e.id})});
    const ideaItems: Item[] = ideas.filter(i => i.status !== 'dismissed').map(i => ({id: `idea:${i.id}`, group: 'Ideas', label: i.title, sub: `${i.status} · ${chName(i.channel)}`, run: () => (i.episodeId ? setRoute({page: 'ep', ep: i.episodeId}) : setRoute({page: 'ideas', ch: i.channel}))}));
    for (const i of found?.ideas ?? []) if (!ideaItems.some(x => x.id === `idea:${i.id}`)) ideaItems.push({id: `idea:${i.id}`, group: 'Ideas', label: i.title, sub: chName(i.channel), run: () => setRoute({page: 'ideas', ch: i.channel})});
    const chanItems: Item[] = [{id: 'ch:all', group: 'Channels', label: 'All channels', sub: 'Switch scope', run: () => setRoute({ch: 'all'})}, ...chans.map(c => ({id: `ch:${c.id}`, group: 'Channels', label: c.name, sub: `Switch scope · ${c.episodes} episodes`, run: () => setRoute({ch: c.id})}))];
    const sceneItems: Item[] = (found?.scenes ?? []).map(s => ({id: `sc:${s.ep}:${s.n}`, group: 'Scenes', label: s.text, sub: `${s.ep}, scene ${s.n}`, run: () => setRoute({page: 'ep', ep: s.ep, scene: s.n})}));
    const acts: Action[] = [
      ...GO.map(g => ({id: `go:${g}`, label: `Go to ${PAGE_LABEL[g]}`, hint: g === 'queue' || g === 'calendar' ? undefined : `g ${g === 'settings' ? 's' : g[0]}`, run: () => setRoute({page: g})})),
      {id: 'new-channel', label: 'New channel', run: () => setRoute({page: 'channels', isNew: true})},
      {id: 'new-episode', label: 'New episode', run: () => setRoute({page: 'today'})},
      {id: 'shortcuts', label: 'Show keyboard shortcuts', hint: '?', run: onHelp},
      ...registered,
    ];
    const actItems: Item[] = acts.map(a => ({id: `act:${a.id}`, group: 'Actions', label: a.label, hint: a.hint, run: a.run}));
    const pick = (xs: Item[], n = LIMIT) => xs.filter(x => !term || match(`${x.label} ${x.sub ?? ''}`, term)).slice(0, n);
    if (p === '>') return pick(actItems, 50);
    if (p === '#') return pick(ideaItems, 50);
    if (p === '@') return pick(chanItems, 50);
    return [...pick(epItems), ...pick(ideaItems), ...pick(chanItems), ...sceneItems.slice(0, LIMIT), ...pick(actItems, term ? LIMIT : 4)];
  }, [q, term, eps, ideas, chans, ch, found, registered, onHelp]);

  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block: 'nearest'}); }, [at, items]);
  if (!open) return null;
  const run = (it?: Item) => { if (!it) return; onClose(); setTimeout(it.run, 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(a => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[at]); }
  };
  let last = '';
  return (
    <div className="scrim top" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal pal" role="dialog" aria-modal="true" aria-label="Command palette" ref={ref}>
        <input data-autofocus role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={items[at] ? `pal-${at}` : undefined} aria-autocomplete="list" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search episodes, ideas, channels. > actions, # ideas, @ channels" />
        <ul id="pal-list" role="listbox" aria-label="Results" ref={list}>
          {items.map((it, i) => {
            const head = it.group !== last ? ((last = it.group), <li role="presentation" className="pal-group" key={`g-${it.group}`}>{it.group}</li>) : null;
            return (
              <React.Fragment key={it.id}>{head}
                <li role="option" id={`pal-${i}`} aria-selected={i === at} className="pal-item" onMouseMove={() => setAt(i)} onClick={() => run(it)}>
                  <span className="pal-l">{it.label}</span>{it.sub && <span className="pal-s">{it.sub}</span>}{it.hint && <kbd>{it.hint}</kbd>}
                </li>
              </React.Fragment>
            );
          })}
          {!items.length && <li role="presentation" className="pal-empty">Nothing matches “{term}”. Try fewer words, or clear the prefix.</li>}
        </ul>
        <p className="pal-foot small muted"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> open <kbd>Esc</kbd> close</p>
      </div>
    </div>
  );
}
