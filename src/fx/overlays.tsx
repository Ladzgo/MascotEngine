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

/** Chapter divider: tag at the top-left that slides in at the start of a section and out again after about 2.6 s. */
export const ChapterTag: React.FC<{title: string; t: number; accent: string}> = ({title, t, accent}) => {
  const e = easeOut((t - 0.15) / 0.4) * (1 - easeOut((t - 2.6) / 0.4));
  if (e <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: 80, top: 24, ...CARD, padding: '10px 28px 10px 20px', opacity: e, transform: `translateX(${(1 - e) * -80}px) rotate(${-1.2 * e}deg)`, display: 'flex', alignItems: 'center', gap: 16, background: '#fff6d6'}}>
      <svg width={26} height={34} viewBox="0 0 26 34" aria-hidden><path d="M2 2h22v30l-11-8-11 8z" fill={accent === INK ? '#e8c25a' : accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" /></svg>
      <div><div style={{fontFamily: SANS, fontWeight: 700, fontSize: 18, letterSpacing: 4, color: INK, opacity: 0.55}}>CHAPTER</div><div style={{fontFamily: SANS, fontWeight: 700, fontSize: 34, color: INK, lineHeight: 1.05}}>{title}</div></div>
    </div>
  );
};

/** Quote card: a short pulled line with an attribution; enters with the shared ease. */
export const QuoteCard: React.FC<{text: string; by?: string; t: number; at?: number; accent: string; width?: number; x?: number; y?: number}> = ({text, by, t, at = 0, accent, width = 1100, x = (1920 - width) / 2, y = 280}) => {
  const e = easeOut((t - at) / 0.5);
  if (e <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width, ...CARD, padding: width < 1000 ? '28px 44px' : '44px 64px', opacity: clamp(e * 1.5), transform: `translateY(${(1 - e) * 40}px) rotate(${(1 - e) * -1.5}deg)`}}>
      <div style={{fontFamily: DISPLAY, fontSize: 120, lineHeight: 0.6, color: accent}}>&ldquo;</div>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: width < 1000 ? (text.length > 70 ? 42 : 50) : 56, lineHeight: 1.2, color: INK}}>{text}</div>
      {by && <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 32, color: INK, opacity: 0.7, marginTop: 24}}>{by}</div>}
    </div>
  );
};
