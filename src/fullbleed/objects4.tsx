import React from 'react';
import {clamp} from '../theme';
import {PALETTES, Shadow, Txt, pop, seg, segIO, wave} from './kit';
import type {Obj} from './objects';

const url = (k: string, v = false) => `url(#fb-${k}${v ? '-v' : ''})`;
const tick = (t: number, n: number, per = 0.35) => Math.floor(t / per) % n;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
const P = (pal: string, i: number) => PALETTES[pal][i];

export const Atm: Obj = ({t}) => {
  const out = seg(t, 0.8, 1.6);
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 330px'}}>
      <Shadow rx={130} />
      <rect x={100} y={30} width={200} height={300} rx={22} fill={url('navy')} /><rect x={118} y={52} width={164} height={90} rx={10} fill={url('glass', true)} /><Txt x={200} y={108} size={34} fill="#12142a">{tick(t, 2, 0.6) ? 'WITHDRAW' : 'BALANCE'}</Txt>
      {Array.from({length: 9}, (_, i) => <rect key={i} x={126 + (i % 3) * 44} y={160 + Math.floor(i / 3) * 30} width={34} height={22} rx={5} fill="#aab1c0" />)}
      <rect x={150} y={256} width={100} height={18} rx={6} fill="#0b0d1e" />
      <g transform={`translate(0 ${out * 34})`} opacity={out}><rect x={160} y={240} width={80} height={38} rx={4} fill={url('green')} /><Txt x={200} y={268} size={24} fill="#c8ffd9">$20</Txt></g>
    </g>
  );
};

