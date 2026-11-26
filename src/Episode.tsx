import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Episode as EpisodeT} from './schema';
import type {EpisodeDecisions} from './director/types';
import type {Timings} from './pipeline/tts';
import {ActingContext, type CharacterAssets} from './character/Mascot';
import {BoilDefs} from './fx/boil';
import {Paper} from './fx/paper';
import {Captions, buildPhrases, captionLayout, type CaptionWord} from './fx/captions';
import {TRANSITION_FRAMES, TransitionLayer} from './fx/transitions';
import {SceneView} from './scenes/SceneView';
import {ChapterTag, SourceCard} from './fx/overlays';
import {Camera, Living, ProgressBar, Vignette} from './fx/life';
import {FullBleedScene} from './fullbleed/FullBleedScene';
import {pickFbKind} from './fullbleed/shots';
import {PunchCaptions, buildPunchPhrases} from './fx/punch';
import {DISPLAY, INK, SANS, loadFonts, easeOut, spring, clamp} from './theme';

export type EpisodeProps = {
  episode: EpisodeT;
  timings: Timings;
  decisions: EpisodeDecisions;
  assets: CharacterAssets;
};

export const ENDCARD_FRAMES = 105;

export function frameLayout(decisions: EpisodeDecisions, fps: number) {
  const starts = decisions.scenes.map(s => Math.round(s.startSec * fps));
  const ts = decisions.scenes.map((s, i) => (i > 0 && s.transition !== 'cut' ? TRANSITION_FRAMES : 0));
  const froms = starts.map((s, i) => s - ts[i]);
  const last = decisions.scenes.length - 1;
  const ends = froms.map((_, i) => (i < last ? froms[i + 1] : Math.round((decisions.scenes[last].startSec + decisions.scenes[last].durSec) * fps)));
  return {starts, ts, froms, ends};
}

/** First frame of the render chunk (scene) that frame g belongs to; frames after the last scene belong to the end-card chunk. */
export function chunkBase(L: {froms: number[]; ends: number[]}, g: number): number {
  if (!L.froms.length) return 0;
  if (g >= L.ends[L.ends.length - 1]) return L.ends[L.ends.length - 1];
  let b = L.froms[0];
  for (const f of L.froms) if (f <= g) b = f;
  return b;
}

/** Index of the scene whose chunk frame g belongs to. */
const sceneAt = (L: {froms: number[]}, g: number) => { let k = 0; L.froms.forEach((f, i) => { if (f <= g) k = i; }); return k; };

