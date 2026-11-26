import React from 'react';
import {clamp} from '../theme';
import {PALETTES, Shadow, Txt, pop, seg, segIO, wave} from './kit';
import type {Obj} from './objects';

const url = (k: string, v = false) => `url(#fb-${k}${v ? '-v' : ''})`;
const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** Coins drop into a glass jar and the level rises. */
export const JarFill: Obj = ({t}) => {
  const N = 7, lvl = Math.min(1, Math.max(0, (t - 0.5) / (0.4 * N + 0.2))) * 0.82 + 0.03;
  return (
    <g>
      <Shadow rx={120} />
      <rect x={110} y={70} width={180} height={254} rx={36} fill="#cfe9ff" opacity={0.28} />
      <clipPath id="jarclip"><rect x={116} y={76} width={168} height={242} rx={32} /></clipPath>
      <g clipPath="url(#jarclip)"><rect x={110} y={318 - lvl * 236} width={180} height={lvl * 236 + 4} fill={url('gold', true)} />
        <path d={`M110 ${318 - lvl * 236} q22 ${wave(t, 1.1) * 7} 45 0 t45 0 t45 0 t45 0`} fill={PALETTES.gold[0]} /></g>
      <rect x={110} y={70} width={180} height={254} rx={36} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={6} /><rect x={124} y={84} width={14} height={150} rx={7} fill="#fff" opacity={0.4} />
      <rect x={126} y={46} width={148} height={30} rx={10} fill={url('red')} />
      {Array.from({length: N}, (_, i) => { const a = 0.2 + i * 0.4, u = clamp((t - a) / 0.5); if (u <= 0 || u >= 1) return null; return <g key={i} transform={`translate(${190 + (i % 3) * 18 - 18} ${-20 + u * u * (300 - 236 * lvl)}) scale(${Math.max(0.2, Math.abs(Math.cos(t * 8 + i)))} 1)`}><circle r={22} fill={url('gold')} /><circle r={15} fill={PALETTES.gold[0]} /></g>; })}
    </g>
  );
};

/** Card slides through a payment terminal, check pops, receipt prints. */
export const CardSwipe: Obj = ({t, accent}) => {
  const per = 1.9, ph = (t % per) / per, x = -140 + segIO(ph, 0.05, 0.55) * 250, ok = ph > 0.55 ? pop(ph, 0.55, 0.3) : 0, rec = Math.min(1, t / 2.5);
  return (
    <g>
      <Shadow rx={150} />
      <rect x={200} y={90} width={160} height={230} rx={22} fill={url('navy')} /><rect x={216} y={108} width={128} height={60} rx={10} fill={ok > 0.5 ? PALETTES.green[1] : url('glass', true)} />
      <Txt x={280} y={150} size={36} fill="#fff">{ok > 0.5 ? 'OK' : '$ ...'}</Txt>
      {Array.from({length: 9}, (_, i) => <rect key={i} x={222 + (i % 3) * 38} y={186 + Math.floor(i / 3) * 30} width={28} height={20} rx={5} fill="#aab1c0" />)}
      <rect x={150} y={72} width={14} height={8} fill="none" />
      <g transform={`translate(${x} 0)`}><rect x={30} y={120} width={150} height={96} rx={14} fill={url('accent')} /><rect x={30} y={140} width={150} height={18} fill="#12141c" opacity={0.85} /><rect x={46} y={172} width={34} height={26} rx={6} fill={url('gold')} /></g>
      <g transform={`translate(${ok > 0 ? 0 : 0} 0)`} opacity={ok}><circle cx={110} cy={70} r={30 * ok} fill={url('green')} /><path d="M96 70l10 10 20-22" stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round" /></g>
      <rect x={236} y={318} width={88} height={Math.max(0, 70 * rec)} fill="#fffdf6" /><path d="M236 318 h88" stroke="#16182a" strokeOpacity={0.3} strokeWidth={4} />
      {void accent}
    </g>
  );
};

