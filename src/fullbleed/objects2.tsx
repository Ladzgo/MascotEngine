import React from 'react';
import {clamp} from '../theme';
import {PALETTES, Shadow, Txt, pop, seg, wave} from './kit';
import type {Obj} from './objects';

const url = (k: string, v = false) => `url(#fb-${k}${v ? '-v' : ''})`;
const tooth = (n: number, r0: number, r1: number) => Array.from({length: n * 4}, (_, i) => { const a = (i / (n * 4)) * Math.PI * 2, r = i % 4 < 2 ? r1 : r0; return `${Math.cos(a) * r},${Math.sin(a) * r}`; }).join(' ');

export const People: Obj = ({t, accent}) => (
  <g>
    <Shadow rx={170} />
    {[[110, 0.8, 'blue'], [290, 0.8, 'green'], [200, 1, 'accent']].map(([x, k, pal], i) => {
      const s = pop(t, 0.05 + i * 0.15, 0.5), b = wave(t, 1.6, i) * 3;
      return (
        <g key={i} transform={`translate(${x} 330) scale(${Number(k) * Math.max(0.01, s)}) translate(${-Number(x)} -330) translate(0 ${b})`} opacity={clamp(s * 2)}>
          <circle cx={Number(x)} cy={150} r={38} fill={String(pal) === 'accent' ? accent : url(String(pal))} />
          <path d={`M${Number(x) - 62} 330 Q${Number(x) - 62} 206 ${Number(x)} 200 Q${Number(x) + 62} 206 ${Number(x) + 62} 330Z`} fill={String(pal) === 'accent' ? accent : url(String(pal))} />
          <ellipse cx={Number(x) - 12} cy={140} rx={12} ry={20} fill="#fff" opacity={0.2} />
        </g>
      );
    })}
  </g>
);

