/** First balanced {...} block, ignoring braces inside strings. */
function firstObject(t: string): string | null {
  const a = t.indexOf('{'); if (a < 0) return null;
  let depth = 0, str = false, esc = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return t.slice(a, i + 1);
  }
  return t.slice(a); // truncated output: caller tries to close it
}

/** Tolerant JSON extraction for sloppy (small-model) output: fences, prose around it, trailing commas, smart quotes, comments, truncation. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const body = firstObject(t) ?? t;
  const tries = [body];
  const fixed = body.replace(/[“”]/g, '"').replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
  tries.push(fixed);
  // truncated: drop a dangling partial item, then close open brackets
  let cut = fixed.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '').replace(/,\s*$/, '');
  const stack: string[] = []; let str = false, esc = false;
  for (const c of cut) { if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; } if (c === '"') str = true; else if (c === '{') stack.push('}'); else if (c === '[') stack.push(']'); else if (c === '}' || c === ']') stack.pop(); }
  if (stack.length && !str) tries.push(cut + stack.reverse().join(''));
  let first: unknown;
  for (const x of tries) { try { return JSON.parse(x); } catch (e) { first ??= e; } }
  throw first;
}
