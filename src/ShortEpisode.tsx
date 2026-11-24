import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {EpisodeProps} from './Episode';
import {BoilDefs} from './fx/boil';
import {Paper} from './fx/paper';
import {Captions, buildPhrases, captionLayout} from './fx/captions';
import {SceneView, type Place} from './scenes/SceneView';
import {ACCENT_HEX} from './accents';
import {CtaCard, Watermark, type Branding} from './Branding';
import {H, INK, W, clamp, easeInOut, easeOut, loadFonts} from './theme';

export const SHORT_W = 1080;
export const SHORT_H = 1920;
const K = 0.75; // scene content is authored for ~1440px-wide canvases; render it virtual and scale down
const VW = SHORT_W / K;
const VH = SHORT_H / K;
// Vertical layout (virtual px): scene content on top, mascot below, captions in the lower safe zone.
const PLACE: Place = {char: {cx: VW / 2, h: 760}, content: {x: 70, y: 150, w: VW - 140, h: 900}};
const FLOOR = 1590;

export type ShortProps = EpisodeProps & {sceneIndexes: number[]; branding?: Branding | null};
export const outroFrames = (b: Branding | null | undefined, fps: number) => (b && b.outroSec > 0 ? Math.round(b.outroSec * fps) : 0);
const END_FADE = 9; // frames: ease to paper at the end and from paper at the start, so the loop reads as one continuous beat
const START_VEIL = 5;

const ShortScene: React.FC<ShortProps & {sceneIndex: number}> = ({episode, timings, decisions, assets, sceneIndex}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = decisions.scenes[sceneIndex];
  const tm = timings.scenes[sceneIndex];
  const words = tm.words.map(w => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart}));
  const phrases = buildPhrases([words]);
  const accent = ACCENT_HEX[decisions.accent] ?? decisions.accent;
  const scene = episode.scenes[sceneIndex];
  const cap = captionLayout(decisions.captions, 'short');
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: VW, height: VH, transform: `scale(${K})`, transformOrigin: '0 0'}}>
        <SceneView scene={scene} dec={d} frame={f} fps={fps} accent={decisions.accent === '' ? INK : accent} assets={assets} words={words}
          intro={decisions.intro} episodeTitle={episode.title} place={PLACE} floor={FLOOR} />
      </div>
      <Captions phrases={phrases} t={f / fps} accent={accent} style={decisions.captionStyle} size={cap.size} anchor={cap.anchor} bottom={cap.offset} maxWidth={cap.maxWidth} highlight={decisions.captions?.highlight} />
    </AbsoluteFill>
  );
};

export const shortFrames = (p: {decisions: ShortProps['decisions']; sceneIndexes: number[]}, fps: number) =>
  p.sceneIndexes.map(i => Math.max(1, Math.round(p.decisions.scenes[i].durSec * fps)));

/** Hook scene first, then the best scene(s), as one vertical clip. */
export const ShortVideo: React.FC<ShortProps> = props => {
  loadFonts();
  const g = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const lens = shortFrames(props, fps);
  let at = 0;
  return (
    <AbsoluteFill>
      <BoilDefs frame={g} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${SHORT_H / H})`, transformOrigin: '0 0'}}><Paper variant={props.decisions.background} /></div>
      {props.sceneIndexes.map((si, k) => { const from = at; at += lens[k]; return (
        <Sequence key={k} from={from} durationInFrames={lens[k]}><ShortScene {...props} sceneIndex={si} /></Sequence>); })}
      {props.branding?.watermark && <Watermark b={props.branding} />}
      {outroFrames(props.branding, fps) > 0 && <Sequence from={at} durationInFrames={outroFrames(props.branding, fps)}><CtaCard b={props.branding!} progress={Math.min(1, (g - at) / 12)} /></Sequence>}
      <AbsoluteFill style={{background: '#f6f1e4', opacity: Math.max(easeInOut(clamp((g - (durationInFrames - END_FADE)) / END_FADE)), 1 - easeOut(clamp(g / START_VEIL))), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
