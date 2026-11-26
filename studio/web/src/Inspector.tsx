import {SwapImage} from './SwapImage';
import React, {useState} from 'react';
import type {Decisions, EpisodeDoc, Scene, SceneAudio, Settings} from './api';
import {Publish} from './Publish';
import {api, AUDIO_ACCEPT, arrowNav, CAMERAS, EMOTIONS, LAYOUTS, POSES, TRANSITIONS, nice} from './api';
import {Left, Mic, Right, Trash} from './icons';

type Tab = 'scene' | 'episode' | 'report' | 'publish';
export type InspView = 'voice' | 'visuals' | 'episode' | 'report';
const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

function Pick({label, value, options, onChange, hint}: {label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void; hint?: string}) {
  return (
    <label className="field"><span>{label}{hint && <em> · director: {nice(hint)}</em>}</span>
      <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">Auto</option>
        {options.map(o => <option key={o} value={o}>{nice(o)}</option>)}
      </select>
    </label>
  );
}

function AudioBlock({epId, n, audio, v, onChanged}: {epId: string; n: number; audio: SceneAudio; v: number; onChanged: () => void}) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<'replace' | 'remove' | null>(null), [file, setFile] = useState<File | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const gen = audio?.source === 'generated';
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await f(); setAsk(null); setFile(null); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (gen) { setFile(f); setAsk('replace'); } else void run(() => api.uploadAudio(epId, n, f)); };
  const confirm = () => void run(() => ask === 'replace' && file ? api.uploadAudio(epId, n, file, true) : api.removeAudio(epId, n, true));
  const cancel = () => { setAsk(null); setFile(null); };
  return (
    <fieldset className="audio"><legend>Audio</legend>
      <p className="muted small">{gen ? <span className="gen-badge">AI</span> : <Mic size={14} />}{audio ? (gen ? `ElevenLabs voice · ${audio.file} · ${(audio.size / 1048576).toFixed(2)} MB` : `${audio.file} · ${(audio.size / 1048576).toFixed(2)} MB`) : 'No recording for this scene. Used by the "My own recordings" engine.'}</p>
      {gen && <p className="hint">Generated audio. Use "Replace with my recording", or re-generate the episode voice from the Run panel.</p>}
      {audio && <audio controls preload="metadata" src={`/api/episodes/${epId}/audio/${n}?v=${audio.size}-${v}`} aria-label={`Scene ${n} ${gen ? 'generated voice' : 'recording'}`} />}
      <div className="row">
        <input ref={input} type="file" accept={AUDIO_ACCEPT} onChange={pick} hidden tabIndex={-1} />
        <button className="btn ghost sm" disabled={busy} onClick={() => input.current?.click()}>{gen ? 'Replace with my recording' : audio ? 'Replace' : 'Upload'}</button>
        {audio && <button className="btn danger sm" disabled={busy} onClick={() => gen ? setAsk('remove') : void run(() => api.removeAudio(epId, n))}><Trash size={15} />Remove</button>}
      </div>
      {ask && <div className="confirm" role="alert"><p className="small">{ask === 'replace' ? `Replacing with ${file?.name ?? 'your file'}` : 'Removing'} deletes paid ElevenLabs generated audio for this scene. Re-generating costs credits again.</p>
        <div className="row"><button className="btn danger sm" disabled={busy} onClick={confirm}>{ask === 'replace' ? 'Yes, replace' : 'Yes, delete'}</button><button className="btn ghost sm" disabled={busy} onClick={cancel}>Cancel</button></div></div>}
      {err && <p className="err-text" role="alert">{err}</p>}
    </fieldset>
  );
}

