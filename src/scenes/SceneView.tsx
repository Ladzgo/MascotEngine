import React from 'react';
import {Img, staticFile} from 'remotion';
import type {Scene} from '../schema';
import type {SceneDecision} from '../director/types';
import {Mascot, type CharacterAssets} from '../character/Mascot';
import {BOIL_STYLE} from '../fx/boil';
import {CAPTION_ZONE_TOP, clamp, easeInOut, easeOut} from '../theme';
import {SceneContent, type Box} from './scenes';
import {Doodles} from '../fx/doodles';

export type Place = {char?: {cx: number; h: number}; content: Box};
const FLOOR = CAPTION_ZONE_TOP - 44; // character feet line (886): bob (+6) stays above y=902, clear of the caption bar

export function placement(layout: string, type: string): Place {
  const c = (x: number, y: number, w: number, h: number): Box => ({x, y, w, h});
  switch (`${type}:${layout}`) {
    case 'title:center': return {char: {cx: 960, h: 500}, content: c(260, 70, 1400, 380)};
    case 'title:closeup': return {char: {cx: 1400, h: 960}, content: c(140, 200, 1000, 520)};
    case 'talk:center': return {char: {cx: 960, h: 780}, content: c(0, 0, 0, 0)};
    case 'talk:keyword_side': return {char: {cx: 460, h: 740}, content: c(900, 240, 900, 420)};
    case 'talk:closeup': return {char: {cx: 960, h: 960}, content: c(0, 0, 0, 0)};
    case 'talk:over_shoulder': return {char: {cx: 1450, h: 960}, content: c(110, 260, 900, 420)};
    case 'big_number:center': return {char: {cx: 1640, h: 480}, content: c(100, 90, 1340, 780)};
    case 'big_number:char_left': return {char: {cx: 360, h: 660}, content: c(660, 90, 1160, 790)};
    case 'big_number:char_right': return {char: {cx: 1560, h: 660}, content: c(100, 90, 1160, 790)};
    case 'chart:char_left': return {char: {cx: 340, h: 640}, content: c(620, 70, 1220, 830)};
    case 'chart:char_right': return {char: {cx: 1580, h: 640}, content: c(80, 70, 1240, 830)};
    case 'chart:char_corner': return {char: {cx: 1680, h: 400}, content: c(90, 70, 1440, 830)};
    case 'chart:fullscreen': return {content: c(120, 70, 1680, 830)};
    case 'compare:split': return {char: {cx: 960, h: 300}, content: c(100, 80, 1720, 820)};
    case 'compare:split_char_center': return {char: {cx: 960, h: 500}, content: c(80, 80, 1760, 820)};
    case 'list:char_left': return {char: {cx: 340, h: 640}, content: c(620, 80, 1220, 820)};
    case 'list:char_right': return {char: {cx: 1580, h: 640}, content: c(100, 80, 1200, 820)};
    case 'list:center_list': return {char: {cx: 330, h: 600}, content: c(580, 70, 1260, 830)};
    default: return {char: {cx: 960, h: 700}, content: c(160, 80, 1600, 800)};
  }
}

const ART_OPACITY = 0.4;
const SAFE_X = 80, SAFE_TOP = 30, SAFE_BOTTOM = 902; // 1920x1080 safe frame for content + character

/** Union of content box and character box (character art width is 0.8*h, centred on cx), feet at `floor`. */
function layoutBounds(place: Place, floor: number) {
  const bs: {x0: number; x1: number; y0: number; y1: number}[] = [];
  if (place.content.w > 0) bs.push({x0: place.content.x, x1: place.content.x + place.content.w, y0: place.content.y, y1: place.content.y + place.content.h});
  if (place.char) bs.push({x0: place.char.cx - place.char.h * 0.4, x1: place.char.cx + place.char.h * 0.4, y0: floor - place.char.h, y1: floor});
  if (!bs.length) return null;
  return {x0: Math.min(...bs.map(b => b.x0)), x1: Math.max(...bs.map(b => b.x1)), y0: Math.min(...bs.map(b => b.y0)), y1: Math.max(...bs.map(b => b.y1))};
}

