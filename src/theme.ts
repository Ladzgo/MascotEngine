import {continueRender, delayRender, staticFile} from 'remotion';

export const W = 1920;
export const H = 1080;
export const PAPER = '#f6f1e4';
/** Readable text colour on an accent fill: white when it has >= 3:1 contrast (large display type), else ink (mustard and other light accents). */
export function onAccent(hex: string): string {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05) >= 3 ? '#fffdf6' : '#1a1a1a';
}
export const INK = '#1b1b1f';
export const DISPLAY = '"Archivo Black", sans-serif';
export const SANS = '"Poppins", sans-serif';
export const CAPTION_ZONE_TOP = 930; // content + character stay above this

let loaded = false;
export function loadFonts() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('fonts');
  const faces = [
    new FontFace('Archivo Black', `url(${staticFile('fonts/archivo-black-latin-400-normal.woff2')})`, {weight: '400'}),
    new FontFace('Poppins', `url(${staticFile('fonts/poppins-latin-500-normal.woff2')})`, {weight: '500'}),
    new FontFace('Poppins', `url(${staticFile('fonts/poppins-latin-700-normal.woff2')})`, {weight: '700'}),
  ];
  Promise.all(faces.map(f => f.load()))
    .then(fs => { fs.forEach(f => document.fonts.add(f)); continueRender(handle); })
    .catch(e => { console.error(e); continueRender(handle); });
}

export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
/** CSS-style cubic-bezier(x1,y1,x2,y2) easing: solves x(t)=u by bisection, returns y. */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => (u: number) => {
  u = clamp(u);
  const bz = (a: number, b: number, t: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (bz(x1, x2, m) < u) lo = m; else hi = m; }
  return bz(y1, y2, (lo + hi) / 2);
};
/** Shared motion curves: everything that enters, moves or leaves uses these instead of linear progress. */
export const easeOut = cubicBezier(0.16, 1, 0.3, 1);
export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
/** Damped spring settle (about 6% overshoot): replaces the old back-out overshoot. */
export const spring = (t: number) => { t = clamp(t); return t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(9 * t); };
export const backOut = spring;
