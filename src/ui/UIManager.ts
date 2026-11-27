import { FamilyVoiceStore } from '../audio/FamilyVoiceStore';
import {
  ALL_NUMBERBLOCK_IDS,
  NUMBERBLOCK_SPECS,
  NUMBER_WORDS,
} from '../data/numberblocks';
import { FAMILY_VOICE_SLOTS, FamilyVoiceSlot } from '../data/voiceManifest';
import {
  CarSpeedSetting,
  GameMode,
  GameScreen,
  HudState,
  InputState,
  MathEventPayload,
  NumberblockId,
  ParentSettings,
  PitStopQuestion,
  PodiumResult,
  RaceLengthSetting,
} from '../types/game';

export interface UIHandlers {
  onSelectMode: (mode: GameMode) => void;
  onOpenGarage: () => void;
  onSelectRacer: (id: NumberblockId) => void;
  onCountRacerBlocks: (id: NumberblockId) => void;
  onStartRace: () => void;
  onBackToTitle: () => void;
  onPlayAgain: () => void;
  onPitStopAnswer: (choice: number) => void;
  onPodiumTapNumber: (id: NumberblockId) => void;
  onSettingsChange: (settings: ParentSettings) => void;
  onFamilyVoiceChanged?: () => void;
  onTouchInput: (patch: Partial<InputState>) => void;
  onPauseToggle: () => void;
}

const TITLE_LETTER_COLORS = [
  '#E53935',
  '#FB8C00',
  '#FDD835',
  '#43A047',
  '#29B6F6',
  '#7E57C2',
  '#EC407A',
  '#E53935',
  '#FB8C00',
  '#43A047',
  '#29B6F6',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createSvgIcon(
  viewBox: string,
  paths: Array<{ tag: 'path' | 'circle' | 'rect' | 'polygon'; attrs: Record<string, string> }>
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const item of paths) {
    const shape = document.createElementNS(SVG_NS, item.tag);
    for (const [k, v] of Object.entries(item.attrs)) {
      shape.setAttribute(k, v);
    }
    svg.appendChild(shape);
  }
  return svg;
}

