// The one guided flow: topic -> format/voice/model -> Make video, then a single progress timeline that lands on the player.
import React, {useEffect, useState} from 'react';
import {api, type ChannelRow, type DraftStatus, type EpisodeData, type Idea, type JobState, type LlmStatus} from './api';
import {Alert, Bulb, Check, Phone, Play, Tv, Wand} from './icons';
import {hashFor, setRoute} from './router';
import {t} from './i18n';
import {toast} from './toast';

type Voice = Awaited<ReturnType<typeof api.voices>>['engines'];
const langOf = (c?: ChannelRow) => ((c?.language ?? 'en').toLowerCase().match(/^[a-z]{2}/)?.[0] ?? 'en');

export function NewVideo({ch, chans, ep, onChanged}: {ch: string; chans: ChannelRow[]; ep?: string; onChanged: () => void}) {
  return ep ? <Making id={ep} ch={ch} onChanged={onChanged} /> : <Form ch={ch} chans={chans} />;
}

function Form({ch, chans}: {ch: string; chans: ChannelRow[]}) {
  const [channel, setChannel] = useState(ch === 'all' ? chans[0]?.id ?? 'default' : ch);
  const chObj = chans.find(c => c.id === channel), lang = langOf(chObj);
  const [topic, setTopic] = useState(''), [angle, setAngle] = useState(''), [fmt, setFmt] = useState<'short' | 'wide'>('short');
  const [ideas, setIdeas] = useState<Idea[]>([]), [thinking, setThinking] = useState(false), [pick, setPick] = useState('');
  const [voices, setVoices] = useState<Voice>([]), [engine, setEngine] = useState('auto'), [pv, setPv] = useState<{busy?: boolean; file?: string; err?: string}>({});
  const [llm, setLlm] = useState<LlmStatus | null>(null), [model, setModel] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!chans.some(c => c.id === channel) && chans[0]) setChannel(chans[0].id); }, [chans, channel]);
  useEffect(() => { api.voices(lang).then(x => setVoices(x.engines)).catch(() => setVoices([])); }, [lang]);
  useEffect(() => { api.llm().then(x => { setLlm(x); setModel(m => m || x.chosen || ''); }).catch(() => {}); api.settings().then(s => setEngine(s.engine || 'auto')).catch(() => {}); }, []);
  useEffect(() => { api.ideas(channel).then(d => setIdeas(d.ideas.filter(i => i.status === 'new').slice(0, 6))).catch(() => setIdeas([])); }, [channel]);

  const suggest = async () => {
    setThinking(true); setErr(null);
    try { const d = await api.genIdeas(channel, 5, topic); setIdeas(d.ideas.filter(i => i.status === 'new').slice(0, 6)); }
    catch (e) { setErr((e as Error).message); } finally { setThinking(false); }
  };
  const choose = (i: Idea) => { setPick(i.id); setTopic(i.title); setAngle(i.angle); };
  const make = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.makeVideo(topic.trim(), angle, channel, true, fmt, engine, model);
      toast(t('Started. Your video is being made.'));
      setRoute({page: 'new', ep: r.id, ch: channel});
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const selVoice = voices.find(v => v.engine === engine);
  return (
    <div className="page nv">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>{t('New video')}</h1><p className="muted">{t('Three quick steps. Nothing is published; you review everything.')}</p></div></div>

      <section className="panel nv-step" aria-labelledby="s1">
        <h2 id="s1"><span className="nv-n">1</span>{t('What is it about?')}</h2>
        <label className="field"><span className="sr">{t('Topic')}</span>
          <input className="nv-topic" value={topic} onChange={e => { setTopic(e.target.value); setPick(''); }} placeholder={t('e.g. why paying the minimum on a credit card costs thousands')} maxLength={200} autoFocus /></label>
        <div className="row">
          <button type="button" className="btn" onClick={() => void suggest()} disabled={thinking}><Bulb size={15} />{thinking ? t('Thinking of ideas… about a minute') : t('Suggest ideas')}</button>
          <span className="small muted">{t('or pick one below')}</span>
        </div>
        {ideas.length > 0 && <ul className="nv-ideas" role="radiogroup" aria-label={t('Ideas')}>{ideas.map(i => (
          <li key={i.id}><button type="button" role="radio" aria-checked={pick === i.id} className={`nv-idea ${pick === i.id ? 'on' : ''}`} onClick={() => choose(i)}><b>{i.title}</b><span className="small muted">{i.hook}</span></button></li>))}</ul>}
      </section>

      <section className="panel nv-step" aria-labelledby="s2">
        <h2 id="s2"><span className="nv-n">2</span>{t('How should it look and sound?')}</h2>
        <div className="nv-fmt" role="radiogroup" aria-label={t('Format')}>
          <button type="button" role="radio" aria-checked={fmt === 'short'} className={`nv-card ${fmt === 'short' ? 'on' : ''}`} onClick={() => setFmt('short')}><Phone size={22} /><b>{t('Short')} 9:16</b><span className="small muted">{t('Vertical, 30 to 55 seconds, full-screen pictures')}</span></button>
          <button type="button" role="radio" aria-checked={fmt === 'wide'} className={`nv-card ${fmt === 'wide' ? 'on' : ''}`} onClick={() => setFmt('wide')}><Tv size={22} /><b>{t('Long')} 16:9</b><span className="small muted">{t('Landscape, 3 to 5 minutes, mascot and paper look')}</span></button>
        </div>
        <div className="nv-grid">
          <label className="field"><span>{t('Channel and language')}</span>
            <select value={channel} onChange={e => setChannel(e.target.value)}>{chans.map(c => <option key={c.id} value={c.id}>{c.name} ({langOf(c).toUpperCase()})</option>)}</select></label>
          <label className="field"><span>{t('Voice')}</span>
            <select value={engine} onChange={e => setEngine(e.target.value)}>{voices.length ? voices.map(v => <option key={v.engine} value={v.engine}>{v.label}{v.ok ? '' : ` (${t('not set up')})`}</option>) : <option value="auto">{t('Best available')}</option>}</select>
            {selVoice && <small className="hint">{selVoice.ok ? selVoice.detail : `${selVoice.detail}. ${selVoice.fix ? `Run: ${selVoice.fix}` : ''}`}</small>}
            <span className="row"><button type="button" className="btn sm" disabled={pv.busy} onClick={() => { setPv({busy: true}); api.voicePreview(engine, lang).then(r => setPv({file: `${r.file}?t=${Date.now()}`})).catch(e => setPv({err: (e as Error).message})); }}><Play size={14} />{pv.busy ? t('Rendering…') : t('Hear this voice')}</button></span>
            {pv.file && <audio controls autoPlay src={pv.file} />}{pv.err && <small className="err-text" role="alert">{pv.err}</small>}</label>
          <label className="field"><span>{t('Script model')}</span>
            <select value={model} onChange={e => setModel(e.target.value)}>{(llm?.models.length ? llm.models : model ? [model] : []).map(m => <option key={m} value={m}>{m}</option>)}{!llm?.models.length && !model && <option value="">{t('Automatic')}</option>}</select>
            <small className="hint">{t('Bigger models write better scripts but take longer (a few minutes).')}</small></label>
        </div>
      </section>

      <section className="panel nv-step" aria-labelledby="s3">
        <h2 id="s3"><span className="nv-n">3</span>{t('Make it')}</h2>
        <p className="muted small">{t('The Studio writes the script, records the voice and renders a preview. You can watch the progress.')}</p>
        {err && <div className="alert" role="alert"><Alert size={18} /><span className="pre">{err}</span></div>}
        <button type="button" className="btn primary big" onClick={() => void make()} disabled={!topic.trim() || busy}><Wand size={18} />{busy ? t('Starting…') : t('Make video')}</button>
        {!topic.trim() && <span className="small muted"> {t('Enter a topic or pick an idea first.')}</span>}
      </section>
    </div>
  );
}