export const Paycheck: Obj = ({t}) => {
  const s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(0 ${wave(t, 3) * 3}) rotate(${-4 + (1 - s) * 18} 200 190) scale(${Math.max(0.01, s)})`} style={{transformOrigin: '200px 190px'}}>
      <Shadow rx={150} o={0.6} />
      <rect x={40} y={100} width={320} height={170} rx={12} fill="#fffdf6" /><rect x={40} y={100} width={320} height={28} rx={12} fill={url('green')} />
      <Txt x={110} y={122} size={20} fill="#fff">PAY CHECK</Txt><rect x={64} y={150} width={150} height={10} rx={5} fill="#c9ccd6" /><rect x={64} y={176} width={110} height={10} rx={5} fill="#c9ccd6" />
      <rect x={230} y={150} width={104} height={44} rx={8} fill="#eef3ee" /><Txt x={282} y={184} size={30} fill={P('green', 2)}>{`$${money(2400 * seg(t, 0.4, 1.4))}`}</Txt>
      <path d="M64 236 q30 -30 50 0 t50 0" stroke="#16182a" strokeWidth={4} fill="none" />
    </g>
  );
};

export const Bills: Obj = ({t}) => (
  <g>
    <Shadow rx={150} />
    {[0, 1, 2, 3].map(i => { const k = seg(t, i * 0.18, 0.5 + i * 0.18); return (
      <g key={i} transform={`translate(${(i % 2 ? 12 : -10)} ${-(1 - k) * 100 - i * 26}) rotate(${(i - 1.5) * 4})`} opacity={clamp(k * 3)} style={{transformOrigin: '200px 300px'}}>
        <rect x={80} y={240} width={240} height={80} rx={8} fill={['#fffdf6', '#ffe9c0', '#d9ecff', '#ffd9d2'][i]} /><rect x={96} y={256} width={90} height={9} rx={4} fill="#9aa0b3" /><rect x={96} y={276} width={60} height={9} rx={4} fill="#9aa0b3" />
        <Txt x={270} y={292} size={26} fill={i === 3 ? P('red', 2) : '#16182a'}>{['$84', '$120', '$45', '$310'][i]}</Txt>
      </g>); })}
    <g transform={`rotate(-14 270 200) scale(${pop(t, 1.0, 0.35)})`} style={{transformOrigin: '270px 200px'}}><rect x={210} y={170} width={120} height={50} rx={6} fill="none" stroke={P('red', 1)} strokeWidth={6} /><Txt x={270} y={208} size={34} fill={P('red', 1)}>DUE</Txt></g>
  </g>
);

export const ShoppingBag: Obj = ({t}) => {
  const s = pop(t, 0, 0.55), sw = wave(t, 2) * 3;
  return (
    <g transform={`translate(200 330) rotate(${sw}) scale(${Math.max(0.01, s)}) translate(-200 -330)`}>
      <Shadow rx={120} />
      <path d="M150 120 q0 -70 50 -70 t50 70" fill="none" stroke={P('red', 2)} strokeWidth={12} strokeLinecap="round" />
      <path d="M96 120 H304 L324 330 H76Z" fill={url('red')} /><path d="M96 120 H304 L310 170 H90Z" fill="#fff" opacity={0.18} />
      <circle cx={200} cy={210} r={44} fill="#fff" opacity={0.92} /><Txt x={200} y={228} size={58} fill={P('red', 1)}>$</Txt>
    </g>
  );
};

export const Keys: Obj = ({t}) => {
  const sw = Math.sin(t * 2.6) * 7 * Math.exp(-t * 0.3);
  return (
    <g transform={`rotate(${sw} 200 60)`}>
      <Shadow rx={100} o={0.5} />
      <circle cx={200} cy={80} r={44} fill="none" stroke={url('grey')} strokeWidth={12} />
      {[[-34, 'gold'], [34, 'blue']].map(([dx, pal], i) => (
        <g key={i} transform={`translate(${200 + Number(dx)} ${130 + (1 - pop(t, 0.1 + i * 0.15, 0.5)) * -40}) rotate(${Number(dx) > 0 ? -8 : 8})`}>
          <circle r={34} fill={url(String(pal))} /><circle r={13} fill="#12142a" opacity={0.5} /><rect x={-10} y={30} width={20} height={150} rx={6} fill={url(String(pal))} /><rect x={10} y={120} width={32} height={14} fill={url(String(pal))} /><rect x={10} y={150} width={24} height={14} fill={url(String(pal))} />
        </g>))}
    </g>
  );
};

export const TaxForm: Obj = ({t}) => {
  const s = pop(t, 0, 0.5);
  return (
    <g transform={`scale(${Math.max(0.01, s)})`} style={{transformOrigin: '200px 200px'}}>
      <Shadow rx={110} />
      <rect x={90} y={26} width={220} height={300} rx={10} fill="#fffdf6" /><rect x={90} y={26} width={220} height={46} rx={10} fill={url('navy')} /><Txt x={200} y={60} size={26} fill="#fff">FORM 1040</Txt>
      {Array.from({length: 5}, (_, i) => <g key={i}><rect x={112} y={96 + i * 44} width={26} height={26} rx={4} fill="none" stroke="#7a8095" strokeWidth={3} /><path d={`M118 ${109 + i * 44} l7 8 l12 -16`} stroke={P('green', 1)} strokeWidth={5} fill="none" opacity={seg(t, 0.4 + i * 0.25, 0.6 + i * 0.25)} strokeLinecap="round" /><rect x={150} y={104 + i * 44} width={130 - (i % 2) * 40} height={9} rx={4} fill="#c9ccd6" /></g>)}
    </g>
  );
};

export const Ticker: Obj = ({t}) => {
  const items = ['AAPL +1.2', 'MSFT -0.4', 'S&P +0.8', 'GOLD +0.3', 'BOND -0.1', 'OIL -1.5'];
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
      <Shadow rx={160} />
      <rect x={30} y={110} width={340} height={170} rx={18} fill="#0b0d1e" /><rect x={30} y={110} width={340} height={170} rx={18} fill="none" stroke={P('green', 1)} strokeWidth={4} />
      {items.map((it, i) => { const y = 140 + ((i * 36 - t * 36) % 216 + 216) % 216 - 36; const neg = it.includes('-'); return y > 118 && y < 270 ? <Txt key={i} x={60} y={y} size={28} anchor="start" fill={neg ? '#ff5a4a' : '#5be38b'}>{`${neg ? '▼' : '▲'} ${it}`}</Txt> : null; })}
    </g>
  );
};

export const Rocket: Obj = ({t}) => {
  const y = -seg(t, 0.2, 3) * 160, sh = Math.sin(t * 40) * 1.5;
  return (
    <g>
      {Array.from({length: 10}, (_, i) => <circle key={i} cx={(i * 83) % 400} cy={(((i * 57 + t * 120) % 340) + 340) % 340} r={2 + (i % 3)} fill="#fff" opacity={0.6} />)}
      <g transform={`translate(${sh} ${y + 20})`}>
        <path d={`M200 330 q-24 ${40 + Math.abs(Math.sin(t * 20)) * 30} 0 ${90 + Math.abs(Math.sin(t * 20)) * 30} q24 -${50} 0 -90z`} fill="#ffb22e" opacity={0.95} />
        <path d="M200 40 Q250 110 250 210 H150 Q150 110 200 40Z" fill={url('grey')} /><path d="M200 40 Q225 110 225 210 H200Z" fill="#fff" opacity={0.2} /><circle cx={200} cy={130} r={22} fill={url('glass')} />
        <polygon points="150,170 112,250 150,236" fill={url('red')} /><polygon points="250,170 288,250 250,236" fill={url('red')} /><rect x={170} y={210} width={60} height={20} fill={P('red', 2)} />
      </g>
    </g>
  );
};

export const Ladder: Obj = ({t}) => {
  const climb = seg(t, 0.3, 2.6);
  return (
    <g>
      <Shadow rx={110} />
      {[130, 270].map(x => <rect key={x} x={x - 9} y={30} width={18} height={300} rx={8} fill={url('wall')} />)}
      {Array.from({length: 7}, (_, i) => <rect key={i} x={130} y={60 + i * 40} width={140} height={12} rx={5} fill={url('roof', true)} opacity={seg(t, i * 0.08, 0.4 + i * 0.08)} />)}
      <g transform={`translate(0 ${-climb * 200})`}><circle cx={200} cy={290} r={26} fill={url('gold')} /><Txt x={200} y={300} size={30} fill="#8a5a05">$</Txt></g>
    </g>
  );
};

export const Safe: Obj = ({t}) => {
  const open = segIO(t, 1.0, 1.7);
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 330px'}}>
      <Shadow rx={140} />
      <rect x={70} y={60} width={260} height={270} rx={16} fill={url('grey')} /><rect x={92} y={82} width={216} height={226} rx={10} fill={P('grey', 2)} opacity={0.5} />
      <g transform={`translate(${open * 20} 0) scale(${1 - open * 0.25} 1)`} style={{transformOrigin: '92px 195px'}}><rect x={92} y={82} width={216} height={226} rx={10} fill={url('navy')} /><circle cx={200} cy={195} r={52} fill={url('grey')} /><g transform={`rotate(${t * 90} 200 195)`}>{[0, 90, 180, 270].map(a => <rect key={a} x={196} y={150} width={8} height={26} rx={4} fill="#12142a" transform={`rotate(${a} 200 195)`} />)}</g><rect x={270} y={180} width={12} height={34} rx={5} fill={url('gold')} /></g>
      {open > 0.4 && <g opacity={open}>{[0, 1, 2].map(i => <rect key={i} x={120 + i * 60} y={230} width={46} height={46} rx={6} fill={url('green')} />)}</g>}
    </g>
  );
};

export const Hourglass: Obj = ({t}) => {
  const k = clamp((t * 0.28) % 1.2 / 1);
  return (
    <g transform={`rotate(${k > 1 ? (k - 1) * 900 : 0} 200 190)`}>
      <Shadow rx={90} />
      <rect x={110} y={32} width={180} height={18} rx={8} fill={url('wall')} /><rect x={110} y={330} width={180} height={18} rx={8} fill={url('wall')} />
      <path d="M130 50 H270 Q270 140 214 190 Q270 240 270 330 H130 Q130 240 186 190 Q130 140 130 50Z" fill="#cfe9ff" opacity={0.35} /><path d="M130 50 H270 Q270 140 214 190 Q270 240 270 330 H130 Q130 240 186 190 Q130 140 130 50Z" fill="none" stroke="#fff" strokeWidth={6} />
      <path d={`M${150 + k * 30} ${130 + k * 40} H${250 - k * 30} L200 190Z`} fill={url('gold')} /><path d={`M${160 - k * 10} 322 H${240 + k * 10} L200 ${322 - k * 110}Z`} fill={url('gold')} />
      <rect x={198} y={190} width={4} height={clamp(1 - k) * 130} fill={P('gold', 1)} />
    </g>
  );
};

export const Thermometer: Obj = ({t}) => {
  const k = seg(t, 0.2, 2.4), pulse = 1 + Math.sin(t * 6) * 0.03 * k;
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 330px'}}>
      <Shadow rx={90} />
      <rect x={168} y={30} width={64} height={250} rx={32} fill="#eef3ff" /><circle cx={200} cy={296} r={52} fill="#eef3ff" />
      <rect x={188} y={270 - k * 200} width={24} height={k * 200 + 20} rx={12} fill={url('red')} /><circle cx={200} cy={296} r={40 * pulse} fill={url('red')} />
      {[0, 1, 2, 3, 4].map(i => <rect key={i} x={240} y={60 + i * 44} width={i % 2 ? 22 : 36} height={5} rx={2} fill="#fff" opacity={0.7} />)}
      <Txt x={300} y={90} size={44} fill="#ff9a8a">{`${(2 + k * 7).toFixed(1)}%`}</Txt>
    </g>
  );
};

export const GasPump: Obj = ({t}) => {
  const v = 3.1 + seg(t, 0.3, 2.6) * 2.4;
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 330px'}}>
      <Shadow rx={110} />
      <rect x={90} y={40} width={170} height={290} rx={18} fill={url('red')} /><rect x={110} y={64} width={130} height={70} rx={8} fill="#12142a" /><Txt x={175} y={116} size={36} fill="#5be38b">{`$${v.toFixed(2)}`}</Txt>
      <rect x={110} y={160} width={130} height={14} rx={6} fill="#fff" opacity={0.3} /><rect x={90} y={316} width={170} height={20} rx={6} fill={P('red', 2)} />
      <path d="M260 120 q70 0 70 70 v90 q0 20 -20 20" fill="none" stroke="#1b1d26" strokeWidth={14} strokeLinecap="round" /><rect x={296} y={290} width={30} height={30} rx={6} fill="#1b1d26" />
    </g>
  );
};

export const Groceries: Obj = ({t}) => (
  <g>
    <Shadow rx={150} />
    {[[150, 'red', 0], [210, 'gold', 1], [270, 'green', 2]].map(([x, pal, i]) => { const k = seg(t, 0.2 + Number(i) * 0.25, 0.7 + Number(i) * 0.25); return <g key={String(x)} transform={`translate(0 ${-(1 - k) * 120})`} opacity={clamp(k * 3)}><circle cx={Number(x)} cy={190} r={32} fill={url(String(pal))} />{Number(i) === 0 && <rect x={Number(x) - 2} y={150} width={4} height={14} fill={P('green', 2)} />}</g>; })}
    <rect x={190} y={120} width={36} height={90} rx={10} fill={url('glass')} opacity={seg(t, 0.8, 1.2)} />
    <path d="M70 200 H330 L300 322 H100Z" fill={url('wall', true)} /><path d="M70 200 H330" stroke="#fff" strokeWidth={8} /><path d="M100 224 H300M104 252 H296M108 280 H292" stroke={P('wall', 2)} strokeWidth={4} />
    <path d="M110 200 q90 -90 180 0" fill="none" stroke={url('wall')} strokeWidth={10} />
  </g>
);

export const Coffee: Obj = ({t, value}) => (
  <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 330px'}}>
    <Shadow rx={120} />
    {[150, 200, 250].map((x, i) => <path key={i} d={`M${x} 110 q-16 -22 0 -44 t0 -44`} stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.45 + 0.4 * Math.sin(t * 2 + i)} transform={`translate(0 ${-((t * 18 + i * 9) % 30)})`} />)}
    <path d="M100 130 H300 L280 300 Q200 340 120 300Z" fill={url('wall', true)} /><rect x={100} y={130} width={200} height={20} rx={10} fill="#4a2a12" /><path d="M300 160 q56 0 56 50 t-62 50" fill="none" stroke={url('wall')} strokeWidth={14} strokeLinecap="round" />
    {value !== undefined && <g transform={`rotate(10 200 230)`}><rect x={140} y={195} width={120} height={56} rx={10} fill="#fff" /><Txt x={200} y={236} size={40} fill={P('red', 1)}>{`$${value}`}</Txt></g>}
  </g>
);

export const Subscriptions: Obj = ({t, accent}) => (
  <g>
    <Shadow rx={150} />
    {[['#e4572e', 'M0 -22 L26 0 L0 22Z'], [accent, 'M-12 14 V-16 L16 -22 V8 M-12 14 a8 8 0 1 0 0.1 0 M16 8 a8 8 0 1 0 0.1 0'], ['#3d8bdc', 'M-24 10 a14 14 0 0 1 8 -26 a22 22 0 0 1 42 6 a12 12 0 0 1 -2 20Z']].map(([c, d], i) => {
      const k = pop(t, 0.1 + i * 0.25, 0.5);
      return (
        <g key={i} transform={`translate(${200 + (i - 1) * 24} ${120 + i * 76 - (1 - k) * 80}) rotate(${(i - 1) * 4}) scale(${Math.max(0.01, k)})`}>
          <rect x={-150} y={-34} width={300} height={68} rx={16} fill="#fffdf6" /><circle cx={-110} cy={0} r={26} fill={String(c)} /><path d={String(d)} transform="translate(-110 0) scale(0.9)" fill="#fff" />
          <rect x={-66} y={-12} width={110} height={10} rx={5} fill="#c9ccd6" /><Txt x={110} y={10} size={32} fill="#16182a">{['$15', '$11', '$10'][i]}</Txt>
        </g>);
    })}
  </g>
);

export const Trophy: Obj = ({t}) => {
  const s = pop(t, 0, 0.6), sp = Math.max(0, wave(t, 1.4));
  return (
    <g transform={`translate(200 330) scale(${Math.max(0.01, s)}) translate(-200 -330)`}>
      <Shadow rx={110} />
      <path d="M110 70 H290 Q290 190 200 220 Q110 190 110 70Z" fill={url('gold')} /><path d="M110 90 q-60 0 -50 50 q10 40 60 44 M290 90 q60 0 50 50 q-10 40 -60 44" fill="none" stroke={url('gold')} strokeWidth={14} />
      <rect x={186} y={220} width={28} height={60} fill={url('gold')} /><rect x={140} y={280} width={120} height={46} rx={10} fill={url('navy')} /><Txt x={200} y={315} size={30} fill={P('gold', 0)}>#1</Txt>
      <ellipse cx={160} cy={110} rx={16} ry={36} fill="#fff" opacity={0.3} />
      {[[80, 50], [330, 70], [60, 220]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={6 * sp} fill="#fff3b0" />)}
    </g>
  );
};

export const Tree: Obj = ({t}) => {
  const k = seg(t, 0.1, 2.8);
  return (
    <g>
      <Shadow rx={130} />
      <path d={`M190 330 q4 ${-80 * k} -6 ${-150 * k} h32 q-10 ${70 * k} -2 ${150 * k}z`} fill={url('roof', true)} />
      {[[200, 130, 90], [130, 170, 60], [270, 170, 60], [170, 90, 50], [240, 90, 50]].map(([x, y, r], i) => { const s = seg(t, 0.5 + i * 0.35, 1.1 + i * 0.35); return <g key={i} transform={`translate(${x} ${y}) scale(${s})`}><circle r={Number(r)} fill={url('green')} /><circle cx={-Number(r) * 0.3} cy={-Number(r) * 0.3} r={Number(r) * 0.4} fill="#fff" opacity={0.15} />{i % 2 === 0 && <circle cx={Number(r) * 0.3} cy={Number(r) * 0.2} r={14} fill={url('gold')} />}</g>; })}
    </g>
  );
};

export const Anchor: Obj = ({t}) => {
  const sink = seg(t, 0.2, 2.2) * 60, sw = wave(t, 2.5) * 3;
  return (
    <g transform={`translate(0 ${sink * 0.5}) rotate(${sw} 200 120)`}>
      <Shadow rx={110} cy={348} />
      <circle cx={200} cy={70} r={22} fill="none" stroke={url('grey')} strokeWidth={12} /><rect x={188} y={90} width={24} height={200} rx={8} fill={url('navy')} /><rect x={140} y={112} width={120} height={20} rx={8} fill={url('navy')} />
      <path d="M90 230 Q110 320 200 320 Q290 320 310 230" fill="none" stroke={url('navy')} strokeWidth={22} strokeLinecap="round" /><polygon points="76,226 112,214 104,262" fill={url('navy')} /><polygon points="324,226 288,214 296,262" fill={url('navy')} />
      <Txt x={200} y={190} size={40} fill="#ff9a8a" stroke="#12142a">DEBT</Txt>
    </g>
  );
};

export const Hole: Obj = ({t}) => (
  <g>
    <ellipse cx={200} cy={290} rx={170} ry={46} fill="#000" opacity={0.75} /><ellipse cx={200} cy={290} rx={170} ry={46} fill="none" stroke={P('wall', 2)} strokeWidth={10} />
    {Array.from({length: 6}, (_, i) => { const a = 0.15 + i * 0.4, u = clamp(((t - a) % 2.2) / 1.1); if (t < a) return null; return <g key={i} transform={`translate(${130 + i * 28} ${60 + u * u * 220}) scale(${1 - u * 0.7})`} opacity={1 - u * 0.5}><circle r={20} fill={url('gold')} /></g>; })}
    <Txt x={200} y={60} size={40} fill="#ff9a8a" stroke="#12142a">DEBT HOLE</Txt>
  </g>
);

export const MapPinRoute: Obj = ({t}) => {
  const k = seg(t, 0.2, 2.2);
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
      <Shadow rx={150} />
      <path d="M50 100 L150 80 L250 110 L350 90 V300 L250 320 L150 290 L50 310Z" fill="#fff1d6" /><path d="M150 80 V290 M250 110 V320" stroke="#e2c89a" strokeWidth={4} />
      <path d="M80 270 Q150 160 220 220 T330 120" fill="none" stroke={P('red', 1)} strokeWidth={8} strokeDasharray="14 12" pathLength={1} strokeDashoffset={1 - k} />
      <g transform={`translate(330 ${120 - (1 - pop(t, 1.6, 0.4)) * 60})`} opacity={clamp((t - 1.5) * 3)}><path d="M0 0 C-30 -40 -34 -60 -34 -76 a34 34 0 0 1 68 0 C34 -60 30 -40 0 0Z" fill={url('red')} /><circle cy={-76} r={12} fill="#fff" /></g>
    </g>
  );
};

export const Donut: Obj = ({t}) => {
  const parts: [number, string][] = [[0.5, 'blue'], [0.3, 'green'], [0.2, 'gold']], R = 120, r = 66;
  let a0 = -Math.PI / 2;
  return (
    <g transform={`rotate(${(1 - seg(t, 0, 1.2)) * -90} 200 190)`}>
      <Shadow rx={140} cy={338} />
      {parts.map(([f, pal], i) => { const f2 = f * seg(t, 0.1 + i * 0.4, 0.9 + i * 0.4), a1 = a0 + f2 * Math.PI * 2, big = f2 > 0.5 ? 1 : 0, p = (a: number, rr: number) => `${200 + Math.cos(a) * rr},${190 + Math.sin(a) * rr}`; const d = `M${p(a0, R)} A${R} ${R} 0 ${big} 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 ${big} 0 ${p(a0, r)}Z`; a0 += f * Math.PI * 2; return <path key={i} d={d} fill={url(pal)} />; })}
      <Txt x={200} y={206} size={52} fill="#fff" stroke="#12142a">100%</Txt>
    </g>
  );
};

export const LineChart: Obj = ({t}) => {
  const vals = [30, 44, 38, 62, 58, 90, 120, 168], k = seg(t, 0.2, 2.2), n = vals.length;
  const pts = vals.map((v, i) => [50 + (i * 300) / (n - 1), 320 - v * 1.5] as const);
  const upto = k * (n - 1), d = pts.map((p, i) => i <= upto ? `${i ? 'L' : 'M'}${p[0]} ${p[1]}` : '').join('') + (upto < n - 1 ? `L${pts[Math.floor(upto)][0] + (pts[Math.floor(upto) + 1][0] - pts[Math.floor(upto)][0]) * (upto % 1)} ${pts[Math.floor(upto)][1] + (pts[Math.floor(upto) + 1][1] - pts[Math.floor(upto)][1]) * (upto % 1)}` : '');
  return (
    <g>
      <rect x={30} y={40} width={340} height={290} rx={18} fill="#0b0d1e" opacity={0.55} />
      {[0, 1, 2, 3].map(i => <line key={i} x1={44} x2={356} y1={90 + i * 70} y2={90 + i * 70} stroke="#fff" strokeOpacity={0.12} strokeWidth={2} />)}
      <path d={`${d} L${pts[Math.min(n - 1, Math.floor(upto) + 1)][0]} 330 L50 330Z`} fill={P('green', 1)} opacity={0.22} />
      <path d={d} fill="none" stroke="#12142a" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} /><path d={d} fill="none" stroke={url('green')} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i <= upto ? <circle key={i} cx={p[0]} cy={p[1]} r={8} fill="#fff" stroke={P('green', 2)} strokeWidth={4} /> : null)}
    </g>
  );
};

export const StackedBars: Obj = ({t}) => (
  <g>
    <Shadow rx={160} />
    {[[110, 90, 70], [140, 110, 60], [170, 120, 90], [200, 140, 120]].map(([a, b, c], i) => { const k = seg(t, 0.1 + i * 0.25, 0.8 + i * 0.25), x = 70 + i * 74; return <g key={i}>{[[a, 'blue'], [b, 'green'], [c, 'gold']].map(([hh, pal], j) => { const y0 = [0, a as number, (a as number) + (b as number)][j]; const h2 = (Number(hh) * 0.5) * k; return <rect key={j} x={x} y={322 - (y0 * 0.5) * k - h2} width={52} height={h2} fill={url(String(pal), true)} rx={j === 2 ? 6 : 0} />; })}</g>; })}
  </g>
);

export const Calculator: Obj = ({t, value}) => {
  const v = (value ?? 0) * seg(t, 0.2, 2); // only the beat's own number; no number = blank display
  return (
    <g transform={`rotate(-5 200 200) scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
      <Shadow rx={110} />
      <rect x={100} y={30} width={200} height={300} rx={22} fill={url('navy')} /><rect x={116} y={50} width={168} height={64} rx={8} fill="#cfeedd" />{value !== undefined && <Txt x={274} y={98} size={40} anchor="end" fill="#16382a">{money(v)}</Txt>}
      {Array.from({length: 12}, (_, i) => <rect key={i} x={118 + (i % 4) * 42} y={138 + Math.floor(i / 4) * 62} width={34} height={46} rx={8} fill={i === 11 ? url('red') : i % 4 === 3 ? url('gold') : '#aab1c0'} opacity={0.5 + 0.5 * (tick(t, 12, 0.18) === i ? 1 : 0.6)} />)}
    </g>
  );
};

