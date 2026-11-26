import type {Scene, VisualKind} from '../schema';

/** Narration keyword -> illustration. `low` kinds are generic fillers: they only rank after every specific hit. */
const RULES: {kind: VisualKind; re: RegExp; low?: boolean}[] = [
  {kind: 'credit_card', re: /\b(credit cards?|cards?|swipe[sd]?|minimum payments?|balances?)\b/i},
  {kind: 'piggy', re: /\b(piggy|nest egg|savers?)\b/i},
  {kind: 'jar', re: /\b(jar|saving|savings|saved?)\b/i},
  {kind: 'house', re: /\b(house|houses|home|homes|mortgages?|rent|renting|property|down payment|housing)\b/i},
  {kind: 'car', re: /\b(cars?|autos?|vehicles?|driving|drive|lease|leasing|dealer|dealership)\b/i},
  {kind: 'bank', re: /\b(banks?|deposits?|lenders?|lending|loans?|borrow\w*)\b/i},
  {kind: 'percent', re: /(\bpercent\b|%|\b(rates?|apr|interest|yield|fees?|tax|taxes)\b)/i},
  {kind: 'chart_up', re: /\b(invest\w*|stocks?|market|returns?|compound\w*|index|funds?|portfolio|profits?|wealth)\b/i},
  {kind: 'chart_down', re: /\b(crash\w*|recession|losses|slump|downturn|bear|trap)\b/i},
  {kind: 'document', re: /\b(contracts?|agreements?|terms|sign\w*|paperwork|policy|policies|statements?|fine print)\b/i},
  {kind: 'receipt', re: /\b(receipts?|bills?|costs?|price[sd]?|pay|paid|paying|spend\w*|purchase\w*|buy|bought|expenses?|total)\b/i},
  {kind: 'calendar', re: /\b(months?|monthly|weeks?|days?|due|dates?|budget\w*|schedule[sd]?|payments?|years?)\b/i},
  {kind: 'clock', re: /\b(time|hours?|minutes?|early|late|decades?|long|soon|fast)\b/i},
  {kind: 'hourglass', re: /\b(wait\w*|patien\w*|eventually|slowly|deadline|running out|over time)\b/i},
  {kind: 'shield', re: /\b(safe\w*|protect\w*|insur\w*|emergency|secure\w*|guard\w*)\b/i},
  {kind: 'lock', re: /\b(lock\w*|stuck|password|private|fixed|commit\w*)\b/i},
  {kind: 'magnifier', re: /\b(look\w*|find|read|hidden|search\w*|spot|inspect\w*|catch|closer)\b/i},
  {kind: 'arrow_up', re: /\b(rise[sn]?|rising|increas\w*|grow\w*|higher|gains?|climb\w*|soar\w*|doubl\w*|more)\b/i},
  {kind: 'arrow_down', re: /\b(fall\w*|drops?|dropp\w*|lose|loses|losing|lower|less|decreas\w*|shrink\w*|eroded?|erodes|inflation|declin\w*|down)\b/i},
  {kind: 'scale', re: /\b(compar\w*|versus|vs|better|worse|trade-?offs?|weigh\w*|choice|choose|either|fair)\b/i},
  {kind: 'phone', re: /\b(apps?|phones?|online|digital|mobile|text|notification|automat\w*)\b/i},
  {kind: 'wallet', re: /\b(wallets?|income|salary|paychecks?|earn\w*|afford\w*|pocket)\b/i},
  {kind: 'cash', re: /\b(cash|dollars?|money|bucks)\b|\$/i},
  {kind: 'coins', re: /\b(coins?|change|cents?|pennies)\b/i},
  {kind: 'target', re: /\b(goals?|aim|target|plan|focus|strategy|point)\b/i},
  {kind: 'warning', re: /\b(danger\w*|warning|careful|scam\w*|mistakes?|risk\w*|beware|never|avoid|penalt\w*|worst)\b/i, low: true},
  {kind: 'check', re: /\b(right|correct|done|win|works?|good|solution|ready|easy|best|simple)\b/i, low: true},
  {kind: 'bulb', re: /\b(ideas?|tips?|tricks?|secrets?|truth|myths?|smart|realize|learn\w*|actually)\b/i, low: true},
  {kind: 'people', re: /\b(people|everyone|most|famil\w+|friends?|customers?|investors?|folks|someone|they|you|we)\b/i, low: true},
  {kind: 'question', re: /\b(why|how|what|wonder\w*|question\w*|confus\w*|mystery)\b/i, low: true},
];

const EMOTION_FALLBACK: Record<string, VisualKind> = {worried: 'warning', sweating: 'warning', shocked: 'warning', angry: 'warning', confused: 'question', thinking: 'question', happy: 'check', excited: 'check', smug: 'check', explaining: 'bulb', sad: 'arrow_down', neutral: 'bulb'};

/** Hero + up to two supporting illustrations for a scene: the explicit `visual`, else ranked narration keywords, else an emotion-based default. */
export function pickVisuals(scene: Pick<Scene, 'narration' | 'emphasis' | 'emotion' | 'visual'>, extra = ''): {hero: VisualKind; support: VisualKind[]} {
  const text = `${scene.emphasis.join(' ')} ${extra} ${scene.narration}`;
  const hits = RULES.map((r, n) => ({k: r.kind, low: !!r.low, i: text.search(r.re), n})).filter(h => h.i >= 0).sort((a, b) => +a.low - +b.low || a.i - b.i || a.n - b.n).map(h => h.k);
  const all = [...new Set([...(scene.visual ? [scene.visual.kind] : []), ...hits])];
  if (!all.length) all.push(EMOTION_FALLBACK[scene.emotion] ?? 'bulb');
  return {hero: all[0], support: all.slice(1, 3)};
}
