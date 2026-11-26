export type SfxKind = 'pop' | 'whoosh' | 'tick' | 'ding' | 'chime' | 'coin' | 'click' | 'thud';
export type SfxCue = {t: number; kind: SfxKind; variant: number}; // t = seconds from scene start

export type HookKind = 'punch_in' | 'slow_open';
export type Hook = {kind: HookKind; atSec: number};

export type SceneDecision = {
  index: number;
  type: string;
  layout: string;
  charSide: 'left' | 'right' | 'center';
  pose: string;
  camera: string;
  transition: string;
  startSec: number;
  durSec: number;
  speechStart: number; // seconds from scene start where narration begins
  speechEnd: number;
  punchIns: {t: number; scale: number; dur: number}[];
  sfx: SfxCue[];
  /** Optional (absent in old decisions.json): opening treatment, first scene only. */
  hook?: Hook;
  /** Element appear times, seconds from scene start. list: per item; compare: [left,right]; chart: [drawStart,drawEnd]; big_number: [countStart,countEnd] */
  elements: number[];
};

export type EpisodeDecisions = {
  episodeId: string;
  seed: number;
  accent: string;
  background: 'plain' | 'grid' | 'dots' | 'vignette';
  captionStyle: 'bar' | 'pill' | 'outline';
  intro: 'ink_draw' | 'pop' | 'slide';
  music: {mood: string; track: string | null};
  totalSec: number;
  /** Optional (absent in old decisions.json). atSec is seconds from episode start. */
  hook?: Hook;
  /** Optional: channel caption preferences (position, size, highlight). */
  captions?: {style?: 'bar' | 'pill' | 'outline'; position: 'bottom' | 'middle' | 'top'; size?: number; highlight: 'accent' | 'underline' | 'none'};
  scenes: SceneDecision[];
};

export type HistoryEntry = {
  id: string;
  channel?: string; // missing = 'default'
  accent: string;
  background: string;
  captionStyle: string;
  intro: string;
  music: string;
  scenes: {type: string; layout: string; camera: string; transition: string; pose: string}[];
};
export type History = {episodes: HistoryEntry[]};
