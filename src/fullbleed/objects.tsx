import React from 'react';
import {clamp} from '../theme';
import {IsoBox, PALETTES, Shadow, Txt, pop, seg, segIO, wave} from './kit';

export type Obj = React.FC<{t: number; accent: string; value?: number; label?: string}>;
const url = (k: string, v = false) => `url(#fb-${k}${v ? '-v' : ''})`;

/** Skyscrapers rising one after another, lit windows blinking. */
export const Skyline: Obj = ({t}) => {
  const bs = [[70, 300, 46, 'navy'], [118, 200, 60, 'blue'], [170, 250, 50, 'glass'], [228, 150, 64, 'navy'], [282, 220, 54, 'blue'], [330, 120, 44, 'glass']] as const;
  return (
    <g>
      <Shadow rx={180} />
      {bs.map(([x, hh, w, pal], i) => {
        const h = hh * seg(t, 0.05 + i * 0.12, 0.7 + i * 0.12);
        return (
          <IsoBox key={i} ox={x} oy={330 - (i % 2) * 8} w={w * 0.7} d={w * 0.6} h={h} pal={pal}>
            {Array.from({length: Math.floor(h / 26)}, (_, r) => [0, 1].map(c => {
              const on = (Math.floor(t * 1.5 + r * 3 + c * 5 + i) % 4) !== 0;
              return <rect key={`${r}${c}`} x={x - w * 0.5 + c * w * 0.28} y={330 - (i % 2) * 8 - h + 14 + r * 26 - w * 0.12} width={w * 0.14} height={10} fill={on ? '#fff3b0' : '#ffffff'} opacity={on ? 0.9 : 0.18} transform={`skewY(${c ? -0 : 0})`} />;
            }))}
          </IsoBox>
        );
      })}
    </g>
  );
};

export const House: Obj = ({t}) => {
  const s = pop(t, 0, 0.6), roof = pop(t, 0.35, 0.5);
  return (
    <g transform={`translate(200 330) scale(${Math.max(0.01, s)}) translate(-200 -330)`}>
      <Shadow rx={170} />
      <rect x={298} y={96} width={26} height={70} fill={url('roof', true)} />
      <rect x={76} y={168} width={248} height={160} rx={6} fill={url('wall', true)} /><rect x={76} y={168} width={248} height={160} rx={6} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} />
      <g transform={`translate(0 ${-(1 - roof) * 70})`} opacity={roof}>
        <polygon points="56,176 200,64 344,176" fill={url('roof')} /><polygon points="200,64 344,176 200,176" fill={PALETTES.roof[2]} opacity={0.35} />
      </g>
      <rect x={168} y={236} width={64} height={92} rx={6} fill={url('roof', true)} /><circle cx={218} cy={284} r={4} fill={PALETTES.gold[0]} />
      {[100, 252].map((x, i) => <g key={x}><rect x={x} y={214} width={52} height={54} rx={5} fill={url('glass', true)} opacity={0.5 + 0.5 * (Math.floor(t * 1.2 + i) % 2)} /><path d={`M${x + 26} 214v54M${x} 241h52`} stroke="#fff" strokeWidth={3} /></g>)}
      <circle cx={46} cy={296} r={30 * seg(t, 0.7, 1.1)} fill={url('green', true)} /><rect x={42} y={308} width={8} height={22} fill={PALETTES.green[2]} />
    </g>
  );
};

export const Car: Obj = ({t}) => {
  const x = (1 - seg(t, 0, 0.8)) * -260, bob = wave(t, 0.5) * 1.2, spin = t * 700;
  return (
    <g transform={`translate(${x} ${bob})`}>
      <Shadow rx={150} />
      <path d="M52 270 Q56 232 100 226 L158 224 Q190 176 236 176 Q290 180 318 226 Q350 232 352 268 L352 292 L52 292Z" fill={url('red')} />
      <path d="M170 222 Q196 188 232 188 Q276 190 296 222Z" fill={url('glass')} />
      <rect x={52} y={284} width={300} height={10} fill={PALETTES.red[2]} />
      <circle cx={364} cy={262} r={9} fill="#fff3b0" opacity={0.95} /><circle cx={364} cy={262} r={26} fill="url(#fb-glow)" />
      {[116, 296].map(cx => (
        <g key={cx} transform={`translate(${cx} 296)`}><circle r={34} fill="#1b1d26" /><circle r={19} fill={url('grey')} /><g transform={`rotate(${spin})`}>{[0, 72, 144, 216, 288].map(a => <rect key={a} x={-2} y={-17} width={4} height={14} fill={PALETTES.grey[2]} transform={`rotate(${a})`} />)}</g></g>
      ))}
    </g>
  );
};