const STEPS = ['Writing the script', 'Recording the voice', 'Planning the shots', 'Rendering the preview'] as const;

function Making({id, ch, onChanged}: {id: string; ch: string; onChanged: () => void}) {
  const [d, setD] = useState<DraftStatus | null>(null), [job, setJob] = useState<JobState | null>(null);
  const [data, setData] = useState<EpisodeData | null>(null), [lost, setLost] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let on = true, timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        let cur = d;
        if (!cur || cur.state === 'running') { try { cur = await api.draftStatus(id); } catch { cur = null; if (!(await api.episode(id).catch(() => null))) { if (on) setLost(true); return; } } if (on && cur) setD(cur); }
        const jid = cur?.jobId ?? d?.jobId;
        if (jid) { const j = await api.job(jid); if (on) setJob(j); if (j.status === 'done') { const e = await api.episode(id); if (on) { setData(e); onChanged(); } return; } if (j.status !== 'running' && j.status !== 'queued' as string) return; }
        else if (cur?.state === 'error') return;
      } catch { /* retry */ }
      if (on) timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => { on = false; clearTimeout(timer); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const failed = d?.state === 'error' ? d.error : job && (job.status === 'error' || job.status === 'cancelled') ? job.error ?? `The run ${job.status}.` : null;
  const stage = !d || d.state === 'running' ? 0 : !job ? 1 : job.current === 'voice' || !job.current ? 1 : job.current === 'direct' ? 2 : 3;
  const pr = d?.progress;
  const sub = (i: number) => i === 0 && d?.state === 'running' ? (pr?.total ? `${t('part')} ${Math.min(pr.done + 1, pr.total)}/${pr.total}: ${pr.label}` : pr?.label || '') : i === 3 && job?.current === 'preview' ? `${Math.round(job.progress * 100)}%` : '';
  const finalize = async () => { setBusy(true); try { await api.generate(id, ['final'], 'auto'); toast(t('Final render started.')); setRoute({page: 'ep', ep: id, step: 'render', ch}); } catch (e) { setErr((e as Error).message); setBusy(false); } };
  return (
    <div className="page nv">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>{data ? t('Your video is ready') : t('Making your video')}</h1><p className="muted">{d?.topic ?? id}</p></div></div>
      {lost && <div className="alert" role="alert"><Alert size={18} /><span>{t('The Studio lost track of this run (it may have been restarted). Your episode may still exist in the Library.')}</span><a className="btn sm" href="#/library">{t('Open library')}</a></div>}
      {failed && <div className="alert" role="alert"><Alert size={18} /><span className="pre"><b>{t('This did not work.')}</b> {failed}</span><a className="btn sm" href={hashFor({page: 'new', ch})}>{t('Try again')}</a></div>}
      {!data && !failed && !lost && (
        <ol className="nv-tl panel" aria-label={t('Progress')}>{STEPS.map((s, i) => (
          <li key={s} className={i < stage ? 'done' : i === stage ? 'now' : ''} aria-current={i === stage ? 'step' : undefined}>
            <span className="nv-dot">{i < stage ? <Check size={14} /> : i + 1}</span><span><b>{t(s)}</b>{sub(i) && <span className="small muted"> {sub(i)}</span>}</span></li>))}</ol>)}
      {!data && !failed && !lost && <p className="small muted">{t('You can leave this page; the work continues. Find it under Today or Jobs.')}</p>}
      {data && (
        <div className="nv-done">
          <video className="video nv-video" controls src={`/api/episodes/${id}/media/${id}-preview.mp4?v=${Date.now()}`} style={{maxHeight: '62vh'}} aria-label={t('Preview')} />
          <div className="row">
            <button type="button" className="btn primary big" onClick={() => void finalize()} disabled={busy}><Play size={18} />{busy ? t('Starting…') : t('Make final')}</button>
            <a className="btn" href={hashFor({page: 'ep', ep: id, step: 'script', ch})}>{t('Edit script')}</a>
            <a className="btn" href={hashFor({page: 'ep', ep: id, step: 'publish', ch})}>{t('Publish pack')}</a>
            <a className="btn ghost" href={hashFor({page: 'new', ch})}>{t('Make another')}</a>
          </div>
          {err && <p className="err-text" role="alert">{err}</p>}
        </div>)}
    </div>
  );
}
