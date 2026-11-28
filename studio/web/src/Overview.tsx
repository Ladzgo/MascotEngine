// Today page (file kept as Overview.tsx): first run = "Make your first video in 3 steps", otherwise Continue cards with each episode's next action.
import React from 'react';
import {Alert, Check, Play, Plus} from './icons';
import {readiness} from './Settings';
import {hashFor, nextStep, STEP_LABEL} from './router';
import {t} from './i18n';
import type {ChannelRow, Settings, Summary} from './api';

export const NewVideoButton = ({ch, className = ''}: {ch?: string; className?: string}) => <a className={`btn primary plus-btn ${className}`} href={hashFor({page: 'new', ch})}><Plus size={17} />{t('New video')}</a>;
const DONE_TEXT = (s: Summary) => (s.stages.final ? 'Final video is ready' : s.stages.preview ? 'Preview is ready; check it, then make the final' : s.stages.voice ? 'Voice is recorded; render a preview' : 'Script is written; record the voice');

export function Overview({ch, chans, eps, cfg}: {ch: string; chans: ChannelRow[]; eps: Summary[]; cfg: Settings | null; onChanged: () => void}) {
  const warn = cfg ? readiness(cfg, cfg.engine).filter(c => !c.ok) : [];
  const mine = eps.filter(e => !e.archived && (ch === 'all' || e.channel === ch));
  const latest = [...mine].reverse().slice(0, 6);
  const target = ch === 'all' ? undefined : ch;
  return (
    <div className="page">
      {warn.length > 0 && <div className="alert" role="alert"><Alert size={18} /><span>{t('Setup needed')}: {warn.map(w => w.fix).join(' ')}</span><a className="btn sm" href="#/settings">{t('Open Settings')}</a></div>}
      {!mine.length ? (
        <section className="panel hero" aria-labelledby="hero-h">
          <h1 id="hero-h" className="display" tabIndex={-1}>{t('Make your first video in 3 steps')}</h1>
          <ol className="hero-steps">
            <li><b>1. {t('Pick a topic')}</b><span className="small muted">{t('Type one, or let the Studio suggest ideas.')}</span></li>
            <li><b>2. {t('Choose Short or Long')}</b><span className="small muted">{t('And the voice you want to hear.')}</span></li>
            <li><b>3. {t('Press Make video')}</b><span className="small muted">{t('Script, voice and a preview, made for you in a few minutes.')}</span></li>
          </ol>
          <div><NewVideoButton ch={target} className="big" /></div>
          <p className="small muted">{chans.length ? `${t('Channel')}: ${chans.find(c => c.id === ch)?.name ?? chans[0].name}` : ''}</p>
        </section>
      ) : (
        <>
          <div className="page-head"><div><h1 className="display" tabIndex={-1}>{t('Today')}</h1><p className="muted">{t('Pick up where you left off, or start something new.')}</p></div><NewVideoButton ch={target} /></div>
          <div className="section-h"><h2 className="display">{t('Continue')}</h2><a className="link small" href={hashFor({page: 'library', ch})}>{t('See every episode')}</a></div>
          <ul className="continue">{latest.map(e => (
            <li key={e.id} className="panel">
              <b>{e.title}</b>
              <span className="small muted">{t(DONE_TEXT(e))}</span>
              <div className="row"><a className="btn primary sm" href={hashFor({page: 'ep', ep: e.id, step: nextStep(e), ch})}>{e.stages.final ? <Check size={15} /> : <Play size={15} />}{e.stages.final ? t('Open') : `${t('Next')}: ${t(STEP_LABEL[nextStep(e)])}`}</a></div>
            </li>))}</ul>
        </>
      )}
    </div>
  );
}
