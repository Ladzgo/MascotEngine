// Procedural 1080x1920 SVG backdrops: 8 styles x 10 palettes = 80 deterministic files (original work, CC0).
type Pal = {name: string; a: string; b: string; c: string; tags: string[]};
const PALS: Pal[] = [
  {name: 'midnight', a: '#0b1026', b: '#1f2a5c', c: '#5b7cfa', tags: ['dark', 'night', 'blue', 'tech']},
  {name: 'sunset', a: '#2b1033', b: '#c2410c', c: '#fbbf24', tags: ['warm', 'orange', 'sunset', 'money']},
  {name: 'mint', a: '#06302b', b: '#0f766e', c: '#5eead4', tags: ['green', 'fresh', 'health', 'money']},
  {name: 'cream', a: '#fff7ed', b: '#fde68a', c: '#f59e0b', tags: ['light', 'warm', 'paper', 'food']},
  {name: 'rose', a: '#3b0a1e', b: '#be185d', c: '#f9a8d4', tags: ['pink', 'warm', 'lifestyle']},
  {name: 'steel', a: '#111827', b: '#374151', c: '#9ca3af', tags: ['grey', 'neutral', 'serious', 'business']},
  {name: 'sky', a: '#e0f2fe', b: '#7dd3fc', c: '#0284c7', tags: ['light', 'blue', 'sky', 'calm']},
  {name: 'forest', a: '#052e16', b: '#166534', c: '#a3e635', tags: ['green', 'nature', 'calm']},
  {name: 'violet', a: '#1e1033', b: '#6d28d9', c: '#c4b5fd', tags: ['purple', 'tech', 'mystery']},
  {name: 'alert', a: '#1c0606', b: '#991b1b', c: '#fca5a5', tags: ['red', 'danger', 'debt', 'warning']},
];
// small deterministic PRNG so the same palette+style always gives the same file
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const W = 1080, H = 1920;
const STYLES: {name: string; tags: string[]; draw: (p: Pal, r: () => number) => string}[] = [
  {name: 'glow', tags: ['glow', 'spotlight', 'soft'], draw: p => `<radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${p.c}" stop-opacity=".55"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="url(#g)"/>`},
  {name: 'bokeh', tags: ['bokeh', 'lights', 'blur', 'soft'], draw: (p, r) => Array.from({length: 28}, () => `<circle cx="${(r() * W) | 0}" cy="${(r() * H) | 0}" r="${(30 + r() * 140) | 0}" fill="${r() > .5 ? p.c : p.b}" opacity="${(0.08 + r() * 0.25).toFixed(2)}"/>`).join('')},
  {name: 'stripes', tags: ['stripes', 'diagonal', 'dynamic'], draw: (p, r) => `<g transform="rotate(-24 540 960)">${Array.from({length: 14}, (_, i) => `<rect x="-600" y="${i * 240 - 400}" width="2400" height="${(40 + r() * 90) | 0}" fill="${i % 2 ? p.b : p.c}" opacity=".18"/>`).join('')}</g>`},
  {name: 'grid', tags: ['grid', 'tech', 'data', 'chart'], draw: p => `<pattern id="p" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M90 0H0V90" fill="none" stroke="${p.c}" stroke-opacity=".22" stroke-width="2"/></pattern><rect width="${W}" height="${H}" fill="url(#p)"/><radialGradient id="v" cx="50%" cy="50%" r="65%"><stop offset=".5" stop-color="${p.a}" stop-opacity="0"/><stop offset="1" stop-color="${p.a}"/></radialGradient><rect width="${W}" height="${H}" fill="url(#v)"/>`},
  {name: 'waves', tags: ['waves', 'flow', 'calm'], draw: (p, r) => Array.from({length: 6}, (_, i) => { const y = 900 + i * 170, k = 80 + r() * 120; return `<path d="M0 ${y} C 270 ${y - k} 810 ${y + k} ${W} ${y} V ${H} H 0 Z" fill="${i % 2 ? p.b : p.c}" opacity="${(0.12 + i * 0.05).toFixed(2)}"/>`; }).join('')},
  {name: 'sunburst', tags: ['sunburst', 'rays', 'energy', 'reveal'], draw: p => `<g transform="translate(540 820)">${Array.from({length: 24}, (_, i) => `<path d="M0 0 L ${Math.cos(i * Math.PI / 12) * 2200} ${Math.sin(i * Math.PI / 12) * 2200} L ${Math.cos((i + 0.5) * Math.PI / 12) * 2200} ${Math.sin((i + 0.5) * Math.PI / 12) * 2200} Z" fill="${p.c}" opacity=".1"/>`).join('')}</g>`},
  {name: 'blobs', tags: ['blobs', 'organic', 'playful'], draw: (p, r) => Array.from({length: 7}, () => { const x = r() * W, y = r() * H, s = 180 + r() * 320; return `<ellipse cx="${x | 0}" cy="${y | 0}" rx="${s | 0}" ry="${(s * (0.6 + r() * 0.5)) | 0}" transform="rotate(${(r() * 180) | 0} ${x | 0} ${y | 0})" fill="${r() > .5 ? p.b : p.c}" opacity=".28"/>`; }).join('')},
  {name: 'skyline', tags: ['city', 'skyline', 'buildings', 'urban', 'money'], draw: (p, r) => { let x = 0, s = ''; while (x < W) { const w = 60 + r() * 110, h = 300 + r() * 700; s += `<rect x="${x | 0}" y="${(H - h) | 0}" width="${w | 0}" height="${h | 0}" fill="${p.b}" opacity=".55"/>`; for (let wy = H - h + 30; wy < H - 30; wy += 60) if (r() > .55) s += `<rect x="${(x + 14) | 0}" y="${wy | 0}" width="${(w - 28) | 0}" height="16" fill="${p.c}" opacity=".35"/>`; x += w + 8; } return s; }},
];

export function backdrops(): {id: string; svg: string; tags: string[]}[] {
  return STYLES.flatMap((st, si) => PALS.map((p, pi) => {
    const r = rng(si * 101 + pi * 7 + 1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bgl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bgl)"/>${st.draw(p, r)}</svg>`;
    return {id: `${st.name}-${p.name}`, svg, tags: ['background', 'backdrop', st.name, p.name, ...st.tags, ...p.tags]};
  }));
}
