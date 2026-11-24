import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Episode as EpisodeT} from './schema';
import type {EpisodeDecisions} from './director/types';
import type {Timings} from './pipeline/tts';
import type {CharacterAssets} from './character/Mascot';
import {BoilDefs} from './fx/boil';
import {Paper} from './fx/paper';
import {Captions, buildPhrases, type CaptionWord} from './fx/captions';
import {TRANSITION_FRAMES, TransitionLayer} from './fx/transitions';
import {SceneView} from './scenes/SceneView';
import {SourceCard} from './fx/overlays';
import {DISPLAY, INK, SANS, loadFonts, easeOut} from './theme';

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

export const EpisodeVideo: React.FC<EpisodeProps> = ({episode, timings, decisions, assets}) => {
  loadFonts();
  const g = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = useMemo(() => frameLayout(decisions, fps), [decisions, fps]);

  const sceneWordsRel = useMemo(() => decisions.scenes.map((d, i) => {
    const tm = timings.scenes[i];
    return tm.words.map(w => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart}));
  }), [decisions, timings]);

  const phrases = useMemo(() => buildPhrases(
    decisions.scenes.map((d, i): CaptionWord[] => sceneWordsRel[i].map(w => ({w: w.w, start: d.startSec + w.start, end: d.startSec + w.end}))),
  ), [decisions, sceneWordsRel]);

  // Everything that animates with time uses the frame relative to its chunk (scene), so a chunk looks the same wherever it sits in the video: the render cache survives edits that move later scenes.
  const base = chunkBase(L, g);
  const shift = base / fps;
  const phrasesLocal = useMemo(() => phrases.map(p => ({start: p.start - shift, end: p.end - shift, words: p.words.map(w => ({...w, start: w.start - shift, end: w.end - shift}))})), [phrases, shift]);

  const host0 = (() => { try { return new URL(episode.sources[0]).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const view = (i: number, frame: number, preroll = 0) => (
    <>
    {host0 && ['big_number', 'chart'].includes(episode.scenes[i].type) && <SourceCard host={host0} t={(frame + preroll) / fps} accent={decisions.accent === '' ? INK : accentHex(decisions.accent)} />}
    <SceneView scene={episode.scenes[i]} dec={decisions.scenes[i]} frame={frame} preroll={preroll} fps={fps} accent={decisions.accent === '' ? INK : accentHex(decisions.accent)}
      assets={assets} words={sceneWordsRel[i]} intro={decisions.intro} episodeTitle={episode.title} />
    </>
  );

  const accent = accentHex(decisions.accent);
  const totalScenes = decisions.scenes.length;
  const endStart = L.ends[totalScenes - 1];

  return (
    <AbsoluteFill>
      <BoilDefs frame={g - base} />
      <Paper variant={decisions.background} />
      {decisions.scenes.map((d, i) => (
        <Sequence key={i} from={L.froms[i]} durationInFrames={Math.max(1, L.ends[i] - L.froms[i])} layout="none">
          <SceneSeq paper={<Paper variant={decisions.background} />} i={i} T={L.ts[i]} start={L.starts[i]} prevLast={i > 0 ? L.froms[i] - L.starts[i - 1] - 1 : 0}
            kind={d.transition} accent={accent} view={view} />
        </Sequence>
      ))}
      <Captions phrases={phrasesLocal} t={(g - base) / fps} accent={accent} style={decisions.captionStyle} />
      {episode.disclaimer && (
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

const EndCard: React.FC<{episode: EpisodeT; accent: string}> = ({episode, accent}) => {
  const f = useCurrentFrame();
  const o = easeOut(f / 15);
  const hosts = [...new Set(episode.sources.map(s => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; } }))];
  return (
    <AbsoluteFill style={{background: '#f6f1e4', opacity: o, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 160}}>
      <div style={{fontFamily: DISPLAY, fontSize: 84, color: INK, lineHeight: 1.1}}>Educational content.<br />Not financial advice.</div>
      <div style={{width: 520, height: 12, background: accent, borderRadius: 6, margin: '44px 0'}} />
      {hosts.length > 0 && <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 38, color: INK, opacity: 0.8}}>Sources: {hosts.join(' · ')}</div>}
    </AbsoluteFill>
  );
};

import {ACCENT_HEX} from './accents';
const accentHex = (name: string) => ACCENT_HEX[name] ?? name;
