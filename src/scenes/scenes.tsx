import {inflectionIndex} from '../fx/inflection';
import React from 'react';
import type {Scene} from '../schema';
import type {SceneDecision} from '../director/types';
import {BOIL_STYLE} from '../fx/boil';
import {QuoteCard} from '../fx/overlays';
import {DISPLAY, INK, SANS, backOut, clamp, easeInOut, easeOut} from '../theme';

export type Box = {x: number; y: number; w: number; h: number};
export type SceneProps<S extends Scene = Scene> = {
  scene: S;
  dec: SceneDecision;
  frame: number;
  fps: number;
  accent: string;
  box: Box;
  intro: string;
  episodeTitle: string;
  keyword: string;
};

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
const pop = (t: number, frame: number, fps: number, dur = 0.4) => backOut((frame / fps - t) / dur);
const fade = (t: number, frame: number, fps: number, dur = 0.25) => clamp((frame / fps - t) / dur);

const Underline: React.FC<{w: number; progress: number; color: string; y?: number}> = ({w, progress, color, y = 0}) => {
  // two hand-drawn passes (second slightly offset) so it reads as a marker underline, not a dash
  const d1 = `M6 14 C${w * 0.2} 6 ${w * 0.4} 20 ${w * 0.6} 11 S${w * 0.9} 8 ${w - 6} 15`;
  const d2 = `M${w * 0.08} 24 C${w * 0.3} 17 ${w * 0.55} 27 ${w - 20} 21`;
  const p2 = clamp((progress - 0.35) / 0.65);
  if (progress <= 0.03) return null; // round caps would show a dot at progress 0
  return (
    <svg width={w} height={34} style={{position: 'absolute', left: 0, top: y, overflow: 'visible'}}>
      <path d={d1} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - clamp(progress))} />
      <path d={d2} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - p2)} opacity={p2 > 0.005 ? 1 : 0} />
    </svg>
  );
};

const Frame: React.FC<{box: Box; children: React.ReactNode; justify?: string}> = ({box, children, justify = 'center'}) => (
  <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', flexDirection: 'column',
    justifyContent: justify, alignItems: 'center', textAlign: 'center'}}>{children}</div>
);

// ------------------------------------------------------------ title
export const TitleScene: React.FC<SceneProps> = ({frame, fps, accent, box, intro, episodeTitle}) => {
  const t = frame / fps;
  let style: React.CSSProperties = {};
  let draw = easeInOut((t - 0.5) / 0.8);
  if (intro === 'pop') style = {transform: `scale(${0.6 + 0.4 * pop(0.1, frame, fps, 0.5)})`, opacity: fade(0.1, frame, fps, 0.1)};
  else if (intro === 'slide') style = {transform: `translateX(${(1 - easeOut((t - 0.1) / 0.6)) * -120}px)`, opacity: fade(0.1, frame, fps, 0.2)};
  else style = {clipPath: `inset(0 ${(1 - easeInOut((t - 0.1) / 0.9)) * 100}% 0 0)`};
  return (
    <Frame box={box}>
      <div style={{position: 'relative', ...style}}>
        <div style={{fontFamily: DISPLAY, fontSize: episodeTitle.length > 36 ? 88 : 104, lineHeight: 1.08, color: INK, maxWidth: box.w}}>{episodeTitle}</div>
        <div style={{position: 'relative', height: 30, marginTop: 6, width: 900, margin: '6px auto 0'}}><Underline w={900} progress={draw} color={accent} /></div>
      </div>
    </Frame>
  );
};

