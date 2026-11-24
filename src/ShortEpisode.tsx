import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {EpisodeProps} from './Episode';
import {BoilDefs} from './fx/boil';
import {Paper} from './fx/paper';
import {Captions, buildPhrases} from './fx/captions';
import {SceneView, type Place} from './scenes/SceneView';
import {ACCENT_HEX} from './accents';
import {H, INK, W, loadFonts} from './theme';

export const SHORT_W = 1080;
export const SHORT_H = 1920;
const K = 0.75; // scene content is authored for ~1440px-wide canvases; render it virtual and scale down
const VW = SHORT_W / K;
const VH = SHORT_H / K;
// Vertical layout (virtual px): scene content on top, mascot below, captions in the lower safe zone.
const PLACE: Place = {char: {cx: VW / 2, h: 760}, content: {x: 70, y: 150, w: VW - 140, h: 900}};
const FLOOR = 1590;
const CAPTION_BOTTOM = 380; // real px; keeps clear of Shorts UI

export type ShortProps = EpisodeProps & {sceneIndexes: number[]};
const END_FADE = 9; // frames: fade to paper so the loop back to the hook reads as a cut, not a jump

const ShortScene: React.FC<ShortProps & {sceneIndex: number}> = ({episode, timings, decisions, assets, sceneIndex}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = decisions.scenes[sceneIndex];
  const tm = timings.scenes[sceneIndex];
  const words = tm.words.map(w => ({w: w.w, start: w.start - tm.start + d.speechStart, end: w.end - tm.start + d.speechStart}));
  const phrases = buildPhrases([words]);
  const accent = ACCENT_HEX[decisions.accent] ?? decisions.accent;
  const scene = episode.scenes[sceneIndex];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: VW, height: VH, transform: `scale(${K})`, transformOrigin: '0 0'}}>
        <SceneView scene={scene} dec={d} frame={f} fps={fps} accent={decisions.accent === '' ? INK : accent} assets={assets} words={words}
          intro={decisions.intro} episodeTitle={episode.title} place={PLACE} floor={FLOOR} />
      </div>
      <Captions phrases={phrases} t={f / fps} accent={accent} style={decisions.captionStyle} size={76} bottom={CAPTION_BOTTOM} maxWidth={SHORT_W - 140} />
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
      <AbsoluteFill style={{background: '#f6f1e4', opacity: Math.max(0, (g - (durationInFrames - END_FADE)) / END_FADE), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
