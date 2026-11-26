import React, {useEffect, useState} from 'react';

type Toast = {id: number; text: string; kind: 'ok' | 'bad'};
let list: Toast[] = [], seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
/** Short message in the corner (also read out by screen readers). */
export function toast(text: string, kind: Toast['kind'] = 'ok', ms = 6000) {
  const id = ++seq; list = [...list, {id, text, kind}]; emit();
  setTimeout(() => { list = list.filter(x => x.id !== id); emit(); }, ms);
}
export function Toasts() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return <div className="toasts" role="status" aria-live="polite">{list.map(x => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>;
}