// ------------------------------------------------------------ talk
export const TalkScene: React.FC<SceneProps> = ({scene, dec, frame, fps, accent, box, keyword}) => {
  if (!['keyword_side', 'over_shoulder'].includes(dec.layout)) return null;
  const t0 = dec.punchIns[0]?.t ?? dec.speechStart + 0.6;
  if (scene.type === 'talk' && scene.quote) return <QuoteCard text={scene.quote.text} by={scene.quote.by} t={frame / fps} at={dec.speechStart + 0.2} accent={accent} width={box.w} x={box.x} y={box.y} />;
  const p = pop(t0, frame, fps, 0.45);
  return (
    <Frame box={box}>
      <div style={{position: 'relative', transform: `scale(${0.5 + 0.5 * p}) rotate(${(1 - p) * -4}deg)`, opacity: fade(t0, frame, fps, 0.1)}}>
        <div style={{fontFamily: DISPLAY, fontSize: Math.min(130, Math.floor(box.w / (Math.max(keyword.length, 1) * 0.62))), lineHeight: 1.05, color: accent, textTransform: 'uppercase', maxWidth: box.w}}>{keyword}</div>
        <div style={{position: 'relative', height: 30, margin: '10px auto 0', width: 640}}><Underline w={640} progress={easeInOut((frame / fps - t0 - 0.2) / 0.5)} color={INK} /></div>
      </div>
    </Frame>
  );
};

// ------------------------------------------------------------ big number
export const BigNumberScene: React.FC<SceneProps<Extract<Scene, {type: 'big_number'}>>> = ({scene, dec, frame, fps, accent, box}) => {
  const [cs, ce] = dec.elements;
  const t = frame / fps;
  const prog = easeOut((t - cs) / (ce - cs));
  const shown = t < cs ? 0 : scene.value * prog;
  const landed = t >= ce ? backOut((t - ce) / 0.35) : 0;
  const text = `${scene.prefix}${fmt(t >= ce ? scene.value : shown, scene.decimals)}${scene.suffix}`;
  const base = text.length > 9 ? 190 : text.length > 7 ? 230 : 280;
  const fitW = Math.max(1, box.w - 40);
  const size = Math.min(base, Math.floor(fitW / (Math.max(text.length, 1) * 0.66))); // glyph width ~0.66em: the number never overflows its box
  const ulW = Math.min(fitW, Math.round(size * 0.62 * Math.max(text.length, 1)) + 24); // matches the number's width
  return (
    <Frame box={box}>
      <div style={{opacity: fade(0.1, frame, fps), position: 'relative', maxWidth: box.w}}>
        <div style={{fontFamily: DISPLAY, fontSize: size, whiteSpace: 'nowrap', lineHeight: 1, color: accent, transform: `scale(${1 + 0.12 * Math.sin(Math.PI * clamp(landed))})`, fontVariantNumeric: 'tabular-nums'}}>{text}</div>
        <div style={{position: 'relative', height: 40, width: ulW, margin: '4px auto 0'}}><Underline w={ulW} progress={easeInOut((t - ce) / 0.6)} color={INK} /></div>
        <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 44, lineHeight: 1.25, color: INK, marginTop: 30, maxWidth: Math.min(box.w, 1000), marginLeft: 'auto', marginRight: 'auto', overflowWrap: 'anywhere', opacity: fade(cs + 0.3, frame, fps, 0.4)}}>{scene.label}</div>
      </div>
    </Frame>
  );
};

