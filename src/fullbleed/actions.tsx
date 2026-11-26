import React from 'react';
import {easeInOut, easeOut} from '../theme';
import type {Action} from './catalog';

/** One drawn copy of the subject: offsets are fractions of the hero box, so actions work for every subject. */
export type Copy = {tx: number; ty: number; sc: number; scY?: number; sx?: number; rot: number; op: number; clip?: 'left' | 'right'};
export type Overlay = 'cross' | 'check' | 'burn' | 'lock' | 'unlock' | null;
const base = (): Copy => ({tx: 0, ty: 0, sc: 1, rot: 0, op: 1});
const e = (x: number) => easeOut(Math.min(1, Math.max(0, x)));
const io = (x: number) => easeInOut(Math.min(1, Math.max(0, x)));

/** Copies and overlay for `action` at `u` seconds into the shot. Pure, so it is unit-testable. */
export function actionCopies(action: Action | string | undefined, u: number): {copies: Copy[]; overlay: Overlay; at: number} {
  const c = base();
  let overlay: Overlay = null, copies: Copy[] = [c];
  switch (action) {
    case 'drop': c.ty = -(1 - e(u / 0.55)) * 0.9 + (u > 0.55 ? Math.abs(Math.sin((u - 0.55) * 9)) * -0.05 * Math.exp(-(u - 0.55) * 4) : 0); break;
    case 'rise': c.ty = (1 - e(u / 0.9)) * 0.55; c.op = e(u / 0.4); break;
    case 'fall': c.ty = io(u / 1.1) * 0.7; c.op = 1 - io((u - 0.6) / 0.6); c.rot = u * 20; break;
    case 'grow': c.sc = 0.25 + 0.75 * e(u / 1.2); break;
    case 'shrink': c.sc = 1.25 - 0.7 * io(u / 1.6); break;
    case 'bounce': c.ty = -Math.abs(Math.sin(u * 5)) * 0.09 * Math.exp(-u * 0.35); break;
    case 'spin': c.rot = u * 90; break;
    case 'roll': c.tx = (e(u / 1.6) - 0.5) * 0.4; c.rot = c.tx * 500; break;
    case 'swipe': c.tx = (((u * 0.55) % 1) - 0.5) * 0.9; c.op = Math.sin(Math.PI * ((u * 0.55) % 1)) ** 0.3; break;
    case 'flip': c.sx = Math.max(0.05, Math.abs(Math.cos(io(u / 0.9) * Math.PI))); break;
    case 'shake': c.tx = Math.sin(u * 45) * 0.012 * Math.exp(-u * 0.9); c.rot = Math.sin(u * 45) * 1.5 * Math.exp(-u * 0.9); break;
    case 'pulse': c.sc = 1 + Math.sin(u * 5) * 0.045; break;
    case 'float': c.ty = Math.sin(u * 1.7) * 0.025; c.rot = Math.sin(u * 1.1) * 2; break;
    case 'zoom_into': c.sc = 1 + 0.9 * io(u / 2.2); break;
    case 'slide_in_left': c.tx = -(1 - e(u / 0.6)) * 0.7; break;
    case 'slide_in_right': c.tx = (1 - e(u / 0.6)) * 0.7; break;
    case 'stack': copies = [0, 1, 2].map(i => ({...base(), sc: 0.62, ty: 0.12 - i * 0.2 + (1 - e((u - i * 0.45) / 0.4)) * -0.5, op: u >= i * 0.45 ? 1 : 0, tx: (i - 1) * 0.03})); break;
    case 'split': { const d = 0.04 + 0.14 * io((u - 0.3) / 0.8); copies = [{...base(), tx: -d, clip: 'left'}, {...base(), tx: d, clip: 'right'}]; break; }
    case 'merge': { const d = (1 - io(u / 1.0)) * 0.45; copies = [{...base(), sc: 0.8, tx: -d - 0.1}, {...base(), sc: 0.8, tx: d + 0.1}]; break; }
    case 'cross_out': overlay = 'cross'; c.op = 1 - 0.35 * e((u - 0.9) / 0.4); break;
    case 'check': overlay = 'check'; break;
    case 'burn': overlay = 'burn'; c.sc = 1 - 0.18 * e((u - 0.6) / 1.4); c.op = 1 - 0.55 * e((u - 0.8) / 1.4); break;
    case 'melt': c.scY = 1 - 0.45 * io((u - 0.4) / 1.6); c.sc = 1 + 0.12 * io((u - 0.4) / 1.6); c.ty = 0.1 * io((u - 0.4) / 1.6); break;
    case 'lock': overlay = 'lock'; break;
    case 'unlock': overlay = 'unlock'; break;
    case 'compare_slide': c.tx = Math.sin(u * 1.4) * 0.18; break;
    case 'wobble': c.rot = Math.sin(u * 4) * 5; break;
    case 'pop_in': c.sc = u < 0.5 ? 0.6 + 0.4 * (1 - Math.cos(Math.min(1, u / 0.5) * Math.PI * 1.4)) * 0.6 : 1; break;
    case 'pan_across': c.tx = -0.15 + 0.3 * Math.min(1, u / 4); break;
    case 'tilt': c.rot = -12 * io(u / 1.4); break;
    case 'orbit': c.tx = Math.cos(u * 1.3) * 0.05; c.ty = Math.sin(u * 1.3) * 0.03; c.rot = Math.sin(u * 1.3) * 4; break;
    case 'blink': c.op = Math.floor(u * 3) % 2 && u < 3 ? 0.35 : 1; break;
    case 'sink': c.ty = 0.25 * io(u / 1.8); c.op = 1 - 0.5 * io(u / 1.8); break;
    default: break;
  }
  return {copies, overlay, at: 0.9};
}

