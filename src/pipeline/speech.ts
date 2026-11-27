// Spoken-form text for neural TTS: numbers, currency, percent and abbreviations become words (per language), then
// the text is cut into clauses with a speed and a pause each, so the read has phrasing instead of one flat stream.

const EN_U = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numEn(n: number): string {
  if (n < 0) return `minus ${numEn(-n)}`;
  if (n < 20) return EN_U[n];
  if (n < 100) return EN_T[Math.floor(n / 10)] + (n % 10 ? ` ${EN_U[n % 10]}` : '');
  if (n < 1000) return `${EN_U[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numEn(n % 100)}` : ''}`;
  for (const [v, w] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const)
    if (n >= v) return `${numEn(Math.floor(n / v))} ${w}${n % v ? ` ${numEn(n % v)}` : ''}`;
  return String(n);
}
const HU_U = ['nulla', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
const HU_T1 = ['', 'tizen', 'huszon', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'], HU_T0 = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
export function numHu(n: number, lead = false): string { // lead: before a scale word, 2 is "két"
  if (n < 0) return `mínusz ${numHu(-n)}`;
  if (n < 10) return n === 2 && lead ? 'két' : HU_U[n];
  if (n < 100) return n % 10 ? HU_T1[Math.floor(n / 10)] + numHu(n % 10, lead) : HU_T0[n / 10];
  if (n < 1000) return `${Math.floor(n / 100) > 1 ? numHu(Math.floor(n / 100), true) : ''}száz${n % 100 ? numHu(n % 100) : ''}`;
  for (const [v, w] of [[1e9, 'milliárd'], [1e6, 'millió'], [1e3, 'ezer']] as const)
    if (n >= v) { const q = Math.floor(n / v), r = n % v; return `${q === 1 && v === 1e3 ? '' : numHu(q, true)}${w}${r ? (n > 2000 ? '-' : '') + numHu(r) : ''}`; }
  return String(n);
}

const CUR: Record<string, {en: [string, string]; hu: string}> = {'$': {en: ['dollar', 'dollars'], hu: 'dollár'}, '€': {en: ['euro', 'euros'], hu: 'euró'}, '£': {en: ['pound', 'pounds'], hu: 'font'}};
const SCALE_EN: Record<string, string> = {k: 'thousand', m: 'million', mm: 'million', b: 'billion', bn: 'billion'};
const ABBR_EN: [RegExp, string][] = [[/\bvs\.?(?=\s)/gi, 'versus'], [/\be\.g\./gi, 'for example'], [/\bi\.e\./gi, 'that is'], [/\betc\./gi, 'et cetera'], [/\bAPR\b/g, 'A P R'], [/\bAPY\b/g, 'A P Y'], [/\bETFs\b/g, 'E T Fs'], [/\bETF\b/g, 'E T F'], [/\bCPI\b/g, 'C P I'], [/\bGDP\b/g, 'G D P'], [/\bIRA\b/g, 'I R A'], [/\bUS\b/g, 'U S'], [/&/g, 'and']];
const ABBR_HU: [RegExp, string][] = [[/\bkb\./gi, 'körülbelül'], [/\bpl\./gi, 'például'], [/\bstb\./gi, 'és a többi'], [/\bFt\b/g, 'forint'], [/&/g, 'és']];

/** One number token ("1,000", "3.5", "1 000") to words; decimals are read digit by digit after "point"/"egész". */
function readNumber(raw: string, lang: string): string {
  const hu = lang === 'hu', clean = raw.replace(hu ? /\s/g : /,/g, '').replace(hu ? ',' : '', hu ? '.' : '');
  const [i, f] = clean.split('.');
  const whole = hu ? numHu(Number(i)) : numEn(Number(i));
  if (!f) return whole;
  return `${whole} ${hu ? 'egész' : 'point'} ${f.split('').map(d => (hu ? HU_U[+d] : EN_U[+d])).join(' ')}`;
}
const yearEn = (y: number) => (y >= 2000 && y < 2010 ? numEn(y) : `${numEn(Math.floor(y / 100))} ${y % 100 ? (y % 100 < 10 ? 'oh ' : '') + numEn(y % 100) : 'hundred'}`);

/** Expand digits, currency, percent and abbreviations into the words a person would say. Text without digits is returned nearly untouched. */
export function spoken(text: string, lang = 'en'): string {
  const hu = lang === 'hu';
  let t = text.replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
  for (const [re, w] of hu ? ABBR_HU : ABBR_EN) t = t.replace(re, w);
  const NUM = hu ? '\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?' : '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
  // currency symbol before: $1,000  $1.5 million  $2k
  t = t.replace(new RegExp(`([$€£])\\s?(${NUM})(?:\\s?(k|m|mm|bn|b|thousand|million|billion)\\b)?`, 'gi'), (_, c: string, n: string, sc?: string) => {
    const words = readNumber(n, lang), scale = sc ? (SCALE_EN[sc.toLowerCase()] ?? sc.toLowerCase()) : '';
    const one = !sc && Number(n.replace(/,/g, '')) === 1;
    return hu ? `${words}${scale ? ` ${scale}` : ''} ${CUR[c].hu}` : `${words}${scale ? ` ${scale}` : ''} ${one ? CUR[c].en[0] : CUR[c].en[1]}`;
  });
  t = t.replace(new RegExp(`(${NUM})\\s?%`, 'g'), (_, n: string) => `${readNumber(n, lang)} ${hu ? 'százalék' : 'percent'}`);
  t = t.replace(/\b(1[5-9]\d\d|20[1-9]\d)\b(?!\s?(?:percent|dollars|%))/g, (y: string) => (hu ? numHu(+y) : yearEn(+y))); // years
  t = t.replace(new RegExp(`(${NUM})(?:\\s?(k)\\b)?`, 'g'), (_, n: string, k?: string) => `${readNumber(n, lang)}${k ? (hu ? ' ezer' : ' thousand') : ''}`);
  return t.replace(/\s+([.,!?])/g, '$1').replace(/\s+/g, ' ').trim();
}

export type Segment = {text: string; speed: number; pauseMs: number};
const PAUSE: Record<string, number> = {'.': 280, '?': 340, '!': 280, ';': 200, ':': 200, ',': 120, '—': 220, '…': 400};
/** Tiny deterministic jitter so repeated runs sound the same but sentences differ from each other. */
const jit = (seed: number, i: number) => { const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Cut narration into clauses (sentence ends, commas in long sentences) with a speed (0.83-0.94, numbers 0.78-0.80) and a pause after each. */
export function segmentize(text: string, o: {lang?: string; seed?: number; emphasis?: string[]} = {}): Segment[] {
  const seed = o.seed ?? 1, out: Segment[] = [];
  const sents = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+(?:\.{3}|[.!?…])?["')]*|[^.!?…]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  sents.forEach((s, si) => {
    const parts = s.split(/(?<=[,;:])\s+|\s+(?:—|–|-)\s+/).reduce<string[]>((a, p) => { if (a.length && a[a.length - 1].split(' ').length < 4) a[a.length - 1] += ` ${p}`; else a.push(p); return a; }, []);
    parts.forEach((p, pi) => {
      const last = pi === parts.length - 1, end = p.trim().slice(-1);
      let speed = 0.85 + 0.08 * jit(seed, si * 7 + pi); // kokoro at 1.0 talks ~176 wpm; 0.89-0.98 still read Short beats at 173 wpm (zzb-h3); the references sit at 150-170
      if (o.emphasis?.some(e => e && p.toLowerCase().includes(e.toLowerCase()))) speed -= 0.03; // linger on the stressed phrase
      if (last && end === '?') speed += 0.02;
      // spelled-out amounts are many short words that the voice rushes ("one thousand eight hundred twenty five"): a narrator slows down on numbers
      const numeric = (p.match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent)\b/gi) ?? []).length >= 3;
      if (numeric) speed = Math.min(speed, 0.87) - 0.07;
      const base = last ? (si === sents.length - 1 ? 0 : (PAUSE[end] ?? 280)) : (PAUSE[end] ?? 120);
      const pauseMs = base ? Math.max(40, Math.round(base + (jit(seed, si * 13 + pi + 50) * 2 - 1) * 60)) : 0;
      out.push({text: p.replace(/[—–]/g, ',').trim(), speed: Math.round(Math.min(0.94, Math.max(numeric ? 0.78 : 0.83, speed)) * 1000) / 1000, pauseMs});
    });
  });
  return out;
}
