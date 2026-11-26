import React from 'react';
import {INK, clamp} from '../theme';
import {Coin, Ctx, D, GOLD, GOLD2, GREEN, PAPER2, Pop, RED, SKY, Sparkle, Txt, seg, soft, sp, wave} from './kit';

type I = React.FC<Ctx>;

export const CreditCard: I = ({t, accent}) => {
  const sh = clamp(((t % 3.2) - 1.2) / 0.9); // glint sweep
  return (
    <g transform={`rotate(-7 100 100) translate(0 ${wave(t, 3.4) * 3})`}>
      <Pop t={t} cx={100} cy={100} rot={-14} dy={30}>
        <rect x={16} y={46} width={168} height={108} rx={14} fill={accent} stroke={INK} strokeWidth={5} />
        <rect x={16} y={66} width={168} height={20} fill={INK} />
        <rect x={32} y={100} width={32} height={24} rx={5} fill={GOLD} stroke={INK} strokeWidth={3.5} />
        <path d="M32 112h32M48 100v24" stroke={INK} strokeWidth={2.5} />
        <path d="M32 140h26M66 140h26M100 140h26" stroke={PAPER2} strokeWidth={5} strokeLinecap="round" />
        <circle cx={150} cy={126} r={14} fill={RED} stroke={INK} strokeWidth={3} /><circle cx={166} cy={126} r={14} fill={GOLD} stroke={INK} strokeWidth={3} opacity={0.95} />
        {sh > 0 && sh < 1 && <path d={`M${20 + sh * 150} 48l-26 104`} stroke={PAPER2} strokeWidth={14} opacity={0.35} strokeLinecap="round" />}
      </Pop>
    </g>
  );
};

export const Coins: I = ({t}) => (
  <g>
    <ellipse cx={100} cy={172} rx={62} ry={9} fill={soft(INK, 0.12)} />
    {[0, 1, 2, 3, 4].map(i => {
      const a = 0.1 + i * 0.16, y = 150 - i * 20, s = sp(t, a, 0.45), off = -(1 - s) * 90;
      if (t < a) return null;
      return (
        <g key={i} transform={`translate(${i % 2 ? 4 : -3} ${off})`} opacity={clamp((t - a) / 0.08)}>
          <path d={`M46 ${y}v16a54 16 0 0 0 108 0v-16z`} fill={GOLD} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <ellipse cx={100} cy={y} rx={54} ry={16} fill={GOLD2} stroke={INK} strokeWidth={5} />
          {i === 4 && <Txt x={100} y={y + 9} size={26}>$</Txt>}
        </g>
      );
    })}
    <Sparkle x={160} y={50} t={t} a={1} /><Sparkle x={38} y={72} t={t} a={1.6} s={8} />
  </g>
);

export const Jar: I = ({t, accent}) => {
  const n = Math.min(7, Math.floor(Math.max(0, t - 0.5) / 0.35));
  const fall = (t % 2.4) / 2.4;
  return (
    <g>
      <D d="M54 52h92v14c10 6 16 16 16 30v62c0 12-10 22-22 22H60c-12 0-22-10-22-22V96c0-14 6-24 16-30z" t={t} a={0} b={0.6} fill={SKY} />
      {Array.from({length: n}).map((_, i) => <Coin key={i} x={64 + (i % 4) * 24 + (Math.floor(i / 4) % 2) * 10} y={166 - Math.floor(i / 4) * 24} r={13} />)}
      <Pop t={t} a={0.3} cx={100} cy={46}><rect x={46} y={30} width={108} height={22} rx={8} fill={accent} stroke={INK} strokeWidth={5} /></Pop>
      <Pop t={t} a={0.7} cx={100} cy={118}><rect x={66} y={100} width={68} height={30} rx={6} fill={PAPER2} stroke={INK} strokeWidth={3.5} transform="rotate(-4 100 115)" /><Txt x={100} y={123} size={22} rot={-4} fill={accent}>SAVE</Txt></Pop>
      {t > 1.2 && <g opacity={fall < 0.5 ? 1 : 0}><Coin x={100} y={-10 + fall * 2 * 80} r={13} spin={t * 9} /></g>}
    </g>
  );
};

