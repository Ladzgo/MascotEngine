import React from 'react';
import type {Scene} from '../schema';
import type {SceneDecision} from '../director/types';
import {DISPLAY, SANS, clamp, easeInOut, easeOut} from '../theme';
import {GradDefs, IsoBox, Txt, pop, seg} from './kit';
import {OBJECTS} from './objects';
import {planShots} from './shots';

type Word = {w: string; start: number; end: number};
export type FBProps = {scene: Scene; dec: SceneDecision; frame: number; fps: number; accent: string; w: number; h: number; words: Word[]; index: number; episodeTitle: string; prevKind?: string; preroll?: number};

const THEMES: [string, string, string][] = [ // [top, bottom, ground]
  ['#1d2b5e', '#6a4c93', '#241a3d'], ['#0e3b43', '#2a9d8f', '#0b2a30'], ['#3a1c71', '#d76d77', '#2a1346'], ['#12263f', '#3d7ea6', '#0c1b2e'], ['#42275a', '#734b6d', '#2b1738'], ['#0f4c5c', '#e36414', '#0b3540'],
];
const OBJ_THEME: Record<string, number[]> = {skyline: [0, 3], bank: [0, 4], vault: [3, 4], house: [5, 2], car: [5, 2], coin_stacks: [1, 3], cash: [1, 0], piggy: [1, 2], card: [2, 4], bars3d: [3, 0], arrow_up: [1, 3], arrow_down: [4, 2], percent: [2, 0], clock: [4, 3], calendar: [3, 1], scale: [4, 0], doc: [3, 4], shield: [3, 1], magnifier: [0, 5]};