// ------------------------------------------------------------ chart
function niceMax(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
export const ChartScene: React.FC<SceneProps<Extract<Scene, {type: 'chart'}>>> = ({scene, dec, frame, fps, accent, box}) => {
  const {chart} = scene;
  const [ds, de] = dec.elements;
  const t = frame / fps;
  const p = easeInOut((t - ds) / Math.max(0.1, de - ds));
  const padL = 190, padB = 110, padT = 60, padR = 60;
  const W = box.w, H = box.h;
  const pw = W - padL - padR, ph = H - padB - padT;
  const top = niceMax(Math.max(...chart.values));
  const bottom = chart.kind === 'bar' ? 0 : Math.min(0, Math.min(...chart.values));
  const yOf = (v: number) => padT + ph - ((v - bottom) / (top - bottom)) * ph;
  const n = chart.values.length;
  const xOf = (i: number) => (chart.kind === 'bar' ? padL + ((i + 0.5) / n) * pw : padL + (i / (n - 1)) * pw);
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => bottom + f * (top - bottom));
  const pts = chart.values.map((v, i) => `${i ? 'L' : 'M'}${xOf(i)} ${yOf(v)}`).join(' ');
  const k = chart.kind === 'line' ? inflectionIndex(chart.values) : -1;
  const barW = Math.min(180, (pw / n) * 0.55);
  const fmtTick = (v: number) => (v === 0 ? '0' : top >= 1e6 ? `${fmt(v / 1e6, 1)}M` : top >= 1e4 ? `${fmt(v / 1e3)}k` : fmt(v));
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: W, height: H, opacity: fade(0.1, frame, fps)}}>
      <svg width={W} height={H} style={{overflow: 'visible'}}>
        {ticks.map((v, i) => (
          <g key={i}>
            <path d={`M${padL} ${yOf(v)} H${W - padR}`} stroke={INK} strokeOpacity={0.14} strokeWidth={3} strokeDasharray="4 14" />
            <text x={padL - 18} y={yOf(v) + 12} textAnchor="end" fontFamily={SANS} fontWeight={500} fontSize={34} fill={INK}>{fmtTick(v)}</text>
          </g>
        ))}
        <path d={`M${padL} ${padT - 10} V${yOf(bottom)} H${W - padR + 10}`} fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        {chart.labels.map((l, i) => (
          <text key={i} x={xOf(i)} y={H - padB + 62} textAnchor="middle" fontFamily={SANS} fontWeight={500} fontSize={36} fill={INK}>{l}</text>
        ))}
        {chart.kind === 'line' && (
          <>
            <path d={pts} fill="none" stroke={accent} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
            {chart.values.map((v, i) => {
              const shownAt = i / (n - 1);
              const s = backOut((p - shownAt) / 0.12 + (i === 0 ? 1 : 0));
              return p >= shownAt - 0.001 ? <circle key={i} cx={xOf(i)} cy={yOf(v)} r={16 * clamp(s, 0, 1.2)} fill="#fffdf6" stroke={INK} strokeWidth={7} /> : null;
            })}
            {k >= 0 && p >= k / (n - 1) + 0.04 && (() => {
              const e = easeOut((p - k / (n - 1) - 0.04) / 0.1);
              const cx = xOf(k), cy = yOf(chart.values[k]);
              return (
                <g opacity={e}>
                  <circle cx={cx} cy={cy} r={20 + 22 * e} fill="none" stroke={INK} strokeWidth={6} strokeDasharray="10 8" />
                  <text x={cx} y={cy + 96} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={36} fill={INK}>{chart.labels[k]}: {fmt(chart.values[k])}</text>
                </g>
              );
            })()}
            {p > 0.98 && (
              <text x={xOf(n - 1)} y={yOf(chart.values[n - 1]) - 34} textAnchor="end" fontFamily={DISPLAY} fontSize={54} fill={INK}>{fmt(chart.values[n - 1])}</text>
            )}
          </>
        )}
        {chart.kind === 'bar' && chart.values.map((v, i) => {
          const local = clamp(p * n - i);
          const h = (yOf(bottom) - yOf(v)) * easeOut(local);
          return (
            <g key={i}>
              <rect x={xOf(i) - barW / 2} y={yOf(bottom) - h} width={barW} height={h} fill={i === n - 1 ? accent : '#fffdf6'} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
              {local > 0.95 && <text x={xOf(i)} y={yOf(v) - 22} textAnchor="middle" fontFamily={DISPLAY} fontSize={46} fill={INK}>{fmt(v)}</text>}
            </g>
          );
        })}
        {chart.yLabel && (
          <text transform={`translate(34 ${padT + ph / 2}) rotate(-90)`} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={32} fill={INK} opacity={0.75}>{chart.yLabel}</text>
        )}
      </svg>
    </div>
  );
};

