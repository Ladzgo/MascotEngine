import React from 'react';
import {Img, OffthreadVideo, continueRender, delayRender, getInputProps, staticFile} from 'remotion';
import {Lottie, type LottieAnimationData} from '@remotion/lottie';
import type {Scene} from '../schema';
import type {SceneDecision} from '../director/types';
import {DISPLAY, SANS, clamp, easeInOut, easeOut} from '../theme';
import {GradDefs, IsoBox, Txt, fitText, pop, seg} from './kit';
import {isFunctionWord} from '../fx/captions';
import {isBareVerb, screenNumber} from '../fx/punch';
import {objectOf} from './assetObj';
import {animatedTwin, assetFile} from './assetPick';
import {planShots} from './shots';
import {actionCopies, ActionOverlay} from './actions';
import {planEpisode, type ScenePlan} from './episodePlan';
import {pickKeyword} from '../scenes/keyword';

type Word = {w: string; start: number; end: number};
export type FBProps = {scene: Scene; dec: SceneDecision; frame: number; fps: number; accent: string; w: number; h: number; words: Word[]; index: number; episodeTitle: string; prevKind?: string; preroll?: number; plan?: ScenePlan; hook?: string};

type Env = 'city' | 'room' | 'vault' | 'abstract' | 'sky' | 'office' | 'street' | 'kitchen';
const ENV_OF: Record<string, Env> = {
  skyline: 'city', car: 'city', house: 'city', bank: 'city', people: 'city', pin: 'city', handshake: 'city', gradcap: 'city',
  card: 'room', card_swipe: 'room', phone: 'room', wallet: 'room', receipts: 'room', pricetag: 'room', price_up: 'room', cart: 'room', doc: 'room', debt_counter: 'room', magnifier: 'room', bulb: 'room', calendar: 'room',
  coin_stacks: 'vault', jar_fill: 'vault', cash: 'vault', piggy: 'vault', vault: 'vault', lock: 'vault', shield: 'vault', snowball: 'vault',
};
/** Palette per mood: [sky top, horizon, ground, light]. Neighbouring scenes rotate through them, so consecutive scenes never share a background colour. */
const PALETTES_BY_ENV: Record<Env, [string, string, string, string][]> = {
  city: [['#1d2b5e', '#6a4c93', '#241a3d', '#ffd9a0'], ['#0f4c5c', '#e36414', '#0b3540', '#ffe0b0'], ['#3a1c71', '#d76d77', '#2a1346', '#ffc9d6'], ['#12263f', '#3d7ea6', '#0c1b2e', '#cfe9ff']],
  room: [['#4a3b6b', '#9a6fb0', '#2f2243', '#ffe9c0'], ['#1f4e5f', '#5fa8a0', '#143540', '#e6fff7'], ['#6b2f3a', '#d9825b', '#3d1a22', '#ffd8bd'], ['#2b3a67', '#7d8fd0', '#1b2548', '#e3e9ff']],
  vault: [['#0e3b43', '#2a9d8f', '#0b2a30', '#bfffee'], ['#2a1f12', '#8a6a2a', '#17110a', '#ffe9a8'], ['#1a2a1f', '#4f8f5b', '#0f1a13', '#d6ffdd'], ['#2c1b3d', '#7a4aa0', '#1a1025', '#e8d0ff']],
  sky: [['#2f7de1', '#bfe3ff', '#2e7d4a', '#ffffff'], ['#f08a4b', '#ffd9a8', '#3a7a3a', '#fff3d6'], ['#6a5acd', '#f4b6d2', '#2d6a4f', '#ffe6f2'], ['#1b6ca8', '#9fe0e8', '#1f6f5a', '#e6ffff']],
  office: [['#3b4a6b', '#8fa3c7', '#4a3a2a', '#ffffff'], ['#5a3b4a', '#c79a8f', '#4a3326', '#fff0e6'], ['#2d5a5a', '#8fc7c0', '#3d3a2a', '#e8fffb'], ['#4a4a6b', '#a3a3d0', '#41352b', '#f0f0ff']],
  street: [['#232a4a', '#c0654a', '#2a2a33', '#ffd9a0'], ['#13384a', '#4fa3b8', '#262a30', '#d6f3ff'], ['#3a1f4a', '#c85a8a', '#27222e', '#ffd0e6'], ['#2a3a1f', '#a3b84f', '#2a2d22', '#f3ffd0']],
  kitchen: [['#e9d9b8', '#f5ecd6', '#8a6a44', '#ffffff'], ['#cfe3d9', '#e8f3ee', '#7a5a3a', '#ffffff'], ['#f0c9c0', '#f8e3de', '#8a5a44', '#fff6f2'], ['#c9d9ef', '#e3ecf8', '#7a6a4a', '#ffffff']],
  abstract: [['#1f2b6b', '#5c7cfa', '#141b45', '#dbe4ff'], ['#3b1c5a', '#c2559b', '#26103b', '#ffd6ee'], ['#0e4a3c', '#37b38a', '#09302a', '#d3ffee'], ['#4a2a12', '#e8913a', '#2f1a0b', '#fff0d6']],
};
const envFor = (kind: string): Env => ENV_OF[kind] ?? 'abstract';

