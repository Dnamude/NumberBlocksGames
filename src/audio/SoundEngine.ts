import { NUMBER_WORDS } from '../data/numberblocks';
import { NumberblockId, ParentSettings } from '../types/game';

export type MusicMode = 'menu' | 'race' | 'podium';

interface StepNote {
  lead?: number;
  harmony?: number;
  bass?: number;
  kick?: boolean;
  shaker?: boolean;
  accent?: boolean;
}

interface MusicPattern {
  bpm: number;
  stepsPerBeat: number;
  steps: StepNote[];
}

const C_MAJOR_SCALE_HZ: readonly number[] = [
  523.25, // 1: C5
  587.33, // 2: D5
  659.25, // 3: E5
  698.46, // 4: F5
  783.99, // 5: G5
  880.0,  // 6: A5
  987.77, // 7: B5
  1046.5, // 8: C6
  1174.66, // 9: D6
  1318.51, // 10: E6
];

// MIDI note helper for crisp pattern authoring
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Note constants (MIDI)
const N = {
  C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, Bb3: 58, B3: 59,
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, Bb4: 70, B4: 71,
  C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83,
  C6: 84, D6: 86, E6: 88, G6: 91,
} as const;

const MENU_PATTERN: MusicPattern = {
  bpm: 116,
  stepsPerBeat: 2, // eighth notes, 32 steps = 4 bars of 4/4
  steps: [
    // Bar 1 (C major)
    { lead: N.E5, bass: N.C3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.C6, bass: N.G3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.A5, harmony: N.F5, bass: N.C3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.E5, bass: N.G3, kick: true },
    { lead: N.D5, shaker: true },
    // Bar 2 (F -> G)
    { lead: N.F5, harmony: N.A4, bass: N.F3, kick: true },
    { lead: N.A5, shaker: true },
    { lead: N.G5, bass: N.C4, kick: true },
    { lead: N.E5, shaker: true },
    { lead: N.D5, harmony: N.B4, bass: N.G3, kick: true },
    { lead: N.E5, shaker: true },
    { lead: N.G5, bass: N.D3, kick: true },
    { shaker: true },
    // Bar 3 (C -> Am)
    { lead: N.C5, bass: N.C3, kick: true },
    { lead: N.E5, shaker: true },
    { lead: N.G5, bass: N.G3, kick: true },
    { lead: N.C6, shaker: true },
    { lead: N.E6, harmony: N.C6, bass: N.A3, kick: true, accent: true },
    { lead: N.D6, shaker: true },
    { lead: N.C6, bass: N.E3, kick: true },
    { lead: N.A5, shaker: true },
    // Bar 4 (F -> G -> C turnaround)
    { lead: N.F5, harmony: N.A5, bass: N.F3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.A5, bass: N.G3, kick: true },
    { lead: N.B5, shaker: true },
    { lead: N.C6, harmony: N.E5, bass: N.C3, kick: true, accent: true },
    { shaker: true },
    { lead: N.G5, bass: N.G3, kick: true },
    { shaker: true },
  ],
};

const RACE_PATTERN: MusicPattern = {
  bpm: 138,
  stepsPerBeat: 2, // punchy driving eighth notes, 32 steps
  steps: [
    // Bar 1 (Energetic C rally riff)
    { lead: N.C5, harmony: N.E5, bass: N.C3, kick: true, accent: true },
    { lead: N.C5, bass: N.C4, shaker: true },
    { lead: N.E5, bass: N.C3, kick: true },
    { lead: N.G5, bass: N.C4, shaker: true },
    { lead: N.C6, harmony: N.G5, bass: N.G3, kick: true, accent: true },
    { lead: N.A5, shaker: true },
    { lead: N.G5, bass: N.E3, kick: true },
    { lead: N.E5, bass: N.G3, shaker: true },
    // Bar 2 (Bb / F Mario-Kart bounce)
    { lead: N.F5, harmony: N.A5, bass: N.F3, kick: true, accent: true },
    { lead: N.G5, bass: N.F4, shaker: true },
    { lead: N.A5, bass: N.F3, kick: true },
    { lead: N.C6, bass: N.C4, shaker: true },
    { lead: N.Bb4 + 12, harmony: N.D5, bass: N.Bb3, kick: true },
    { lead: N.A5, shaker: true },
    { lead: N.G5, bass: N.G3, kick: true },
    { lead: N.F5, bass: N.G3, shaker: true },
    // Bar 3 (Upbeat climb)
    { lead: N.E5, harmony: N.C5, bass: N.C3, kick: true, accent: true },
    { lead: N.G5, bass: N.C4, shaker: true },
    { lead: N.C6, bass: N.E3, kick: true },
    { lead: N.D6, bass: N.G3, shaker: true },
    { lead: N.E6, harmony: N.C6, bass: N.A3, kick: true, accent: true },
    { lead: N.C6, shaker: true },
    { lead: N.A5, bass: N.E3, kick: true },
    { lead: N.G5, bass: N.A3, shaker: true },
    // Bar 4 (Turnaround drive)
    { lead: N.F5, harmony: N.A5, bass: N.F3, kick: true },
    { lead: N.A5, bass: N.F3, shaker: true },
    { lead: N.G5, harmony: N.B5, bass: N.G3, kick: true },
    { lead: N.B5, bass: N.G3, shaker: true },
    { lead: N.D6, harmony: N.G5, bass: N.G3, kick: true, accent: true },
    { lead: N.B5, shaker: true },
    { lead: N.G5, bass: N.G3, kick: true },
    { lead: N.D5, bass: N.B3, shaker: true },
  ],
};

