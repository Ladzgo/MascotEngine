import {continueRender, delayRender, staticFile} from 'remotion';

export const W = 1920;
export const H = 1080;
export const PAPER = '#f6f1e4';
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
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t: number) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
