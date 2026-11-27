import './ui/styles.css';
import { SoundEngine } from './audio/SoundEngine';
import { DEFAULT_PARENT_SETTINGS } from './data/numberblocks';
import { GameSimulation } from './engine/GameSimulation';
import { GameMode, GameScreen, NumberblockId, ParentSettings } from './types/game';
import { UIManager } from './ui/UIManager';

declare global {
  interface Window {
    __NUMBERBLOCK_RALLY__?: {
      getScreen: () => GameScreen;
      getMode: () => GameMode;
      getSelectedRacer: () => NumberblockId;
    };
  }
}

const SETTINGS_STORAGE_KEY = 'numberblock-rally-settings-v1';

function loadSavedSettings(): ParentSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PARENT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ParentSettings> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_PARENT_SETTINGS };
    }
    const merged: ParentSettings = {
      ...DEFAULT_PARENT_SETTINGS,
      ...parsed,
    };
    if (merged.maxCountTarget !== 5 && merged.maxCountTarget !== 10) {
      merged.maxCountTarget = DEFAULT_PARENT_SETTINGS.maxCountTarget;
    }
    if (merged.carSpeed !== 'slow' && merged.carSpeed !== 'normal' && merged.carSpeed !== 'fast') {
      merged.carSpeed = DEFAULT_PARENT_SETTINGS.carSpeed;
    }
    if (
      merged.raceLength !== 'short' &&
      merged.raceLength !== 'medium' &&
      merged.raceLength !== 'long'
    ) {
      merged.raceLength = DEFAULT_PARENT_SETTINGS.raceLength;
    }
    return merged;
  } catch {
    return { ...DEFAULT_PARENT_SETTINGS };
  }
}

function saveSettings(settings: ParentSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or Safari private mode errors
  }
}

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas');
  const uiRoot = document.getElementById('ui-root');

  if (!(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement)) {
    throw new Error('Numberblock Rally: Missing #game-canvas or #ui-root element.');
  }

  let currentSettings: ParentSettings = loadSavedSettings();
  const sound = new SoundEngine(currentSettings);
  let sim: GameSimulation | null = null;

  const ui = new UIManager(uiRoot, currentSettings, {
    onSelectMode: (mode) => {
      sound.unlock();
      sim?.setMode(mode);
    },
    onOpenGarage: () => {
      sound.unlock();
      sim?.openGarage();
    },
    onSelectRacer: (id) => {
      sound.unlock();
      sim?.selectRacer(id);
    },
    onCountRacerBlocks: (id) => {
      sound.unlock();
      sim?.startGarageBlockCount(id);
    },
    onStartRace: () => {
      sound.unlock();
      sim?.startRace();
    },
    onBackToTitle: () => {
      sound.unlock();
      sim?.backToTitle();
    },
    onPlayAgain: () => {
      sound.unlock();
      sim?.startRace();
    },
    onPitStopAnswer: (choice) => {
      sound.unlock();
      sim?.handlePitStopAnswer(choice);
    },
    onPodiumTapNumber: (id) => {
      sound.unlock();
      sim?.celebratePodiumNumber(id);
    },
    onSettingsChange: (nextSettings) => {
      currentSettings = { ...nextSettings };
      saveSettings(currentSettings);
      sim?.updateSettings(currentSettings);
    },
    onFamilyVoiceChanged: () => {
      void sound.reloadFamilyVoices();
    },
    onTouchInput: (patch) => {
      sound.unlock();
      sim?.setTouchInput(patch);
    },
    onPauseToggle: () => {
      sim?.togglePause();
    },
  });

  sim = new GameSimulation(canvas, ui, sound, currentSettings);
  sim.start();

  // Lightweight QA / debug inspection hook
  window.__NUMBERBLOCK_RALLY__ = {
    getScreen: () => sim?.getScreen() ?? 'title',
    getMode: () => sim?.getMode() ?? 'count-cruise',
    getSelectedRacer: () => sim?.getSelectedRacer() ?? 4,
  };

  // Unlock Web Audio on first user interaction
  const unlockAudio = (): void => {
    sound.unlock();
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // Global keyboard controls (steering, jumping, garage quick-select 1..9 & 0->10, Escape)
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!sim) return;
    const screen = sim.getScreen();

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        sim.setKeyboardInput({ left: true });
        break;
      case 'ArrowRight':
      case 'KeyD':
        sim.setKeyboardInput({ right: true });
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        if (screen === 'playing' || screen === 'countdown') {
          e.preventDefault();
        }
        sim.setKeyboardInput({ jump: true, boost: true });
        break;
      case 'Escape':
        if (screen === 'garage') {
          sim.backToTitle();
        } else if (screen === 'playing' || screen === 'countdown') {
          sim.togglePause();
        }
        break;
      default:
        break;
    }

    if (screen === 'garage') {
      const digitMap: Record<string, NumberblockId> = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
        Digit5: 5,
        Digit6: 6,
        Digit7: 7,
        Digit8: 8,
        Digit9: 9,
        Digit0: 10,
      };
      const picked = digitMap[e.code];
      if (picked !== undefined) {
        sim.selectRacer(picked);
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (!sim) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        sim.setKeyboardInput({ left: false });
        break;
      case 'ArrowRight':
      case 'KeyD':
        sim.setKeyboardInput({ right: false });
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        sim.setKeyboardInput({ jump: false, boost: false });
        break;
      default:
        break;
    }
  };

  const onBlur = (): void => {
    sim?.setKeyboardInput({
      left: false,
      right: false,
      jump: false,
      boost: false,
      steerAnalog: 0,
    });
  };

  const onResize = (): void => {
    sim?.resize();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    sim?.dispose();
    ui.dispose();
    sound.dispose();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