/** Layered backdrop with parallax: sky gradient, bokeh/stars, far and near silhouettes, lit ground. `cx` = camera pan in px, `p` = scene progress 0..1. */
const Backdrop: React.FC<{w: number; h: number; theme: [string, string, string]; cx: number; t: number; seed: number}> = ({w, h, theme, cx, t, seed}) => {
  const rnd = (i: number) => { const x = Math.sin((i + 1) * 91.7 + seed * 13.1) * 43758.5453; return x - Math.floor(x); };
  const horizon = h * 0.585;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${theme[0]}, ${theme[1]} ${Math.round((horizon / h) * 100)}%, ${theme[2]})`}}>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 26}, (_, i) => { const r = 5 + rnd(i) * 26, x = ((rnd(i + 40) * w * 1.4 - cx * 0.2 - t * (6 + r)) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2, y = rnd(i + 80) * horizon;
          return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.05 + rnd(i + 5) * 0.12} />; })}
        <polygon points={Array.from({length: 14}, (_, i) => `${i * (w / 12) - cx * 0.35 - 40},${horizon - 60 - rnd(i + 200) * 150}`).join(' ') + ` ${w + 60},${horizon + 4} -60,${horizon + 4}`} fill="#000" opacity={0.2} />
        <polygon points={Array.from({length: 10}, (_, i) => `${i * (w / 8) - cx * 0.7 - 60},${horizon - 20 - rnd(i + 300) * 90}`).join(' ') + ` ${w + 100},${horizon + 6} -100,${horizon + 6}`} fill="#000" opacity={0.28} />
        <rect x={0} y={horizon} width={w} height={h - horizon} fill={theme[2]} opacity={0.85} />
        {Array.from({length: 9}, (_, i) => <line key={i} x1={w / 2 + (i - 4) * w * 0.05} y1={horizon} x2={w / 2 + (i - 4) * w * 0.55 - cx * 1.4} y2={h} stroke="#fff" strokeOpacity={0.07} strokeWidth={2} />)}
        {Array.from({length: 6}, (_, i) => { const k = ((i + (t * 0.35) % 1) / 6), y = horizon + (h - horizon) * k * k; return <line key={i} x1={0} y1={y} x2={w} y2={y} stroke="#fff" strokeOpacity={0.06 * k + 0.02} strokeWidth={2} />; })}
        <ellipse cx={w / 2 - cx * 0.5} cy={horizon - 40} rx={w * 0.5} ry={h * 0.2} fill="url(#fb-glow)" opacity={0.3} />
      </svg>
    </div>
  );
};

/** Parts of each object a callout can point at (400x400 object box). Index i of a list points at anchor i. */
const ANCHORS: Record<string, [number, number][]> = {
  calendar: [[120, 200], [200, 250], [280, 200], [160, 300]], house: [[200, 280], [126, 240], [278, 240], [200, 110]], car: [[116, 296], [296, 296], [160, 200], [340, 250]], bars3d: [[60, 250], [172, 200], [284, 150], [340, 80]],
  coin_stacks: [[90, 250], [170, 190], [250, 220], [325, 150]], card: [[106, 218], [200, 266], [300, 238], [200, 156]], clock: [[200, 100], [300, 190], [200, 290], [100, 190]], vault: [[200, 190], [320, 190], [140, 130], [260, 250]],
  piggy: [[318, 246], [200, 166], [140, 320], [250, 150]], phone: [[200, 100], [160, 150], [200, 256], [280, 64]], people: [[110, 150], [200, 130], [290, 150], [200, 280]], cash: [[200, 270], [200, 220], [220, 190], [150, 290]],
  receipts: [[110, 120], [200, 100], [290, 120], [200, 262]], percent: [[200, 120], [120, 190], [280, 190], [200, 270]], skyline: [[80, 120], [170, 150], [260, 120], [340, 190]], arrow_up: [[100, 260], [170, 250], [250, 180], [296, 130]], arrow_down: [[100, 140], [170, 160], [250, 220], [296, 290]],
};
const anchorOf = (kind: string, i: number): [number, number] => { const a = ANCHORS[kind]; return a ? a[i % a.length] : ([[200, 150], [150, 220], [250, 220], [200, 280]] as [number, number][])[i % 4]; };

/** Coins and sparkles that fly out of the hero while it is on screen. */
const Particles: React.FC<{t: number; w: number; h: number; cx: number; cy: number; money: boolean; accent: string; seed: number}> = ({t, w, h, cx, cy, money, accent, seed}) => {
  const rnd = (i: number) => { const x = Math.sin((i + 1) * 78.233 + seed * 12.9) * 43758.5453; return x - Math.floor(x); };
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible'}}>
      {Array.from({length: money ? 9 : 7}, (_, i) => {
        const a = 0.25 + rnd(i) * 1.6, life = 1.6 + rnd(i + 9), u = ((t - a) % life + life) % life / life, born = t >= a;
        if (!born) return null;
        const ang = -Math.PI / 2 + (rnd(i + 3) - 0.5) * 2.2, d = u * (w * (0.25 + rnd(i + 5) * 0.3)), x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d + u * u * h * 0.14, o = Math.sin(Math.PI * u), r = (money ? 20 : 11) * (0.7 + rnd(i + 7) * 0.6);
        return money
          ? <g key={i} transform={`translate(${x} ${y}) scale(${Math.max(0.15, Math.abs(Math.cos(t * 5 + i)))} 1)`} opacity={o}><circle r={r} fill="#f2b705" /><circle r={r * 0.7} fill="#ffe27a" /><text y={r * 0.38} fontSize={r * 1.1} fontFamily="Archivo Black, sans-serif" textAnchor="middle" fill="#8a5a05">$</text></g>
          : <path key={i} d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z`} fill={i % 2 ? '#fff' : accent} opacity={o * 0.9} />;
      })}
    </svg>
  );
};
const MONEY = new Set(['coin_stacks', 'cash', 'wallet', 'piggy', 'card', 'bars3d', 'percent', 'bank', 'receipts']);

