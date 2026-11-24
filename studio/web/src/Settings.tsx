import React, {useEffect, useState} from 'react';
import {api, type LlmStatus, type Readiness, type Settings as S} from './api';
import {Check, Alert} from './icons';
import {resetOnboarding} from './Onboarding';
import {t} from './i18n';

export type Check = {key: string; label: string; ok: boolean; fix: string};
/** What is missing before Generate / Draft can work. Voice checks only apply to the ElevenLabs engine. */
export function readiness(s: S, engine: string): Check[] {
  return [
    ...(engine === 'eleven' ? [{key: 'eleven', label: 'ElevenLabs key + voice ID', ok: s.elevenKeySet && !!s.voiceId, fix: 'Add them in Settings'}] : []),
    {key: 'ffmpeg', label: 'ffmpeg', ok: s.ffmpeg, fix: 'Install ffmpeg (brew install ffmpeg)'},
  ];
}

/** Machine readiness from GET /api/readiness: what is installed, and the command that fixes what is not. */
export function ReadinessPanel({onlyMissing = false}: {onlyMissing?: boolean}) {
  const [r, setR] = useState<Readiness | null>(null);
  useEffect(() => { api.readiness().then(setR).catch(() => setR(null)); }, []);
  if (!r || (onlyMissing && r.ok)) return null;
  const items = onlyMissing ? r.items.filter(i => !i.ok) : r.items;
  return (
    <div className={onlyMissing ? 'panel ready-warn' : 'ready'} aria-label="Machine readiness">
      <h2 className="label">{onlyMissing ? t('Missing on this machine') : t('This machine')}</h2>
      <ul>{items.map(i => <li key={i.id} className={i.ok ? 'ok' : 'bad'}>{i.ok ? <Check size={14} /> : <Alert size={14} />}<b>{i.label}</b><span>{i.ok ? i.detail || 'ready' : i.fix}</span>{!i.ok && <button type="button" className="btn sm" aria-label={`Copy fix for ${i.label}`} onClick={() => void navigator.clipboard?.writeText(i.fix.match(/`([^`]+)`/)?.[1] ?? i.fix)}>{t('Copy')}</button>}</li>)}</ul>
      {onlyMissing && <p><a className="link" href="#/settings">Open Settings</a></p>}
    </div>
  );
}

export function Settings({onSaved}: {onSaved: () => void}) {
  const [s, setS] = useState<S | null>(null);
  const [apiKey, setKey] = useState(''), [voiceId, setVoice] = useState(''), [model, setModel] = useState(''), [engine, setEngine] = useState('say');
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  useEffect(() => { api.settings().then(x => { setS(x); setVoice(x.voiceId); setModel(x.model); setEngine(x.engine); }); }, []);
  if (!s) return <div className="settings"><h1 className="display" tabIndex={-1}>Settings</h1><p className="muted">Loading…</p></div>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.saveSettings({apiKey, voiceId, model, engine}); setKey(''); setS(await api.settings()); setMsg({ok: true, text: 'Saved to .env on this machine.'}); onSaved(); }
    catch (err) { setMsg({ok: false, text: (err as Error).message}); }
  };
  return (
    <form className="settings panel" onSubmit={save}>
      <h1 className="display" tabIndex={-1}>{t('Settings')}</h1>
      <p className="muted">Stored in the project's <code>.env</code> file. The API key never leaves this computer and is never shown again.</p>
      {readiness(s, engine).some(c => !c.ok) && <div className="ready" aria-label="Readiness">
        <h2 className="label">Readiness</h2>
        <ul>{readiness(s, engine).map(c => <li key={c.key} className={c.ok ? 'ok' : 'bad'}>{c.ok ? <Check size={14} /> : <Alert size={14} />}<b>{c.label}</b><span>{c.ok ? 'ready' : c.fix}</span></li>)}</ul>
      </div>}
      <ReadinessPanel />
      <p className="small"><button type="button" className="btn sm" onClick={() => { resetOnboarding(); location.hash = '#/today'; location.reload(); }}>Run first-run setup again</button> <span className="muted">(only shows while there are no episodes)</span></p>
      <AiPanel />
      <label className="field"><span>{t('Voice engine')}</span>
        <select value={engine} onChange={e => setEngine(e.target.value)}>
          <option value="say">{t('Free voice (built into your Mac)')}</option>
          <option value="eleven">ElevenLabs (paid, optional)</option>
          <option value="local">{t('My own recordings (local)')}</option>
          <option value="silent">{t('Silent (estimated timing, for quick previews)')}</option>
        </select>
        {engine === 'local' && <small className="hint">Needs one audio file per scene (wav, mp3 or m4a). Word timing is approximate unless whisper is installed.</small>}
      </label>
      <label className="field"><span>ElevenLabs API key (optional)</span>
        <input type="password" autoComplete="off" value={apiKey} onChange={e => setKey(e.target.value)} placeholder={s.elevenKeySet ? 'Saved. Type to replace.' : 'Paste your key'} />
      </label>
      <label className="field"><span>Voice ID</span><input value={voiceId} onChange={e => setVoice(e.target.value)} placeholder="From the ElevenLabs voice library" /></label>
      <label className="field"><span>Model</span><input value={model} onChange={e => setModel(e.target.value)} /></label>
      <div className="row">
        <button className="btn primary" type="submit">{t('Save settings')}</button>
        <span className={`pill ${s.ffmpeg ? 'ok' : 'bad'}`}>{s.ffmpeg ? <Check size={14} /> : <Alert size={14} />}ffmpeg {s.ffmpeg ? 'found' : 'not found. Install it to render audio'}</span>
      </div>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role="status">{msg.text}</p>}
    </form>
  );
}

/** Free local AI (Ollama): status, one-click start/download, live progress. No key needed. */
export function AiPanel() {
  const [st, setSt] = useState<LlmStatus | null>(null);
  useEffect(() => {
    let live = true, t: ReturnType<typeof setTimeout>;
    const tick = () => api.llm().then(x => { if (live) { setSt(x); t = setTimeout(tick, x.phase === 'starting' || x.phase === 'pulling' ? 1000 : 5000); } }).catch(() => { if (live) t = setTimeout(tick, 5000); });
    tick(); return () => { live = false; clearTimeout(t); };
  }, []);
  if (!st) return null;
  const busy = st.phase === 'starting' || st.phase === 'pulling', ready = st.reachable && !!st.chosen && !busy;
  return (
    <div className="ready" aria-label="Local AI">
      <h2 className="label">Script AI (free, runs on this Mac)</h2>
      <p className={ready ? 'ok-text' : st.phase === 'error' ? 'err-text' : 'muted'} role="status">
        {ready ? `Ready: ${st.chosen}. No key needed.` : busy ? (st.message ?? 'Working…') : st.phase === 'error' ? st.message : 'Not started yet. It starts by itself when you draft, or press the button.'}
      </p>
      {st.phase === 'pulling' && <progress max={100} value={st.pct ?? 0} aria-label="Model download" />}
      {!ready && !busy && <button type="button" className="btn" onClick={() => void api.llmSetup().then(setSt)}>Start local AI</button>}
    </div>
  );
}
