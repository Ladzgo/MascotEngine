// Named things in a sentence -> a specific picture (16:9 gap 2): a country -> its flag, a continent -> its globe, "$100 buys $50" -> before/after price tags,
// a king/farmer/worker -> that person, a percentage over 100 -> the number as the headline over a soaring arrow. Tried before topic/money fallbacks.
import React from 'react';
import {byId} from '../assets/catalog';
import {Shadow, Txt, pop, seg, wave} from './kit';
import type {Obj} from './objects';

type Flag = {d: 'h' | 'v'; c: string[]; x?: 'disc' | 'stars' | 'canton' | 'union' | 'triangle' | 'nordic' | 'cross' | 'star' | 'crescent' | 'diamond'; xc?: string};
const FLAGS: Record<string, Flag> = {
  venezuela: {d: 'h', c: ['#ffcc00', '#00247d', '#cf142b'], x: 'stars', xc: '#fff'}, zimbabwe: {d: 'h', c: ['#319208', '#ffd200', '#de2010', '#000', '#de2010', '#ffd200', '#319208'], x: 'triangle', xc: '#fff'},
  germany: {d: 'h', c: ['#000', '#dd0000', '#ffce00']}, hungary: {d: 'h', c: ['#cd2a3e', '#fff', '#436f4d']}, argentina: {d: 'h', c: ['#74acdf', '#fff', '#74acdf'], x: 'disc', xc: '#f6b40e'},
  france: {d: 'v', c: ['#0055a4', '#fff', '#ef4135']}, italy: {d: 'v', c: ['#009246', '#fff', '#ce2b37']}, ireland: {d: 'v', c: ['#169b62', '#fff', '#ff883e']}, belgium: {d: 'v', c: ['#000', '#fdda24', '#ef3340']},
  spain: {d: 'h', c: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b']}, netherlands: {d: 'h', c: ['#ae1c28', '#fff', '#21468b']}, russia: {d: 'h', c: ['#fff', '#0039a6', '#d52b1e']},
  austria: {d: 'h', c: ['#ed2939', '#fff', '#ed2939']}, poland: {d: 'h', c: ['#fff', '#dc143c']}, ukraine: {d: 'h', c: ['#0057b7', '#ffd700']}, japan: {d: 'h', c: ['#fff'], x: 'disc', xc: '#bc002d'},
  china: {d: 'h', c: ['#de2910'], x: 'star', xc: '#ffde00'}, turkey: {d: 'h', c: ['#e30a17'], x: 'crescent', xc: '#fff'}, usa: {d: 'h', c: Array.from({length: 13}, (_, i) => (i % 2 ? '#fff' : '#b22234')), x: 'canton', xc: '#3c3b6e'},
  uk: {d: 'h', c: ['#012169'], x: 'union', xc: '#c8102e'}, india: {d: 'h', c: ['#ff9933', '#fff', '#138808'], x: 'disc', xc: '#000080'}, brazil: {d: 'h', c: ['#009c3b'], x: 'diamond', xc: '#ffdf00'},
  mexico: {d: 'v', c: ['#006847', '#fff', '#ce1126']}, nigeria: {d: 'v', c: ['#008751', '#fff', '#008751']}, egypt: {d: 'h', c: ['#ce1126', '#fff', '#000']}, sweden: {d: 'h', c: ['#006aa7'], x: 'nordic', xc: '#fecc00'},
  switzerland: {d: 'h', c: ['#da291c'], x: 'cross', xc: '#fff'}, iran: {d: 'h', c: ['#239f40', '#fff', '#da0000']}, peru: {d: 'v', c: ['#d91023', '#fff', '#d91023']}, colombia: {d: 'h', c: ['#fcd116', '#fcd116', '#003893', '#ce1126']},
  greece: {d: 'h', c: Array.from({length: 9}, (_, i) => (i % 2 ? '#fff' : '#0d5eaf'))}, lebanon: {d: 'h', c: ['#ed1c24', '#fff', '#fff', '#ed1c24']}, indonesia: {d: 'h', c: ['#ce1126', '#fff']},
};
const COUNTRY: [RegExp, string][] = [
  [/^venezuela(n|ns)?$/, 'venezuela'], [/^zimbabwe(an|ans)?$/, 'zimbabwe'], [/^(germany|german|germans|weimar)$/, 'germany'], [/^(hungary|hungarian|hungarians)$/, 'hungary'], [/^(argentina|argentine|argentinian|argentinians)$/, 'argentina'],
  [/^(france|french)$/, 'france'], [/^(italy|italian|italians)$/, 'italy'], [/^(ireland|irish)$/, 'ireland'], [/^(belgium|belgian)$/, 'belgium'], [/^(spain|spanish)$/, 'spain'], [/^(netherlands|dutch|holland)$/, 'netherlands'],
  [/^(russia|russian|russians|soviet)$/, 'russia'], [/^(austria|austrian)$/, 'austria'], [/^(poland|polish)$/, 'poland'], [/^(ukraine|ukrainian)$/, 'ukraine'], [/^(japan|japanese)$/, 'japan'], [/^(china|chinese)$/, 'china'],
  [/^(turkey|turkish|türkiye)$/, 'turkey'], [/^(america|american|americans|usa|us)$/, 'usa'], [/^(britain|british|uk|england|english)$/, 'uk'], [/^(india|indian|indians)$/, 'india'], [/^(brazil|brazilian|brazilians)$/, 'brazil'],
  [/^(mexico|mexican|mexicans)$/, 'mexico'], [/^(nigeria|nigerian)$/, 'nigeria'], [/^(egypt|egyptian|egyptians)$/, 'egypt'], [/^(sweden|swedish)$/, 'sweden'], [/^(switzerland|swiss)$/, 'switzerland'], [/^(iran|iranian)$/, 'iran'],
  [/^(peru|peruvian)$/, 'peru'], [/^(colombia|colombian)$/, 'colombia'], [/^(greece|greek)$/, 'greece'], [/^(lebanon|lebanese)$/, 'lebanon'], [/^(indonesia|indonesian)$/, 'indonesia'],
];
const NAME: Record<string, string> = {usa: 'USA', uk: 'UK'};
const CONTINENT: [RegExp, string][] = [[/^(europe|european|europeans)$/, 'fluent-globe-showing-europe-africa'], [/^(africa|african)$/, 'fluent-globe-showing-europe-africa'], [/^(asia|asian|australia|australian)$/, 'fluent-globe-showing-asia-australia'], [/^(americas)$/, 'fluent-globe-showing-americas']];
// people a sentence names by role (history: kings, peasants; jobs): the Fluent 3D person, never a coin pile
const PERSON: [RegExp, string][] = [
  [/^(kings?|queens?|emperors?|empress|pharaohs?|monarchs?|sultans?|rulers?|royalty|royal)$/, 'fluent-person-with-crown'], [/^(princes?|princess(es)?)$/, 'fluent-prince'], [/^(farmers?|peasants?|farming)$/, 'fluent-farmer'],
  [/^(workers?|laborers?|labourers?|factory)$/, 'fluent-factory-worker'], [/^(builders?)$/, 'fluent-construction-worker'], [/^(doctors?|nurses?)$/, 'fluent-health-worker'], [/^(teachers?)$/, 'fluent-teacher'],
  [/^(students?)$/, 'fluent-student'], [/^(scientists?)$/, 'fluent-scientist'], [/^(cooks?|chefs?|bakers?)$/, 'fluent-cook'], [/^(soldiers?|guards?)$/, 'fluent-guard'], [/^(judges?)$/, 'fluent-judge'],
  [/^(astronauts?)$/, 'fluent-astronaut'], [/^(pilots?)$/, 'fluent-pilot'],
];
const words = (t: string) => t.replace(/[’']s\b/g, '').replace(/[^A-Za-zü ]/g, ' ').split(/\s+/).filter(Boolean);

/** Dollar amounts in spoken order ("$10,000", "100 dollars"), as written on a tag. */
export const dollarAmounts = (t: string) => [...t.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:k|thousand|million|billion)\b)?|\b(\d[\d,]*(?:\.\d+)?)\s(dollars?|bucks)\b/gi)].map(m => `$${m[1] ?? m[3]}${m[2] ? (/k/i.test(m[2]) ? 'K' : ` ${m[2].trim()}`) : ''}`);
const num = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