function createGearIcon(): SVGSVGElement {
  return createSvgIcon('0 0 24 24', [
    {
      tag: 'path',
      attrs: {
        d: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
        stroke: 'currentColor',
        'stroke-width': '2.3',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
  ]);
}

function createHomeIcon(): SVGSVGElement {
  return createSvgIcon('0 0 24 24', [
    {
      tag: 'path',
      attrs: {
        d: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z',
        stroke: 'currentColor',
        'stroke-width': '2.3',
        'stroke-linejoin': 'round',
      },
    },
  ]);
}

function createArrowIcon(direction: 'left' | 'right'): SVGSVGElement {
  return createSvgIcon('0 0 24 24', [
    {
      tag: 'path',
      attrs: {
        d:
          direction === 'left'
            ? 'M15.5 4.5 8 12l7.5 7.5'
            : 'M8.5 4.5 16 12l-7.5 7.5',
        stroke: 'currentColor',
        'stroke-width': '3.4',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
  ]);
}

function createStarIcon(className: string): SVGSVGElement {
  const svg = createSvgIcon('0 0 24 24', [
    {
      tag: 'path',
      attrs: {
        d: 'M12 2.4 14.95 8.38 21.55 9.34 16.77 14 17.9 20.57 12 17.47 6.1 20.57 7.23 14 2.45 9.34 9.05 8.38 12 2.4Z',
        fill: '#FFD54F',
        stroke: '#E65100',
        'stroke-width': '1.6',
        'stroke-linejoin': 'round',
      },
    },
  ]);
  svg.setAttribute('class', className);
  return svg;
}

function createWheelSvg(): SVGSVGElement {
  return createSvgIcon('0 0 48 48', [
    {
      tag: 'circle',
      attrs: { cx: '24', cy: '24', r: '20', fill: '#263238', stroke: '#ffffff', 'stroke-width': '3' },
    },
    {
      tag: 'circle',
      attrs: { cx: '24', cy: '24', r: '11', fill: '#cfd8dc', stroke: '#90a4ae', 'stroke-width': '2' },
    },
    {
      tag: 'circle',
      attrs: { cx: '24', cy: '24', r: '4.5', fill: '#ffb300' },
    },
  ]);
}

function createCloseIcon(): SVGSVGElement {
  return createSvgIcon('0 0 24 24', [
    {
      tag: 'path',
      attrs: {
        d: 'M6 6 18 18M18 6 6 18',
        stroke: 'currentColor',
        'stroke-width': '2.8',
        'stroke-linecap': 'round',
      },
    },
  ]);
}

function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function getReadableBadgeTextColor(hex: string): string {
  const normalized = hex.toLowerCase();
  if (normalized === '#ffffff' || normalized === '#fdd835') {
    return '#1b2a4a';
  }
  return '#ffffff';
}

function renderMiniGrid(container: HTMLElement, id: NumberblockId): void {
  const spec = NUMBERBLOCK_SPECS[id];
  container.replaceChildren();
  container.style.gridTemplateColumns = `repeat(${spec.columns}, 10px)`;

  // Render rows top-to-bottom so visual silhouette matches standing Numberblock
  const byRow = new Map<number, typeof spec.blocks>();
  for (const b of spec.blocks) {
    const arr = byRow.get(b.y) ?? [];
    arr.push(b);
    byRow.set(b.y, arr);
  }
  const sortedRows = Array.from(byRow.keys()).sort((a, b) => b - a);
  for (const r of sortedRows) {
    const rowBlocks = (byRow.get(r) ?? []).slice().sort((a, b) => a.x - b.x);
    for (const block of rowBlocks) {
      const cube = el('span', 'nb-mini-cube');
      cube.style.backgroundColor = block.color;
      if (block.borderColor) {
        cube.style.borderColor = block.borderColor;
        cube.style.borderWidth = '2px';
      }
      container.appendChild(cube);
    }
  }
}

export class UIManager {
  private readonly root: HTMLElement;
  private readonly handlers: UIHandlers;
  private settings: ParentSettings;

  private currentScreen: GameScreen = 'title';
  private selectedMode: GameMode = 'count-cruise';
  private selectedRacer: NumberblockId = 4;

  private readonly screens: Record<GameScreen, HTMLElement>;

  // Title elements
  private modeCruiseCard!: HTMLButtonElement;
  private modeMathCard!: HTMLButtonElement;
  private titleRacerChipNum!: HTMLElement;
  private titleRacerChipLabel!: HTMLElement;

  // Garage elements
  private garageNumBadge!: HTMLElement;
  private garageNameEl!: HTMLElement;
  private garageWheelPill!: HTMLElement;
  private garageCatchphraseEl!: HTMLElement;
  private garageCountPill!: HTMLElement;
  private garageCountStepEl!: HTMLElement;
  private garageCountOfEl!: HTMLElement;
  private racerTiles = new Map<NumberblockId, HTMLButtonElement>();

  // HUD elements
  private hudMiniGrid!: HTMLElement;
  private hudRacerNum!: HTMLElement;
  private hudRacerName!: HTMLElement;
  private hudRacerWheels!: HTMLElement;
  private hudBlobsValue!: HTMLElement;
  private hudCountTrack!: HTMLElement;
  private hudCountPips!: HTMLElement;
  private hudCountSummary!: HTMLElement;
  private hudCountNodes: HTMLElement[] = [];
  private hudRallyWrap!: HTMLElement;
  private hudPosPill!: HTMLElement;
  private hudTrackFill!: HTMLElement;
  private hudTrackKartDot!: HTMLElement;
  private hudCommentaryPill!: HTMLElement;
  private hudCommentaryText!: HTMLElement;
  private hudCountdownStamp!: HTMLElement;
  private hudCountPopup!: HTMLElement;
  private hudCountPopupNum!: HTMLElement;
  private hudCountPopupWord!: HTMLElement;
  private hudCountPopupDots!: HTMLElement;
  private hudMathBanner!: HTMLElement;
  private hudMathTitle!: HTMLElement;
  private hudMathEquation!: HTMLElement;
  private hudMathSubtitle!: HTMLElement;
  private jumpTouchBtn!: HTMLButtonElement;
  private jumpBoostSub!: HTMLElement;

  // Pit-Stop elements
  private pitStopPromptEl!: HTMLElement;
  private pitStopVisualsEl!: HTMLElement;
  private pitStopChoicesEl!: HTMLElement;
  private pitStopFeedbackEl!: HTMLElement;

  // Podium elements
  private podiumStarsEl!: HTMLElement;
  private podiumOneBadge!: HTMLElement;
  private podiumTitleEl!: HTMLElement;
  private podiumStatsEl!: HTMLElement;

  // Settings drawer elements
  private settingsBackdrop!: HTMLElement;
  private toggleMusic!: HTMLButtonElement;
  private toggleSfx!: HTMLButtonElement;
  private toggleVoice!: HTMLButtonElement;
  private toggleFamilyVoice!: HTMLButtonElement;
  private toggleAutoSteer!: HTMLButtonElement;
  private togglePitStop!: HTMLButtonElement;
  private segSpeedButtons = new Map<CarSpeedSetting, HTMLButtonElement>();
  private segLengthButtons = new Map<RaceLengthSetting, HTMLButtonElement>();
  private segCount5!: HTMLButtonElement;
  private segCount10!: HTMLButtonElement;

  // Family Voice Studio state & elements
  private readonly voiceStore = new FamilyVoiceStore();
  private recordedBlobs = new Map<string, Blob>();
  private voiceStudioContainer!: HTMLElement;
  private voiceStudioToggleBtn!: HTMLButtonElement;
  private voiceStudioCountBadge!: HTMLElement;
  private voiceStudioStatusEl!: HTMLElement;
  private voiceSlotControls = new Map<
    string,
    {
      row: HTMLElement;
      recBtn: HTMLButtonElement;
      playBtn: HTMLButtonElement;
      delBtn: HTMLButtonElement;
    }
  >();
  private voiceStudioExpanded = false;
  private activeRecording: {
    slotId: string;
    stop: () => Promise<Blob>;
    timeoutId: number;
  } | null = null;
  private voiceOperationBusy = false;
  private disposed = false;

  // Timers & active touch pointers
  private mathBannerTimer: number | null = null;
  private countPopupTimer: number | null = null;
  private commentaryTimer: number | null = null;
  private lastCommentary = '';
  private readonly leftPointers = new Set<number>();
  private readonly rightPointers = new Set<number>();
  private readonly jumpPointers = new Set<number>();
  private readonly cleanups: Array<() => void> = [];

  constructor(
    root: HTMLElement,
    initialSettings: ParentSettings,
    handlers: UIHandlers
  ) {
    this.root = root;
    this.settings = { ...initialSettings };
    this.handlers = handlers;

    this.root.replaceChildren();

    const titleScreen = this.buildTitleScreen();
    const garageScreen = this.buildGarageScreen();
    const hudScreen = this.buildHudScreen();
    const pitStopScreen = this.buildPitStopScreen();
    const podiumScreen = this.buildPodiumScreen();
    const settingsBackdrop = this.buildSettingsDrawer();

    // Countdown and Playing share the HUD container
    this.screens = {
      title: titleScreen,
      garage: garageScreen,
      countdown: hudScreen,
      playing: hudScreen,
      pitstop: pitStopScreen,
      podium: podiumScreen,
    };

    this.root.append(
      titleScreen,
      garageScreen,
      hudScreen,
      pitStopScreen,
      podiumScreen,
      settingsBackdrop
    );

    this.setSelectedMode(this.selectedMode);
    this.setSelectedRacer(this.selectedRacer);
    this.updateSettings(this.settings);
    this.setScreen('title');
    void this.refreshFamilyVoices();
  }

  // =========================================================================
  // Screen Builders
  // =========================================================================

  private buildTitleScreen(): HTMLElement {
    const screen = el('section', 'nb-screen nb-title-screen');
    screen.setAttribute('aria-label', 'Title Screen');

    // Top Emblem + Gear
    const top = el('div', 'nb-title-top');

    const logoStack = el('div', 'nb-logo-stack');
    const wordRow = el('div', 'nb-logo-word-row nb-logo-words');
    const wordGroups = ['NUMBER', 'BLOCK'] as const;
    let letterIndex = 0;
    for (const groupWord of wordGroups) {
      const groupEl = el('div', 'nb-logo-word-group');
      for (let i = 0; i < groupWord.length; i += 1) {
        const letter = el('span', 'nb-logo-letter', groupWord[i]);
        const bg =
          TITLE_LETTER_COLORS[letterIndex % TITLE_LETTER_COLORS.length];
        letter.style.backgroundColor = bg;
        if (bg === '#FDD835') {
          letter.style.color = '#1b2a4a';
        }
        groupEl.appendChild(letter);
        letterIndex += 1;
      }
      wordRow.appendChild(groupEl);
    }

    const rallyRibbon = el('div', 'nb-logo-rally-ribbon', 'RALLY!');
    const subtitle = el(
      'div',
      'nb-logo-subtitle nb-title-sub',
      'Mount Numberland Pedal-Car Adventure'
    );
    logoStack.append(wordRow, rallyRibbon, subtitle);

    const gearWrap = el('div', 'nb-title-gear-wrap');
    const gearBtn = el('button', 'nb-icon-btn') as HTMLButtonElement;
    gearBtn.type = 'button';
    gearBtn.setAttribute('aria-label', 'Parent Settings');
    gearBtn.appendChild(createGearIcon());
    this.listen(gearBtn, 'click', () => this.openSettingsDrawer());
    gearWrap.appendChild(gearBtn);

    top.append(logoStack, gearWrap);

    // Bottom Mode Cards + Play Actions
    const bottom = el('div', 'nb-title-bottom');
    const modeGrid = el('div', 'nb-mode-grid');

    this.modeCruiseCard = this.createModeCard(
      'count-cruise',
      'Count & Cruise',
      'Ages 2–4',
      'Drive through glowing numbers 1 to 10!',
      '1·2·3',
      'nb-mode-icon--cruise',
      'nb-mode-card--cruise'
    );
    this.modeMathCard = this.createModeCard(
      'rally-math',
      'Rally Math',
      'Ages 4–6',
      'Race all 10 cars with fun + and − magic!',
      '+ / −',
      'nb-mode-icon--math',
      'nb-mode-card--math'
    );
    modeGrid.append(this.modeCruiseCard, this.modeMathCard);

    const actions = el('div', 'nb-title-actions');

    const pickRacerBtn = el(
      'button',
      'nb-btn nb-btn--white nb-btn-racer-pick'
    ) as HTMLButtonElement;
    pickRacerBtn.type = 'button';
    this.titleRacerChipNum = el('span', 'nb-racer-chip-num', '4');
    this.titleRacerChipLabel = el('span', undefined, 'Pick Your Racer!');
    pickRacerBtn.append(this.titleRacerChipNum, this.titleRacerChipLabel);
    this.listen(pickRacerBtn, 'click', () => this.handlers.onOpenGarage());

    const playNowBtn = el(
      'button',
      'nb-btn nb-btn--green nb-btn-play-now',
      'PLAY NOW!'
    ) as HTMLButtonElement;
    playNowBtn.type = 'button';
    this.listen(playNowBtn, 'click', () => this.handlers.onStartRace());

    actions.append(pickRacerBtn, playNowBtn);
    bottom.append(modeGrid, actions);
    screen.append(top, bottom);

    return screen;
  }

  private createModeCard(
    mode: GameMode,
    title: string,
    ageLabel: string,
    description: string,
    iconText: string,
    iconClass: string,
    cardModifier: string
  ): HTMLButtonElement {
    const card = el('button', `nb-mode-card ${cardModifier}`) as HTMLButtonElement;
    card.type = 'button';

    const icon = el('div', `nb-mode-icon ${iconClass}`, iconText);
    const textWrap = el('div', 'nb-mode-text');
    const head = el('div', 'nb-mode-head');
    const titleEl = el('span', 'nb-mode-title', title);
    const badge = el('span', 'nb-age-badge', ageLabel);
    head.append(titleEl, badge);

    const desc = el('p', 'nb-mode-desc', description);
    textWrap.append(head, desc);

    const check = el('span', 'nb-mode-check', '✓');
    card.append(icon, textWrap, check);

    this.listen(card, 'click', () => {
      this.setSelectedMode(mode);
      this.handlers.onSelectMode(mode);
    });

    return card;
  }

  private buildGarageScreen(): HTMLElement {
    const screen = el('section', 'nb-screen nb-garage-screen');
    screen.setAttribute('aria-label', '3D Numberblock Garage');

    const top = el('div', 'nb-garage-top');

    const backBtn = el(
      'button',
      'nb-btn nb-btn--white nb-garage-back-btn'
    ) as HTMLButtonElement;
    backBtn.type = 'button';
    backBtn.setAttribute('aria-label', 'Back to Title');
    backBtn.append(
      el('span', undefined, '←'),
      el('span', 'nb-hide-xs', ' Back')
    );
    this.listen(backBtn, 'click', () => this.handlers.onBackToTitle());

    const banner = el('div', 'nb-card nb-garage-banner');
    this.garageNumBadge = el('div', 'nb-garage-num-badge', '4');
    const info = el('div', 'nb-garage-info');
    const nameRow = el('div', 'nb-garage-name-row');
    this.garageNameEl = el('span', 'nb-garage-name', 'Four');
    this.garageWheelPill = el('span', 'nb-garage-wheel-pill', '4-wheel drive');
    nameRow.append(this.garageNameEl, this.garageWheelPill);
    this.garageCatchphraseEl = el(
      'div',
      'nb-garage-catchphrase',
      'Four! Four-wheel drive!'
    );
    info.append(nameRow, this.garageCatchphraseEl);
    banner.append(this.garageNumBadge, info);

    const countBtn = el(
      'button',
      'nb-btn nb-btn--sun nb-garage-count-btn'
    ) as HTMLButtonElement;
    countBtn.type = 'button';
    countBtn.setAttribute('aria-label', 'Count Blocks');
    const countLabel = el('span');
    countLabel.append('Count', el('span', 'nb-hide-xs', ' Blocks'), '!');
    countBtn.append(countLabel);
    this.listen(countBtn, 'click', () =>
      this.handlers.onCountRacerBlocks(this.selectedRacer)
    );

    top.append(backBtn, banner, countBtn);

    // Floating Count Highlight Pill
    this.garageCountPill = el('div', 'nb-garage-count-pill');
    this.garageCountStepEl = el('span', 'nb-garage-count-step', '1');
    this.garageCountOfEl = el('span', 'nb-garage-count-of', 'of 4');
    this.garageCountPill.append(this.garageCountStepEl, this.garageCountOfEl);

    // Bottom 1..10 tile selector + giant RACE! button
    const bottom = el('div', 'nb-garage-bottom');
    const strip = el('div', 'nb-card nb-racer-strip');

    for (const id of ALL_NUMBERBLOCK_IDS) {
      const spec = NUMBERBLOCK_SPECS[id];
      const tile = el('button', 'nb-racer-tile') as HTMLButtonElement;
      tile.type = 'button';
      tile.setAttribute('aria-label', `Numberblock ${id} ${spec.name}`);

      if (id === 7) {
        tile.style.background =
          'linear-gradient(180deg, #E53935 0%, #FDD835 45%, #29B6F6 75%, #AB47BC 100%)';
      } else if (id === 10) {
        tile.style.background = 'linear-gradient(180deg, #ffffff 0%, #ffebee 100%)';
        tile.style.borderColor = '#E53935';
        tile.style.color = '#E53935';
        tile.style.textShadow = 'none';
      } else {
        tile.style.background = spec.primaryColor;
        tile.style.color = getReadableBadgeTextColor(spec.primaryColor);
        if (id === 3) {
          tile.style.textShadow = 'none';
        }
      }

      const numSpan = el('span', 'nb-racer-tile-num', String(id));
      const nameSpan = el('span', 'nb-racer-tile-name', spec.name);
      tile.append(numSpan, nameSpan);

      this.listen(tile, 'click', () => {
        this.setSelectedRacer(id);
        this.handlers.onSelectRacer(id);
      });

      this.racerTiles.set(id, tile);
      strip.appendChild(tile);
    }

    const raceBtn = el(
      'button',
      'nb-btn nb-btn--green nb-garage-race-btn',
      'RACE!'
    ) as HTMLButtonElement;
    raceBtn.type = 'button';
    this.listen(raceBtn, 'click', () => this.handlers.onStartRace());

    bottom.append(strip, raceBtn);
    screen.append(top, this.garageCountPill, bottom);

    return screen;
  }

  private buildHudScreen(): HTMLElement {
    const screen = el('section', 'nb-screen nb-hud-screen');
    screen.setAttribute('aria-label', 'In-Game HUD');

    // Top row
    const top = el('div', 'nb-hud-top');

    // Top-Left: Live Racer Badge + Numberblobs
    const left = el('div', 'nb-hud-left');
    const racerBadge = el('div', 'nb-card nb-racer-badge');
    this.hudMiniGrid = el('div', 'nb-mini-grid');
    const racerMeta = el('div', 'nb-racer-badge-meta');
    this.hudRacerNum = el('div', 'nb-racer-badge-num', '4');
    this.hudRacerName = el('div', 'nb-racer-badge-name', 'Four');
    this.hudRacerWheels = el('div', 'nb-racer-badge-wheels', '4 🛞');
    racerMeta.append(this.hudRacerNum, this.hudRacerName, this.hudRacerWheels);
    racerBadge.append(this.hudMiniGrid, racerMeta);

    const blobsPill = el('div', 'nb-card nb-blobs-pill');
    const blobDot = el('span', 'nb-blob-dot');
    this.hudBlobsValue = el('span', 'nb-blobs-value', '0');
    blobsPill.append(blobDot, this.hudBlobsValue);
    left.append(racerBadge, blobsPill);

    // Top-Center: Count Track / Rally Progress + Commentary Pill
    const center = el('div', 'nb-hud-center');
    this.hudCountTrack = el('div', 'nb-card nb-count-track');
    this.hudCountPips = el('div', 'nb-count-pips');
    this.hudCountSummary = el('span', 'nb-count-summary', '0 / 10');
    this.hudCountTrack.append(this.hudCountPips, this.hudCountSummary);
    this.rebuildCountTrack(10);

    this.hudRallyWrap = el('div', 'nb-card nb-rally-progress-wrap');
    this.hudPosPill = el('span', 'nb-pos-pill', '1st / 10');
    const trackBar = el('div', 'nb-track-bar');
    this.hudTrackFill = el('div', 'nb-track-fill');
    this.hudTrackKartDot = el('div', 'nb-track-kart-dot');
    trackBar.append(this.hudTrackFill, this.hudTrackKartDot);
    const flag = el('span', 'nb-track-flag', '🏁');
    this.hudRallyWrap.append(this.hudPosPill, trackBar, flag);

    this.hudCommentaryPill = el('div', 'nb-commentary-pill');
    const majorThreeTag = el('span', 'nb-major-three-tag', '3');
    this.hudCommentaryText = el('span', undefined, '');
    this.hudCommentaryPill.append(majorThreeTag, this.hudCommentaryText);

    center.append(
      this.hudCountTrack,
      this.hudRallyWrap,
      this.hudCommentaryPill
    );

    // Top-Right: Home & Settings Buttons
    const right = el('div', 'nb-hud-right');
    const homeBtn = el('button', 'nb-icon-btn') as HTMLButtonElement;
    homeBtn.type = 'button';
    homeBtn.setAttribute('aria-label', 'Back to Title');
    homeBtn.appendChild(createHomeIcon());
    this.listen(homeBtn, 'click', () => this.handlers.onBackToTitle());

    const settingsBtn = el('button', 'nb-icon-btn') as HTMLButtonElement;
    settingsBtn.type = 'button';
    settingsBtn.setAttribute('aria-label', 'Parent Settings');
    settingsBtn.appendChild(createGearIcon());
    this.listen(settingsBtn, 'click', () => {
      this.handlers.onPauseToggle();
      this.openSettingsDrawer();
    });
    right.append(homeBtn, settingsBtn);

    top.append(left, center, right);

    // Center Non-Blocking Overlays
    const overlays = el('div', 'nb-hud-overlays');

    this.hudCountdownStamp = el('div', 'nb-countdown-stamp');

    this.hudCountPopup = el('div', 'nb-count-popup');
    this.hudCountPopupNum = el('div', 'nb-count-popup-num', '1');
    this.hudCountPopupWord = el('div', 'nb-count-popup-word', 'One!');
    this.hudCountPopupDots = el('div', 'nb-count-popup-dots');
    this.hudCountPopup.append(
      this.hudCountPopupNum,
      this.hudCountPopupWord,
      this.hudCountPopupDots
    );

    this.hudMathBanner = el('div', 'nb-math-banner');
    this.hudMathTitle = el('div', 'nb-math-title', 'Maths Magic!');
    this.hudMathEquation = el('div', 'nb-math-equation');
    this.hudMathSubtitle = el('div', 'nb-math-subtitle');
    this.hudMathBanner.append(
      this.hudMathTitle,
      this.hudMathEquation,
      this.hudMathSubtitle
    );

    overlays.append(
      this.hudCountdownStamp,
      this.hudCountPopup,
      this.hudMathBanner
    );

    // Bottom Touch Controls + Desktop Keyboard Hint
    const bottom = el('div', 'nb-hud-bottom');

    const steerPad = el('div', 'nb-steer-pad');
    const leftBtn = el('button', 'nb-touch-btn') as HTMLButtonElement;
    leftBtn.type = 'button';
    leftBtn.setAttribute('aria-label', 'Steer Left');
    leftBtn.appendChild(createArrowIcon('left'));

    const rightBtn = el('button', 'nb-touch-btn') as HTMLButtonElement;
    rightBtn.type = 'button';
    rightBtn.setAttribute('aria-label', 'Steer Right');
    rightBtn.appendChild(createArrowIcon('right'));

    this.bindHoldTouchButton(leftBtn, this.leftPointers, (active) => {
      this.handlers.onTouchInput({ left: active });
    });
    this.bindHoldTouchButton(rightBtn, this.rightPointers, (active) => {
      this.handlers.onTouchInput({ right: active });
    });
    steerPad.append(leftBtn, rightBtn);

    const desktopHint = el(
      'div',
      'nb-desktop-hint nb-kbd-hint',
      '← → Steer • SPACE Jump'
    );

    this.jumpTouchBtn = el(
      'button',
      'nb-touch-btn nb-jump-btn'
    ) as HTMLButtonElement;
    this.jumpTouchBtn.type = 'button';
    this.jumpTouchBtn.setAttribute('aria-label', 'Jump and Boost');
    const jumpLabel = el('span', undefined, 'JUMP!');
    this.jumpBoostSub = el('span', 'nb-boost-sub', 'HOP');
    this.jumpTouchBtn.append(jumpLabel, this.jumpBoostSub);
    this.bindHoldTouchButton(this.jumpTouchBtn, this.jumpPointers, (active) => {
      this.handlers.onTouchInput({ jump: active, boost: active });
    });

    bottom.append(steerPad, desktopHint, this.jumpTouchBtn);
    screen.append(top, overlays, bottom);

    return screen;
  }

  private rebuildCountTrack(target: number): void {
    this.hudCountPips.replaceChildren();
    this.hudCountNodes = [];
    for (let n = 1; n <= target; n += 1) {
      const node = el('span', 'nb-count-node', String(n));
      this.hudCountNodes.push(node);
      this.hudCountPips.appendChild(node);
    }
    this.hudCountSummary.textContent = `0 / ${target}`;
  }

  private bindHoldTouchButton(
    btn: HTMLButtonElement,
    pointerSet: Set<number>,
    onChange: (active: boolean) => void
  ): void {
    const sync = (): void => {
      const active = pointerSet.size > 0;
      btn.classList.toggle('is-pressed', active);
      onChange(active);
    };

    this.listen(btn, 'pointerdown', (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures on synthetic events
      }
      pointerSet.add(e.pointerId);
      sync();
    });

    const release = (e: PointerEvent): void => {
      if (pointerSet.delete(e.pointerId)) {
        sync();
      }
    };

    this.listen(btn, 'pointerup', release);
    this.listen(btn, 'pointercancel', release);
    this.listen(btn, 'lostpointercapture', release);
  }

  private buildPitStopScreen(): HTMLElement {
    const screen = el('section', 'nb-screen nb-pitstop-screen');
    screen.setAttribute('aria-label', 'Pit-Stop Counting Challenge');

    const card = el('div', 'nb-card nb-pitstop-card');

    const header = el('div', 'nb-pitstop-header');
    const tag = el('span', 'nb-major-three-tag', '3');
    const title = el('span', undefined, "Major Three's Pit-Stop Challenge!");
    header.append(tag, title);

    this.pitStopPromptEl = el('h2', 'nb-pitstop-prompt', 'Count the blocks!');
    this.pitStopVisualsEl = el('div', 'nb-pitstop-visuals');
    this.pitStopChoicesEl = el('div', 'nb-pitstop-choices');
    this.pitStopFeedbackEl = el('div', 'nb-pitstop-feedback');

    card.append(
      header,
      this.pitStopPromptEl,
      this.pitStopVisualsEl,
      this.pitStopChoicesEl,
      this.pitStopFeedbackEl
    );
    screen.appendChild(card);
    return screen;
  }

  private buildPodiumScreen(): HTMLElement {
    const screen = el('section', 'nb-screen nb-podium-screen');
    screen.setAttribute('aria-label', 'Victory Trophy Podium');

    const card = el('div', 'nb-card nb-podium-card');
    this.podiumStarsEl = el('div', 'nb-podium-stars');
    this.podiumOneBadge = el(
      'div',
      'nb-podium-one-badge',
      'ONLY ONE CAN LIFT THE TROPHY!'
    );
    this.podiumTitleEl = el('h2', 'nb-podium-title', 'Hooray! Champion!');
    this.podiumStatsEl = el('div', 'nb-podium-stats');

    const tapSection = el('div', 'nb-podium-tap-section');
    const tapLabel = el(
      'div',
      'nb-podium-tap-label',
      'Tap to Count 1–10!'
    );
    const numbersRow = el('div', 'nb-podium-numbers-row');
    for (const id of ALL_NUMBERBLOCK_IDS) {
      const spec = NUMBERBLOCK_SPECS[id];
      const btn = el('button', 'nb-podium-num-btn', String(id)) as HTMLButtonElement;
      btn.type = 'button';
      btn.setAttribute('aria-label', `Count ${id} ${spec.name}`);
      if (id === 7) {
        btn.style.background =
          'linear-gradient(135deg, #E53935, #FDD835, #29B6F6, #AB47BC)';
      } else if (id === 10) {
        btn.style.background = '#ffffff';
        btn.style.color = '#E53935';
        btn.style.borderColor = '#E53935';
        btn.style.textShadow = 'none';
      } else {
        btn.style.background = spec.primaryColor;
        btn.style.color = getReadableBadgeTextColor(spec.primaryColor);
        if (id === 3) {
          btn.style.textShadow = 'none';
        }
      }
      this.listen(btn, 'click', () => this.handlers.onPodiumTapNumber(id));
      numbersRow.appendChild(btn);
    }
    tapSection.append(tapLabel, numbersRow);

    const actions = el('div', 'nb-podium-actions');
    const playAgainBtn = el(
      'button',
      'nb-btn nb-btn--green',
      'Race Again!'
    ) as HTMLButtonElement;
    playAgainBtn.type = 'button';
    this.listen(playAgainBtn, 'click', () => this.handlers.onPlayAgain());

    const pickRacerBtn = el(
      'button',
      'nb-btn nb-btn--sun',
      'Pick Racer'
    ) as HTMLButtonElement;
    pickRacerBtn.type = 'button';
    this.listen(pickRacerBtn, 'click', () => this.handlers.onOpenGarage());

    const homeBtn = el(
      'button',
      'nb-btn nb-btn--white',
      'Title'
    ) as HTMLButtonElement;
    homeBtn.type = 'button';
    this.listen(homeBtn, 'click', () => this.handlers.onBackToTitle());

    actions.append(playAgainBtn, pickRacerBtn, homeBtn);

    card.append(
      this.podiumStarsEl,
      this.podiumOneBadge,
      this.podiumTitleEl,
      this.podiumStatsEl,
      tapSection,
      actions
    );
    screen.appendChild(card);
    return screen;
  }

  private buildSettingsDrawer(): HTMLElement {
    this.settingsBackdrop = el('div', 'nb-settings-backdrop');
    this.settingsBackdrop.setAttribute('role', 'dialog');
    this.settingsBackdrop.setAttribute('aria-modal', 'true');
    this.settingsBackdrop.setAttribute('aria-label', 'Parent Settings');

    this.listen(this.settingsBackdrop, 'click', (e) => {
      if (e.target === this.settingsBackdrop) {
        this.closeSettingsDrawer();
      }
    });

    const drawer = el('div', 'nb-card nb-settings-drawer');
    const head = el('div', 'nb-settings-head');
    const title = el('h2', 'nb-settings-title', 'Parent Settings');
    const closeBtn = el('button', 'nb-icon-btn') as HTMLButtonElement;
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close Parent Settings');
    closeBtn.appendChild(createCloseIcon());
    this.listen(closeBtn, 'click', () => this.closeSettingsDrawer());
    head.append(title, closeBtn);
    drawer.appendChild(head);

    this.toggleMusic = this.addToggleRow(
      drawer,
      'Music',
      'Cheerful rally background tune',
      () => this.patchSetting({ musicEnabled: !this.settings.musicEnabled })
    );
    this.toggleSfx = this.addToggleRow(
      drawer,
      'Sound Effects',
      'Boings, chimes & kart zoom',
      () => this.patchSetting({ sfxEnabled: !this.settings.sfxEnabled })
    );
    this.toggleVoice = this.addToggleRow(
      drawer,
      'Spoken Voice',
      'Major Three & number counting',
      () => this.patchSetting({ voiceEnabled: !this.settings.voiceEnabled })
    );
    this.toggleFamilyVoice = this.addToggleRow(
      drawer,
      'Use Family Voice Pack',
      'Play recorded family voices first',
      () =>
        this.patchSetting({ useFamilyVoice: !this.settings.useFamilyVoice })
    );

    drawer.appendChild(this.buildFamilyVoiceStudio());

    this.toggleAutoSteer = this.addToggleRow(
      drawer,
      'Toddler Auto-Steer Assist',
      'Gently guides kart along the road',
      () =>
        this.patchSetting({ autoSteerAssist: !this.settings.autoSteerAssist })
    );
    this.togglePitStop = this.addToggleRow(
      drawer,
      'Pit-Stop Math Quizzes',
      'Fun counting stops mid-race',
      () => this.patchSetting({ pitStopQuizzes: !this.settings.pitStopQuizzes })
    );

    // Car Speed: Slow | Normal | Fast
    const speedRow = el('div', 'nb-setting-row');
    const speedLabels = el('div', 'nb-setting-label-wrap');
    speedLabels.append(
      el('span', 'nb-setting-label', 'Car Speed'),
      el('span', 'nb-setting-hint', 'Slower pace for counting & bumps')
    );
    const speedSegGroup = el('div', 'nb-segment-group nb-segment-group--3');
    const speedOptions: Array<{ value: CarSpeedSetting; label: string }> = [
      { value: 'slow', label: 'Slow' },
      { value: 'normal', label: 'Normal' },
      { value: 'fast', label: 'Fast' },
    ];
    for (const opt of speedOptions) {
      const btn = el('button', 'nb-segment-btn', opt.label) as HTMLButtonElement;
      btn.type = 'button';
      this.listen(btn, 'click', () =>
        this.patchSetting({ carSpeed: opt.value })
      );
      this.segSpeedButtons.set(opt.value, btn);
      speedSegGroup.appendChild(btn);
    }
    speedRow.append(speedLabels, speedSegGroup);
    drawer.appendChild(speedRow);

    // Race Length: Short | Medium | Long
    const lengthRow = el('div', 'nb-setting-row');
    const lengthLabels = el('div', 'nb-setting-label-wrap');
    lengthLabels.append(
      el('span', 'nb-setting-label', 'Race Length'),
      el('span', 'nb-setting-hint', 'Applies on next race')
    );
    const lengthSegGroup = el('div', 'nb-segment-group nb-segment-group--3');
    const lengthOptions: Array<{ value: RaceLengthSetting; label: string }> = [
      { value: 'short', label: 'Short' },
      { value: 'medium', label: 'Medium' },
      { value: 'long', label: 'Long' },
    ];
    for (const opt of lengthOptions) {
      const btn = el('button', 'nb-segment-btn', opt.label) as HTMLButtonElement;
      btn.type = 'button';
      this.listen(btn, 'click', () =>
        this.patchSetting({ raceLength: opt.value })
      );
      this.segLengthButtons.set(opt.value, btn);
      lengthSegGroup.appendChild(btn);
    }
    lengthRow.append(lengthLabels, lengthSegGroup);
    drawer.appendChild(lengthRow);

    // Count Goal 1-5 vs 1-10
    const goalRow = el('div', 'nb-setting-row');
    const goalLabels = el('div', 'nb-setting-label-wrap');
    goalLabels.append(
      el('span', 'nb-setting-label', 'Count Goal'),
      el('span', 'nb-setting-hint', 'For Count & Cruise mode')
    );
    const segGroup = el('div', 'nb-segment-group');
    this.segCount5 = el('button', 'nb-segment-btn', '1–5') as HTMLButtonElement;
    this.segCount5.type = 'button';
    this.segCount10 = el(
      'button',
      'nb-segment-btn',
      '1–10'
    ) as HTMLButtonElement;
    this.segCount10.type = 'button';
    this.listen(this.segCount5, 'click', () =>
      this.patchSetting({ maxCountTarget: 5 })
    );
    this.listen(this.segCount10, 'click', () =>
      this.patchSetting({ maxCountTarget: 10 })
    );
    segGroup.append(this.segCount5, this.segCount10);
    goalRow.append(goalLabels, segGroup);
    drawer.appendChild(goalRow);

    this.settingsBackdrop.appendChild(drawer);
    return this.settingsBackdrop;
  }

  private buildFamilyVoiceStudio(): HTMLElement {
    const container = el('div', 'nb-voice-studio');
    this.voiceStudioContainer = container;

    const headerBtn = el(
      'button',
      'nb-voice-studio-toggle'
    ) as HTMLButtonElement;
    headerBtn.type = 'button';
    headerBtn.setAttribute('aria-expanded', 'false');

    const titleWrap = el('div', 'nb-voice-studio-title-wrap');
    const title = el('span', 'nb-setting-label', 'Family Voice Studio 🎙️');
    const hint = el(
      'span',
      'nb-setting-hint',
      'Record Mum, Dad, or sibling voices!'
    );
    titleWrap.append(title, hint);

    const rightMeta = el('div', 'nb-voice-studio-meta');
    this.voiceStudioCountBadge = el(
      'span',
      'nb-voice-count-badge',
      `0 / ${FAMILY_VOICE_SLOTS.length} recorded`
    );
    const chevron = el('span', 'nb-voice-chevron', '▾');
    rightMeta.append(this.voiceStudioCountBadge, chevron);

    headerBtn.append(titleWrap, rightMeta);
    this.voiceStudioToggleBtn = headerBtn;

    this.listen(headerBtn, 'click', () => {
      this.voiceStudioExpanded = !this.voiceStudioExpanded;
      container.classList.toggle('is-expanded', this.voiceStudioExpanded);
      headerBtn.setAttribute('aria-expanded', String(this.voiceStudioExpanded));
      if (this.voiceStudioExpanded) {
        void this.refreshFamilyVoices();
      }
    });

    const body = el('div', 'nb-voice-studio-body');
    this.voiceStudioStatusEl = el('div', 'nb-voice-studio-status');
    if (!FamilyVoiceStore.isRecordingSupported()) {
      this.setVoiceStudioStatus(
        'Microphone recording is not supported in this browser. Saved clips still play if present!',
        'warn'
      );
    } else {
      this.setVoiceStudioStatus(
        'Tap Record, speak clearly for up to 3.5s, then tap Stop!',
        'info'
      );
    }

    const grid = el('div', 'nb-voice-studio-grid');
    for (const slot of FAMILY_VOICE_SLOTS) {
      const row = el('div', 'nb-voice-slot');

      const chip = el('span', 'nb-voice-slot-chip', slot.label);
      if (slot.id === 'num_7') {
        chip.style.background =
          'linear-gradient(135deg, #E53935, #FDD835, #29B6F6, #AB47BC)';
      } else if (slot.id === 'num_10') {
        chip.style.background = '#ffffff';
        chip.style.color = '#E53935';
        chip.style.borderColor = '#E53935';
      } else {
        chip.style.background = slot.accentColor;
        chip.style.color = getReadableBadgeTextColor(slot.accentColor);
      }

      const prompt = el('span', 'nb-voice-slot-prompt', slot.promptText);

      const actions = el('div', 'nb-voice-slot-actions');

      const recBtn = el(
        'button',
        'nb-voice-btn nb-voice-btn--record',
        'Rec'
      ) as HTMLButtonElement;
      recBtn.type = 'button';
      recBtn.setAttribute('aria-label', `Record ${slot.promptText}`);
      recBtn.disabled = !FamilyVoiceStore.isRecordingSupported();
      this.listen(recBtn, 'click', () => {
        void this.handleRecordToggle(slot);
      });

      const playBtn = el(
        'button',
        'nb-voice-btn nb-voice-btn--play',
        '▶'
      ) as HTMLButtonElement;
      playBtn.type = 'button';
      playBtn.setAttribute('aria-label', `Play ${slot.promptText}`);
      playBtn.disabled = true;
      this.listen(playBtn, 'click', () => {
        void this.handlePlaySlot(slot.id);
      });

      const delBtn = el(
        'button',
        'nb-voice-btn nb-voice-btn--delete',
        '✕'
      ) as HTMLButtonElement;
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label', `Delete ${slot.promptText}`);
      delBtn.disabled = true;
      this.listen(delBtn, 'click', () => {
        void this.handleDeleteSlot(slot.id);
      });

      actions.append(recBtn, playBtn, delBtn);
      row.append(chip, prompt, actions);
      grid.appendChild(row);
      this.voiceSlotControls.set(slot.id, { row, recBtn, playBtn, delBtn });
    }

    body.append(this.voiceStudioStatusEl, grid);
    container.append(headerBtn, body);
    return container;
  }

  private setVoiceStudioStatus(
    message: string,
    tone: 'info' | 'warn' | 'success' | 'recording'
  ): void {
    this.voiceStudioStatusEl.textContent = message;
    this.voiceStudioStatusEl.className = `nb-voice-studio-status is-${tone}`;
  }

  private async refreshFamilyVoices(): Promise<void> {
    try {
      const blobs = await this.voiceStore.loadAllBlobs();
      if (this.disposed) return;
      this.recordedBlobs = blobs;
      this.syncVoiceStudioUI();
    } catch {
      // Ignore storage read failures gracefully
    }
  }

  private syncVoiceStudioUI(): void {
    const total = FAMILY_VOICE_SLOTS.length;
    const count = FAMILY_VOICE_SLOTS.filter((s) =>
      this.recordedBlobs.has(s.id)
    ).length;
    this.voiceStudioCountBadge.textContent = `${count} / ${total} recorded`;
    this.voiceStudioCountBadge.classList.toggle('has-clips', count > 0);

    const micSupported = FamilyVoiceStore.isRecordingSupported();
    const recordingSlotId = this.activeRecording?.slotId ?? null;

    for (const slot of FAMILY_VOICE_SLOTS) {
      const ctrl = this.voiceSlotControls.get(slot.id);
      if (!ctrl) continue;
      const hasClip = this.recordedBlobs.has(slot.id);
      const isRec = recordingSlotId === slot.id;

      ctrl.row.classList.toggle('is-recorded', hasClip);
      ctrl.row.classList.toggle('is-recording', isRec);

      ctrl.recBtn.textContent = isRec ? 'Stop' : 'Rec';
      ctrl.recBtn.classList.toggle('is-recording', isRec);
      ctrl.recBtn.disabled = !micSupported || (recordingSlotId !== null && !isRec);

      ctrl.playBtn.disabled = !hasClip || recordingSlotId !== null;
      ctrl.delBtn.disabled = !hasClip || recordingSlotId !== null;
    }
  }

  private async handleRecordToggle(slot: FamilyVoiceSlot): Promise<void> {
    if (this.disposed || this.voiceOperationBusy) return;

    if (!FamilyVoiceStore.isRecordingSupported()) {
      this.setVoiceStudioStatus(
        'Microphone recording is not supported in this browser.',
        'warn'
      );
      return;
    }

    if (this.activeRecording && this.activeRecording.slotId === slot.id) {
      await this.stopActiveRecording(true);
      return;
    }

    if (this.activeRecording) {
      await this.stopActiveRecording(true);
    }

    this.voiceOperationBusy = true;
    this.setVoiceStudioStatus(
      `Recording "${slot.promptText}"... Tap Stop when done!`,
      'recording'
    );

    try {
      const session = await this.voiceStore.startRecording(3500);
      if (this.disposed || !this.settingsBackdrop.classList.contains('is-open')) {
        await session.stop().catch(() => undefined);
        return;
      }

      const timeoutId = window.setTimeout(() => {
        void this.stopActiveRecording(true);
      }, 3500);

      this.activeRecording = {
        slotId: slot.id,
        stop: session.stop,
        timeoutId,
      };
      this.syncVoiceStudioUI();
    } catch (err) {
      const msg =
        err instanceof Error ? `${err.name} ${err.message}`.toLowerCase() : '';
      if (
        msg.includes('notallowed') ||
        msg.includes('permission') ||
        msg.includes('denied')
      ) {
        this.setVoiceStudioStatus(
          'Microphone permission was denied. Allow mic access in your browser settings to record!',
          'warn'
        );
      } else {
        this.setVoiceStudioStatus(
          'Could not access microphone. Please check your device mic and try again.',
          'warn'
        );
      }
      this.syncVoiceStudioUI();
    } finally {
      this.voiceOperationBusy = false;
    }
  }

  private async stopActiveRecording(save: boolean): Promise<void> {
    const current = this.activeRecording;
    if (!current) return;

    this.activeRecording = null;
    window.clearTimeout(current.timeoutId);
    this.syncVoiceStudioUI();

    try {
      const blob = await current.stop();
      if (save && !this.disposed && blob.size > 0) {
        await this.voiceStore.saveRecording(current.slotId, blob);
        this.recordedBlobs.set(current.slotId, blob);
        this.setVoiceStudioStatus(
          'Saved! Tap ▶ to preview or race to hear it!',
          'success'
        );
        this.handlers.onFamilyVoiceChanged?.();
      } else if (!save) {
        this.setVoiceStudioStatus('Recording cancelled.', 'info');
      }
    } catch {
      if (save) {
        this.setVoiceStudioStatus(
          'Recording finished — tap Rec to try again.',
          'warn'
        );
      }
    } finally {
      if (!this.disposed) {
        this.syncVoiceStudioUI();
      }
    }
  }

  private async handlePlaySlot(slotId: string): Promise<void> {
    if (this.disposed || this.activeRecording) return;
    const blob = this.recordedBlobs.get(slotId);
    if (!blob) return;

    try {
      await this.voiceStore.previewBlob(blob);
    } catch {
      this.setVoiceStudioStatus(
        'Could not play back that recording.',
        'warn'
      );
    }
  }

  private async handleDeleteSlot(slotId: string): Promise<void> {
    if (this.disposed || this.activeRecording) return;

    try {
      await this.voiceStore.deleteRecording(slotId);
      this.recordedBlobs.delete(slotId);
      this.syncVoiceStudioUI();
      this.setVoiceStudioStatus('Recording deleted.', 'info');
      this.handlers.onFamilyVoiceChanged?.();
    } catch {
      this.setVoiceStudioStatus('Could not delete that recording.', 'warn');
    }
  }

  private addToggleRow(
    parent: HTMLElement,
    label: string,
    hint: string,
    onToggle: () => void
  ): HTMLButtonElement {
    const row = el('div', 'nb-setting-row');
    const labelWrap = el('div', 'nb-setting-label-wrap');
    labelWrap.append(
      el('span', 'nb-setting-label', label),
      el('span', 'nb-setting-hint', hint)
    );
    const toggle = el('button', 'nb-toggle') as HTMLButtonElement;
    toggle.type = 'button';
    toggle.setAttribute('aria-label', label);
    this.listen(toggle, 'click', onToggle);
    row.append(labelWrap, toggle);
    parent.appendChild(row);
    return toggle;
  }

  private patchSetting(patch: Partial<ParentSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.updateSettings(this.settings);
    this.handlers.onSettingsChange({ ...this.settings });
  }

  private openSettingsDrawer(): void {
    this.settingsBackdrop.classList.add('is-open');
    void this.refreshFamilyVoices();
  }

  private closeSettingsDrawer(): void {
    const wasOpen = this.settingsBackdrop.classList.contains('is-open');
    this.settingsBackdrop.classList.remove('is-open');
    if (this.activeRecording) {
      void this.stopActiveRecording(false);
    }
    if (
      wasOpen &&
      (this.currentScreen === 'playing' || this.currentScreen === 'countdown')
    ) {
      this.handlers.onPauseToggle();
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  public setScreen(screen: GameScreen): void {
    this.currentScreen = screen;
    const activeNode = this.screens[screen];

    const uniqueNodes = new Set(Object.values(this.screens));
    for (const node of uniqueNodes) {
      const isCurrent = node === activeNode;
      node.classList.toggle('is-active', isCurrent);
      node.setAttribute('aria-hidden', String(!isCurrent));
    }

    if (screen !== 'playing' && screen !== 'countdown') {
      this.clearHeldTouchInputs();
      this.clearCommentaryToast();
    }
    if (screen !== 'garage') {
      this.updateGarageCountHighlight(null, NUMBERBLOCK_SPECS[this.selectedRacer].id);
    }
  }

  public setSelectedMode(mode: GameMode): void {
    this.selectedMode = mode;
    this.modeCruiseCard.classList.toggle('is-selected', mode === 'count-cruise');
    this.modeMathCard.classList.toggle('is-selected', mode === 'rally-math');
  }

  public setSelectedRacer(id: NumberblockId): void {
    this.selectedRacer = id;
    const spec = NUMBERBLOCK_SPECS[id];

    // Title screen chip
    this.titleRacerChipNum.textContent = String(id);
    this.titleRacerChipNum.style.background =
      id === 7
        ? 'linear-gradient(135deg, #E53935, #FDD835, #29B6F6)'
        : spec.primaryColor;
    this.titleRacerChipNum.style.color =
      id === 10 ? '#E53935' : getReadableBadgeTextColor(spec.primaryColor);
    this.titleRacerChipNum.style.borderColor = id === 10 ? '#E53935' : '#ffffff';
    this.titleRacerChipLabel.textContent = `Racer: ${spec.name}`;

    // Garage top banner
    this.garageNumBadge.textContent = String(id);
    this.garageNumBadge.style.background =
      id === 7
        ? 'linear-gradient(135deg, #E53935, #FDD835, #29B6F6, #AB47BC)'
        : spec.primaryColor;
    this.garageNumBadge.style.color =
      id === 10 ? '#E53935' : getReadableBadgeTextColor(spec.primaryColor);
    this.garageNumBadge.style.borderColor = id === 10 ? '#E53935' : '#ffffff';

    this.garageNameEl.textContent = spec.name;
    this.garageWheelPill.textContent = spec.carStyleName;
    this.garageCatchphraseEl.textContent = spec.catchphrase;

    for (const [tileId, tile] of this.racerTiles.entries()) {
      tile.classList.toggle('is-selected', tileId === id);
    }
  }

  public updateGarageCountHighlight(step: number | null, total: number): void {
    if (step === null) {
      this.garageCountPill.classList.remove('is-visible');
      return;
    }
    this.garageCountStepEl.textContent = String(step);
    this.garageCountOfEl.textContent = `of ${total}`;
    this.garageCountPill.classList.remove('is-visible');
    void this.garageCountPill.offsetWidth;
    this.garageCountPill.classList.add('is-visible');
  }

  public showCountdown(label: string, accentColor: string): void {
    this.hudCountdownStamp.textContent = label;
    this.hudCountdownStamp.style.background = accentColor;
    this.hudCountdownStamp.style.color = getReadableBadgeTextColor(accentColor);
    this.hudCountdownStamp.classList.remove('is-visible');
    void this.hudCountdownStamp.offsetWidth;
    this.hudCountdownStamp.classList.add('is-visible');
  }

  public hideCountdown(): void {
    this.hudCountdownStamp.classList.remove('is-visible');
  }

  public updateHud(hud: HudState): void {
    const spec = NUMBERBLOCK_SPECS[hud.currentNumber];
    renderMiniGrid(this.hudMiniGrid, hud.currentNumber);
    this.hudRacerNum.textContent = String(hud.currentNumber);
    this.hudRacerName.textContent = spec.name;
    this.hudRacerWheels.textContent = `${hud.currentNumber} 🛞`;
    this.hudBlobsValue.textContent = String(hud.blobsCollected);

    const isCruise = hud.mode === 'count-cruise';
    this.hudCountTrack.style.display = isCruise ? 'flex' : 'none';
    this.hudRallyWrap.style.display = isCruise ? 'none' : 'flex';

    if (isCruise) {
      const target = Math.max(1, hud.countTarget);
      if (this.hudCountNodes.length !== target) {
        this.rebuildCountTrack(target);
      }
      const clampedDone = Math.max(0, Math.min(target, hud.countProgress));
      this.hudCountSummary.textContent = `${clampedDone} / ${target}`;
      for (let i = 0; i < this.hudCountNodes.length; i += 1) {
        const num = (i + 1) as NumberblockId;
        const node = this.hudCountNodes[i];
        const done = num <= hud.countProgress;
        const next = num === hud.countProgress + 1;
        node.classList.toggle('is-done', done);
        node.classList.toggle('is-next', next);

        if (done) {
          const nodeSpec = NUMBERBLOCK_SPECS[num] ?? spec;
          node.style.background =
            num === 7
              ? 'linear-gradient(135deg, #E53935, #FDD835, #29B6F6, #AB47BC)'
              : nodeSpec.primaryColor;
          node.style.color =
            num === 10
              ? '#E53935'
              : getReadableBadgeTextColor(nodeSpec.primaryColor);
          node.style.borderColor = num === 10 ? '#E53935' : '#ffffff';
        } else {
          node.style.background = '';
          node.style.color = '';
          node.style.borderColor = '';
        }
      }
    } else {
      const clampedProgress = Math.max(0, Math.min(1, hud.trackProgress));
      const pct = `${(clampedProgress * 100).toFixed(1)}%`;
      this.hudPosPill.textContent = `${formatOrdinal(hud.racePosition)} / ${hud.totalRacers}`;
      this.hudTrackFill.style.width = pct;
      this.hudTrackKartDot.style.left = pct;
      this.hudTrackKartDot.style.background =
        spec.id === 10 ? '#E53935' : spec.primaryColor;
    }

    const nextCommentary = hud.commentary.trim();
    if (!nextCommentary) {
      this.lastCommentary = '';
    } else if (nextCommentary !== this.lastCommentary) {
      this.showCommentaryToast(nextCommentary);
    }

    const boostReady = hud.boostCharge >= 0.85;
    this.jumpTouchBtn.classList.toggle('is-boost-ready', boostReady);
    this.jumpBoostSub.textContent = boostReady ? 'BOOST!' : 'HOP';
  }

  public showMathBanner(event: MathEventPayload): void {
    if (this.mathBannerTimer !== null) {
      window.clearTimeout(this.mathBannerTimer);
      this.mathBannerTimer = null;
    }

    this.hudMathTitle.textContent = event.title;
    this.hudMathSubtitle.textContent = event.subtitle;

    this.hudMathEquation.replaceChildren();
    this.hudMathEquation.append(
      this.createMathTermWithPips(event.left),
      el('span', 'nb-math-op', event.operator === '-' ? '−' : '+'),
      this.createMathTermWithPips(event.right),
      el('span', 'nb-math-op', '='),
      this.createMathTermWithPips(event.result)
    );

    this.hudMathBanner.style.borderColor = event.color;
    this.hudMathBanner.classList.remove('is-visible');
    void this.hudMathBanner.offsetWidth;
    this.hudMathBanner.classList.add('is-visible');

    this.mathBannerTimer = window.setTimeout(() => {
      this.hudMathBanner.classList.remove('is-visible');
      this.mathBannerTimer = null;
    }, 2800);
  }

  private createMathTermWithPips(value: number): HTMLElement {
    const term = el('div', 'nb-math-term');
    const chip = this.createMathChip(value);
    const pips = el('div', 'nb-math-pips');

    const clamped = Math.max(1, Math.min(10, Math.round(value))) as NumberblockId;
    const spec = NUMBERBLOCK_SPECS[clamped];
    for (let i = 0; i < clamped; i += 1) {
      const pip = el('span', 'nb-math-pip');
      const block = spec.blocks[i];
      const color = block ? block.color : spec.primaryColor;
      pip.style.backgroundColor = color;
      if (clamped === 10 || color.toLowerCase() === '#ffffff') {
        pip.style.borderColor = '#E53935';
      }
      pips.appendChild(pip);
    }

    term.append(chip, pips);
    return term;
  }

  private createMathChip(value: number): HTMLElement {
    const chip = el('span', 'nb-math-chip', String(value));
    const clamped = Math.max(1, Math.min(10, Math.round(value))) as NumberblockId;
    const spec = NUMBERBLOCK_SPECS[clamped];
    if (clamped === 7) {
      chip.style.background =
        'linear-gradient(135deg, #E53935, #FDD835, #29B6F6, #AB47BC)';
    } else if (clamped === 10) {
      chip.style.background = '#ffffff';
      chip.style.color = '#E53935';
      chip.style.borderColor = '#E53935';
      chip.style.textShadow = 'none';
    } else {
      chip.style.background = spec.primaryColor;
      chip.style.color = getReadableBadgeTextColor(spec.primaryColor);
      if (clamped === 3) {
        chip.style.textShadow = 'none';
      }
    }
    return chip;
  }

  public showCountPopup(num: number, word: string, color: string): void {
    if (this.countPopupTimer !== null) {
      window.clearTimeout(this.countPopupTimer);
      this.countPopupTimer = null;
    }

    this.hudCountPopupNum.textContent = String(num);
    this.hudCountPopupNum.style.color =
      color.toLowerCase() === '#ffffff' ? '#E53935' : color;
    this.hudCountPopupWord.textContent = word;
    this.hudCountPopup.style.borderColor = color;

    this.hudCountPopupDots.replaceChildren();
    const dotCount = Math.max(1, Math.min(10, num));
    for (let i = 0; i < dotCount; i += 1) {
      const dot = el('span', 'nb-count-popup-dot');
      dot.style.backgroundColor =
        color.toLowerCase() === '#ffffff' ? '#E53935' : color;
      this.hudCountPopupDots.appendChild(dot);
    }

    this.hudCountPopup.classList.remove('is-visible');
    void this.hudCountPopup.offsetWidth;
    this.hudCountPopup.classList.add('is-visible');

    this.countPopupTimer = window.setTimeout(() => {
      this.hudCountPopup.classList.remove('is-visible');
      this.countPopupTimer = null;
    }, 1550);
  }

  public showPitStopQuiz(question: PitStopQuestion): void {
    this.pitStopPromptEl.textContent = question.prompt;
    this.pitStopFeedbackEl.className = 'nb-pitstop-feedback';
    this.pitStopFeedbackEl.textContent = '';

    this.pitStopVisualsEl.replaceChildren();
    if (question.visualType === 'equation' && question.leftNum !== undefined && question.rightNum !== undefined) {
      const eq = el('div', 'nb-pitstop-eq-group');
      eq.append(
        this.createMathChip(question.leftNum),
        el('span', undefined, question.operator === '-' ? '−' : '+'),
        this.createMathChip(question.rightNum),
        el('span', undefined, '='),
        el('span', undefined, '?')
      );
      this.pitStopVisualsEl.appendChild(eq);
    } else if (question.visualType === 'count-wheels') {
      for (let i = 0; i < question.visualCount; i += 1) {
        const wheelWrap = el('span', 'nb-pitstop-wheel');
        wheelWrap.appendChild(createWheelSvg());
        this.pitStopVisualsEl.appendChild(wheelWrap);
      }
    } else {
      const count = Math.max(1, Math.min(10, question.visualCount));
      for (let i = 0; i < count; i += 1) {
        const block = el('span', 'nb-pitstop-block');
        block.style.backgroundColor = question.accentColor || '#29B6F6';
        this.pitStopVisualsEl.appendChild(block);
      }
    }

    this.pitStopChoicesEl.replaceChildren();
    for (const choice of question.choices) {
      const btn = el(
        'button',
        'nb-btn nb-btn--sun nb-pitstop-choice-btn',
        String(choice)
      ) as HTMLButtonElement;
      btn.type = 'button';
      this.listen(btn, 'click', () => this.handlers.onPitStopAnswer(choice));
      this.pitStopChoicesEl.appendChild(btn);
    }
  }

  public showPitStopFeedback(correct: boolean, message: string): void {
    this.pitStopFeedbackEl.textContent = message;
    this.pitStopFeedbackEl.className = `nb-pitstop-feedback ${
      correct ? 'is-correct' : 'is-wrong'
    }`;
  }

  public showPodium(result: PodiumResult): void {
    this.podiumStarsEl.replaceChildren();
    for (let i = 1; i <= 3; i += 1) {
      const earned = i <= result.starsEarned;
      this.podiumStarsEl.appendChild(
        createStarIcon(earned ? 'nb-star-svg' : 'nb-star-svg is-dim')
      );
    }

    const showOneSurprise =
      result.isOneSurpriseWin || result.finisherNumber === 1;
    this.podiumOneBadge.classList.toggle('is-visible', showOneSurprise);

    const finisherName = NUMBER_WORDS[result.finisherNumber];
    if (showOneSurprise) {
      this.podiumTitleEl.textContent = `${finisherName} wins the Golden Trophy!`;
    } else if (result.mode === 'count-cruise') {
      this.podiumTitleEl.textContent = `Hooray! ${finisherName} counted to ${result.highestCount}!`;
    } else {
      this.podiumTitleEl.textContent = `${finisherName} finished ${formatOrdinal(
        result.place
      )}!`;
    }

    this.podiumStatsEl.replaceChildren();
    this.podiumStatsEl.append(
      el('span', 'nb-stat-pill', `Blobs: ${result.blobsCollected}`),
      result.mode === 'count-cruise'
        ? el('span', 'nb-stat-pill', `Counted: 1–${result.highestCount}`)
        : el('span', 'nb-stat-pill', `Math Magic: ${result.equationsSolved}`)
    );
  }

  public updateSettings(settings: ParentSettings): void {
    this.settings = { ...settings };
    this.setToggleState(this.toggleMusic, settings.musicEnabled);
    this.setToggleState(this.toggleSfx, settings.sfxEnabled);
    this.setToggleState(this.toggleVoice, settings.voiceEnabled);
    this.setToggleState(this.toggleFamilyVoice, settings.useFamilyVoice);
    this.setToggleState(this.toggleAutoSteer, settings.autoSteerAssist);
    this.setToggleState(this.togglePitStop, settings.pitStopQuizzes);

    for (const [speedVal, btn] of this.segSpeedButtons.entries()) {
      btn.classList.toggle('is-active', settings.carSpeed === speedVal);
    }
    for (const [lenVal, btn] of this.segLengthButtons.entries()) {
      btn.classList.toggle('is-active', settings.raceLength === lenVal);
    }

    this.segCount5.classList.toggle('is-active', settings.maxCountTarget === 5);
    this.segCount10.classList.toggle(
      'is-active',
      settings.maxCountTarget === 10
    );
  }

  public dispose(): void {
    this.disposed = true;
    if (this.activeRecording) {
      void this.stopActiveRecording(false);
    }
    if (this.mathBannerTimer !== null) {
      window.clearTimeout(this.mathBannerTimer);
      this.mathBannerTimer = null;
    }
    if (this.countPopupTimer !== null) {
      window.clearTimeout(this.countPopupTimer);
      this.countPopupTimer = null;
    }
    this.clearCommentaryToast();
    this.clearHeldTouchInputs();
    for (const off of this.cleanups) {
      off();
    }
    this.cleanups.length = 0;
    this.racerTiles.clear();
    this.voiceSlotControls.clear();
    this.recordedBlobs.clear();
    this.root.replaceChildren();
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private showCommentaryToast(text: string): void {
    this.lastCommentary = text;
    this.hudCommentaryText.textContent = text;
    if (this.commentaryTimer !== null) {
      window.clearTimeout(this.commentaryTimer);
      this.commentaryTimer = null;
    }
    this.hudCommentaryPill.classList.remove('is-visible');
    void this.hudCommentaryPill.offsetWidth;
    this.hudCommentaryPill.classList.add('is-visible');
    this.commentaryTimer = window.setTimeout(() => {
      this.hudCommentaryPill.classList.remove('is-visible');
      this.commentaryTimer = null;
    }, 3000);
  }

  private clearCommentaryToast(): void {
    if (this.commentaryTimer !== null) {
      window.clearTimeout(this.commentaryTimer);
      this.commentaryTimer = null;
    }
    this.lastCommentary = '';
    if (this.hudCommentaryPill) {
      this.hudCommentaryPill.classList.remove('is-visible');
    }
  }

  private setToggleState(btn: HTMLButtonElement, on: boolean): void {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  private clearHeldTouchInputs(): void {
    if (
      this.leftPointers.size > 0 ||
      this.rightPointers.size > 0 ||
      this.jumpPointers.size > 0
    ) {
      this.leftPointers.clear();
      this.rightPointers.clear();
      this.jumpPointers.clear();
      this.handlers.onTouchInput({ left: false, right: false, jump: false, boost: false });
    }
  }

  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (ev: HTMLElementEventMap[K]) => void
  ): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }
}
