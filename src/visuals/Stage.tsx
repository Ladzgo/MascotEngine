import React from 'react';
import type {VisualKind} from '../schema';
import {DISPLAY, INK, clamp, easeOut} from '../theme';
import {Illustration} from './index';
import {Sparkle, sp, soft, wave} from './kit';

type Box = {x: number; y: number; w: number; h: number};

/** Dashed sticker ring + soft blob behind an illustration: gives it depth and a shared look. */
const Backdrop: React.FC<{size: number; t: number; accent: string}> = ({size, t, accent}) => {
  const s = sp(t, 0, 0.6);
  return (
    <svg viewBox="0 0 200 200" width={size * 1.08} height={size * 1.08} style={{position: 'absolute', left: -size * 0.04, top: -size * 0.04, overflow: 'visible', opacity: clamp(t / 0.15), transform: `scale(${Math.max(0.01, s)}) rotate(${wave(t, 9) * 4}deg)`}}>
      <path d="M100 8c44 0 90 30 92 88s-34 98-92 96S10 160 8 100 54 8 100 8z" fill={soft(accent, 0.16)} />
      <path d="M100 8c44 0 90 30 92 88s-34 98-92 96S10 160 8 100 54 8 100 8z" fill="none" stroke={soft(INK, 0.22)} strokeWidth={2.5} strokeDasharray="2 10" strokeLinecap="round" transform="translate(0 0) scale(0.96) translate(4 4)" />
    </svg>
  );
};

const Plus: React.FC<{x: number; y: number; s: number; t: number; a: number; color: string}> = ({x, y, s, t, a, color}) => {
  const k = sp(t, a, 0.4);
  return <svg width={s} height={s} viewBox="-10 -10 20 20" style={{position: 'absolute', left: x, top: y, transform: `scale(${Math.max(0, k)}) rotate(${wave(t, 5) * 12}deg)`, overflow: 'visible'}}><path d="M0 -8V8M-8 0H8" stroke={color} strokeWidth={3.5} strokeLinecap="round" /></svg>;
};

/** Hero illustration + up to two supporting icons + decorations + a key-phrase label, composed inside `box`. t = seconds since the scene's visual should start. */
export const VisualStage: React.FC<{box: Box; hero: VisualKind; support: VisualKind[]; label?: string; t: number; labelT?: number; accent: string}> = ({box, hero, support, label, t, labelT = 0.5, accent}) => {
  const fs = label ? Math.max(44, Math.min(96, Math.floor(box.w / (Math.min(label.length, 16) * 0.72)))) : 0;
  const lines = label ? Math.max(1, Math.ceil((label.length * 0.72 * fs) / (box.w - 40))) : 0;
  const labelH = label ? Math.round(lines * fs * 1.25 + 24) : 0;
  const S = Math.max(80, Math.min(box.h - labelH - 10, box.w / (support.length ? 1.95 : 1.05)));
  const cx = box.w / 2, top = Math.max(0, (box.h - labelH - S) / 2);
  const sup = S * 0.5;
  const spots = [{x: cx - S * 0.5 - sup * 0.8, y: top + S * 0.55, rot: -8}, {x: cx + S * 0.5 - sup * 0.2, y: top + S * 0.0, rot: 7}];
  const lt = Math.max(0, t - labelT), lp = easeOut(lt / 0.5);
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h}}>
      <div style={{position: 'absolute', left: cx - S / 2, top}}>
        <Backdrop size={S} t={t} accent={accent} />
        <Illustration kind={hero} size={S} t={t} accent={accent} />
      </div>
      {support.map((k, i) => (
        <div key={k} style={{position: 'absolute', left: spots[i].x, top: spots[i].y, transform: `rotate(${spots[i].rot}deg)`}}>
          <Backdrop size={sup} t={t - 0.3 - i * 0.25} accent={accent} />
          <Illustration kind={k} size={sup} t={t - 0.3 - i * 0.25} accent={accent} />
        </div>
      ))}
      <Plus x={cx - S * 0.62} y={top + S * 0.02} s={34} t={t} a={0.9} color={accent} />
      <Plus x={cx + S * 0.58} y={top + S * 0.92} s={26} t={t} a={1.2} color={INK} />
      <svg width={60} height={60} viewBox="0 0 60 60" style={{position: 'absolute', left: cx + S * 0.36, top: top - 16, overflow: 'visible'}}><Sparkle x={30} y={30} s={14} t={t} a={0.7} color={accent} /></svg>
      {label && (
        <div style={{position: 'absolute', left: 0, top: top + S + 8, width: box.w, textAlign: 'center', opacity: clamp(lt / 0.12), transform: `translateY(${(1 - lp) * 24}px)`}}>
          <span style={{display: 'inline', fontFamily: DISPLAY, fontSize: fs, lineHeight: 1.25, color: INK, textTransform: 'uppercase', padding: '0 18px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
            background: `linear-gradient(transparent 42%, ${soft(accent, 0.42)} 42%, ${soft(accent, 0.42)} 96%, transparent 96%) no-repeat left / ${easeOut(clamp((lt - 0.1) / 0.45)) * 100}% 100%`}}>
            {label}
          </span>
        </div>
      )}
    </div>
  );
};
