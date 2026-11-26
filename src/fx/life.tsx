import React from 'react';
import {BOIL_STYLE} from './boil';
import {INK, clamp} from '../theme';

const rnd = (n: number) => { const x = Math.sin(n * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };

/** Continuous camera for one scene: slow push-in with drift, a smooth handheld wobble, and a punch-in on the cold open. Pure function of the scene-local frame. */
export const Camera: React.FC<{frame: number; seed: number; children: React.ReactNode}> = ({frame, seed, children}) => {
  const f = Math.max(0, frame);
  const dir = seed % 2 ? -1 : 1;
  const settle = 1 - Math.exp(-f / 220);
  // no zoom here: SceneView owns the director's push/pull/punch-ins; this layer only adds drift and handheld life
  const tx = dir * 8 * settle + Math.sin(f / 31) * 2 + Math.sin(f / 13 + 2) * 0.8;
  const ty = -5 * settle + Math.sin(f / 37 + 1) * 1.6 + Math.sin(f / 11) * 0.6;
  const rot = Math.sin(f / 53 + seed) * 0.14 + Math.sin(f / 19) * 0.04;
  return <div style={{position: 'absolute', inset: 0, transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) `, transformOrigin: '50% 48%'}}>{children}</div>;
};

const SHAPES = ['ring', 'plus', 'squiggle', 'tri', 'dots'] as const;

/** Living background behind a scene: soft colour blocks and faint floating marks that drift against the camera (parallax), so no frame is ever flat. */
export const Living: React.FC<{frame: number; seed: number; accent: string; w?: number; h?: number}> = ({frame, seed, accent, w: W = 1920, h: H = 1080}) => {
  const f = Math.max(0, frame);
  const dir = seed % 2 ? 1 : -1;
  const tint = accent === INK ? '#e8c25a' : accent;
  const blobs = [0, 1, 2].map(n => {
    const r = (k: number) => rnd(seed * 13 + n * 5 + k);
    const size = 520 + r(1) * 420;
    return {x: r(2) * (W - size * 0.5) - size * 0.25, y: r(3) * (H - size * 0.5) - size * 0.25, size, rot: r(4) * 40 - 20, op: 0.06 + r(5) * 0.05, round: 38 + r(6) * 12};
  });
  const marks = Array.from({length: 9}, (_, n) => {
    const r = (k: number) => rnd(seed * 31 + n * 7 + k);
    return {kind: SHAPES[Math.floor(r(1) * SHAPES.length)], x: r(2) * W, y: r(3) * H, s: 34 + r(4) * 40, ph: r(5) * 6, rot: r(6) * 360, sp: 0.4 + r(7)};
  });
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>
      {blobs.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: b.x + dir * f * 0.06 * (i + 1), top: b.y + Math.sin(f / 90 + i) * 14, width: b.size, height: b.size * 0.7, borderRadius: `${b.round}% ${100 - b.round}% ${b.round + 8}% ${92 - b.round}%`,
          background: tint, opacity: b.op, transform: `rotate(${b.rot + Math.sin(f / 120 + i) * 2}deg)`}} />
      ))}
      <div style={{position: 'absolute', inset: 0, ...BOIL_STYLE}}>
        {marks.map((m, i) => (
          <svg key={i} viewBox="0 0 100 100" width={m.s} height={m.s} style={{position: 'absolute', left: ((m.x + dir * f * 0.2 * m.sp) % (W + 100) + W + 100) % (W + 100) - 50, top: m.y + Math.sin(f / 40 * m.sp + m.ph) * 18, opacity: 0.2 * clamp(f / 10), transform: `rotate(${m.rot + f * 0.3 * m.sp}deg)`}}
            fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
            {m.kind === 'ring' && <circle cx={50} cy={50} r={36} />}
            {m.kind === 'plus' && <path d="M50 14V86M14 50H86" />}
            {m.kind === 'squiggle' && <path d="M10 60Q25 30 40 60T70 60T92 50" />}
            {m.kind === 'tri' && <path d="M50 14 88 82H12Z" />}
            {m.kind === 'dots' && <path d="M20 30h.1M50 30h.1M80 30h.1M20 60h.1M50 60h.1M80 60h.1" strokeWidth={12} />}
          </svg>
        ))}
      </div>
    </div>
  );
};

export const Vignette: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(70,45,15,0.16) 100%)'}} />
);

/** Segmented progress bar along the top edge: one equal segment per scene, finished ones solid, the current one filling. Depends only on scene index/count and chunk-local progress, so chunks stay cacheable as long as those are part of the chunk key. */
export const ProgressBar: React.FC<{index: number; count: number; p: number; accent: string; w?: number}> = ({index, count, p, accent, w = 1920}) => {
  const gap = 6, seg = (w - gap * (count + 1)) / count;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: 10, pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const fill = i < index ? 1 : i === index ? clamp(p) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: gap + i * (seg + gap), top: 0, width: seg, height: 8, borderRadius: '0 0 4px 4px', background: 'rgba(27,27,31,0.12)', overflow: 'hidden'}}>
            <div style={{width: `${fill * 100}%`, height: '100%', background: accent === INK ? '#e8c25a' : accent}} />
          </div>
        );
      })}
    </div>
  );
};