export const EpisodeVideo: React.FC<EpisodeProps> = ({episode, timings, decisions, assets}) => {
  loadFonts();
  const g = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const fullbleed = episode.look === 'fullbleed';
  const L = useMemo(() => frameLayout(decisions, fps), [decisions, fps]);

  const sceneWordsRel = useMemo(() => decisions.scenes.map((d, i) => {
    const tm = timings.scenes[i];
    return tm.words.map(w => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart}));
  }), [decisions, timings]);

  const phrases = useMemo(() => (fullbleed ? buildPunchPhrases : buildPhrases)(
    decisions.scenes.map((d, i): CaptionWord[] => sceneWordsRel[i].map(w => ({w: w.w, start: d.startSec + w.start, end: d.startSec + w.end}))),
  ), [decisions, sceneWordsRel, fullbleed]);

  // Everything that animates with time uses the frame relative to its chunk (scene), so a chunk looks the same wherever it sits in the video: the render cache survives edits that move later scenes.
  const base = chunkBase(L, g);
  const shift = base / fps;
  const phrasesLocal = useMemo(() => phrases.map(p => ({start: p.start - shift, end: p.end - shift, words: p.words.map(w => ({...w, start: w.start - shift, end: w.end - shift}))})), [phrases, shift]);

  const host0 = (() => { try { return new URL(episode.sources[0]).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const acc = (i: number) => (decisions.accent === '' ? (episode.look === 'fullbleed' ? '#ff5a36' : INK) : accentHex(decisions.accent));
  const view = (i: number, frame: number, preroll = 0) => fullbleed ? (
    <FullBleedScene scene={episode.scenes[i]} dec={decisions.scenes[i]} frame={frame} fps={fps} accent={acc(i)} w={width} h={height} words={sceneWordsRel[i]} index={i} episodeTitle={episode.title} prevKind={i > 0 ? pickFbKind(episode.scenes[i - 1], sceneWordsRel[i - 1], decisions.scenes[i - 1].durSec, i - 1) : undefined} preroll={preroll} />
  ) : (
    <>
    <Living frame={frame + preroll} seed={i} accent={acc(i)} />
    <Camera frame={frame + preroll} seed={i}>
      {host0 && ['big_number', 'chart'].includes(episode.scenes[i].type) && <SourceCard host={host0} t={(frame + preroll) / fps} accent={acc(i)} />}
      {episode.scenes[i].chapter && <ChapterTag title={episode.scenes[i].chapter!} t={(frame + preroll) / fps} accent={acc(i)} />}
      <ActingContext.Provider value={{words: sceneWordsRel[i], emphasis: episode.scenes[i].emphasis, big: episode.scenes[i].type === 'big_number', fps}}>
        <SceneView scene={episode.scenes[i]} dec={decisions.scenes[i]} frame={frame} preroll={preroll} fps={fps} accent={acc(i)}
          assets={assets} words={sceneWordsRel[i]} intro={decisions.intro} episodeTitle={episode.title} />
      </ActingContext.Provider>
    </Camera>
    </>
  );

  const cap = captionLayout(decisions.captions, 'wide');
  const accent = decisions.accent === '' && fullbleed ? '#ff5a36' : accentHex(decisions.accent);
  const totalScenes = decisions.scenes.length;
  const endStart = L.ends[totalScenes - 1];

  return (
    <AbsoluteFill>
      <BoilDefs frame={g - base} />
      {!fullbleed && <Paper variant={decisions.background} />}
      {decisions.scenes.map((d, i) => (
        <Sequence key={i} from={L.froms[i]} durationInFrames={Math.max(1, L.ends[i] - L.froms[i])} layout="none">
          <SceneSeq paper={fullbleed ? <div style={{position: 'absolute', inset: 0, background: '#12142a'}} /> : <Paper variant={decisions.background} />} i={i} T={L.ts[i]} start={L.starts[i]} prevLast={i > 0 ? L.froms[i] - L.starts[i - 1] - 1 : 0}
            kind={d.transition} accent={accent} view={view} />
        </Sequence>
      ))}
      {!fullbleed && <Vignette />}
      {!fullbleed && g < endStart && <ProgressBar index={sceneAt(L, g)} count={totalScenes} p={(g - base) / Math.max(1, L.ends[sceneAt(L, g)] - L.froms[sceneAt(L, g)])} accent={accent} />}
      {fullbleed ? <PunchCaptions phrases={phrasesLocal} t={(g - base) / fps} accent={accent} w={width} h={height} punch={episode.scenes[sceneAt(L, g)].type !== 'big_number'} /> : <Captions phrases={phrasesLocal} t={(g - base) / fps} accent={accent} style={decisions.captionStyle} {...cap} bottom={cap.offset} highlight={decisions.captions?.highlight} />}
      {episode.disclaimer && episode.format !== 'short' && (
        <Sequence from={endStart} durationInFrames={ENDCARD_FRAMES} layout="none">
          <EndCard episode={episode} accent={accent} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

const SceneSeq: React.FC<{paper: React.ReactNode; i: number; T: number; start: number; prevLast: number; kind: string; accent: string; view: (i: number, f: number, preroll?: number) => React.ReactNode}> = ({paper, i, T, prevLast, kind, accent, view}) => {
  const f = useCurrentFrame(); // local to this sequence
  const own = f - T;
  if (T > 0 && f < T) {
    return <TransitionLayer kind={kind} p={f / T} prev={view(i - 1, prevLast)} cur={view(i, f - T, T)} accent={accent} paper={paper} />;
  }
  return <>{view(i, own, T)}</>;
};

/** Subscribe button: pops in, a cursor taps it, it flips to "Subscribed" and the bell rings. */
const Subscribe: React.FC<{f: number}> = ({f}) => {
  const e = spring(f / 14);
  if (f <= 0) return null;
  const done = f > 40;
  const tap = f > 34 && f < 42 ? 0.94 : 1;
  const ring = done ? Math.sin((f - 40) * 1.1) * 18 * Math.exp(-(f - 40) / 18) : 0;
  const cur = clamp((f - 12) / 22);
  return (
    <div style={{marginTop: 56, display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${e * tap})`, position: 'relative'}}>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 46, padding: '18px 0', width: 400, textAlign: 'center', borderRadius: 16, border: `5px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, color: done ? INK : '#fff', background: done ? '#e4dfd0' : '#d9363e'}}>{done ? 'Subscribed' : 'Subscribe'}</div>
      <svg width={70} height={70} viewBox="0 0 100 100" style={{transform: `rotate(${ring}deg)`, transformOrigin: '50% 10%'}} fill={done ? accentFill : 'none'} stroke={INK} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round">
        <path d="M50 10c-18 0-28 14-28 32v16l-10 14h76l-10-14V42C78 24 68 10 50 10zM40 84a10 10 0 0 0 20 0" />
      </svg>
      <svg width={54} height={54} viewBox="0 0 100 100" style={{position: 'absolute', left: 150 + (1 - easeOut(cur)) * 140, top: 30 + (1 - easeOut(cur)) * 100, opacity: f < 50 ? 1 : 0}}><path d="M20 10 20 80 40 64 54 92 68 86 54 58 80 56Z" fill="#fff" stroke={INK} strokeWidth={6} strokeLinejoin="round" /></svg>
    </div>
  );
};
const accentFill = '#e8c25a';

const EndCard: React.FC<{episode: EpisodeT; accent: string}> = ({episode, accent}) => {
  const f = useCurrentFrame();
  const o = easeOut(f / 15);
  const hosts = [...new Set(episode.sources.map(s => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; } }))];
  return (
    <AbsoluteFill style={{background: '#f6f1e4', opacity: o, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 160}}>
      <div style={{fontFamily: DISPLAY, fontSize: 84, color: INK, lineHeight: 1.1}}>Educational content.<br />Not financial advice.</div>
      <div style={{width: 520, height: 12, background: accent, borderRadius: 6, margin: '44px 0'}} />
      {hosts.length > 0 && <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 38, color: INK, opacity: 0.8}}>Sources: {hosts.join(' · ')}</div>}
      <Subscribe f={f - 22} />
    </AbsoluteFill>
  );
};

import {ACCENT_HEX} from './accents';
const accentHex = (name: string) => ACCENT_HEX[name] ?? name;
