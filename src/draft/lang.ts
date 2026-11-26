// Language support for the script drafter: prompt rules, Hungarian few-shot, stock-phrase list, number words and a deterministic closing line.
export const isHu = (lang?: string) => /^hu\b|^hu[-_]/i.test(lang ?? '');

export const LANG_RULES: Record<string, string> = {
  hu: `LANGUAGE: write EVERYTHING the viewer hears or reads in natural, spoken Hungarian: title, narration, labels, compare titles, list items, timeline text. JSON keys, scene types and emotion names stay English. In narration write numbers the Hungarian way: space as thousands separator (1 234 567), comma as decimal mark (3,5 százalék). The JSON "value" fields are plain numbers with a dot (3.5). Use "te" (informal), short sentences, no word-for-word English idioms.`,
};

export const HU_SHAPE_EXAMPLE = `{"title":"A bérlés nem kidobott pénz","scenes":[
 {"type":"title","emotion":"smug","narration":"A bérlés nem égeti a pénzt. A tulajdonnak is vannak számlái."},
 {"type":"talk","emotion":"explaining","narration":"A bérleti díj egy lakhelyet vesz neked, és nulla váratlan javítási számlát."},
 {"type":"big_number","emotion":"shocked","value":1,"prefix":"","suffix":"%","label":"az otthon árának tipikus éves fenntartási költsége","decimals":0,"narration":"A tulajdonosok évente nagyjából egy százalékot költenek az ár után csak a karbantartásra."},
 {"type":"compare","emotion":"thinking","left":{"title":"Bérlés","value":"kiszámítható"},"right":{"title":"Tulajdon","value":"meglepetések"},"narration":"Az egyik számla kiszámítható. A másik egy beázó tetővel érkezik."},
 {"type":"list","emotion":"explaining","items":["Számold ki a teljes költséget","Hasonlítsd a bérlethez","Legyen tartalékod"],"narration":"Szóval a döntés előtt számolj össze mindent."}]}`;

/** Stock Hungarian AI/marketing phrases: [pattern, replacement]. Unicode-aware (no \b: JS word boundaries are ASCII-only). */
export const HU_SLOP: [RegExp, string][] = [
  [/(?<![\p{L}])(?:a mai|ebben a) (?:gyorsan változó|digitális|modern) (?:világban|korban)\s*,?\s*/giu, ''],
  [/(?<![\p{L}])(?:merüljünk|ugorjunk) (?:el|bele)(?: (?:ebben|a témában))?(?![\p{L}])/giu, 'nézzük meg'],
  [/(?<![\p{L}])(?:nem titok|köztudott), hogy\s*/giu, ''],
  [/(?<![\p{L}])ahogy (?:mindannyian|mindenki) tudjuk\s*,?\s*/giu, ''],
  [/(?<![\p{L}])összefoglalva\s*,?\s*/giu, ''],
  [/(?<![\p{L}])végszóként\s*,?\s*/giu, ''],
  [/(?<![\p{L}])kapaszkodj meg\s*,?\s*/giu, ''],
  [/(?<![\p{L}])játékot? megváltoztató(?![\p{L}])/giu, 'nagy fordulat'],
  [/(?<![\p{L}])(?:íme|lássuk csak)\s*,?\s*/giu, ''],
  [/(?<![\p{L}])fontos (?:megjegyezni|tudni),? hogy\s*/giu, ''],
  [/(?<![\p{L}])mint (?:tudjuk|köztudott)\s*,?\s*/giu, ''],
  [/(?<![\p{L}])(?:képzeld el|képzeljük el),? hogy\s*/giu, ''],
  [/(?<![\p{L}])a (?:lényeg|helyzet) az(?:,)? hogy\s*/giu, ''],
  [/(?<![\p{L}])egyszóval\s*,?\s*/giu, ''],
  [/(?<![\p{L}])nincs több (?:teketória|vesztegetni való idő)\s*,?\s*/giu, ''],
];
/** Hungarian advice/guarantee wording, blocked like the English list. */
export const HU_BANNED = [/garant[áa]l/i, /kock[áa]zatmentes/i, /biztos nyeres[ée]g/i, /gyorsan meggazdagod/i, /biztos(?:an)? (?:vedd|add el|fektess)/i, /nem (?:veszíthetsz|vesztheted)/i, /pénzügyi tanácsadás/i];

export const HU_TENSION = /(?<![\p{L}])(de|azonban|csapda|hiba|probléma|kockázat|drága|rosszabb|csavar|meglepetés|mítosz|tévedés|valójában)(?![\p{L}])/iu;
export const HU_NUMBERISH = /\d|(?<![\p{L}])(százalék|dollár|forint|euró|ezer|millió|milliárd|száz|dupla|kétszer|fél)(?![\p{L}])/iu;
export const HU_PAYOFF = /(?<![\p{L}])(szóval|tehát|végül|összefoglalva|ne feledd|jegyezd meg|érdemes|emlékezz|tanuls\p{L}*|lényeg\p{L}*|legközelebb|kezd(?:d|j)\p{L}*|próbál(?:d|j)\p{L}*|ellenőrizd|nézd meg|nézz\p{L}*|számolj\p{L}*|hasonlítsd|kérdezd|olvasd|ne \p{L}+j)(?![\p{L}])/iu;

export const CLOSERS = {
  en: 'So next time, run the numbers on your own case first.', // fallback only: closeLoop writes a line that loops to the hook
  hu: 'A tanulság: nézd meg magad a számokat, mielőtt döntesz.',
};

// ---- Hungarian number words (egy, kettő, harmincöt, kétszázötven, ezer, millió ...) ----
const UNITS: Record<string, number> = {nulla: 0, egy: 1, kettő: 2, két: 2, három: 3, négy: 4, öt: 5, hat: 6, hét: 7, nyolc: 8, kilenc: 9};
const TENS: Record<string, number> = {tizen: 10, tíz: 10, huszon: 20, húsz: 20, harminc: 30, negyven: 40, ötven: 50, hatvan: 60, hetven: 70, nyolcvan: 80, kilencven: 90};
const ATOMS = [...Object.keys(TENS), ...Object.keys(UNITS)].sort((a, b) => b.length - a.length);
/** Value of one Hungarian number word, or null when the whole word is not a number. */
export function huWordValue(word: string): number | null {
  let w = word.toLowerCase(), total = 0, cur = 0, any = false;
  const scales: [string, number][] = [['milliárd', 1e9], ['millió', 1e6], ['ezer', 1e3]];
  while (w) {
    const sc = scales.find(([s]) => w.startsWith(s));
    if (sc) { total += (cur || 1) * sc[1]; cur = 0; w = w.slice(sc[0].length); any = true; continue; }
    if (w.startsWith('száz')) { cur = (cur || 1) * 100; w = w.slice(4); any = true; continue; }
    const a = ATOMS.find(x => w.startsWith(x));
    if (!a) return null;
    cur += TENS[a] ?? UNITS[a]; w = w.slice(a.length); any = true;
  }
  return any ? total + cur : null;
}