export type Entity = {kind: string; why: string; headline?: string};
/** The most specific picture the sentence names, in priority order: a before/after amount, a country, a continent, a person, a huge percentage. */
export function entityHero(text: string): Entity | undefined {
  const $ = [...new Set(dollarAmounts(text))];
  if ($.length >= 2 && num($[0]) !== num($[1]) && /\b(buys?|bought|buy|worth|be|shrinks?|left|covers?)\b/i.test(text)) return {kind: `tags:${$[0]}|${$[1]}`, why: `amounts ${$[0]} -> ${$[1]}`};
  const ws = words(text), pct = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?(%|percent)/gi)].map(m => m[1]).find(x => num(x) > 100);
  const headline = pct ? `${pct}%` : undefined;
  // a country is a proper noun: 'turkey' the bird and 'us' the pronoun stay lower case
  for (const w of ws) for (const [re, c] of COUNTRY) if (/^[A-Z]/.test(w) && re.test(w.toLowerCase())) return {kind: `flag:${c}`, why: `country "${w}"`, headline};
  for (const w of ws) for (const [re, id] of [...CONTINENT, ...PERSON]) if (re.test(w.toLowerCase()) && byId(id)) return {kind: `asset:${id}`, why: `named "${w}"`, headline};
  if (pct) return {kind: 'arrow_up', why: `percent ${pct}% > 100`, headline};
  return undefined;
}

