/** Per-language defaults for voice, news and prompts. Channel.language is a code like "en", "hu", "de" (region suffix ignored). */
export type LangInfo = {name: string; say: string; espeak: string; sayRate?: number; espeakSpeed: number; news: {hl: string; gl: string; ceid: string}; seeds: Record<'finance' | 'tech' | 'history', string[]>};

export const LANGS: Record<string, LangInfo> = {
  en: {name: 'English', say: 'Samantha', espeak: 'en-us', espeakSpeed: 155, news: {hl: 'en-US', gl: 'US', ceid: 'US:en'}, seeds: {finance: ['inflation savings rates', 'credit score debt', 'index fund retirement'], tech: ['how it works technology', 'chip semiconductor', 'cybersecurity breach explained'], history: ['archaeology discovery', 'historians new evidence', 'anniversary history']}},
  hu: {name: 'Hungarian', say: 'Tünde', espeak: 'hu', sayRate: 160, espeakSpeed: 145, news: {hl: 'hu', gl: 'HU', ceid: 'HU:hu'}, seeds: {finance: ['infláció megtakarítás kamat', 'hitel adósság törlesztés', 'nyugdíj befektetés'], tech: ['hogyan működik technológia', 'mesterséges intelligencia', 'kiberbiztonság'], history: ['régészet felfedezés', 'történészek új bizonyíték', 'évforduló történelem']}},
  de: {name: 'German', say: 'Anna', espeak: 'de', sayRate: 165, espeakSpeed: 150, news: {hl: 'de', gl: 'DE', ceid: 'DE:de'}, seeds: {finance: ['Inflation Sparzinsen', 'Kredit Schulden', 'Altersvorsorge ETF'], tech: ['wie funktioniert Technik', 'Chips Halbleiter', 'Cybersicherheit'], history: ['Archäologie Entdeckung', 'Historiker neue Belege', 'Jahrestag Geschichte']}},
  es: {name: 'Spanish', say: 'Monica', espeak: 'es', sayRate: 170, espeakSpeed: 155, news: {hl: 'es', gl: 'ES', ceid: 'ES:es'}, seeds: {finance: ['inflación ahorro', 'deuda crédito', 'jubilación inversión'], tech: ['cómo funciona tecnología', 'chips semiconductores', 'ciberseguridad'], history: ['arqueología descubrimiento', 'historiadores nuevas pruebas', 'aniversario historia']}},
};

/** Base language code ("hu-HU" -> "hu"); unknown or empty -> "en". */
export const langCode = (l?: string) => { const c = (l ?? 'en').toLowerCase().split(/[-_]/)[0]; return c || 'en'; };
export const langInfo = (l?: string): LangInfo => LANGS[langCode(l)] ?? LANGS.en;
