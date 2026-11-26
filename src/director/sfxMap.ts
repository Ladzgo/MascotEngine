// Sound that belongs to what is drawn: the beat's subject and action pick a cue kind (coins clink, taps click, falls thud, wins ding).
// Restrained on purpose: at most one such cue per beat and only every other beat (the caller enforces the spacing).
import type {SfxKind} from './types.js';

const COIN = new Set(['coin_stacks', 'cash', 'coin_spin', 'bills', 'paycheck', 'jar_fill', 'wallet', 'piggy', 'safe', 'vault']);
const CLICK = new Set(['card_swipe', 'atm', 'card', 'keys', 'calculator', 'clipboard', 'phone', 'laptop', 'subscriptions', 'tax_form', 'person_atm']);
const THUD = new Set(['hole', 'anchor', 'debt_counter', 'person_shocked', 'arrow_down', 'flame']);
const WIN = new Set(['trophy', 'medal', 'person_celebrate', 'rocket', 'sprout', 'sun']);
const FALLS = new Set(['sink', 'fall', 'drop', 'melt', 'burn', 'shrink']);

export function sfxForShot(shot: {subject?: string; action?: string} | undefined, type: string): SfxKind | null {
  const s = shot?.subject ?? '', a = shot?.action ?? '';
  if (type === 'big_number' || type === 'stats' || type === 'chart' || type === 'list') return null; // those types already have their own cues
  if (WIN.has(s) || a === 'check') return 'ding';
  if (THUD.has(s) || (FALLS.has(a) && !COIN.has(s))) return 'thud';
  if (COIN.has(s)) return 'coin';
  if (CLICK.has(s)) return 'click';
  return null;
}