// ------------------------------------------------------------ compare
export const CompareScene: React.FC<SceneProps<Extract<Scene, {type: 'compare'}>>> = ({scene, dec, frame, fps, accent, box}) => {
  const centre = dec.layout === 'split_char_center';
  const gap = centre ? 520 : 200;
  const ch = centre ? box.h - 200 : box.h - 340; // card height; split leaves room for the mascot below
  const cw = (box.w - gap) / 2;
  const card = (side: {title: string; value: string}, t: number, x: number, hot: boolean) => {
    const p = pop(t, frame, fps, 0.45);
    return (
      <div style={{position: 'absolute', left: x, top: 40, width: cw, height: ch, opacity: fade(t, frame, fps, 0.1), transform: `scale(${0.7 + 0.3 * p}) rotate(${(1 - p) * (hot ? 3 : -3)}deg)`}}>
        <svg width={cw} height={ch} style={{position: 'absolute', overflow: 'visible'}}>
          <rect x={6} y={6} width={cw - 12} height={ch - 12} rx={26} fill={hot ? accent : '#fffdf6'} fillOpacity={hot ? 0.9 : 1} stroke={INK} strokeWidth={8} />
        </svg>
        <div style={{position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '36px 56px', boxSizing: 'border-box', textAlign: 'center', overflow: 'hidden'}}>
          <div style={{fontFamily: DISPLAY, fontSize: Math.min(side.value.length > 7 ? 120 : 170, Math.floor((cw - 112) / (Math.max(side.value.length, 1) * 0.62))), lineHeight: 1, whiteSpace: 'nowrap', color: hot ? '#fffdf6' : INK}}>{side.value}</div>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 44, lineHeight: 1.2, marginTop: 26, maxWidth: cw - 112, overflowWrap: 'anywhere', color: hot ? '#fffdf6' : INK}}>{side.title}</div>
        </div>
      </div>
    );
  };
  const vs = fade(dec.elements[1], frame, fps, 0.2);
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h}}>
      {card(scene.left, dec.elements[0], 0, false)}
      {card(scene.right, dec.elements[1], cw + gap, true)}
      <div style={{position: 'absolute', left: cw, width: gap, top: 40 + ch / 2 - 50, textAlign: 'center', fontFamily: DISPLAY, fontSize: 80, color: INK, opacity: vs * (dec.layout === 'split_char_center' ? 0 : 1)}}>VS</div>
    </div>
  );
};

// ------------------------------------------------------------ list
export const ListScene: React.FC<SceneProps<Extract<Scene, {type: 'list'}>>> = ({scene, dec, frame, fps, accent, box}) => {
  const n = scene.items.length;
  const size = n > 4 ? 52 : n > 3 ? 60 : 68;
  const gap = n > 4 ? 22 : 30;
  const rowH = Math.min(190, (box.h - gap * (n - 1)) / n);
  return (
    <Frame box={box}>
      <div style={{display: 'flex', flexDirection: 'column', gap, alignItems: 'stretch', width: box.w}}>
        {scene.items.map((item, i) => {
          const t = dec.elements[i];
          const p = pop(t, frame, fps, 0.4);
          const shown = fade(t, frame, fps, 0.12);
          return (
            <div key={i} style={{position: 'relative', height: rowH}}>
              {/* ghost slot keeps the frame filled before the item lands */}
              <div style={{position: 'absolute', inset: 0, borderRadius: 24, border: `5px dashed ${INK}`, opacity: 0.16 * (1 - shown)}} />
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 34, padding: '0 38px', borderRadius: 24,
                border: `7px solid ${INK}`, background: '#fffdf6', opacity: shown, transform: `translateX(${(1 - easeOut((frame / fps - t) / 0.35)) * 90}px)`}}>
                <div style={{width: 96, height: 96, flex: 'none', borderRadius: '50%', border: `8px solid ${INK}`, background: accent, color: '#fffdf6', fontFamily: DISPLAY, fontSize: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.4 + 0.6 * p})`}}>{i + 1}</div>
                <div style={{fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.15, color: INK, textAlign: 'left'}}>{item}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

export const SceneContent: React.FC<SceneProps> = props => {
  const s = props.scene;
  switch (s.type) {
    case 'title': return <TitleScene {...props} />;
    case 'talk': return <TalkScene {...props} />;
    case 'big_number': return <BigNumberScene {...(props as SceneProps<typeof s>)} />;
    case 'chart': return <ChartScene {...(props as SceneProps<typeof s>)} />;
    case 'compare': return <CompareScene {...(props as SceneProps<typeof s>)} />;
    case 'list': return <ListScene {...(props as SceneProps<typeof s>)} />;
  }
};
export {BOIL_STYLE};