export const House: I = ({t, accent}) => (
  <g transform={`translate(0 ${wave(t, 3.6) * 2})`}>
    <ellipse cx={100} cy={174} rx={78} ry={7} fill={soft(INK, 0.12)} />
    <D d="M50 84v82h100V84" t={t} a={0} b={0.5} fill={PAPER2} />
    <D d="M128 56V34h18v40" t={t} a={0.3} b={0.6} fill={soft(INK, 0.15)} />
    {[0, 1, 2].map(i => <circle key={i} cx={137 + wave(t + i, 2) * 5 + ((t * 18 + i * 14) % 42) * 0.25} cy={26 - ((t * 18 + i * 14) % 42)} r={6 + ((t * 18 + i * 14) % 42) * 0.14} fill={soft(INK, 0.1)} opacity={t > 0.9 ? 1 - ((t * 18 + i * 14) % 42) / 42 : 0} />)}
    <D d="M30 90 100 28l70 62z" t={t} a={0.25} b={0.8} fill={accent} />
    <Pop t={t} a={0.7} cx={78} cy={140}><rect x={64} y={110} width={28} height={56} rx={3} fill={soft(accent, 0.5)} stroke={INK} strokeWidth={4.5} /><circle cx={85} cy={140} r={2.8} fill={INK} /></Pop>
    <Pop t={t} a={0.85} cx={124} cy={118}><rect x={108} y={102} width={32} height={32} rx={3} fill={SKY} stroke={INK} strokeWidth={4.5} /><path d="M124 102v32M108 118h32" stroke={INK} strokeWidth={3} /></Pop>
    <Pop t={t} a={1.1} cx={100} cy={64}><circle cx={100} cy={64} r={11} fill={PAPER2} stroke={INK} strokeWidth={4} /><Txt x={100} y={72} size={16}>$</Txt></Pop>
  </g>
);

