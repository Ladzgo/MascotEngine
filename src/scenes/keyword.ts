import {isFunctionWord} from '../fx/captions';

/** Callout text for a talk scene: the author's emphasis, else a number, else the whole sentence when it is short (a lone random word like "THROUGH" says nothing), else the longest content word. */
export function pickKeyword(narration: string, emphasis: string[]): string {
  if (emphasis[0]) return emphasis[0];
  const ws = narration.replace(/[.!?,;:"]/g, '').split(/\s+/).filter(Boolean);
  const num = ws.find(w => /\d/.test(w));
  if (num) return num;
  if (ws.length <= 5) return ws.join(' ');
  const content = ws.filter(w => !isFunctionWord(w));
  return [...(content.length ? content : ws)].sort((a, b) => b.length - a.length)[0] ?? '';
}
