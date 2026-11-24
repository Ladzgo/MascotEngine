/** Index of the real inflection point of a series: the interior point with the largest change of slope (|second difference|). -1 when the series is too short or perfectly straight. */
export function inflectionIndex(values: number[]): number {
  let best = -1, mag = 1e-9;
  const span = (Math.max(...values) - Math.min(...values)) || 1;
  for (let i = 1; i < values.length - 1; i++) {
    const m = Math.abs(values[i + 1] - 2 * values[i] + values[i - 1]) / span;
    if (m > mag * 1) { if (m > mag) { mag = m; best = i; } }
  }
  return values.length >= 4 && mag > 0.02 ? best : -1;
}
