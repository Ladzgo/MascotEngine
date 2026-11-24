import React from 'react';
import {INK, W, clamp, easeInOut, easeOut} from '../theme';

export const TRANSITION_FRAMES = 12;

/** Wraps previous (frozen last frame) and current scene layers; p in [0,1]. */
export const TransitionLayer: React.FC<{kind: string; p: number; prev: React.ReactNode; cur: React.ReactNode; accent: string; paper: React.ReactNode}> = ({kind, p, prev: prev0, cur: cur0, accent, paper}) => {
  const prev = <>{paper}{prev0}</>;
  const cur = <>{paper}{cur0}</>;
  const fill: React.CSSProperties = {position: 'absolute', inset: 0};
  const e = easeInOut(p);
  switch (kind) {
    case 'slide':
      return <>
        <div style={{...fill, transform: `translateX(${-e * W * 0.35}px)`, opacity: 1 - e * 0.6}}>{prev}</div>
        <div style={{...fill, transform: `translateX(${(1 - easeOut(p)) * W}px)`}}>{cur}</div>
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
        <div style={{...fill, transform: `scale(${1 + e * 2.2})`, opacity: 1 - clamp(p * 1.6)}}>{prev}</div>
        <div style={{...fill, transform: `scale(${0.6 + 0.4 * e})`, opacity: clamp((p - 0.25) * 1.6)}}>{cur}</div>
      </>;
    case 'paper_flip': {
      const first = p < 0.5;
      const a = first ? p * 2 * 90 : -(1 - (p - 0.5) * 2) * 90;
      return <div style={{...fill, perspective: 1800}}>
        <div style={{...fill, transform: `rotateY(${a}deg)`, transformOrigin: first ? '0% 50%' : '100% 50%'}}>{first ? prev : cur}</div>
      </div>;
    }
    default:
      return <>{cur}</>;
  }
};
