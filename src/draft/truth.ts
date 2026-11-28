// Deterministic truth gates (no LLM): lines whose arithmetic is wrong or unstated, pronouns with nobody to point at,
// and "N times as fast" claims that no sourced fact backs are dropped before the storyboard sees the script.
import type {Episode} from '../schema.js';
import {numeralize} from '../pipeline/speech.js';
import {namesPerson} from './story.js';

type Sc = Episode['scenes'][number];
const SCALE: Record<string, number> = {thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, k: 1e3};
const NUM = String.raw`[$€£]?\d[\d,]*(?:\.\d+)?%?(?:\s*(?:thousand|million|billion|trillion|k)\b)?`;
/** Every number in the line, in order ("$1,825" -> 1825, "2.5 million" -> 2500000, "17%" -> 17). Digits only: run numeralize first. */
export function numbersIn(t: string): number[] {
  return [...t.matchAll(new RegExp(NUM, 'gi'))].map(m => toNum(m[0])).filter(Number.isFinite);
}
function toNum(raw: string): number {
  const m = raw.toLowerCase().match(/([\d,]+(?:\.\d+)?)%?\s*(thousand|million|billion|trillion|k)?/);
  return m ? Number(m[1].replace(/,/g, '')) * (m[2] ? SCALE[m[2]] : 1) : NaN;
}
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.02 * Math.abs(b), 0.01); // relative: an absolute 0.5 made 1.5 "near" 2

const OP = new RegExp(String.raw`(${NUM})(?:\s+[a-z']+){0,3},?\s*(times|x|×|multiplied by|divided by|plus|minus|\*)\s*(${NUM})`, 'i');
/** A "27.3 times 3600" line: the result must be said in the same line (after =, is, equals, that's, makes) or as the first number of the next line. Returns null when the line has no arithmetic. */
export function arithmeticOk(line: string, next = ''): boolean | null {
  const m = line.match(OP);
  if (!m) return null;
  const a = toNum(m[1]), b = toNum(m[3]), op = m[2].toLowerCase();
  const v = /times|x|×|multiplied|\*/.test(op) ? a * b : /divided/.test(op) ? a / b : op === 'plus' ? a + b : a - b;
  const after = line.slice((m.index ?? 0) + m[0].length), claimed = numbersIn(after.match(/(?:=|\bis\b|\bequals\b|\bthat'?s\b|\bmakes\b|\bgives\b)(.*)/i)?.[1] ?? '');
  const nextN = numbersIn(next);
  // "times 52 weeks" without a result is a half-said sum: only a stated, correct result survives
  return claimed.some(c => near(c, v)) || (!claimed.length && nextN.length > 0 && near(nextN[0], v));
}

const PRON = /^\s*(she|he|her|his|him)\b/i, PERSON_WORD = /\b(woman|man|girl|boy|mom|mum|dad|mother|father|wife|husband|friend|neighbou?r|sister|brother|grandma|grandpa|customer|driver|teacher|nurse|doctor)\b/i;
/** A beat that opens on "She/He/His..." needs a named (or described) person in an earlier beat. */
export const danglingPronoun = (line: string, earlier: string[]) => PRON.test(line) && !earlier.some(e => namesPerson(e) || PERSON_WORD.test(e));

const RATIO = new RegExp(String.raw`(${NUM}|twice|three times|half)\s*(?:times|x)?\s*(?:as\s+\w+|more|less|faster|slower|bigger|smaller|higher|lower|longer|shorter|stronger|cheaper|brighter|heavier)\b`, 'i');
/** "1.5 times as fast", "3x more": the factor must be a sourced number (facts.json / outline), else the claim is invented. Returns null when there is no ratio claim. */
export function ratioOk(line: string, allowed: number[], said: number[] = allowed): boolean | null {
  const m = line.match(RATIO);
  if (!m || !/times|x\b|twice|half/i.test(m[0])) return null;
  const f = /twice/i.test(m[1]) ? 2 : /three times/i.test(m[1]) ? 3 : /half/i.test(m[1]) ? 0.5 : toNum(m[1]);
  // a factor computed from two sourced numbers counts only when the script says both (Mercury's 3:2 resonance made "the Moon spins 1.5 times as fast" look sourced, sc-moon2)
  const src = allowed.filter(n => said.some(s => near(s, n)));
  return allowed.some(n => near(n, f)) || src.some(a => src.some(b => b && a !== b && Math.abs(a / b - f) <= 0.05 * f));
}

const U = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** numeralize plus the small counts it leaves as words ("times fifty-two weeks" must be checkable). */
export const digits = (t: string) => numeralize(t).replace(new RegExp(`\\b(${T.slice(2).join('|')})(?:[\\s-](${U.slice(1, 10).join('|')}))?\\b|\\b(${U.join('|')})\\b`, 'gi'), (_m, t1?: string, u1?: string, u2?: string) => String(t1 ? T.indexOf(t1.toLowerCase()) * 10 + (u1 ? U.indexOf(u1.toLowerCase()) : 0) : U.indexOf(u2!.toLowerCase())));

/** Drop middle beats that fail a gate (hook and last line stay); returns the reasons for the log. */
export function truthGates(ep: Episode, allowed: number[]): {ep: Episode; dropped: string[]} {
  const sc = ep.scenes, dropped: string[] = [], keep: Sc[] = [], said = sc.flatMap(s => numbersIn(digits(s.narration).replace(RATIO, '')));
  sc.forEach((s, i) => {
    const line = digits(s.narration), next = digits(sc[i + 1]?.narration ?? '');
    const mid = i > 0 && i < sc.length - 1;
    const why = !mid ? '' : arithmeticOk(line, next) === false ? 'arithmetic' : danglingPronoun(line, keep.map(k => k.narration)) ? 'pronoun with no person' : ratioOk(line, allowed, said) === false ? 'unsourced ratio' : '';
    if (why) dropped.push(`${why}: "${s.narration}"`); else keep.push(s);
  });
  return {ep: {...ep, scenes: keep as Episode['scenes']}, dropped};
}
