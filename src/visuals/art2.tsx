import React from 'react';
import {INK, clamp} from '../theme';
import {Coin, Ctx, D, GOLD, GOLD2, GREEN, PAPER2, Pop, RED, SKY, Sparkle, Txt, seg, segIO, soft, sp, wave} from './kit';

type I = React.FC<Ctx>;

const Bars: React.FC<{t: number; up: boolean; color: string}> = ({t, up, color}) => (
  <>
    {[0, 1, 2, 3, 4].map(i => {
      const h = up ? 28 + i * 20 : 108 - i * 20, s = seg(t, 0.05 + i * 0.1, 0.5 + i * 0.1);
      return <g key={i} transform={`translate(0 170) scale(1 ${Math.max(0.001, s)}) translate(0 -170)`}><rect x={26 + i * 32} y={170 - h} width={22} height={h} rx={3} fill={i === 4 ? color : soft(color, 0.35)} stroke={INK} strokeWidth={4} /></g>;
    })}
  </>
);
const Arrow: React.FC<{t: number; up: boolean; color: string}> = ({t, up, color}) => {
  const bob = wave(t, 1.6) * 5 * seg(t, 1, 1.4);
  const d = up ? 'M24 150 70 108l26 20 62-66' : 'M24 56l46 42 26-20 62 66';
  const head = up ? 'M118 58h44v44' : 'M118 148h44v-44';
  return (
    <g transform={`translate(0 ${up ? -bob : bob})`}>
      <D d={d} t={t} a={0.5} b={1.2} w={16} stroke={INK} /><D d={d} t={t} a={0.5} b={1.2} w={8} stroke={color} />
      <D d={head} t={t} a={1.1} b={1.5} w={16} stroke={INK} /><D d={head} t={t} a={1.1} b={1.5} w={8} stroke={color} />
    </g>
  );
};
export const ArrowUp: I = ({t}) => <g><Bars t={t} up color={GREEN} /><Arrow t={t} up color={GREEN} /></g>;
export const ArrowDown: I = ({t, accent}) => <g><Bars t={t} up={false} color={accent} /><Arrow t={t} up={false} color={accent} /></g>;

export const Scale: I = ({t, accent}) => {
  const ang = (wave(t, 3.2) * 7 + 8) * seg(t, 0.4, 1.1) + (1 - seg(t, 0.2, 0.8)) * -20;
  const pan = (side: number, heavy: boolean) => {
    const x = 100 + side * 66;
    return (
      <g transform={`rotate(${-ang} ${x} 54)`}>
        <path d={`M${x} 54l-26 52h52z`} fill="none" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <path d={`M${x - 34} 106h68a34 18 0 0 1-68 0z`} fill={PAPER2} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        {heavy ? <><Coin x={x - 10} y={96} r={11} /><Coin x={x + 12} y={94} r={11} /><Coin x={x} y={76} r={11} /></> : <circle cx={x} cy={96} r={10} fill={accent} stroke={INK} strokeWidth={4} />}
      </g>
    );
  };
  return (
    <g>
      <Pop t={t} a={0} cx={100} cy={150}><path d="M100 40v118M64 170h72l-8-14H72z" fill={PAPER2} stroke={INK} strokeWidth={5.5} strokeLinejoin="round" strokeLinecap="round" /></Pop>
      <g transform={`rotate(${ang} 100 40)`}>
        <path d="M34 40h132" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        {pan(-1, true)}{pan(1, false)}
      </g>
      <circle cx={100} cy={40} r={9} fill={accent} stroke={INK} strokeWidth={4.5} />
    </g>
  );
};

