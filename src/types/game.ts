export type GameMode = 'count-cruise' | 'rally-math';

export type GameScreen =
  | 'title'
  | 'garage'
  | 'countdown'
  | 'playing'
  | 'pitstop'
  | 'podium';

export type NumberblockId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface BlockOffset {
  x: number;
  y: number;
  z: number;
  color: string;
  borderColor?: string;
  hasDiceDots?: number;
}

export interface NumberblockSpec {
  id: NumberblockId;
  name: string;
  primaryColor: string;
  accentColor: string;
  kartColor: string;
  kartStripeColor: string;
  catchphrase: string;
  rallyLine: string;
  columns: number;
  rows: number;
  blocks: BlockOffset[];
  accessory:
    | 'none'
    | 'glasses'
    | 'jester-hat'
    | 'square-brows'
    | 'star-eye'
    | 'dice'
    | 'rainbow'
    | 'octo-mask'
    | 'grey-square'
    | 'rocket-stars';
  wheelCountLabel: string;
  baseSpeed: number;
}

export interface ParentSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  voiceEnabled: boolean;
  autoSteerAssist: boolean;
  maxCountTarget: 5 | 10;
  pitStopQuizzes: boolean;
}

export interface MathEventPayload {
  left: number;
  operator: '+' | '-';
  right: number;
  result: number;
  title: string;
  subtitle: string;
  voiceLine: string;
  color: string;
}

export interface PitStopQuestion {
  prompt: string;
  voicePrompt: string;
  visualType: 'count-blocks' | 'count-wheels' | 'equation';
  visualCount: number;
  leftNum?: number;
  operator?: '+' | '-';
  rightNum?: number;
  correctAnswer: number;
  choices: number[];
  accentColor: string;
}

export interface HudState {
  mode: GameMode;
  currentNumber: NumberblockId;
  countProgress: number;
  countTarget: number;
  blobsCollected: number;
  racePosition: number;
  totalRacers: number;
  trackProgress: number; // 0 to 1
  speedKmh: number;
  boostCharge: number; // 0 to 1
  starsEarned: number;
  commentary: string;
}

export interface PodiumResult {
  mode: GameMode;
  finisherNumber: NumberblockId;
  startingNumber: NumberblockId;
  place: number;
  starsEarned: number;
  blobsCollected: number;
  equationsSolved: number;
  highestCount: number;
  isOneSurpriseWin: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  boost: boolean;
  steerAnalog: number; // -1 to 1
}

export type TrackFeatureType =
  | 'start'
  | 'count-gate'
  | 'rock'
  | 'double-dipper'
  | 'merge-gate'
  | 'ramp'
  | 'mud-puddle'
  | 'blob-cluster'
  | 'finish';

export interface TrackFeature {
  id: string;
  type: TrackFeatureType;
  z: number; // progress distance along track (0 to trackLength)
  laneX: number; // lateral position (-1 to 1 normalized)
  value?: number; // number for gate, subtract amount for rock/dip, add amount for merge
  label?: string;
  triggered: boolean;
}
