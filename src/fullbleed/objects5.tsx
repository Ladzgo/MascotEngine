import React from 'react';
import {PALETTES, Shadow, Txt, pop, seg, wave} from './kit';
import type {Obj} from './objects';

// Theme packs: sport, health, travel, tech, food, science. Same 400x400 box, same lighting kit as the money objects; used when the
// narration is not about money (the footage layer is primary, these are the drawn fallback and the overlay layer).
const url = (k: string) => `url(#fb-${k})`;
const Stage: React.FC<{t: number; children: React.ReactNode; rx?: number}> = ({t, children, rx = 110}) => (
  <g transform={`translate(0 ${wave(t, 3) * 5})`}><Shadow rx={rx} /><g style={{transformOrigin: '200px 330px'}} transform={`translate(200 330) scale(${Math.max(0.01, pop(t, 0, 0.55))}) translate(-200 -330)`}>{children}</g></g>
);

export const Shoe: Obj = ({t}) => (
  <Stage t={t}><g transform={`rotate(${-6 + wave(t, 2.4) * 3} 200 300)`}>
    <path d="M70 250 Q70 150 120 140 L170 160 Q200 190 250 200 Q330 205 345 255 L345 290 H70Z" fill={url('red')} />
    <path d="M120 140 Q130 120 160 126 L170 160Z" fill={url('grey')} /><rect x={62} y={286} width={296} height={36} rx={16} fill="#fff" />
    {[0, 1, 2].map(i => <rect key={i} x={158 + i * 26} y={168 + i * 12} width={30} height={8} rx={4} fill="#fff" opacity={seg(t, 0.3 + i * 0.15, 0.6 + i * 0.15)} transform={`rotate(25 ${173 + i * 26} ${172 + i * 12})`} />)}
  </g></Stage>
);
export const Dumbbell: Obj = ({t}) => (
  <Stage t={t}><g transform={`translate(0 ${-Math.abs(wave(t, 1.6)) * 30}) rotate(${wave(t, 3.2) * 4} 200 220)`}>
    <rect x={110} y={212} width={180} height={20} rx={8} fill={url('grey')} />
    {[[70, 70], [100, 60], [300, 60], [330, 70]].map(([x, h], i) => <rect key={i} x={x - 14} y={222 - h / 2} width={28} height={h} rx={9} fill={url(i % 3 === 0 ? 'navy' : 'blue')} />)}
  </g></Stage>
);
export const Stopwatch: Obj = ({t}) => (
  <Stage t={t}>
    <rect x={182} y={40} width={36} height={26} rx={6} fill={url('grey')} /><circle cx={200} cy={190} r={128} fill={url('grey')} /><circle cx={200} cy={190} r={104} fill="#fffdf6" />
    {Array.from({length: 12}, (_, i) => <rect key={i} x={197} y={92} width={6} height={i % 3 === 0 ? 20 : 10} fill="#2b3a66" transform={`rotate(${i * 30} 200 190)`} />)}
    <path d="M200 190 L200 112" stroke={PALETTES.red[1]} strokeWidth={7} strokeLinecap="round" transform={`rotate(${(t * 90) % 360} 200 190)`} /><circle cx={200} cy={190} r={10} fill="#2b3a66" />
  </Stage>
);
export const Heart: Obj = ({t}) => {
  const b = 1 + Math.max(0, Math.sin(t * 5.5)) * 0.08;
  return <Stage t={t} rx={100}><g transform={`translate(200 200) scale(${b}) translate(-200 -200)`}>
    <path d="M200 310 C90 230 60 160 100 110 C140 70 190 90 200 130 C210 90 260 70 300 110 C340 160 310 230 200 310Z" fill={url('red')} /><ellipse cx={140} cy={130} rx={22} ry={12} fill="#fff" opacity={0.4} transform="rotate(-35 140 130)" />
    <polyline points="90,200 150,200 175,150 210,250 235,200 310,200" fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="420" strokeDashoffset={420 - 420 * seg(t, 0.4, 1.4)} />
  </g></Stage>;
};
export const Apple: Obj = ({t}) => (
  <Stage t={t} rx={100}>
    <path d="M200 120 C130 70 60 120 80 210 C95 280 150 330 200 310 C250 330 305 280 320 210 C340 120 270 70 200 120Z" fill={url('red')} />
    <path d="M200 120 Q200 80 215 55" stroke="#5a3a1a" strokeWidth={10} fill="none" strokeLinecap="round" /><path d="M215 80 Q260 40 290 70 Q250 105 215 80Z" fill={url('green')} transform={`rotate(${wave(t, 3) * 4} 215 80)`} />
    <ellipse cx={135} cy={160} rx={18} ry={32} fill="#fff" opacity={0.3} transform="rotate(20 135 160)" />
  </Stage>
);
export const Pill: Obj = ({t}) => (
  <Stage t={t}><g transform={`rotate(${-35 + wave(t, 3) * 6} 200 200)`}>
    <rect x={80} y={140} width={240} height={110} rx={55} fill="#fffdf6" /><path d="M200 140 H135 A55 55 0 0 0 135 250 H200Z" fill={url('red')} /><rect x={100} y={156} width={190} height={18} rx={9} fill="#fff" opacity={0.35} />
  </g></Stage>
);
export const Drop: Obj = ({t}) => (
  <Stage t={t} rx={90}><g transform={`translate(0 ${wave(t, 2) * 6})`}>
    <path d="M200 40 C200 40 90 170 90 235 A110 110 0 0 0 310 235 C310 170 200 40 200 40Z" fill={url('blue')} /><ellipse cx={150} cy={225} rx={14} ry={34} fill="#fff" opacity={0.45} transform="rotate(15 150 225)" />
    <ellipse cx={200} cy={338} rx={50 + seg(t, 0.8, 1.6) * 50} ry={8} fill="none" stroke="#8cc8ff" strokeWidth={4} opacity={1 - seg(t, 0.8, 1.8)} />
  </g></Stage>
);
export const Plane: Obj = ({t}) => (
  <Stage t={t}><g transform={`translate(${-90 + seg(t, 0, 2.2) * 90} ${40 - seg(t, 0, 2.2) * 40}) rotate(-12 200 200)`}>
    <path d="M60 200 Q60 170 120 170 H300 Q360 175 365 200 Q360 225 300 230 H120 Q60 230 60 200Z" fill="#fffdf6" /><path d="M170 190 L120 80 H165 L260 190Z" fill={url('blue')} /><path d="M170 215 L120 320 H165 L260 215Z" fill={url('blue')} />
    <path d="M70 180 L40 120 H80 L110 175Z" fill={url('red')} />{[0, 1, 2, 3, 4].map(i => <rect key={i} x={250 + i * 18} y={186} width={10} height={12} rx={4} fill="#3d8bdc" />)}
  </g></Stage>
);
export const Globe: Obj = ({t}) => {
  const r = 120, ph = (t * 0.6) % 1;
  return <Stage t={t}>
    <circle cx={200} cy={190} r={r} fill={url('blue')} />
    <clipPath id="gl"><circle cx={200} cy={190} r={r} /></clipPath>
    <g clipPath="url(#gl)" fill="none" stroke="#d6ecff" strokeWidth={4} opacity={0.7}>
      {[0, 1, 2].map(i => <ellipse key={i} cx={200} cy={190} rx={Math.abs(Math.cos(((ph + i / 3) % 1) * Math.PI)) * r} ry={r} />)}
      {[-60, 0, 60].map(y => <line key={y} x1={80} x2={320} y1={190 + y} y2={190 + y} />)}
      <path d="M150 120 q30 -30 60 0 q-10 40 -50 50 q-20 -20 -10 -50Z M230 200 q40 -10 50 30 q-30 30 -60 0Z" fill={PALETTES.green[1]} stroke="none" opacity={0.9} />
    </g>
    <ellipse cx={160} cy={120} rx={30} ry={18} fill="#fff" opacity={0.25} transform="rotate(-30 160 120)" />
  </Stage>;
};
export const Suitcase: Obj = ({t}) => (
  <Stage t={t}><g transform={`rotate(${wave(t, 2.6) * 2.5} 200 320)`}>
    <path d="M160 100 V70 Q160 56 174 56 H226 Q240 56 240 70 V100" fill="none" stroke={url('navy')} strokeWidth={14} />
    <rect x={70} y={96} width={260} height={220} rx={26} fill={url('red')} /><rect x={110} y={96} width={22} height={220} fill="#000" opacity={0.12} /><rect x={268} y={96} width={22} height={220} fill="#000" opacity={0.12} />
    <rect x={180} y={186} width={40} height={30} rx={6} fill={url('gold')} /><rect x={86} y={110} width={228} height={16} rx={8} fill="#fff" opacity={0.25} />
  </g></Stage>
);
export const Mountain: Obj = ({t}) => (
  <Stage t={t} rx={140}>
    <polygon points="40,326 170,80 300,326" fill={url('grey')} /><polygon points="170,80 215,168 190,150 170,185 150,150 125,170" fill="#fff" /><polygon points="200,326 290,150 370,326" fill={url('navy')} />
    <g opacity={seg(t, 0.8, 1.2)}><line x1={170} y1={80} x2={170} y2={36} stroke="#5a3a1a" strokeWidth={5} /><path d={`M170 36 L${208 + wave(t, 1) * 4} 48 L170 62Z`} fill={PALETTES.red[1]} /></g>
  </Stage>
);
export const Laptop: Obj = ({t}) => (
  <Stage t={t} rx={140}>
    <rect x={80} y={70} width={240} height={170} rx={14} fill={url('navy')} /><rect x={94} y={84} width={212} height={142} rx={6} fill="#10182f" />
    {Array.from({length: 6}, (_, i) => <rect key={i} x={108 + (i % 2) * 18} y={98 + i * 20} width={(60 + ((i * 47) % 90)) * seg(t, 0.3 + i * 0.2, 0.7 + i * 0.2)} height={9} rx={4} fill={i % 3 === 0 ? '#6ee09a' : i % 3 === 1 ? '#8cc8ff' : '#ffe27a'} />)}
    <path d="M50 250 H350 L330 280 Q328 288 318 288 H82 Q72 288 70 280Z" fill={url('grey')} />
  </Stage>
);
export const Chip: Obj = ({t}) => (
  <Stage t={t}>
    {Array.from({length: 6}, (_, i) => <g key={i} fill={PALETTES.gold[1]}><rect x={130 + i * 28} y={62} width={12} height={34} /><rect x={130 + i * 28} y={284} width={12} height={34} /><rect x={78} y={110 + i * 28} width={34} height={12} /><rect x={288} y={110 + i * 28} width={34} height={12} /></g>)}
    <rect x={100} y={96} width={200} height={200} rx={20} fill={url('navy')} /><rect x={140} y={136} width={120} height={120} rx={12} fill={url('blue')} opacity={0.6 + Math.max(0, wave(t, 1.2)) * 0.4} />
    <Txt x={200} y={214} size={44} fill="#fff">AI</Txt>
  </Stage>
);
export const Flask: Obj = ({t}) => (
  <Stage t={t}>
    <path d="M170 50 H230 V140 L320 290 Q335 322 300 322 H100 Q65 322 80 290 L170 140Z" fill="#eaf7ff" opacity={0.85} />
    <path d="M130 235 H270 L320 290 Q335 322 300 322 H100 Q65 322 80 290Z" fill={url('green')} />
    {[0, 1, 2, 3].map(i => { const k = (t * 0.7 + i * 0.27) % 1; return <circle key={i} cx={150 + i * 32 + wave(t, 1.3, i) * 6} cy={290 - k * 150} r={7 + i % 2 * 4} fill="#c8ffd9" opacity={1 - k} />; })}
    <rect x={160} y={44} width={80} height={14} rx={7} fill={url('grey')} />
  </Stage>
);
export const Atom: Obj = ({t}) => (
  <Stage t={t} rx={100}><g>
    {[0, 60, 120].map((a, i) => <ellipse key={a} cx={200} cy={190} rx={130} ry={46} fill="none" stroke={url('blue')} strokeWidth={6} transform={`rotate(${a} 200 190)`} />)}
    {[0, 60, 120].map((a, i) => { const p = t * 2 + i * 2.1; return <circle key={a} cx={200 + Math.cos(p) * 130} cy={190 + Math.sin(p) * 46} r={12} fill={url('gold')} transform={`rotate(${a} 200 190)`} />; })}
    <circle cx={200} cy={190} r={26} fill={url('red')} />
  </g></Stage>
);
export const Sprout: Obj = ({t}) => {
  const k = seg(t, 0.2, 1.8);
  return <Stage t={t} rx={100}>
    <path d="M110 322 Q120 270 200 270 Q280 270 290 322Z" fill={url('wall')} />
    <path d={`M200 272 Q200 ${272 - 120 * k} ${200 + 4 * wave(t, 2)} ${272 - 170 * k}`} stroke={PALETTES.green[2]} strokeWidth={10} fill="none" strokeLinecap="round" />
    <g opacity={seg(t, 0.9, 1.4)}><path d="M200 140 Q120 90 100 150 Q150 190 200 140Z" fill={url('green')} /><path d="M205 120 Q280 60 305 120 Q255 165 205 120Z" fill={url('green')} /></g>
  </Stage>;
};
export const Sun: Obj = ({t}) => (
  <Stage t={t} rx={80}><g>
    <g transform={`rotate(${t * 20} 200 190)`}>{Array.from({length: 12}, (_, i) => <rect key={i} x={193} y={26} width={14} height={i % 2 ? 36 : 54} rx={7} fill={url('gold')} transform={`rotate(${i * 30} 200 190)`} />)}</g>
    <circle cx={200} cy={190} r={86} fill={url('gold')} /><ellipse cx={170} cy={158} rx={26} ry={14} fill="#fff" opacity={0.35} transform="rotate(-30 170 158)" />
  </g></Stage>
);
export const Burger: Obj = ({t}) => (
  <Stage t={t}><g transform={`translate(0 ${-Math.abs(wave(t, 2)) * 8})`}>
    <path d="M90 170 Q90 70 200 70 Q310 70 310 170Z" fill={url('gold')} />{[130, 170, 210, 250].map((x, i) => <ellipse key={x} cx={x + 6} cy={110 + (i % 2) * 16} rx={7} ry={4} fill="#fff3b0" />)}
    <path d="M84 176 Q110 200 140 176 Q170 200 200 176 Q230 200 260 176 Q290 200 316 176 V190 H84Z" fill={url('green')} />
    <rect x={88} y={190} width={224} height={38} rx={19} fill="#5a3a1a" /><path d="M96 232 H304 L290 250 H110Z" fill={url('gold')} />
    <path d="M90 258 H310 Q310 322 200 322 Q90 322 90 258Z" fill={url('roof')} />
  </g></Stage>
);
export const Book: Obj = ({t}) => {
  const flip = (t * 0.5) % 1;
  return <Stage t={t} rx={140}>
    <path d="M200 120 Q130 90 60 110 V290 Q130 270 200 300Z" fill="#fffdf6" /><path d="M200 120 Q270 90 340 110 V290 Q270 270 200 300Z" fill="#f4ecd8" />
    {[0, 1, 2, 3].map(i => <rect key={i} x={84} y={140 + i * 28} width={90} height={7} rx={3} fill={PALETTES.grey[1]} />)}
    <path d={`M200 120 Q${200 + 70 * (1 - flip)} ${96 - 20 * flip} ${200 + 140 * (1 - 2 * flip)} 112 V290 Q${200 + 70 * (1 - flip)} 276 200 300Z`} fill="#fff" opacity={0.9} />
    <path d="M200 120 V300" stroke={PALETTES.red[2]} strokeWidth={8} />
  </Stage>;
};
export const Medal: Obj = ({t}) => (
  <Stage t={t} rx={90}><g transform={`rotate(${wave(t, 2.4) * 4} 200 40)`}>
    <path d="M130 30 L180 150 H220 L270 30 H235 L200 110 L165 30Z" fill={url('red')} /><circle cx={200} cy={220} r={96} fill={url('gold')} /><circle cx={200} cy={220} r={72} fill="none" stroke="#fff3b0" strokeWidth={6} />
    <Txt x={200} y={244} size={72} fill="#b8820a">1</Txt>
  </g></Stage>
);