const PODIUM_PATTERN: MusicPattern = {
  bpm: 124,
  stepsPerBeat: 2,
  steps: [
    // Celebratory fanfare loop
    { lead: N.C6, harmony: N.E5, bass: N.C3, kick: true, accent: true },
    { lead: N.G5, shaker: true },
    { lead: N.E5, bass: N.G3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.C6, harmony: N.E6, bass: N.C3, kick: true, accent: true },
    { shaker: true },
    { lead: N.D6, harmony: N.F5, bass: N.G3, kick: true },
    { lead: N.E6, shaker: true },

    { lead: N.F5, harmony: N.A5, bass: N.F3, kick: true, accent: true },
    { lead: N.A5, shaker: true },
    { lead: N.C6, bass: N.C4, kick: true },
    { lead: N.A5, shaker: true },
    { lead: N.G5, harmony: N.B5, bass: N.G3, kick: true, accent: true },
    { lead: N.B5, shaker: true },
    { lead: N.D6, bass: N.G3, kick: true },
    { lead: N.G5, shaker: true },

    { lead: N.E6, harmony: N.C6, bass: N.C3, kick: true, accent: true },
    { lead: N.D6, shaker: true },
    { lead: N.C6, bass: N.A3, kick: true },
    { lead: N.A5, shaker: true },
    { lead: N.F5, harmony: N.A5, bass: N.F3, kick: true },
    { lead: N.G5, shaker: true },
    { lead: N.A5, bass: N.D3, kick: true },
    { lead: N.B5, shaker: true },

    { lead: N.C6, harmony: N.G5, bass: N.C3, kick: true, accent: true },
    { lead: N.E5, shaker: true },
    { lead: N.G5, bass: N.G3, kick: true },
    { lead: N.C6, shaker: true },
    { lead: N.E6, harmony: N.C6, bass: N.C3, kick: true, accent: true },
    { shaker: true },
    { lead: N.G6, harmony: N.E6, bass: N.G3, kick: true, accent: true },
    { shaker: true },
  ],
};

const PATTERNS: Record<MusicMode, MusicPattern> = {
  menu: MENU_PATTERN,
  race: RACE_PATTERN,
  podium: PODIUM_PATTERN,
};

export class SoundEngine {
  private settings: ParentSettings;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimerId: number | null = null;
  private musicSessionGain: GainNode | null = null;
  private currentMusicMode: MusicMode = 'menu';
  private musicShouldPlay = false;
  private nextStepTime = 0;
  private currentStepIndex = 0;
  private musicSessionCounter = 0;

  private preferredVoice: SpeechSynthesisVoice | null = null;
  private voicesBound = false;
  private readonly handleVoicesChanged = (): void => {
    this.selectPreferredVoice();
  };

  private disposed = false;

  constructor(settings: ParentSettings) {
    this.settings = { ...settings };
    this.bindSpeechVoices();
  }