/** Waving flag on a pole: the stripes drawn once, then cut into vertical strips that ride a travelling sine (cloth), with a fold shade. */
const flagCache = new Map<string, Obj>();
let flagSeq = 0;
const FlagArt: React.FC<{f: Flag}> = ({f}) => {
  const W = 240, H = 160, n = f.c.length, xc = f.xc ?? '#fff';
  const star = (cx: number, cy: number, r: number) => <polygon points={Array.from({length: 10}, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.42 : r; return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`; }).join(' ')} fill={xc} />;
  return (
    <g>
      {f.c.map((c, k) => (f.d === 'h' ? <rect key={k} x={0} y={(k * H) / n} width={W} height={H / n + 0.5} fill={c} /> : <rect key={k} x={(k * W) / n} y={0} width={W / n + 0.5} height={H} fill={c} />))}
      {f.x === 'disc' && <circle cx={W / 2} cy={H / 2} r={H * (f.c.length === 1 ? 0.3 : 0.14)} fill={xc} />}
      {f.x === 'stars' && Array.from({length: 8}, (_, k) => star(W / 2 + Math.cos(Math.PI * (1.15 + (k * 0.7) / 7)) * 46, H / 2 + 12 + Math.sin(Math.PI * (1.15 + (k * 0.7) / 7)) * 46, 7))}
      {f.x === 'triangle' && <polygon points={`0,0 ${H * 0.55},${H / 2} 0,${H}`} fill={xc} stroke="#000" strokeWidth={3} />}
      {f.x === 'canton' && <><rect x={0} y={0} width={W * 0.4} height={(H * 7) / 13} fill={xc} />{Array.from({length: 20}, (_, k) => <circle key={k} cx={10 + (k % 5) * 18 + (Math.floor(k / 5) % 2) * 9} cy={10 + Math.floor(k / 5) * 18} r={3.2} fill="#fff" />)}</>}
      {f.x === 'union' && <><path d={`M0 0L${W} ${H}M${W} 0L0 ${H}`} stroke="#fff" strokeWidth={26} /><path d={`M0 0L${W} ${H}M${W} 0L0 ${H}`} stroke={xc} strokeWidth={9} /><path d={`M${W / 2} 0V${H}M0 ${H / 2}H${W}`} stroke="#fff" strokeWidth={42} /><path d={`M${W / 2} 0V${H}M0 ${H / 2}H${W}`} stroke={xc} strokeWidth={24} /></>}
      {f.x === 'nordic' && <path d={`M${W * 0.36} 0V${H}M0 ${H / 2}H${W}`} stroke={xc} strokeWidth={28} />}
      {f.x === 'cross' && <path d={`M${W / 2} ${H * 0.2}V${H * 0.8}M${W / 2 - H * 0.3} ${H / 2}H${W / 2 + H * 0.3}`} stroke={xc} strokeWidth={30} />}
      {f.x === 'star' && star(W * 0.2, H * 0.3, 26)}
      {f.x === 'crescent' && <><circle cx={W * 0.36} cy={H / 2} r={44} fill={xc} /><circle cx={W * 0.4} cy={H / 2} r={36} fill={f.c[0]} />{star(W * 0.56, H / 2, 20)}</>}
      {f.x === 'diamond' && <><polygon points={`${W / 2},14 ${W - 18},${H / 2} ${W / 2},${H - 14} 18,${H / 2}`} fill={xc} /><circle cx={W / 2} cy={H / 2} r={38} fill="#002776" /></>}
    </g>
  );
};
export function flagObj(country: string): Obj | undefined {
  const f = FLAGS[country];
  if (!f) return undefined;
  if (!flagCache.has(country)) {
    const id = `fbflag${flagSeq++}`, S = 16, W = 240, H = 160, name = (NAME[country] ?? country).toUpperCase();
    flagCache.set(country, ({t}) => {
      const up = seg(t, 0, 0.7), s = Math.max(0.01, pop(t, 0, 0.5));
      return (
        <g>
          <Shadow rx={110} />
          <defs><g id={id}><FlagArt f={f} /></g>{Array.from({length: S}, (_, k) => <clipPath key={k} id={`${id}c${k}`}><rect x={(k * W) / S - 0.5} y={-10} width={W / S + 1} height={H + 20} /></clipPath>)}</defs>
          <g transform={`translate(200 330) scale(${s}) translate(-200 -330)`}>
            <rect x={76} y={50} width={10} height={282} rx={5} fill="#d9dde6" /><circle cx={81} cy={48} r={9} fill="#f2c94c" />
            <g transform={`translate(86 ${60 + (1 - up) * 120})`}>
              {Array.from({length: S}, (_, k) => { const u = k / S, dy = wave(t * 1.6 - u * 2.2, 1) * 10 * u, sh = 0.18 * (wave(t * 1.6 - u * 2.2 + 0.25, 1) + 1) * u;
                return <g key={k} clipPath={`url(#${id}c${k})`} transform={`translate(0 ${dy})`}><use href={`#${id}`} /><rect x={(k * W) / S} y={0} width={W / S + 1} height={H} fill="#000" opacity={sh * 0.5} /></g>; })}
            </g>
            <g opacity={seg(t, 0.5, 0.9)}><rect x={200 - name.length * 13 - 24} y={262} width={name.length * 26 + 48} height={52} rx={26} fill="#fff" /><Txt x={200} y={300} size={34} fill="#16182a">{name}</Txt></g>
          </g>
        </g>
      );
    });
  }
  return flagCache.get(country);
}