/** Three-depth environment with a ground plane for the hero to stand on. cx = camera pan px; layers parallax at 0.2 / 0.5 / 0.9; blurred foreground shapes at 1.6 (depth of field). */
const Backdrop: React.FC<{w: number; h: number; env: Env; pal: [string, string, string, string]; cx: number; t: number; seed: number}> = ({w, h, env, pal, cx, t, seed}) => {
  const rnd = (i: number) => { const x = Math.sin((i + 1) * 91.7 + seed * 13.1) * 43758.5453; return x - Math.floor(x); };
  const tall = h > w, hz = h * (tall ? 0.67 : 0.6); // tall: lower horizon so the picture fills the frame down to the captions (no empty floor band)
  const bld = (layer: number, n: number, par: number, minH: number, maxH: number, col: string, op: number, lights: boolean) => Array.from({length: n}, (_, i) => {
    const bw = (w / n) * (1.05 + rnd(i + layer * 50) * 0.5), x = i * (w / n) * 1.0 - cx * par - 80 + rnd(i + layer * 70) * 40, bh = minH + rnd(i + layer * 30) * (maxH - minH);
    return (
      <g key={`${layer}${i}`} opacity={op}>
        <rect x={x} y={hz - bh} width={bw} height={bh + 6} fill={col} />
        {lights && Array.from({length: Math.floor(bh / 46)}, (_, r) => Array.from({length: Math.floor(bw / 40)}, (_, c) => ((Math.floor(t * 0.8 + r * 3 + c * 7 + i) % 5) !== 0 ? <rect key={`${r}-${c}`} x={x + 12 + c * 40} y={hz - bh + 14 + r * 46} width={18} height={22} fill={pal[3]} opacity={0.55} /> : null)))}
      </g>
    );
  });
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${pal[0]}, ${pal[1]} ${Math.round((hz / h) * 100)}%, ${pal[2]})`}}>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
        <defs><clipPath id={`fb-floor${seed}`}><rect x={0} y={hz} width={w} height={h - hz} /></clipPath></defs>
        <g id={`fb-up${seed}`}>
        <ellipse cx={w / 2 - cx * 0.3} cy={hz - h * 0.12} rx={w * 0.6} ry={h * 0.22} fill="url(#fb-glow)" opacity={0.35} />
        {Array.from({length: 18}, (_, i) => { const r = 6 + rnd(i) * 22, x = ((rnd(i + 40) * w * 1.4 - cx * 0.15 - t * (5 + r * 0.5)) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2; return <circle key={i} cx={x} cy={rnd(i + 80) * hz * 0.9} r={r} fill="#fff" opacity={0.04 + rnd(i + 5) * 0.1} />; })}
        {(env === 'city' || env === 'street') && <>{bld(1, 12, 0.2, h * 0.08, h * 0.26, '#000', 0.22, false)}{bld(2, 8, 0.5, h * 0.1, h * 0.36, pal[2], 0.55, true)}{bld(3, env === 'street' ? 3 : 4, 0.9, h * 0.18, h * (env === 'street' ? 0.62 : 0.5), '#000', 0.4, true)}</>}
        {env === 'sky' && <>{Array.from({length: 7}, (_, i) => { const x = ((rnd(i + 300) * w * 1.5 - cx * (0.2 + (i % 3) * 0.2) - t * (8 + i * 3)) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25, y = hz * (0.1 + rnd(i + 310) * 0.6), r = w * (0.08 + rnd(i + 320) * 0.1); return <g key={i} opacity={0.75}><ellipse cx={x} cy={y} rx={r * 1.6} ry={r * 0.5} fill="#fff" /><ellipse cx={x - r * 0.6} cy={y - r * 0.25} rx={r * 0.8} ry={r * 0.5} fill="#fff" /><ellipse cx={x + r * 0.5} cy={y - r * 0.2} rx={r * 0.7} ry={r * 0.45} fill="#fff" /></g>; })}
          <polygon points={`-50,${hz} ${w * 0.2 - cx * 0.4},${hz - h * 0.12} ${w * 0.5 - cx * 0.4},${hz - h * 0.04} ${w * 0.8 - cx * 0.4},${hz - h * 0.14} ${w + 50},${hz}`} fill="#2e7d4a" opacity={0.5} /></>}
        {env === 'office' && <>
          <rect x={w * 0.08 - cx * 0.3} y={h * 0.08} width={w * 0.5} height={h * 0.26} rx={10} fill="#fff" opacity={0.85} /><path d={`M${w * 0.12 - cx * 0.3} ${h * 0.14} q60 -30 120 0 t120 0 M${w * 0.12 - cx * 0.3} ${h * 0.2} h${w * 0.38} M${w * 0.12 - cx * 0.3} ${h * 0.26} h${w * 0.25}`} stroke={pal[1]} strokeWidth={8} fill="none" opacity={0.7} />
          <rect x={w * 0.66 - cx * 0.3} y={h * 0.1} width={w * 0.26} height={h * 0.3} rx={10} fill={pal[3]} opacity={0.35} />
          {Array.from({length: 4}, (_, i) => <rect key={i} x={w * (0.05 + i * 0.26) - cx * 0.6} y={hz - h * 0.14} width={w * 0.12} height={h * 0.14} rx={14} fill="#000" opacity={0.28} />)}</>}
        {env === 'kitchen' && <>{Array.from({length: 14}, (_, i) => <line key={`a${i}`} x1={i * w / 12 - cx * 0.2} y1={0} x2={i * w / 12 - cx * 0.2} y2={hz} stroke="#000" strokeOpacity={0.1} strokeWidth={3} />)}{Array.from({length: 8}, (_, i) => <line key={`b${i}`} x1={0} y1={i * hz / 7} x2={w} y2={i * hz / 7} stroke="#000" strokeOpacity={0.1} strokeWidth={3} />)}
          {[0.2, 0.5, 0.8].map((fx, i) => <g key={i}><line x1={w * fx - cx * 0.4} y1={0} x2={w * fx - cx * 0.4} y2={h * 0.12} stroke="#555" strokeWidth={5} /><circle cx={w * fx - cx * 0.4} cy={h * 0.17} r={w * 0.06} fill="#333" opacity={0.7} /></g>)}</>}
        {env === 'room' && <>
          <rect x={0} y={0} width={w} height={hz} fill="#000" opacity={0.12} />
          {[0.12, 0.62].map((fx, i) => <g key={i} transform={`translate(${w * fx - cx * 0.3} ${h * 0.1})`}><rect width={w * 0.26} height={h * 0.3} rx={14} fill={pal[3]} opacity={0.5} /><path d={`M${w * 0.13} 0V${h * 0.3}M0 ${h * 0.15}H${w * 0.26}`} stroke={pal[2]} strokeWidth={10} /><polygon points={`0,${h * 0.3} ${w * 0.26},${h * 0.3} ${w * 0.4},${hz - h * 0.1} ${w * 0.1},${hz - h * 0.1}`} fill={pal[3]} opacity={0.1} /></g>)}
          {Array.from({length: 7}, (_, i) => <rect key={i} x={i * w * 0.16 - cx * 0.5} y={hz - h * 0.2 - (i % 3) * 20} width={w * 0.1} height={h * 0.04 + (i % 3) * 14} rx={6} fill="#000" opacity={0.2} />)}
        </>}
        {env === 'vault' && <>
          {Array.from({length: 9}, (_, i) => <g key={i}><rect x={i * w * 0.14 - cx * 0.4} y={0} width={w * 0.13} height={hz} fill="#000" opacity={0.14 + (i % 2) * 0.1} />{[0.2, 0.5, 0.8].map(f => <circle key={f} cx={i * w * 0.14 - cx * 0.4 + 14} cy={hz * f} r={5} fill="#fff" opacity={0.25} />)}</g>)}
          <polygon points={`${w * 0.3},0 ${w * 0.7},0 ${w * 0.95},${hz} ${w * 0.05},${hz}`} fill="#fff" opacity={0.07} />
        </>}
        {env === 'abstract' && <>{Array.from({length: 7}, (_, i) => <circle key={i} cx={rnd(i + 90) * w - cx * 0.3} cy={hz * (0.15 + rnd(i + 99) * 0.6)} r={h * (0.05 + rnd(i) * 0.12)} fill="#fff" opacity={0.05 + rnd(i + 7) * 0.05} />)}{Array.from({length: 12}, (_, i) => <line key={i} x1={i * w / 11 - cx * 0.4} y1={0} x2={i * w / 11 - cx * 0.4 - 80} y2={hz} stroke="#fff" strokeOpacity={0.05} strokeWidth={3} />)}</>}
        </g>
        <rect x={0} y={hz} width={w} height={h - hz} fill={env === 'room' ? '#5a3a24' : pal[2]} opacity={env === 'room' ? 0.9 : 0.92} />
        {/* glossy floor: the scene above mirrored into it, so the lower frame carries picture instead of an empty dark band */}
        <use href={`#fb-up${seed}`} transform={`translate(0 ${2 * hz}) scale(1 -1)`} clipPath={`url(#fb-floor${seed})`} opacity={0.28} />
        <rect x={0} y={hz} width={w} height={h * 0.012} fill={pal[3]} opacity={0.25} />
        <ellipse cx={w / 2 - cx * 0.2} cy={hz + (h - hz) * 0.32} rx={w * 0.55} ry={(h - hz) * 0.3} fill="url(#fb-glow)" opacity={0.3} />
        {env === 'room' || env === 'office' || env === 'kitchen' ? Array.from({length: 9}, (_, i) => { const y = hz + (h - hz) * Math.pow(i / 9, 1.6); return <line key={i} x1={0} y1={y} x2={w} y2={y} stroke="#000" strokeOpacity={0.1} strokeWidth={3} />; })
          : Array.from({length: 11}, (_, i) => <line key={i} x1={w / 2 + (i - 5) * w * 0.04} y1={hz} x2={w / 2 + (i - 5) * w * 0.5 - cx * 1.2} y2={h} stroke="#fff" strokeOpacity={0.04} strokeWidth={3} />)}
        {(env === 'city' || env === 'street') && Array.from({length: 4}, (_, i) => { const u = ((t * 0.4 + i / 4) % 1); return <rect key={i} x={w / 2 - 14 * (0.3 + u) - cx * 0.4} y={hz + (h - hz) * u * u} width={28 * (0.3 + u * 2)} height={6 + u * 18} fill="#fff" opacity={0.25} />; })}
        <rect x={0} y={hz} width={w} height={h - hz} fill="url(#fb-groundfade)" />
      </svg>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, filter: `blur(${tall ? 14 : 10}px)`, opacity: 0.5, pointerEvents: 'none'}}>
        {Array.from({length: 4}, (_, i) => <ellipse key={i} cx={((rnd(i + 200) * w * 1.3 - cx * 1.6 - t * 14) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15} cy={h * (0.08 + rnd(i + 210) * 0.8)} rx={w * (0.05 + rnd(i + 220) * 0.07)} ry={w * (0.04 + rnd(i + 230) * 0.06)} fill={i % 2 ? pal[3] : '#fff'} opacity={0.35} />)}
      </svg>
    </div>
  );
};