/** Callout label: pill with a leader line that draws to the hero. */
const calloutWidth = (text: string, size: number, maxW: number) => Math.min(size * 0.6 * text.length + size * 1.8, maxW);
const Callout: React.FC<{text: string; t: number; at: number; x: number; y: number; tx: number; ty: number; size: number; accent: string; align: 'left' | 'right'; maxW: number}> = ({text, t, at, x, y, tx, ty, size, accent, align, maxW}) => {
  const e = easeOut((t - at) / 0.35);
  if (e <= 0) return null;
  const wpx = calloutWidth(text, size, maxW), ax = align === 'left' ? x + wpx : x;
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
        <line x1={ax} y1={y + size * 0.8} x2={ax + (tx - ax) * e} y2={y + size * 0.8 + (ty - y - size * 0.8) * e} stroke="#fff" strokeWidth={size * 0.07} strokeLinecap="round" strokeDasharray={`${size * 0.2} ${size * 0.16}`} opacity={0.85} />
        <circle cx={tx} cy={ty} r={size * 0.16 * e} fill={accent} stroke="#fff" strokeWidth={size * 0.05} />
      </svg>
      <div style={{position: 'absolute', left: x, top: y, width: wpx, opacity: e, transform: `translateY(${(1 - e) * 30}px) scale(${0.9 + 0.1 * e})`, background: 'rgba(255,255,255,0.96)', color: '#16182a', fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, padding: `${size * 0.32}px ${size * 0.5}px`, borderRadius: size * 0.7, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', borderLeft: `${size * 0.22}px solid ${accent}`, textAlign: 'left'}}>{text}</div>
    </>
  );
};

const calloutTexts = (s: Scene): string[] => {
  switch (s.type) {
    case 'list': return s.items;
    case 'checklist': return s.steps;
    case 'stats': return s.stats.map(x => `${x.prefix}${x.value.toLocaleString('en-US')}${x.suffix} ${x.label}`);
    case 'table': return s.rows.map(r => r.join(' · '));
    case 'timeline': return s.events.map(e => `${e.when}: ${e.what}`);
    default: return [];
  }
};

/** Animated counter (big_number): pill + count-up. */
const Counter: React.FC<{s: Extract<Scene, {type: 'big_number'}>; t: number; w: number; y: number; accent: string}> = ({s, t, w, y, accent}) => {
  const k = seg(t, 0.35, 1.7), v = s.value * k, txt = `${s.prefix}${v.toLocaleString('en-US', {minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals})}${s.suffix}`;
  const e = easeOut((t - 0.2) / 0.4), size = Math.min(w * 0.2, 230) * (txt.length > 9 ? 0.72 : 1);
  return (
    <div style={{position: 'absolute', left: 0, width: w, top: y, textAlign: 'center', opacity: e, transform: `scale(${0.8 + 0.2 * e})`}}>
      <div style={{display: 'inline-block', fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: '#fff', textShadow: `0 6px 0 ${accent}, 0 14px 34px rgba(0,0,0,0.5)`, WebkitTextStroke: '3px rgba(0,0,0,0.25)'}}>{txt}</div>
      <div style={{marginTop: size * 0.12, fontFamily: SANS, fontWeight: 800, fontSize: size * 0.2, color: '#fff', background: 'rgba(10,12,30,0.7)', display: 'inline-block', padding: '8px 24px', borderRadius: 40, maxWidth: w * 0.86}}>{s.label}</div>
    </div>
  );
};

const Versus: React.FC<{a: {title: string; value: string}; b: {title: string; value: string}; t: number; w: number; h: number; y: number; accent: string}> = ({a, b, t, w, h, y, accent}) => {
  const tall = h > w, cw = tall ? w * 0.78 : w * 0.34, ch = tall ? 190 : 170;
  const card = (c: {title: string; value: string}, i: number) => {
    const e = easeOut((t - 0.3 - i * 0.35) / 0.4);
    return <div key={i} style={{width: cw, height: ch, borderRadius: 30, background: i ? accent : 'rgba(255,255,255,0.96)', color: i ? '#fff' : '#16182a', boxShadow: '0 14px 36px rgba(0,0,0,0.4)', opacity: e, transform: `translate(${(1 - e) * (tall ? 0 : (i ? 80 : -80))}px, ${(1 - e) * (tall ? (i ? 60 : -60) : 0)}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, textAlign: 'center', padding: 12}}>
      <div style={{fontSize: ch * 0.3, lineHeight: 1.05}}>{c.value}</div><div style={{fontFamily: SANS, fontWeight: 800, fontSize: ch * 0.15, opacity: 0.8, marginTop: 6}}>{c.title}</div></div>;
  };
  return <div style={{position: 'absolute', left: 0, width: w, top: y, display: 'flex', flexDirection: tall ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: tall ? 16 : 40}}>{card(a, 0)}<div style={{fontFamily: DISPLAY, fontSize: 56, color: '#ffe27a', textShadow: '0 4px 12px rgba(0,0,0,0.5)', opacity: easeOut((t - 0.6) / 0.3)}}>VS</div>{card(b, 1)}</div>;
};

/** Bars from real chart data, isometric. */
const ChartBars: React.FC<{labels: string[]; values: number[]; t: number}> = ({labels, values, t}) => {
  const max = Math.max(...values.map(Math.abs), 1e-9), n = values.length, gap = 320 / n;
  return (
    <g>
      {values.map((v, i) => <IsoBox key={i} ox={50 + i * gap} oy={320} w={gap * 0.55} d={gap * 0.5} h={Math.max(4, (Math.abs(v) / max) * 240) * seg(t, 0.1 + i * 0.1, 0.8 + i * 0.1)} pal={i === n - 1 ? 'green' : 'blue'} />)}
      {labels.slice(0, 8).map((l, i) => <Txt key={i} x={50 + i * gap + gap * 0.1} y={352} size={Math.min(20, gap * 0.34)} fill="#ffffffcc">{l.slice(0, 6)}</Txt>)}
      <Txt x={300} y={46} size={38} fill="#ffe27a" stroke="#18213f">{(values[values.length - 1] * seg(t, 0.4, 1.8)).toLocaleString('en-US', {maximumFractionDigits: 1})}</Txt>
    </g>
  );
};

export const FullBleedScene: React.FC<FBProps> = ({scene, dec, frame, fps, accent, w, h, words, index, episodeTitle, prevKind, preroll = 0}) => {
  const f = frame + preroll, t = f / fps, dur = Math.max(1, dec.durSec), p = clamp(t / dur);
  const tall = h > w;
  const shots = planShots(scene as any, words, dur, {seed: index, skip: prevKind});
  const active = Math.max(0, shots.reduce((a, s, i) => (t >= s.at ? i : a), 0));
  const kindAt = (tt: number) => shots[Math.max(0, shots.reduce((a, s, i) => (tt >= s.at ? i : a), 0))].kind;
  const theme = THEMES[(OBJ_THEME[shots[0].kind] ?? [0, 1, 2, 3, 4, 5])[index % (OBJ_THEME[shots[0].kind]?.length ?? 6)] ?? 0];

  // continuous camera: one move per scene, never eased to a stop (linear progress); backdrop layers parallax against the stage
  const mv = (index + (scene.type === 'big_number' ? 1 : 0)) % 4;
  const push = 1.02 + 0.2 * p, panX = mv === 1 ? (p - 0.5) * -0.12 * w : mv === 2 ? (p - 0.5) * 0.12 * w : Math.sin(t * 0.7) * 0.012 * w;
  const rot = mv === 3 ? (p - 0.5) * 3.6 : Math.sin(t * 0.5) * 0.5, tiltY = mv === 0 ? (0.5 - p) * 0.03 * h : Math.cos(t * 0.6) * 0.008 * h;
  const sc = mv === 3 ? 1.08 + 0.1 * p : push;
  const stage = `translate(${panX}px, ${tiltY}px) rotate(${rot}deg) scale(${sc})`;

  const ctxText = calloutTexts(scene).slice(0, tall ? 3 : 4), hasCallouts = ctxText.length > 0;
  const versus = scene.type === 'compare' || scene.type === 'before_after';
  const base = tall ? w * 0.98 : h * 0.86;
  const heroSize = base * (hasCallouts ? 0.82 : versus ? 0.56 : scene.type === 'title' ? 0.66 : scene.type === 'big_number' ? 0.74 : 1) * (versus && !tall ? 1.1 : 1);
  const cx = w / 2, cy = tall ? h * (hasCallouts ? 0.31 : versus ? 0.52 : scene.type === 'title' ? 0.53 : scene.type === 'big_number' ? 0.45 : 0.385) : h * (versus ? 0.55 : scene.type === 'title' ? 0.58 : 0.47);
  const hs = hasCallouts && !tall ? h * 0.72 : heroSize;
  const hx = hasCallouts && !tall ? w * 0.68 : cx;
  const sweepX = (((t * 0.32) % 1.7) - 0.35) * w;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <svg width={0} height={0} style={{position: 'absolute'}}><GradDefs accent={accent} /></svg>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1.06 + 0.1 * p}) translateX(${panX * 0.5}px)`, transformOrigin: '50% 60%'}}>
        <Backdrop w={w} h={h} theme={theme} cx={panX} t={t} seed={index} />
      </div>
      <div style={{position: 'absolute', inset: 0, transform: stage, transformOrigin: `50% ${55}%`}}>
        {shots.map((s, i) => {
          const Obj = OBJECTS[s.kind], local = t - s.at, end = shots[i + 1]?.at ?? 1e9, out = clamp((t - end) / 0.3);
          if (local < 0 || out >= 1 || !Obj) return null;
          const inE = easeOut(local / 0.3), bob = Math.sin(t * 1.3 + i) * heroSize * 0.008, over = 0.8 + 0.2 * pop(local, 0, 0.5);
          const isChart = scene.type === 'chart' && i === 0;
          return (
            <React.Fragment key={i}>
              <svg viewBox="0 0 400 400" width={hs} height={hs} style={{position: 'absolute', left: hx - hs / 2, top: cy - hs / 2 + bob, overflow: 'visible', opacity: (1 - easeInOut(out)) * clamp(inE * 1.5), transform: `scale(${over * (1 + 0.12 * easeInOut(out))}) rotate(${Math.sin(t * 0.9 + i) * 1.2}deg) translateX(${out * -w * 0.06}px)`, filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.35))'}}>
                {isChart && scene.type === 'chart' ? <ChartBars labels={scene.chart.labels} values={scene.chart.values} t={local} /> : <Obj t={local} accent={accent} value={scene.type === 'big_number' && i === 0 ? scene.value : undefined} />}
              </svg>
              <div style={{position: 'absolute', inset: 0, opacity: 1 - out}}><Particles t={local} w={w} h={h} cx={hx} cy={cy} money={MONEY.has(s.kind)} accent={accent} seed={index * 7 + i} /></div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: 'linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${sweepX}px)`, width: w * 0.9}} />
      {scene.type === 'title' && <div style={{position: 'absolute', left: w * 0.06, width: w * 0.88, top: tall ? 250 : h * 0.1, textAlign: 'center', fontFamily: DISPLAY, fontSize: Math.min(w * 0.115, 150), lineHeight: 1.04, color: '#fff', textShadow: `0 6px 0 ${accent}, 0 12px 30px rgba(0,0,0,0.5)`, opacity: easeOut((t - 0.1) / 0.35), transform: `translateY(${(1 - easeOut((t - 0.1) / 0.35)) * -40}px)`}}>{episodeTitle}</div>}
      {scene.type === 'big_number' && <Counter s={scene} t={t} w={w} y={tall ? h * 0.12 : h * 0.14} accent={accent} />}
      {versus && <Versus a={scene.type === 'compare' ? scene.left : scene.before} b={scene.type === 'compare' ? scene.right : scene.after} t={t} w={w} h={h} y={tall ? h * 0.085 : h * 0.07} accent={accent} />}
      {hasCallouts && ctxText.map((txt, i) => {
        const size = tall ? 48 : 44, left = i % 2 === 0, maxW = tall ? w * 0.82 : w * 0.4, wp = calloutWidth(txt, size, maxW);
        const y = tall ? h * 0.455 + i * (size * 3.1) : h * 0.14 + i * (size * 3.3);
        const x = tall ? (left ? w * 0.05 : w * 0.95 - wp) : w * 0.04;
        const at = 0.5 + i * Math.max(0.8, (dur - 1) / ctxText.length), [ax, ay] = anchorOf(kindAt(at), i);
        const px = hx - hs / 2 + (ax * hs) / 400, py = cy - hs / 2 + (ay * hs) / 400; // anchor on the real part of the object, carried through the camera move
        return <Callout key={i} text={txt} t={t} at={at} x={x} y={y} tx={w / 2 + (px - w / 2) * sc + panX} ty={h * 0.55 + (py - h * 0.55) * sc + tiltY} size={size} accent={accent} align={left || !tall ? 'left' : 'right'} maxW={maxW} />;
      })}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)'}} />
      {active < 0 && null}
    </div>
  );
};
