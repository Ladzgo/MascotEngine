import React from 'react';
import {DISPLAY, INK, SANS, clamp, easeOut} from '../theme';

const CARD: React.CSSProperties = {background: '#fffdf6', border: `5px solid ${INK}`, borderRadius: 18, boxShadow: `6px 6px 0 ${INK}`};

/** Source tag: names where a number comes from (host only), slides in from the right (top-right corner stays clear of axes and the mascot) after `at` seconds. */
export const SourceCard: React.FC<{host: string; t: number; at?: number; accent: string}> = ({host, t, at = 0.9, accent}) => {
  const e = easeOut((t - at) / 0.4);
  if (e <= 0) return null;
  return (
    <div style={{position: 'absolute', right: 80, top: 24, ...CARD, padding: '10px 24px', opacity: e, transform: `translateX(${(1 - e) * 60}px)`, display: 'flex', alignItems: 'center', gap: 16}}>
      <div style={{width: 18, height: 18, borderRadius: '50%', background: accent, border: `3px solid ${INK}`}} />
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 30, color: INK}}>Source: {host}</div>
    </div>
  );
};

/** Quote card: a short pulled line with an attribution; enters with the shared ease. */
export const QuoteCard: React.FC<{text: string; by?: string; t: number; at?: number; accent: string; width?: number}> = ({text, by, t, at = 0, accent, width = 1100}) => {
  const e = easeOut((t - at) / 0.5);
  if (e <= 0) return null;
  return (
    <div style={{position: 'absolute', left: (1920 - width) / 2, top: 280, width, ...CARD, padding: '44px 64px', opacity: clamp(e * 1.5), transform: `translateY(${(1 - e) * 40}px) rotate(${(1 - e) * -1.5}deg)`}}>
      <div style={{fontFamily: DISPLAY, fontSize: 120, lineHeight: 0.6, color: accent}}>&ldquo;</div>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 56, lineHeight: 1.2, color: INK}}>{text}</div>
      {by && <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 32, color: INK, opacity: 0.7, marginTop: 24}}>{by}</div>}
    </div>
  );
};