// footage already moves: a clip gets a static cover crop (1.02 hides edges); a photo gets ONE slow move of <= 4.5% (in, out or a slow pan, alternating), never stacked
export const stockMove = (video: boolean, mv: number, p: number, w: number) => {
  const e = easeInOut(p), k = mv % 3;
  return {sc: video ? 1.02 : k === 0 ? 1 + 0.045 * e : k === 1 ? 1.045 - 0.045 * e : 1.045, tx: video || k !== 2 ? 0 : (e - 0.5) * w * 0.04 * (mv % 2 ? -1 : 1)};
};
/** Stage camera of a drawn beat: ONE visible move, like an editor: 0 = push in 6%, 1/2 = slow pan (no zoom), 3 = slow drift-rotate (no zoom); every 3rd beat just holds.
 *  'close' is a static framing (+4%), not added zoom. Over stock footage the drawn accent never moves the camera (the clip is the motion). */
export const stageCamera = (mv: number, close: boolean, index: number, stock: boolean, p: number, w: number) => {
  const hold = index % 3 === 2 || stock, e = easeInOut(p);
  return {sc: 1.02 + (close ? 0.04 : 0) + (!hold && mv === 0 ? 0.06 * e : 0), panX: hold ? 0 : mv === 1 ? (e - 0.5) * -0.08 * w : mv === 2 ? (e - 0.5) * 0.08 * w : 0, rot: !hold && mv === 3 ? (e - 0.5) * 1.6 : 0};
};
/** Visible zoom of one beat from the same functions the renderer uses (QA "motion" check): the continuous move of the layer that moves, the largest scale jump
 *  at a sub-shot cut, and how many layers zoom at once (must be <= 1). |log scale| units (0.05 ~ 5%). */
export function beatZoom(o: {mv: number; close: boolean; index: number; stockFile?: string; fixedStage: boolean; dur: number}) {
  const lg = (a: number, b: number) => Math.abs(Math.log(b / a)), video = !!o.stockFile && /\.mp4$/i.test(o.stockFile);
  const st0 = stageCamera(o.mv, o.close, o.index, !!o.stockFile, 0, 1000).sc, st1 = stageCamera(o.mv, o.close, o.index, !!o.stockFile, 1, 1000).sc;
  const ph = o.stockFile ? lg(stockMove(video, o.mv, 0, 1000).sc, stockMove(video, o.mv, 1, 1000).sc) : 0;
  const n = subShots(o.dur), subs = Array.from({length: n}, (_, k) => (k === 0 ? 1 : SUB_FRAMES[(k + o.index) % SUB_FRAMES.length][0]));
  // what scales at a cut: the drawn stage (unless its callouts pin it), the backdrop/photo wrapper by max(1, subZ); a clip is never reframed
  let cut = 0;
  for (let k = 1; k < n; k++) cut = Math.max(cut, video ? 0 : lg(Math.max(1, subs[k - 1]), Math.max(1, subs[k])), o.fixedStage || o.stockFile ? 0 : lg(subs[k - 1], subs[k]));
  const move = Math.max(lg(st0, st1), ph), layers = (lg(st0, st1) > 0.001 ? 1 : 0) + (ph > 0.001 ? 1 : 0);
  return {move, cut, layers};
}

/** Licensed b-roll fills the frame: photo gets a gentle Ken Burns move, video plays muted and still-framed; both are graded toward the scene palette with a vignette and a darker floor so captions stay readable. */
/** One colour grade per video (picked from the title): footage from ten sources and the drawn scenes read as shot together. A shared tint (soft-light) over every
 *  scene plus the same saturation/contrast on all footage; per-scene palette washes over stock are gone (they made each clip a different colour). */
export const GRADES = [
  {name: 'warm', tint: '#ffb27a', filter: 'saturate(1.06) contrast(1.06) sepia(0.08)'},
  {name: 'teal', tint: '#6fb7c9', filter: 'saturate(1.02) contrast(1.08) hue-rotate(-4deg)'},
  {name: 'gold', tint: '#ffd78a', filter: 'saturate(1.08) contrast(1.05) sepia(0.05)'},
] as const;
export const gradeFor = (title: string) => GRADES[[...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % GRADES.length];
/** Kinetic headline: the keyword, but never a bare small number with no unit ("2" said nothing on ep016 beat 5): then the longest content word. */
const NO_HEADLINE = /^(because|although|however|therefore|actually|really|without|through|whether|instead|another|anything|something|everything|nothing|remember|follow)$/i; // connectives say nothing alone ('BECAUSE', ep016)
export const kineticWord = (narration: string, emphasis: string[], label?: string) => {
  if (label && /\d/.test(label) && label.split(/\s+/).length <= 3) return label.replace(/(\d[\d,.]*)\s*dollars?\b/i, '$$$1'); // the storyboard's number label ('7.4 psi') beats a spelled-out number the keyword picker can't see ('seven point four')
  const k = pickKeyword(narration, emphasis), content = () => narration.replace(/[.!?,;:"]/g, '').split(/\s+/).filter(w => !isFunctionWord(w) && !NO_HEADLINE.test(w) && !/^\d+$/.test(w) && !isBareVerb(w)).sort((a, b) => b.length - a.length)[0];
  if (/^\d{1,2}$/.test(k) || (!k.includes(' ') && (isBareVerb(k) || NO_HEADLINE.test(k)))) return content() ?? k; // a bare small number or a bare verb ("CREATES", ep017) says nothing
  return k.split(' ').map(w => (/\d/.test(w) ? screenNumber(w) : w)).join(' '); // en-US or short: pickKeyword strips commas ('$10000000' -> '$10M', ep017)
};
/** QA zoom probe (scripts/qa/zoomFrames.ts renders with inputProps.qaMarks): four squares ride inside each camera layer and everything else is hidden,
 *  so the rendered frame shows exactly how much each layer scales, ancestors (transitions, wrappers) included. Stage squares sit apart from the others (overlap hid pixels). */
export const QA_MARK_COLORS = {stock: '#00ff00', backdrop: '#ff0000', stage: '#0000ff'} as const;
const qaMarks = () => !!(getInputProps() as {qaMarks?: boolean}).qaMarks;
const QaMarks: React.FC<{c: keyof typeof QA_MARK_COLORS; w: number; h: number; style?: React.CSSProperties}> = ({c, w, h, style}) => (
  <div className="qamk" style={{position: 'absolute', left: 0, top: 0, width: w, height: h, ...style}}>
    {(c === 'stage' ? [[0.38, 0.33], [0.62, 0.33], [0.38, 0.62], [0.62, 0.62]] : [[0.18, 0.18], [0.82, 0.18], [0.18, 0.5], [0.82, 0.5]]).map(([fx, fy], i) => <div key={i} style={{position: 'absolute', left: fx * w - w * 0.025, top: fy * h - w * 0.025, width: w * 0.05, height: w * 0.05, background: QA_MARK_COLORS[c]}} />)}
  </div>
);
const StockLayer: React.FC<{file: string; p: number; mv: number; w: number; h: number; pal: [string, string, string, string]; grade: string}> = ({file, p, mv, w, h, pal, grade}) => {
    const video = /\.mp4$/i.test(file), {sc, tx} = stockMove(video, mv, p, w);
  const style: React.CSSProperties = {position: 'absolute', inset: 0, width: w, height: h, objectFit: 'cover', transform: `translateX(${tx}px) scale(${sc})`, filter: grade};
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: pal[2]}}>
      {video ? <OffthreadVideo src={staticFile(file)} muted style={style} /> : <Img src={staticFile(file)} style={style} />}
      {qaMarks() && <QaMarks c="stock" w={w} h={h} style={{transform: style.transform}} />}
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0) 35%, rgba(0,0,0,0.3))'}} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6))'}} />
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