export const Dice: Obj = ({t}) => {
  const f = (cx: number, cy: number, rot: number, n: number) => (
    <g transform={`translate(${cx} ${cy + Math.abs(Math.sin(t * 5)) * -20 * Math.exp(-t * 0.7)}) rotate(${rot + t * 120 * Math.exp(-t)})`}><rect x={-50} y={-50} width={100} height={100} rx={18} fill="#fffdf6" />{[[-26, -26], [26, 26], [-26, 26], [26, -26], [0, 0]].slice(0, n).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="#16182a" />)}</g>
  );
  return <g><Shadow rx={140} />{f(140, 260, 10, 4)}{f(260, 250, -14, 5)}</g>;
};

export const Umbrella: Obj = ({t}) => {
  const s = pop(t, 0, 0.55);
  return (
    <g transform={`rotate(${wave(t, 3) * 3} 200 330) scale(${Math.max(0.01, s)})`} style={{transformOrigin: '200px 330px'}}>
      <Shadow rx={110} />
      <path d="M40 170 Q40 40 200 40 Q360 40 360 170 Q320 140 280 170 Q240 140 200 170 Q160 140 120 170 Q80 140 40 170Z" fill={url('red')} /><path d="M200 40 Q250 90 240 170 M200 40 Q150 90 160 170" stroke="#fff" strokeOpacity={0.3} strokeWidth={4} fill="none" />
      <path d="M200 170 V300 q0 30 -30 30" fill="none" stroke={url('navy')} strokeWidth={12} strokeLinecap="round" />
      {Array.from({length: 7}, (_, i) => <line key={i} x1={60 + i * 48} y1={((t * 220 + i * 70) % 300)} x2={56 + i * 48} y2={((t * 220 + i * 70) % 300) + 22} stroke="#bfe0ff" strokeWidth={4} opacity={0.6} />)}
    </g>
  );
};

