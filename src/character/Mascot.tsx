import React, {useId} from 'react';
import {Img, staticFile} from 'remotion';
import {INK, backOut} from '../theme';
import {BOIL_STYLE} from '../fx/boil';

export type CharacterAssets = Record<string, {file: string; talk?: string; blink?: string}>;

/*
 * Penny: a coin in a tie, deadpan accountant. Geometry is in the 1200x1500 viewBox of
 * design/mascot/concept-penny-full.svg. Only the tie takes the episode accent.
 * assets/character/<pose>.png (real art) always wins over this code mascot.
 */

const BODY = '#f6f1e4';
const WHITE = '#fffdf6';
const LINE = 8; // concept uses 6; slightly heavier so 150px renders stay legible
const MOUTH_DARK = '#3a1f24';
const GOLD = '#e8c25a';
const WATER = '#9fd6f5';
const RED = '#d9363e';
const EYE_Y = 558, EYE_RX = 72, EYE_RY = 78;
const EYE_X: [number, number] = [435, 765];

type Eye = {lo: number; li: number; p: [number, number, number]; arc?: boolean}; // lid y outer/inner, pupil dx,dy,r
type Brow = [number, number, number]; // y outer, y inner, bend (negative = arched up)
type FaceSpec = {eyes: [Eye, Eye]; brows: [Brow, Brow]; mouth: string; fill?: boolean};
type Face = 'neutral' | 'explain' | 'happy' | 'excited' | 'worried' | 'angry' | 'shocked' | 'smug' | 'thinking' | 'sad' | 'confused' | 'tired';

const both = (e: Eye): [Eye, Eye] => [e, e];
const FACES: Record<Face, FaceSpec> = {
  // dry default: half-lidded, flat left brow, raised right brow, flat mouth with a tick
  neutral: {eyes: both({lo: 558, li: 558, p: [10, 39, 30]}), brows: [[439, 435, 0], [419, 423, -24]], mouth: 'M535 765 L650 765 L668 773'},
  explain: {eyes: both({lo: 548, li: 548, p: [6, 36, 31]}), brows: [[430, 426, -6], [406, 408, -26]], mouth: 'M538 768 Q600 774 664 756'},
  happy: {eyes: both({lo: 0, li: 0, p: [0, 0, 0], arc: true}), brows: [[430, 424, -14], [420, 418, -20]], mouth: 'M540 762 Q600 800 668 746'},
  excited: {eyes: both({lo: 505, li: 505, p: [0, 8, 34]}), brows: [[405, 395, -16], [385, 380, -22]], mouth: 'M530 752 Q600 850 670 752 Z', fill: true},
  worried: {eyes: both({lo: 525, li: 495, p: [0, 20, 28]}), brows: [[455, 405, -4], [405, 455, -4]], mouth: 'M545 778 q18 -22 36 0 t36 0 t36 0'},
  angry: {eyes: both({lo: 530, li: 578, p: [0, 48, 28]}), brows: [[415, 485, 0], [485, 415, 0]], mouth: 'M540 792 Q600 742 662 792'},
  shocked: {eyes: both({lo: 440, li: 440, p: [0, 0, 12]}), brows: [[395, 385, -20], [385, 395, -20]], mouth: 'M570 790 a30 46 0 1 0 60 0 a30 46 0 1 0 -60 0', fill: true},
  smug: {eyes: both({lo: 582, li: 578, p: [12, 44, 26]}), brows: [[448, 452, 0], [395, 390, -30]], mouth: 'M535 775 Q590 790 668 740'},
  thinking: {eyes: both({lo: 535, li: 535, p: [28, 10, 26]}), brows: [[440, 430, 0], [405, 420, -22]], mouth: 'M575 770 L640 764'},
  sad: {eyes: both({lo: 560, li: 520, p: [0, 50, 26]}), brows: [[460, 420, 0], [420, 460, -6]], mouth: 'M540 797 Q600 742 660 797'},
  confused: {eyes: [{lo: 545, li: 545, p: [-12, 25, 28]}, {lo: 575, li: 575, p: [-10, 50, 26]}], brows: [[455, 415, -10], [450, 440, 0]], mouth: 'M540 782 q25 -25 50 0 t50 0 t30 -10'},
  tired: {eyes: both({lo: 585, li: 575, p: [0, 52, 24]}), brows: [[450, 425, 0], [425, 450, 0]], mouth: 'M550 787 Q600 772 650 790'},
};

