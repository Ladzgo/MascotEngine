// Calendar helpers: recurring publish slots and same-day conflicts. Days are local 'YYYY-MM-DD' keys.
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Next `count` dates on the given weekdays (0 = Sunday) from `from` (inclusive), skipping days in `taken`. */
export function nextSlots(from: Date, weekdays: number[], count: number, taken: Set<string> = new Set()): Date[] {
  if (!weekdays.length || count <= 0) return [];
  const out: Date[] = [], d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 366 * 3 && out.length < count; i++, d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay()) && !taken.has(dayKey(d))) out.push(new Date(d));
  }
  return out;
}

/** Days on which one channel has more than one scheduled episode: `{day: [ids]}`. */
export function conflicts(items: {id: string; channel: string; when: string}[]): Record<string, string[]> {
  const by: Record<string, string[]> = {};
  for (const i of items) (by[`${dayKey(new Date(i.when))}|${i.channel}`] ??= []).push(i.id);
  const out: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(by)) if (ids.length > 1) (out[k.split('|')[0]] ??= []).push(...ids);
  return out;
}
