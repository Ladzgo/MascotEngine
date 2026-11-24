export type Pt = {t: number; x: number};
export type SmoothOpts = {
  hz?: number;       // output sample rate
  median?: number;   // odd window for spike rejection
  alpha?: number;    // EMA factor (0..1), applied forward and backward (zero lag)
  deadband?: number; // ignore target moves smaller than this (same unit as x)
  maxSpeed: number;  // max units per second
  min?: number; max?: number; // clamp
};

/** Linear resample of (possibly irregular) samples to a uniform grid over [t0, t1]. */
export function resample(pts: Pt[], hz: number, t0 = pts[0].t, t1 = pts[pts.length - 1].t): Pt[] {
  const out: Pt[] = [];
  const n = Math.max(1, Math.round((t1 - t0) * hz));
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    while (k < pts.length - 2 && pts[k + 1].t < t) k++;
    const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
    const f = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    out.push({t, x: a.x + (b.x - a.x) * f});
  }
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/** Median -> zero-lag EMA -> deadband + speed-limited follower. Pure, deterministic. */
export function smoothPath(samples: Pt[], o: SmoothOpts): Pt[] {
  if (!samples.length) return [];
  const hz = o.hz ?? 10, alpha = o.alpha ?? 0.25, db = o.deadband ?? 0, win = o.median ?? 5;
  const half = win >> 1;
  // median on the raw samples (before resampling) so a one-frame spike cannot widen into a bump
  const rawMed = samples.map((p, i) => ({t: p.t, x: median(samples.slice(Math.max(0, i - half), i + half + 1).map(q => q.x))}));
  const g = resample(rawMed.length > 1 ? rawMed : [rawMed[0], {t: rawMed[0].t + 1 / hz, x: rawMed[0].x}], hz);
  const med = g.map(p => p.x);
  const fwd = [...med];
  for (let i = 1; i < fwd.length; i++) fwd[i] = alpha * med[i] + (1 - alpha) * fwd[i - 1];
  const both = [...fwd];
  for (let i = med.length - 2; i >= 0; i--) both[i] = alpha * fwd[i] + (1 - alpha) * both[i + 1];
  const dt = 1 / hz, step = o.maxSpeed * dt;
  const lo = o.min ?? -Infinity, hi = o.max ?? Infinity;
  let pos = Math.min(hi, Math.max(lo, both[0]));
  return g.map((p, i) => {
    if (i > 0) {
      const err = both[i] - pos;
      if (Math.abs(err) > db) pos += Math.sign(err) * Math.min(Math.abs(err) - db, step);
      pos = Math.min(hi, Math.max(lo, pos));
    }
    return {t: p.t, x: pos};
  });
}

/** Keep roughly one knot per `every` seconds (always first and last). */
export function decimate(pts: Pt[], every: number): Pt[] {
  return pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.round(p.t / every) !== Math.round(pts[i - 1].t / every));
}

/** ffmpeg expression for a piecewise-linear x(t): x0 + sum of slopes*clip(t-ti,0,di). No nesting. */
export function ffmpegXExpr(knots: Pt[]): string {
  const r = (n: number) => String(Math.round(n * 1000) / 1000);
  let e = r(knots[0].x);
  for (let i = 1; i < knots.length; i++) {
    const d = knots[i].t - knots[i - 1].t;
    if (d <= 0) continue;
    const slope = (knots[i].x - knots[i - 1].x) / d;
    if (Math.abs(slope) < 1e-6) continue;
    e += `${slope < 0 ? '-' : '+'}${r(Math.abs(slope))}*clip(t-${r(knots[i - 1].t)}\\,0\\,${r(d)})`;
  }
  return e;
}