type Hand = 'mitt' | 'fist' | 'thumb' | 'point' | 'palm';
type Arm = {h: [number, number]; c?: [number, number]; front?: boolean; hand?: Hand};
type PoseSpec = {face: Face; L: Arm | 'hang'; R: Arm | 'hang'; gaze?: [number, number]};

export const POSES: Record<string, PoseSpec> = {
  neutral: {face: 'neutral', L: 'hang', R: 'hang'},
  explain_left: {face: 'explain', L: {h: [70, 560], c: [60, 790]}, R: 'hang'},
  explain_right: {face: 'explain', L: 'hang', R: {h: [1130, 560], c: [1140, 790]}},
  pointing_up: {face: 'explain', L: 'hang', R: {h: [1045, 250], c: [1150, 560], hand: 'point'}},
  thinking: {face: 'thinking', L: 'hang', R: {h: [690, 850], c: [940, 960], front: true}},
  happy: {face: 'happy', L: {h: [85, 610], c: [60, 800]}, R: {h: [1115, 610], c: [1140, 800]}},
  excited: {face: 'excited', L: {h: [190, 150], c: [50, 470]}, R: {h: [1010, 150], c: [1150, 470]}},
  thumbs_up: {face: 'smug', L: 'hang', R: {h: [1090, 650], c: [1150, 830], hand: 'thumb'}},
  smug: {face: 'smug', L: {h: [735, 1010], c: [300, 1030], front: true}, R: {h: [465, 1030], c: [900, 1040], front: true}},
  worried: {face: 'worried', L: {h: [568, 1020], c: [290, 1040], front: true}, R: {h: [632, 1020], c: [910, 1040], front: true}},
  shocked: {face: 'shocked', L: {h: [50, 430], c: [50, 740]}, R: {h: [1150, 430], c: [1150, 740]}},
  sweating: {face: 'worried', L: 'hang', R: {h: [770, 345], c: [1100, 600], front: true}},
  sad: {face: 'sad', L: {h: [185, 1010], c: [130, 880]}, R: {h: [1015, 1010], c: [1070, 880]}},
  angry: {face: 'angry', L: {h: [205, 1010], c: [110, 880], hand: 'fist'}, R: {h: [995, 1010], c: [1090, 880], hand: 'fist'}},
  confused: {face: 'confused', L: 'hang', R: {h: [830, 285], c: [1130, 520], front: true}},
  facepalm: {face: 'tired', L: 'hang', R: {h: [770, 540], c: [1060, 640], front: true, hand: 'palm'}},
  counting_money: {face: 'smug', gaze: [0, 44], L: {h: [440, 985], c: [290, 1010], front: true}, R: {h: [770, 985], c: [920, 1010], front: true}},
  holding_sign: {face: 'neutral', L: {h: [348, 1040], c: [255, 1010], front: true}, R: {h: [852, 1040], c: [945, 1010], front: true}},
  reading: {face: 'neutral', gaze: [0, 46], L: {h: [420, 1150], c: [270, 1110], front: true}, R: {h: [780, 1150], c: [930, 1110], front: true}},
  writing: {face: 'thinking', gaze: [0, 44], L: {h: [410, 1120], c: [260, 1080], front: true}, R: {h: [742, 1005], c: [920, 1000], front: true}},
};
export const POSE_NAMES = Object.keys(POSES);

const LEGS = [
  'M485,1040 L485,1400 Q485,1470 415,1470 L370,1470 Q335,1470 340,1440 Q350,1410 400,1400 L410,1040 Z',
  'M715,1040 L715,1400 Q715,1470 785,1470 L830,1470 Q865,1470 860,1440 Q850,1410 800,1400 L790,1040 Z',
];
const ARM_HANG = {
  L: 'M205,720 Q110,820 140,950 Q145,985 175,975 Q200,965 195,930 Q190,860 255,800',
  R: 'M995,720 Q1090,820 1060,950 Q1055,985 1025,975 Q1000,965 1005,930 Q1010,860 945,800',
};
const TIE = 'M600 845 L650 890 L622 925 L642 1062 L600 1088 L558 1062 L578 925 L550 890 Z';
const SHOULDER = {back: {L: [225, 745], R: [975, 745]}, front: {L: [270, 800], R: [930, 800]}};
const AW = 48, MR = 36;

const ink = {stroke: INK, strokeWidth: LINE, strokeLinejoin: 'round', strokeLinecap: 'round'} as const;