/** Bar chart whose bars grow while an arrow rides along the tops. */
export const BarsArrow: Obj = ({t}) => {
  const hs = [60, 95, 85, 140, 185, 235], k = seg(t, 0.2, 2.1);
  const pts = hs.map((h, i) => [64 + i * 56, 310 - i * 4 - h - 24] as const);
  const upto = k * (pts.length - 1), i0 = Math.min(pts.length - 2, Math.floor(upto)), fr = upto - i0;
  const head = [pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * fr, pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * fr];
  const d = pts.slice(0, i0 + 1).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('') + `L${head[0]} ${head[1]}`;
  return (
    <g>
      <Shadow rx={190} />
      {hs.map((h, i) => { const g = seg(t, 0.1 + i * 0.28, 0.7 + i * 0.28) * h, ox = 46 + i * 56, oy = 322 - i * 4; return <g key={i}><polygon points={`${ox},${oy} ${ox - 20},${oy - 11} ${ox - 20},${oy - 11 - g} ${ox},${oy - g}`} fill={PALETTES.blue[1]} /><polygon points={`${ox},${oy} ${ox + 33},${oy - 19} ${ox + 33},${oy - 19 - g} ${ox},${oy - g}`} fill={PALETTES.blue[2]} /><polygon points={`${ox},${oy - g} ${ox + 33},${oy - 19 - g} ${ox + 13},${oy - 30 - g} ${ox - 20},${oy - 11 - g}`} fill={i === 5 ? PALETTES.green[0] : PALETTES.blue[0]} /></g>; })}
      <path d={d} fill="none" stroke="#12142a" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} /><path d={d} fill="none" stroke={url('green')} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="0,-24 24,16 -24,16" fill={url('green')} transform={`translate(${head[0]} ${head[1]}) rotate(${Math.atan2(pts[i0 + 1][1] - pts[i0][1], pts[i0 + 1][0] - pts[i0][0]) * 57.3 + 90})`} />
    </g>
  );
};

/** Interest snowball: rolls down a slope and keeps growing. */
export const Snowball: Obj = ({t}) => {
  const p = seg(t, 0.15, 3.2), r = 18 + p * 76, x = 40 + p * 270, y = 96 + p * 150 - r * 0.2;
  return (
    <g>
      <Shadow rx={180} />
      <polygon points="0,110 400,320 400,360 0,360" fill={url('wall', true)} opacity={0.0} /><polygon points="10,120 400,326 400,350 10,350" fill="#e9f3ff" /><polygon points="10,120 400,326 400,334 10,128" fill="#fff" />
      <g transform={`translate(${x} ${y + r * 0.35}) rotate(${p * 900})`}>
        <circle r={r} fill="#f4f9ff" /><circle r={r} fill="url(#fb-glow)" opacity={0.0} />
        {[[-0.4, -0.3, 0.2], [0.35, 0.1, 0.16], [-0.1, 0.45, 0.14], [0.2, -0.5, 0.12]].map(([a, b, c], i) => <circle key={i} cx={a * r} cy={b * r} r={c * r} fill="#cfe0f2" />)}
        <Txt x={0} y={r * 0.3} size={r * 0.9} fill={PALETTES.blue[1]}>%</Txt>
      </g>
      {Array.from({length: 6}, (_, i) => { const u = (t * 1.4 + i / 6) % 1; return <circle key={i} cx={x - 20 - u * 80} cy={y + r * 0.5 + u * 22} r={5 * (1 - u)} fill="#fff" opacity={0.8 * (1 - u)} />; })}
    </g>
  );
};

/** Debt number ticking up in red. */
export const DebtCounter: Obj = ({t, value}) => {
  const v = (value ?? 9999) * seg(t, 0.2, 2.8), s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow rx={150} />
      <rect x={40} y={110} width={320} height={170} rx={26} fill="#1a1020" /><rect x={40} y={110} width={320} height={170} rx={26} fill="none" stroke={PALETTES.red[1]} strokeWidth={5} />
      <Txt x={200} y={160} size={26} fill="#ff9a8a">YOU OWE</Txt><Txt x={200} y={242} size={Math.min(88, 640 / Math.max(6, money(v).length + 2))} fill="#ff5a4a" stroke="#400">{`$${money(v)}`}</Txt>
      <polygon points="200,40 236,96 164,96" fill={url('red')} transform={`translate(0 ${-Math.abs(wave(t, 0.9)) * 12})`} />
    </g>
  );
};