/** The hook's from -> to drop ("$10,000. Ten years. 7,000 left."): the first amount and the next smaller one, years skipped; needs a dollar sign or 'dollars'. */
export function drainOf(text: string): {a: number; b: number} | undefined {
  if (!/\$|\bdollars?\b/i.test(text)) return undefined;
  const ns = [...text.matchAll(/(\$)?(\d[\d,]*(?:\.\d+)?)/g)].filter(m => m[1] || !/^(1[5-9]|20)\d\d$/.test(m[2])).map(m => num(m[2]));
  return ns.length >= 2 && ns[1] < ns[0] && ns[1] > 0 ? {a: ns[0], b: ns[1]} : undefined;
}
/** Seconds the drain counts over (counter text and jar level share it). */
export const DRAIN: [number, number] = [0.3, 2.3];
export const drainValue = (a: number, b: number, t: number) => a + (b - a) * seg(t, DRAIN[0], DRAIN[1]);
/** A jar of gold whose level falls from full to b/a while coins leak out of a crack at the bottom. */
const drainCache = new Map<string, Obj>();
export function drainObj(pair: string): Obj {
  if (!drainCache.has(pair)) {
    const [a, b] = pair.split('|').map(Number), id = `fbdrain${flagSeq++}`;
    drainCache.set(pair, ({t}) => {
      const k = seg(t, DRAIN[0], DRAIN[1]), lvl = 0.86 * (1 - k * (1 - b / a)), y = 318 - lvl * 236, leaking = k > 0 && k < 1;
      return (
        <g>
          <Shadow rx={120} />
          <rect x={110} y={70} width={180} height={254} rx={36} fill="#cfe9ff" opacity={0.28} />
          <clipPath id={id}><rect x={116} y={76} width={168} height={242} rx={32} /></clipPath>
          <g clipPath={`url(#${id})`}><rect x={110} y={y} width={180} height={lvl * 236 + 4} fill="url(#fb-gold-v)" /><path d={`M110 ${y} q22 ${wave(t, 1.1) * 7} 45 0 t45 0 t45 0 t45 0`} fill="#ffe27a" /></g>
          <rect x={110} y={70} width={180} height={254} rx={36} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={6} /><rect x={124} y={84} width={14} height={150} rx={7} fill="#fff" opacity={0.4} />
          <rect x={126} y={46} width={148} height={30} rx={10} fill="url(#fb-red)" />
          <path d="M262 300 l10 -12 l-4 -8 l12 -10" stroke="#2a1f12" strokeWidth={4} fill="none" />
          {Array.from({length: 6}, (_, i) => { const u = ((t * 1.6 + i / 6) % 1); return leaking || u < 0.3 ? <circle key={i} cx={282 + u * 40} cy={300 + u * u * 40} r={9 * (1 - u * 0.4)} fill="url(#fb-gold)" opacity={leaking ? 1 - u : 0} /> : null; })}
        </g>
      );
    });
  }
  return drainCache.get(pair)!;
}