export const Phone: Obj = ({t, accent}) => {
  const s = pop(t, 0, 0.55), badge = pop(t, 0.9, 0.4), bob = wave(t, 2) * 3;
  return (
    <g transform={`translate(0 ${bob})`}>
      <Shadow rx={110} />
      <g transform={`translate(200 190) rotate(${-6 + (1 - s) * 20}) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
        <rect x={110} y={30} width={180} height={310} rx={30} fill={url('navy')} /><rect x={120} y={44} width={160} height={282} rx={20} fill={url('glass', true)} />
        <rect x={170} y={34} width={60} height={8} rx={4} fill="#0b1020" />
        {[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={134 + (i % 3) * 50} y={84 + Math.floor(i / 3) * 56} width={40} height={40} rx={11} fill={i === 1 ? accent : PALETTES[['gold', 'green', 'red', 'blue', 'wall', 'grey'][i]][1]} transform={`scale(${pop(t, 0.3 + i * 0.1, 0.4)})`} style={{transformOrigin: `${154 + (i % 3) * 50}px ${104 + Math.floor(i / 3) * 56}px`}} />)}
        <rect x={134} y={226} width={132} height={60} rx={12} fill="#fff" opacity={0.9} /><Txt x={200} y={266} size={30} fill="#16182a">9:41</Txt>
        <circle cx={278} cy={64} r={16 * badge} fill="#e4572e" />
      </g>
    </g>
  );
};

export const Cart: Obj = ({t}) => {
  const x = (1 - seg(t, 0, 0.7)) * -240, spin = t * 500;
  return (
    <g transform={`translate(${x} 0)`}>
      <Shadow rx={150} />
      <path d="M40 90 H90 L130 250 H320 L350 130 H104" fill="none" stroke={PALETTES.grey[2]} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M108 140 H348 L322 246 H132Z" fill={url('blue')} opacity={0.95} />
      {[0, 1, 2].map(i => { const k = seg(t, 0.5 + i * 0.25, 0.9 + i * 0.25); return <rect key={i} x={146 + i * 64} y={96 - (1 - k) * 70} width={48} height={48} rx={8} fill={url(['gold', 'red', 'green'][i])} opacity={k} />; })}
      {[160, 300].map(cx => <g key={cx} transform={`translate(${cx} 290)`}><circle r={24} fill="#1b1d26" /><circle r={11} fill={url('grey')} /><rect x={-2} y={-22} width={4} height={14} fill="#fff" transform={`rotate(${spin})`} /></g>)}
    </g>
  );
};

export const PriceTag: Obj = ({t}) => {
  const sw = Math.sin(t * 2.4) * 7 * Math.exp(-t * 0.25), s = pop(t, 0, 0.55);
  return (
    <g>
      <Shadow rx={100} o={0.5} />
      <g transform={`translate(200 40) rotate(${sw + (1 - s) * 40}) scale(${Math.max(0.01, s)}) translate(-200 -40)`}>
        <path d="M200 40 Q200 20 214 14" stroke="#fff" strokeWidth={4} fill="none" />
        <path d="M120 80 H280 Q300 80 300 100 V300 Q300 320 280 320 H120 Q100 320 100 300 V100 Q100 80 120 80Z" fill={url('red')} transform="rotate(0)" />
        <path d="M120 80 H280 Q300 80 300 100 V130 H100 V100 Q100 80 120 80Z" fill="#fff" opacity={0.18} />
        <circle cx={200} cy={110} r={14} fill="#12142a" /><Txt x={200} y={236} size={110} fill="#fff">$</Txt><rect x={140} y={262} width={120} height={14} rx={7} fill="#fff" opacity={0.7} />
      </g>
    </g>
  );
};

export const Bulb: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), glow = 0.6 + 0.4 * Math.sin(t * 3);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <circle cx={200} cy={150} r={150} fill="url(#fb-glow)" opacity={glow * 0.8} />
      {Array.from({length: 8}, (_, i) => <rect key={i} x={197} y={-6} width={6} height={30 * seg(t, 0.4, 0.8)} rx={3} fill="#ffe27a" transform={`rotate(${i * 45 + 22} 200 150)`} opacity={glow} />)}
      <path d="M200 40 C140 40 110 90 124 140 C132 170 160 186 160 222 H240 C240 186 268 170 276 140 C290 90 260 40 200 40Z" fill={url('gold')} />
      <ellipse cx={170} cy={96} rx={18} ry={30} fill="#fff" opacity={0.45} transform="rotate(20 170 96)" />
      <rect x={160} y={222} width={80} height={22} rx={8} fill={url('grey')} /><rect x={166} y={248} width={68} height={20} rx={8} fill={url('grey')} /><rect x={178} y={272} width={44} height={16} rx={8} fill={PALETTES.grey[2]} />
    </g>
  );
};

export const Lock: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), shut = seg(t, 0.6, 1.1);
  return (
    <g transform={`translate(200 200) scale(${Math.max(0.01, s)}) translate(-200 -200)`}>
      <Shadow rx={110} />
      <path d={`M140 160 V${110 - (1 - shut) * 36} a60 60 0 0 1 120 0 V${160 - (1 - shut) * 10 }`} fill="none" stroke={url('grey')} strokeWidth={30} strokeLinecap="round" />
      <rect x={100} y={150} width={200} height={170} rx={26} fill={url('gold')} /><rect x={100} y={150} width={200} height={50} rx={26} fill="#fff" opacity={0.2} />
      <circle cx={200} cy={226} r={20} fill="#3a2a05" /><rect x={192} y={228} width={16} height={46} rx={7} fill="#3a2a05" />
    </g>
  );
};

export const Handshake: Obj = ({t}) => {
  const k = seg(t, 0.1, 0.8), clasp = Math.sin(clamp((t - 0.8) / 0.5) * Math.PI) * 8;
  return (
    <g transform={`translate(0 ${-clasp})`}>
      <Shadow rx={160} />
      <g transform={`translate(${-(1 - k) * 160} 0)`}><rect x={30} y={170} width={110} height={70} rx={14} fill={url('navy')} /><rect x={120} y={174} width={100} height={62} rx={26} fill={url('wall')} /></g>
      <g transform={`translate(${(1 - k) * 160} 0)`}><rect x={260} y={170} width={110} height={70} rx={14} fill={url('green')} /><rect x={180} y={178} width={100} height={62} rx={26} fill={PALETTES.wall[1]} /></g>
      {[0, 1, 2, 3].map(i => <rect key={i} x={186 + i * 16} y={166} width={14} height={34} rx={7} fill={PALETTES.wall[0]} opacity={k} />)}
      <circle cx={200} cy={120} r={50 * seg(t, 0.9, 1.3)} fill="url(#fb-glow)" />
    </g>
  );
};

export const GradCap: Obj = ({t}) => {
  const s = pop(t, 0, 0.55), tas = wave(t, 1.4) * 5;
  return (
    <g transform={`translate(0 ${wave(t, 3) * 3})`}>
      <Shadow rx={140} />
      <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) rotate(${(1 - s) * -25}) translate(-200 -190)`}>
        <path d="M120 190 V250 Q200 300 280 250 V190Z" fill={url('navy')} />
        <polygon points="200,90 360,160 200,230 40,160" fill={url('blue')} /><polygon points="200,90 360,160 200,170" fill="#fff" opacity={0.18} />
        <path d={`M320 168 V${236 + tas}`} stroke={PALETTES.gold[1]} strokeWidth={6} /><circle cx={320} cy={246 + tas} r={12} fill={url('gold')} />
      </g>
    </g>
  );
};

