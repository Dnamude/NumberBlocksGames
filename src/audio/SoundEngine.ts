import { NUMBER_WORDS } from '../data/numberblocks';
import {
  CHARACTER_VOICE_PROFILES,
  GeneratedVoiceManifest,
  VoiceSpeakerId,
  getEquationClipId,
} from '../data/voiceManifest';
import { NumberblockId, ParentSettings } from '../types/game';
import { FamilyVoiceStore } from './FamilyVoiceStore';

export type MusicMode = 'menu' | 'race' | 'podium';

export interface VoicePackStatus {
  geminiClipsLoaded: number;
  familyClipsCount: number;
  activeTier: 'family' | 'gemini' | 'webspeech';
}

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
  880.0, // 6: A5
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
  C3: 48,
  D3: 50,
  E3: 52,
  F3: 53,
  G3: 55,
  A3: 57,
  Bb3: 58,
  B3: 59,
  C4: 60,
  D4: 62,
  E4: 64,
  F4: 65,
  G4: 67,
  A4: 69,
  Bb4: 70,
  B4: 71,
  C5: 72,
  D5: 74,
  E5: 76,
  F5: 77,
  G5: 79,
  A5: 81,
  B5: 83,
  C6: 84,
  D6: 86,
  E6: 88,
  G6: 91,
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

interface KartMotionRig {
  purrOsc: OscillatorNode;
  purrFilter: BiquadFilterNode;
  purrGain: GainNode;
  chugLfo: OscillatorNode;
  chugDepth: GainNode;
  boostOscA: OscillatorNode;
  boostOscB: OscillatorNode;
  boostFilter: BiquadFilterNode;
  boostGain: GainNode;
}

export class SoundEngine {
  private settings: ParentSettings;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimerId: number | null = null;
  private musicSessionGain: GainNode | null = null;
  private currentMusicMode: MusicMode = 'menu';
  private musicShouldPlay = false;
  private finalStretchActive = false;
  private nextStepTime = 0;
  private currentStepIndex = 0;
  private musicSessionCounter = 0;

  // Continuous pedal-kart motion synth
  private kartRig: KartMotionRig | null = null;

  // 3-Tier Voice Pipeline state
  private readonly familyStore = new FamilyVoiceStore();
  private geminiBuffers = new Map<string, AudioBuffer>();
  private geminiRawClips = new Map<string, ArrayBuffer>();
  private familyBuffers = new Map<string, AudioBuffer>();
  private familyBlobs = new Map<string, Blob>();
  private manifestLoadStarted = false;
  private manifestDecodeInFlight = false;
  private activeVoiceSources = new Set<AudioBufferSourceNode>();

  private preferredVoice: SpeechSynthesisVoice | null = null;
  private voicesBound = false;
  private readonly handleVoicesChanged = (): void => {
    this.selectPreferredVoice();
  };

  private disposed = false;

  constructor(settings: ParentSettings) {
    this.settings = { ...settings };
    this.bindSpeechVoices();
    void this.preloadVoiceManifest();
    void this.reloadFamilyVoices();
  }

