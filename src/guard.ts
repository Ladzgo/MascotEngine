import fs from 'node:fs';
import path from 'node:path';

/** Local-only request guard for the Studio server (docs/SECURITY.md #1 and #2). Returns an HTTP status and text to reject, or null. */
export function checkRequest(r: {host?: string; origin?: string; method?: string; url?: string; contentType?: string; contentLength?: string}, port: number): {code: number; msg: string} | null {
  const allowed = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (!allowed.has(r.host ?? '')) return {code: 403, msg: 'Bad host'}; // DNS rebinding
  const method = r.method ?? 'GET';
  if (!(r.url ?? '').startsWith('/api/') || method === 'GET' || method === 'HEAD') return null;
  if (r.origin && !allowed.has(r.origin.replace(/^https?:\/\//, ''))) return {code: 403, msg: 'Bad origin'}; // CSRF
  const raw = /^\/api\/(episodes\/[^/]+\/audio\/\d+|clips\/upload|episodes\/import)(\?|$)/.test(r.url ?? '');
  if (!raw && r.contentLength !== undefined && r.contentLength !== '0' && !(r.contentType ?? '').startsWith('application/json')) return {code: 415, msg: 'JSON only'};
  return null;
}

/** True when `file` (after resolving symlinks) lies inside one of `roots`. */
export function underRoots(file: string, roots: string[]): boolean {
  let real: string;
  try { real = fs.realpathSync(file); } catch { return false; }
  return roots.some(r => { try { const rr = fs.realpathSync(r); return real === rr || real.startsWith(rr + path.sep); } catch { return false; } });
}
