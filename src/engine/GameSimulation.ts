import * as THREE from 'three';
import { SoundEngine } from '../audio/SoundEngine';
import {
  ALL_NUMBERBLOCK_IDS,
  EPISODE_COMMENTARY_LINES,
  NUMBERBLOCK_SPECS,
  NUMBER_WORDS,
} from '../data/numberblocks';
import {
  GameMode,
  GameScreen,
  HudState,
  InputState,
  NumberblockId,
  ParentSettings,
  PitStopQuestion,
  PodiumResult,
} from '../types/game';
import { UIManager } from '../ui/UIManager';
import { NumberblockAnimState } from './NumberblockMesh';
import { ParticleSystem } from './ParticleSystem';
import { RallyKartRig } from './RallyKartMesh';
import { SceneManager } from './SceneManager';
import { RallyTrack } from './TrackBuilder';

interface AiRacer {
  id: NumberblockId;
  kart: RallyKartRig;
  s: number;
  laneX: number; // world lateral offset from road center
  targetLaneX: number;
  yOffset: number;
  vy: number;
  baseSpeed: number;
  currentSpeed: number;
  phase: number;
  laneTimer: number;
  boostTimer: number;
}

const GARAGE_ORIGIN = new THREE.Vector3(0, 240, -180);
const COUNTDOWN_STEP_SECONDS = 0.75;

function clampNumberblockId(val: number): NumberblockId {
  return Math.max(1, Math.min(10, Math.round(val))) as NumberblockId;
}

export class GameSimulation {
  private readonly sceneManager: SceneManager;
  private readonly ui: UIManager;
  private readonly sound: SoundEngine;
  private readonly particles: ParticleSystem;

  private settings: ParentSettings;
  private screen: GameScreen = 'title';
  private mode: GameMode = 'count-cruise';
  private selectedRacer: NumberblockId = 4;
  private paused = false;

  private track: RallyTrack;
  private playerKart: RallyKartRig;
  private garageKart: RallyKartRig;
  private titleKarts: RallyKartRig[] = [];
  private aiRacers: AiRacer[] = [];

  private garageGroup: THREE.Group;
  private garageTurntableSpin: THREE.Group;
  private garageOrbitStars: THREE.Object3D[] = [];

  // Input states (kept separate so keyboard & touch never overwrite each other)
  private keyboardInput: InputState = {
    left: false,
    right: false,
    jump: false,
    boost: false,
    steerAnalog: 0,
  };
  private touchInput: InputState = {
    left: false,
    right: false,
    jump: false,
    boost: false,
    steerAnalog: 0,
  };
  private prevJumpPressed = false;
  private prevBoostPressed = false;

  // Player race physics state
  private currentNumber: NumberblockId = 4;
  private startingNumber: NumberblockId = 4;
  private playerS = 14;
  private playerLane = 0; // world lateral units along sample.right
  private playerY = 0;
  private playerVy = 0;
  private playerSpeed = 0;
  private wasAirborne = false;

  private boostTimer = 0;
  private boostCharge = 0;
  private bumpAnimTimer = 0;
  private bumpSlowTimer = 0;
  private sneezeAnimTimer = 0;
  private dustEmitTimer = 0;

  // Race progression & stats
  private countProgress = 0;
  private highestCount = 1;
  private blobsCollected = 0;
  private equationsSolved = 0;
  private bonusStars = 0;
  private commentary = 'Ready, steady, pedal!';
  private commentaryIndex = 0;
  private commentaryTimer = 0;

  // Scripted race moments
  private doubleDipperWarned = false;
  private nineSneezeTriggered = false;
  private pitStopTriggered = false;
  private pitStopSolved = false;
  private currentPitStop: PitStopQuestion | null = null;
  private pitStopResumeTimerId: number | null = null;

  // Countdown state (driven inside update loop so pause works cleanly)
  private countdownElapsed = 0;
  private countdownStage = -1;
  private countdownHideTimer = 0;

  // Garage block count tour state
  private garageTourTimers: number[] = [];
  private garageTourSession = 0;

  // Garage camera framing state (smoothly lerped per driver height)
  private garageCamRadius = 7.9;
  private garageCamHeight = 3.1;
  private garageCamLookAtY = 1.45;

  // Podium celebration state
  private podiumConfettiTimer = 0;
  private podiumOrbitAngle = 0.55;

  // Frame loop state
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private elapsedTime = 0;
  private raceSessionId = 0;
  private hudSyncTimer = 0;
  private disposed = false;

