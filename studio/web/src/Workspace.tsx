import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ACCENT_HEX, api, arrowNav, blankScene, ago, type EpisodeData, type EpisodeDoc, type JobState, type Scene, type Settings, type Stage} from './api';
import {apiWs, cloneScene, unsupported, usd, type Cost, type EpStatus, type Notes, type Version} from './api-ws';
import {Alert, Play} from './icons';
import {ImportScript} from './ImportScript';
import {Inspector} from './Inspector';
import {Player} from './Player';
import {Publish} from './Publish';
import {ScriptEditor} from './ScriptEditor';
import {StageTrack} from './StageTrack';
import {registerActions} from './router';
import {STEPS, Stepper, type StepAction, type StepId, type StepState} from './Stepper';
import {Storyboard} from './Storyboard';
import {readiness} from './Settings';
import './ws.css';

const AUTO: Stage[] = ['voice', 'direct', 'final', 'shorts'];
const PREVIEW: Stage[] = ['voice', 'direct', 'preview'];
const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const isStep = (s?: string): s is StepId => STEPS.some(x => x.id === s);
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export type WorkspaceProps = {id: string; step?: string; scene?: number | string; onRoute?: (p: {step?: StepId; scene?: number}) => void};

/** Episode workspace. `scene` in props and onRoute is 1-based (matches the URL ?scene=). */
export default function Workspace({id, step, scene, onRoute}: WorkspaceProps) {
  const [data, setData] = useState<EpisodeData | null>(null);
  const [doc, setDoc] = useState<EpisodeDoc | null>(null);
  const docRef = useRef<EpisodeDoc | null>(null);
  const [lstep, setLstep] = useState<StepId>('script'), [lscene, setLscene] = useState(1);
  const [job, setJob] = useState<JobState | null>(null);
  const [v, setV] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [mode, setMode] = useState<'auto' | 'preview'>('auto');
  const [engine, setEngine] = useState('say');
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [cost, setCost] = useState<Cost | null>(null);
  const [status, setStatus] = useState<EpStatus | null>(null);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [feat, setFeat] = useState<{regen?: boolean; dup?: boolean; archive?: boolean}>({});
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [seek, setSeek] = useState({t: 0, k: 0});
  const [menu, setMenu] = useState<null | 'menu' | 'dup' | 'archive'>(null), [dupId, setDupId] = useState('');
  const timer = useRef(0), ntimer = useRef(0);
  const es = useRef<EventSource | null>(null);
  const hist = useRef<{past: EpisodeDoc[]; future: EpisodeDoc[]; last: number}>({past: [], future: [], last: 0});
  const [, bump] = useState(0);

  const cur: StepId = isStep(step) ? step : lstep;
  const nScenes = doc?.scenes.length ?? 0;
  const sel = Math.max(0, Math.min(Math.max(0, nScenes - 1), (scene !== undefined && Number(scene) > 0 ? Number(scene) : lscene) - 1));
  const go = (s: StepId) => { setLstep(s); onRoute?.({step: s}); };
  const setSel = useCallback((i: number) => {
    setLscene(i + 1); onRoute?.({scene: i + 1});
    const t = data?.decisions?.scenes[i]?.startSec; if (typeof t === 'number') setSeek(x => ({t, k: x.k + 1}));
  }, [onRoute, data]);

  // h1 mounts after load, later than App's focus move; take focus from <main>/body once
  const h1Done = useRef('');
  useEffect(() => {
    if (!doc || h1Done.current === id) return; h1Done.current = id;
    const a = document.activeElement; if (!a || a === document.body || a.id === 'main') document.querySelector<HTMLElement>('main h1')?.focus({preventScroll: true});
  }, [doc, id]);

  // deep link ?scene=N: seek the player once when the episode first loads
  const seeked = useRef('');
  useEffect(() => {
    if (!data || seeked.current === id) return;
    seeked.current = id;
    const t = data.decisions?.scenes[sel]?.startSec; if (sel > 0 && typeof t === 'number') setSeek(x => ({t, k: x.k + 1}));
  }, [data, id, sel]);

  // ---- episode load (copied from App.tsx) ----
  const load = useCallback((eid: string) => api.episode(eid).then(d => { setData(d); setDoc(d.episode); docRef.current = d.episode; setSaved('saved'); setErr(null); }).catch(e => setErr(e.message)), []);
  const refreshCost = useCallback((eid: string) => { apiWs.cost(eid).then(setCost).catch(() => setCost(null)); }, []);
  const refreshVersions = useCallback((eid: string) => { apiWs.versions(eid).then(setVersions).catch(e => { if (unsupported(e)) setVersions(null); }); }, []);
  useEffect(() => {
    hist.current = {past: [], future: [], last: 0}; setPicked(new Set()); setData(null); setDoc(null); setNotes(null); setVersions(null); setCost(null); setStatus(null);
    void load(id); refreshCost(id); refreshVersions(id);
    apiWs.notes(id).then(setNotes).catch(() => setNotes(null));
    apiWs.status(id).then(setStatus).catch(() => setStatus(null));
    api.settings().then(s => { setCfg(s); setEngine(s.engine); }).catch(() => {});
  }, [id, load, refreshCost, refreshVersions]);

  const running = job?.status === 'running';
  useEffect(() => {
    const n = document.getElementById('boil-noise');
    if (!running || !n || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let s = 3; const t = setInterval(() => n.setAttribute('seed', String((s = (s % 40) + 1))), 130);
    return () => clearInterval(t);
  }, [running]);

  const attach = useCallback((jobId: string) => {
    es.current?.close();
    const src = new EventSource(`/api/jobs/${jobId}/events`); es.current = src;
    src.onmessage = m => {
      const j: JobState = JSON.parse(m.data); setJob(j);
      if (j.status !== 'running') { src.close(); if (j.status === 'done') { setV(x => x + 1); void load(j.episode); refreshCost(j.episode); } else api.episode(j.episode).then(d => setData(d)).catch(() => {}); }
    };
    src.onerror = () => src.close();
  }, [load, refreshCost]);
  useEffect(() => { api.running().then(x => { if (x.running) attach(x.running); }).catch(() => {}); return () => es.current?.close(); }, [attach]);

  // ---- saving, with undo/redo history ----
  const flush = useCallback(async (d: EpisodeDoc) => {
    setSaved('saving');
    try { await api.save(d); setSaved('saved'); setErr(null); refreshCost(d.id); refreshVersions(d.id); return true; }
    catch (e) { setSaved('error'); setErr((e as Error).message); return false; }
  }, [refreshCost, refreshVersions]);
  const commit = (d: EpisodeDoc) => { docRef.current = d; setDoc(d); setSaved('saving'); clearTimeout(timer.current); timer.current = window.setTimeout(() => flush(d), 700); bump(n => n + 1); };
  /** edit: typing coalesces into one undo step per pause; edit(d, true) always starts a new step. */
  const edit = (d: EpisodeDoc, hard = false) => {
    const h = hist.current, now = Date.now(), prev = docRef.current;
    if (prev && (hard || now - h.last > 1200 || !h.past.length)) { h.past.push(prev); if (h.past.length > 100) h.past.shift(); }
    h.last = hard ? 0 : now; h.future = []; commit(d);
  };
  const undo = () => { const h = hist.current, prev = h.past.pop(); if (!prev || !docRef.current) return; h.future.push(docRef.current); h.last = 0; commit(prev); };
  const redo = () => { const h = hist.current, nx = h.future.pop(); if (!nx || !docRef.current) return; h.past.push(docRef.current); h.last = 0; commit(nx); };

  const generate = async (stages?: Stage[]) => {
    const d = docRef.current; if (!d) return;
    clearTimeout(timer.current);
    if (!(await flush(d))) return;
    try { const {jobId} = await api.generate(d.id, stages ?? (mode === 'auto' ? AUTO : PREVIEW), engine); setErr(null); attach(jobId); }
    catch (e) { setErr((e as Error).message); }
  };
  const retry = (from: Stage) => { const all = job?.stages ?? AUTO; void generate(all.slice(all.indexOf(from))); };
  const regen = async (kind: 'voice' | 'preview', confirm: boolean) => {
    const d = docRef.current; if (!d) return;
    clearTimeout(timer.current); if (!(await flush(d))) return;
    try { const {jobId} = await apiWs.regenerate(d.id, sel + 1, kind, confirm); setErr(null); attach(jobId); }
    catch (e) { if (unsupported(e)) setFeat(f => ({...f, regen: false})); else setErr((e as Error).message); }
  };

  // ---- scene operations ----
  const setScenes = (scenes: Scene[], at?: number) => { const d = docRef.current; if (!d) return; edit({...d, scenes}, true); if (at !== undefined) setSel(Math.max(0, Math.min(scenes.length - 1, at))); };
  const upd = (i: number, s: Scene) => { const d = docRef.current; if (d) edit({...d, scenes: d.scenes.map((x, k) => (k === i ? s : x))}); };
  const moveTo = (from: number, to: number) => { const d = docRef.current; if (!d || to < 0 || to >= d.scenes.length || from === to) return; const sc = [...d.scenes]; const [m] = sc.splice(from, 1); sc.splice(to, 0, m); setScenes(sc, to); };
  const move = (dir: -1 | 1) => moveTo(sel, sel + dir);
  const remove = () => { const d = docRef.current; if (d && d.scenes.length > 1) setScenes(d.scenes.filter((_, k) => k !== sel), sel - 1); };
  const add = (t: Scene['type']) => { const d = docRef.current; if (d) setScenes([...d.scenes, blankScene(t)], d.scenes.length); };
  const dupScene = () => { const d = docRef.current; if (!d || !d.scenes[sel]) return; const sc = [...d.scenes]; sc.splice(sel + 1, 0, cloneScene(sc[sel])); setScenes(sc, sel + 1); };
  const importScript = (parts: string[], m: 'replace' | 'append') => {
    const d = docRef.current; if (!d || !parts.length) return;
    const fresh = parts.map(n => ({...blankScene('talk'), narration: n}));
    const first = m === 'replace' ? 0 : d.scenes.length;
    setScenes(m === 'replace' ? fresh : [...d.scenes, ...fresh], first);
  };
  const bulk = (fn: (s: Scene, i: number) => Scene | null) => { const d = docRef.current; if (!d) return; const sc = d.scenes.flatMap((s, i) => (picked.has(i) ? [fn(s, i)] : [s])).filter((x): x is Scene => !!x); if (sc.length) { setScenes(sc); setPicked(new Set()); } };

  const saveNotes = (n: Notes) => { clearTimeout(ntimer.current); ntimer.current = window.setTimeout(() => { const clean: Notes = {}; for (const [k, l] of Object.entries(n)) { const f = l.filter(x => x.trim()); if (f.length) clean[k] = f; } apiWs.saveNotes(id, clean).catch(e => setErr((e as Error).message)); }, 800); };
  const setSceneNotes = (l: string[]) => setNotes(n => { const nn = {...(n ?? {}), [String(sel)]: l}; saveNotes(nn); return nn; });

  // ---- keyboard ----
  const kb = useRef({undo, redo, dupScene, move, generate, setSel, go, sel, nScenes, mode});
  kb.current = {undo, redo, dupScene, move, generate, setSel, go, sel, nScenes, mode};
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = kb.current, meta = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
      if (meta && e.key === 'Enter') { e.preventDefault(); void k.generate(e.shiftKey ? PREVIEW : undefined); return; }
      if (meta && key === 'z') { e.preventDefault(); e.shiftKey ? k.redo() : k.undo(); return; }
      if (meta && key === 'd') { e.preventDefault(); k.dupScene(); return; }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); k.move(e.key === 'ArrowUp' ? -1 : 1); return; }
      if (meta || e.altKey || typing(e.target) || (e.target as HTMLElement)?.closest?.('[role=dialog]')) return;
      if (/^[1-5]$/.test(e.key)) k.go(STEPS[Number(e.key) - 1].id);
      else if (e.key === '[' || key === 'k') k.setSel(Math.max(0, k.sel - 1));
      else if (e.key === ']' || key === 'j') k.setSel(Math.min(k.nScenes - 1, k.sel + 1));
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => registerActions([
    {id: 'ws-generate', label: 'This episode: make full video', hint: '⌘↵', run: () => void kb.current.generate()},
    {id: 'ws-preview', label: 'This episode: make preview only', hint: '⌘⇧↵', run: () => void kb.current.generate(PREVIEW)},
    ...STEPS.map(st => ({id: `ws-go-${st.id}`, label: `This episode: go to ${st.label}`, run: () => kb.current.go(st.id)})),
    {id: 'ws-export', label: 'This episode: export ZIP', run: () => { location.href = `/api/episodes/${id}/export`; }},
  ]), [id]);
  useEffect(() => { if (menu !== 'menu') return; const f = (e: MouseEvent) => { if (!(e.target as Element).closest('.ws-menu')) setMenu(null); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [menu]);

  if (!data || !doc) return <div className="ws"><p className={err ? 'err-text pad' : 'muted pad'} role={err ? 'alert' : 'status'}>{err ?? 'Loading…'}</p></div>;

  const accent = ACCENT_HEX[data.decisions?.accent ?? ''] ?? '#7b4bb7';
  const onAccent = contrast(accent, '#ffffff') >= contrast(accent, '#1b1b1f') ? '#ffffff' : '#1b1b1f';
  const st = data.summary.stages, stale = data.summary.stale;
  const blocked = job?.status === 'running';
  const failedAt = job?.status === 'error' ? job.current : null;
  const live = (...s: Stage[]) => !!job && job.episode === id && running && !!job.current && s.includes(job.current);
  const failed = (...s: Stage[]) => !!failedAt && s.includes(failedAt);
  const hasText = doc.scenes.some(s => s.narration.trim());
  const states: Record<StepId, StepState> = {
    script: hasText ? 'done' : 'empty',
    voice: live('voice') ? 'running' : failed('voice') ? 'failed' : st.voice ? 'done' : hasText ? 'ready' : 'empty',
    visuals: live('direct') ? 'running' : failed('direct') ? 'failed' : st.direct ? 'done' : st.voice ? 'ready' : 'empty',
    render: live('preview', 'final', 'shorts') ? 'running' : failed('preview', 'final', 'shorts') ? 'failed' : (st.final && stale.final) || (!st.final && st.preview && stale.preview) ? 'stale' : st.final || st.preview ? 'done' : st.direct ? 'ready' : 'empty',
    publish: status?.state === 'published' ? 'done' : status?.state === 'scheduled' ? 'ready' : st.final ? 'ready' : 'empty',
  };
  const why = blocked ? 'A job is running. Wait for it to finish or stop it below.' : undefined;
  const actions: Partial<Record<StepId, StepAction>> = {
    script: {label: 'Next: Voice', onClick: () => go('voice')},
    voice: {label: st.voice ? 'Regenerate voice' : 'Generate voice', onClick: () => void generate(['voice']), disabled: blocked || !hasText, why: why ?? (!hasText ? 'Write some narration first.' : undefined)},
    visuals: {label: st.direct ? 'Redo visual plan' : 'Plan visuals', onClick: () => void generate(st.voice ? ['direct'] : ['voice', 'direct']), disabled: blocked, why},
    render: {label: blocked ? 'Working…' : mode === 'auto' ? 'Generate full video' : 'Render preview', onClick: () => void generate(), disabled: blocked, why},
  };
  const chars = doc.scenes.reduce((n, s) => n + s.narration.length, 0);
  const missing = cfg ? readiness(cfg, engine).filter(c => !c.ok && c.key !== 'anthropic') : [];
  const noAudio = engine === 'local' ? data.audio.filter(a => !a).length : 0;
  const refreshAudio = () => { void api.episode(id).then(d => setData(x => (x ? {...x, audio: d.audio} : d))).catch(e => setErr(e.message)); };
  const player = <Player data={data} v={v} onGenerate={() => void generate()} busy={!!blocked} seek={seek} />;
  const board = (
    <Storyboard scenes={doc.scenes} audio={data.audio} decisions={data.decisions} sel={sel} onSel={setSel} onAdd={add} onReorder={moveTo}
      bulk={{selected: picked, onToggle: i => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }), onClear: () => setPicked(new Set()), onAll: () => setPicked(new Set(doc.scenes.map((_, i) => i))),
        onDelete: () => bulk(() => null), onDuplicate: () => { const d = docRef.current; if (!d) return; const sc = d.scenes.flatMap((s, i) => (picked.has(i) ? [s, cloneScene(s)] : [s])); setScenes(sc); setPicked(new Set()); },
        onSet: (k, val) => bulk(s => ({...s, [k]: val}))}} />
  );
  const insp = (view: 'voice' | 'visuals' | 'episode' | 'report') => (
    <Inspector view={view} cfg={cfg} hasVideo={st.voice} doc={doc} decisions={data.decisions} variety={data.variety} audio={data.audio} onAudio={refreshAudio} sel={sel}
      onScene={s => upd(sel, s)} onDoc={edit} onMove={move} onRemove={remove} busy={!!blocked} voiceChars={doc.scenes[sel]?.narration.length}
      onRegen={feat.regen === false ? undefined : regen} notes={notes ? notes[String(sel)] ?? [] : undefined} onNotes={setSceneNotes} />
  );
  const canUndo = hist.current.past.length > 0, canRedo = hist.current.future.length > 0;
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const mod = mac ? 'Cmd' : 'Ctrl';
  const dupEp = async (e: React.FormEvent) => { e.preventDefault(); const nid = dupId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'); if (!nid) return; try { await apiWs.duplicate(id, nid); location.hash = `#/ep/${nid}/script`; } catch (x) { if (unsupported(x)) setFeat(f => ({...f, dup: false})); else setErr((x as Error).message); setMenu(null); } };
  const archive = async () => { try { await apiWs.archive(id); location.hash = '#/library'; } catch (x) { if (unsupported(x)) setFeat(f => ({...f, archive: false})); else setErr((x as Error).message); setMenu(null); } };
  const restore = async (vid: string) => { try { clearTimeout(timer.current); await apiWs.restore(id, vid); hist.current = {past: [], future: [], last: 0}; await load(id); refreshVersions(id); } catch (x) { setErr((x as Error).message); } };

  return (
    <div className="ws" style={{'--accent': accent, '--on-accent': onAccent} as React.CSSProperties}>
      <header className="ws-head">
        <h1 className="display title" title={doc.title} tabIndex={-1}>{doc.title}</h1>
        <span className={`save ${saved}`} role="status">{saved === 'saved' ? 'Saved' : saved === 'saving' ? 'Saving…' : 'Not saved'}</span>
        <span className="grow" />
        <div className="gen-note">
          {cost ? <span className="num chars">≈ {usd(cost.estUsd)} · {cost.chars.toLocaleString()} chars{cost.cachedChars ? ` (${cost.cachedChars.toLocaleString()} cached)` : ''}{cost.budget ? ` · budget ${usd(cost.budget)}` : ''}</span> : engine === 'eleven' && <span className="num chars">≈ {chars.toLocaleString()} ElevenLabs chars</span>}
          {noAudio > 0 && <span className="warn" role="status"><Alert size={13} />{noAudio} {noAudio === 1 ? 'scene needs' : 'scenes need'} a recording.</span>}
          {missing.length > 0 && <span className="warn" role="status"><Alert size={13} />Missing: {missing.map(c => c.label).join(', ')}. <a href="#/settings">Settings</a></span>}
        </div>
        <button type="button" className="btn ghost" onClick={undo} disabled={!canUndo} aria-label={`Undo (${mod}+Z)`} title={canUndo ? `Undo (${mod}+Z)` : 'Nothing to undo'}>Undo</button>
        <button type="button" className="btn ghost" onClick={redo} disabled={!canRedo} aria-label={`Redo (${mod}+Shift+Z)`} title={canRedo ? `Redo (${mod}+Shift+Z)` : 'Nothing to redo'}>Redo</button>
        {(feat.dup !== false || feat.archive !== false) && (
          <div className="ws-menu" onKeyDown={e => { if (e.key === 'Escape') { setMenu(null); document.getElementById('ws-menu-btn')?.focus(); } }}>
            <button type="button" id="ws-menu-btn" className="btn" aria-haspopup="true" aria-expanded={menu === 'menu'} onClick={() => setMenu(m => (m === 'menu' ? null : 'menu'))}>Episode menu</button>
            {menu === 'menu' && <ul className="add-menu" aria-label="Episode actions">
              {feat.dup !== false && <li><button type="button" onClick={() => { setDupId(`${id}-copy`); setMenu('dup'); }}>Duplicate episode</button></li>}
              {feat.archive !== false && <li><button type="button" onClick={() => setMenu('archive')}>Archive episode</button></li>}
            </ul>}
          </div>
        )}
      </header>
      {menu === 'dup' && <form className="ws-inline" onSubmit={dupEp}><label className="field grow"><span>New episode ID</span><input autoFocus value={dupId} onChange={e => setDupId(e.target.value)} /></label><button className="btn primary" type="submit">Duplicate</button><button type="button" className="btn ghost" onClick={() => setMenu(null)}>Cancel</button></form>}
      {menu === 'archive' && <div className="ws-inline" role="alert"><span className="grow">Archive this episode? It leaves the library but its files are kept.</span><button className="btn danger" onClick={archive}>Archive</button><button className="btn ghost" onClick={() => setMenu(null)}>Cancel</button></div>}
      <Stepper states={states} current={cur} onGo={go} action={actions[cur]} />
      {err && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span><button className="btn ghost sm" onClick={() => setErr(null)}>Dismiss</button></div>}

      <div className="ws-body" data-step={cur} role="region" aria-label={`${STEPS.find(s => s.id === cur)?.label} step`}>
        {cur === 'script' && (
          <>
            <div className="ws-main">
              <ScriptEditor scenes={doc.scenes} decisions={data.decisions} sel={sel} onSel={setSel} onText={(i, t) => upd(i, {...doc.scenes[i], narration: t})} onAdd={() => add('talk')} />
              <ImportScript onImport={importScript} hasContent={doc.scenes.some(s => s.narration.trim() && s.narration !== 'New scene narration.')} />
            </div>
            <aside className="ws-side">
              {insp('episode')}
              {versions && (
                <section className="panel ws-ver" aria-label="Versions"><h2>Versions</h2>
                  {versions.length ? <ul>{versions.slice(0, 12).map(x => <li key={x.id}><span className="small num">{ago(x.at)} · {x.scenes} scenes{x.titleChanged ? ' · title changed' : ''}</span><button type="button" className="btn sm" onClick={() => void restore(x.id)} title="Your current script is saved as a version first">Restore</button></li>)}</ul> : <p className="muted small">No earlier versions yet. One is kept each time you save.</p>}
                </section>
              )}
            </aside>
          </>
        )}
        {(cur === 'voice' || cur === 'visuals') && (
          <>
            <div className="ws-main">{player}{board}</div>
            <aside className="ws-side">{insp(cur)}</aside>
          </>
        )}
        {cur === 'render' && (
          <>
            <div className="ws-main">
              <div className="seg" role="radiogroup" aria-label="What to run" onKeyDown={e => arrowNav(e, '[role=radio]')}>
                <button role="radio" tabIndex={mode === 'auto' ? 0 : -1} aria-checked={mode === 'auto'} onClick={() => setMode('auto')} disabled={!!blocked}>Full video</button>
                <button role="radio" tabIndex={mode === 'preview' ? 0 : -1} aria-checked={mode === 'preview'} onClick={() => setMode('preview')} disabled={!!blocked}>Preview only</button>
              </div>
              {player}
              {!st.final && !st.preview && !blocked && <p className="muted">Nothing rendered yet. Use the button above to render, or press {mod}+Enter.</p>}
            </div>
            <aside className="ws-side">{insp('report')}</aside>
          </>
        )}
        {cur === 'publish' && (
          <>
            <div className="ws-main"><section className="panel ws-pub" aria-label="Publish"><div className="insp-body"><Publish epId={id} cfg={cfg} hasVideo={st.voice} onStatus={setStatus} /></div></section></div>
            <aside className="ws-side">{player}</aside>
          </>
        )}
      </div>
      <StageTrack summary={data.summary} job={job && job.episode === data.summary.id ? job : null} onCancel={() => job && api.cancel(job.id)} onRetry={retry} />
    </div>
  );
}
