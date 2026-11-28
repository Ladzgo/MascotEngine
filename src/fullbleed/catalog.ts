/**
 * Vocabulary of the composable shot system (browser- and node-safe, no imports). A shot = setting x subject x action x camera x layout.
 * The director/drafter may emit `shot: {subject, action, setting, camera, layout, label, number, mood}` using exactly these names;
 * unknown names are ignored (inference takes over). A test keeps SUBJECTS in sync with the renderer.
 */
export const SUBJECTS = [
  // money and accounts
  'coin_stacks', 'cash', 'wallet', 'piggy', 'jar_fill', 'coin_spin', 'vault', 'safe', 'bank', 'atm', 'card', 'card_swipe', 'paycheck', 'bills', 'receipts', 'doc', 'tax_form', 'clipboard', 'calculator',
  // rates, markets, growth
  'percent', 'gauge', 'thermometer', 'ticker', 'bars3d', 'bars_arrow', 'stacked_bars', 'line_chart', 'donut', 'pie', 'arrow_up', 'arrow_down', 'rocket', 'ladder', 'tree', 'snowball', 'trophy', 'scale',
  // debt and risk metaphors
  'debt_counter', 'anchor', 'hole', 'flame', 'dice', 'umbrella', 'shield', 'lock', 'hourglass',
  // time and place
  'calendar', 'clock', 'map_route', 'pin', 'skyline', 'house', 'keys', 'car', 'gas_pump',
  // everyday spending
  'shopping_bag', 'groceries', 'coffee', 'cart', 'pricetag', 'price_up', 'subscriptions', 'phone',
  // ideas and people
  'bulb', 'magnifier', 'gears', 'handshake', 'gradcap', 'people',
  // theme packs: sport, health, travel, tech, food, science (src/fullbleed/objects5.tsx)
  'shoe', 'dumbbell', 'stopwatch', 'medal', 'heart', 'apple', 'pill', 'drop', 'plane', 'globe', 'suitcase', 'mountain', 'laptop', 'chip', 'book', 'flask', 'atom', 'sprout', 'sun', 'burger', 'battery', 'brain', 'bed', 'moon', 'orbit',
  'person_atm', 'person_bills', 'person_celebrate', 'person_shocked', 'person_thinking', 'person_walking',
] as const;

export const ACTIONS = [
  'none', 'drop', 'rise', 'fall', 'grow', 'shrink', 'bounce', 'spin', 'roll', 'swipe', 'flip', 'shake', 'pulse', 'float', 'zoom_into', 'slide_in_left', 'slide_in_right', 'stack', 'split', 'merge',
  'cross_out', 'check', 'burn', 'melt', 'lock', 'unlock', 'compare_slide', 'wobble', 'pop_in', 'pan_across', 'tilt', 'orbit', 'blink', 'sink',
] as const;

export const SETTINGS = ['city', 'room', 'vault', 'abstract', 'sky', 'office', 'street', 'kitchen'] as const;
export const CAMERAS = ['push_in', 'pan_left', 'pan_right', 'orbit', 'tilt_down', 'pull_out'] as const;
export const LAYOUTS = ['hero', 'split', 'grid', 'kinetic', 'dataviz', 'broll', 'pip'] as const;
export const POSES = ['stand', 'stress', 'cheer', 'point', 'walk'] as const;
export const FACES = ['neutral', 'worried', 'happy', 'shock'] as const;
export const MOODS = ['calm', 'tense', 'upbeat', 'serious'] as const;

export type Subject = (typeof SUBJECTS)[number];
export type Action = (typeof ACTIONS)[number];
export type Setting = (typeof SETTINGS)[number];
export type Camera = (typeof CAMERAS)[number];
export type Layout = (typeof LAYOUTS)[number];

/** Subjects grouped by what they stand for: the variety engine swaps within a group before it would ever repeat a picture. */
export const GROUPS: Record<string, string[]> = {
  money: ['coin_stacks', 'cash', 'coin_spin', 'jar_fill', 'wallet', 'piggy', 'paycheck'],
  rate: ['gauge', 'percent', 'thermometer', 'price_up'],
  time: ['calendar', 'clock', 'hourglass'],
  debt: ['debt_counter', 'anchor', 'hole', 'bills', 'person_bills', 'receipts'],
  growth: ['bars_arrow', 'bars3d', 'line_chart', 'tree', 'rocket', 'arrow_up', 'snowball', 'ladder', 'trophy'],
  spending: ['shopping_bag', 'groceries', 'coffee', 'gas_pump', 'cart', 'pricetag', 'subscriptions', 'card_swipe'],
  card: ['card', 'card_swipe', 'atm', 'person_atm'],
  safety: ['shield', 'safe', 'vault', 'lock', 'umbrella'],
  place: ['house', 'bank', 'skyline', 'car', 'map_route', 'keys', 'pin'],
  docs: ['doc', 'tax_form', 'clipboard', 'calculator', 'receipts', 'paycheck'],
  compare: ['scale', 'donut', 'pie', 'stacked_bars'],
  fall: ['arrow_down', 'hole', 'anchor', 'flame', 'person_shocked'],
  people: ['person_celebrate', 'person_thinking', 'person_walking', 'people', 'person_shocked'],
  sport: ['shoe', 'dumbbell', 'stopwatch', 'medal', 'trophy', 'person_walking', 'mountain'],
  health: ['heart', 'apple', 'pill', 'drop', 'thermometer', 'sprout'],
  travel: ['plane', 'globe', 'suitcase', 'mountain', 'map_route', 'pin', 'sun'],
  tech: ['laptop', 'chip', 'phone', 'battery', 'gears', 'bulb'],
  sleep: ['bed', 'moon', 'brain', 'clock', 'book'],
  food: ['burger', 'apple', 'groceries', 'coffee', 'drop'],
  science: ['flask', 'atom', 'brain', 'sprout', 'book', 'globe', 'sun', 'gradcap'],
  space: ['orbit', 'moon', 'globe', 'sun', 'rocket'],
  ideas: ['bulb', 'magnifier', 'gears', 'handshake', 'gradcap', 'dice', 'ticker'],
};