export const CoinStacks: Obj = ({t}) => {
  const stacks = [[90, 5], [170, 9], [250, 7], [325, 12]];
  return (
    <g>
      <Shadow rx={190} />
      {stacks.map(([x, n], si) => (
        <g key={si}>
          {Array.from({length: n}, (_, i) => {
            const a = 0.1 + si * 0.15 + i * 0.07, y = 316 - i * 14, s = seg(t, a, a + 0.3);
            if (t < a) return null;
            return (
              <g key={i} transform={`translate(0 ${-(1 - s) * 80})`} opacity={clamp((t - a) / 0.08)}>
                <path d={`M${x - 34} ${y}v10a34 11 0 0 0 68 0v-10z`} fill={url('gold')} /><ellipse cx={x} cy={y} rx={34} ry={11} fill={PALETTES.gold[0]} /><ellipse cx={x} cy={y} rx={24} ry={7} fill="none" stroke={PALETTES.gold[2]} strokeWidth={2} opacity={0.6} />
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
};

/** Isometric 3D bar graph; `value` shows as a counter above the tallest bar. */
export const Bars3d: Obj = ({t, value, label}) => {
  const hs = [70, 110, 90, 160, 205, 250];
  return (
    <g>
      <Shadow rx={190} />
      {hs.map((h, i) => <IsoBox key={i} ox={46 + i * 56} oy={322 - i * 4} w={38} d={38} h={h * seg(t, 0.1 + i * 0.13, 0.8 + i * 0.13)} pal={i === hs.length - 1 ? 'green' : 'blue'} />)}
      <path d={`M40 ${290 - 150 * seg(t, 0.2, 1.6)} L${40 + 300 * seg(t, 0.2, 1.6)} ${130 - 0 * t}`} stroke="none" fill="none" />
      {value !== undefined && <Txt x={300} y={50} size={42} fill="#ffe27a" stroke="#18213f">{label ? label : Math.round(value * seg(t, 0.4, 1.8)).toLocaleString('en-US')}</Txt>}
    </g>
  );
};

export const Vault: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), open = segIO(t, 0.9, 1.7);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow cy={346} rx={140} />
      <rect x={70} y={50} width={260} height={280} rx={26} fill={url('grey')} /><rect x={92} y={72} width={216} height={236} rx={16} fill={PALETTES.grey[2]} opacity={0.45} />
      <circle cx={200} cy={190} r={86} fill={url('navy')} /><circle cx={200} cy={190} r={68} fill={url('grey')} />
      <g transform={`rotate(${open * 200 + wave(t, 4) * 3} 200 190)`}>{[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x={196} y={118} width={8} height={36} rx={4} fill={url('gold')} transform={`rotate(${a} 200 190)`} />)}<circle cx={200} cy={190} r={20} fill={url('gold')} /></g>
      <rect x={314} y={150} width={16} height={80} rx={6} fill={PALETTES.grey[2]} />
    </g>
  );
};

export const Card: Obj = ({t, accent}) => {
  const ry = Math.cos(t * 1.6) * 0.42 + 0.58, sh = clamp(((t % 3) - 1) / 0.8);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, pop(t, 0, 0.5)) * (0.72 + ry * 0.28)} ${Math.max(0.01, pop(t, 0, 0.5))}) rotate(${-8 + wave(t, 3) * 3}) translate(-200 -190)`}>
      <Shadow cy={300} rx={140} o={0.7} />
      <rect x={52} y={104} width={296} height={188} rx={22} fill={url('accent')} /><rect x={52} y={104} width={296} height={188} rx={22} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={3} />
      <rect x={52} y={140} width={296} height={34} fill="#12141c" opacity={0.85} /><rect x={80} y={196} width={52} height={40} rx={8} fill={url('gold')} />
      {[0, 1, 2, 3].map(i => <rect key={i} x={80 + i * 62} y={256} width={46} height={10} rx={5} fill="#fff" opacity={0.85} />)}
      <circle cx={290} cy={238} r={22} fill={PALETTES.red[1]} opacity={0.9} /><circle cx={314} cy={238} r={22} fill={PALETTES.gold[1]} opacity={0.9} />
      {sh > 0 && sh < 1 && <polygon points={`${52 + sh * 300},104 ${96 + sh * 300},104 ${60 + sh * 300},292 ${16 + sh * 300},292`} fill="#fff" opacity={0.28} />}
    </g>
  );
};

export const Piggy: Obj = ({t, accent}) => {
  const s = pop(t, 0, 0.55), coin = seg(t, 0.5, 1.1), bob = wave(t, 1.2) * 2;
  return (
    <g transform={`translate(0 ${bob})`}>
      <Shadow rx={120} />
      <g transform={`translate(200 250) scale(${Math.max(0.01, s)}) translate(-200 -250)`}>
        <ellipse cx={200} cy={240} rx={116} ry={86} fill={url('accent')} /><ellipse cx={170} cy={205} rx={70} ry={34} fill="#fff" opacity={0.18} />
        <circle cx={318} cy={246} r={36} fill={accent} /><ellipse cx={330} cy={246} rx={22} ry={26} fill={PALETTES.red[0]} opacity={0.8} /><circle cx={324} cy={238} r={4} fill="#3a1d16" /><circle cx={324} cy={256} r={4} fill="#3a1d16" />
        <polygon points="250,166 276,120 296,176" fill={accent} /><circle cx={284} cy={208} r={7} fill="#3a1d16" />
        {[130, 250].map(x => <rect key={x} x={x - 18} y={300} width={36} height={32} rx={10} fill={accent} />)}
        <rect x={168} y={162} width={64} height={9} rx={4} fill="#3a1d16" />
      </g>
      <g transform={`translate(${200} ${60 + coin * 100})`} opacity={coin < 0.98 ? 1 : 0}><ellipse rx={24 * Math.abs(Math.cos(t * 6))} ry={24} fill={url('gold')} /></g>
    </g>
  );
};

export const Clock: Obj = ({t}) => {
  const s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow cy={346} rx={120} />
      <circle cx={200} cy={190} r={136} fill={url('grey')} /><circle cx={200} cy={190} r={116} fill="#fffaf0" />
      {Array.from({length: 12}, (_, i) => <rect key={i} x={197} y={86} width={6} height={i % 3 ? 12 : 22} rx={3} fill="#2b3a66" transform={`rotate(${i * 30} 200 190)`} />)}
      <rect x={196} y={118} width={8} height={78} rx={4} fill="#2b3a66" transform={`rotate(${t * 90} 200 190)`} /><rect x={198} y={92} width={5} height={104} rx={2.5} fill={PALETTES.red[1]} transform={`rotate(${t * 1080} 200 190)`} /><circle cx={200} cy={190} r={9} fill={PALETTES.gold[1]} />
    </g>
  );
};

export const Calendar: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), flip = seg(t, 0.7, 1.1), n = Math.min(30, Math.floor(1 + t * 9));
  return (
    <g transform={`translate(200 200) scale(${Math.max(0.01, s)}) translate(-200 -200)`}>
      <Shadow cy={346} rx={130} />
      <rect x={70} y={60} width={260} height={270} rx={22} fill="#fffdf6" /><path d="M70 82a22 22 0 0 1 22-22h216a22 22 0 0 1 22 22v50H70z" fill={url('red')} />
      {[110, 290].map(x => <rect key={x} x={x - 6} y={40} width={12} height={40} rx={6} fill={url('grey')} />)}
      {Array.from({length: 18}, (_, i) => { const c = i % 6, r = Math.floor(i / 6); return <rect key={i} x={92 + c * 38} y={152 + r * 54} width={28} height={36} rx={6} fill={i + 1 <= n % 19 ? PALETTES.blue[1] : '#e8ebf2'} opacity={i + 1 <= 18 ? 1 : 0} />; })}
      <g opacity={flip < 0.99 ? 1 : 0}><Txt x={200} y={118} size={44} fill="#fff">{['JAN', 'FEB', 'MAR', 'APR'][Math.floor(t * 3) % 4]}</Txt></g>
    </g>
  );
};

export const Scale: Obj = ({t}) => {
  const tilt = (wave(t, 2.4) * 8 + (seg(t, 0.3, 1.2) - 1) * 14), s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(200 200) scale(${Math.max(0.01, s)}) translate(-200 -200)`}>
      <Shadow rx={110} /><rect x={188} y={90} width={24} height={236} rx={8} fill={url('grey')} /><rect x={120} y={316} width={160} height={16} rx={8} fill={url('navy')} />
      <g transform={`rotate(${tilt} 200 100)`}>
        <rect x={50} y={92} width={300} height={14} rx={7} fill={url('gold')} />
        {[56, 344].map((x, i) => <g key={x}><path d={`M${x} 100 L${x - 36} 200M${x} 100 L${x + 36} 200`} stroke={PALETTES.grey[2]} strokeWidth={3} /><path d={`M${x - 52} 200h104a52 36 0 0 1-104 0z`} fill={url(i ? 'green' : 'red')} /></g>)}
      </g>
      <circle cx={200} cy={100} r={16} fill={url('gold')} />
    </g>
  );
};