const limbShapes = (side: 'L' | 'R', arm: Arm, isInk: boolean) => {
  const g = isInk ? LINE : 0;
  const col = isInk ? INK : BODY;
  const [hx, hy] = arm.h;
  const [sx, sy] = SHOULDER[arm.front ? 'front' : 'back'][side];
  const [cx, cy] = arm.c ?? [(sx + hx) / 2, (sy + hy) / 2];
  const hand = arm.hand ?? 'mitt';
  const r = hand === 'palm' ? 70 : hand === 'fist' || hand === 'thumb' ? MR + 4 : MR;
  return (
    <g>
      <path d={arm.front ? `M${sx} ${sy} L${cx} ${cy} L${hx} ${hy}` : `M${sx} ${sy} Q${cx} ${cy} ${hx} ${hy}`} fill="none" stroke={col} strokeWidth={AW + 2 * g} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hx} cy={hy} r={r + g} fill={col} />
      {hand === 'thumb' && <path d={`M${hx - 4} ${hy - 20} L${hx - 4} ${hy - 84}`} stroke={col} strokeWidth={30 + 2 * g} strokeLinecap="round" />}
      {hand === 'point' && <path d={`M${hx} ${hy - 20} L${hx} ${hy - 110}`} stroke={col} strokeWidth={28 + 2 * g} strokeLinecap="round" />}
    </g>
  );
};

const Limb: React.FC<{side: 'L' | 'R'; arm: Arm}> = ({side, arm}) => {
  const [sx, sy] = SHOULDER[arm.front ? 'front' : 'back'][side];
  return (
    <g>
      {limbShapes(side, arm, true)}
      {limbShapes(side, arm, false)}
      {/* hides the shoulder seam so a front arm grows out of the torso */}
      {arm.front && <circle cx={sx} cy={sy} r={AW / 2 + LINE + 2} fill={BODY} />}
    </g>
  );
};

const EyeView: React.FC<{id: string; cx: number; side: 'L' | 'R'; e: Eye; blink: boolean; gaze?: [number, number]; look?: [number, number]}> = ({id, cx, side, e, blink, gaze, look = [0, 0]}) => {
  if (e.arc) return <path d={`M${cx - 62} 582 Q${cx} 506 ${cx + 62} 582`} fill="none" {...ink} />;
  if (blink) return <path d={`M${cx - 68} 592 Q${cx} 608 ${cx + 68} 592`} fill="none" {...ink} />;
  const yl = side === 'L' ? e.lo : e.li, yr = side === 'L' ? e.li : e.lo;
  const k = (yr - yl) / (2 * EYE_RX);
  const y0 = yl - k * 18, y1 = yr + k * 18;
  const [dx, dy, r] = e.p;
  const px = cx + (gaze ? gaze[0] : dx) + look[0], py = EYE_Y + (gaze ? gaze[1] : dy) + look[1];
  return (
    <g>
      <clipPath id={`${id}-lid${side}`}><polygon points={`${cx - 90},${y0} ${cx + 90},${y1} ${cx + 90},900 ${cx - 90},900`} /></clipPath>
      <clipPath id={`${id}-eye${side}`}><ellipse cx={cx} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} /></clipPath>
      <g clipPath={`url(#${id}-lid${side})`}>
        <ellipse cx={cx} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={WHITE} {...ink} />
        <g clipPath={`url(#${id}-eye${side})`}><circle cx={px} cy={py} r={r} fill={INK} /></g>
      </g>
      <g clipPath={`url(#${id}-eye${side})`}><path d={`M${cx - 90} ${y0} L${cx + 90} ${y1}`} {...ink} /></g>
    </g>
  );
};