export const People: I = ({t, accent}) => {
  const fig = (x: number, y: number, s: number, col: string, a: number, ph: number) => (
    <Pop t={t} a={a} cx={x} cy={y + 50 * s} dy={30}>
      <g transform={`translate(0 ${wave(t, 1.8, ph) * 3})`}>
        <path d={`M${x - 26 * s} ${y + 90 * s}v-20 a${26 * s} ${34 * s} 0 0 1 ${52 * s} 0v20z`} fill={col} stroke={INK} strokeWidth={5} strokeLinejoin="round" transform={`translate(0 ${-4 * s})`} />
        <circle cx={x} cy={y + 24 * s} r={20 * s} fill={PAPER2} stroke={INK} strokeWidth={5} />
        <circle cx={x - 7 * s} cy={y + 22 * s} r={2.6} fill={INK} /><circle cx={x + 7 * s} cy={y + 22 * s} r={2.6} fill={INK} />
        <path d={`M${x - 7 * s} ${y + 32 * s}q${7 * s} 6 ${14 * s} 0`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    </Pop>
  );
  return <g>{fig(54, 66, 0.85, soft(GOLD, 0.9), 0.25, 1)}{fig(146, 66, 0.85, soft(GREEN, 0.7), 0.4, 2)}{fig(100, 52, 1.1, accent, 0.05, 0)}</g>;
};

export const Phone: I = ({t, accent}) => {
  const buzz = Math.max(0, wave(t, 2.2)) > 0.9 ? wave(t, 0.08) * 2 : 0;
  return (
    <g transform={`rotate(${6 + buzz} 100 100)`}>
      <Pop t={t} cx={100} cy={100} dy={30}>
        <rect x={52} y={14} width={96} height={172} rx={18} fill={INK} />
        <rect x={59} y={28} width={82} height={144} rx={8} fill={PAPER2} />
        <rect x={84} y={19} width={32} height={5} rx={2.5} fill="#555" />
        {[0, 1, 2, 3].map(i => <rect key={i} x={67 + (i % 2) * 36} y={36 + Math.floor(i / 2) * 36} width={28} height={28} rx={7} fill={i === 0 ? accent : soft(INK, 0.18)} />)}
        <path d="M68 150V132m14 18V120m14 30V126m14 24V112" stroke={accent} strokeWidth={8} strokeLinecap="round" strokeDasharray="1 0" />
      </Pop>
      <Pop t={t} a={0.7} cx={150} cy={40}><rect x={112} y={22} width={72} height={34} rx={12} fill={GOLD} stroke={INK} strokeWidth={4.5} /><Txt x={148} y={46} size={18}>+$25</Txt></Pop>
    </g>
  );
};

const Chart: React.FC<{t: number; up: boolean; accent: string}> = ({t, up, accent}) => {
  const pts = up ? [[26, 142], [64, 118], [92, 128], [128, 84], [166, 44]] : [[26, 44], [64, 70], [92, 60], [128, 112], [166, 146]];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const col = up ? GREEN : accent;
  return (
    <g>
      <D d="M20 20v152h164" t={t} a={0} b={0.5} w={6} />
      {[60, 100, 140].map(y => <path key={y} d={`M24 ${y}h156`} stroke={soft(INK, 0.15)} strokeWidth={2.5} strokeDasharray="3 8" strokeLinecap="round" />)}
      <D d={`${d} L166 172 L26 172z`} t={t} a={0.6} b={1.5} fill={soft(col, 0.18)} stroke="none" />
      <D d={d} t={t} a={0.5} b={1.5} w={8} stroke={col} />
      {pts.map((p, i) => <Pop key={i} t={t} a={0.6 + i * 0.22} cx={p[0]} cy={p[1]} dur={0.3}><circle cx={p[0]} cy={p[1]} r={7} fill={PAPER2} stroke={INK} strokeWidth={4} /></Pop>)}
      <Pop t={t} a={1.6} cx={166} cy={pts[4][1]} dur={0.4}><circle cx={166} cy={pts[4][1]} r={11 + Math.max(0, wave(t, 1.4)) * 4} fill="none" stroke={col} strokeWidth={4} opacity={0.6} /></Pop>
    </g>
  );
};
export const ChartUp: I = ({t, accent}) => <Chart t={t} up accent={accent} />;
export const ChartDown: I = ({t, accent}) => <Chart t={t} up={false} accent={accent} />;

export const Bulb: I = ({t, accent}) => {
  const fl = 0.85 + Math.max(0, wave(t, 1.9)) * 0.15;
  return (
    <g>
      {Array.from({length: 7}).map((_, i) => { const a = Math.PI + (i / 6) * Math.PI, c = Math.cos(a), n = Math.sin(a); return <D key={i} d={`M${100 + c * 62} ${86 + n * 62}L${100 + c * 82} ${86 + n * 82}`} t={t} a={0.6 + i * 0.06} b={0.9 + i * 0.06} w={6} stroke={GOLD} />; })}
      <Pop t={t} cx={100} cy={90} dy={20}>
        <path d="M100 30a48 48 0 0 0-28 87c6 5 8 10 8 18h40c0-8 2-13 8-18A48 48 0 0 0 100 30z" fill={GOLD2} stroke={INK} strokeWidth={6} strokeLinejoin="round" opacity={fl} />
        <path d="M82 135h36v10H82zM88 145h24v12c0 6-5 10-12 10s-12-4-12-10z" fill={soft(INK, 0.25)} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d="M86 70c0-10 8-18 18-18" stroke={PAPER2} strokeWidth={6} strokeLinecap="round" fill="none" />
        <path d="M90 126V98l10 10 10-10v28" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Pop>
    </g>
  );
};

export const Wallet: I = ({t, accent}) => (
  <g transform={`translate(0 ${wave(t, 3) * 2})`}>
    {[0, 1, 2].map(i => {
      const s = seg(t, 0.5 + i * 0.15, 1.1 + i * 0.15);
      return <g key={i} transform={`translate(${(i - 1) * 22} ${-s * (30 + i * 8) + wave(t + i, 2) * 2}) rotate(${(i - 1) * 8} 100 90)`}><rect x={64} y={60} width={72} height={40} rx={4} fill={soft(GREEN, 0.7)} stroke={INK} strokeWidth={4.5} /><circle cx={100} cy={80} r={10} fill={PAPER2} stroke={INK} strokeWidth={3} /><Txt x={100} y={86} size={14}>$</Txt></g>;
    })}
    <Pop t={t} cx={100} cy={120} dy={20}>
      <rect x={22} y={72} width={156} height={100} rx={16} fill={accent} stroke={INK} strokeWidth={5.5} />
      <path d="M22 96h156" stroke={INK} strokeWidth={4} opacity={0.35} />
      <rect x={118} y={104} width={66} height={42} rx={12} fill={soft(PAPER2, 0.9)} stroke={INK} strokeWidth={5} />
      <circle cx={140} cy={125} r={7} fill={INK} />
    </Pop>
  </g>
);

export const Cash: I = ({t}) => {
  const bill = (rot: number, x: number, y: number, a: number, ph: number) => (
    <Pop t={t} a={a} cx={x} cy={y} rot={rot * 2} dy={40}>
      <g transform={`rotate(${rot + wave(t, 2.4, ph) * 2} ${x} ${y}) translate(0 ${wave(t, 2.8, ph) * 3})`}>
        <rect x={x - 66} y={y - 34} width={132} height={68} rx={6} fill="#bfe3c4" stroke={INK} strokeWidth={5} />
        <rect x={x - 56} y={y - 25} width={112} height={50} rx={3} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="2 5" />
        <circle cx={x} cy={y} r={19} fill={soft(GREEN, 0.5)} stroke={INK} strokeWidth={4} /><Txt x={x} y={y + 9} size={25}>$</Txt>
        <circle cx={x - 46} cy={y - 16} r={4} fill={INK} opacity={0.5} /><circle cx={x + 46} cy={y + 16} r={4} fill={INK} opacity={0.5} />
      </g>
    </Pop>
  );
  return <g>{bill(-10, 92, 74, 0.05, 0)}{bill(6, 108, 106, 0.2, 1.5)}{bill(-4, 98, 140, 0.35, 3)}<Sparkle x={176} y={40} t={t} a={1.2} /></g>;
};

export const Lock: I = ({t, accent}) => {
  const open = segIO(t, 0.9, 1.3) * (1 - segIO(t, 2.4, 2.8)); // pops open, then clicks shut (loops once only per cycle below)
  const k = (t % 4) < 0.1 ? 0 : 1;
  const lift = (t < 2.8 ? open : 0) * 26;
  return (
    <g>
      <g transform={`translate(0 ${-lift}) rotate(${-lift * 0.5} 150 70)`}><path d="M60 94V64a40 40 0 0 1 80 0v30" fill="none" stroke={INK} strokeWidth={22} strokeLinecap="round" /><path d="M60 94V64a40 40 0 0 1 80 0v30" fill="none" stroke="#c9ccd1" strokeWidth={11} strokeLinecap="round" /></g>
      <Pop t={t} cx={100} cy={130} dy={20}>
        <rect x={34} y={92} width={132} height={88} rx={16} fill={accent} stroke={INK} strokeWidth={6} />
        <circle cx={100} cy={126} r={13} fill={INK} /><path d="M100 130v22" stroke={INK} strokeWidth={9} strokeLinecap="round" />
        <path d="M46 104h108" stroke={PAPER2} strokeWidth={4} opacity={0.4} strokeLinecap="round" />
      </Pop>
      {k === 1 && <Sparkle x={168} y={54} t={t} a={1.5} />}
    </g>
  );
};

export const Question: I = ({t, accent}) => {
  const hop = Math.abs(wave(t, 1.8)) * 7;
  return (
    <g>
      <Pop t={t} cx={100} cy={90} rot={-20}>
        <path d="M30 38a22 22 0 0 1 22-22h96a22 22 0 0 1 22 22v76a22 22 0 0 1-22 22h-46l-30 30v-30H52a22 22 0 0 1-22-22z" fill={PAPER2} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <g transform={`translate(0 ${-hop})`}><Txt x={100} y={112} size={96} fill={accent}>?</Txt></g>
      </Pop>
      <Pop t={t} a={0.6} cx={178} cy={30}><Txt x={178} y={46} size={34} fill={GOLD} rot={14}>?</Txt></Pop>
      <Pop t={t} a={0.8} cx={24} cy={140}><Txt x={24} y={156} size={30} fill={accent} rot={-16}>?</Txt></Pop>
    </g>
  );
};

export const Warning: I = ({t, accent}) => {
  const pulse = 1 + Math.max(0, wave(t, 1.2)) * 0.05, shake = Math.max(0, wave(t, 2.4)) > 0.85 ? wave(t, 0.1) * 2.5 : 0;
  return (
    <g transform={`translate(0 5) rotate(${shake} 100 120) translate(100 110) scale(${pulse}) translate(-100 -110)`}>
      <Pop t={t} cx={100} cy={110} rot={-20}>
        <path d="M100 18 184 168H16z" fill={GOLD} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d="M100 56v62" stroke={INK} strokeWidth={14} strokeLinecap="round" /><circle cx={100} cy={144} r={8.5} fill={INK} />
      </Pop>
    </g>
  );
};

export const Check: I = ({t, accent}) => (
  <g>
    {Array.from({length: 8}).map((_, i) => { const a = (i / 8) * Math.PI * 2, s = seg(t, 0.9, 1.5); return <circle key={i} cx={100 + Math.cos(a) * (60 + 34 * s)} cy={100 + Math.sin(a) * (60 + 34 * s)} r={5 * (1 - s) + 3.5} fill={[GOLD, accent, GREEN][i % 3]} opacity={s > 0 ? 1 : 0} />; })}
    <Pop t={t} cx={100} cy={100}><circle cx={100} cy={100} r={62} fill={GREEN} stroke={INK} strokeWidth={6} /><circle cx={100} cy={100} r={50} fill="none" stroke={PAPER2} strokeWidth={3} opacity={0.5} strokeDasharray="2 9" strokeLinecap="round" /></Pop>
    <D d="M70 102l22 22 40-46" t={t} a={0.45} b={0.95} w={14} stroke={PAPER2} />
  </g>
);

export const Target: I = ({t, accent}) => {
  const fly = 1 - seg(t, 0.5, 1), wob = Math.exp(-(t - 1) * 3) * Math.sin(t * 30) * 3 * (t > 1 ? 1 : 0);
  return (
    <g>
      <Pop t={t} cx={100} cy={110}>
        <circle cx={100} cy={110} r={68} fill={PAPER2} stroke={INK} strokeWidth={6} /><circle cx={100} cy={110} r={48} fill={accent} stroke={INK} strokeWidth={5} /><circle cx={100} cy={110} r={28} fill={PAPER2} stroke={INK} strokeWidth={5} /><circle cx={100} cy={110} r={11} fill={accent} stroke={INK} strokeWidth={4} />
      </Pop>
      <g transform={`translate(${fly * 90} ${-fly * 90}) rotate(${wob} 100 110)`} opacity={t > 0.5 ? 1 : 0}>
        <path d="M100 110 160 50" stroke={INK} strokeWidth={6} strokeLinecap="round" /><path d="M150 60l16-4-4-16M158 52l22-22M148 42l12 0" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M160 50l14-14M166 56l14-14" stroke={RED} strokeWidth={7} strokeLinecap="round" />
      </g>
    </g>
  );
};

export const Hourglass: I = ({t, accent}) => {
  const cyc = (t % 4) / 4, top = 1 - cyc, bot = cyc;
  return (
    <g transform={`rotate(${(t % 4) > 3.7 ? ((t % 4) - 3.7) / 0.3 * 180 : 0} 100 100)`}>
      <Pop t={t} cx={100} cy={100}>
        <path d="M60 20h80M60 180h80" stroke={INK} strokeWidth={14} strokeLinecap="round" />
        <path d="M66 26c0 40 14 54 34 74-20 20-34 34-34 74M134 26c0 40-14 54-34 74 20 20 34 34 34 74" fill={soft(SKY, 0.6)} stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <clipPath id="hgT"><path d="M70 28c0 36 12 48 30 68 18-20 30-32 30-68z" /></clipPath>
        <clipPath id="hgB"><path d="M70 172c0-36 12-48 30-68 18 20 30 32 30 68z" /></clipPath>
        <rect x={60} y={28 + (1 - top) * 66} width={80} height={80} fill={GOLD} clipPath="url(#hgT)" />
        <rect x={60} y={172 - bot * 66} width={80} height={80} fill={GOLD} clipPath="url(#hgB)" />
        {top > 0.02 && bot < 0.98 && <path d="M100 100v66" stroke={GOLD} strokeWidth={3} strokeDasharray="4 5" strokeDashoffset={-t * 30} />}
      </Pop>
    </g>
  );
};