/** Overlay marks that sit on top of the subject: red cross, green tick, flames, padlock. size = hero box in px. */
export const ActionOverlay: React.FC<{kind: Overlay; u: number; size: number}> = ({kind, u, size}) => {
  if (!kind) return null;
  const k = e((u - 0.7) / 0.5), S = size, sw = S * 0.05;
  const box: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: S, height: S, overflow: 'visible', pointerEvents: 'none'};
  if (kind === 'cross') return <svg viewBox="0 0 400 400" style={box}><path d="M90 90 L310 310 M310 90 L90 310" stroke="#12142a" strokeWidth={40} strokeLinecap="round" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - k} opacity={0.35} /><path d="M90 90 L310 310 M310 90 L90 310" stroke="#e4372e" strokeWidth={30} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - k} /></svg>;
  if (kind === 'check') return <svg viewBox="0 0 400 400" style={{...box, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.4))'}}><circle cx={310} cy={110} r={64 * e((u - 0.6) / 0.35)} fill="#2e9e5b" stroke="#fff" strokeWidth={8} /><path d="M280 110 L304 134 L344 84" stroke="#fff" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - e((u - 0.8) / 0.4)} /></svg>;
  if (kind === 'burn') return <svg viewBox="0 0 400 400" style={box}>{[90, 160, 230, 300].map((x, i) => <path key={i} d={`M${x} 340 C${x - 30} 280 ${x + 10} 250 ${x} 200 C${x + 40} 250 ${x + 50} 290 ${x + 24} 340Z`} fill={i % 2 ? '#ffb22e' : '#e4572e'} opacity={0.9 * k} transform={`translate(0 ${Math.sin(u * 9 + i) * 6 - 20}) scale(1 ${0.9 + Math.sin(u * 12 + i) * 0.1})`} style={{transformOrigin: `${x}px 340px`}} />)}</svg>;
  // lock / unlock: padlock in the corner, shackle open or closed
  const open = kind === 'unlock' ? e((u - 0.6) / 0.5) : 1 - e((u - 0.6) / 0.5);
  return <svg viewBox="0 0 400 400" style={box}><g transform="translate(260 60)"><path d={`M20 70 V${50 - open * 22} a40 40 0 0 1 80 0 V${70 - open * 8}`} fill="none" stroke="#cfd5e6" strokeWidth={14} strokeLinecap="round" /><rect x={0} y={66} width={120} height={96} rx={16} fill="#f2b705" stroke="#12142a" strokeWidth={5} /><circle cx={60} cy={110} r={11} fill="#3a2a05" /></g></svg>;
};
void 0;
