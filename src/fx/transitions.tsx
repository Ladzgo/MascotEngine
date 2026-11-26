import React from 'react';
import {useVideoConfig} from 'remotion';
import {INK, clamp, easeInOut, easeOut} from '../theme';

export const TRANSITION_FRAMES = 12;

/** Warm light leak: a soft orange/pink glow sweeping across, peaking mid transition. */
const Leak: React.FC<{p: number}> = ({p}) => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', opacity: Math.sin(Math.PI * p) * 0.85,
    background: `radial-gradient(ellipse 60% 90% at ${20 + p * 70}% 40%, rgba(255,190,90,0.95), rgba(255,120,120,0.45) 45%, rgba(255,255,255,0) 75%)`}} />
);

/** Wraps previous (frozen last frame) and current scene layers; p in [0,1]. */
export const TransitionLayer: React.FC<{kind: string; p: number; prev: React.ReactNode; cur: React.ReactNode; accent: string; paper: React.ReactNode}> = ({kind, p, prev: prev0, cur: cur0, accent, paper}) => {
  const W = useVideoConfig().width; // 1920 wide, 1080 for native Shorts
  const prev = <>{paper}{prev0}</>;
  const cur = <>{paper}{cur0}</>;
  const fill: React.CSSProperties = {position: 'absolute', inset: 0};
  const e = easeInOut(p);
  const mb = Math.sin(Math.PI * p) ** 1.5; // motion-blur strength: peaks mid-move
  switch (kind) {
    case 'slide':
      return <>
        <div style={{position: 'absolute', inset: 0}}>{paper}</div>
        <div style={{...fill, transform: `translateX(${-e * W * 0.35}px) scale(${1 - e * 0.04})`, opacity: 1 - e * 0.6, filter: `blur(${mb * 10}px)`}}>{prev}</div>
        <div style={{...fill, transform: `translateX(${(1 - easeOut(p)) * W}px) skewX(${-(1 - easeOut(p)) * 6}deg)`, filter: `blur(${(1 - easeOut(p)) * 12}px)`}}>{cur}</div>
      </>;
    case 'wipe_ink':
      return <>
        <div style={fill}>{prev}</div>
        <div style={{...fill, clipPath: `inset(0 ${(1 - e) * 100}% 0 0)`}}>{cur}</div>
        <div style={{position: 'absolute', top: 0, bottom: 0, width: 26, left: `${e * 100}%`, marginLeft: -13, background: INK, opacity: p > 0.02 && p < 0.98 ? 1 : 0, borderRadius: 13}} />
      </>;
    case 'circle_reveal':
      return <>
        <div style={fill}>{prev}</div>
        <div style={{...fill, clipPath: `circle(${easeOut(p) * 1250}px at 50% 50%)`}}>{cur}</div>
        <div style={{...fill, borderRadius: '50%', border: `10px solid ${accent}`, width: easeOut(p) * 2500, height: easeOut(p) * 2500, left: '50%', top: '50%', inset: 'auto',
          transform: 'translate(-50%,-50%)', marginLeft: 0, opacity: p < 0.95 ? 0.9 : 0}} />
      </>;
    case 'zoom_through':
      return <>
        <div style={{...fill, transform: `scale(${1 + e * 2.2})`, opacity: 1 - clamp(p * 1.6), filter: `blur(${mb * 14}px)`}}>{prev}</div>
        <div style={{...fill, transform: `scale(${0.6 + 0.4 * e})`, opacity: clamp((p - 0.25) * 1.6), filter: `blur(${(1 - e) * 10}px)`}}>{cur}</div>
        <Leak p={p} />
      </>;
    case 'paper_flip': {
      const first = p < 0.5;
      const a = first ? p * 2 * 90 : -(1 - (p - 0.5) * 2) * 90;
      return <div style={{...fill, perspective: 1800}}>
        <div style={{...fill, transform: `rotateY(${a}deg)`, transformOrigin: first ? '0% 50%' : '100% 50%'}}>{first ? prev : cur}</div>
      </div>;
    }
    case 'whip': // fast horizontal whip pan: both scenes smear sideways
      return <>
        <div style={{position: 'absolute', inset: 0}}>{paper}</div>
        <div style={{...fill, transform: `translateX(${-easeInOut(Math.min(1, p * 1.4)) * W * 0.9}px)`, filter: `blur(${mb * 26}px)`, opacity: 1 - clamp(p * 1.6 - 0.2)}}>{prev}</div>
        <div style={{...fill, transform: `translateX(${(1 - easeInOut(Math.max(0, p * 1.4 - 0.4))) * W * 0.9}px)`, filter: `blur(${mb * 26}px)`}}>{cur}</div>
      </>;
    case 'light_leak': // crossfade through a warm light leak
      return <>
        <div style={{...fill, opacity: 1 - clamp(p * 2 - 0.5)}}>{prev}</div>
        <div style={{...fill, opacity: clamp(p * 2 - 0.5)}}>{cur}</div>
        <Leak p={p} />
      </>;
    case 'tear': { // torn paper edge sweeps diagonally and reveals the next scene
      const x = -10 + e * 130;
      const pts = Array.from({length: 13}, (_, k) => `${x + ((k * 37) % 7) - 3 - (k / 12) * 22}% ${(k / 12) * 100}%`);
      const poly = `polygon(0 0, ${pts.join(', ')}, 0 100%)`;
      return <>
        <div style={fill}>{prev}</div>
        <div style={{...fill, clipPath: poly, filter: 'drop-shadow(6px 0 0 rgba(27,27,31,0.35))'}}>{cur}</div>
      </>;
    }
    default:
      return <>{cur}</>;
  }
};