// battery, brain, bed, moon: the tech and sleep/memory topics (after-tech showed an anchor for "drains your battery", en-sleep a piggy bank for "slow-wave sleep")
export const Battery: Obj = ({t}) => {
  const lvl = 0.95 - 0.7 * seg(t, 0.3, 2.6), col = lvl > 0.55 ? 'green' : lvl > 0.35 ? 'gold' : 'red';
  return <Stage t={t} rx={90}>
    <rect x={170} y={40} width={60} height={26} rx={8} fill={url('grey')} /><rect x={120} y={60} width={160} height={262} rx={26} fill={url('navy')} /><rect x={134} y={74} width={132} height={234} rx={16} fill="#10182f" />
    <rect x={142} y={82 + 218 * (1 - lvl)} width={116} height={218 * lvl} rx={10} fill={url(col)} />
    <path d="M214 120 L170 200 H202 L186 270 L234 182 H202Z" fill="#fff" opacity={0.85} />
    <rect x={136} y={80} width={18} height={200} rx={9} fill="#fff" opacity={0.12} />
  </Stage>;
};
export const Brain: Obj = ({t}) => {
  const g = 0.5 + Math.max(0, wave(t, 1.6)) * 0.5;
  return <Stage t={t} rx={110}><g transform={`translate(0 ${wave(t, 2.6) * 4})`}>
    <path d="M200 90 C150 60 90 80 86 140 C50 160 56 230 100 246 C104 290 160 310 200 286 C240 310 296 290 300 246 C344 230 350 160 314 140 C310 80 250 60 200 90Z" fill={url('roof')} />
    <path d="M200 92 V284 M140 120 Q170 150 140 180 Q110 210 150 240 M260 120 Q230 150 260 180 Q290 210 250 240 M110 170 Q130 180 128 200 M290 170 Q270 180 272 200" stroke={PALETTES.roof[2]} strokeWidth={7} fill="none" strokeLinecap="round" />
    {[[140, 150], [255, 140], [170, 230], [240, 225], [200, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="#fff3b0" opacity={g * seg(t, 0.3 + i * 0.2, 0.6 + i * 0.2)} />)}
    <ellipse cx={140} cy={110} rx={26} ry={12} fill="#fff" opacity={0.3} transform="rotate(-25 140 110)" />
  </g></Stage>;
};
export const Bed: Obj = ({t}) => (
  <Stage t={t} rx={160}>
    <rect x={50} y={150} width={24} height={170} rx={8} fill={url('wall')} /><rect x={326} y={210} width={24} height={110} rx={8} fill={url('wall')} />
    <rect x={60} y={232} width={284} height={56} rx={16} fill={url('grey')} /><path d="M150 214 Q240 196 340 214 V246 H150Z" fill={url('blue')} />
    <ellipse cx={108} cy={222} rx={44} ry={20} fill="#fff" />
    {[0, 1, 2].map(i => { const k = (t * 0.45 + i / 3) % 1; return <g key={i} opacity={0.9 * (1 - k)}><Txt x={150 + k * 120 + i * 8} y={180 - k * 130} size={30 + k * 26} fill="#fff">z</Txt></g>; })}
  </Stage>
);
export const Moon: Obj = ({t}) => (
  <Stage t={t} rx={80}><g>
    {Array.from({length: 7}, (_, i) => <circle key={i} cx={60 + ((i * 71) % 290)} cy={50 + ((i * 53) % 150)} r={4 + (i % 3) * 2} fill="#fff3b0" opacity={0.4 + 0.6 * Math.abs(wave(t, 1.5 + i * 0.3))} />)}
    <g transform={`rotate(${wave(t, 4) * 5} 200 190)`}><path d="M240 80 A110 110 0 1 0 300 260 A90 90 0 1 1 240 80Z" fill={url('gold')} /><circle cx={170} cy={230} r={12} fill={PALETTES.gold[2]} opacity={0.35} /><circle cx={150} cy={170} r={8} fill={PALETTES.gold[2]} opacity={0.3} /></g>
  </g></Stage>
);
/** Earth with the Moon circling it on a dashed orbit; the Moon's dark crater always faces Earth (tidal lock). sc-moon2 showed a burger for "as it orbits". */
export const Orbit: Obj = ({t}) => {
  const a = t * 0.9 - Math.PI / 2, mx = 200 + Math.cos(a) * 150, my = 190 + Math.sin(a) * 70, front = Math.sin(a) > 0;
  const moon = <g transform={`translate(${mx} ${my}) rotate(${(a * 180) / Math.PI})`}><circle r={30} fill={url('grey')} /><circle cx={-12} cy={0} r={8} fill={PALETTES.grey[2]} opacity={0.6} /><circle cx={8} cy={-12} r={5} fill={PALETTES.grey[2]} opacity={0.4} /></g>;
  return <Stage t={t} rx={120}>
    {Array.from({length: 9}, (_, i) => <circle key={i} cx={30 + ((i * 83) % 340)} cy={30 + ((i * 47) % 120)} r={2 + (i % 3)} fill="#fff" opacity={0.3 + 0.5 * Math.abs(wave(t, 1.7 + i * 0.3))} />)}
    <ellipse cx={200} cy={190} rx={150} ry={70} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={4} strokeDasharray="10 12" />
    {!front && moon}
    <circle cx={200} cy={190} r={72} fill={url('blue')} />
    <path d="M160 150 q24 -24 48 0 q-8 32 -40 40 q-16 -16 -8 -40Z M214 200 q32 -8 40 24 q-24 24 -48 0Z" fill={PALETTES.green[1]} transform={`translate(${((t * 12) % 30) - 15} 0)`} opacity={0.9} />
    <ellipse cx={176} cy={160} rx={26} ry={12} fill="#fff" opacity={0.25} transform="rotate(-25 176 160)" />
    {front && moon}
  </Stage>;
};

/** key -> renderer; the catalog's SUBJECTS lists the same names (a test keeps both in sync). */
export const THEME_SUBJECTS: Record<string, Obj> = {shoe: Shoe, dumbbell: Dumbbell, stopwatch: Stopwatch, heart: Heart, apple: Apple, pill: Pill, drop: Drop, plane: Plane, globe: Globe, suitcase: Suitcase, mountain: Mountain, laptop: Laptop, chip: Chip, flask: Flask, atom: Atom, sprout: Sprout, sun: Sun, burger: Burger, book: Book, medal: Medal, battery: Battery, brain: Brain, bed: Bed, moon: Moon, orbit: Orbit};