  // Reusable scratch vectors (zero per-frame allocations)
  private readonly tempPos = new THREE.Vector3();
  private readonly tempForward = new THREE.Vector3();
  private readonly tempLookTarget = new THREE.Vector3();
  private readonly tempPodiumPos = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    ui: UIManager,
    sound: SoundEngine,
    initialSettings: ParentSettings
  ) {
    this.ui = ui;
    this.sound = sound;
    this.settings = { ...initialSettings };

    this.sceneManager = new SceneManager(canvas);
    this.particles = new ParticleSystem();
    this.sceneManager.scene.add(this.particles.group);

    this.track = new RallyTrack(this.mode, this.settings.maxCountTarget);
    this.sceneManager.scene.add(this.track.group);

    this.playerKart = new RallyKartRig(this.selectedRacer);
    this.playerKart.group.visible = false;
    this.sceneManager.scene.add(this.playerKart.group);

    this.garageGroup = new THREE.Group();
    this.garageTurntableSpin = new THREE.Group();
    this.buildGarageTurntable();
    this.garageGroup.position.copy(GARAGE_ORIGIN);
    this.garageGroup.visible = false;
    this.sceneManager.scene.add(this.garageGroup);

    this.garageKart = new RallyKartRig(this.selectedRacer);
    this.garageKart.group.position.set(0, 0.24, 0);
    this.garageTurntableSpin.add(this.garageKart.group);

    this.setupTitleLineup();
  }

  // =========================================================================
  // Public Control API
  // =========================================================================

  public start(): void {
    if (this.disposed) return;
    this.lastFrameTime = performance.now();
    this.enterTitleState(false);

    const loop = (now: number): void => {
      if (this.disposed) return;
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);

      this.update(dt);
      this.sceneManager.render();
      this.rafId = window.requestAnimationFrame(loop);
    };

    this.rafId = window.requestAnimationFrame(loop);
  }

  public getScreen(): GameScreen {
    return this.screen;
  }

  public getMode(): GameMode {
    return this.mode;
  }

  public getSelectedRacer(): NumberblockId {
    return this.selectedRacer;
  }

  public setMode(mode: GameMode): void {
    if (this.disposed) return;
    this.mode = mode;
    this.ui.setSelectedMode(mode);
    this.sound.playUiClick();

    if (this.screen === 'title') {
      this.rebuildTrack(this.mode, this.settings.maxCountTarget);
      this.positionTitleKartsOnTrack();
    }
  }

  public openGarage(): void {
    if (this.disposed) return;
    this.raceSessionId++;
    this.cancelGarageTour();
    this.clearPitStopTimer();
    this.paused = false;

    this.screen = 'garage';
    this.ui.setScreen('garage');
    this.ui.setSelectedRacer(this.selectedRacer);
    this.ui.hideCountdown();
    this.sound.playUiClick();
    this.sound.startMusic('menu');

    this.particles.clear();
    this.track.group.visible = false;
    this.playerKart.group.visible = false;
    this.setAiRacersVisible(false);
    this.setTitleKartsVisible(false);
    this.garageGroup.visible = true;

    this.garageKart.setDriver(this.selectedRacer);
    const driverHeight = this.garageKart.driverRig.totalHeight;
    this.garageCamRadius = 6.6 + driverHeight * 1.15;
    this.garageCamHeight = 2.6 + driverHeight * 0.42;
    this.garageCamLookAtY = 1.05 + driverHeight * 0.36;
    this.sound.speak(NUMBERBLOCK_SPECS[this.selectedRacer].catchphrase, 'high');
  }

  public selectRacer(id: NumberblockId): void {
    if (this.disposed) return;
    this.cancelGarageTour();
    this.selectedRacer = id;
    this.ui.setSelectedRacer(id);

    const spec = NUMBERBLOCK_SPECS[id];
    this.sound.playCountNote(id);
    this.sound.speak(spec.catchphrase, 'high');

    if (this.screen === 'garage') {
      this.garageKart.setDriver(id);
      this.tempPos.copy(GARAGE_ORIGIN);
      this.tempPos.y += 1.4;
      this.particles.emitMathMagic(this.tempPos, spec.primaryColor, 20);
    }
  }

  public startGarageBlockCount(id: NumberblockId): void {
    if (this.disposed || this.screen !== 'garage') return;

    this.cancelGarageTour();
    if (this.selectedRacer !== id) {
      this.selectedRacer = id;
      this.ui.setSelectedRacer(id);
      this.garageKart.setDriver(id);
    }

    const session = ++this.garageTourSession;
    const spec = NUMBERBLOCK_SPECS[id];
    const stepDelay = 550;

    for (let i = 0; i < id; i++) {
      const timerId = window.setTimeout(() => {
        if (this.disposed || this.screen !== 'garage' || session !== this.garageTourSession) {
          return;
        }
        this.garageKart.driverRig.highlightBlock(i);
        this.sound.speakNumber(i + 1);
        this.ui.updateGarageCountHighlight(i + 1, id);

        const blockMesh = this.garageKart.driverRig.blockMeshes[i];
        if (blockMesh) {
          blockMesh.getWorldPosition(this.tempPos);
        } else {
          this.tempPos.copy(GARAGE_ORIGIN).add(new THREE.Vector3(0, 1.5, 0));
        }
        this.particles.emitMathMagic(this.tempPos, spec.primaryColor, 14);
      }, i * stepDelay);

      this.garageTourTimers.push(timerId);
    }

    const endTimer = window.setTimeout(() => {
      if (this.disposed || this.screen !== 'garage' || session !== this.garageTourSession) {
        return;
      }
      this.garageKart.driverRig.highlightBlock(null);
      this.ui.updateGarageCountHighlight(null, id);
      this.sound.playCombineMagic();
      this.sound.speak(`${NUMBER_WORDS[id]}! ${id} blocks!`, 'high');
      this.tempPos.copy(GARAGE_ORIGIN).add(new THREE.Vector3(0, 2.0, 0));
      this.particles.emitConfetti(this.tempPos, 28);
    }, id * stepDelay + 680);

    this.garageTourTimers.push(endTimer);
  }

  public backToTitle(): void {
    if (this.disposed) return;
    this.sound.playUiClick();
    this.enterTitleState(true);
  }

  public startRace(): void {
    if (this.disposed) return;
    this.raceSessionId++;
    this.cancelGarageTour();
    this.clearPitStopTimer();
    this.paused = false;

    this.sound.playUiClick();
    this.particles.clear();

    // Rebuild fresh track for the selected mode & count goal
    this.rebuildTrack(this.mode, this.settings.maxCountTarget);
    this.track.group.visible = true;
    this.garageGroup.visible = false;
    this.disposeTitleKarts();

    // Reset player race state
    this.startingNumber = this.selectedRacer;
    this.currentNumber = this.selectedRacer;
    this.playerS = 14;
    this.playerLane = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.playerSpeed = 0;
    this.wasAirborne = false;

    this.boostTimer = 0;
    this.boostCharge = 0;
    this.bumpAnimTimer = 0;
    this.bumpSlowTimer = 0;
    this.sneezeAnimTimer = 0;
    this.dustEmitTimer = 0;

    this.countProgress = 0;
    this.highestCount = this.mode === 'count-cruise' ? 1 : this.selectedRacer;
    this.blobsCollected = 0;
    this.equationsSolved = 0;
    this.bonusStars = 0;
    this.commentaryIndex = 0;
    this.commentaryTimer = 0;
    this.commentary = 'Welcome to the Numberblock Rally!';

    this.doubleDipperWarned = false;
    this.nineSneezeTriggered = false;
    this.pitStopTriggered = false;
    this.pitStopSolved = false;
    this.currentPitStop = null;
    this.prevJumpPressed = false;
    this.prevBoostPressed = false;

    this.playerKart.setDriver(this.currentNumber);
    this.playerKart.group.visible = true;
    this.placeKartOnTrack(this.playerKart, this.playerS, this.playerLane, 0, 0);

    this.spawnAiRacers();

    this.countdownElapsed = 0;
    this.countdownStage = -1;
    this.countdownHideTimer = 0;

    this.screen = 'countdown';
    this.ui.setScreen('countdown');
    this.ui.hideCountdown();
    this.sound.startMusic('race');

    this.syncHudImmediate();
    this.snapFollowCameraToPlayer();
  }

  public togglePause(forcePaused?: boolean): void {
    if (this.disposed) return;
    if (this.screen !== 'playing' && this.screen !== 'countdown') return;
    this.paused = forcePaused !== undefined ? forcePaused : !this.paused;
  }

  public updateSettings(settings: ParentSettings): void {
    if (this.disposed) return;
    const prevTarget = this.settings.maxCountTarget;
    this.settings = { ...settings };
    this.sound.updateSettings(this.settings);
    this.ui.updateSettings(this.settings);

    if (
      prevTarget !== settings.maxCountTarget &&
      this.screen === 'title' &&
      this.mode === 'count-cruise'
    ) {
      this.rebuildTrack(this.mode, this.settings.maxCountTarget);
      this.positionTitleKartsOnTrack();
    }
  }

  public setKeyboardInput(patch: Partial<InputState>): void {
    this.keyboardInput = { ...this.keyboardInput, ...patch };
  }

  public setTouchInput(patch: Partial<InputState>): void {
    this.touchInput = { ...this.touchInput, ...patch };
  }

  public handlePitStopAnswer(choice: number): void {
    if (this.disposed || this.screen !== 'pitstop' || !this.currentPitStop) return;
    if (this.pitStopSolved) return;

    if (choice === this.currentPitStop.correctAnswer) {
      this.pitStopSolved = true;
      this.equationsSolved++;
      this.bonusStars = Math.min(2, this.bonusStars + 1);

      const word =
        choice >= 1 && choice <= 10
          ? NUMBER_WORDS[choice as NumberblockId]
          : String(choice);

      this.ui.showPitStopFeedback(true, `Yay! ${choice} is right! Super Boost!`);
      this.sound.playCombineMagic();
      this.sound.speak(`Yay! ${word}! Super boost!`, 'high');

      const worldPos = this.track.getWorldPosition(
        this.playerS,
        this.playerLane / this.track.roadHalfWidth,
        this.playerY + 1.2
      );
      this.particles.emitConfetti(worldPos, 40);

      const session = this.raceSessionId;
      this.clearPitStopTimer();
      this.pitStopResumeTimerId = window.setTimeout(() => {
        this.pitStopResumeTimerId = null;
        if (this.disposed || this.screen !== 'pitstop' || session !== this.raceSessionId) {
          return;
        }
        this.screen = 'playing';
        this.ui.setScreen('playing');
        this.boostTimer = Math.max(this.boostTimer, 2.5);
        this.boostCharge = 0;
        this.sound.playBoost();
        this.setCommentary('Pit-Stop Boost! Zoom zoom!');
      }, 1100);
    } else {
      this.ui.showPitStopFeedback(false, "Let's count them together! Try again!");
      this.sound.playUiClick();
      this.sound.speak("Almost! Let's count them together and try again!", 'high');
    }
  }

  public celebratePodiumNumber(id: NumberblockId): void {
    if (this.disposed || this.screen !== 'podium') return;
    this.currentNumber = id;
    this.playerKart.setDriver(id);
    this.sound.speakNumber(id);

    const spec = NUMBERBLOCK_SPECS[id];
    const pos = this.playerKart.group.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.particles.emitConfetti(pos, 34);
    this.particles.emitMathMagic(pos, spec.primaryColor, 20);
  }

  public resize(): void {
    if (this.disposed) return;
    this.sceneManager.resize();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.raceSessionId++;
    this.cancelGarageTour();
    this.clearPitStopTimer();

    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.disposeTitleKarts();
    this.disposeAiRacers();

    this.sceneManager.scene.remove(this.playerKart.group);
    this.playerKart.dispose();

    this.garageTurntableSpin.remove(this.garageKart.group);
    this.garageKart.dispose();

    this.sceneManager.scene.remove(this.track.group);
    this.track.dispose();

    this.sceneManager.scene.remove(this.particles.group);
    this.particles.dispose();

    this.sceneManager.dispose();
  }

  // =========================================================================
  // State Transitions & Scene Builders
  // =========================================================================

  private enterTitleState(rebuildTrack: boolean): void {
    this.raceSessionId++;
    this.cancelGarageTour();
    this.clearPitStopTimer();
    this.paused = false;

    this.screen = 'title';
    this.ui.setScreen('title');
    this.ui.setSelectedMode(this.mode);
    this.ui.setSelectedRacer(this.selectedRacer);
    this.ui.hideCountdown();
    this.sound.startMusic('menu');

    this.particles.clear();
    if (rebuildTrack) {
      this.rebuildTrack(this.mode, this.settings.maxCountTarget);
    }

    this.track.group.visible = true;
    this.garageGroup.visible = false;
    this.playerKart.group.visible = false;
    this.disposeAiRacers();
    this.setupTitleLineup();
  }

  private rebuildTrack(mode: GameMode, maxCountTarget: 5 | 10): void {
    this.sceneManager.scene.remove(this.track.group);
    this.track.dispose();
    this.track = new RallyTrack(mode, maxCountTarget);
    this.sceneManager.scene.add(this.track.group);
  }

  private setupTitleLineup(): void {
    if (this.titleKarts.length === 0) {
      for (const id of ALL_NUMBERBLOCK_IDS) {
        const kart = new RallyKartRig(id);
        this.sceneManager.scene.add(kart.group);
        this.titleKarts.push(kart);
      }
    }
    this.setTitleKartsVisible(true);
    this.positionTitleKartsOnTrack();
  }

  private positionTitleKartsOnTrack(): void {
    // 2 staggered rows of 5 karts right behind/at the start gantry (s = 10 & s = 15)
    for (let i = 0; i < this.titleKarts.length; i++) {
      const kart = this.titleKarts[i];
      const row = Math.floor(i / 5);
      const col = i % 5;
      const s = 15.5 - row * 4.8;
      const laneX = (col - 2) * 3.8 + (row === 1 ? 0.6 : -0.6);
      this.placeKartOnTrack(kart, s, laneX, 0, 0);
    }
  }

  private setTitleKartsVisible(visible: boolean): void {
    for (const kart of this.titleKarts) {
      kart.group.visible = visible;
    }
  }

  private disposeTitleKarts(): void {
    for (const kart of this.titleKarts) {
      this.sceneManager.scene.remove(kart.group);
      kart.dispose();
    }
    this.titleKarts = [];
  }

  private spawnAiRacers(): void {
    this.disposeAiRacers();

    const otherIds = ALL_NUMBERBLOCK_IDS.filter((id) => id !== this.selectedRacer);
    const chosenIds: NumberblockId[] =
      this.mode === 'count-cruise' ? otherIds.slice(0, 3) : otherIds;

    chosenIds.forEach((id, idx) => {
      const kart = new RallyKartRig(id);
      this.sceneManager.scene.add(kart.group);

      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const startS = this.mode === 'count-cruise' ? 18 + idx * 3.5 : 13 + row * 3.5;
      const laneOffset = (col - 1) * 4.4 + ((idx % 2) * 1.1 - 0.55);
      const maxLane = this.track.roadHalfWidth - 2.2;
      const laneX = THREE.MathUtils.clamp(laneOffset, -maxLane, maxLane);

      const racer: AiRacer = {
        id,
        kart,
        s: startS,
        laneX,
        targetLaneX: laneX,
        yOffset: 0,
        vy: 0,
        baseSpeed:
          this.mode === 'count-cruise'
            ? 24.8 + (idx % 3) * 0.6
            : 29.8 + (idx % 4) * 0.85,
        currentSpeed: 0,
        phase: idx * 1.17,
        laneTimer: 1.2 + (idx % 3) * 0.7,
        boostTimer: 0,
      };

      this.placeKartOnTrack(kart, racer.s, racer.laneX, 0, 0);
      this.aiRacers.push(racer);
    });
  }

  private setAiRacersVisible(visible: boolean): void {
    for (const r of this.aiRacers) {
      r.kart.group.visible = visible;
    }
  }

  private disposeAiRacers(): void {
    for (const r of this.aiRacers) {
      this.sceneManager.scene.remove(r.kart.group);
      r.kart.dispose();
    }
    this.aiRacers = [];
  }

  private buildGarageTurntable(): void {
    const rainbowColors = [
      '#E53935',
      '#FB8C00',
      '#FDD835',
      '#43A047',
      '#29B6F6',
      '#7E57C2',
      '#EC407A',
      '#E53935',
      '#FB8C00',
      '#FDD835',
    ];

    // Sunny sky base island below turntable
    const cloudDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 6.2, 1.1, 32),
      new THREE.MeshPhysicalMaterial({
        color: '#E8F7FF',
        roughness: 0.45,
        clearcoat: 0.35,
      })
    );
    cloudDeck.position.y = -0.85;
    cloudDeck.receiveShadow = true;
    this.garageGroup.add(cloudDeck);

    // Pedestal outer collar
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(3.85, 4.2, 0.55, 36),
      new THREE.MeshPhysicalMaterial({
        color: '#FFFFFF',
        clearcoat: 0.7,
        roughness: 0.18,
      })
    );
    collar.position.y = -0.15;
    collar.receiveShadow = true;
    collar.castShadow = true;
    this.garageGroup.add(collar);

    // Turntable spinning disc
    const topDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.65, 0.28, 36),
      new THREE.MeshPhysicalMaterial({
        color: '#FFFDF5',
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        roughness: 0.16,
      })
    );
    topDisc.position.y = 0.14;
    topDisc.receiveShadow = true;
    this.garageTurntableSpin.add(topDisc);

    // 10 colorful glossy wedges around the turntable rim
    const segAngle = (Math.PI * 2) / 10;
    for (let i = 0; i < 10; i++) {
      const wedgeGeom = new THREE.CylinderGeometry(
        3.58,
        3.58,
        0.3,
        6,
        1,
        false,
        i * segAngle,
        segAngle * 0.88
      );
      const wedgeMat = new THREE.MeshPhysicalMaterial({
        color: rainbowColors[i],
        clearcoat: 0.7,
        roughness: 0.2,
      });
      const wedge = new THREE.Mesh(wedgeGeom, wedgeMat);
      wedge.position.y = 0.15;
      wedge.receiveShadow = true;
      this.garageTurntableSpin.add(wedge);
    }

    // Center golden star ring
    const starRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.08, 10, 40),
      new THREE.MeshPhysicalMaterial({
        color: '#FFD54F',
        emissive: '#FFA000',
        emissiveIntensity: 0.25,
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 0.7,
      })
    );
    starRing.rotation.x = Math.PI / 2;
    starRing.position.y = 0.29;
    this.garageTurntableSpin.add(starRing);

    this.garageGroup.add(this.garageTurntableSpin);

    // Cheerful floating mini Numberblock cubes around the garage backdrop
    const floatGeom = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 5.4 + (i % 2) * 1.1;
      const cube = new THREE.Mesh(
        floatGeom,
        new THREE.MeshPhysicalMaterial({
          color: rainbowColors[i],
          clearcoat: 0.6,
          roughness: 0.25,
        })
      );
      cube.position.set(
        Math.cos(angle) * dist,
        1.1 + (i % 3) * 0.65,
        Math.sin(angle) * dist
      );
      cube.castShadow = true;
      this.garageGroup.add(cube);
      this.garageOrbitStars.push(cube);
    }
  }

  // =========================================================================
  // Main Simulation Update Loop
  // =========================================================================

  private update(dt: number): void {
    this.elapsedTime += dt;

    switch (this.screen) {
      case 'title':
        this.updateTitle(dt);
        break;
      case 'garage':
        this.updateGarage(dt);
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'pitstop':
        this.updatePitStop(dt);
        break;
      case 'podium':
        this.updatePodium(dt);
        break;
    }

    this.particles.update(dt);
  }

  private updateTitle(dt: number): void {
    this.track.update(dt, this.elapsedTime);

    for (let i = 0; i < this.titleKarts.length; i++) {
      const kart = this.titleKarts[i];
      kart.update(dt, this.elapsedTime + i * 0.35, 2.2, 0, false, 'idle');
    }

    const gantrySample = this.track.sampleAt(12);
    const orbitAngle = Math.sin(this.elapsedTime * 0.22) * 0.65 + 0.35;
    this.sceneManager.setCameraOrbit(
      gantrySample.position,
      orbitAngle,
      19.5,
      8.8,
      2.6
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, gantrySample.position);
  }

  private updateGarage(dt: number): void {
    this.garageTurntableSpin.rotation.y += dt * 0.55;
    this.garageKart.update(dt, this.elapsedTime, 2.0, 0.08, false, 'idle');

    for (let i = 0; i < this.garageOrbitStars.length; i++) {
      const obj = this.garageOrbitStars[i];
      obj.rotation.x += dt * 0.8;
      obj.rotation.y += dt * 1.1;
      obj.position.y = 1.15 + (i % 3) * 0.6 + Math.sin(this.elapsedTime * 2.1 + i) * 0.28;
    }

    // Dynamically frame kart & tall Numberblocks between top banner and bottom 1-10 tiles
    const driverHeight = this.garageKart.driverRig.totalHeight;
    const targetRadius = 6.6 + driverHeight * 1.15;
    const targetHeight = 2.6 + driverHeight * 0.42;
    const targetLookAtY = 1.05 + driverHeight * 0.36;
    const camAlpha = 1 - Math.exp(-7.5 * dt);
    this.garageCamRadius = THREE.MathUtils.lerp(this.garageCamRadius, targetRadius, camAlpha);
    this.garageCamHeight = THREE.MathUtils.lerp(this.garageCamHeight, targetHeight, camAlpha);
    this.garageCamLookAtY = THREE.MathUtils.lerp(this.garageCamLookAtY, targetLookAtY, camAlpha);

    this.sceneManager.setCameraOrbit(
      GARAGE_ORIGIN,
      0.32,
      this.garageCamRadius,
      this.garageCamHeight,
      this.garageCamLookAtY
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, GARAGE_ORIGIN);
  }

  private updateCountdown(dt: number): void {
    this.track.update(dt, this.elapsedTime);

    if (!this.paused) {
      this.countdownElapsed += dt;
      const stage = Math.floor(this.countdownElapsed / COUNTDOWN_STEP_SECONDS);

      if (stage !== this.countdownStage) {
        this.countdownStage = stage;
        if (stage === 0) {
          this.ui.showCountdown('3', '#E53935');
          this.sound.playCountdownBeep(false);
          this.sound.speak(
            'Welcome to the Numberblock Rally! Ready, steady, three!',
            'high'
          );
        } else if (stage === 1) {
          this.ui.showCountdown('2', '#FB8C00');
          this.sound.playCountdownBeep(false);
        } else if (stage === 2) {
          this.ui.showCountdown('1', '#FDD835');
          this.sound.playCountdownBeep(false);
        } else if (stage >= 3) {
          this.ui.showCountdown('GO!', '#43A047');
          this.sound.playCountdownBeep(true);
          this.sound.speak('GO! Pedal power!', 'high');
          this.screen = 'playing';
          this.ui.setScreen('playing');
          this.countdownHideTimer = COUNTDOWN_STEP_SECONDS;
          this.boostTimer = 1.1;
          this.setCommentary('Look at them zoom down Mount Numberland!');
        }
      }
    }

    this.playerKart.update(dt, this.elapsedTime, 1.2, 0, false, 'idle');
    for (const ai of this.aiRacers) {
      ai.kart.update(dt, this.elapsedTime + ai.phase, 1.2, 0, false, 'idle');
    }

    const sample = this.track.sampleAt(this.playerS);
    this.sceneManager.setCameraFollow(
      this.playerKart.group.position,
      sample.tangent,
      dt,
      0.15,
      false
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, this.playerKart.group.position);
  }

  private updatePlaying(dt: number): void {
    this.track.update(dt, this.elapsedTime);

    if (this.countdownHideTimer > 0) {
      this.countdownHideTimer -= dt;
      if (this.countdownHideTimer <= 0) {
        this.ui.hideCountdown();
      }
    }

    if (this.paused) {
      this.sceneManager.updateEnvironment(dt, this.elapsedTime, this.playerKart.group.position);
      return;
    }

    // Update timers
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.bumpAnimTimer > 0) this.bumpAnimTimer = Math.max(0, this.bumpAnimTimer - dt);
    if (this.bumpSlowTimer > 0) this.bumpSlowTimer = Math.max(0, this.bumpSlowTimer - dt);
    if (this.sneezeAnimTimer > 0) this.sneezeAnimTimer = Math.max(0, this.sneezeAnimTimer - dt);

    // Combine keyboard & touch input
    const left = this.keyboardInput.left || this.touchInput.left;
    const right = this.keyboardInput.right || this.touchInput.right;
    const jumpDown = this.keyboardInput.jump || this.touchInput.jump;
    const boostDown = this.keyboardInput.boost || this.touchInput.boost;
    const manualSteer = THREE.MathUtils.clamp(
      (left ? -1 : 0) +
        (right ? 1 : 0) +
        this.keyboardInput.steerAnalog +
        this.touchInput.steerAnalog,
      -1,
      1
    );

    const jumpJustPressed = jumpDown && !this.prevJumpPressed;
    const boostJustPressed = boostDown && !this.prevBoostPressed;
    this.prevJumpPressed = jumpDown;
    this.prevBoostPressed = boostDown;

    const spec = NUMBERBLOCK_SPECS[this.currentNumber];
    const baseCruise = this.mode === 'count-cruise' ? 26.0 : 32.0;
    let targetSpeed = baseCruise * spec.baseSpeed;
    if (this.boostTimer > 0) targetSpeed += 13.0;
    if (this.bumpSlowTimer > 0) targetSpeed -= 7.0;

    const accelAlpha = 1 - Math.exp(-5.5 * dt);
    this.playerSpeed = THREE.MathUtils.lerp(this.playerSpeed, targetSpeed, accelAlpha);

    // Advance forward along track
    this.playerS += this.playerSpeed * dt;

    // Lateral steering (+ Toddler Auto-Steer Assist when idle)
    const maxLane = this.track.roadHalfWidth - 1.9;
    let effectiveSteer = manualSteer;
    let lateralDelta = 0;

    if (Math.abs(manualSteer) > 0.05) {
      lateralDelta = manualSteer * 15.5 * dt;
      this.playerLane = THREE.MathUtils.clamp(
        this.playerLane + lateralDelta,
        -maxLane,
        maxLane
      );
    } else if (this.settings.autoSteerAssist) {
      const desiredLane = this.computeAssistTargetLane();
      const diff = desiredLane - this.playerLane;
      const maxStep = 5.6 * dt;
      lateralDelta = THREE.MathUtils.clamp(diff * 2.2 * dt, -maxStep, maxStep);
      this.playerLane = THREE.MathUtils.clamp(
        this.playerLane + lateralDelta,
        -maxLane,
        maxLane
      );
      effectiveSteer = THREE.MathUtils.clamp(diff * 0.22, -0.55, 0.55);
    }

    // Jump & Turbo Boost trigger
    const isGrounded = this.playerY <= 0.001 && this.playerVy <= 0.01;
    if (jumpJustPressed && isGrounded) {
      this.playerVy = 13.8;
      this.sound.playJump();
      const dustPos = this.track.getWorldPosition(
        this.playerS,
        this.playerLane / this.track.roadHalfWidth,
        0.15
      );
      this.particles.emitDust(dustPos, 5);
    }

    if ((jumpJustPressed || boostJustPressed) && this.boostCharge >= 0.85) {
      this.boostCharge = 0;
      this.boostTimer = Math.max(this.boostTimer, 2.2);
      this.sound.playBoost();
      const magicPos = this.track.getWorldPosition(
        this.playerS,
        this.playerLane / this.track.roadHalfWidth,
        this.playerY + 0.9
      );
      this.particles.emitMathMagic(magicPos, spec.primaryColor, 22);
      this.setCommentary('Turbo Rainbow Boost!');
    }

    // Vertical jump physics
    this.playerVy -= 30.0 * dt;
    this.playerY += this.playerVy * dt;
    if (this.playerY <= 0) {
      if (this.wasAirborne && this.playerVy < -3) {
        const landPos = this.track.getWorldPosition(
          this.playerS,
          this.playerLane / this.track.roadHalfWidth,
          0.1
        );
        this.particles.emitDust(landPos, 6);
      }
      this.playerY = 0;
      this.playerVy = 0;
    }
    const isAirborne = this.playerY > 0.08;
    this.wasAirborne = isAirborne;

    // Position and orient player kart
    const yawOffset = Math.atan2(lateralDelta / Math.max(dt, 0.001), Math.max(this.playerSpeed, 12));
    this.placeKartOnTrack(
      this.playerKart,
      this.playerS,
      this.playerLane,
      this.playerY,
      yawOffset
    );

    // Note: in RallyKartRig, positive steerAngle visually turns wheels/lean toward +X (left),
    // while positive effectiveSteer moves along +sample.right (screen-right, -X). Pass -effectiveSteer!
    let animState: NumberblockAnimState = 'racing';
    if (this.sneezeAnimTimer > 0) animState = 'sneeze';
    else if (this.bumpAnimTimer > 0) animState = 'bump';
    else if (this.boostTimer > 0.8) animState = 'celebrate';

    this.playerKart.update(
      dt,
      this.elapsedTime,
      this.playerSpeed,
      -effectiveSteer * 0.65,
      isAirborne,
      animState
    );

    // Emit boost sparkles / wheel dust trail
    this.dustEmitTimer += dt;
    if (this.dustEmitTimer >= (this.boostTimer > 0 ? 0.07 : 0.16) && !isAirborne) {
      this.dustEmitTimer = 0;
      if (this.boostTimer > 0) {
        this.particles.emitMathMagic(this.playerKart.group.position, spec.primaryColor, 3);
      } else {
        this.particles.emitDust(this.playerKart.group.position, 2);
      }
    }

    // Check pickups, gates, rocks, ramps, Double-Dipper, Nine's sneeze & mud
    this.evaluateTrackInteractions();

    // Update AI rivals
    this.updateAiRacers(dt);

    // Periodic ambient commentary refresh
    this.commentaryTimer += dt;
    if (this.commentaryTimer > 11.5) {
      this.commentaryTimer = 0;
      this.commentaryIndex = (this.commentaryIndex + 1) % EPISODE_COMMENTARY_LINES.length;
      this.setCommentary(EPISODE_COMMENTARY_LINES[this.commentaryIndex]);
    }

    // Camera follow
    const sample = this.track.sampleAt(this.playerS);
    const speedRatio = THREE.MathUtils.clamp(
      (this.playerSpeed - 18) / 26 + (this.boostTimer > 0 ? 0.3 : 0),
      0,
      1.25
    );
    this.sceneManager.setCameraFollow(
      this.playerKart.group.position,
      sample.tangent,
      dt,
      speedRatio,
      isAirborne
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, this.playerKart.group.position);

    // Check Pit-Stop midpoint quiz
    if (
      this.settings.pitStopQuizzes &&
      !this.pitStopTriggered &&
      this.playerS >= 505 &&
      this.playerS < 535
    ) {
      this.triggerPitStopChallenge();
      return;
    }

    // Check Finish Line
    if (this.playerS >= this.track.length - 42) {
      this.finishRace();
      return;
    }

    // Throttled HUD update (~20 Hz keeps DOM snappy & 60fps rock-solid)
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.05) {
      this.hudSyncTimer = 0;
      this.syncHudImmediate();
    }
  }

  private updatePitStop(dt: number): void {
    this.track.update(dt, this.elapsedTime);
    this.playerKart.update(
      dt,
      this.elapsedTime,
      0.5,
      0,
      false,
      this.pitStopSolved ? 'celebrate' : 'idle'
    );
    for (const ai of this.aiRacers) {
      ai.kart.update(dt, this.elapsedTime + ai.phase, 0.5, 0, false, 'idle');
    }

    const sample = this.track.sampleAt(this.playerS);
    this.sceneManager.setCameraFollow(
      this.playerKart.group.position,
      sample.tangent,
      dt,
      0.1,
      false
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, this.playerKart.group.position);
  }

  private updatePodium(dt: number): void {
    this.track.update(dt, this.elapsedTime);
    this.podiumOrbitAngle += dt * 0.42;

    this.playerKart.update(dt, this.elapsedTime, 0, 0, false, 'celebrate');

    // Keep AI buddies cheering near the finish area
    for (let i = 0; i < this.aiRacers.length; i++) {
      const ai = this.aiRacers[i];
      ai.kart.update(dt, this.elapsedTime + ai.phase, 0, 0, false, 'celebrate');
    }

    this.podiumConfettiTimer += dt;
    if (this.podiumConfettiTimer >= 1.65) {
      this.podiumConfettiTimer = 0;
      this.tempPodiumPos.copy(this.playerKart.group.position).add(new THREE.Vector3(0, 2.2, 0));
      this.particles.emitConfetti(this.tempPodiumPos, 24);
    }

    const podiumCenter = this.track.sampleAt(this.track.length - 18).position;
    this.sceneManager.setCameraOrbit(
      podiumCenter,
      this.podiumOrbitAngle,
      11.8,
      4.4,
      1.6
    );
    this.sceneManager.updateEnvironment(dt, this.elapsedTime, podiumCenter);
  }

  // =========================================================================
  // Track Feature & AI Logic
  // =========================================================================

  private computeAssistTargetLane(): number {
    const roadHalf = this.track.roadHalfWidth;

    // 1. In Rally Math, dodge rocks directly ahead
    if (this.mode === 'rally-math') {
      for (const f of this.track.features) {
        if (f.triggered || f.type !== 'rock') continue;
        const ds = f.z - this.playerS;
        if (ds > 1 && ds < 26) {
          const rockLane = f.laneX * roadHalf;
          if (Math.abs(this.playerLane - rockLane) < 3.4) {
            return rockLane >= 0 ? -4.8 : 4.8;
          }
        }
      }

      // Steer gently toward upcoming merge gate or ramp
      for (const f of this.track.features) {
        if (f.triggered) continue;
        if (f.type !== 'merge-gate' && f.type !== 'ramp') continue;
        const ds = f.z - this.playerS;
        if (ds > 2 && ds < 34) {
          return f.laneX * roadHalf;
        }
      }
    }

    // 2. Steer gently toward nearest uncollected Numberblob ahead
    let bestBlobDist = 28;
    let bestBlobLane: number | null = null;
    for (const blob of this.track.blobPickups) {
      if (blob.collected) continue;
      const ds = blob.s - this.playerS;
      if (ds > 1 && ds < bestBlobDist) {
        bestBlobDist = ds;
        bestBlobLane = blob.laneX * roadHalf;
      }
    }
    if (bestBlobLane !== null) {
      return bestBlobLane;
    }

    // 3. In Count & Cruise, glide smoothly toward center of counting gates
    return 0;
  }

  private evaluateTrackInteractions(): void {
    const roadHalf = this.track.roadHalfWidth;
    const playerWorldPos = this.track.getWorldPosition(
      this.playerS,
      this.playerLane / roadHalf,
      this.playerY + 0.6
    );

    // 1. Numberblobs
    for (const blob of this.track.blobPickups) {
      if (blob.collected) continue;
      const ds = Math.abs(this.playerS - blob.s);
      if (ds > 2.6) continue;

      const blobLane = blob.laneX * roadHalf;
      if (Math.abs(this.playerLane - blobLane) < 3.0 && this.playerY < 3.4) {
        blob.collected = true;
        blob.mesh.visible = false;
        this.blobsCollected++;
        this.boostCharge = Math.min(1, this.boostCharge + 0.22);
        this.sound.playBlobPickup();
        this.particles.emitMathMagic(blob.mesh.position, blob.color, 12);
      }
    }

    // 2. Track Features
    for (const feature of this.track.features) {
      if (feature.triggered) continue;

      switch (feature.type) {
        case 'ramp': {
          if (Math.abs(this.playerS - feature.z) < 2.8) {
            const rampLane = feature.laneX * roadHalf;
            if (Math.abs(this.playerLane - rampLane) < 2.95 && this.playerY < 1.9) {
              feature.triggered = true;
              this.playerVy = 17.5;
              this.boostTimer = Math.max(this.boostTimer, 2.0);
              this.sound.playJump();
              this.sound.playBoost();
              this.particles.emitMathMagic(playerWorldPos, '#FFD54F', 24);
              this.setCommentary('Woohoo! Big jump!');
              this.sound.speak('Woohoo! Big jump!', 'normal');
            }
          }
          break;
        }

        case 'count-gate': {
          if (this.playerS >= feature.z) {
            feature.triggered = true;
            const val = clampNumberblockId(feature.value ?? 1);
            this.countProgress = Math.max(this.countProgress, val);
            this.highestCount = Math.max(this.highestCount, val);
            this.currentNumber = val;
            this.playerKart.setDriver(val);
            this.boostTimer = Math.max(this.boostTimer, 1.35);

            const spec = NUMBERBLOCK_SPECS[val];
            this.sound.speakNumber(val);
            this.ui.showCountPopup(val, `${NUMBER_WORDS[val]}!`, spec.primaryColor);
            this.particles.emitConfetti(playerWorldPos, 28);
            this.particles.emitMathMagic(playerWorldPos, spec.primaryColor, 18);
            this.setCommentary(`${NUMBER_WORDS[val]}! ${spec.catchphrase}`);
          }
          break;
        }

        case 'rock': {
          if (Math.abs(this.playerS - feature.z) < 2.3) {
            const rockLane = feature.laneX * roadHalf;
            if (Math.abs(this.playerLane - rockLane) < 2.5) {
              feature.triggered = true;
              if (this.playerY >= 1.35) {
                // Jumped cleanly over rock!
                this.boostCharge = Math.min(1, this.boostCharge + 0.35);
                this.particles.emitMathMagic(playerWorldPos, '#FFD54F', 16);
                this.setCommentary('Super jump! Way to go!');
                this.sound.speak('Super jump!', 'normal');
              } else {
                const drop = feature.value ?? 1;
                const prev = this.currentNumber;
                if (prev === 1) {
                  this.bumpAnimTimer = 0.65;
                  this.bumpSlowTimer = 0.45;
                  this.sound.playBumpSubtract();
                  this.setCommentary('Keep pedalling, One!');
                  this.sound.speak('Keep pedalling, One!', 'high');
                } else {
                  const nextVal = clampNumberblockId(prev - drop);
                  const actualDrop = prev - nextVal;
                  const oldColor = NUMBERBLOCK_SPECS[prev].primaryColor;

                  this.currentNumber = nextVal;
                  this.playerKart.setDriver(nextVal);
                  this.bumpAnimTimer = 0.75;
                  this.bumpSlowTimer = 0.55;
                  this.equationsSolved++;

                  this.particles.emitPoppedBlocks(playerWorldPos, actualDrop, oldColor);
                  this.sound.playBumpSubtract();
                  this.sound.speakEquation(prev, '-', actualDrop, nextVal);
                  this.ui.showMathBanner({
                    left: prev,
                    operator: '-',
                    right: actualDrop,
                    result: nextVal,
                    title: 'Whoa! Bump!',
                    subtitle: NUMBERBLOCK_SPECS[nextVal].rallyLine,
                    voiceLine: '',
                    color: NUMBERBLOCK_SPECS[nextVal].primaryColor,
                  });
                  this.setCommentary(`${prev} minus ${actualDrop} equals ${nextVal}!`);
                }
              }
            }
          }
          break;
        }

        case 'double-dipper': {
          if (this.playerS >= feature.z) {
            feature.triggered = true;
            const onSideBypassRamp = Math.abs(this.playerLane) > 5.0;
            if (this.playerY >= 1.4 || onSideBypassRamp) {
              this.boostTimer = Math.max(this.boostTimer, 1.8);
              this.particles.emitMathMagic(playerWorldPos, '#FF7043', 20);
              this.setCommentary('Awesome! Cleared the Double-Dipper!');
            } else if (this.currentNumber > 1) {
              const prev = this.currentNumber;
              const splitAmt = prev >= 5 ? 3 : 2;
              const nextVal = clampNumberblockId(prev - splitAmt);
              const actualDrop = prev - nextVal;
              const oldColor = NUMBERBLOCK_SPECS[prev].primaryColor;

              this.currentNumber = nextVal;
              this.playerKart.setDriver(nextVal);
              this.bumpAnimTimer = 0.75;
              this.equationsSolved++;

              this.particles.emitPoppedBlocks(playerWorldPos, actualDrop, oldColor);
              this.sound.playBumpSubtract();
              this.sound.speakEquation(prev, '-', actualDrop, nextVal);
              this.ui.showMathBanner({
                left: prev,
                operator: '-',
                right: actualDrop,
                result: nextVal,
                title: 'Double-Dipper Split!',
                subtitle: "Wait, I'm commentating! No, I'M commentating!",
                voiceLine: '',
                color: '#FF7043',
              });
              this.setCommentary("Wait, I'm commentating! No, I'M commentating!");
            } else {
              this.setCommentary('Tiny One zoomed right through the Double-Dipper!');
            }
          }
          break;
        }

        case 'merge-gate': {
          if (Math.abs(this.playerS - feature.z) < 2.6) {
            const gateLane = feature.laneX * roadHalf;
            if (Math.abs(this.playerLane - gateLane) < 3.6) {
              feature.triggered = true;
              const addAmt = feature.value ?? 1;
              const prev = this.currentNumber;
              const nextVal = clampNumberblockId(prev + addAmt);
              const actualAdded = nextVal - prev;

              this.currentNumber = nextVal;
              this.highestCount = Math.max(this.highestCount, nextVal);
              this.playerKart.setDriver(nextVal);
              this.boostTimer = Math.max(this.boostTimer, 2.2);

              this.sound.playCombineMagic();
              this.particles.emitMathMagic(
                playerWorldPos,
                NUMBERBLOCK_SPECS[nextVal].primaryColor,
                26
              );
              this.particles.emitConfetti(playerWorldPos, 18);

              if (actualAdded > 0) {
                this.equationsSolved++;
                this.sound.speakEquation(prev, '+', actualAdded, nextVal);
                this.ui.showMathBanner({
                  left: prev,
                  operator: '+',
                  right: actualAdded,
                  result: nextVal,
                  title: 'Maths Magic Boost!',
                  subtitle: NUMBERBLOCK_SPECS[nextVal].rallyLine,
                  voiceLine: '',
                  color: NUMBERBLOCK_SPECS[nextVal].primaryColor,
                });
                this.setCommentary(`${prev} plus ${actualAdded} equals ${nextVal}!`);
              } else {
                this.sound.speak('Ten out of ten! Super rocket boost!', 'high');
                this.ui.showMathBanner({
                  left: 10,
                  operator: '+',
                  right: 0,
                  result: 10,
                  title: 'Ten Out of Ten!',
                  subtitle: 'Blast off to the finish line!',
                  voiceLine: '',
                  color: '#E53935',
                });
                this.setCommentary('Ten is in the lead! Ten out of ten!');
              }
            }
          }
          break;
        }

        case 'mud-puddle': {
          if (Math.abs(this.playerS - feature.z) < 3.4) {
            feature.triggered = true;
            this.particles.emitMudSplash(playerWorldPos, 22);
            this.sound.playBlobPickup();
            this.setCommentary('Splash! Almost at the finish line!');
            this.sound.speak('Splash! Almost at the finish line!', 'normal');
          }
          break;
        }

        default:
          break;
      }
    }

    // 3. Double-Dipper commentary warning approaching s = 515
    if (
      this.mode === 'rally-math' &&
      !this.doubleDipperWarned &&
      this.playerS >= 515 &&
      this.playerS < 555
    ) {
      this.doubleDipperWarned = true;
      this.setCommentary('Hold on! Mind the Double-Dipper up ahead!');
      this.sound.speak('Mind the Double-Dipper up ahead!', 'normal');
    }

    // 4. Classic Nine "Ah-CHOO!" moment around s = 760
    if (
      this.mode === 'rally-math' &&
      !this.nineSneezeTriggered &&
      this.currentNumber === 9 &&
      this.playerS >= 760
    ) {
      this.nineSneezeTriggered = true;
      this.currentNumber = 8;
      this.playerKart.setDriver(8);
      this.sneezeAnimTimer = 1.0;
      this.equationsSolved++;

      this.sound.playSneeze();
      this.particles.emitPoppedBlocks(playerWorldPos, 1, '#E53935');
      this.sound.speak(
        'Ah-CHOO! Nine minus one equals eight! Octoblock, back in action!',
        'high'
      );
      this.ui.showMathBanner({
        left: 9,
        operator: '-',
        right: 1,
        result: 8,
        title: 'Ah-CHOO!',
        subtitle: 'Octoblock, back in action!',
        voiceLine: '',
        color: NUMBERBLOCK_SPECS[8].primaryColor,
      });
      this.setCommentary('Ah-CHOO! Octoblock, back in action!');
    }
  }

  private updateAiRacers(dt: number): void {
    const roadHalf = this.track.roadHalfWidth;
    const maxLane = roadHalf - 2.1;

    for (const ai of this.aiRacers) {
      // Gentle rubber-banding so rivals stay excitingly close
      const deltaS = ai.s - this.playerS;
      let rubber = 0;
      if (this.mode === 'count-cruise') {
        // Friendly cruising buddies stay near & gently behind near the finish
        if (deltaS > 12) rubber = -5.5;
        else if (deltaS < -18) rubber = 4.5;
      } else {
        if (deltaS > 28) rubber = -4.2;
        else if (deltaS < -24) rubber = 5.4;
      }

      if (ai.boostTimer > 0) ai.boostTimer = Math.max(0, ai.boostTimer - dt);

      const targetSpeed = Math.max(
        18,
        ai.baseSpeed + rubber + (ai.boostTimer > 0 ? 6.5 : 0)
      );
      ai.currentSpeed = THREE.MathUtils.lerp(
        ai.currentSpeed || targetSpeed,
        targetSpeed,
        1 - Math.exp(-3.5 * dt)
      );
      ai.s = Math.min(this.track.length - 12, ai.s + ai.currentSpeed * dt);

      // Periodic smooth lane weaving + rock avoidance
      ai.laneTimer -= dt;
      if (ai.laneTimer <= 0) {
        ai.laneTimer = 1.6 + ((ai.id * 0.37) % 1.4);
        ai.targetLaneX = Math.sin(this.elapsedTime * 0.7 + ai.phase) * (maxLane * 0.72);
      }

      for (const f of this.track.features) {
        if (f.type === 'rock') {
          const ds = f.z - ai.s;
          if (ds > 0 && ds < 22) {
            const rockLane = f.laneX * roadHalf;
            if (Math.abs(ai.laneX - rockLane) < 3.2) {
              ai.targetLaneX = rockLane >= 0 ? -5.0 : 5.0;
            }
          }
        } else if (f.type === 'ramp') {
          const ds = Math.abs(f.z - ai.s);
          if (ds < 2.2 && ai.yOffset <= 0.05 && Math.abs(ai.laneX - f.laneX * roadHalf) < 2.5) {
            ai.vy = 14.5;
            ai.boostTimer = 1.2;
          }
        }
      }

      const prevLane = ai.laneX;
      ai.laneX = THREE.MathUtils.lerp(ai.laneX, ai.targetLaneX, 1 - Math.exp(-2.6 * dt));
      ai.laneX = THREE.MathUtils.clamp(ai.laneX, -maxLane, maxLane);

      if (ai.yOffset > 0 || ai.vy > 0) {
        ai.vy -= 28 * dt;
        ai.yOffset += ai.vy * dt;
        if (ai.yOffset <= 0) {
          ai.yOffset = 0;
          ai.vy = 0;
        }
      }

      const latVel = (ai.laneX - prevLane) / Math.max(dt, 0.001);
      const yawOffset = Math.atan2(latVel, Math.max(ai.currentSpeed, 12));
      this.placeKartOnTrack(ai.kart, ai.s, ai.laneX, ai.yOffset, yawOffset);

      const steerVisual = THREE.MathUtils.clamp(-latVel * 0.06, -0.45, 0.45);
      ai.kart.update(
        dt,
        this.elapsedTime + ai.phase,
        ai.currentSpeed,
        steerVisual,
        ai.yOffset > 0.1,
        'racing'
      );
    }
  }

  // =========================================================================
  // Pit-Stop & Finish Logic
  // =========================================================================

  private triggerPitStopChallenge(): void {
    this.pitStopTriggered = true;
    this.pitStopSolved = false;
    this.screen = 'pitstop';

    // Clear held inputs cleanly
    this.keyboardInput = { left: false, right: false, jump: false, boost: false, steerAnalog: 0 };
    this.touchInput = { left: false, right: false, jump: false, boost: false, steerAnalog: 0 };

    const question = this.buildPitStopQuestion();
    this.currentPitStop = question;
    this.ui.showPitStopQuiz(question);
    this.ui.setScreen('pitstop');
    this.sound.playUiClick();
    this.sound.speak(question.voicePrompt, 'high');
  }

  private buildPitStopQuestion(): PitStopQuestion {
    const spec = NUMBERBLOCK_SPECS[this.currentNumber];

    if (this.mode === 'count-cruise') {
      const targetMax = this.settings.maxCountTarget;
      const count = 2 + Math.floor(Math.random() * Math.max(2, targetMax - 1));
      const clampedCount = Math.min(targetMax, Math.max(2, count)) as NumberblockId;
      const choices = this.buildChoices(clampedCount, 1, targetMax);

      return {
        prompt: 'Pit-Stop! How many blocks do you see?',
        voicePrompt: 'Pit stop! Count the colorful blocks!',
        visualType: 'count-blocks',
        visualCount: clampedCount,
        correctAnswer: clampedCount,
        choices,
        accentColor: NUMBERBLOCK_SPECS[clampedCount].primaryColor,
      };
    }

    // Rally Math: alternate between wheel counting & gentle visual equation
    const roll = Math.random();
    if (roll < 0.34) {
      const wheelCount = 4;
      return {
        prompt: 'Pit-Stop Check! How many wheels are on a rally car?',
        voicePrompt: 'Pit stop check! How many wheels are on a rally car?',
        visualType: 'count-wheels',
        visualCount: wheelCount,
        correctAnswer: wheelCount,
        choices: this.buildChoices(wheelCount, 2, 6),
        accentColor: spec.primaryColor,
      };
    }

    const templates: Array<{ left: number; op: '+' | '-'; right: number; answer: number }> = [
      { left: 3, op: '+', right: 3, answer: 6 },
      { left: 4, op: '+', right: 2, answer: 6 },
      { left: 5, op: '+', right: 3, answer: 8 },
      { left: 10, op: '-', right: 1, answer: 9 },
      { left: 8, op: '-', right: 2, answer: 6 },
      { left: 7, op: '+', right: 2, answer: 9 },
    ];
    const picked = templates[Math.floor(Math.random() * templates.length)];
    const opWord = picked.op === '+' ? 'plus' : 'minus';

    return {
      prompt: `Maths Magic Pit-Stop! What is ${picked.left} ${picked.op === '-' ? '−' : '+'} ${picked.right}?`,
      voicePrompt: `Pit stop! What is ${NUMBER_WORDS[picked.left as NumberblockId]} ${opWord} ${NUMBER_WORDS[picked.right as NumberblockId]}?`,
      visualType: 'equation',
      visualCount: picked.answer,
      leftNum: picked.left,
      operator: picked.op,
      rightNum: picked.right,
      correctAnswer: picked.answer,
      choices: this.buildChoices(picked.answer, 2, 10),
      accentColor: spec.primaryColor,
    };
  }

  private buildChoices(correct: number, min: number, max: number): number[] {
    const set = new Set<number>([correct]);
    const offsets = [-2, -1, 1, 2, 3, -3];
    for (const off of offsets) {
      if (set.size >= 3) break;
      const cand = correct + off;
      if (cand >= min && cand <= max && !set.has(cand)) {
        set.add(cand);
      }
    }
    while (set.size < 3) {
      const cand = min + Math.floor(Math.random() * (max - min + 1));
      set.add(cand);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  private finishRace(): void {
    this.screen = 'podium';
    this.paused = false;
    this.ui.hideCountdown();

    const place = this.mode === 'count-cruise' ? 1 : this.computeRacePosition();
    const isOneSurpriseWin = this.currentNumber === 1 && place === 1;

    let starsEarned: number;
    if (this.mode === 'count-cruise') {
      starsEarned = this.blobsCollected >= 8 || this.bonusStars > 0 ? 3 : 2;
    } else {
      const baseStars = place <= 3 ? 3 : place <= 7 ? 2 : 1;
      starsEarned = Math.min(3, baseStars + (this.blobsCollected >= 10 || this.bonusStars > 0 ? 1 : 0));
      starsEarned = Math.max(2, starsEarned); // Warm & encouraging for young players!
    }

    const result: PodiumResult = {
      mode: this.mode,
      finisherNumber: this.currentNumber,
      startingNumber: this.startingNumber,
      place,
      starsEarned,
      blobsCollected: this.blobsCollected,
      equationsSolved: this.equationsSolved,
      highestCount: this.highestCount,
      isOneSurpriseWin,
    };

    // Place player kart proudly beside the spinning Golden Trophy
    const podiumS = this.track.length - 21;
    this.placeKartOnTrack(this.playerKart, podiumS, -3.2, 0, -0.42);

    // Park AI rivals cleanly behind the trophy arch
    for (let i = 0; i < this.aiRacers.length; i++) {
      const ai = this.aiRacers[i];
      const row = Math.floor(i / 4);
      const col = i % 4;
      const parkS = this.track.length - 30 - row * 3.8;
      const parkLane = (col - 1.5) * 4.2;
      this.placeKartOnTrack(ai.kart, parkS, parkLane, 0, 0);
    }

    this.podiumOrbitAngle = 0.55;
    this.podiumConfettiTimer = 0;

    this.sound.startMusic('podium');
    this.sound.playFinishFanfare();

    if (this.currentNumber === 1) {
      this.sound.speak('Hooray! Only ONE can lift the golden trophy!', 'high');
    } else if (this.mode === 'count-cruise') {
      this.sound.speak(
        `Hooray! ${NUMBER_WORDS[this.currentNumber]} counted all the way to ${this.highestCount}!`,
        'high'
      );
    } else {
      this.sound.speak(
        `Hooray! ${NUMBER_WORDS[this.currentNumber]} finished the Numberblock Rally!`,
        'high'
      );
    }

    const burstPos = this.playerKart.group.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    this.particles.emitConfetti(burstPos, 48);

    this.ui.showPodium(result);
    this.ui.setScreen('podium');
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private placeKartOnTrack(
    kart: RallyKartRig,
    s: number,
    laneWorldX: number,
    yOffset: number,
    yawOffset: number
  ): void {
    const sample = this.track.sampleAt(s);
    this.tempPos.copy(sample.position).addScaledVector(sample.right, laneWorldX);
    this.tempPos.y += yOffset;
    kart.group.position.copy(this.tempPos);

    // Build forward vector along track tangent + slight lateral steering yaw
    this.tempForward.copy(sample.tangent);
    if (Math.abs(yawOffset) > 0.001) {
      this.tempForward.addScaledVector(sample.right, Math.sin(yawOffset) * 0.65).normalize();
    }
    this.tempLookTarget.copy(this.tempPos).add(this.tempForward);
    kart.group.lookAt(this.tempLookTarget);
  }

  private snapFollowCameraToPlayer(): void {
    const sample = this.track.sampleAt(this.playerS);
    // Run multiple small steps or direct update so camera starts behind kart immediately
    this.sceneManager.setCameraFollow(
      this.playerKart.group.position,
      sample.tangent,
      0.5,
      0.1,
      false
    );
    this.sceneManager.updateEnvironment(0.016, this.elapsedTime, this.playerKart.group.position);
  }

  private computeRacePosition(): number {
    let ahead = 0;
    for (const ai of this.aiRacers) {
      if (ai.s > this.playerS) ahead++;
    }
    return ahead + 1;
  }

  private syncHudImmediate(): void {
    const totalRacers = this.aiRacers.length + 1;
    const hud: HudState = {
      mode: this.mode,
      currentNumber: this.currentNumber,
      countProgress: this.countProgress,
      countTarget: this.settings.maxCountTarget,
      blobsCollected: this.blobsCollected,
      racePosition: this.computeRacePosition(),
      totalRacers,
      trackProgress: THREE.MathUtils.clamp(
        (this.playerS - 14) / (this.track.length - 56),
        0,
        1
      ),
      speedKmh: Math.round(this.playerSpeed * 2.2),
      boostCharge: this.boostCharge,
      starsEarned: this.bonusStars,
      commentary: this.commentary,
    };
    this.ui.updateHud(hud);
  }

  private setCommentary(line: string): void {
    this.commentary = line;
    this.commentaryTimer = 0;
  }

  private cancelGarageTour(): void {
    this.garageTourSession++;
    for (const id of this.garageTourTimers) {
      window.clearTimeout(id);
    }
    this.garageTourTimers = [];
    this.garageKart.driverRig.highlightBlock(null);
    this.ui.updateGarageCountHighlight(null, this.selectedRacer);
  }

  private clearPitStopTimer(): void {
    if (this.pitStopResumeTimerId !== null) {
      window.clearTimeout(this.pitStopResumeTimerId);
      this.pitStopResumeTimerId = null;
    }
  }
}