  public unlock(): void {
    if (this.disposed) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const onReady = (): void => {
      if (this.disposed) return;
      if (this.musicShouldPlay && this.settings.musicEnabled && this.musicTimerId === null) {
        this.beginScheduler(this.currentMusicMode);
      }
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.playSilentUnlockTick(ctx);
          onReady();
        })
        .catch(() => {
          // Ignore autoplay restriction errors; next gesture will retry
        });
    } else {
      this.playSilentUnlockTick(ctx);
      onReady();
    }
  }

  public updateSettings(settings: ParentSettings): void {
    if (this.disposed) return;
    const prevMusic = this.settings.musicEnabled;
    const prevVoice = this.settings.voiceEnabled;
    this.settings = { ...settings };

    if (!settings.musicEnabled && prevMusic) {
      this.teardownScheduler();
    } else if (settings.musicEnabled && !prevMusic && this.musicShouldPlay) {
      this.startMusic(this.currentMusicMode);
    }

    if (!settings.voiceEnabled && prevVoice) {
      this.cancelSpeech();
    }
  }

  public startMusic(mode: MusicMode = 'menu'): void {
    if (this.disposed) return;

    const modeChanged = this.currentMusicMode !== mode;
    this.currentMusicMode = mode;
    this.musicShouldPlay = true;

    if (!this.settings.musicEnabled) {
      this.teardownScheduler();
      return;
    }

    // Already playing this exact mode cleanly
    if (!modeChanged && this.musicTimerId !== null) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      // Attempt resume; if still suspended, unlock() will start scheduler on first gesture
      ctx
        .resume()
        .then(() => {
          if (!this.disposed && this.musicShouldPlay && this.settings.musicEnabled) {
            this.beginScheduler(this.currentMusicMode);
          }
        })
        .catch(() => {
          // Will start automatically when unlock() runs
        });
      return;
    }

    this.beginScheduler(mode);
  }

  public stopMusic(): void {
    this.musicShouldPlay = false;
    this.teardownScheduler();
  }

  public playCountNote(num: number): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const clamped = Math.max(1, Math.min(10, Math.round(num)));
    const freq = C_MAJOR_SCALE_HZ[clamped - 1] ?? C_MAJOR_SCALE_HZ[0];
    const now = ctx.currentTime;

    this.playGlockenspielNote(ctx, this.sfxBus, freq, now, 0.38, 0.34);
  }

  public playJump(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.2);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(480, now);
    sub.frequency.exponentialRampToValueAtTime(920, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.25, now);

    osc.connect(gain);
    sub.connect(subGain);
    subGain.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.24);
    sub.stop(now + 0.24);
  }

  public playBoost(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. Filtered rainbow noise whoosh
    const noiseBuf = this.getNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.6, now);
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.38);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.07);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.46);

    // 2. Exhilarating rising rainbow chord sweep
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((hz, idx) => {
      const start = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz * 0.92, start);
      osc.frequency.exponentialRampToValueAtTime(hz * 1.12, start + 0.26);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);

      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  public playBlobPickup(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    // Bright happy coin/marimba double-chime (B5 -> E6)
    this.playGlockenspielNote(ctx, this.sfxBus, 987.77, now, 0.14, 0.24);
    this.playGlockenspielNote(ctx, this.sfxBus, 1318.51, now + 0.065, 0.26, 0.28);
  }

  public playBumpSubtract(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. Silly non-scary cartoon bonk
    const bonk = ctx.createOscillator();
    const bonkGain = ctx.createGain();
    bonk.type = 'triangle';
    bonk.frequency.setValueAtTime(280, now);
    bonk.frequency.exponentialRampToValueAtTime(92, now + 0.16);

    bonkGain.gain.setValueAtTime(0.001, now);
    bonkGain.gain.linearRampToValueAtTime(0.32, now + 0.01);
    bonkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    bonk.connect(bonkGain);
    bonkGain.connect(this.sfxBus);
    bonk.start(now);
    bonk.stop(now + 0.21);

    // 2. Bouncy cartoon wheel-pop blip
    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(190, now + 0.09);
    pop.frequency.exponentialRampToValueAtTime(460, now + 0.18);

    popGain.gain.setValueAtTime(0.001, now + 0.09);
    popGain.gain.linearRampToValueAtTime(0.22, now + 0.105);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    pop.connect(popGain);
    popGain.connect(this.sfxBus);
    pop.start(now + 0.09);
    pop.stop(now + 0.24);
  }

  public playCombineMagic(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    // Radiant magical harp/bell ascending arpeggio
    const arp = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98];
    arp.forEach((hz, i) => {
      const t = now + i * 0.052;
      this.playGlockenspielNote(ctx, this.sfxBus!, hz, t, 0.42, 0.18);
    });
  }

  public playCountdownBeep(go: boolean): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    if (!go) {
      // Crisp Mario-Kart 3-2-1 medium tone (G4 + subtle G5)
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const overGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.0, now);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(783.99, now);
      overGain.gain.setValueAtTime(0.3, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.012);
      gain.gain.setValueAtTime(0.26, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(this.sfxBus);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 0.28);
      overtone.stop(now + 0.28);
    } else {
      // Bright triumphant double-tone for GO!
      const notes = [
        { hz: 783.99, delay: 0, dur: 0.14 },
        { hz: 1046.5, delay: 0.06, dur: 0.48 },
        { hz: 1318.51, delay: 0.06, dur: 0.48 },
      ];
      notes.forEach(({ hz, delay, dur }) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.26, t + 0.015);
        gain.gain.setValueAtTime(0.22, t + dur * 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(this.sfxBus!);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    }
  }

  public playFinishFanfare(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    // Joyful celebratory finish melody: C5 E5 G5 C6 (bounce) G5 C6! + sparkle chord
    const melody: Array<{ hz: number; t: number; dur: number; vol: number }> = [
      { hz: 523.25, t: 0.0, dur: 0.13, vol: 0.24 },
      { hz: 659.25, t: 0.1, dur: 0.13, vol: 0.24 },
      { hz: 783.99, t: 0.2, dur: 0.13, vol: 0.25 },
      { hz: 1046.5, t: 0.3, dur: 0.22, vol: 0.28 },
      { hz: 783.99, t: 0.48, dur: 0.12, vol: 0.23 },
      { hz: 1046.5, t: 0.6, dur: 0.55, vol: 0.3 },
      { hz: 1318.51, t: 0.6, dur: 0.55, vol: 0.22 },
      { hz: 1567.98, t: 0.63, dur: 0.52, vol: 0.18 },
    ];

    melody.forEach((n) => {
      const start = now + n.t;
      this.playWarmLeadNote(ctx, this.sfxBus!, n.hz, start, n.dur, n.vol);
      this.playGlockenspielNote(ctx, this.sfxBus!, n.hz * 2, start, n.dur * 0.7, n.vol * 0.25);
    });
  }

  public playUiClick(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playSneeze(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. "Ah..." comedic rising inhale tone
    const inhale = ctx.createOscillator();
    const inhaleGain = ctx.createGain();
    inhale.type = 'triangle';
    inhale.frequency.setValueAtTime(340, now);
    inhale.frequency.exponentialRampToValueAtTime(580, now + 0.14);

    inhaleGain.gain.setValueAtTime(0.001, now);
    inhaleGain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    inhaleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    inhale.connect(inhaleGain);
    inhaleGain.connect(this.sfxBus);
    inhale.start(now);
    inhale.stop(now + 0.16);

    // 2. "CHOO!" filter-swept playful burst
    const chooTime = now + 0.18;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, chooTime);
    filter.frequency.setValueAtTime(3200, chooTime);
    filter.frequency.exponentialRampToValueAtTime(750, chooTime + 0.22);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, chooTime);
    noiseGain.gain.linearRampToValueAtTime(0.34, chooTime + 0.018);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, chooTime + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxBus);
    noise.start(chooTime);
    noise.stop(chooTime + 0.26);

    // 3. Cute cartoon "oo!" pitch-drop squeak
    const squeak = ctx.createOscillator();
    const squeakGain = ctx.createGain();
    squeak.type = 'sine';
    squeak.frequency.setValueAtTime(760, chooTime);
    squeak.frequency.exponentialRampToValueAtTime(260, chooTime + 0.19);

    squeakGain.gain.setValueAtTime(0.001, chooTime);
    squeakGain.gain.linearRampToValueAtTime(0.18, chooTime + 0.015);
    squeakGain.gain.exponentialRampToValueAtTime(0.001, chooTime + 0.21);

    squeak.connect(squeakGain);
    squeakGain.connect(this.sfxBus);
    squeak.start(chooTime);
    squeak.stop(chooTime + 0.22);
  }

  public speak(text: string, priority: 'high' | 'normal' = 'normal'): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    if (!text.trim()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (typeof SpeechSynthesisUtterance === 'undefined') return;

    try {
      const synth = window.speechSynthesis;
      if (priority === 'high') {
        synth.cancel();
      }

      if (!this.preferredVoice) {
        this.selectPreferredVoice();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
        utterance.lang = this.preferredVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.12;
      utterance.volume = 0.95;

      synth.speak(utterance);
    } catch {
      // Never throw if speechSynthesis is blocked or unavailable
    }
  }

  public speakNumber(num: number): void {
    if (this.disposed) return;
    this.playCountNote(num);
    const word = this.numberToWord(num);
    this.speak(word, 'high');
  }

  public speakEquation(
    left: number,
    op: '+' | '-',
    right: number,
    result: number
  ): void {
    if (this.disposed) return;
    const leftWord = this.numberToWord(left);
    const rightWord = this.numberToWord(right);
    const resultWord = this.numberToWord(result);
    const opWord = op === '+' ? 'plus' : 'minus';
    this.speak(`${leftWord} ${opWord} ${rightWord} equals ${resultWord}!`, 'high');
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.musicShouldPlay = false;
    this.teardownScheduler();
    this.cancelSpeech();
    this.unbindSpeechVoices();

    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        // Ignore close errors
      }
      this.ctx = null;
    }

    this.masterGain = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
  }

  // =========================================================================
  // Internal Audio Context & Routing
  // =========================================================================

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.88, ctx.currentTime);

      const musicBus = ctx.createGain();
      musicBus.gain.setValueAtTime(0.42, ctx.currentTime);

      const sfxBus = ctx.createGain();
      sfxBus.gain.setValueAtTime(0.85, ctx.currentTime);

      musicBus.connect(masterGain);
      sfxBus.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
      return ctx;
    } catch {
      return null;
    }
  }

  private getReadyContext(): AudioContext | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Will resume on next user gesture
      });
      return null;
    }
    return ctx;
  }

  private playSilentUnlockTick(ctx: AudioContext): void {
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Ignore
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1.0);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  // =========================================================================
  // Procedural Music Lookahead Scheduler
  // =========================================================================

  private beginScheduler(mode: MusicMode): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.disposed) return;

    this.teardownScheduler();

    const sessionId = ++this.musicSessionCounter;
    const sessionGain = ctx.createGain();
    sessionGain.gain.setValueAtTime(0.001, ctx.currentTime);
    sessionGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.08);
    sessionGain.connect(this.musicBus);
    this.musicSessionGain = sessionGain;

    this.currentStepIndex = 0;
    this.nextStepTime = ctx.currentTime + 0.04;

    const pattern = PATTERNS[mode];
    const secondsPerStep = 60 / pattern.bpm / pattern.stepsPerBeat;
    const scheduleAheadTime = 0.14;

    const tick = (): void => {
      if (
        this.disposed ||
        sessionId !== this.musicSessionCounter ||
        !this.ctx ||
        !this.musicSessionGain ||
        !this.settings.musicEnabled ||
        !this.musicShouldPlay
      ) {
        return;
      }

      if (this.ctx.state !== 'running') {
        return;
      }

      // Catch up gracefully if tab was backgrounded
      if (this.nextStepTime < this.ctx.currentTime - 0.25) {
        this.nextStepTime = this.ctx.currentTime + 0.03;
      }

      while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
        const step = pattern.steps[this.currentStepIndex % pattern.steps.length];
        this.scheduleMusicStep(
          this.ctx,
          this.musicSessionGain,
          step,
          this.nextStepTime,
          secondsPerStep,
          mode
        );
        this.nextStepTime += secondsPerStep;
        this.currentStepIndex = (this.currentStepIndex + 1) % pattern.steps.length;
      }
    };

    tick();
    this.musicTimerId = window.setInterval(tick, 25);
  }

  private teardownScheduler(): void {
    this.musicSessionCounter++;

    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }

    if (this.musicSessionGain && this.ctx) {
      const oldGain = this.musicSessionGain;
      this.musicSessionGain = null;
      try {
        const now = this.ctx.currentTime;
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0.0001, now + 0.06);
        window.setTimeout(() => {
          try {
            oldGain.disconnect();
          } catch {
            // Ignore
          }
        }, 90);
      } catch {
        // Ignore
      }
    }
  }

  private scheduleMusicStep(
    ctx: AudioContext,
    dest: AudioNode,
    step: StepNote,
    time: number,
    stepDur: number,
    mode: MusicMode
  ): void {
    const accentMult = step.accent ? 1.18 : 1.0;

    if (step.lead !== undefined) {
      const hz = midiToHz(step.lead);
      if (mode === 'race') {
        this.playMarimbaNote(ctx, dest, hz, time, stepDur * 1.15, 0.24 * accentMult);
      } else if (mode === 'podium') {
        this.playGlockenspielNote(ctx, dest, hz, time, stepDur * 1.5, 0.2 * accentMult);
      } else {
        this.playMarimbaNote(ctx, dest, hz, time, stepDur * 1.35, 0.22 * accentMult);
      }
    }

    if (step.harmony !== undefined) {
      const hz = midiToHz(step.harmony);
      this.playWarmLeadNote(ctx, dest, hz, time, stepDur * 1.25, 0.11 * accentMult);
    }

    if (step.bass !== undefined) {
      const hz = midiToHz(step.bass);
      this.playBouncyBassNote(ctx, dest, hz, time, stepDur * 0.9, 0.26);
    }

    if (step.kick) {
      this.playSoftKick(ctx, dest, time, mode === 'race' ? 0.26 : 0.18);
    }

    if (step.shaker) {
      this.playGentleShaker(ctx, dest, time, mode === 'race' ? 0.085 : 0.055);
    }
  }

  // =========================================================================
  // Instrument Voice Primitives
  // =========================================================================

  private playMarimbaNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
    dur: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const overGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 4, time); // bright wooden marimba strike
    overGain.gain.setValueAtTime(0.16, time);
    overGain.gain.exponentialRampToValueAtTime(0.005, time + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 5, 5600), time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.08, dur));

    osc.connect(filter);
    overtone.connect(overGain);
    overGain.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + dur + 0.03);
    overtone.stop(time + 0.06);
  }

  private playGlockenspielNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
    dur: number,
    volume: number
  ): void {
    const fundamental = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const shimmer = ctx.createOscillator();

    const master = ctx.createGain();
    const harmGain = ctx.createGain();
    const shimGain = ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, time);

    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2, time);
    harmGain.gain.setValueAtTime(0.28, time);
    harmGain.gain.exponentialRampToValueAtTime(0.01, time + dur * 0.65);

    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(freq * 3.01, time);
    shimGain.gain.setValueAtTime(0.12, time);
    shimGain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.12, dur * 0.4));

    master.gain.setValueAtTime(0.001, time);
    master.gain.linearRampToValueAtTime(volume, time + 0.005);
    master.gain.exponentialRampToValueAtTime(0.001, time + dur);

    fundamental.connect(master);
    harmonic.connect(harmGain);
    harmGain.connect(master);
    shimmer.connect(shimGain);
    shimGain.connect(master);
    master.connect(dest);

    fundamental.start(time);
    harmonic.start(time);
    shimmer.start(time);

    const stopAt = time + dur + 0.03;
    fundamental.stop(stopAt);
    harmonic.stop(stopAt);
    shimmer.stop(stopAt);
  }

  private playWarmLeadNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
    dur: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private playBouncyBassNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
    dur: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3.5, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.08, dur));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private playSoftKick(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(52, time + 0.085);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + 0.13);
  }

  private playGentleShaker(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    volume: number
  ): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5200, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(time);
    noise.stop(time + 0.055);
  }

  // =========================================================================
  // Web Speech API Helpers
  // =========================================================================

  private bindSpeechVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.selectPreferredVoice();
      if (!this.voicesBound && typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
        this.voicesBound = true;
      }
    } catch {
      // Ignore if speechSynthesis is restricted
    }
  }

  private unbindSpeechVoices(): void {
    if (!this.voicesBound || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      if (typeof window.speechSynthesis.removeEventListener === 'function') {
        window.speechSynthesis.removeEventListener('voiceschanged', this.handleVoicesChanged);
      }
    } catch {
      // Ignore
    }
    this.voicesBound = false;
  }

  private selectPreferredVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const englishVoices = voices.filter((v) =>
        v.lang.toLowerCase().startsWith('en')
      );
      if (englishVoices.length === 0) return;

      const preferredNames = [
        'google uk english female',
        'google us english',
        'samantha',
        'libby',
        'sonia',
        'aria',
        'jenny',
        'karen',
        'serena',
        'daniel',
      ];

      for (const target of preferredNames) {
        const match = englishVoices.find((v) =>
          v.name.toLowerCase().includes(target)
        );
        if (match) {
          this.preferredVoice = match;
          return;
        }
      }

      const british = englishVoices.find((v) =>
        v.lang.toLowerCase().startsWith('en-gb')
      );
      this.preferredVoice = british ?? englishVoices[0];
    } catch {
      // Ignore
    }
  }

  private cancelSpeech(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }

  private numberToWord(num: number): string {
    const rounded = Math.round(num);
    if (rounded === 0) return 'Zero';
    if (rounded >= 1 && rounded <= 10) {
      return NUMBER_WORDS[rounded as NumberblockId];
    }
    return String(rounded);
  }
}
