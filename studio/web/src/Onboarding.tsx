// First-run wizard: channel, language, voice, script model, machine check. Everything free and local; nothing is downloaded here.
import React, {useEffect, useState} from 'react';
import {api, type ChannelRow, type LlmStatus, type PresetRow} from './api';
import {getLang, setLang, t, type Lang} from './i18n';
import {ReadinessPanel} from './Settings';

const KEY = 'studio.onboarded';
export const needsOnboarding = () => { try { return !localStorage.getItem(KEY); } catch { return false; } };
export const resetOnboarding = () => { try { localStorage.removeItem(KEY); } catch { /* blocked */ } };
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STEPS = ['Channel', 'Language of the videos', 'Voice engine', 'Script model', 'Check this machine'];

export function Onboarding({chans, onDone}: {chans: ChannelRow[]; onDone: (channelId?: string) => void}) {
  const [i, setI] = useState(0), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<PresetRow[]>([]), [llm, setLlm] = useState<LlmStatus | null>(null);
  const [preset, setPreset] = useState(''), [name, setName] = useState(chans[0]?.name ?? ''), [language, setLanguage] = useState<'en' | 'hu'>(getLang());
  const [engine, setEngine] = useState('say'), [model, setModel] = useState('');
  useEffect(() => { api.presets().then(setPresets).catch(() => {}); api.llm().then(x => { setLlm(x); setModel(x.chosen ?? ''); }).catch(() => {}); }, []);
  const pick = (id: string) => { setPreset(id); const p = presets.find(x => x.id === id)?.preset; if (p) { setName(p.name); setLanguage(p.language === 'hu' ? 'hu' : 'en'); } };
  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      let ch = chans[0];
      const p = presets.find(x => x.id === preset)?.preset;
      if (p) ch = {...(await api.createChannel({...p, name: name.trim() || p.name, language, id: slug(name || p.name)})), episodes: 0};
      else if (ch) await api.saveChannel({...ch, name: name.trim() || ch.name, language});
      await api.saveSettings({engine, ...(model ? {llmModel: model} : {})});
      try { localStorage.setItem(KEY, '1'); } catch { /* blocked */ }
      onDone(ch?.id);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  const last = i === STEPS.length - 1;
  return (
    <div className="page"><form className="panel settings" aria-labelledby="ob-h" onSubmit={e => { e.preventDefault(); if (last) void finish(); else setI(i + 1); }}>
      <h1 className="display" id="ob-h" tabIndex={-1}>{t('Welcome to Mascot Engine Studio')}</h1>
      <p className="muted small" role="status">{t('First-run setup')} {i + 1}/{STEPS.length}: {t(STEPS[i])}</p>
      {i === 0 && <>
        {presets.length > 0 && <label className="field"><span>Preset <em>· optional</em></span><select value={preset} onChange={e => pick(e.target.value)}><option value="">{chans[0]?.name ?? 'Blank'}</option>{presets.map(p => <option key={p.id} value={p.id}>{p.preset.name}</option>)}</select></label>}
        <label className="field"><span>{t('Channel name')}</span><input value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label></>}
      {i === 1 && <label className="field"><span>{t('Language of the videos')}</span><select value={language} onChange={e => setLanguage(e.target.value as 'en' | 'hu')}><option value="en">{t('English')}</option><option value="hu">{t('Hungarian')}</option></select></label>}
      {i === 1 && <label className="field"><span>{t('UI language')}</span><select value={getLang()} onChange={e => setLang(e.target.value as Lang)}><option value="en">{t('English')}</option><option value="hu">{t('Hungarian')}</option></select></label>}
      {i === 2 && <label className="field"><span>{t('Voice engine')}</span><select value={engine} onChange={e => setEngine(e.target.value)}>
        <option value="say">{t('Free voice (built into your Mac)')}</option><option value="local">{t('My own recordings (local)')}</option><option value="silent">{t('Silent (estimated timing, for quick previews)')}</option></select></label>}
      {i === 3 && <label className="field"><span>{t('Script model')}</span>{llm?.models.length
        ? <select value={model} onChange={e => setModel(e.target.value)}>{llm.models.map(m => <option key={m} value={m}>{m}</option>)}</select>
        : <small className="hint">Ollama has no models yet. Install one later with `ollama pull qwen2.5:7b`; the Studio never downloads on its own.</small>}</label>}
      {i === 4 && <ReadinessPanel />}
      {err && <p className="err-text" role="alert">{err}</p>}
      <div className="row">
        {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>{t('Back')}</button>}
        <button className="btn primary" type="submit" disabled={busy || (i === 0 && !name.trim())}>{last ? t('Finish') : t('Next')}</button>
        <button type="button" className="btn ghost" onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* blocked */ } onDone(); }}>{t('Skip')}</button>
      </div>
    </form></div>
  );
}