/** Interest-rate dial: needle swings into the red. */
export const Gauge: Obj = ({t}) => {
  const k = seg(t, 0.2, 1.6) + Math.sin(t * 9) * 0.015 * clamp((t - 1.6) * 3), ang = -90 + 180 * clamp(k * 0.82);
  const arc = (a0: number, a1: number, c: string) => { const p = (a: number) => [200 + Math.cos((a - 180) * Math.PI / 180) * 130, 250 + Math.sin((a - 180) * Math.PI / 180) * 130]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return <path d={`M${x0} ${y0} A130 130 0 0 1 ${x1} ${y1}`} stroke={c} strokeWidth={34} fill="none" />; };
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 250px'}}>
      <Shadow cy={282} rx={150} />
      <circle cx={200} cy={250} r={166} fill={url('navy')} opacity={0.0} />
      {arc(0, 60, PALETTES.green[1])}{arc(60, 120, PALETTES.gold[1])}{arc(120, 180, PALETTES.red[1])}
      <g transform={`rotate(${ang} 200 250)`}><polygon points="194,250 206,250 200,134" fill="#fff" /></g><circle cx={200} cy={250} r={20} fill={url('gold')} />
      <Txt x={200} y={236} size={44} fill="#fff" stroke="#12142a">{`${(4 + k * 21).toFixed(1)}%`}</Txt>
    </g>
  );
};

/** Price tag whose number ticks up (inflation, fees). */
export const PriceUp: Obj = ({t}) => {
  const v = 4.99 + seg(t, 0.3, 2.6) * 5.5, s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(200 190) rotate(${-8 + Math.sin(t * 2) * 2}) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow rx={120} />
      <path d="M60 110 H300 L350 190 L300 270 H60 Q40 270 40 250 V130 Q40 110 60 110Z" fill={url('red')} /><circle cx={78} cy={190} r={13} fill="#12142a" />
      <Txt x={190} y={218} size={78} fill="#fff" stroke="#6a1a0a">{`$${v.toFixed(2)}`}</Txt>
      <polygon points="200,28 240,84 160,84" fill={url('red')} transform={`translate(${130} ${-Math.abs(wave(t, 0.8)) * 10 + 4})`} opacity={seg(t, 0.4, 0.8)} />
    </g>
  );
};

/** Pie: the interest slice sweeps open. */
export const Pie: Obj = ({t}) => {
  const k = seg(t, 0.3, 2.0) * 0.62, a = k * Math.PI * 2, R = 140, ex = 200 + Math.sin(a) * R, ey = 190 - Math.cos(a) * R;
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 190px'}}>
      <Shadow cy={338} rx={150} />
      <circle cx={200} cy={190} r={R} fill={url('blue')} />
      <path d={`M200 190 L200 ${190 - R} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${ex} ${ey}Z`} fill={url('red')} transform={`translate(${Math.sin(a / 2) * 8} ${-Math.cos(a / 2) * 8})`} />
      <circle cx={200} cy={190} r={50} fill="#12142a" opacity={0.0} />
      <Txt x={200} y={206} size={54} fill="#fff" stroke="#12142a">{`${Math.round(k * 100)}%`}</Txt>
    </g>
  );
};

/** Calendar whose pages flip through the months. */
export const CalendarFlip: Obj = ({t}) => {
  const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'], per = 0.55, k = Math.floor(t / per), u = (t % per) / per, flip = u < 0.35 ? u / 0.35 : 1, sy = Math.abs(Math.cos(flip * Math.PI / 2));
  return (
    <g transform={`scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
      <Shadow cy={346} rx={130} />
      <rect x={70} y={60} width={260} height={270} rx={22} fill="#fffdf6" />
      {Array.from({length: 18}, (_, i) => <rect key={i} x={92 + (i % 6) * 38} y={154 + Math.floor(i / 6) * 54} width={28} height={36} rx={6} fill={i === (k * 5) % 18 ? PALETTES.red[1] : '#e8ebf2'} />)}
      <path d="M70 82a22 22 0 0 1 22-22h216a22 22 0 0 1 22 22v50H70z" fill={url('red')} />
      <g transform={`translate(0 ${60}) scale(1 ${u < 0.35 ? sy : 1}) translate(0 -60)`}><path d="M70 82a22 22 0 0 1 22-22h216a22 22 0 0 1 22 22v50H70z" fill={PALETTES.red[0]} opacity={u < 0.35 ? 1 : 0} /></g>
      <Txt x={200} y={118} size={46} fill="#fff">{M[k % M.length]}</Txt>
      {[110, 290].map(x => <rect key={x} x={x - 6} y={40} width={12} height={40} rx={6} fill={url('grey')} />)}
    </g>
  );
};

export const ACTIONS: Record<string, Obj> = {jar_fill: JarFill, card_swipe: CardSwipe, bars_arrow: BarsArrow, snowball: Snowball, debt_counter: DebtCounter, gauge: Gauge, price_up: PriceUp, pie: Pie, calendar: CalendarFlip};
