import React, {useEffect, useState} from 'react';
import {api, initial, type Channel, type ChannelRow, type PresetRow} from './api';
import {Alert, Pencil, Plus, Trash} from './icons';
import {setRoute, type Route} from './router';

type Form = {name: string; description: string; niche: string; audience: string; tone: string; language: string; voiceId: string; banned: string; ppw: string; accent: string; sayVoice: string; voiceStyle: string; handle: string; cta: string};
const blank: Form = {name: '', description: '', niche: '', audience: '', tone: '', language: 'English', voiceId: '', banned: '', ppw: '1', accent: '', sayVoice: '', voiceStyle: '', handle: '', cta: ''};
const toForm = (c: Channel): Form => ({name: c.name, description: c.description, niche: c.niche, audience: c.audience, tone: c.tone, language: c.language, voiceId: c.voiceId ?? '', banned: c.bannedTopics.join(', '), ppw: String(c.postingPerWeek), accent: c.accent ?? '', sayVoice: c.sayVoice ?? '', voiceStyle: c.voiceStyle ?? '', handle: c.branding?.handle ?? '', cta: c.branding?.cta ?? ''});
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Channels({route, active, onChanged, onPick}: {route: Route; active: string; onChanged: () => void; onPick: (id: string) => void}) {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const [f, setF] = useState<Form>(blank);
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetRow[]>([]), [presetMsg, setPresetMsg] = useState<string | null>(null), [presetId, setPresetId] = useState('');
  const loadPresets = () => api.presets().then(setPresets).catch(() => {});
  useEffect(() => { void loadPresets(); }, []);
  const load = () => api.channels().then(setRows).catch(e => setErr(e.message));
  useEffect(() => { void load(); }, []);

  const hash = route.hash;
  const open = (c: ChannelRow | null) => { setErr(null); setAsk(null); setEdit(c ? c.id : 'new'); setF(c ? toForm(c) : blank); };
  useEffect(() => { if (route.isNew) open(null); else if (route.chanId) { const c = rows.find(r => r.id === route.chanId); if (c) open(c); } else setEdit(null); }, [hash, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({...f, [k]: e.target.value});
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const base = {name: f.name, description: f.description, niche: f.niche, audience: f.audience, tone: f.tone, language: f.language, voiceId: f.voiceId, bannedTopics: f.banned.split(/[,\n]/).map(x => x.trim()).filter(Boolean), postingPerWeek: Number(f.ppw), accent: f.accent, sayVoice: f.sayVoice, voiceStyle: f.voiceStyle, branding: f.handle || f.cta || rows.find(r => r.id === edit)?.branding ? {...rows.find(r => r.id === edit)?.branding, outroSec: rows.find(r => r.id === edit)?.branding?.outroSec ?? 2, watermark: rows.find(r => r.id === edit)?.branding?.watermark ?? true, handle: f.handle, cta: f.cta} : undefined};
    try {
      if (edit === 'new') { const c = await api.createChannel({...base, id: slug(f.name)}); onPick(c.id); }
      else { const cur = rows.find(r => r.id === edit)!; await api.saveChannel({...cur, ...base}); }
      setRoute({page: 'channels'}); await load(); onChanged();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const del = async (id: string) => {
    setBusy(true); setErr(null);
    try { await api.deleteChannel(id); setAsk(null); setEdit(null); await load(); onChanged(); }
    catch (x) { setErr((x as Error).message); setAsk(null); } finally { setBusy(false); }
  };
  const cur = rows.find(r => r.id === edit);
  const applyPreset = (id: string) => { const p = presets.find(x => x.id === id)?.preset; if (p) setF({...blank, ...toForm({...p, id: '', createdAt: ''} as Channel)}); };
  const savePresetAs = async () => {
    const id = slug(presetId || f.name); setPresetMsg(null);
    try { await api.savePreset(id, cur!.id); setPresetMsg(`Saved preset "${id}". Pick it when you create a channel.`); setPresetId(''); await loadPresets(); } catch (x) { setPresetMsg((x as Error).message); }
  };
  const mine = presets.filter(p => !p.builtin);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="display" tabIndex={-1}>Channels</h1><p className="muted">Each channel has its own voice, audience and idea board. Episodes belong to one channel.</p></div>
        <button className="btn primary" onClick={() => setRoute({page: 'channels', isNew: true})}><Plus size={16} />New channel</button>
      </div>
      {err && !edit && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span></div>}
      <div className="split">
        <ul className="chan-list">
          {rows.map(c => (
            <li key={c.id} className={`panel chan ${c.id === active ? 'on' : ''}`}>
              <span className="badge" aria-hidden="true">{initial(c.name)}</span>
              <div className="chan-main">
                <b>{c.name}</b>
                <span className="muted small">{c.niche || 'No niche yet'} · {c.postingPerWeek}/week · {c.episodes} {c.episodes === 1 ? 'episode' : 'episodes'}</span>
                <p className="small chan-desc">{c.description}</p>
              </div>
              <div className="row">
                {c.id !== active && <button className="btn sm" onClick={() => onPick(c.id)}>Use</button>}
                <button className="btn sm ghost" onClick={() => setRoute({page: 'channels', chanId: c.id})} aria-label={`Edit ${c.name}`}><Pencil size={15} />Edit</button>
              </div>
            </li>
          ))}
        </ul>
        {edit && (
          <form className="panel chan-form" onSubmit={save} aria-label={edit === 'new' ? 'New channel' : 'Edit channel'}>
            <h2 className="display">{edit === 'new' ? 'New channel' : `Edit ${cur?.name ?? ''}`}</h2>
            {edit === 'new' && presets.length > 0 && <label className="field"><span>Start from a preset <em>· optional</em></span><select defaultValue="" onChange={e => applyPreset(e.target.value)}><option value="">Blank</option>{presets.map(p => <option key={p.id} value={p.id}>{p.preset.name}{p.builtin ? '' : ' (mine)'}</option>)}</select></label>}
            <label className="field"><span>{edit === 'new' ? 'Describe your channel in 2-3 sentences' : 'Description'}</span>
              <textarea rows={4} value={f.description} onChange={set('description')} placeholder="Who is it for, what do you explain, and what makes it different?" /></label>
            <label className="field"><span>Name</span><input value={f.name} onChange={set('name')} required maxLength={80} placeholder="Money Myths" /></label>
            <div className="two">
              <label className="field"><span>Niche</span><input value={f.niche} onChange={set('niche')} placeholder="personal finance" /></label>
              <label className="field"><span>Language</span><input value={f.language} onChange={set('language')} /></label>
            </div>
            <label className="field"><span>Audience</span><input value={f.audience} onChange={set('audience')} placeholder="Beginners who find money confusing" /></label>
            <label className="field"><span>Tone</span><input value={f.tone} onChange={set('tone')} placeholder="Clear, curious, a little wry" /></label>
            <div className="two">
              <label className="field"><span>ElevenLabs voice ID <em>· optional</em></span><input value={f.voiceId} onChange={set('voiceId')} placeholder="From the voice library" /></label>
              <label className="field"><span>Posts per week</span><input type="number" min={0} max={21} value={f.ppw} onChange={set('ppw')} className="num" /></label>
            </div>
            <div className="two">
              <label className="field"><span>Accent colour <em>· optional</em></span><input value={f.accent} onChange={set('accent')} placeholder="blue, green, teal, mustard" /></label>
              <label className="field"><span>Mac voice <em>· optional</em></span><input value={f.sayVoice} onChange={set('sayVoice')} placeholder="Samantha, Tünde" /></label>
            </div>
            <label className="field"><span>Voice style <em>· optional</em></span><input value={f.voiceStyle} onChange={set('voiceStyle')} placeholder="calm, dry, mid pace" /></label>
            <div className="two">
              <label className="field"><span>Handle <em>· optional</em></span><input value={f.handle} onChange={set('handle')} placeholder="@MoneyMyths" /></label>
              <label className="field"><span>End-card line <em>· optional</em></span><input value={f.cta} onChange={set('cta')} placeholder="Subscribe for the next myth" /></label>
            </div>
            <label className="field"><span>Banned topics <em>· comma separated</em></span><input value={f.banned} onChange={set('banned')} placeholder="crypto tips, stock picks" /></label>
            {err && <p className="err-text" role="alert">{err}</p>}
            <div className="row">
              <button className="btn primary" type="submit" disabled={busy || !f.name.trim()}>{edit === 'new' ? 'Create channel' : 'Save channel'}</button>
              <button type="button" className="btn ghost" onClick={() => setRoute({page: 'channels'})}>Cancel</button>
              <span className="grow" />
              {edit !== 'new' && cur && (ask === cur.id
                ? <span className="row"><span className="small">Delete {cur.name} and its ideas?</span><button type="button" className="btn danger sm" disabled={busy} onClick={() => del(cur.id)}>Yes, delete</button><button type="button" className="btn ghost sm" onClick={() => setAsk(null)}>Keep</button></span>
                : <button type="button" className="btn danger sm" onClick={() => setAsk(cur.id)} disabled={cur.id === 'default' || cur.episodes > 0} title={cur.id === 'default' ? 'The default channel cannot be deleted' : cur.episodes > 0 ? 'Move or delete its episodes first' : undefined}><Trash size={15} />Delete</button>)}
            </div>
            {edit !== 'new' && cur && <div className="row"><label className="field grow"><span>Save this profile as a preset</span><input value={presetId} onChange={e => setPresetId(e.target.value)} placeholder={slug(f.name) || 'my-preset'} /></label><button type="button" className="btn sm" onClick={() => void savePresetAs()}>Save preset</button>{mine.length > 0 && <select aria-label="Delete a preset of mine" value="" onChange={e => { if (e.target.value) void api.deletePreset(e.target.value).then(loadPresets); }}><option value="">Delete a preset…</option>{mine.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}</select>}</div>}
            {presetMsg && <p className="small" role="status">{presetMsg}</p>}
            {edit !== 'new' && cur && (cur.id === 'default' || cur.episodes > 0) && <p className="hint">{cur.id === 'default' ? 'The default channel cannot be deleted.' : `Delete is blocked while the channel has ${cur.episodes} ${cur.episodes === 1 ? 'episode' : 'episodes'}.`}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