/** Before/after price tags: the old amount, an arrow, the new amount in red (less) or green (more). */
const tagCache = new Map<string, Obj>();
export function tagsObj(pair: string): Obj {
  if (!tagCache.has(pair)) {
    const [a, b] = pair.split('|'), down = num(b) < num(a);
    const Tag: React.FC<{x: number; y: number; txt: string; fill: string; ink: string; rot: number; s: number; strike?: number}> = ({x, y, txt, fill, ink, rot, s, strike = 0}) => {
      const fs = Math.min(46, 150 / (txt.length * 0.62));
      return (
        <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${Math.max(0.01, s)})`}>
          <path d="M-70 -48 H78 Q88 -48 88 -38 V38 Q88 48 78 48 H-70 L-98 0 Z" fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth={4} /><circle cx={-72} cy={0} r={8} fill="rgba(0,0,0,0.35)" />
          <path d="M-72 0 Q-100 -60 -60 -90" stroke="#c9b48a" strokeWidth={4} fill="none" />
          <Txt x={6} y={fs * 0.36} size={fs} fill={ink}>{txt}</Txt>
          {strike > 0 && <line x1={-50} y1={6} x2={-50 + 130 * strike} y2={-6} stroke="#e4572e" strokeWidth={8} strokeLinecap="round" />}
        </g>
      );
    };
    tagCache.set(pair, ({t}) => {
      const k = seg(t, 0.45, 0.85);
      return (
        <g>
          <Shadow rx={150} />
          <Tag x={112} y={150 + wave(t, 3) * 3} txt={a} fill="#fffaf0" ink="#16182a" rot={-8} s={pop(t, 0, 0.45)} strike={down ? seg(t, 1.0, 1.3) : 0} />
          <g opacity={k}><path d={`M150 ${232} Q200 ${262} ${150 + 100 * k} ${236}`} stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" /><polygon points={`${150 + 100 * k},${222} ${150 + 100 * k + 22},${240} ${150 + 100 * k - 4},${252}`} fill="#fff" /></g>
          <Tag x={292} y={268 + wave(t, 3.4, 1) * 3} txt={b} fill={down ? '#e4572e' : '#2e9e5b'} ink="#fff" rot={7} s={pop(t, 0.75, 0.5)} />
        </g>
      );
    });
  }
  return tagCache.get(pair)!;
}
