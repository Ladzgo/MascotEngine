import React from 'react';
import {BOIL_STYLE} from './boil';
import {backOut, clamp} from '../theme';

/** Hand-drawn line icons (viewBox 0 0 100 100), stroke only, keyed by words in the narration. Free, no assets. */
const ICONS: Record<string, {re: RegExp; d: string[]}> = {
  coin: {re: /\b(coins?|cash|dollars?|money|cents?|pay|paid|price|cost|costs|spend|worth)\b/i, d: ['M50 12a38 38 0 1 0 .1 0z', 'M50 24a26 26 0 1 0 .1 0z', 'M56 38c-3-4-14-4-14 3 0 8 15 4 15 12 0 7-12 8-16 2M49 32v36']},
  house: {re: /\b(house|home|homes|rent|renting|mortgage|property|housing)\b/i, d: ['M12 48 50 16l38 32', 'M22 44v40h56V44', 'M42 84V60h16v24']},
  chart: {re: /\b(grow|grows|growth|invest|invests|investing|stocks?|market|returns?|compound|rises?|increase|gains?)\b/i, d: ['M10 86h82M10 86V14', 'M18 70l22-22 14 14 30-34', 'M68 28h16v16']},
  down: {re: /\b(inflation|shrink|shrinks|shrinking|lose|loses|losing|falls?|drops?|decline|erodes?|debt|loan|loans)\b/i, d: ['M10 86h82M10 86V14', 'M18 30l22 22 14-14 30 34', 'M68 72h16V56']},
  clock: {re: /\b(time|years?|decades?|months?|early|late|wait|waiting|long|patience|daily|monthly)\b/i, d: ['M50 12a38 38 0 1 0 .1 0z', 'M50 28v24l16 10']},
  card: {re: /\b(cards?|credit|bank|banks|account|accounts|fees?|interest)\b/i, d: ['M10 26h80v52H10z', 'M10 42h80', 'M20 64h22']},
  shield: {re: /\b(safe|safety|protect|emergency|insurance|risk|secure|fund)\b/i, d: ['M50 10 18 22v26c0 20 14 34 32 42 18-8 32-22 32-42V22z', 'M36 50l10 10 18-20']},
  percent: {re: /\b(percent|rate|rates|apr|yield|tax|taxes|fee)\b/i, d: ['M26 74 74 26', 'M32 24a10 10 0 1 0 .1 0z', 'M68 66a10 10 0 1 0 .1 0z']},
  bulb: {re: /\b(idea|ideas|myth|myths|truth|actually|really|learn|simple|trick)\b/i, d: ['M50 10a26 26 0 0 0-14 48c4 4 4 8 4 12h20c0-4 0-8 4-12A26 26 0 0 0 50 10z', 'M40 80h20M44 90h12']},
  calendar: {re: /\b(budget|plan|save|saving|savings|monthly|goal|habit|automate)\b/i, d: ['M14 22h72v64H14z', 'M14 40h72', 'M32 12v18M68 12v18', 'M28 56h12M48 56h12M68 56h8M28 72h12M48 72h12']},
};

type Rect = {x0: number; x1: number; y0: number; y1: number};
const SLOTS = [[40, 60], [1650, 50], [40, 380], [1670, 380], [60, 660], [1640, 640], [800, 20], [860, 700]] as const;
const SIZE = 210;

/** Pick up to `max` icons whose keywords appear in `text`, in order of first appearance. */
export function pickDoodles(text: string, max = 3): string[] {
  const hits = Object.entries(ICONS).map(([k, v]) => ({k, i: text.search(v.re)})).filter(h => h.i >= 0).sort((a, b) => a.i - b.i);
  return hits.slice(0, max).map(h => h.k);
}

/** Faint icons behind the content, placed away from the character. Pure decoration: behind everything, never behind captions. */
export const Doodles: React.FC<{text: string; accent: string; frame: number; bounds: Rect | Rect[] | null; opacity?: number}> = ({text, accent, frame, bounds, opacity = 0.14}) => {
  const keys = pickDoodles(text);
  const avoid = bounds ? (Array.isArray(bounds) ? bounds : [bounds]) : [];
  const free = SLOTS.filter(([x, y]) => avoid.every(b => x + SIZE < b.x0 || x > b.x1 || y + SIZE < b.y0 || y > b.y1));
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', ...BOIL_STYLE}}>
      {keys.slice(0, free.length).map((k, n) => {
        const [x, y] = free[n];
        const e = backOut(clamp((frame - 6 - n * 7) / 12));
        const bob = Math.sin(frame / 22 + n * 2) * 6;
        const rot = (n % 2 ? 1 : -1) * (6 + n * 3);
        return (
          <svg key={k} viewBox="0 0 100 100" width={SIZE} height={SIZE} style={{position: 'absolute', left: x, top: y + bob, opacity: opacity * Math.min(1, e), transform: `rotate(${rot}deg) scale(${e})`}} fill="none" stroke={accent} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
            {ICONS[k].d.map((d, i) => <path key={i} d={d} />)}
          </svg>
        );
      })}
    </div>
  );
};