  public unlock(): void {
    if (this.disposed) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const onReady = (): void => {
      if (this.disposed) return;
      void this.preloadVoiceManifest();
      void this.decodePendingBuffers();
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

    if (!settings.sfxEnabled) {
      this.silenceKartMotion();
    }

    if (!settings.voiceEnabled && prevVoice) {
      this.stopActiveVoiceBuffers();
      this.cancelSpeech();
    }
  }

  public startMusic(mode: MusicMode = 'menu'): void {
    if (this.disposed) return;

    const modeChanged = this.currentMusicMode !== mode;
    if (modeChanged) {
      this.finalStretchActive = false;
    }
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
    this.finalStretchActive = false;
    this.teardownScheduler();
  }

  public setFinalStretch(active: boolean): void {
    if (this.disposed) return;
    if (this.finalStretchActive === active) return;
    this.finalStretchActive = active;

    if (
      active &&
      this.currentMusicMode === 'race' &&
      this.musicShouldPlay &&
      this.settings.musicEnabled
    ) {
      const ctx = this.getReadyContext();
      if (ctx && this.musicBus) {
        this.playFinalStretchStinger(ctx, this.musicBus);
      }
    }
  }

  public updateKartMotion(
    speedRatio: number,
    isAirborne: boolean,
    isBoosting: boolean
  ): void {
    if (this.disposed) return;
    if (!this.settings.sfxEnabled) {
      this.silenceKartMotion();
      return;
    }

    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== 'running') {
      return;
    }

    const rig = this.ensureKartMotionRig(ctx, this.sfxBus);
    const now = ctx.currentTime;
    const clampedSpeed = Math.max(0, Math.min(1.35, speedRatio));
    const activeOnGround = clampedSpeed >= 0.05 && !isAirborne;

    if (!activeOnGround) {
      rig.purrGain.gain.setTargetAtTime(0, now, 0.055);
      rig.boostGain.gain.setTargetAtTime(0, now, 0.055);
      return;
    }

    // Cozy pedal-kart wheel purr + gentle pedal chug cadence
    const baseFreq = 46 + clampedSpeed * 44 + (isBoosting ? 18 : 0);
    const chugHz = 5.5 + clampedSpeed * 8.5 + (isBoosting ? 3.0 : 0);
    const filterHz = 180 + clampedSpeed * 260 + (isBoosting ? 140 : 0);
    const targetPurr = 0.022 + Math.min(1, clampedSpeed) * 0.038;

    rig.purrOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    rig.chugLfo.frequency.setTargetAtTime(chugHz, now, 0.06);
    rig.purrFilter.frequency.setTargetAtTime(filterHz, now, 0.06);
    rig.purrGain.gain.setTargetAtTime(targetPurr, now, 0.06);

    // Sparkling rainbow shimmer when boosting
    if (isBoosting) {
      const shimmerRoot = 523.25 + clampedSpeed * 130;
      rig.boostOscA.frequency.setTargetAtTime(shimmerRoot, now, 0.07);
      rig.boostOscB.frequency.setTargetAtTime(shimmerRoot * 1.498, now, 0.07);
      rig.boostFilter.frequency.setTargetAtTime(1600 + clampedSpeed * 900, now, 0.07);
      rig.boostGain.gain.setTargetAtTime(0.036, now, 0.06);
    } else {
      rig.boostGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public playCountNote(num: number): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const clamped = Math.max(1, Math.min(10, Math.round(num)));
    const freq = C_MAJOR_SCALE_HZ[clamped - 1] ?? C_MAJOR_SCALE_HZ[0];
    const now = ctx.currentTime;

    // Warm marimba body + magical celesta shimmer harmonics
    this.playMarimbaNote(ctx, this.sfxBus, freq, now, 0.42, 0.28);
    this.playGlockenspielNote(ctx, this.sfxBus, freq * 2, now + 0.008, 0.38, 0.16);
    this.playGlockenspielNote(ctx, this.sfxBus, freq * 1.5, now + 0.014, 0.28, 0.08);
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

  public playMudSplash(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. Squishy comical lowpass noise splat
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.24);

    const splatGain = ctx.createGain();
    splatGain.gain.setValueAtTime(0.001, now);
    splatGain.gain.linearRampToValueAtTime(0.3, now + 0.015);
    splatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.connect(filter);
    filter.connect(splatGain);
    splatGain.connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.28);

    // 2. Three bubbly rising sine bloop pops
    const bloops = [
      { delay: 0.03, f0: 210, f1: 480, dur: 0.09 },
      { delay: 0.1, f0: 270, f1: 620, dur: 0.09 },
      { delay: 0.17, f0: 340, f1: 790, dur: 0.1 },
    ];
    bloops.forEach((b) => {
      const t = now + b.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.f0, t);
      osc.frequency.exponentialRampToValueAtTime(b.f1, t + b.dur);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + b.dur + 0.015);

      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + b.dur + 0.03);
    });
  }

  public playCrowdCheer(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. Warm bandpass-filtered stadium applause swell
    const applause = ctx.createBufferSource();
    applause.buffer = this.getNoiseBuffer(ctx);
    applause.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, now);
    bp.Q.setValueAtTime(0.85, now);

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.setValueAtTime(3600, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.22, now + 0.18);
    env.gain.setValueAtTime(0.2, now + 0.55);
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

    applause.connect(bp);
    bp.connect(warmth);
    warmth.connect(env);
    env.connect(this.sfxBus);
    applause.start(now);
    applause.stop(now + 1.18);

    // 2. Joyful celebration whistle & chime sparkle
    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(780, now + 0.08);
    whistle.frequency.exponentialRampToValueAtTime(1560, now + 0.28);
    whistle.frequency.exponentialRampToValueAtTime(1320, now + 0.36);

    wGain.gain.setValueAtTime(0.001, now + 0.08);
    wGain.gain.linearRampToValueAtTime(0.11, now + 0.13);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    whistle.connect(wGain);
    wGain.connect(this.sfxBus);
    whistle.start(now + 0.08);
    whistle.stop(now + 0.44);

    const chimes = [1046.5, 1318.51, 1567.98];
    chimes.forEach((hz, idx) => {
      this.playGlockenspielNote(ctx, this.sfxBus!, hz, now + 0.14 + idx * 0.075, 0.35, 0.14);
    });
  }

  public playRampLaunch(): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const ctx = this.getReadyContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;

    // 1. Chunky wooden plank thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(175, now);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.11);

    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(0.32, now + 0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    thump.connect(thumpGain);
    thumpGain.connect(this.sfxBus);
    thump.start(now);
    thump.stop(now + 0.15);

    // 2. Soaring upward whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.0, now);
    bp.frequency.setValueAtTime(320, now + 0.02);
    bp.frequency.exponentialRampToValueAtTime(2900, now + 0.36);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now + 0.02);
    whooshGain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(bp);
    bp.connect(whooshGain);
    whooshGain.connect(this.sfxBus);
    noise.start(now + 0.02);
    noise.stop(now + 0.42);

    // 3. Sparkle launch chime
    const sparkle = [783.99, 987.77, 1174.66, 1567.98];
    sparkle.forEach((hz, idx) => {
      this.playGlockenspielNote(ctx, this.sfxBus!, hz, now + 0.04 + idx * 0.045, 0.3, 0.15);
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

  // =========================================================================
  // 3-Tier Voice Pipeline
  // =========================================================================

  public async reloadFamilyVoices(): Promise<void> {
    if (this.disposed) return;
    try {
      const blobs = await this.familyStore.loadAllBlobs();
      if (this.disposed) return;

      this.familyBlobs = blobs;
      this.familyBuffers.clear();

      if (this.ctx) {
        await this.decodeFamilyBlobs(this.ctx);
      }
    } catch {
      // Never throw on storage/decode errors
    }
  }

  public getVoicePackStatus(): VoicePackStatus {
    const familyClipsCount = Math.max(this.familyBuffers.size, this.familyBlobs.size);
    const geminiClipsLoaded = Math.max(this.geminiBuffers.size, this.geminiRawClips.size);

    let activeTier: VoicePackStatus['activeTier'] = 'webspeech';
    if (this.settings.useFamilyVoice && familyClipsCount > 0) {
      activeTier = 'family';
    } else if (geminiClipsLoaded > 0) {
      activeTier = 'gemini';
    }

    return {
      geminiClipsLoaded,
      familyClipsCount,
      activeTier,
    };
  }

  public playClip(
    clipId: string,
    fallbackText?: string,
    speaker: VoiceSpeakerId = 'announcer',
    priority: 'high' | 'normal' = 'normal'
  ): void {
    if (this.disposed || !this.settings.voiceEnabled) return;

    const familyBuf = this.settings.useFamilyVoice
      ? this.familyBuffers.get(clipId)
      : undefined;
    if (familyBuf) {
      this.playVoiceBufferSequence([familyBuf], priority);
      return;
    }

    const geminiBuf = this.geminiBuffers.get(clipId);
    if (geminiBuf) {
      this.playVoiceBufferSequence([geminiBuf], priority);
      return;
    }

    if (fallbackText && fallbackText.trim()) {
      this.speakWithCharacterProfile(speaker, fallbackText, priority);
    }
  }

  public speakCharacter(
    speaker: VoiceSpeakerId,
    text: string,
    clipId?: string,
    priority: 'high' | 'normal' = 'normal'
  ): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    if (clipId) {
      this.playClip(clipId, text, speaker, priority);
      return;
    }
    this.speakWithCharacterProfile(speaker, text, priority);
  }

  public speak(text: string, priority: 'high' | 'normal' = 'normal'): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    this.speakWithCharacterProfile('announcer', text, priority);
  }

  public speakNumber(num: number, speaker?: VoiceSpeakerId): void {
    if (this.disposed) return;
    const clamped = Math.max(1, Math.min(10, Math.round(num))) as NumberblockId;
    this.playCountNote(clamped);
    this.playClip(
      `num_${clamped}`,
      `${NUMBER_WORDS[clamped]}!`,
      speaker ?? clamped,
      'high'
    );
  }

  public speakEquation(
    left: number,
    op: '+' | '-',
    right: number,
    result: number
  ): void {
    if (this.disposed || !this.settings.voiceEnabled) return;

    // 1. Check iconic hero equation clip in Gemini/Family cache
    const heroClipId = getEquationClipId(left, op, right, result);
    const familyHero = this.settings.useFamilyVoice
      ? this.familyBuffers.get(heroClipId)
      : undefined;
    const heroBuf = familyHero ?? this.geminiBuffers.get(heroClipId);
    if (heroBuf) {
      this.playVoiceBufferSequence([heroBuf], 'high');
      return;
    }

    // 2. Check modular stitched clips (num_L + op + num_R + equals + num_Result)
    const opClipId = op === '+' ? 'op_plus' : 'op_minus';
    const modularIds = [
      `num_${Math.round(left)}`,
      opClipId,
      `num_${Math.round(right)}`,
      'op_equals',
      `num_${Math.round(result)}`,
    ];
    const resolvedModular: AudioBuffer[] = [];
    for (const id of modularIds) {
      const buf =
        (this.settings.useFamilyVoice ? this.familyBuffers.get(id) : undefined) ??
        this.geminiBuffers.get(id);
      if (!buf) {
        resolvedModular.length = 0;
        break;
      }
      resolvedModular.push(buf);
    }

    if (resolvedModular.length === modularIds.length) {
      this.playVoiceBufferSequence(resolvedModular, 'high', 0.06);
      return;
    }

    // 3. Cheerful announcer Web Speech fallback
    const leftWord = this.numberToWord(left);
    const rightWord = this.numberToWord(right);
    const resultWord = this.numberToWord(result);
    const opWord = op === '+' ? 'plus' : 'minus';
    this.speakWithCharacterProfile(
      'announcer',
      `${leftWord} ${opWord} ${rightWord} equals ${resultWord}!`,
      'high'
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.musicShouldPlay = false;
    this.finalStretchActive = false;
    this.teardownScheduler();
    this.teardownKartMotionRig();
    this.stopActiveVoiceBuffers();
    this.cancelSpeech();
    this.unbindSpeechVoices();

    this.geminiBuffers.clear();
    this.geminiRawClips.clear();
    this.familyBuffers.clear();
    this.familyBlobs.clear();

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
    this.voiceBus = null;
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

      const voiceBus = ctx.createGain();
      voiceBus.gain.setValueAtTime(1.0, ctx.currentTime);

      musicBus.connect(masterGain);
      sfxBus.connect(masterGain);
      voiceBus.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
      this.voiceBus = voiceBus;

      void this.decodePendingBuffers();
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
  // Continuous Pedal-Kart Motion Rig
  // =========================================================================

  private ensureKartMotionRig(ctx: AudioContext, dest: AudioNode): KartMotionRig {
    if (this.kartRig) return this.kartRig;

    const now = ctx.currentTime;

    const purrOsc = ctx.createOscillator();
    purrOsc.type = 'triangle';
    purrOsc.frequency.setValueAtTime(52, now);

    const purrFilter = ctx.createBiquadFilter();
    purrFilter.type = 'lowpass';
    purrFilter.frequency.setValueAtTime(220, now);
    purrFilter.Q.setValueAtTime(1.2, now);

    const purrGain = ctx.createGain();
    purrGain.gain.setValueAtTime(0, now);

    // Soft rhythmic pedal cadence LFO modulating filter frequency gently
    const chugLfo = ctx.createOscillator();
    chugLfo.type = 'sine';
    chugLfo.frequency.setValueAtTime(7, now);

    const chugDepth = ctx.createGain();
    chugDepth.gain.setValueAtTime(55, now);

    chugLfo.connect(chugDepth);
    chugDepth.connect(purrFilter.frequency);

    purrOsc.connect(purrFilter);
    purrFilter.connect(purrGain);
    purrGain.connect(dest);

    // Boost shimmer layer (warm fifth harmonic)
    const boostOscA = ctx.createOscillator();
    boostOscA.type = 'sine';
    boostOscA.frequency.setValueAtTime(523.25, now);

    const boostOscB = ctx.createOscillator();
    boostOscB.type = 'triangle';
    boostOscB.frequency.setValueAtTime(783.99, now);

    const boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.setValueAtTime(1800, now);
    boostFilter.Q.setValueAtTime(1.4, now);

    const boostGain = ctx.createGain();
    boostGain.gain.setValueAtTime(0, now);

    boostOscA.connect(boostFilter);
    boostOscB.connect(boostFilter);
    boostFilter.connect(boostGain);
    boostGain.connect(dest);

    purrOsc.start(now);
    chugLfo.start(now);
    boostOscA.start(now);
    boostOscB.start(now);

    this.kartRig = {
      purrOsc,
      purrFilter,
      purrGain,
      chugLfo,
      chugDepth,
      boostOscA,
      boostOscB,
      boostFilter,
      boostGain,
    };

    return this.kartRig;
  }

  private silenceKartMotion(): void {
    if (!this.kartRig || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.kartRig.purrGain.gain.setTargetAtTime(0, now, 0.04);
      this.kartRig.boostGain.gain.setTargetAtTime(0, now, 0.04);
    } catch {
      // Ignore
    }
  }

  private teardownKartMotionRig(): void {
    if (!this.kartRig) return;
    const rig = this.kartRig;
    this.kartRig = null;
    const nodes: AudioNode[] = [
      rig.purrOsc,
      rig.purrFilter,
      rig.purrGain,
      rig.chugLfo,
      rig.chugDepth,
      rig.boostOscA,
      rig.boostOscB,
      rig.boostFilter,
      rig.boostGain,
    ];
    for (const node of nodes) {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
      } catch {
        // Ignore stop errors
      }
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }

  // =========================================================================
  // Voice Buffer Loading, Decoding & Active Source Management
  // =========================================================================

  private async preloadVoiceManifest(): Promise<void> {
    if (this.manifestLoadStarted || this.disposed) return;
    if (typeof fetch !== 'function') return;
    this.manifestLoadStarted = true;

    try {
      const resp = await fetch('./audio/voices/manifest.json', {
        cache: 'no-cache',
      });
      if (!resp.ok) return;

      const text = await resp.text();
      if (!text.trim()) return;

      const manifest = JSON.parse(text) as Partial<GeneratedVoiceManifest>;
      if (!manifest || !manifest.clips || typeof manifest.clips !== 'object') {
        return;
      }

      const entries = Object.entries(manifest.clips).filter(
        (pair): pair is [string, string] =>
          typeof pair[0] === 'string' && typeof pair[1] === 'string' && pair[1].length > 0
      );
      if (entries.length === 0) return;

      await Promise.allSettled(
        entries.map(async ([clipId, rawPath]) => {
          if (this.disposed) return;
          const url = this.resolveManifestClipUrl(rawPath);
          const clipResp = await fetch(url);
          if (!clipResp.ok) return;
          const arrayBuf = await clipResp.arrayBuffer();
          if (this.disposed || arrayBuf.byteLength === 0) return;
          this.geminiRawClips.set(clipId, arrayBuf);
        })
      );

      if (this.ctx) {
        await this.decodePendingBuffers();
      }
    } catch {
      // Safe offline / empty manifest fallback: silently use Web Speech
    }
  }

  private resolveManifestClipUrl(rawPath: string): string {
    if (
      rawPath.startsWith('./') ||
      rawPath.startsWith('/') ||
      rawPath.startsWith('http://') ||
      rawPath.startsWith('https://')
    ) {
      return rawPath;
    }
    if (rawPath.startsWith('audio/')) {
      return `./${rawPath}`;
    }
    return `./audio/voices/${rawPath}`;
  }

  private async decodePendingBuffers(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.disposed || this.manifestDecodeInFlight) return;

    this.manifestDecodeInFlight = true;
    try {
      for (const [clipId, rawBuf] of this.geminiRawClips.entries()) {
        if (this.disposed) return;
        if (this.geminiBuffers.has(clipId)) continue;
        try {
          // Copy buffer before decodeAudioData detaches it
          const copy = rawBuf.slice(0);
          const decoded = await ctx.decodeAudioData(copy);
          if (!this.disposed) {
            this.geminiBuffers.set(clipId, decoded);
          }
        } catch {
          // Skip invalid audio file cleanly
        }
      }

      await this.decodeFamilyBlobs(ctx);
    } finally {
      this.manifestDecodeInFlight = false;
    }
  }

  private async decodeFamilyBlobs(ctx: AudioContext): Promise<void> {
    for (const [clipId, blob] of this.familyBlobs.entries()) {
      if (this.disposed) return;
      if (this.familyBuffers.has(clipId)) continue;
      try {
        const arr = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        if (!this.disposed) {
          this.familyBuffers.set(clipId, decoded);
        }
      } catch {
        // Ignore corrupted/unsupported recording
      }
    }
  }

  private stopActiveVoiceBuffers(): void {
    for (const src of this.activeVoiceSources) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // Ignore already-stopped nodes
      }
      try {
        src.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeVoiceSources.clear();
  }

  private playVoiceBufferSequence(
    buffers: AudioBuffer[],
    priority: 'high' | 'normal',
    overlapSec = 0
  ): void {
    if (this.disposed || buffers.length === 0) return;

    if (priority === 'high') {
      this.stopActiveVoiceBuffers();
      this.cancelSpeech();
    } else if (this.activeVoiceSources.size > 0) {
      // Never talk over an active voice clip on normal priority
      return;
    }

    const ctx = this.getReadyContext();
    if (!ctx || !this.voiceBus) return;

    let cursorTime = ctx.currentTime + 0.01;
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceBus);

      this.activeVoiceSources.add(src);
      src.onended = () => {
        this.activeVoiceSources.delete(src);
        try {
          src.disconnect();
        } catch {
          // Ignore
        }
      };

      src.start(cursorTime);
      const stepAdvance =
        i < buffers.length - 1
          ? Math.max(0.1, buffer.duration - overlapSec)
          : buffer.duration;
      cursorTime += stepAdvance;
    }
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

      const isFinal = mode === 'race' && this.finalStretchActive;
      const tempoMult = isFinal ? 1.12 : 1.0;
      const semitoneShift = isFinal ? 1 : 0;
      const secondsPerStep = 60 / (pattern.bpm * tempoMult) / pattern.stepsPerBeat;

      while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
        const step = pattern.steps[this.currentStepIndex % pattern.steps.length];
        this.scheduleMusicStep(
          this.ctx,
          this.musicSessionGain,
          step,
          this.nextStepTime,
          secondsPerStep,
          mode,
          semitoneShift
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
    mode: MusicMode,
    semitoneShift = 0
  ): void {
    const accentMult = step.accent ? 1.18 : 1.0;

    if (step.lead !== undefined) {
      const hz = midiToHz(step.lead + semitoneShift);
      if (mode === 'race') {
        this.playMarimbaNote(ctx, dest, hz, time, stepDur * 1.15, 0.24 * accentMult);
      } else if (mode === 'podium') {
        this.playGlockenspielNote(ctx, dest, hz, time, stepDur * 1.5, 0.2 * accentMult);
      } else {
        this.playMarimbaNote(ctx, dest, hz, time, stepDur * 1.35, 0.22 * accentMult);
      }
    }

    if (step.harmony !== undefined) {
      const hz = midiToHz(step.harmony + semitoneShift);
      this.playWarmLeadNote(ctx, dest, hz, time, stepDur * 1.25, 0.11 * accentMult);
    }

    if (step.bass !== undefined) {
      const hz = midiToHz(step.bass + semitoneShift);
      this.playBouncyBassNote(ctx, dest, hz, time, stepDur * 0.9, 0.26);
    }

    if (step.kick) {
      this.playSoftKick(ctx, dest, time, mode === 'race' ? 0.26 : 0.18);
    }

    if (step.shaker) {
      this.playGentleShaker(ctx, dest, time, mode === 'race' ? 0.085 : 0.055);
    }
  }

  private playFinalStretchStinger(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    // Brief 3-note upbeat final-stretch stinger (G5 -> A5 -> Db6 to match +1 semitone key!)
    const stinger = [
      { hz: midiToHz(N.G5), delay: 0.0, dur: 0.11 },
      { hz: midiToHz(N.A5), delay: 0.09, dur: 0.11 },
      { hz: midiToHz(N.C6 + 1), delay: 0.18, dur: 0.34 },
    ];
    stinger.forEach((n) => {
      const t = now + n.delay;
      this.playWarmLeadNote(ctx, dest, n.hz, t, n.dur, 0.34);
      this.playGlockenspielNote(ctx, dest, n.hz * 2, t, n.dur * 0.85, 0.16);
    });
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
  // Expressive Character Web Speech API Helpers
  // =========================================================================

  private speakWithCharacterProfile(
    speaker: VoiceSpeakerId,
    text: string,
    priority: 'high' | 'normal'
  ): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    if (!text.trim()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (typeof SpeechSynthesisUtterance === 'undefined') return;

    try {
      const synth = window.speechSynthesis;
      if (priority === 'high') {
        this.stopActiveVoiceBuffers();
        synth.cancel();
      } else if (this.activeVoiceSources.size > 0) {
        return;
      }

      if (!this.preferredVoice) {
        this.selectPreferredVoice();
      }

      const profile =
        CHARACTER_VOICE_PROFILES[speaker] ?? CHARACTER_VOICE_PROFILES.announcer;
      const utterance = new SpeechSynthesisUtterance(text);

      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
        utterance.lang = this.preferredVoice.lang;
      } else {
        utterance.lang = 'en-GB';
      }

      utterance.pitch = Math.max(0.5, Math.min(2.0, profile.webSpeechPitch));
      utterance.rate = Math.max(0.5, Math.min(2.0, profile.webSpeechRate));
      utterance.volume = 0.96;

      synth.speak(utterance);
    } catch {
      // Never throw if speechSynthesis is blocked or unavailable
    }
  }

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

      // 1. Prioritize warm British voices
      const britishPreferredNames = [
        'google uk english female',
        'google uk english',
        'martha',
        'serena',
        'kate',
        'daniel',
        'arthur',
        'libby',
        'sonia',
      ];

      for (const target of britishPreferredNames) {
        const match = englishVoices.find((v) =>
          v.name.toLowerCase().includes(target)
        );
        if (match) {
          this.preferredVoice = match;
          return;
        }
      }

      const britishLang = englishVoices.find((v) => {
        const lang = v.lang.toLowerCase();
        return lang.startsWith('en-gb') || lang.startsWith('en_gb');
      });
      if (britishLang) {
        this.preferredVoice = britishLang;
        return;
      }

      // 2. Warm US/English fallback
      const fallbackNames = [
        'samantha',
        'google us english',
        'aria',
        'jenny',
        'karen',
      ];
      for (const target of fallbackNames) {
        const match = englishVoices.find((v) =>
          v.name.toLowerCase().includes(target)
        );
        if (match) {
          this.preferredVoice = match;
          return;
        }
      }

      const usLang = englishVoices.find((v) => {
        const lang = v.lang.toLowerCase();
        return lang.startsWith('en-us') || lang.startsWith('en_us');
      });
      this.preferredVoice = usLang ?? englishVoices[0];
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