export const Car: I = ({t, accent}) => {
  const enter = 1 - seg(t, 0, 0.7), spin = t * 420;
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} 146)`}>
      <circle r={20} fill={INK} /><circle r={9} fill={PAPER2} stroke={INK} strokeWidth={3} />
      <g transform={`rotate(${spin})`}><path d="M0 -9V9M-9 0H9" stroke={INK} strokeWidth={3} /></g>
    </g>
  );
  return (
    <g transform={`translate(${-enter * 160} ${wave(t, 0.5) * 1.2})`}>
      <ellipse cx={100} cy={168} rx={74} ry={6} fill={soft(INK, 0.14)} />
      {[0, 1, 2].map(i => <path key={i} d={`M${14 - ((t * 90 + i * 30) % 90) * 0.4} ${108 + i * 16}h${-24 - i * 6}`} stroke={soft(INK, 0.3)} strokeWidth={4} strokeLinecap="round" opacity={enter < 0.1 ? 1 : 0} />)}
      <path d="M18 142v-22c0-8 6-14 14-16l28-6 20-26c3-4 8-6 12-6h34c6 0 11 3 14 8l12 24 16 6c6 2 10 8 10 14v24z" fill={accent} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M72 100l14-20c1-2 3-3 5-3h26v26zM124 77h14c3 0 5 1 6 4l8 19h-28z" fill={SKY} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <rect x={182} y={116} width={10} height={12} rx={3} fill={GOLD} stroke={INK} strokeWidth={3} />
      {wheel(58)}{wheel(150)}
    </g>
  );
};

export const Bank: I = ({t, accent}) => (
  <g transform={`translate(0 ${wave(t, 4) * 2})`}>
    <D d="M100 22 20 66h160z" t={t} a={0.4} b={0.9} fill={accent} />
    <Pop t={t} a={0.9} cx={100} cy={52}><circle cx={100} cy={50} r={12} fill={PAPER2} stroke={INK} strokeWidth={4} /><Txt x={100} y={58} size={17}>$</Txt></Pop>
    {[0, 1, 2, 3].map(i => {
      const s = seg(t, 0.05 + i * 0.12, 0.5 + i * 0.12);
      return <g key={i} transform={`translate(${36 + i * 38} 150) scale(1 ${Math.max(0.001, s)}) translate(${-36 - i * 38} -150)`}><rect x={30 + i * 38} y={76} width={12} height={74} fill={PAPER2} stroke={INK} strokeWidth={4.5} /></g>;
    })}
    <D d="M16 150h168v14H16z" t={t} a={0.1} b={0.5} fill={soft(INK, 0.2)} />
    <D d="M8 164h184v14H8z" t={t} a={0.2} b={0.6} fill={soft(INK, 0.3)} />
    <D d="M24 70h152" t={t} a={0.5} b={0.8} />
    <Sparkle x={178} y={34} t={t} a={1.4} />
  </g>
);

export const Piggy: I = ({t, accent}) => {
  const drop = ((t % 2.2) / 2.2);
  return (
    <g transform={`translate(0 ${wave(t, 2.6) * 3})`}>
      <ellipse cx={100} cy={176} rx={64} ry={7} fill={soft(INK, 0.12)} />
      <Pop t={t} cx={100} cy={120}>
        <path d="M60 78l-6-18 22 8z" fill={soft(accent, 0.6)} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M156 126c14-2 24-12 16-24-4 8-12 8-16 6" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <rect x={64} y={142} width={20} height={30} rx={8} fill={soft(accent, 0.7)} stroke={INK} strokeWidth={4.5} /><rect x={118} y={142} width={20} height={30} rx={8} fill={soft(accent, 0.7)} stroke={INK} strokeWidth={4.5} />
        <ellipse cx={104} cy={116} rx={64} ry={50} fill={soft(accent, 0.55)} stroke={INK} strokeWidth={5} />
        <ellipse cx={166} cy={118} rx={13} ry={17} fill={soft(accent, 0.85)} stroke={INK} strokeWidth={4.5} />
        <circle cx={164} cy={111} r={3} fill={INK} /><circle cx={164} cy={125} r={3} fill={INK} />
        <circle cx={134} cy={102} r={4.5} fill={INK} /><circle cx={135.5} cy={100.5} r={1.5} fill={PAPER2} />
        <path d="M92 69h24" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      </Pop>
      {t > 0.8 && <g opacity={drop < 0.55 ? 1 : 0}><Coin x={106} y={-6 + drop * 1.8 * 62} r={12} spin={t * 8} /></g>}
      <Sparkle x={32} y={60} t={t} a={1.2} />
    </g>
  );
};

export const Calendar: I = ({t, accent}) => {
  const sway = wave(t, 3) * 1.5;
  return (
    <g transform={`rotate(${sway} 100 180)`}>
      <Pop t={t} cx={100} cy={110} dy={20}>
        <rect x={26} y={38} width={148} height={130} rx={12} fill={PAPER2} stroke={INK} strokeWidth={5} />
        <path d="M26 50a12 12 0 0 1 12-12h124a12 12 0 0 1 12 12v22H26z" fill={accent} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d="M62 26v22M138 26v22" stroke={INK} strokeWidth={7} strokeLinecap="round" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <rect key={i} x={40 + (i % 4) * 33} y={84 + Math.floor(i / 4) * 26} width={22} height={16} rx={3} fill={soft(INK, 0.12)} />)}
      </Pop>
      <D d="M118 104a16 12 0 1 0 .1 0" t={t} a={0.7} b={1.3} stroke={RED} w={5} />
      <Pop t={t} a={1.3} cx={124} cy={108}><path d="M117 108l5 5 9-11" fill="none" stroke={GREEN} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /></Pop>
    </g>
  );
};

export const Clock: I = ({t, accent}) => {
  const a = seg(t, 0.4, 1), ring = Math.max(0, wave(t, 1.2)) * 3;
  return (
    <g>
      <Pop t={t} cx={100} cy={30} a={0.1}><circle cx={52} cy={36} r={20} fill={accent} stroke={INK} strokeWidth={5} /><circle cx={148} cy={36} r={20} fill={accent} stroke={INK} strokeWidth={5} /></Pop>
      <g transform={`rotate(${wave(t, 0.3) * ring} 100 110)`}>
        <D d="M100 28a82 82 0 1 0 .1 0z" t={t} a={0} b={0.6} fill={PAPER2} w={6} />
        {Array.from({length: 12}).map((_, i) => <path key={i} d="M100 36v10" stroke={INK} strokeWidth={i % 3 ? 3 : 5} strokeLinecap="round" transform={`rotate(${i * 30} 100 110)`} opacity={a} />)}
        <path d="M100 110V70" stroke={INK} strokeWidth={7} strokeLinecap="round" transform={`rotate(${(t * 36 + 20) * a} 100 110)`} />
        <path d="M100 110V50" stroke={accent} strokeWidth={5} strokeLinecap="round" transform={`rotate(${(t * 360) * a} 100 110)`} />
        <circle cx={100} cy={110} r={7} fill={INK} />
      </g>
    </g>
  );
};

export const Percent: I = ({t, accent}) => {
  const pts = Array.from({length: 24}, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 66 : 82; return `${100 + Math.cos(a) * r},${100 + Math.sin(a) * r}`; }).join(' ');
  return (
    <g transform={`rotate(${wave(t, 3.2) * 4} 100 100)`}>
      <Pop t={t} rot={-60} dur={0.6}>
        <polygon points={pts} fill={accent} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <circle cx={100} cy={100} r={56} fill="none" stroke={PAPER2} strokeWidth={3} strokeDasharray="3 8" strokeLinecap="round" />
        <path d="M70 134 130 66" stroke={PAPER2} strokeWidth={12} strokeLinecap="round" />
        <circle cx={76} cy={74} r={13} fill="none" stroke={PAPER2} strokeWidth={9} /><circle cx={124} cy={126} r={13} fill="none" stroke={PAPER2} strokeWidth={9} />
      </Pop>
    </g>
  );
};

export const Shield: I = ({t, accent}) => (
  <g transform={`translate(0 ${wave(t, 3) * 3})`}>
    <Pop t={t} cx={100} cy={100}>
      <path d="M100 18 38 40v52c0 40 26 70 62 86 36-16 62-46 62-86V40z" fill={soft(accent, 0.55)} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d="M100 34 52 51v41c0 32 20 56 48 70z" fill={soft(PAPER2, 0.35)} />
    </Pop>
    <D d="M70 98l22 22 40-46" t={t} a={0.5} b={1} w={12} stroke={PAPER2} />
    <D d="M70 98l22 22 40-46" t={t} a={0.5} b={1} w={5} stroke={INK} />
    <Sparkle x={160} y={36} t={t} a={1.2} /><Sparkle x={34} y={140} t={t} a={1.9} s={8} />
  </g>
);

export const Magnifier: I = ({t, accent}) => {
  const dx = Math.cos(t * 1.4) * 8, dy = Math.sin(t * 1.9) * 6;
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <Pop t={t} cx={90} cy={90} rot={-30}>
        <path d="M128 128 172 172" stroke={INK} strokeWidth={22} strokeLinecap="round" /><path d="M128 128 172 172" stroke={accent} strokeWidth={11} strokeLinecap="round" />
        <circle cx={86} cy={86} r={56} fill={soft(SKY, 0.7)} stroke={INK} strokeWidth={9} />
        <path d="M54 76a36 36 0 0 1 26-24" stroke={PAPER2} strokeWidth={8} strokeLinecap="round" fill="none" />
        <path d="M62 100h48M62 116h32" stroke={soft(INK, 0.4)} strokeWidth={5} strokeLinecap="round" />
        <circle cx={104} cy={80} r={12} fill={GOLD} stroke={INK} strokeWidth={3.5} /><Txt x={104} y={86} size={14}>$</Txt>
      </Pop>
    </g>
  );
};

export const Receipt: I = ({t, accent}) => {
  const h = seg(t, 0.1, 1.3) * 140;
  return (
    <g transform={`rotate(${wave(t, 3.4) * 1.5} 100 20)`}>
      <rect x={34} y={20} width={132} height={14} rx={6} fill={INK} />
      <clipPath id="rc"><rect x={0} y={34} width={200} height={h} /></clipPath>
      <g clipPath="url(#rc)">
        <path d="M44 34h112v138l-9-7-10 7-9-7-10 7-9-7-10 7-9-7-10 7-9-7-10 7-9-7-8 7z" fill={PAPER2} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <Txt x={100} y={58} size={14}>RECEIPT</Txt>
        {[0, 1, 2, 3].map(i => <g key={i}><path d={`M58 ${76 + i * 17}h${[44, 56, 36, 50][i]}`} stroke={soft(INK, 0.55)} strokeWidth={5} strokeLinecap="round" /><path d={`M128 ${76 + i * 17}h14`} stroke={soft(INK, 0.55)} strokeWidth={5} strokeLinecap="round" /></g>)}
        <path d="M58 146h84" stroke={INK} strokeWidth={3} strokeDasharray="2 8" strokeLinecap="round" />
        <Txt x={58} y={162} size={15} anchor="start" fill={accent}>TOTAL</Txt><Txt x={142} y={162} size={15} anchor="end" fill={accent}>$$$</Txt>
      </g>
    </g>
  );
};

export const Document: I = ({t, accent}) => (
  <g transform={`rotate(${-4 + wave(t, 3.6) * 1.5} 100 100)`}>
    <D d="M44 20h78l34 34v126H44z" t={t} a={0} b={0.6} fill={PAPER2} w={5.5} />
    <D d="M122 20v34h34" t={t} a={0.4} b={0.7} fill={soft(INK, 0.15)} />
    <Pop t={t} a={0.5} cx={100} cy={70}><rect x={60} y={50} width={44} height={10} rx={4} fill={accent} /></Pop>
    {[0, 1, 2, 3, 4].map(i => <D key={i} d={`M60 ${78 + i * 14}h${[80, 70, 80, 58, 76][i]}`} t={t} a={0.6 + i * 0.1} b={0.9 + i * 0.1} w={4} stroke={soft(INK, 0.5)} />)}
    <D d="M60 162c8-14 12-6 16-2s8-12 14-4 8 2 14-2" t={t} a={1.2} b={1.8} stroke={accent} w={4.5} />
    <Pop t={t} a={1.8} cx={140} cy={150} rot={40} dur={0.4}><circle cx={140} cy={148} r={20} fill="none" stroke={RED} strokeWidth={5} opacity={0.85} /><circle cx={140} cy={148} r={14} fill="none" stroke={RED} strokeWidth={2.5} opacity={0.85} /><Txt x={140} y={154} size={15} fill={RED} rot={-12}>OK</Txt></Pop>
  </g>
);