function Variety({text}: {text: string}) {
  const lines = text.replace(/^# .*\n+/, '').trim().split(/\n+/).filter(Boolean);
  const bullet = /^[-*]\s+/;
  const items = lines.filter(l => bullet.test(l)).map(l => l.replace(bullet, ''));
  return <div className="variety">{items.length > 0 && <ul>{items.map((t, k) => <li key={k}>{t}</li>)}</ul>}{lines.filter(l => !bullet.test(l)).map((t, k) => <p key={k}>{t}</p>)}</div>;
}

function RegenBtn({kind, n, onRegen, busy, note, paid}: {kind: 'voice' | 'preview'; n: number; onRegen: (k: 'voice' | 'preview', confirm: boolean) => void; busy: boolean; note?: string; paid?: boolean}) {
  const [ask, setAsk] = useState(false);
  const label = kind === 'voice' ? `Regenerate voice for scene ${n}` : `Re-render preview for scene ${n}`;
  return (
    <div className="regen">
      <button type="button" className="btn sm" disabled={busy} title={busy ? 'A job is already running' : undefined} onClick={() => (paid ? setAsk(true) : onRegen(kind, false))}>{label}</button>
      {ask && <div className="confirm" role="alert"><p className="small">{note}</p><div className="row"><button type="button" className="btn danger sm" onClick={() => { setAsk(false); onRegen(kind, true); }}>Yes, regenerate</button><button type="button" className="btn ghost sm" onClick={() => setAsk(false)}>Cancel</button></div></div>}
    </div>
  );
}

export function Inspector({cfg, hasVideo, doc, decisions, variety, audio, onAudio, sel, onScene, onDoc, onMove, onRemove, view, notes, onNotes, onRegen, busy, voiceChars}: {view?: InspView; notes?: string[]; onNotes?: (n: string[]) => void; onRegen?: (k: 'voice' | 'preview', confirm: boolean) => void; busy?: boolean; voiceChars?: number; cfg: Settings | null; hasVideo: boolean; doc: EpisodeDoc; decisions: Decisions | null; variety: string | null; audio: SceneAudio[]; onAudio: () => void; sel: number; onScene: (s: Scene) => void; onDoc: (d: EpisodeDoc) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void}) {
  const [tab0, setTab] = useState<Tab>('scene');
  const tab: Tab = view === 'episode' ? 'episode' : view === 'report' ? 'report' : view ? 'scene' : tab0;
  const showV = (k: 'voice' | 'visuals') => !view || view === k;
  const s = doc.scenes[sel], d = decisions?.scenes[sel];
  const set = (p: Partial<Scene>) => onScene({...s, ...p});
  return (
    <aside className="panel inspector" aria-label="Inspector">
      {!view && <div className="tabs" role="tablist" aria-label="Inspector" onKeyDown={e => arrowNav(e, '[role=tab]')}>
        {(['scene', 'episode', 'report', 'publish'] as Tab[]).map(t => <button key={t} role="tab" id={`it-${t}`} aria-controls="insp-panel" tabIndex={tab === t ? 0 : -1} aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>{t === 'scene' ? `Scene ${sel + 1}` : t === 'episode' ? 'Episode' : t === 'report' ? 'Report' : 'Publish'}</button>)}
      </div>}
      <div className="insp-body" role="tabpanel" id="insp-panel" aria-labelledby={`it-${tab}`}>
        {tab === 'scene' && s && (
          <>
            {(view === 'voice' || !view) && <label className="field"><span>Narration</span>
              <textarea rows={4} value={s.narration} onChange={e => set({narration: e.target.value})} />
            </label>}
            {showV('visuals') && <div className="two">
              <Pick label="Emotion" value={s.emotion} options={EMOTIONS} onChange={v => set({emotion: v ?? 'neutral'})} />
              <label className="field"><span>Emphasis words</span><input value={s.emphasis.join(', ')} onChange={e => set({emphasis: csv(e.target.value)})} placeholder="goes down, 3%" /></label>
            </div>}
            {view === 'visuals' && <SwapImage key={`${doc.id}-${sel}`} ep={doc.id} scene={sel} stock={s.stock} onPicked={st => set({stock: st})} />}
            {showV('visuals') && s.type === 'big_number' && (
              <fieldset><legend>Big number</legend>
                <div className="two">
                  <label className="field"><span>Value</span><input type="number" step="any" value={s.value ?? 0} onChange={e => set({value: Number(e.target.value)})} /></label>
                  <label className="field"><span>Decimals</span><input type="number" min={0} max={6} value={s.decimals ?? 0} onChange={e => set({decimals: Math.max(0, Number(e.target.value))})} /></label>
                  <label className="field"><span>Prefix</span><input value={s.prefix ?? ''} onChange={e => set({prefix: e.target.value})} /></label>
                  <label className="field"><span>Suffix</span><input value={s.suffix ?? ''} onChange={e => set({suffix: e.target.value})} /></label>
                </div>
                <label className="field"><span>Label under the number</span><input value={s.label ?? ''} onChange={e => set({label: e.target.value})} /></label>
              </fieldset>
            )}
            {showV('visuals') && s.type === 'chart' && s.chart && (
              <fieldset><legend>Chart data</legend>
                <label className="field"><span>Kind</span><select value={s.chart.kind} onChange={e => set({chart: {...s.chart!, kind: e.target.value as 'line' | 'bar'}})}><option value="line">Line</option><option value="bar">Bar</option></select></label>
                <label className="field"><span>Labels (comma separated)</span><input value={s.chart.labels.join(', ')} onChange={e => set({chart: {...s.chart!, labels: csv(e.target.value)}})} /></label>
                <label className="field"><span>Values (same count)</span><input value={s.chart.values.join(', ')} onChange={e => set({chart: {...s.chart!, values: csv(e.target.value).map(Number).filter(n => !Number.isNaN(n))}})} className="num" /></label>
                <label className="field"><span>Y axis label</span><input value={s.chart.yLabel} onChange={e => set({chart: {...s.chart!, yLabel: e.target.value}})} /></label>
              </fieldset>
            )}
            {showV('visuals') && s.type === 'compare' && s.left && s.right && (
              <fieldset><legend>Compare</legend>
                <div className="two">
                  <label className="field"><span>Left title</span><input value={s.left.title} onChange={e => set({left: {...s.left!, title: e.target.value}})} /></label>
                  <label className="field"><span>Left value</span><input value={s.left.value} onChange={e => set({left: {...s.left!, value: e.target.value}})} /></label>
                  <label className="field"><span>Right title</span><input value={s.right.title} onChange={e => set({right: {...s.right!, title: e.target.value}})} /></label>
                  <label className="field"><span>Right value</span><input value={s.right.value} onChange={e => set({right: {...s.right!, value: e.target.value}})} /></label>
                </div>
              </fieldset>
            )}
            {showV('visuals') && s.type === 'before_after' && s.before && s.after && (
              <fieldset><legend>Before and after</legend>
                <div className="two">
                  <label className="field"><span>Before title</span><input value={s.before.title} onChange={e => set({before: {...s.before!, title: e.target.value}})} /></label>
                  <label className="field"><span>Before value</span><input value={s.before.value} onChange={e => set({before: {...s.before!, value: e.target.value}})} /></label>
                  <label className="field"><span>After title</span><input value={s.after.title} onChange={e => set({after: {...s.after!, title: e.target.value}})} /></label>
                  <label className="field"><span>After value</span><input value={s.after.value} onChange={e => set({after: {...s.after!, value: e.target.value}})} /></label>
                </div>
              </fieldset>
            )}
            {showV('visuals') && s.type === 'timeline' && (
              <label className="field"><span>Timeline (one step per line, "when | what", 2 to 5)</span>
                <textarea rows={4} defaultValue={(s.events ?? []).map(e => `${e.when} | ${e.what}`).join('\n')} key={sel}
                  onChange={e => { const ev = e.target.value.split('\n').map(l => l.split('|')).filter(p => p.length > 1 && p[0].trim() && p.slice(1).join('|').trim()).map(p => ({when: p[0].trim().slice(0, 16), what: p.slice(1).join('|').trim().slice(0, 60)})).slice(0, 5); if (ev.length >= 2) set({events: ev}); }} />
              </label>
            )}
            {showV('visuals') && s.type === 'talk' && (
              <label className="field"><span>Quote card (optional, max 140 characters)</span>
                <input value={s.quote?.text ?? ''} maxLength={140} onChange={e => set({quote: e.target.value ? {text: e.target.value, by: s.quote?.by} : undefined})} />
              </label>
            )}
            {showV('visuals') && s.type === 'list' && (
              <label className="field"><span>List items (one per line, max 6)</span>
                <textarea rows={4} value={(s.items ?? []).join('\n')} onChange={e => set({items: e.target.value.split('\n').filter(x => x.trim()).slice(0, 6)})} />
              </label>
            )}
            {showV('voice') && <AudioBlock epId={doc.id} n={sel + 1} audio={audio[sel] ?? null} v={0} onChanged={onAudio} />}
            {view === 'voice' && onRegen && <RegenBtn kind="voice" n={sel + 1} onRegen={onRegen} busy={!!busy} paid={cfg?.engine === 'eleven'} note={`Re-voicing scene ${sel + 1} uses about ${(voiceChars ?? s.narration.length).toLocaleString()} ElevenLabs characters and replaces its audio. Cached audio is reused when the text is unchanged.`} />}
            {showV('visuals') && <fieldset><legend>Director overrides</legend>
              <p className="muted small">Leave on Auto to let the director choose from the content and past episodes.</p>
              <div className="two">
                <Pick label="Layout" value={s.layout} options={LAYOUTS[s.type] ?? []} onChange={v => set({layout: v})} hint={d?.layout} />
                <Pick label="Camera" value={s.camera} options={CAMERAS} onChange={v => set({camera: v})} hint={d?.camera} />
                <Pick label="Transition" value={s.transition} options={TRANSITIONS} onChange={v => set({transition: v})} hint={d?.transition} />
                <Pick label="Pose" value={s.pose} options={POSES} onChange={v => set({pose: v})} hint={d?.pose} />
              </div>
            </fieldset>}
            {view === 'visuals' && onRegen && <RegenBtn kind="preview" n={sel + 1} onRegen={onRegen} busy={!!busy} />}
            {notes && onNotes && (
              <label className="field"><span>Scene notes <em>· one per line, not rendered</em></span>
                <textarea rows={3} value={notes.join('\n')} onChange={e => onNotes(e.target.value.split('\n'))} placeholder="Reminders for this scene" />
              </label>
            )}
            {showV('visuals') && <div className="row">
              <button className="btn ghost sm" onClick={() => onMove(-1)} disabled={sel === 0} aria-label="Move scene earlier"><Left size={15} />Earlier</button>
              <button className="btn ghost sm" onClick={() => onMove(1)} disabled={sel === doc.scenes.length - 1} aria-label="Move scene later">Later<Right size={15} /></button>
              <span className="grow" />
              <button className="btn danger sm" onClick={onRemove} disabled={doc.scenes.length === 1}><Trash size={15} />Delete scene</button>
            </div>}
          </>
        )}
        {tab === 'episode' && (
          <>
            <label className="field"><span>Title</span><input value={doc.title} onChange={e => onDoc({...doc, title: e.target.value})} /></label>
            <div className="two">
              <label className="field"><span>Episode ID</span><input value={doc.id} readOnly aria-readonly="true" /></label>
              <label className="field"><span>Series</span><input value={doc.series} onChange={e => onDoc({...doc, series: e.target.value})} /></label>
            </div>
            <label className="field"><span>Seed <em>· change to re-roll the visual choices</em></span>
              <input type="number" value={doc.seed} onChange={e => onDoc({...doc, seed: Math.round(Number(e.target.value))})} className="num" /></label>
            <label className="check"><input type="checkbox" checked={doc.disclaimer} onChange={e => onDoc({...doc, disclaimer: e.target.checked})} />End card: "educational, not financial advice"</label>
            <label className="field"><span>Sources (one URL per line)</span>
              <textarea rows={5} value={doc.sources.join('\n')} onChange={e => onDoc({...doc, sources: e.target.value.split('\n').map(x => x.trim()).filter(Boolean)})} />
            </label>
          </>
        )}
        {tab === 'publish' && <Publish epId={doc.id} cfg={cfg} hasVideo={hasVideo} />}
        {tab === 'report' && (
          decisions ? (
            <>
              <dl className="facts">
                <div><dt>Accent</dt><dd>{decisions.accent}</dd></div><div><dt>Background</dt><dd>{decisions.background}</dd></div>
                <div><dt>Captions</dt><dd>{decisions.captionStyle}</dd></div><div><dt>Music</dt><dd>{decisions.music.mood}</dd></div>
              </dl>
              {variety && <Variety text={variety} />}
              <table className="treat"><thead><tr><th>#</th><th>Type</th><th>Layout</th><th>Camera</th></tr></thead>
                <tbody>{decisions.scenes.map(x => <tr key={x.index} className={x.index === sel ? 'cur' : ''}><td className="num">{x.index + 1}</td><td>{nice(x.type)}</td><td>{nice(x.layout)}</td><td>{nice(x.camera)}</td></tr>)}</tbody></table>
            </>
          ) : <p className="muted">No director report yet. Generate the episode to see how it differs from the last five.</p>
        )}
      </div>
    </aside>
  );
}
