import React from 'react';
import {INK, backOut, clamp, easeInOut, easeOut} from '../theme';

/** Illustration drawing kit. Every illustration is a 200x200 viewBox; `t` = seconds since it appeared (entry + idle loop share one clock). */
export type Ctx = {t: number; accent: string};
export const PAPER2 = '#fffdf6', GOLD = '#f2b705', GOLD2 = '#ffd95a', GREEN = '#2e9e5b', RED = '#e4572e', SKY = '#cfe6f5', SW = 5;
export const soft = (hex: string, a = 0.28) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
/** eased 0..1 progress of t over [a, b] */
export const seg = (t: number, a: number, b: number) => easeOut(clamp((t - a) / Math.max(1e-3, b - a)));
export const segIO = (t: number, a: number, b: number) => easeInOut(clamp((t - a) / Math.max(1e-3, b - a)));
export const sp = (t: number, a: number, dur = 0.5) => backOut((t - a) / dur);
/** idle wave in [-1, 1] with period `per` seconds */
export const wave = (t: number, per = 3, ph = 0) => Math.sin((t / per) * Math.PI * 2 + ph);

/** Hand-drawn stroke that draws itself on over [a, b], then its fill fades in. */
export const D: React.FC<{d: string; t: number; a?: number; b?: number; fill?: string; stroke?: string; w?: number; dash?: string}> = ({d, t, a = 0, b = a + 0.5, fill = 'none', stroke = INK, w = SW, dash}) => {
  const p = seg(t, a, b), f = clamp((t - (a + (b - a) * 0.55)) / 0.25);
  return (
    <>
      {fill !== 'none' && <path d={d} fill={fill} opacity={f} />}
      {p > 0.02 && <path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={dash ?? '1 1'} strokeDashoffset={dash ? 0 : 1 - p} opacity={dash ? p : 1} />}
    </>
  );
};

/** Spring pop of a group about (cx, cy), optional drop-in from `dy` above and rotation. */
export const Pop: React.FC<{t: number; a?: number; cx?: number; cy?: number; dy?: number; rot?: number; dur?: number; children: React.ReactNode; extra?: string}> = ({t, a = 0, cx = 100, cy = 100, dy = 0, rot = 0, dur = 0.5, children, extra = ''}) => {
  const s = sp(t, a, dur);
  if (t < a) return null;
  return <g opacity={clamp((t - a) / 0.08)} transform={`${extra} translate(0 ${-dy * (1 - s)}) translate(${cx} ${cy}) rotate(${rot * (1 - s)}) scale(${Math.max(0.001, s)}) translate(${-cx} ${-cy})`}>{children}</g>;
};

export const Txt: React.FC<{x: number; y: number; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; children: React.ReactNode; rot?: number}> = ({x, y, size = 40, fill = INK, anchor = 'middle', children, rot = 0}) => (
  <text x={x} y={y} fontFamily='"Archivo Black", sans-serif' fontSize={size} fill={fill} textAnchor={anchor} transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}>{children}</text>
);

export const Coin: React.FC<{x: number; y: number; r?: number; sym?: string; t?: number; spin?: number}> = ({x, y, r = 16, sym = '$', spin}) => {
  const sx = spin === undefined ? 1 : Math.max(0.12, Math.abs(Math.cos(spin)));
  return (
    <g transform={`translate(${x} ${y}) scale(${sx} 1)`}>
      <circle r={r} fill={GOLD} stroke={INK} strokeWidth={SW - 1} />
      <circle r={r * 0.68} fill={GOLD2} stroke={INK} strokeWidth={2} opacity={0.9} />
      {sx > 0.45 && <text y={r * 0.36} fontFamily='"Archivo Black", sans-serif' fontSize={r * 1.05} textAnchor="middle" fill={INK}>{sym}</text>}
    </g>
  );
};

export const Sparkle: React.FC<{x: number; y: number; s?: number; t: number; a?: number; color?: string}> = ({x, y, s = 10, t, a = 0, color = GOLD}) => {
  const k = Math.max(0, wave(t - a, 1.6)) * clamp((t - a) / 0.3);
  return <path d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}z`} fill={color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" transform={`translate(${x} ${y}) scale(${0.35 + k * 0.65}) translate(${-x} ${-y})`} opacity={clamp((t - a) / 0.2)} />;
};
