import React from 'react';
import {backOut, clamp, easeInOut, easeOut} from '../theme';

/** Full-bleed look: gradient-lit, outline-free 2.5D objects drawn in a 400x400 box (ground line y=330). `t` = seconds since the object appeared. */
export const seg = (t: number, a: number, b: number) => easeOut(clamp((t - a) / Math.max(1e-3, b - a)));
export const segIO = (t: number, a: number, b: number) => easeInOut(clamp((t - a) / Math.max(1e-3, b - a)));
export const pop = (t: number, a: number, dur = 0.5) => (t < a ? 0 : Math.max(0, backOut((t - a) / dur)));
export const wave = (t: number, per = 3, ph = 0) => Math.sin((t / per) * Math.PI * 2 + ph);

export const PALETTES: Record<string, [string, string, string, string]> = { // [light, mid, dark, rim]
  gold: ['#ffe27a', '#f2b705', '#b8820a', '#fff3b0'], green: ['#6ee09a', '#2e9e5b', '#1b6b3b', '#c8ffd9'], blue: ['#8cc8ff', '#3d8bdc', '#1f4f94', '#d6ecff'],
  red: ['#ff9a8a', '#e4572e', '#a3341a', '#ffd9d2'], grey: ['#e4e7ee', '#aab1c0', '#6c7488', '#ffffff'], wall: ['#fff1d6', '#f0cf9a', '#c99a5b', '#fffaf0'],
  roof: ['#e8826a', '#c2503a', '#8a3322', '#ffb8a8'], glass: ['#b7e3ff', '#6fb2e8', '#3a6fa8', '#eaf7ff'], navy: ['#4a5d8f', '#2b3a66', '#18213f', '#7f93c9'],
};
export const GradDefs: React.FC<{accent: string}> = ({accent}) => (
  <defs>
    {Object.entries(PALETTES).map(([k, [l, m, d]]) => (
      <React.Fragment key={k}>
        <linearGradient id={`fb-${k}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={l} /><stop offset="0.55" stopColor={m} /><stop offset="1" stopColor={d} /></linearGradient>
        <linearGradient id={`fb-${k}-v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={l} /><stop offset="1" stopColor={d} /></linearGradient>
      </React.Fragment>
    ))}
    <linearGradient id="fb-accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={accent} stopOpacity="0.75" /><stop offset="1" stopColor={accent} /></linearGradient>
    <radialGradient id="fb-shadow"><stop offset="0" stopColor="#000" stopOpacity="0.38" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
    <linearGradient id="fb-groundfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></linearGradient>
    <radialGradient id="fb-glow"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
  </defs>
);

export const Shadow: React.FC<{cx?: number; cy?: number; rx?: number; ry?: number; o?: number}> = ({cx = 200, cy = 336, rx = 130, ry = 22, o = 1}) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#fb-shadow)" opacity={o} />;

/** Isometric box with its front-bottom corner at (ox, oy): left face mid, right face dark, top face light. */
export const IsoBox: React.FC<{ox: number; oy: number; w: number; d: number; h: number; pal?: string; top?: string; opacity?: number; children?: React.ReactNode}> = ({ox, oy, w, d, h, pal = 'blue', top, opacity = 1, children}) => {
  const wx = w * 0.866, wy = w * 0.5, dx = d * 0.866, dy = d * 0.5, [l, m, dk] = PALETTES[pal] ?? PALETTES.blue;
  const F = [ox, oy], R = [ox + wx, oy - wy], L = [ox - dx, oy - dy], B = [ox + wx - dx, oy - wy - dy];
  const up = (p: number[]) => `${p[0]},${p[1] - h}`, pt = (p: number[]) => `${p[0]},${p[1]}`;
  return (
    <g opacity={opacity}>
      <polygon points={`${pt(F)} ${pt(L)} ${up(L)} ${up(F)}`} fill={m} />
      <polygon points={`${pt(F)} ${pt(R)} ${up(R)} ${up(F)}`} fill={dk} />
      <polygon points={`${up(F)} ${up(R)} ${up(B)} ${up(L)}`} fill={top ?? l} />
      <polyline points={`${up(L)} ${up(F)} ${up(R)}`} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.6} strokeLinejoin="round" />
      {children}
    </g>
  );
};

export const Txt: React.FC<{x: number; y: number; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; children: React.ReactNode; stroke?: string}> = ({x, y, size = 40, fill = '#fff', anchor = 'middle', children, stroke}) => (
  <text x={x} y={y} fontFamily='"Archivo Black", sans-serif' fontSize={size} fill={fill} textAnchor={anchor} stroke={stroke} strokeWidth={stroke ? size * 0.12 : 0} paintOrder="stroke" strokeLinejoin="round">{children}</text>
);