export const Flame: Obj = ({t}) => {
  const fl = 1 + Math.sin(t * 14) * 0.06;
  return (
    <g>
      <Shadow rx={100} />
      <g transform={`translate(200 330) scale(${pop(t, 0, 0.5) * fl} ${pop(t, 0, 0.5) * (1 + Math.sin(t * 11) * 0.08)}) translate(-200 -330)`}>
        <path d="M200 40 C250 110 310 150 300 230 C292 300 250 330 200 330 C150 330 108 300 100 230 C94 170 140 150 160 100 C176 130 186 120 200 40Z" fill={url('red')} /><path d="M200 130 C230 180 262 200 256 250 C252 290 230 310 200 310 C170 310 148 290 144 250 C140 210 176 190 200 130Z" fill="#ffb22e" /><path d="M200 210 C216 236 232 246 228 274 C226 292 214 300 200 300 C186 300 174 292 172 274 C170 250 190 240 200 210Z" fill="#fff3b0" />
      </g>
      <g transform="translate(0 -6)"><rect x={150} y={300} width={100} height={36} rx={4} fill={url('green')} opacity={0.9} /><Txt x={200} y={328} size={26} fill="#c8ffd9">$$$</Txt></g>
    </g>
  );
};

export const CoinSpin: Obj = ({t}) => {
  const sx = Math.max(0.1, Math.abs(Math.cos(t * 3.2))), s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(0 ${-Math.abs(Math.sin(t * 3.2)) * 20 * 0 + wave(t, 1.6) * 6})`}>
      <ellipse cx={200} cy={330} rx={110 * (0.6 + sx * 0.4)} ry={20} fill="url(#fb-shadow)" />
      <g transform={`translate(200 190) scale(${sx * s} ${s}) translate(-200 -190)`}><circle cx={200} cy={190} r={130} fill={url('gold')} /><circle cx={200} cy={190} r={100} fill="none" stroke="#fff3b0" strokeWidth={8} /><Txt x={200} y={235} size={150} fill={P('gold', 2)}>$</Txt></g>
    </g>
  );
};

export const Clipboard: Obj = ({t}) => (
  <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
    <Shadow rx={110} />
    <rect x={90} y={40} width={220} height={290} rx={16} fill={url('wall', true)} /><rect x={104} y={64} width={192} height={252} rx={8} fill="#fffdf6" /><rect x={150} y={26} width={100} height={36} rx={10} fill={url('grey')} />
    {Array.from({length: 4}, (_, i) => <g key={i}><rect x={120} y={96 + i * 56} width={28} height={28} rx={6} fill="none" stroke="#7a8095" strokeWidth={3} /><path d={`M126 ${110 + i * 56} l8 9 l14 -18`} stroke={P('green', 1)} strokeWidth={6} fill="none" strokeLinecap="round" opacity={seg(t, 0.4 + i * 0.4, 0.6 + i * 0.4)} /><rect x={162} y={104 + i * 56} width={110 - (i % 2) * 36} height={10} rx={5} fill="#c9ccd6" /></g>)}
  </g>
);

/** Simple human figure: body style x pose x face. Drawn as flat shapes so it fits the object look. */
export const Person: React.FC<{t: number; pose?: 'stand' | 'stress' | 'cheer' | 'point' | 'walk'; face?: 'neutral' | 'worried' | 'happy' | 'shock'; skin?: string; shirt?: string; hair?: string; x?: number; style?: 'round' | 'block'}> = ({t, pose = 'stand', face = 'neutral', skin = '#f1c9a5', shirt = '#3d8bdc', hair = '#3a2a1f', x = 200, style = 'round'}) => {
  const bob = Math.sin(t * 2.2) * 2, arm = pose === 'cheer' ? -150 + Math.sin(t * 7) * 10 : pose === 'stress' ? -130 : pose === 'point' ? -80 : 20;
  const L = (a: number, dx: number) => <g transform={`translate(${x + dx} 210) rotate(${a})`}><rect x={-9} y={0} width={18} height={84} rx={9} fill={shirt} /><circle cy={86} r={11} fill={skin} /></g>;
  return (
    <g transform={`translate(0 ${bob})`}>
      <ellipse cx={x} cy={334} rx={60} ry={10} fill="url(#fb-shadow)" />
      <rect x={x - 26} y={250} width={22} height={80} rx={9} fill="#2b3a66" transform={pose === 'walk' ? `rotate(${Math.sin(t * 6) * 12} ${x - 15} 250)` : undefined} /><rect x={x + 4} y={250} width={22} height={80} rx={9} fill="#2b3a66" transform={pose === 'walk' ? `rotate(${-Math.sin(t * 6) * 12} ${x + 15} 250)` : undefined} />
      <rect x={x - 38} y={176} width={76} height={style === 'block' ? 100 : 90} rx={style === 'block' ? 10 : 30} fill={shirt} />
      {L(pose === 'cheer' ? arm : pose === 'stress' ? arm * 0.9 : -arm * 0.2, -40)}{L(pose === 'cheer' ? -arm : pose === 'stress' ? -arm * 0.9 : pose === 'point' ? arm : arm * 0.2, 40)}
      <circle cx={x} cy={130} r={42} fill={skin} /><path d={`M${x - 44} 124 Q${x - 40} 82 ${x} 84 Q${x + 40} 82 ${x + 44} 124 Q${x + 20} 100 ${x - 44} 124Z`} fill={hair} />
      <circle cx={x - 15} cy={132} r={4.5} fill="#16182a" /><circle cx={x + 15} cy={132} r={4.5} fill="#16182a" />
      {face === 'happy' && <path d={`M${x - 16} 150 q16 18 32 0`} stroke="#16182a" strokeWidth={4} fill="none" strokeLinecap="round" />}
      {face === 'worried' && <><path d={`M${x - 16} 158 q16 -12 32 0`} stroke="#16182a" strokeWidth={4} fill="none" strokeLinecap="round" /><path d={`M${x - 24} 118 l14 -6 M${x + 24} 118 l-14 -6`} stroke="#16182a" strokeWidth={4} strokeLinecap="round" /><ellipse cx={x + 40} cy={116 + ((t * 40) % 24)} rx={4} ry={7} fill="#7ec8ff" /></>}
      {face === 'shock' && <ellipse cx={x} cy={156} rx={9} ry={12} fill="#16182a" />}
      {face === 'neutral' && <path d={`M${x - 12} 154 h24`} stroke="#16182a" strokeWidth={4} strokeLinecap="round" />}
    </g>
  );
};

const mk = (pose: any, face: any, shirt: string, extra?: (t: number) => React.ReactNode, skin = '#f1c9a5', hair = '#3a2a1f', style: any = 'round'): Obj => ({t}) => <g><Person t={t} pose={pose} face={face} shirt={shirt} skin={skin} hair={hair} style={style} x={extra ? 130 : 200} />{extra?.(t)}</g>;
export const PersonAtm: Obj = ({t}) => <g><g transform="translate(110 20) scale(0.8)"><Atm t={t} accent="#fff" /></g><Person t={t} pose="point" face="neutral" shirt="#3d8bdc" x={110} /></g>;
export const PersonStressedBills: Obj = ({t}) => <g><g transform="translate(120 40) scale(0.8)"><Bills t={t} accent="#fff" /></g><Person t={t} pose="stress" face="worried" shirt="#c2503a" x={110} /></g>;
export const PersonCelebrate: Obj = mk('cheer', 'happy', '#2e9e5b', undefined, '#c68a5e', '#1b1210', 'block');
export const PersonShocked: Obj = mk('stress', 'shock', '#8a3322', undefined, '#8d5a3c', '#1b1210');
export const PersonThinking: Obj = mk('point', 'neutral', '#6a4c93', undefined, '#f5d3b3', '#7a4a1e', 'block');
export const PersonWalking: Obj = ({t}) => <g transform={`translate(${-60 + seg(t, 0, 2.5) * 120} 0)`}><Person t={t} pose="walk" face="neutral" shirt="#2a9d8f" /></g>;

export const NEW_SUBJECTS: Record<string, Obj> = {
  atm: Atm, paycheck: Paycheck, bills: Bills, shopping_bag: ShoppingBag, keys: Keys, tax_form: TaxForm, ticker: Ticker, rocket: Rocket, ladder: Ladder, safe: Safe, hourglass: Hourglass, thermometer: Thermometer, gas_pump: GasPump,
  groceries: Groceries, coffee: Coffee, subscriptions: Subscriptions, trophy: Trophy, tree: Tree, anchor: Anchor, hole: Hole, map_route: MapPinRoute, donut: Donut, line_chart: LineChart, stacked_bars: StackedBars, calculator: Calculator,
  dice: Dice, umbrella: Umbrella, flame: Flame, coin_spin: CoinSpin, clipboard: Clipboard,
  person_atm: PersonAtm, person_bills: PersonStressedBills, person_celebrate: PersonCelebrate, person_shocked: PersonShocked, person_thinking: PersonThinking, person_walking: PersonWalking,
};