export const Wallet: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), bill = seg(t, 0.5, 1.1);
  return (
    <g transform={`translate(200 220) scale(${Math.max(0.01, s)}) translate(-200 -220)`}>
      <Shadow rx={150} />
      <rect x={90} y={120 - bill * 36} width={200} height={110} rx={10} fill={url('green')} transform="rotate(-8 190 180)" /><rect x={110} y={110 - bill * 28} width={200} height={110} rx={10} fill={PALETTES.green[0]} transform="rotate(5 210 170)" />
      <rect x={50} y={160} width={300} height={170} rx={28} fill={url('roof', true)} /><path d="M50 200 H350" stroke="#fff" strokeOpacity={0.2} strokeWidth={3} />
      <rect x={260} y={216} width={96} height={64} rx={18} fill={url('wall')} /><circle cx={290} cy={248} r={9} fill={PALETTES.gold[1]} />
    </g>
  );
};

export const Receipts: Obj = ({t}) => (
  <g>
    <Shadow rx={150} />
    {[0, 1, 2].map(i => {
      const k = seg(t, i * 0.18, 0.5 + i * 0.18), x = [110, 200, 290][i], rot = [-9, 3, 10][i];
      return (
        <g key={i} transform={`translate(${x} ${200 - (1 - k) * 120}) rotate(${rot * k}) translate(${-x} -200)`} opacity={clamp(k * 2.5)}>
          <path d={`M${x - 56} 40 H${x + 56} V300 L${x + 42} 288 L${x + 28} 300 L${x + 14} 288 L${x} 300 L${x - 14} 288 L${x - 28} 300 L${x - 42} 288 L${x - 56} 300Z`} fill={i === 1 ? '#fffdf6' : '#f1ede0'} />
          {Array.from({length: 6}, (_, r) => <rect key={r} x={x - 40} y={70 + r * 30} width={r % 2 ? 50 : 80} height={9} rx={4} fill={PALETTES.grey[1]} />)}
          <rect x={x - 40} y={254} width={70} height={14} rx={5} fill={url('red')} />
        </g>
      );
    })}
  </g>
);

export const Gears: Obj = ({t}) => {
  const s = pop(t, 0, 0.55);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow rx={140} />
      {[[140, 220, 78, 'gold', 1], [280, 150, 56, 'blue', -1.5], [270, 290, 44, 'green', 1.9]].map(([x, y, r, pal, sp], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${t * 40 * Number(sp)})`}>
          <polygon points={tooth(10, Number(r) * 0.86, Number(r))} fill={url(String(pal))} /><circle r={Number(r) * 0.55} fill="#12142a" opacity={0.35} /><circle r={Number(r) * 0.28} fill={url('grey')} />
        </g>
      ))}
    </g>
  );
};

export const Pin: Obj = ({t, accent}) => {
  const drop = seg(t, 0, 0.5), bounce = Math.abs(Math.sin(clamp((t - 0.5) / 0.6) * Math.PI)) * 18 * Math.exp(-(t - 0.5) * 2), rip = (t * 0.8) % 1;
  return (
    <g>
      <ellipse cx={200} cy={318} rx={120 * rip} ry={34 * rip} fill="none" stroke="#fff" strokeWidth={4} opacity={1 - rip} /><ellipse cx={200} cy={318} rx={36} ry={11} fill="url(#fb-shadow)" />
      <g transform={`translate(0 ${-(1 - drop) * 220 - bounce})`}>
        <path d="M200 316 C130 230 112 190 112 150 C112 96 150 56 200 56 C250 56 288 96 288 150 C288 190 270 230 200 316Z" fill={url('red')} /><circle cx={200} cy={150} r={40} fill="#fff" /><circle cx={200} cy={150} r={20} fill={accent} />
        <ellipse cx={164} cy={110} rx={12} ry={26} fill="#fff" opacity={0.35} transform="rotate(20 164 110)" />
      </g>
    </g>
  );
};

export const EXTRA: Record<string, Obj> = {people: People, phone: Phone, cart: Cart, pricetag: PriceTag, bulb: Bulb, lock: Lock, handshake: Handshake, gradcap: GradCap, wallet: Wallet, receipts: Receipts, gears: Gears, pin: Pin};