export function cameraStyle(dec: SceneDecision, frame: number, fps: number, place?: Place, floor = FLOOR): React.CSSProperties {
  const dur = Math.max(1, dec.durSec * fps);
  const p = easeInOut(frame / dur); // eased, so camera moves start and settle softly
  const t = frame / fps;
  let scale = 1, tx = 0, ty = 0;
  switch (dec.camera) {
    case 'slow_push': scale = 1 + 0.05 * p; break;
    case 'slow_pull': scale = 1.05 - 0.05 * p; break;
    case 'pan_left': scale = 1.06; tx = -45 * (p - 0.5) * 2; break;
    case 'pan_right': scale = 1.06; tx = 45 * (p - 0.5) * 2; break;
    case 'drift': scale = 1.04; tx = Math.sin(t * 0.6) * 22; ty = Math.cos(t * 0.45) * 14; break;
  }
  for (const pi of dec.punchIns) {
    const u = (t - pi.t) / pi.dur;
    if (u < 0 || u > 1) continue;
    const env = u < 0.18 ? easeOut(u / 0.18) : 1 - easeInOut((u - 0.18) / 0.82);
    scale *= 1 + (pi.scale - 1) * env;
  }
  const b = place && layoutBounds(place, floor);
  if (!b) return {transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '50% 45%'};
  // Zoom about the layout itself and clamp it so nothing leaves the safe frame (a tall closeup character may still bleed off the top; its feet stay put).
  const ox = (b.x0 + b.x1) / 2;
  const tall = b.y0 < SAFE_TOP;
  const oy = tall ? b.y1 : (b.y0 + b.y1) / 2;
  const availX = Math.max(1, 1920 - 2 * SAFE_X - 2 * Math.abs(tx));
  let max = Math.min(availX / Math.max(1, b.x1 - b.x0), (ox - SAFE_X - Math.abs(tx)) / Math.max(1, ox - b.x0), (1920 - SAFE_X - Math.abs(tx) - ox) / Math.max(1, b.x1 - ox));
  if (!tall) max = Math.min(max, (oy - SAFE_TOP) / Math.max(1, oy - b.y0), (SAFE_BOTTOM - Math.abs(ty) - oy) / Math.max(1, b.y1 - oy));
  else max = Math.min(max, (SAFE_BOTTOM - oy) / Math.max(1, b.y1 - oy));
  scale = Math.max(1, Math.min(scale, max));
  return {transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: `${ox}px ${oy}px`};
}

export const SceneView: React.FC<{
  scene: Scene; dec: SceneDecision; frame: number; fps: number; accent: string; assets: CharacterAssets;
  words: {start: number; end: number}[]; intro: string; episodeTitle: string; preroll?: number;
  /** Override placement (vertical Shorts) and the character's feet line. */
  place?: Place; floor?: number;
}> = ({scene, dec, frame, fps, accent, assets, words, intro, episodeTitle, preroll = 0, place: placeOverride, floor = FLOOR}) => {
  const place = placeOverride ?? placement(dec.layout, dec.type);
  const t = frame / fps;
  // directional poses must point toward the content, whichever side the director put the character on
  const contentMid = place.content.x + place.content.w / 2;
  const toward = place.content.w > 0 && place.char ? (contentMid > place.char.cx ? 'right' : 'left') : null;
  const poseDir = dec.pose === 'explain_right' ? 'right' : dec.pose === 'explain_left' ? 'left' : null;
  const flip = !!toward && !!poseDir && poseDir !== toward;
  const talking = words.some(w => t >= w.start && t <= w.end);
  // callout word: first emphasis word, else a number, else the longest content word (never a stopword tail like "or two")
  const keyword = scene.emphasis[0] ?? (() => {
    const ws = scene.narration.replace(/[.!?,;:"]/g, '').split(/\s+/).filter(Boolean);
    return ws.find(w => /\d/.test(w)) ?? [...ws].sort((a, b) => b.length - a.length)[0] ?? '';
  })();
  return (
    <>
    {scene.art && (
      // low-contrast backdrop: behind camera/boil/content, never behind captions (those are drawn above all scenes)
      <Img src={staticFile(scene.art)} style={{position: 'absolute', inset: 0, width: 1920, height: 1080, objectFit: 'cover', opacity: ART_OPACITY * clamp((frame + preroll) / 10)}} />
    )}
    {!placeOverride && <Doodles text={`${scene.narration} ${scene.emphasis.join(' ')}`} accent={accent} frame={frame + preroll} bounds={place.char ? {x0: place.char.cx - place.char.h * 0.4, x1: place.char.cx + place.char.h * 0.4, y0: floor - place.char.h, y1: floor} : null} />}
    <div style={{position: 'absolute', inset: 0, ...cameraStyle(dec, frame, fps, placeOverride ? undefined : place, floor)}}>
      <div style={{position: 'absolute', inset: 0, ...BOIL_STYLE}}>
        <SceneContent scene={scene} dec={dec} frame={frame} fps={fps} accent={accent} box={place.content} intro={intro} episodeTitle={episodeTitle} keyword={keyword} />
      </div>
      {place.char && (
        <div style={{position: 'absolute', left: place.char.cx - place.char.h * 0.4, top: floor - place.char.h}}>
          <Mascot pose={dec.pose} talking={talking} accent={accent} frame={frame} height={place.char.h} assets={assets} flip={flip} enter={clamp((frame + preroll) / 14)} />
        </div>
      )}
    </div>
    </>
  );
};