/** Assignment of anchors to line starts (<= 4: all permutations) with the fewest crossing segments, then the shortest total length. */
export function uncross(from: number[][], to: number[][]): number[] {
  const cross = (a: number[], b: number[], c: number[], d: number[]) => { const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const perms = (n: number[]): number[][] => (n.length <= 1 ? [n] : n.flatMap((x, i) => perms([...n.slice(0, i), ...n.slice(i + 1)]).map(r => [x, ...r])));
  let best = from.map((_, i) => i), score = Infinity;
  for (const p of from.length <= 4 ? perms(best) : [best]) {
    let c = 0, len = 0;
    p.forEach((j, i) => { len += Math.hypot(to[j][0] - from[i][0], to[j][1] - from[i][1]); p.forEach((k, m) => { if (m > i && cross(from[i], to[j], from[m], to[k])) c++; }); });
    if (c * 1e6 + len < score) { score = c * 1e6 + len; best = p; }
  }
  return best;
}
/** Callout label: pill with a leader line that draws to the hero. */
const calloutWidth = (text: string, size: number, maxW: number) => Math.min(size * 0.6 * text.length + size * 1.8, maxW);
const Callout: React.FC<{text: string; t: number; at: number; x: number; y: number; tx: number; ty: number; size: number; accent: string; align: 'left' | 'right' | 'down'; maxW: number; hp?: number}> = ({text, t, at, x, y, tx, ty, size, accent, align, maxW, hp}) => {
  const e = easeOut((t - at) / 0.35);
  if (e <= 0) return null;
  const wpx = calloutWidth(text, size, maxW), ax = align === 'left' ? x + wpx : align === 'down' ? x + wpx / 2 : x, ay0 = align === 'down' ? y + (hp ?? size * 1.6) : y + size * 0.8;
  return (
    <>
      {(align !== 'down' || hp) && <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
        {[['#0b0d1e', size * 0.2], ['#fff', size * 0.11]].map(([c, sw], k) => <line key={k} x1={ax} y1={ay0} x2={ax + (tx - ax) * e} y2={ay0 + (ty - ay0) * e} stroke={String(c)} strokeWidth={Number(sw)} strokeLinecap="round" />)}
        <circle cx={tx} cy={ty} r={size * 0.26 * e} fill={accent} stroke="#fff" strokeWidth={size * 0.09} /><circle cx={tx} cy={ty} r={size * 0.26 * e + size * 0.13} fill="none" stroke="#0b0d1e" strokeOpacity={0.5} strokeWidth={size * 0.05} />
      </svg>}
      <div style={{position: 'absolute', left: x, top: y, width: wpx, opacity: e, transform: `translateY(${(1 - e) * 30}px) scale(${0.9 + 0.1 * e})`, background: 'rgba(255,255,255,0.96)', color: '#16182a', fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, padding: `${size * 0.32}px ${size * 0.5}px`, borderRadius: size * 0.7, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', borderLeft: `${size * 0.22}px solid ${accent}`, textAlign: 'left'}}>{text}</div>
    </>
  );
};

/** Sub-shot framings [zoom, x shift (share of width), y shift (share of height)]: tight punch-in, wide pull-back, off-centre left/right. */
export const SUB_FRAMES: [number, number, number][] = [[1, 0.05, -0.01], [1.04, 0, -0.02], [1, -0.05, -0.01], [0.97, 0, -0.01]]; // gentle, and never downwards: a bigger punch-in cut the hero off, a lower one ran it into the captions
/** How many 2-3 s sub-shots a beat of `dur` seconds gets (one per started 2.8 s). */
export const subShots = (dur: number) => Math.max(1, Math.ceil(dur / 2.8));
/** Objects drawn edge to edge in their 400 box: at full hero size (box 1.15x the frame width) their sides were cut (ep016 receipts). */
const WIDE_ART = new Set(['receipts', 'bills', 'skyline', 'people', 'coin_stacks', 'bars3d', 'stacked_bars', 'line_chart', 'map_route', 'tax_form', 'person_bills', 'groceries', 'cart']);
const CHARTY = new Set(['line_chart', 'bars3d', 'bars_arrow', 'chart', 'pie', 'gauge']);

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
const NUMWORD = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)/i;
/** Counts only the number: units and words stay put, and the count finishes before the number is spoken. */
const Counter: React.FC<{s: Extract<Scene, {type: 'big_number'}>; t: number; w: number; y: number; accent: string; words: Word[]}> = ({s, t, w, y, accent, words}) => {
  const said = words.find(x => /\d/.test(x.w) || NUMWORD.test(x.w.replace(/[^a-z]/gi, '')));
  const end = Math.max(0.8, (said?.start ?? 1.4) - 0.05), k = seg(t, 0.15, end);
  const timeUnit = /^\s*(years?|months?|days?|weeks?|hours?|minutes?)\b/i.test(s.suffix), word = /^[a-z]/i.test(s.suffix.trim()) ? s.suffix.trim() : '';
  const prefix = timeUnit ? '' : s.prefix, unit = word || (timeUnit ? s.suffix.trim() : '');
  const num = `${prefix}${(s.value * k).toLocaleString('en-US', {minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals})}${word ? '' : s.suffix}`;
  const e = easeOut((t - 0.1) / 0.35), size = Math.min(w * 0.2, 230) * (num.length + unit.length > 9 ? 0.72 : 1);
  return (
    <div style={{position: 'absolute', left: 0, width: w, top: y, textAlign: 'center', opacity: e, transform: `scale(${0.8 + 0.2 * e})`}}>
      <div style={{display: 'inline-block', fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: '#fff', textShadow: `0 6px 0 ${accent}, 0 14px 34px rgba(0,0,0,0.5)`, WebkitTextStroke: '3px rgba(0,0,0,0.25)'}}>{num}{unit && <span style={{fontSize: size * 0.45, marginLeft: size * 0.12}}>{unit}</span>}</div>
      <div style={{marginTop: size * 0.12, fontFamily: SANS, fontWeight: 800, fontSize: size * 0.2, color: '#fff', background: 'rgba(10,12,30,0.7)', display: 'inline-block', padding: '8px 24px', borderRadius: 40, maxWidth: w * 0.86}}>{s.label}</div>
    </div>
  );
};

/** Split screen behind a compare/before_after: the frame is cut in two worlds (cool vs warm) along a slanted seam that wipes in, like an editor's split. */
const SplitScreen: React.FC<{t: number; w: number; h: number; tall: boolean; accent: string}> = ({t, w, h, tall, accent}) => {
  const e = easeOut(clamp((t - 0.15) / 0.45)), k = tall ? h * 0.06 : w * 0.06;
  const u = tall ? (k / h) * 50 : (k / w) * 50;
  const a = tall ? `polygon(0 0, 100% 0, 100% ${50 - u}%, 0 ${50 + u}%)` : `polygon(0 0, ${50 + u}% 0, ${50 - u}% 100%, 0 100%)`;
  const b = tall ? `polygon(0 ${50 + u}%, 100% ${50 - u}%, 100% 100%, 0 100%)` : `polygon(${50 + u}% 0, 100% 0, 100% 100%, ${50 - u}% 100%)`;
  const slide = (d: number) => (tall ? `translateY(${(e - 1) * h * 0.5 * d}px)` : `translateX(${(e - 1) * w * 0.5 * d}px)`);
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: e}}>
      <div style={{position: 'absolute', inset: 0, background: 'rgba(30,70,170,0.5)', clipPath: a, transform: slide(1)}} />
      <div style={{position: 'absolute', inset: 0, background: `${accent}80`, clipPath: b, transform: slide(-1)}} />
    </div>
  );
};