const BrowView: React.FC<{b: Brow; side: 'L' | 'R'}> = ({b, side}) => {
  const [yo, yi, bend] = b;
  const [x1, x2] = side === 'L' ? [355, 507] : [693, 844];
  const [y1, y2] = side === 'L' ? [yo, yi] : [yi, yo];
  return <path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + bend} ${x2} ${y2}`} fill="none" {...ink} />;
};

const Coin: React.FC<{x: number; y: number; r: number}> = ({x, y, r}) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={GOLD} {...ink} />
    <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeDasharray="1 11" />
  </g>
);
const Burst: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g fill="none" {...ink}>
    {[-135, -90, -45].map(a => {
      const t = (a * Math.PI) / 180;
      return <path key={a} d={`M${x + Math.cos(t) * 75} ${y + Math.sin(t) * 75} L${x + Math.cos(t) * 112} ${y + Math.sin(t) * 112}`} />;
    })}
  </g>
);
const Lines: React.FC<{d: string}> = ({d}) => <path d={d} fill="none" stroke={INK} strokeWidth={LINE} strokeLinecap="round" opacity={0.75} />;
const Drop: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) => (
  <path d={`M${x} ${y} Q${x + 34 * s} ${y + 70 * s} ${x} ${y + 92 * s} Q${x - 34 * s} ${y + 70 * s} ${x} ${y}`} fill={WATER} {...ink} />
);

/** Props that sit behind the hands (hands are drawn after). */
const Props: React.FC<{pose: string}> = ({pose}) => {
  switch (pose) {
    case 'sweating': return <g><Drop x={330} y={330} s={1} /><Drop x={280} y={470} s={0.7} /><Drop x={900} y={400} s={0.8} /></g>;
    case 'sad': return (
      <g>
        <path d="M455 215 Q455 170 500 168 Q510 110 570 108 Q610 70 660 100 Q720 80 745 140 Q790 150 780 195 Q775 215 750 215 Z" fill="#cfd3da" {...ink} />
        <path d="M520 240 L505 285 M600 235 L585 280 M690 240 L675 285" stroke="#6fa6d3" strokeWidth={LINE} strokeLinecap="round" />
        <Drop x={395} y={650} s={0.8} />
      </g>
    );
    case 'angry': return (
      <g fill="none" stroke={RED} strokeWidth={LINE + 2} strokeLinecap="round" transform="translate(930 290) scale(2.2)">
        <path d="M0 0 q22 -4 26 -28 M0 0 q-4 -22 -28 -26 M0 0 q22 4 26 28 M0 0 q-4 22 -28 26" />
      </g>
    );
    case 'confused': return (
      <g transform="translate(110 70)" fill="none" {...ink} strokeWidth={LINE + 3}>
        <path d="M0 60 Q0 0 60 0 Q120 0 120 50 Q120 92 75 118 Q55 132 55 165" />
        <circle cx={55} cy={215} r={7} fill={INK} />
      </g>
    );
    case 'thinking': return (
      <g {...ink}>
        <circle cx={1000} cy={330} r={12} fill={WHITE} /><circle cx={1050} cy={265} r={19} fill={WHITE} />
        <circle cx={1110} cy={150} r={70} fill={WHITE} />
        {[1075, 1110, 1145].map(x => <circle key={x} cx={x} cy={150} r={6} fill={INK} />)}
      </g>
    );
    case 'excited': return <g><Burst x={190} y={150} /><g transform="translate(1200 0) scale(-1 1)"><Burst x={190} y={150} /></g></g>;
    case 'counting_money': return (
      <g>
        {[0, 1, 2, 3].map(i => <rect key={i} x={385} y={950 - (i + 1) * 28} width={110} height={28} rx={14} fill={GOLD} {...ink} strokeWidth={LINE - 2} />)}
        <Coin x={790} y={860} r={52} />
        <Coin x={320} y={870} r={40} />
        <path d="M860 920 Q895 895 900 850 M880 950 Q925 920 935 880" fill="none" {...ink} />
      </g>
    );
    case 'holding_sign': return (
      <g>
        <rect x={330} y={880} width={540} height={270} rx={16} fill={WHITE} {...ink} />
        <Lines d="M395 950 Q470 925 545 950 T700 950 T805 940 M395 1010 Q470 985 545 1010 T690 1010 M395 1070 Q470 1048 545 1070 T640 1068" />
      </g>
    );
    case 'reading': return (
      <g>
        <path d="M600 950 Q510 925 405 940 L405 1140 Q510 1125 600 1155 Q690 1125 795 1140 L795 940 Q690 925 600 950 Z" fill={WHITE} {...ink} />
        <path d="M600 950 L600 1155" fill="none" {...ink} />
        <Lines d="M440 985 Q500 975 565 990 M440 1030 Q500 1020 565 1035 M440 1075 Q500 1065 565 1080 M635 990 Q700 975 760 985 M635 1035 Q700 1020 760 1030 M635 1080 Q700 1065 760 1075" />
      </g>
    );
    case 'writing': return (
      <g>
        <g transform="rotate(-8 520 1040)">
          <rect x={400} y={930} width={240} height={220} rx={10} fill={WHITE} {...ink} />
          <path d="M400 975 L640 975" {...ink} />
          <Lines d="M430 1020 Q500 1005 560 1022 M430 1065 Q490 1050 540 1066 M430 1110 Q460 1100 495 1108" />
        </g>
        <g transform="translate(795 925) rotate(136)">
          <rect x={0} y={-12} width={170} height={24} fill={GOLD} {...ink} />
          <path d="M170 -12 L215 0 L170 12 Z" fill={BODY} {...ink} />
          <rect x={-24} y={-12} width={24} height={24} rx={6} fill="#e59a9a" {...ink} />
        </g>
      </g>
    );
    default: return null;
  }
};

const Penny: React.FC<{pose: string; talking: boolean; accent: string; blink: boolean; open: number; look: [number, number]}> = ({pose, talking, accent, blink, open, look}) => {
  const id = 'pn' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const spec = POSES[pose] ?? POSES.neutral;
  const face = FACES[spec.face];
  const talkOpen = talking && spec.face !== 'shocked';
  const rx = 34 + 14 * open, ry = 8 + 24 * open;
  const mouth = talkOpen ? `M${600 - rx} 782 a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0` : face.mouth;
  const filled = talkOpen || face.fill;
  const arms = (['L', 'R'] as const).map(s => [s, spec[s]] as const);
  return (
    <svg viewBox="0 0 1200 1500" width="100%" height="100%" style={{overflow: 'visible'}}>
      <g style={BOIL_STYLE}>
        {LEGS.map((d, i) => <path key={i} d={d} fill={BODY} {...ink} />)}
        {arms.map(([s, a]) => a === 'hang' ? <path key={s} d={ARM_HANG[s]} fill={BODY} {...ink} /> : !a.front && <Limb key={s} side={s} arm={a} />)}
        <circle cx={600} cy={640} r={440} fill={BODY} {...ink} />
        <circle cx={600} cy={640} r={378} fill="none" {...ink} strokeWidth={6} strokeDasharray="2 26" />
        <path d={TIE} fill={accent} {...ink} />
        {EYE_X.map((cx, i) => <EyeView key={i} id={id} cx={cx} side={i === 0 ? 'L' : 'R'} e={face.eyes[i]} blink={blink} gaze={spec.gaze} look={look} />)}
        <BrowView b={face.brows[0]} side="L" />
        <BrowView b={face.brows[1]} side="R" />
        <path d={mouth} fill={filled ? MOUTH_DARK : 'none'} {...ink} />
        <Props pose={pose} />
        {arms.map(([s, a]) => a !== 'hang' && a.front && <Limb key={s} side={s} arm={a} />)}
        {pose === 'facepalm' && <Lines d="M740 482 L740 520 M772 476 L772 516 M804 482 L804 520" />}
      </g>
    </svg>
  );
};

/** Deterministic pseudo-random in [0,1) from an integer: idle acting never uses Math.random. */
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const Mascot: React.FC<{
  pose: string; talking: boolean; accent: string; frame: number; height: number;
  assets: CharacterAssets; enter: number; flip?: boolean;
}> = ({pose, talking, accent, frame, height, assets, enter, flip}) => {
  const width = height * 0.8;
  const e = backOut(enter);
  // idle acting: breathing, slow sway, irregular blinks, eye darts, nod while talking
  const breath = 1 + 0.012 * Math.sin(frame / 19);
  const sway = Math.sin(frame / 41) * 0.9 + Math.sin(frame / 17 + 1) * 0.35 + (talking ? Math.sin(frame / 5.5) * 0.7 : 0);
  const bob = Math.sin(frame / 14) * 5 - (talking ? Math.abs(Math.sin(frame / 5.5)) * 6 : 0);
  const blink = frame % 83 >= 80 || (frame % 197 >= 191 && frame % 197 < 194);
  const dart = Math.floor(frame / 34);
  const look: [number, number] = rnd(dart) > 0.45 ? [Math.round((rnd(dart + 9) - 0.5) * 22), Math.round((rnd(dart + 19) - 0.5) * 10)] : [0, 0];
  const open = talking ? [0.1, 0.55, 1, 0.7, 0.3, 0.85][Math.floor(rnd(Math.floor(frame / 3)) * 6)] : 0;
  const flap = talking;
  const real = assets[pose];
  const realOpen = talking && Math.floor(frame / 2) % 2 === 0;
  return (
    <div style={{
      width, height, transform: `translateY(${bob}px) rotate(${sway}deg) scale(${1.14 - 0.14 * e}, ${(0.8 + 0.2 * e) * breath}) scaleX(${flip ? -1 : 1})`,
      transformOrigin: '50% 100%', opacity: Math.min(1, enter * 4),
    }}>
      {real ? (
        <Img src={staticFile(realOpen && real.talk ? real.talk : real.file)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      ) : (
        <Penny pose={pose} talking={flap} accent={accent} blink={blink} open={open} look={look} />
      )}
    </div>
  );
};
