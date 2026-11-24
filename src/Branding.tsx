import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DISPLAY, INK, SANS, loadFonts, spring} from './theme';

export type Branding = {
  name: string; handle?: string; cta?: string; outroSec: number; watermark: boolean;
  accent: string;        // hex
  image?: string;        // data: URI of channels/<id>/watermark.png
};

/** Small corner mark, kept below the Shorts header and clear of the right-hand button column. */
export const Watermark: React.FC<{b: Branding}> = ({b}) => {
  loadFonts();
  const label = b.handle ?? b.name;
  return (
    <div style={{position: 'absolute', left: 48, top: 210, display: 'flex', alignItems: 'center', gap: 14, opacity: 0.85}}>
      {b.image && <img src={b.image} style={{height: 64, width: 'auto'}} />}
      <span style={{fontFamily: DISPLAY, fontSize: 38, color: '#fff', WebkitTextStroke: '8px #000', paintOrder: 'stroke fill', textShadow: '0 4px 0 rgba(0,0,0,0.5)'}}>{label}</span>
    </div>
  );
};

/** End-screen card: dim backdrop, call to action, handle. `progress` 0..1 drives the entrance (stills use 1). */
export const CtaCard: React.FC<{b: Branding; progress?: number}> = ({b, progress = 1}) => {
  loadFonts();
  const p = spring(progress);
  return (
    <AbsoluteFill style={{background: `rgba(27,27,31,${0.82 * Math.min(1, progress * 3)})`, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `translateY(${(1 - p) * 60}px) scale(${0.92 + 0.08 * p})`, opacity: Math.min(1, progress * 3), textAlign: 'center', width: 900}}>
        {b.image && <img src={b.image} style={{height: 160, width: 'auto', marginBottom: 36}} />}
        <div style={{fontFamily: DISPLAY, fontSize: 96, lineHeight: 1.05, color: '#fff', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill'}}>{b.cta ?? 'Follow for more'}</div>
        <div style={{height: 14, width: 420, background: b.accent, borderRadius: 7, margin: '40px auto'}} />
        <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 54, color: '#f6f1e4', letterSpacing: 1}}>{b.handle ?? b.name}</div>
      </div>
    </AbsoluteFill>
  );
};

/** One transparent full-frame layer as a still (clipper overlays them with ffmpeg). */
export const BrandLayer: React.FC<{b: Branding; layer: 'watermark' | 'cta'}> = ({b, layer}) =>
  layer === 'cta' ? <CtaCard b={b} /> : <AbsoluteFill><Watermark b={b} /></AbsoluteFill>;
void INK;