const Arrow: (up: boolean) => Obj = up => ({t}) => {
  const k = seg(t, 0, 0.9), pal = up ? 'green' : 'red';
  const pts = up ? [[50, 290], [130, 230], [180, 262], [296, 130]] : [[50, 120], [130, 180], [180, 150], [296, 290]];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
  const e = pts[3], a = up ? -1 : 1;
  return (
    <g>
      <Shadow rx={150} />
      <path d={path} fill="none" stroke={PALETTES[pal][2]} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k} transform="translate(5 8)" opacity={0.5} />
      <path d={path} fill="none" stroke={url(pal)} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k} />
      <g opacity={k > 0.92 ? 1 : 0} transform={`translate(${e[0]} ${e[1]}) scale(${pop(t, 0.85, 0.4)}) rotate(${up ? -35 : 35})`}><polygon points={`0,${a * -42} 44,${a * 20} -44,${a * 20}`} fill={url(pal)} /></g>
    </g>
  );
};
export const ArrowUp = Arrow(true), ArrowDown = Arrow(false);

export const Percent: Obj = ({t}) => {
  const s = pop(t, 0, 0.55);
  return (
    <g transform={`translate(200 190) rotate(${wave(t, 4) * 6}) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow cy={346} rx={110} />
      <polygon points={Array.from({length: 24}, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 128 : 150; return `${200 + Math.cos(a) * r},${190 + Math.sin(a) * r}`; }).join(' ')} fill={url('accent')} />
      <circle cx={200} cy={190} r={118} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} strokeDasharray="4 12" />
      <Txt x={200} y={236} size={140} fill="#fff" stroke="#00000033">%</Txt>
    </g>
  );
};

export const Shield: Obj = ({t}) => {
  const s = pop(t, 0, 0.5), c = seg(t, 0.5, 1);
  return (
    <g transform={`translate(200 190) scale(${Math.max(0.01, s)}) translate(-200 -190)`}>
      <Shadow cy={346} rx={110} />
      <path d="M200 40 L330 86 V190 Q330 280 200 340 Q70 280 70 190 V86Z" fill={url('blue')} /><path d="M200 62 L310 100 V190 Q310 262 200 316 Z" fill="#fff" opacity={0.14} />
      <path d="M130 190 L180 240 L275 140" fill="none" stroke="#fff" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - c} />
    </g>
  );
};

export const Cash: Obj = ({t}) => (
  <g>
    <Shadow rx={160} />
    {[0, 1, 2, 3].map(i => { const s = seg(t, i * 0.14, 0.4 + i * 0.14); return (
      <g key={i} transform={`translate(${(i % 2 ? 14 : -10)} ${-(1 - s) * 90 - i * 30}) rotate(${(i % 2 ? 4 : -3)} 200 300)`} opacity={clamp(s * 3)}>
        <polygon points="70,310 330,310 300,262 100,262" fill={url('green')} /><polygon points="70,310 330,310 330,322 70,322" fill={PALETTES.green[2]} />
        <ellipse cx={200} cy={286} rx={46} ry={14} fill="#c8ffd9" opacity={0.7} /><Txt x={200} y={296} size={28} fill={PALETTES.green[2]}>$</Txt>
      </g>); })}
  </g>
);

export const Bank: Obj = ({t}) => {
  const s = pop(t, 0, 0.5);
  return (
    <g transform={`translate(200 330) scale(${Math.max(0.01, s)}) translate(-200 -330)`}>
      <Shadow rx={170} />
      <polygon points="40,150 200,60 360,150" fill={url('grey')} /><rect x={50} y={150} width={300} height={22} fill={PALETTES.grey[1]} />
      {[84, 142, 200, 258, 316].map((x, i) => <rect key={x} x={x - 14} y={172} width={28} height={140 * seg(t, 0.1 + i * 0.1, 0.6 + i * 0.1)} fill={url('wall', true)} />)}
      <rect x={40} y={312} width={320} height={22} rx={4} fill={url('grey')} /><circle cx={200} cy={122} r={16} fill={url('gold')} />
    </g>
  );
};

export const Magnifier: Obj = ({t}) => {
  const x = Math.sin(t * 1.4) * 44, y = Math.cos(t * 1.1) * 22;
  return (
    <g transform={`translate(${x} ${y}) scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 190px'}}>
      <Shadow rx={90} o={0.6} />
      <rect x={236} y={236} width={30} height={116} rx={14} fill={url('navy')} transform="rotate(-42 251 294)" /><circle cx={170} cy={160} r={96} fill={url('glass')} opacity={0.55} /><circle cx={170} cy={160} r={96} fill="none" stroke={url('gold')} strokeWidth={18} />
      <ellipse cx={140} cy={120} rx={32} ry={16} fill="#fff" opacity={0.5} transform="rotate(-30 140 120)" />
    </g>
  );
};

export const Doc: Obj = ({t}) => (
  <g transform={`translate(0 ${wave(t, 3) * 4})`}>
    <Shadow rx={110} />
    <g transform={`rotate(${-4 + (1 - pop(t, 0, 0.5)) * -30} 200 200) scale(${Math.max(0.01, pop(t, 0, 0.5))})`} style={{transformOrigin: '200px 200px'}}>
      <rect x={96} y={36} width={208} height={290} rx={12} fill="#fffdf6" /><polygon points="260,36 304,80 260,80" fill={PALETTES.grey[1]} />
      {Array.from({length: 7}, (_, i) => <rect key={i} x={124} y={106 + i * 28} width={i === 6 ? 90 : 152} height={10} rx={5} fill={PALETTES.grey[1]} opacity={seg(t, 0.3 + i * 0.1, 0.6 + i * 0.1)} />)}
      <circle cx={262} cy={282} r={22} fill={url('red')} opacity={seg(t, 1.1, 1.4)} />
    </g>
  </g>
);

export const OBJECTS: Record<string, Obj> = {skyline: Skyline, house: House, car: Car, coin_stacks: CoinStacks, bars3d: Bars3d, vault: Vault, card: Card, piggy: Piggy, clock: Clock, calendar: Calendar, scale: Scale, arrow_up: ArrowUp, arrow_down: ArrowDown, percent: Percent, shield: Shield, cash: Cash, bank: Bank, magnifier: Magnifier, doc: Doc};
export const FB_KINDS = Object.keys(OBJECTS);

/** Paper-illustration kinds (and a few words) -> full-bleed object. */
export const FB_FOR: Record<string, string> = {
  credit_card: 'card', coins: 'coin_stacks', jar: 'coin_stacks', house: 'house', car: 'car', bank: 'bank', piggy: 'piggy', calendar: 'calendar', clock: 'clock', hourglass: 'clock', percent: 'percent', shield: 'shield', check: 'shield', magnifier: 'magnifier',
  receipt: 'doc', document: 'doc', arrow_up: 'arrow_up', arrow_down: 'arrow_down', scale: 'scale', people: 'skyline', phone: 'card', chart_up: 'bars3d', chart_down: 'arrow_down', bulb: 'percent', wallet: 'cash', cash: 'cash', lock: 'vault', question: 'magnifier', warning: 'arrow_down', target: 'percent',
};