/** Tech beats: a phone notification slides down in the safe top zone (the UI a viewer knows from their own lock screen), app name + the beat's label. */
export const TECH = /\b(phones?|smartphones?|batter(y|ies)|apps?|screens?|charg\w*|wifi|notifications?|laptops?|computers?|chips?|data|internet|online)\b/i;
const Notification: React.FC<{app: string; text: string; t: number; w: number; h: number}> = ({app, text, t, w, h}) => {
  const e = easeOut(clamp((t - 0.35) / 0.35)), size = Math.min(w * 0.042, 46);
  return (
    <div style={{position: 'absolute', left: w * 0.08, width: w * 0.84, top: h * 0.115, transform: `translateY(${(e - 1) * h * 0.12}px)`, opacity: e, background: 'rgba(245,245,250,0.92)', borderRadius: size * 0.9, padding: `${size * 0.55}px ${size * 0.7}px`, boxShadow: '0 18px 50px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', gap: size * 0.6, fontFamily: SANS, color: '#16182a'}}>
      <div style={{width: size * 2, height: size * 2, borderRadius: size * 0.5, background: 'linear-gradient(160deg, #5ad66f, #1e9e3e)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: size}}>{app[0]}</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: size * 0.72, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1}}><span>{app}</span><span>now</span></div>
        <div style={{fontSize: size, fontWeight: 800, lineHeight: 1.15, marginTop: size * 0.15}}>{text}</div>
      </div>
    </div>
  );
};
/** Whether the top text zone of a beat is taken by the scene itself (then no punch word over it). */
export const topBusy = (scene: Scene, plan: ScenePlan | undefined, index: number, hook?: string) => ['big_number', 'title', 'chart', 'compare', 'before_after', 'list', 'checklist', 'stats', 'table', 'timeline'].includes(scene.type)
  || plan?.layout === 'kinetic' || (index === 0 && !!hook) || techBanner(scene, plan);
const techBanner = (scene: Scene, plan: ScenePlan | undefined) => scene.type === 'talk' && (plan?.layout === 'hero' || plan?.layout === 'pip') && TECH.test(scene.narration);
/** What the notification says: a system app a phone really has, and the sentence's first clause as a short line ("So stop charging your phone in the freezing cold." -> "Stop charging your phone in the freezing cold."). */
export function notice(sentence: string): {app: string; text: string} {
  const app = /batter|charg/i.test(sentence) ? 'Battery' : /wifi|internet|online|data/i.test(sentence) ? 'Wi-Fi' : /apps?\b/i.test(sentence) ? 'App Store' : 'Settings';
  // the clause that carries the tech word, else the longest one: a lead-in like 'In winter,' alone said nothing (fbw-ep014)
  const parts = sentence.split(/[,.;:!?]/).map(x => x.trim()).filter(Boolean), pick = parts.find(x => TECH.test(x) && x.split(/\s+/).length >= 3) ?? [...parts].sort((a, b) => b.length - a.length)[0] ?? '';
  const clause = pick.replace(/^(so|but|and|then|now|plus)\s+/i, '').split(/\s+/).slice(0, 8);
  while (clause.length > 2 && /^(the|a|an|in|of|to|your|and|for|on|at|with|is|are)$/i.test(clause[clause.length - 1])) clause.pop(); // never end on a dangling word
  return {app, text: clause.join(' ').replace(/^\w/, c => c.toUpperCase()) + '.'};
}

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

/** A library character (Fluent 3D person or reacting face) stands at the side of the hero: pops in after the hero, sways, a small hop on landing. */
/** Fetches a public file once per render (assets/lib is local-only: CI and fresh clones lack it, so a miss must fall back, never fail the render). */
function useStatic<T>(file: string | undefined, read: (r: Response) => Promise<T>): T | null | undefined {
  const [v, setV] = React.useState<T | null | undefined>(file ? undefined : null);
  const [handle] = React.useState(() => (file ? delayRender(`asset ${file}`) : null));
  React.useEffect(() => {
    if (!file || handle === null) return;
    fetch(staticFile(file), (read as unknown) === headOk ? {method: 'HEAD'} : undefined).then(r => (r.ok ? read(r) : null)).catch(() => null).then(x => { setV(x as T | null); continueRender(handle); });
  }, [file, handle, read]);
  return v;
}
const headOk = async () => true, json = (r: Response) => r.json() as Promise<LottieAnimationData>;

/** Real-footage loop (catalog background) as a drawn beat's backdrop: blurred by the wrapper, graded, darkened toward the floor so the hero and captions read. */
const LoopBackdrop: React.FC<{file: string; w: number; h: number; pal: [string, string, string, string]; grade: string; fallback: React.ReactNode}> = ({file, w, h, pal, grade, fallback}) => {
  const ok = useStatic(file, headOk);
  if (!ok) return <>{fallback}</>;
  return (
    <div style={{position: 'absolute', inset: 0, background: pal[2]}}>
      <OffthreadVideo src={staticFile(file)} muted style={{position: 'absolute', inset: 0, width: w, height: h, objectFit: 'cover', filter: `${grade} brightness(0.78)`}} />
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0) 30%, rgba(0,0,0,0.22) 62%, ${pal[2]}aa 100%)`}} />
    </div>
  );
};

const Character: React.FC<{id: string; t: number; w: number; feet: number; left: boolean}> = ({id, t, w, feet, left}) => {
  const [failed, setFailed] = React.useState(false), file = assetFile(id), anim = useStatic(animatedTwin(id), json); // the Noto animated twin when fetched, else the still
  if (!file || failed) return null;
  const size = Math.min(w * 0.3, feet * 0.42), e = pop(t, 0.45, 0.5), hop = Math.abs(Math.sin(Math.max(0, t - 0.45) * 2.2)) * size * 0.04 * Math.exp(-Math.max(0, t - 0.45) * 0.6);
  return (
    <div style={{position: 'absolute', left: left ? w * 0.05 : w * 0.95 - size, top: feet - size * 0.92 - hop, width: size, height: size, transform: `scale(${Math.max(0.01, e)}) rotate(${Math.sin(t * 1.4) * 3}deg)`, transformOrigin: '50% 100%', filter: 'drop-shadow(0 18px 18px rgba(0,0,0,0.35))'}}>
      {anim ? <Lottie animationData={anim} loop style={{width: '100%', height: '100%', transform: left ? undefined : 'scaleX(-1)'}} />
        : anim === null && <Img src={staticFile(file)} maxRetries={0} onError={() => setFailed(true)} style={{width: '100%', height: '100%', objectFit: 'contain', transform: left ? undefined : 'scaleX(-1)'}} />}
    </div>
  );
};

/** Shorts beat 1: the 5-7 word hookOverlay for muted viewers, built word by word; the number or longest content word sits on a caption-yellow plate (one accent colour per frame).
 *  Box = 9:16 safe zone top (220 px) down to just above the hero, centred in 84% of the width; captions (70%+) never reach it. */
export const hookKey = (hook: string) => { const ws = hook.split(/\s+/); return ws.find(x => /\d/.test(x)) ?? [...ws].filter(x => !isFunctionWord(x)).sort((a, b) => b.length - a.length)[0] ?? ws[0]; };
const HookOverlay: React.FC<{text: string; t: number; w: number; h: number; top: number; bottom: number; accent: string}> = ({text, t, w, h, top, bottom, accent}) => {
  const {fs, lines} = fitText(text.toUpperCase(), w * 0.84 * 0.88, bottom - top, Math.min(150, w * 0.14)), key = hookKey(text).toUpperCase();
  let k = 0;
  return (
    <div style={{position: 'absolute', left: w * 0.08, width: w * 0.84, top, textAlign: 'center', fontFamily: DISPLAY, fontSize: fs, lineHeight: 1.04, color: '#fff'}}>
      {lines.map((ln, li) => <div key={li}>{ln.split(' ').map((wd, wi) => {
        const e = easeOut(clamp((t + 0.12 - 0.06 * k++) / 0.18)), isKey = wd === key; // the first words are up on frame 0 (cover frame / first second), all in by ~0.4 s
        return <span key={wi} style={{display: 'inline-block', margin: `0 ${fs * 0.12}px`, opacity: e, transform: `translateY(${(1 - e) * fs * 0.35}px) ${isKey ? `rotate(${-2 * e}deg)` : ''}`, ...(isKey ? {background: '#ffe033', color: '#16182a', padding: `0 ${fs * 0.14}px`, borderRadius: fs * 0.1, boxShadow: '0 10px 30px rgba(0,0,0,0.45)'} : {textShadow: `0 ${fs * 0.05}px 0 rgba(0,0,0,0.55), 0 ${fs * 0.1}px ${fs * 0.3}px rgba(0,0,0,0.5)`}), WebkitTextStroke: `${fs * 0.025}px rgba(0,0,0,0.35)`}}>{wd}</span>;
      })}</div>)}
    </div>
  );
};

export const FullBleedScene: React.FC<FBProps> = ({scene, dec, frame, fps, accent, w, h, words, index, episodeTitle, prevKind, preroll = 0, plan: planIn, hook}) => {
  const f = frame + preroll, t = f / fps, dur = Math.max(1, dec.durSec), p = clamp(t / dur);
  const tall = h > w;
  const plan = planIn ?? planEpisode([scene], [words], [dur])[0];
  const shots = plan.shots;
  const active = Math.max(0, shots.reduce((a, s, i) => (t >= s.at ? i : a), 0));
  const kindAt = (tt: number) => shots[Math.max(0, shots.reduce((a, s, i) => (tt >= s.at ? i : a), 0))].kind;
  const env = plan.env as Env, pal = PALETTES_BY_ENV[env][plan.pal % 4];
  void prevKind;

  // continuous camera: one move per scene, never eased to a stop (linear progress); backdrop layers parallax against the stage. Close scenes sit tighter than wide ones.
  const grade = gradeFor(episodeTitle);
  const mv = plan.camera, {sc, panX, rot} = stageCamera(mv, plan.zoom === 'close', index, !!scene.stockFile, p, w), tiltY = 0;
  const ctxText = calloutTexts(scene).slice(0, tall ? 3 : 4), hasCallouts = ctxText.length > 0;
  const versus = scene.type === 'compare' || scene.type === 'before_after';
  // sub-shots: a long beat is cut into 2-3 s pieces, each a new framing (hard punch-in/out, like an editor's cut), so no picture holds > 3 s.
  // Beats with callouts/cards cut only the background (their labels and the object they label are laid out against the frame).
  const nSub = subShots(dur), sub = Math.min(nSub - 1, Math.floor(t / (dur / nSub)));
  const [subZ, subX, subY] = sub === 0 ? [1, 0, 0] : SUB_FRAMES[(sub + index) % SUB_FRAMES.length];
  const fixedStage = hasCallouts || versus;
  const stage = fixedStage ? `translate(${panX}px, ${tiltY}px) rotate(${rot}deg) scale(${sc})` : `translate(${panX + subX * w}px, ${tiltY + subY * h}px) rotate(${rot}deg) scale(${sc * subZ})`;
  // hero stands on the ground plane (y = 70% of a tall frame, so it ends above the captions at 72-80%; 74% of a wide one, above its captions at 78%+); its feet are at 82.5% of the 400 box
  const base = tall ? w * 1.15 : h * 0.86; // wider objects (scale, bars, calendar) span the whole 400 box: bigger and they get cut at the frame edge
  const lay = plan.layout, scale = hasCallouts ? (tall ? 0.5 : 0.72) : versus ? 0.58 : scene.type === 'title' ? 0.62 : scene.type === 'big_number' ? 0.64 : lay === 'kinetic' || (lay === 'hero' && techBanner(scene, plan)) ? 0.66 : lay === 'pip' || lay === 'broll' ? (tall ? 0.46 : 0.62) : 1; // over real footage the drawn subject is an accent, not the picture
  // charts draw down to their baseline: in a tall frame they stand higher so the captions (70-78%) never cross the plot (ep011-v2 beat 10)
  const charty = lay === 'dataviz' || scene.type === 'chart' || CHARTY.has(plan.shots[0]?.kind ?? '');
  // 16:9: a chart drawn at full size lost its top labels, and the right-third hero ran under the side title (golden fbw-03/05)
  const hs = base * scale * (tall ? (WIDE_ART.has(shots[0]?.kind ?? '') && scale === 1 ? 0.84 : 1) : charty ? 0.78 : plan.layout === 'hero' && scene.type === 'talk' && !scene.stockFile ? 0.82 : 1), groundY = tall ? h * (charty ? 0.66 : 0.7) : h * (charty ? 0.7 : 0.74), cy = groundY - 0.325 * hs;
  // top of the hero box after the close framing (feet at 82.5% of the 400 box, push <= 1.12 about 62% height): text above it never overlaps the art
  const heroTop = h * 0.62 + (groundY - 0.825 * hs - h * 0.62) * 1.12;
  const showHook = !!hook && tall && !hasCallouts && !versus && scene.type !== 'big_number';
  // 16:9 talk beat: rule of thirds, the hero on the right third and the key phrase as a side title on the left (a centred object left both sides empty)
  const sideTitle = !tall && plan.layout === 'hero' && scene.type === 'talk' && !scene.stockFile;
  const hx = hasCallouts && !tall ? w * 0.7 : sideTitle ? w * 0.66 : w / 2;
  const sweepX = (((t * 0.32) % 1.7) - 0.35) * w;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <svg width={0} height={0} style={{position: 'absolute'}}><GradDefs accent={accent} /></svg>
      {qaMarks() && <style>{'html,body{background:#000!important}body *{visibility:hidden!important}.qamk,.qamk *{visibility:visible!important}'}</style>}
      {scene.stockFile ? <div style={{position: 'absolute', inset: 0, transform: /\.mp4$/i.test(scene.stockFile) ? undefined : `scale(${1.05 * Math.max(1, subZ)}) translate(${subX * w * 0.4}px, 0px)`}}><StockLayer file={scene.stockFile} p={p} mv={mv} w={w} h={h} pal={pal} grade={grade.filter} /></div> : (
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1.12 * Math.max(1, subZ)}) translateX(${panX * 0.4 + subX * w * 0.3}px)`, transformOrigin: '50% 60%', filter: `blur(${tall ? 3 : 2}px)`}}>
        {plan.bgLoop ? <LoopBackdrop file={plan.bgLoop} w={w} h={h} pal={pal} grade={grade.filter} fallback={<Backdrop w={w} h={h} env={env} pal={pal} cx={panX} t={t} seed={index} />} /> : <Backdrop w={w} h={h} env={env} pal={pal} cx={panX} t={t} seed={index} />}
        {qaMarks() && <QaMarks c="backdrop" w={w} h={h} />}
      </div>)}
      {versus && <SplitScreen t={t} w={w} h={h} tall={tall} accent={accent} />}
      <div style={{position: 'absolute', inset: 0, transform: stage, transformOrigin: '50% 62%'}}>
        {qaMarks() && <QaMarks c="stage" w={w} h={h} />}
        {shots.map((s, i) => {
          const Obj = objectOf(s.kind), local = t - s.at + (plan.matchCut && i === 0 ? 1.2 : 0), end = shots[i + 1]?.at ?? 1e9, out = clamp((t - end) / 0.3);
          if (local < 0 || out >= 1 || !Obj) return null;
          const inE = easeOut(local / 0.3), bob = Math.sin(t * 1.3 + i) * hs * 0.008, over = 0.8 + 0.2 * pop(local, 0, 0.5);
          const isChart = scene.type === 'chart' && i === 0;
          // layout slots: x centre, hero-size factor, feet line, optional other subject, entry delay
          type Slot = {x: number; s: number; feet: number; kind: string; delay: number; main: boolean};
          const feet = groundY, Cmp = plan.companion ?? s.kind;
          const slots: Slot[] = lay === 'split' && !hasCallouts && !versus ? [{x: w * 0.27, s: 0.44, feet, kind: s.kind, delay: 0, main: true}, {x: w * 0.73, s: 0.44, feet, kind: Cmp, delay: 0.25, main: false}]
            : lay === 'grid' && !hasCallouts && !versus ? Array.from({length: 6}, (_, k) => ({x: w * (0.19 + (k % 3) * 0.31), s: 0.28, feet: feet - Math.floor(k / 3) * hs * 0.3 * 0.62 - (k % 3 === 1 ? 14 : 0), kind: s.kind, delay: k * 0.12, main: k === 1}))
            : lay === 'broll' ? [] // full-frame footage alone: a drawn gear over a sleeping person read as noise (semantic QA en-sleep-v4)
            : lay === 'pip' ? [{x: w * 0.74, s: 1, feet: h * 0.74, kind: s.kind, delay: 0, main: true}]
            : [{x: hx, s: 1, feet, kind: s.kind, delay: 0, main: true}];
          return slots.map((sl, si) => {
            const O = objectOf(sl.kind) ?? Obj, lt = local - sl.delay;
            if (lt < 0) return null;
            // reach: how far off-centre the object may sit and still be whole at the end of the camera push (<= 1.12 incl. close framing) and a 1.04 sub-shot
            const size = hs * sl.s * (lay === 'pip' ? 1 : 1) / (lay === 'split' || lay === 'grid' ? scale : 1), reach = lay === 'split' || lay === 'grid' ? w / 2 - size * 0.4 : Math.max(0, w / 2 / 1.12 / 1.04 - size * 0.47), sx0 = w / 2 + Math.max(-reach, Math.min(reach, sl.x - w / 2)), sy0 = sl.feet - 0.325 * size;
            const ac = actionCopies(sl.main ? s.action : 'pop_in', lt);
            return (
              <React.Fragment key={`${i}-${si}`}>
                {ac.copies.map((cp, ci) => {
                  const st: React.CSSProperties = {position: 'absolute', left: sx0 - size / 2 + cp.tx * size, top: sy0 - size / 2 + bob + cp.ty * size, overflow: 'visible', opacity: (1 - easeInOut(out)) * clamp(Math.min(inE, easeOut(lt / 0.3)) * 1.5) * cp.op, transform: `scale(${over * (1 + 0.12 * easeInOut(out)) * cp.sc * (cp.sx ?? 1)}, ${over * (1 + 0.12 * easeInOut(out)) * cp.sc * (cp.scY ?? 1)}) rotate(${cp.rot + Math.sin(t * 0.9 + i) * 1.2}deg) translateX(${out * -w * 0.06}px)`, filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.35))', clipPath: cp.clip === 'left' ? 'inset(0 50% 0 0)' : cp.clip === 'right' ? 'inset(0 0 0 50%)' : undefined};
                  return (
                    <svg key={ci} viewBox="0 0 400 400" width={size} height={size} style={st}>
                      {isChart && scene.type === 'chart' && sl.main ? <ChartBars labels={scene.chart.labels} values={scene.chart.values} t={lt} /> : <O t={lt} accent={accent} value={i === 0 && sl.main ? (scene.type === 'big_number' ? scene.value : typeof scene.shot?.number === 'number' ? scene.shot.number : undefined) : undefined} />}
                    </svg>
                  );
                })}
                {sl.main && ac.overlay && (() => { const os = Math.min(size, w * 0.9); return <div style={{position: 'absolute', left: sx0 - os / 2, top: sy0 - os / 2, width: os, height: os, opacity: 1 - out}}><ActionOverlay kind={ac.overlay} u={lt} size={os} /></div>; })()} {/* the overlay box stays inside the frame: on a full-size hero (1242 px box) the check badge sat off the right edge (ep016) */}
                <svg viewBox="0 0 400 400" width={size} height={size} style={{position: 'absolute', left: sx0 - size / 2, top: sy0 - size / 2 + bob + 0.65 * size, overflow: 'visible', opacity: (1 - easeInOut(out)) * clamp(inE * 1.5) * (tall ? 0.36 : 0.22), transform: `scaleY(-1) scale(${over})`, WebkitMaskImage: `linear-gradient(to top, #000 0%, transparent ${tall ? 68 : 52}%)`, maskImage: `linear-gradient(to top, #000 0%, transparent ${tall ? 68 : 52}%)`, filter: 'blur(2px)', pointerEvents: 'none'}}>
                  {isChart && scene.type === 'chart' && sl.main ? <ChartBars labels={scene.chart.labels} values={scene.chart.values} t={lt} /> : <O t={lt} accent={accent} value={undefined} />}
                </svg>
                {sl.main && <div style={{position: 'absolute', inset: 0, opacity: 1 - out}}><Particles t={lt} w={w} h={h} cx={sx0} cy={sy0} money={MONEY.has(sl.kind)} accent={accent} seed={index * 7 + i} /></div>}
              </React.Fragment>
            );
          });
        })}
      </div>
      {lay === 'kinetic' && !showHook && (() => { const top = tall ? h * 0.115 : h * 0.08, {fs, lines} = fitText(kineticWord(scene.narration, scene.emphasis, scene.shot?.label).toUpperCase(), w * 0.84, (tall ? heroTop - 30 : h * 0.3) - top, Math.min(w * 0.18, 220), 1), e2 = easeOut((t - 0.1) / 0.3); return <div style={{position: 'absolute', left: w * 0.08, width: w * 0.84, top, textAlign: 'center', fontFamily: DISPLAY, fontSize: fs, lineHeight: 1, color: '#fff', textShadow: `0 8px 0 ${accent}, 0 18px 40px rgba(0,0,0,0.55)`, WebkitTextStroke: '4px rgba(0,0,0,0.3)', opacity: e2, transform: `scale(${0.7 + 0.3 * e2}) rotate(${-2 * e2}deg)`}}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>; })()}
      {showHook && <HookOverlay text={hook!} t={t} w={w} h={h} top={h * 0.115} bottom={heroTop - 30} accent={accent} />}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: 'linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${sweepX}px)`, width: w * 0.9}} />
      {/* key light from the upper left + falloff to the lower right: one consistent light source reads as a lit 3D set, not flat vectors */}
      {!scene.stockFile && <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light', background: 'radial-gradient(ellipse 80% 60% at 22% 18%, rgba(255,244,220,0.85), rgba(255,244,220,0) 60%), linear-gradient(160deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45))'}} />}
      {scene.type === 'title' && !showHook && <div style={{position: 'absolute', left: w * 0.06, width: w * 0.88, top: tall ? 250 : h * 0.1, textAlign: 'center', fontFamily: DISPLAY, fontSize: Math.min(w * 0.115, 150), lineHeight: 1.04, color: '#fff', textShadow: `0 6px 0 ${accent}, 0 12px 30px rgba(0,0,0,0.5)`, opacity: easeOut((t - 0.1) / 0.35), transform: `translateY(${(1 - easeOut((t - 0.1) / 0.35)) * -40}px)`}}>{episodeTitle}</div>}
      {scene.type === 'big_number' && <Counter s={scene} t={t} w={w} y={tall ? h * 0.12 : h * 0.14} accent={accent} words={words} />}
      {versus && <Versus a={scene.type === 'compare' ? scene.left : scene.before} b={scene.type === 'compare' ? scene.right : scene.after} t={t} w={w} h={h} y={tall ? h * 0.085 : h * 0.07} accent={accent} />}
      {hasCallouts && (() => {
        const size = tall ? 48 : 44, maxW = tall ? w * 0.86 : w * 0.4;
        const cut = (raw: string) => (raw.length > 38 ? raw.slice(0, 36).replace(/[\s,;:]+\S*$/, '') + '…' : raw);
        const hOf = (txt: string) => Math.max(1, Math.ceil((txt.length * size * 0.6) / Math.max(1, calloutWidth(txt, size, maxW) - size * 1.8))) * size * 1.12 + size * 1.29;
        // tall: the stack sits just above the object it labels (pills by their real wrapped height); ONE short leader from the stack's last pill down to the object
        // ties the data to the thing (reference) - a line per pill crossed the other pills and read as debug pins
        const total = ctxText.reduce((a, r) => a + hOf(cut(r)), 0), objTop = h * 0.62 + (cy - 0.41 * hs - h * 0.62) * sc;
        let y = tall ? Math.max(h * 0.075, objTop - total - size * 0.4) : h * 0.14;
        const rows = ctxText.map((raw, i) => {
          const txt = cut(raw), wp = calloutWidth(txt, size, maxW), yy = y;
          y += hOf(txt);
          const at = 0.5 + i * Math.max(0.8, (dur - 1) / ctxText.length), [ax, ay] = anchorOf(kindAt(at), i);
          const px = hx - hs / 2 + (ax * hs) / 400, py = cy - hs / 2 + (ay * hs) / 400; // anchor on the real part of the object, carried through the camera move
          return {txt, wp, yy, at, x: tall ? (w - wp) / 2 : w * 0.04, tx: w / 2 + (px - w / 2) * sc + panX, ty: h * 0.62 + (py - h * 0.62) * sc + tiltY};
        });
        // 16:9 leader lines: the anchors go to the pills in the order with no crossing lines (fb-wide beat 4 had three crossing)
        const perm = tall ? rows.map((_, i) => i) : uncross(rows.map(r => [r.x + r.wp, r.yy + size * 0.8]), rows.map(r => [r.tx, r.ty]));
        return rows.map((r, i) => <Callout key={i} text={r.txt} t={t} at={r.at} x={r.x} y={r.yy} tx={rows[perm[i]].tx} ty={rows[perm[i]].ty} size={size} accent={accent} align={tall ? 'down' : 'left'} maxW={maxW} hp={tall && i === rows.length - 1 ? hOf(r.txt) - size * 0.5 : undefined} />);
      })()}
      {sideTitle && (() => { const kw = kineticWord(scene.narration, scene.emphasis, scene.shot?.label).toUpperCase().slice(0, 28), e2 = easeOut((t - 0.15) / 0.35), fs = Math.min(h * 0.13, (w * 0.4) / (Math.max(4, ...kw.split(/\s+/).map(x => x.length)) * 0.62));
        return <div style={{position: 'absolute', left: w * 0.06, width: w * 0.42, top: h * 0.2, fontFamily: DISPLAY, fontSize: fs, lineHeight: 1.02, color: '#fff', textShadow: `0 6px 0 ${accent}, 0 16px 36px rgba(0,0,0,0.5)`, opacity: e2, transform: `translateX(${(1 - e2) * -40}px)`}}>{kw}<div style={{marginTop: fs * 0.25, height: fs * 0.12, width: `${60 * easeOut((t - 0.35) / 0.4)}%`, background: accent, borderRadius: fs * 0.06}} /></div>; })()}
      {techBanner(scene, plan) && !showHook && !sideTitle && <Notification {...notice(scene.narration)} t={t} w={w} h={h} />}
      {/* reaction after the detail: in a beat with sub-shots the character enters on the last one (wide -> close -> reaction) */}
      {plan.character && !sideTitle && <Character id={plan.character} t={t - (nSub >= 2 ? (nSub - 1) * dur / nSub - 0.45 : 0)} w={w} feet={groundY} left={index % 2 === 0} />}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)'}} />
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: grade.tint, mixBlendMode: 'soft-light', opacity: 0.28}} />
      {active < 0 && null}
    </div>
  );
};
