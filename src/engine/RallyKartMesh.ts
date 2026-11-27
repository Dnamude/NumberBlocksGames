import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NUMBERBLOCK_SPECS } from '../data/numberblocks';
import { NumberblockId } from '../types/game';
import { createDiceFaceTexture, createNumberBadgeTexture } from '../utils/textures';
import { NumberblockAnimState, NumberblockRig } from './NumberblockMesh';

const RAINBOW_COLORS = [
  '#E53935', // Red
  '#FB8C00', // Orange
  '#FDD835', // Yellow
  '#43A047', // Green
  '#29B6F6', // Blue
  '#5C6BC0', // Indigo
  '#AB47BC', // Violet
] as const;

function getSmartDriverBlockSize(id: NumberblockId): number {
  switch (id) {
    case 1:
      return 0.54;
    case 2:
      return 0.48;
    case 3:
      return 0.42;
    case 4:
      return 0.44;
    case 5:
      return 0.33;
    case 6:
      return 0.38;
    case 7:
      return 0.27;
    case 8:
      return 0.34;
    case 9:
      return 0.33;
    case 10:
      return 0.31;
    default:
      return 0.42;
  }
}

function createStarShape(outerRadius: number, innerRadius: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step + Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createDominoMaskShape(width: number, height: number): THREE.Shape {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + 0.04, hh);
  shape.quadraticCurveTo(0, hh * 0.62, hw - 0.04, hh);
  shape.quadraticCurveTo(hw + 0.06, 0, hw - 0.04, -hh);
  shape.quadraticCurveTo(0, -hh * 0.52, -hw + 0.04, -hh);
  shape.quadraticCurveTo(-hw - 0.06, 0, -hw + 0.04, hh);
  shape.closePath();
  return shape;
}

interface WheelSpinEntry {
  pivot: THREE.Group;
  radius: number;
}

interface WheelConfig {
  x: number;
  y: number;
  z: number;
  radius: number;
  width: number;
  rimColor: string;
  hubColor?: string;
  isFront: boolean;
  centerMounted?: boolean;
  treadStuds?: boolean;
}

interface OctoLegEntry {
  pivot: THREE.Group;
  side: number;
  index: number;
  baseRotZ: number;
}

interface SharedCarMaterials {
  body: THREE.MeshPhysicalMaterial;
  stripe: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  darkFrame: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshPhysicalMaterial;
  cushion: THREE.MeshPhysicalMaterial;
  tire: THREE.MeshPhysicalMaterial;
  headlight: THREE.MeshBasicMaterial;
}

/**
 * Lightweight tumbling mini-Numberblock + loose rubber wheel actor
 * used when blocks/wheels pop off during subtraction events (e.g., 10 - 1 = 9).
 */
export function createPoppedNumberblockActor(id: NumberblockId): THREE.Group {
  const group = new THREE.Group();
  group.name = `popped-numberblock-${id}`;

  const spec = NUMBERBLOCK_SPECS[id];
  const miniBlock = new NumberblockRig(id, 0.34);
  miniBlock.group.position.set(-0.2, 0, 0);
  group.add(miniBlock.group);

  // Chunky loose toy tire beside the popped Numberblock
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0.24, 0.22, 0.04);
  wheelGroup.rotation.set(0.22, 0.35, -0.18);

  const tireMat = new THREE.MeshPhysicalMaterial({
    color: '#21252D',
    roughness: 0.72,
    clearcoat: 0.12,
  });
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: spec.id === 10 ? '#E53935' : spec.primaryColor,
    clearcoat: 0.72,
    roughness: 0.2,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: '#ECEFF1',
    metalness: 0.65,
    roughness: 0.2,
    clearcoat: 0.5,
  });

  const radius = 0.22;
  const width = 0.18;

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheelGroup.add(tire);

  const sidewall = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.74, radius * 0.25, 8, 20),
    tireMat
  );
  sidewall.rotation.y = Math.PI / 2;
  wheelGroup.add(sidewall);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.015, 16),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  for (const side of [-1, 1]) {
    const hub = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.26, 10, 10), chromeMat);
    hub.scale.set(0.55, 1, 1);
    hub.position.x = side * (width * 0.5 + 0.008);
    wheelGroup.add(hub);
  }

  group.add(wheelGroup);
  return group;
}

export class RallyKartRig {
  public readonly group: THREE.Group;
  public readonly chassisGroup: THREE.Group;
  public readonly driverMount: THREE.Group;
  public driverRig: NumberblockRig;
  public readonly wheels: THREE.Group[] = [];
  public readonly steeringWheel: THREE.Group;
  public currentId: NumberblockId;

  private readonly frontWheelSteerPivots: THREE.Group[] = [];
  private readonly wheelSpinEntries: WheelSpinEntry[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];

  private pedalCrankPivot: THREE.Group | null = null;
  private leftPedalArm: THREE.Group | null = null;
  private rightPedalArm: THREE.Group | null = null;
  private isHandlebarSteer = false;

  // Character-specific animated extras
  private jesterTailFin: THREE.Group | null = null;
  private luckyStarFlag: THREE.Group | null = null;
  private rainbowArch: THREE.Group | null = null;
  private octoLegs: OctoLegEntry[] = [];
  private sneezePipes: THREE.Group[] = [];
  private rocketFlames: THREE.Mesh[] = [];

  private wheelDistance = 0;
  private pedalAngle = 0;
  private swapPopTimer = 0;
  private smoothedSteer = 0;
  private smoothedAirborne = 0;

  constructor(id: NumberblockId) {
    this.currentId = id;

    this.group = new THREE.Group();
    this.group.name = `rally-kart-${id}`;

    this.chassisGroup = new THREE.Group();
    this.group.add(this.chassisGroup);

    this.steeringWheel = new THREE.Group();
    this.driverMount = new THREE.Group();

    this.driverRig = new NumberblockRig(id, getSmartDriverBlockSize(id));
    this.buildVehicleForId(id);
  }

  public setDriver(newId: NumberblockId): void {
    if (newId === this.currentId) {
      this.swapPopTimer = 0.35;
      return;
    }

    this.currentId = newId;
    this.group.name = `rally-kart-${newId}`;

    // Remove and dispose old driver cleanly before disposing chassis contents
    this.driverMount.remove(this.driverRig.group);
    this.driverRig.dispose();

    this.disposeChassisContents();

    // Build new driver + bespoke N-wheel car
    this.driverRig = new NumberblockRig(newId, getSmartDriverBlockSize(newId));
    this.buildVehicleForId(newId);

    // Trigger joyful springy pop-in animation
    this.swapPopTimer = 0.42;
  }

  private createSharedMaterials(id: NumberblockId): SharedCarMaterials {
    const spec = NUMBERBLOCK_SPECS[id];
    return {
      body: new THREE.MeshPhysicalMaterial({
        color: spec.kartColor,
        clearcoat: 0.78,
        clearcoatRoughness: 0.14,
        roughness: 0.2,
        metalness: 0.06,
      }),
      stripe: new THREE.MeshPhysicalMaterial({
        color: spec.kartStripeColor,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        roughness: 0.22,
        metalness: 0.04,
      }),
      accent: new THREE.MeshPhysicalMaterial({
        color: spec.accentColor,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        roughness: 0.24,
        metalness: 0.08,
      }),
      darkFrame: new THREE.MeshPhysicalMaterial({
        color: '#263238',
        clearcoat: 0.32,
        roughness: 0.42,
        metalness: 0.22,
      }),
      chrome: new THREE.MeshPhysicalMaterial({
        color: '#ECEFF1',
        metalness: 0.68,
        roughness: 0.18,
        clearcoat: 0.55,
      }),
      cushion: new THREE.MeshPhysicalMaterial({
        color: '#37474F',
        roughness: 0.55,
        clearcoat: 0.15,
      }),
      tire: new THREE.MeshPhysicalMaterial({
        color: '#21252D',
        roughness: 0.74,
        clearcoat: 0.1,
      }),
      headlight: new THREE.MeshBasicMaterial({ color: '#FFFDE7' }),
    };
  }

  private buildVehicleForId(id: NumberblockId): void {
    this.chassisGroup.clear();
    this.steeringWheel.clear();
    this.driverMount.clear();

    this.wheels.length = 0;
    this.frontWheelSteerPivots.length = 0;
    this.wheelSpinEntries.length = 0;
    this.octoLegs = [];
    this.sneezePipes = [];
    this.rocketFlames = [];
    this.jesterTailFin = null;
    this.luckyStarFlag = null;
    this.rainbowArch = null;
    this.pedalCrankPivot = null;
    this.leftPedalArm = null;
    this.rightPedalArm = null;
    this.isHandlebarSteer = false;

    this.chassisGroup.add(this.steeringWheel);
    this.chassisGroup.add(this.driverMount);
    this.driverMount.add(this.driverRig.group);

    const mats = this.createSharedMaterials(id);

    switch (id) {
      case 1:
        this.buildCarOne(mats);
        break;
      case 2:
        this.buildCarTwo(mats);
        break;
      case 3:
        this.buildCarThree(mats);
        break;
      case 4:
        this.buildCarFour(mats);
        break;
      case 5:
        this.buildCarFive(mats);
        break;
      case 6:
        this.buildCarSix(mats);
        break;
      case 7:
        this.buildCarSeven(mats);
        break;
      case 8:
        this.buildCarEight(mats);
        break;
      case 9:
        this.buildCarNine(mats);
        break;
      case 10:
        this.buildCarTen(mats);
        break;
    }
  }

  private addWheel(cfg: WheelConfig, mats: SharedCarMaterials): THREE.Group {
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(cfg.x, cfg.y, cfg.z);

    const spinPivot = new THREE.Group();
    wheelPivot.add(spinPivot);

    const tireCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.width, 24),
      mats.tire
    );
    tireCyl.rotation.z = Math.PI / 2;
    tireCyl.castShadow = true;
    tireCyl.receiveShadow = true;
    spinPivot.add(tireCyl);

    const sidewall = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.radius * 0.74, cfg.radius * 0.25, 10, 24),
      mats.tire
    );
    sidewall.rotation.y = Math.PI / 2;
    spinPivot.add(sidewall);

    // Optional chunky tread lugs so off-road / big wheel rotation pops visually
    if (cfg.treadStuds) {
      const studCount = 10;
      for (let i = 0; i < studCount; i++) {
        const angle = (i / studCount) * Math.PI * 2;
        const stud = new THREE.Mesh(
          new RoundedBoxGeometry(cfg.width * 0.86, 0.045, 0.08, 2, 0.015),
          mats.tire
        );
        stud.position.set(0, Math.cos(angle) * cfg.radius, Math.sin(angle) * cfg.radius);
        stud.rotation.x = -angle;
        spinPivot.add(stud);
      }
    }

    const rimMat = new THREE.MeshPhysicalMaterial({
      color: cfg.rimColor,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
      roughness: 0.2,
      metalness: 0.08,
    });

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 0.56, cfg.radius * 0.56, cfg.width + 0.02, 18),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    spinPivot.add(rim);

    // Visible spokes on both faces so wheel spinning is unmistakable
    const spokeMat = new THREE.MeshPhysicalMaterial({
      color: cfg.hubColor ?? '#FFFFFF',
      clearcoat: 0.65,
      roughness: 0.22,
    });
    const spokeSides = cfg.centerMounted || Math.abs(cfg.x) < 0.05 ? [-1, 1] : [Math.sign(cfg.x)];
    for (const side of spokeSides) {
      const faceX = side * (cfg.width * 0.5 + 0.012);
      const hubcap = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.radius * 0.23, 12, 10),
        mats.chrome
      );
      hubcap.scale.set(0.55, 1, 1);
      hubcap.position.x = faceX;
      spinPivot.add(hubcap);

      for (let s = 0; s < 4; s++) {
        const ang = (s * Math.PI) / 2;
        const dot = new THREE.Mesh(
          new THREE.CylinderGeometry(cfg.radius * 0.075, cfg.radius * 0.075, 0.025, 8),
          spokeMat
        );
        dot.rotation.z = Math.PI / 2;
        dot.position.set(
          faceX,
          Math.cos(ang) * cfg.radius * 0.38,
          Math.sin(ang) * cfg.radius * 0.38
        );
        spinPivot.add(dot);
      }
    }

    // Axle strut connecting wheel to chassis
    if (cfg.centerMounted || Math.abs(cfg.x) < 0.05) {
      for (const side of [-1, 1]) {
        const forkLeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.036, 0.36, 10),
          mats.chrome
        );
        forkLeg.position.set(side * (cfg.width * 0.5 + 0.06), cfg.radius * 0.48, 0);
        forkLeg.rotation.z = side * 0.08;
        forkLeg.castShadow = true;
        wheelPivot.add(forkLeg);
      }
      const axlePin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, cfg.width + 0.16, 10),
        mats.darkFrame
      );
      axlePin.rotation.z = Math.PI / 2;
      wheelPivot.add(axlePin);
    } else {
      const sideSign = Math.sign(cfg.x);
      const axleStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10),
        mats.darkFrame
      );
      axleStrut.rotation.z = Math.PI / 2;
      axleStrut.position.set(-sideSign * 0.16, 0, 0);
      wheelPivot.add(axleStrut);
    }

    this.chassisGroup.add(wheelPivot);
    this.wheels.push(wheelPivot);
    this.wheelSpinEntries.push({ pivot: spinPivot, radius: cfg.radius });
    if (cfg.isFront) {
      this.frontWheelSteerPivots.push(wheelPivot);
    }
    return wheelPivot;
  }

  private addNumberMedallion(
    id: NumberblockId,
    pos: THREE.Vector3,
    rotX: number,
    radius: number,
    mats: SharedCarMaterials
  ): THREE.Group {
    const spec = NUMBERBLOCK_SPECS[id];
    const badgeTex = createNumberBadgeTexture(id, spec.primaryColor);
    this.disposableTextures.push(badgeTex);

    const badgeMat = new THREE.MeshStandardMaterial({
      map: badgeTex,
      roughness: 0.24,
      metalness: 0.05,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const mount = new THREE.Group();
    mount.position.copy(pos);
    mount.rotation.x = rotX;

    const backing = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.04, radius * 1.1, 0.036, 26),
      mats.chrome
    );
    backing.rotation.x = Math.PI / 2;
    backing.position.z = -0.02;
    mount.add(backing);

    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 26), badgeMat);
    disc.position.z = 0.002;
    disc.renderOrder = 2;
    mount.add(disc);

    this.chassisGroup.add(mount);
    return mount;
  }

  private addRoundSteeringWheel(
    pos: THREE.Vector3,
    tiltX: number,
    rimColorMat: THREE.Material,
    hubMat: THREE.Material,
    mats: SharedCarMaterials
  ): void {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 0.44, 10),
      mats.darkFrame
    );
    col.position.set(pos.x, pos.y - 0.18, pos.z + 0.14);
    col.rotation.x = tiltX;
    this.chassisGroup.add(col);

    this.steeringWheel.position.copy(pos);
    this.steeringWheel.rotation.set(tiltX, 0, 0);

    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.034, 10, 24), rimColorMat);
    this.steeringWheel.add(wheelRim);

    const wheelHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.048, 14),
      hubMat
    );
    wheelHub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(wheelHub);

    for (let sp = 0; sp < 3; sp++) {
      const spoke = new THREE.Mesh(
        new RoundedBoxGeometry(0.034, 0.15, 0.024, 2, 0.01),
        mats.chrome
      );
      const ang = (sp * Math.PI * 2) / 3 + Math.PI / 2;
      spoke.position.set(Math.cos(ang) * 0.088, Math.sin(ang) * 0.088, 0);
      spoke.rotation.z = ang + Math.PI / 2;
      this.steeringWheel.add(spoke);
    }
  }

  private addHandlebars(
    pos: THREE.Vector3,
    tiltX: number,
    gripColorMat: THREE.Material,
    barMat: THREE.Material,
    mats: SharedCarMaterials
  ): void {
    this.isHandlebarSteer = true;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.05, 0.44, 10),
      mats.chrome
    );
    stem.position.set(pos.x, pos.y - 0.19, pos.z + 0.08);
    stem.rotation.x = -tiltX;
    this.chassisGroup.add(stem);

    this.steeringWheel.position.copy(pos);
    this.steeringWheel.rotation.set(-tiltX, 0, 0);

    const crossBar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.034, 0.56, 6, 12),
      barMat
    );
    crossBar.rotation.z = Math.PI / 2;
    this.steeringWheel.add(crossBar);

    const stemCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), gripColorMat);
    this.steeringWheel.add(stemCap);

    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.046, 0.16, 6, 10),
        gripColorMat
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(side * 0.3, 0, -0.02);
      grip.rotation.y = side * 0.22;
      this.steeringWheel.add(grip);
    }
  }

  private addPedalAssembly(
    pos: THREE.Vector3,
    axleHalfWidth: number,
    pedalMat: THREE.Material,
    mats: SharedCarMaterials
  ): void {
    const crankPivot = new THREE.Group();
    crankPivot.position.copy(pos);

    const crankAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, axleHalfWidth * 2 + 0.04, 10),
      mats.chrome
    );
    crankAxle.rotation.z = Math.PI / 2;
    crankPivot.add(crankAxle);

    const makeArm = (side: -1 | 1): THREE.Group => {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * axleHalfWidth, 0, 0);

      const crankBar = new THREE.Mesh(
        new RoundedBoxGeometry(0.034, 0.16, 0.034, 2, 0.01),
        mats.chrome
      );
      crankBar.position.set(0, side * 0.075, 0);
      armGroup.add(crankBar);

      const pedalPad = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.042, 0.1, 2, 0.015),
        pedalMat
      );
      pedalPad.position.set(side * 0.045, side * 0.145, 0);
      armGroup.add(pedalPad);

      crankPivot.add(armGroup);
      return armGroup;
    };

    this.leftPedalArm = makeArm(-1);
    this.rightPedalArm = makeArm(1);
    this.pedalCrankPivot = crankPivot;
    this.chassisGroup.add(crankPivot);
  }

  private addHeadlights(
    positions: THREE.Vector3[],
    squareStyle: boolean,
    mats: SharedCarMaterials,
    bezelMat?: THREE.Material
  ): void {
    const frameMat = bezelMat ?? mats.chrome;
    for (const p of positions) {
      if (squareStyle) {
        const bezel = new THREE.Mesh(
          new RoundedBoxGeometry(0.24, 0.2, 0.08, 2, 0.03),
          frameMat
        );
        bezel.position.copy(p);
        this.chassisGroup.add(bezel);

        const lens = new THREE.Mesh(
          new RoundedBoxGeometry(0.18, 0.14, 0.04, 2, 0.02),
          mats.headlight
        );
        lens.position.set(p.x, p.y, p.z + 0.032);
        this.chassisGroup.add(lens);
      } else {
        const bezel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.105, 0.115, 0.08, 14),
          frameMat
        );
        bezel.rotation.x = Math.PI / 2;
        bezel.position.copy(p);
        this.chassisGroup.add(bezel);

        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mats.headlight);
        lens.scale.set(1, 1, 0.42);
        lens.position.set(p.x, p.y, p.z + 0.038);
        this.chassisGroup.add(lens);
      }
    }
  }

  // =========================================================================
  // 1 (ONE) — 1-Wheel Red Unicycle Pedal Car (EXACTLY 1 spinning wheel)
  // =========================================================================
  private buildCarOne(mats: SharedCarMaterials): void {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: '#E53935',
      clearcoat: 0.78,
      clearcoatRoughness: 0.14,
      roughness: 0.2,
    });

    // 1. Single giant centered glossy wheel
    this.addWheel(
      {
        x: 0,
        y: 0.5,
        z: 0,
        radius: 0.5,
        width: 0.44,
        rimColor: '#E53935',
        hubColor: '#FFFFFF',
        isFront: true,
        centerMounted: true,
        treadStuds: true,
      },
      mats
    );

    // Pedals spinning directly on the unicycle hub!
    this.addPedalAssembly(new THREE.Vector3(0, 0.5, 0), 0.34, redMat, mats);

    // 2. Twin curved red unicycle fork tubes rising to the saddle frame
    for (const side of [-1, 1]) {
      const lowerPost = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.055, 0.54, 6, 10),
        redMat
      );
      lowerPost.position.set(side * 0.31, 0.78, 0);
      lowerPost.castShadow = true;
      this.chassisGroup.add(lowerPost);
    }

    // Rounded arched mudguard & red saddle body perched over the wheel
    const mudguard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.48, 22, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      redMat
    );
    mudguard.rotation.z = Math.PI / 2;
    mudguard.rotation.y = Math.PI / 2;
    mudguard.position.set(0, 0.5, 0);
    mudguard.castShadow = true;
    this.chassisGroup.add(mudguard);

    const saddleDeck = new THREE.Mesh(
      new RoundedBoxGeometry(0.76, 0.22, 1.18, 4, 0.09),
      redMat
    );
    saddleDeck.position.set(0, 1.04, 0.06);
    saddleDeck.castShadow = true;
    saddleDeck.receiveShadow = true;
    this.chassisGroup.add(saddleDeck);

    // Crisp white center stripe on unicycle fairing
    const stripe = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.04, 0.95, 2, 0.015),
      mats.stripe
    );
    stripe.position.set(0, 1.16, 0.08);
    this.chassisGroup.add(stripe);

    // Sloped front nose fairing + single cyclops rally headlight
    const noseFairing = new THREE.Mesh(
      new RoundedBoxGeometry(0.66, 0.3, 0.48, 4, 0.11),
      redMat
    );
    noseFairing.position.set(0, 1.06, 0.56);
    noseFairing.rotation.x = 0.24;
    noseFairing.castShadow = true;
    this.chassisGroup.add(noseFairing);

    this.addHeadlights([new THREE.Vector3(0, 1.02, 0.81)], false, mats);
    this.addNumberMedallion(1, new THREE.Vector3(0, 1.21, 0.58), -Math.PI / 2 + 0.42, 0.24, mats);

    // Cozy unicycle saddle + tiny rear tail-bumper
    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.58, 0.12, 0.54, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 1.17, -0.14);
    this.chassisGroup.add(seat);

    const tailLight = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.09, 0.1, 2, 0.03),
      mats.accent
    );
    tailLight.position.set(0, 1.08, -0.54);
    this.chassisGroup.add(tailLight);

    // Handlebars + Driver mount
    this.addHandlebars(new THREE.Vector3(0, 1.38, 0.28), 0.35, redMat, redMat, mats);
    this.driverMount.position.set(0, 1.23, -0.14);
  }

  // =========================================================================
  // 2 (TWO) — 2-Wheel Orange Tandem Bike-Car (EXACTLY 2 spinning wheels)
  // =========================================================================
  private buildCarTwo(mats: SharedCarMaterials): void {
    const purpleMat = new THREE.MeshPhysicalMaterial({
      color: '#8E24AA',
      clearcoat: 0.72,
      roughness: 0.2,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: '#E1F5FE',
      transparent: true,
      opacity: 0.62,
      clearcoat: 0.9,
      roughness: 0.08,
    });

    // 2 inline wheels: front steering + rear drive
    this.addWheel(
      {
        x: 0,
        y: 0.38,
        z: 0.8,
        radius: 0.38,
        width: 0.24,
        rimColor: '#8E24AA',
        hubColor: '#FFA726',
        isFront: true,
        centerMounted: true,
      },
      mats
    );
    this.addWheel(
      {
        x: 0,
        y: 0.4,
        z: -0.78,
        radius: 0.4,
        width: 0.28,
        rimColor: '#8E24AA',
        hubColor: '#FFA726',
        isFront: false,
        centerMounted: true,
      },
      mats
    );

    // Sleek narrow orange bike-car chassis frame
    const frameBody = new THREE.Mesh(
      new RoundedBoxGeometry(0.62, 0.34, 1.86, 4, 0.14),
      mats.body
    );
    frameBody.position.set(0, 0.52, -0.02);
    frameBody.castShadow = true;
    frameBody.receiveShadow = true;
    this.chassisGroup.add(frameBody);

    // Purple side racing stripes & chain guard
    for (const side of [-1, 1]) {
      const sideStripe = new THREE.Mesh(
        new RoundedBoxGeometry(0.06, 0.1, 1.48, 2, 0.025),
        purpleMat
      );
      sideStripe.position.set(side * 0.31, 0.56, -0.04);
      this.chassisGroup.add(sideStripe);
    }

    // Sloped front scooter cowling over front wheel
    const frontCowl = new THREE.Mesh(
      new RoundedBoxGeometry(0.56, 0.32, 0.66, 4, 0.12),
      mats.body
    );
    frontCowl.position.set(0, 0.72, 0.66);
    frontCowl.rotation.x = 0.22;
    frontCowl.castShadow = true;
    this.chassisGroup.add(frontCowl);

    // Signature purple glasses-shaped front windshield fairing!
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 1.0, 0.55);
    glassesGroup.rotation.x = -0.22;
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.032, 10, 22), purpleMat);
      frame.position.set(side * 0.175, 0, 0);
      glassesGroup.add(frame);

      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.135, 18), lensMat);
      glass.position.set(side * 0.175, 0, 0.005);
      glassesGroup.add(glass);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 8), purpleMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.02, 0);
    glassesGroup.add(bridge);
    this.chassisGroup.add(glassesGroup);

    this.addHeadlights([new THREE.Vector3(0, 0.65, 1.01)], false, mats, purpleMat);
    this.addNumberMedallion(2, new THREE.Vector3(0, 0.89, 0.78), -Math.PI / 2 + 0.44, 0.22, mats);

    // Tandem dual-cushion saddle + rear purple pillion grab bar
    const frontSeat = new THREE.Mesh(
      new RoundedBoxGeometry(0.52, 0.12, 0.56, 3, 0.05),
      mats.cushion
    );
    frontSeat.position.set(0, 0.7, -0.1);
    this.chassisGroup.add(frontSeat);

    const rearSeat = new THREE.Mesh(
      new RoundedBoxGeometry(0.48, 0.12, 0.42, 3, 0.05),
      purpleMat
    );
    rearSeat.position.set(0, 0.74, -0.62);
    this.chassisGroup.add(rearSeat);

    const grabRail = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.036, 8, 18, Math.PI),
      mats.chrome
    );
    grabRail.position.set(0, 0.8, -0.86);
    this.chassisGroup.add(grabRail);

    // Handlebars, pedals, and driver
    this.addHandlebars(new THREE.Vector3(0, 1.06, 0.34), 0.38, purpleMat, mats.chrome, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.48, 0.22), 0.38, purpleMat, mats);
    this.driverMount.position.set(0, 0.76, -0.1);
  }

  // =========================================================================
  // 3 (THREE) — 3-Wheel Yellow Jester Trike (EXACTLY 3 spinning wheels)
  // =========================================================================
  private buildCarThree(mats: SharedCarMaterials): void {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: '#E53935',
      clearcoat: 0.75,
      roughness: 0.2,
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: '#FFEB3B',
      clearcoat: 0.75,
      roughness: 0.18,
    });

    // 1 front steering wheel + 2 chunky rear wheels = 3 wheels
    this.addWheel(
      {
        x: 0,
        y: 0.38,
        z: 0.88,
        radius: 0.38,
        width: 0.28,
        rimColor: '#E53935',
        hubColor: '#FDD835',
        isFront: true,
        centerMounted: true,
      },
      mats
    );
    for (const side of [-1, 1]) {
      this.addWheel(
        {
          x: side * 0.8,
          y: 0.42,
          z: -0.74,
          radius: 0.42,
          width: 0.34,
          rimColor: '#E53935',
          hubColor: '#FDD835',
          isFront: false,
        },
        mats
      );
    }

    // Tapered yellow trike body + wide rear axle deck
    const frontSpine = new THREE.Mesh(
      new RoundedBoxGeometry(0.76, 0.32, 1.4, 4, 0.12),
      mats.body
    );
    frontSpine.position.set(0, 0.48, 0.2);
    frontSpine.castShadow = true;
    frontSpine.receiveShadow = true;
    this.chassisGroup.add(frontSpine);

    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.36, 0.38, 0.96, 4, 0.14),
      mats.body
    );
    rearDeck.position.set(0, 0.5, -0.68);
    rearDeck.castShadow = true;
    rearDeck.receiveShadow = true;
    this.chassisGroup.add(rearDeck);

    // Red side trim pods
    for (const side of [-1, 1]) {
      const fender = new THREE.Mesh(
        new RoundedBoxGeometry(0.28, 0.16, 0.66, 3, 0.06),
        redMat
      );
      fender.position.set(side * 0.62, 0.68, -0.72);
      this.chassisGroup.add(fender);
    }

    // 3 iconic glossy red button-lights along the front yellow hood!
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), redMat);
      btn.scale.set(1, 0.55, 1);
      btn.position.set((i - 1) * 0.22, 0.66, 0.52);
      this.chassisGroup.add(btn);
    }

    this.addHeadlights(
      [new THREE.Vector3(-0.28, 0.52, 0.9), new THREE.Vector3(0.28, 0.52, 0.9)],
      false,
      mats,
      redMat
    );
    this.addNumberMedallion(3, new THREE.Vector3(0, 0.68, 0.8), -Math.PI / 2 + 0.36, 0.24, mats);

    // Red 3-point jester-crown rear tailfin!
    const jesterFin = new THREE.Group();
    jesterFin.position.set(0, 0.72, -1.04);
    const finBase = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.14, 0.24, 3, 0.05),
      redMat
    );
    jesterFin.add(finBase);

    const prongDefs = [
      { x: -0.34, rotZ: 0.42, h: 0.5 },
      { x: 0, rotZ: 0, h: 0.62 },
      { x: 0.34, rotZ: -0.42, h: 0.5 },
    ];
    for (const p of prongDefs) {
      const pivot = new THREE.Group();
      pivot.position.set(p.x, 0.04, 0);
      pivot.rotation.z = p.rotZ;
      pivot.rotation.x = -0.22;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, p.h, 14), redMat);
      cone.position.y = p.h * 0.5;
      cone.castShadow = true;
      pivot.add(cone);

      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), goldMat);
      bell.position.y = p.h + 0.03;
      pivot.add(bell);

      jesterFin.add(pivot);
    }
    this.jesterTailFin = jesterFin;
    this.chassisGroup.add(jesterFin);

    // Seat, handlebars, pedals & driver
    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.68, 0.14, 0.62, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.62, -0.22);
    this.chassisGroup.add(seat);

    const seatBack = new THREE.Mesh(
      new RoundedBoxGeometry(0.68, 0.46, 0.16, 3, 0.06),
      redMat
    );
    seatBack.position.set(0, 0.82, -0.52);
    seatBack.rotation.x = -0.14;
    this.chassisGroup.add(seatBack);

    this.addHandlebars(new THREE.Vector3(0, 1.0, 0.28), 0.4, redMat, mats.chrome, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.44, 0.44), 0.4, redMat, mats);
    this.driverMount.position.set(0, 0.69, -0.22);
  }

  // =========================================================================
  // 4 (FOUR) — 4-Wheel Green Square Jeep ("Four-Wheel Drive!") (EXACTLY 4 wheels)
  // =========================================================================
  private buildCarFour(mats: SharedCarMaterials): void {
    const darkGreenMat = new THREE.MeshPhysicalMaterial({
      color: '#1B5E20',
      clearcoat: 0.42,
      roughness: 0.34,
    });

    // 4 big beefy green-rimmed off-road tires!
    const jeepWheels: Array<{ x: number; z: number; isFront: boolean }> = [
      { x: -0.9, z: 0.76, isFront: true },
      { x: 0.9, z: 0.76, isFront: true },
      { x: -0.9, z: -0.76, isFront: false },
      { x: 0.9, z: -0.76, isFront: false },
    ];
    for (const w of jeepWheels) {
      this.addWheel(
        {
          x: w.x,
          y: 0.44,
          z: w.z,
          radius: 0.44,
          width: 0.36,
          rimColor: '#43A047',
          hubColor: '#C8E6C9',
          isFront: w.isFront,
          treadStuds: true,
        },
        mats
      );
    }

    // Boxy 2x2 square-block jeep chassis
    const lowerPan = new THREE.Mesh(
      new RoundedBoxGeometry(1.48, 0.24, 2.26, 3, 0.06),
      darkGreenMat
    );
    lowerPan.position.set(0, 0.44, 0);
    lowerPan.castShadow = true;
    lowerPan.receiveShadow = true;
    this.chassisGroup.add(lowerPan);

    // 2x2 boxy hood blocks up front
    for (const side of [-1, 1]) {
      const hoodBlock = new THREE.Mesh(
        new RoundedBoxGeometry(0.64, 0.36, 0.88, 3, 0.07),
        mats.body
      );
      hoodBlock.position.set(side * 0.34, 0.7, 0.68);
      hoodBlock.castShadow = true;
      hoodBlock.receiveShadow = true;
      this.chassisGroup.add(hoodBlock);

      // Boxy side doors
      const sideDoor = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.4, 1.24, 3, 0.06),
        mats.body
      );
      sideDoor.position.set(side * 0.64, 0.68, -0.08);
      sideDoor.castShadow = true;
      this.chassisGroup.add(sideDoor);

      // Square wheel arch fenders
      for (const zPos of [0.76, -0.76]) {
        const arch = new THREE.Mesh(
          new RoundedBoxGeometry(0.32, 0.12, 0.72, 2, 0.03),
          darkGreenMat
        );
        arch.position.set(side * 0.82, 0.92, zPos);
        this.chassisGroup.add(arch);
      }
    }

    // Rugged square bull-bar front bumper & square headlights
    const bullBar = new THREE.Mesh(
      new RoundedBoxGeometry(1.36, 0.18, 0.16, 2, 0.04),
      darkGreenMat
    );
    bullBar.position.set(0, 0.48, 1.18);
    bullBar.castShadow = true;
    this.chassisGroup.add(bullBar);

    this.addHeadlights(
      [new THREE.Vector3(-0.44, 0.7, 1.12), new THREE.Vector3(0.44, 0.7, 1.12)],
      true,
      mats,
      darkGreenMat
    );

    this.addNumberMedallion(4, new THREE.Vector3(0, 0.9, 0.72), -Math.PI / 2 + 0.16, 0.28, mats);

    // Rear blocky deck + square rollcage behind Four!
    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.36, 0.42, 0.56, 3, 0.07),
      mats.body
    );
    rearDeck.position.set(0, 0.72, -0.84);
    rearDeck.castShadow = true;
    this.chassisGroup.add(rearDeck);

    // Dark-green square rollcage arch
    const cageTop = new THREE.Mesh(
      new RoundedBoxGeometry(1.26, 0.1, 0.12, 2, 0.03),
      darkGreenMat
    );
    cageTop.position.set(0, 1.56, -0.68);
    cageTop.castShadow = true;
    this.chassisGroup.add(cageTop);

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 0.72, 0.12, 2, 0.03),
        darkGreenMat
      );
      pillar.position.set(side * 0.57, 1.22, -0.68);
      pillar.castShadow = true;
      this.chassisGroup.add(pillar);
    }

    // Seat, steering wheel, pedals, driver
    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.14, 0.7, 3, 0.04),
      mats.cushion
    );
    seat.position.set(0, 0.58, -0.18);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(
      new THREE.Vector3(0, 1.0, 0.24),
      0.55,
      darkGreenMat,
      mats.body,
      mats
    );
    this.addPedalAssembly(new THREE.Vector3(0, 0.54, 0.44), 0.24, darkGreenMat, mats);
    this.driverMount.position.set(0, 0.65, -0.18);
  }

  // =========================================================================
  // 5 (FIVE) — 5-Wheel Sky-Blue Star Cruiser (EXACTLY 5 spinning wheels)
  // =========================================================================
  private buildCarFive(mats: SharedCarMaterials): void {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: '#E53935',
      clearcoat: 0.75,
      roughness: 0.2,
    });
    const gloveBlueMat = new THREE.MeshPhysicalMaterial({
      color: '#1565C0',
      clearcoat: 0.72,
      roughness: 0.18,
    });

    // 2 front + 2 rear + 1 prominent center rear 5th boost wheel = 5 wheels!
    for (const side of [-1, 1]) {
      this.addWheel(
        {
          x: side * 0.84,
          y: 0.36,
          z: 0.82,
          radius: 0.36,
          width: 0.28,
          rimColor: '#29B6F6',
          hubColor: '#FF5252',
          isFront: true,
        },
        mats
      );
      this.addWheel(
        {
          x: side * 0.92,
          y: 0.39,
          z: -0.74,
          radius: 0.39,
          width: 0.3,
          rimColor: '#29B6F6',
          hubColor: '#FF5252',
          isFront: false,
        },
        mats
      );
    }

    // The 5th center rear boost wheel rolling cleanly on the road!
    this.addWheel(
      {
        x: 0,
        y: 0.41,
        z: -1.02,
        radius: 0.41,
        width: 0.34,
        rimColor: '#E53935',
        hubColor: '#FFEB3B',
        isFront: false,
        centerMounted: true,
        treadStuds: true,
      },
      mats
    );

    // Sky-blue cruiser shell
    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(1.38, 0.2, 2.28, 4, 0.08),
      mats.darkFrame
    );
    floor.position.set(0, 0.36, 0.02);
    floor.castShadow = true;
    this.chassisGroup.add(floor);

    const nose = new THREE.Mesh(
      new RoundedBoxGeometry(1.12, 0.34, 0.98, 5, 0.14),
      mats.body
    );
    nose.position.set(0, 0.54, 0.76);
    nose.rotation.x = 0.08;
    nose.castShadow = true;
    this.chassisGroup.add(nose);

    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(
        new RoundedBoxGeometry(0.32, 0.36, 1.32, 4, 0.12),
        mats.body
      );
      pod.position.set(side * 0.64, 0.52, -0.02);
      pod.castShadow = true;
      this.chassisGroup.add(pod);

      const stripe = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.08, 1.08, 2, 0.03),
        redMat
      );
      stripe.position.set(side * 0.64, 0.58, -0.02);
      this.chassisGroup.add(stripe);
    }

    // Rear cowling split cleanly above the 5th center wheel
    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.34, 0.26, 0.66, 4, 0.1),
      mats.body
    );
    rearDeck.position.set(0, 0.78, -0.82);
    rearDeck.castShadow = true;
    this.chassisGroup.add(rearDeck);

    // Red 5-point star emblem on front nose!
    const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.24, 0.105, 5), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    starGeo.center();
    const noseStar = new THREE.Mesh(starGeo, redMat);
    noseStar.position.set(0, 0.52, 1.26);
    noseStar.castShadow = true;
    this.chassisGroup.add(noseStar);

    this.addHeadlights(
      [new THREE.Vector3(-0.4, 0.54, 1.24), new THREE.Vector3(0.4, 0.54, 1.24)],
      false,
      mats
    );
    this.addNumberMedallion(5, new THREE.Vector3(0, 0.74, 0.84), -Math.PI / 2 + 0.32, 0.27, mats);

    // High-five blue glove-wing rear spoiler!
    const wing = new THREE.Mesh(
      new RoundedBoxGeometry(1.52, 0.1, 0.34, 3, 0.04),
      mats.body
    );
    wing.position.set(0, 1.18, -1.04);
    wing.rotation.x = -0.12;
    wing.castShadow = true;
    this.chassisGroup.add(wing);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.36, 0.14, 2, 0.02),
        mats.darkFrame
      );
      strut.position.set(side * 0.42, 0.98, -0.98);
      this.chassisGroup.add(strut);

      const glovePlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.28, 0.42, 3, 0.04),
        gloveBlueMat
      );
      glovePlate.position.set(side * 0.76, 1.2, -1.04);
      this.chassisGroup.add(glovePlate);
    }

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.72, 0.14, 0.66, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.48, -0.14);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(new THREE.Vector3(0, 0.94, 0.24), 0.56, mats.darkFrame, redMat, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.5, 0.44), 0.22, redMat, mats);
    this.driverMount.position.set(0, 0.55, -0.14);
  }

  // =========================================================================
  // 6 (SIX) — 6-Wheel Purple Dice Roller (EXACTLY 6 spinning wheels)
  // =========================================================================
  private buildCarSix(mats: SharedCarMaterials): void {
    const deepPurpleMat = new THREE.MeshPhysicalMaterial({
      color: '#5E35B1',
      clearcoat: 0.65,
      roughness: 0.22,
    });

    // 3 pairs along left & right sides = 6 spinning wheels with crisp white rims!
    const zPositions = [0.88, 0.0, -0.88];
    for (let i = 0; i < zPositions.length; i++) {
      for (const side of [-1, 1]) {
        this.addWheel(
          {
            x: side * 0.88,
            y: 0.35,
            z: zPositions[i],
            radius: 0.35,
            width: 0.25,
            rimColor: '#FFFFFF',
            hubColor: '#7E57C2',
            isFront: i === 0,
          },
          mats
        );
      }
    }

    // Purple rectangular dice-box chassis
    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(1.44, 0.2, 2.52, 4, 0.07),
      deepPurpleMat
    );
    floor.position.set(0, 0.34, 0);
    floor.castShadow = true;
    this.chassisGroup.add(floor);

    const nose = new THREE.Mesh(
      new RoundedBoxGeometry(1.2, 0.38, 0.92, 4, 0.12),
      mats.body
    );
    nose.position.set(0, 0.54, 0.84);
    nose.castShadow = true;
    this.chassisGroup.add(nose);

    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.24, 0.44, 0.66, 4, 0.12),
      mats.body
    );
    rearDeck.position.set(0, 0.58, -0.88);
    rearDeck.castShadow = true;
    this.chassisGroup.add(rearDeck);

    // Giant dice-dot panels decorating left & right side pods!
    const diceMatList: THREE.MeshPhysicalMaterial[] = [];
    for (const pips of [1, 2, 3, 4, 5, 6]) {
      const tex = createDiceFaceTexture(pips, '#7E57C2');
      this.disposableTextures.push(tex);
      diceMatList.push(
        new THREE.MeshPhysicalMaterial({
          color: '#FFFFFF',
          map: tex,
          clearcoat: 0.65,
          roughness: 0.2,
        })
      );
    }

    const sideCubeGeo = new RoundedBoxGeometry(0.32, 0.34, 0.34, 3, 0.05);
    const leftPips = [0, 2, 4]; // dice faces 1, 3, 5
    const rightPips = [1, 3, 5]; // dice faces 2, 4, 6
    const podZs = [0.44, 0.0, -0.44];

    for (let i = 0; i < 3; i++) {
      const leftBlock = new THREE.Mesh(sideCubeGeo, diceMatList[leftPips[i]]);
      leftBlock.position.set(-0.64, 0.56, podZs[i]);
      leftBlock.castShadow = true;
      this.chassisGroup.add(leftBlock);

      const rightBlock = new THREE.Mesh(sideCubeGeo, diceMatList[rightPips[i]]);
      rightBlock.position.set(0.64, 0.56, podZs[i]);
      rightBlock.castShadow = true;
      this.chassisGroup.add(rightBlock);
    }

    // White dice-inspired rear spoiler & bumpers
    const wing = new THREE.Mesh(
      new RoundedBoxGeometry(1.42, 0.1, 0.32, 3, 0.04),
      mats.stripe
    );
    wing.position.set(0, 1.08, -1.08);
    wing.rotation.x = -0.12;
    wing.castShadow = true;
    this.chassisGroup.add(wing);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.34, 0.14, 2, 0.02),
        deepPurpleMat
      );
      strut.position.set(side * 0.4, 0.9, -1.02);
      this.chassisGroup.add(strut);
    }

    this.addHeadlights(
      [new THREE.Vector3(-0.42, 0.54, 1.3), new THREE.Vector3(0.42, 0.54, 1.3)],
      true,
      mats,
      mats.stripe
    );
    this.addNumberMedallion(6, new THREE.Vector3(0, 0.76, 0.9), -Math.PI / 2 + 0.25, 0.27, mats);

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.84, 0.14, 0.68, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.48, -0.16);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(
      new THREE.Vector3(0, 0.94, 0.24),
      0.56,
      mats.stripe,
      deepPurpleMat,
      mats
    );
    this.addPedalAssembly(new THREE.Vector3(0, 0.5, 0.46), 0.23, mats.stripe, mats);
    this.driverMount.position.set(0, 0.55, -0.16);
  }

  // =========================================================================
  // 7 (SEVEN) — 7-Wheel Rainbow Racer (EXACTLY 7 spinning wheels)
  // =========================================================================
  private buildCarSeven(mats: SharedCarMaterials): void {
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: '#FFD54F',
      emissive: '#FF8F00',
      emissiveIntensity: 0.16,
      clearcoat: 0.78,
      roughness: 0.18,
      metalness: 0.22,
    });

    // 1 leading front nose wheel + 3 pairs of side wheels = 7 spinning wheels with the 7 rainbow colors!
    this.addWheel(
      {
        x: 0,
        y: 0.35,
        z: 1.08,
        radius: 0.35,
        width: 0.28,
        rimColor: RAINBOW_COLORS[0], // Red
        hubColor: '#FFD54F',
        isFront: true,
        centerMounted: true,
      },
      mats
    );

    const pairDefs: Array<{ z: number; leftColor: string; rightColor: string; isFront: boolean; radius: number }> = [
      { z: 0.46, leftColor: RAINBOW_COLORS[1], rightColor: RAINBOW_COLORS[2], isFront: true, radius: 0.34 },
      { z: -0.26, leftColor: RAINBOW_COLORS[3], rightColor: RAINBOW_COLORS[4], isFront: false, radius: 0.34 },
      { z: -0.96, leftColor: RAINBOW_COLORS[5], rightColor: RAINBOW_COLORS[6], isFront: false, radius: 0.36 },
    ];
    for (const p of pairDefs) {
      this.addWheel(
        {
          x: -0.86,
          y: p.radius,
          z: p.z,
          radius: p.radius,
          width: 0.24,
          rimColor: p.leftColor,
          hubColor: '#FFFFFF',
          isFront: p.isFront,
        },
        mats
      );
      this.addWheel(
        {
          x: 0.86,
          y: p.radius,
          z: p.z,
          radius: p.radius,
          width: 0.24,
          rimColor: p.rightColor,
          hubColor: '#FFFFFF',
          isFront: p.isFront,
        },
        mats
      );
    }

    // 7-segment rainbow-striped dragster chassis!
    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(1.36, 0.18, 2.56, 4, 0.07),
      mats.darkFrame
    );
    floor.position.set(0, 0.34, -0.04);
    floor.castShadow = true;
    this.chassisGroup.add(floor);

    // Rainbow horizontal color bands from front nose to rear deck
    for (let i = 0; i < 7; i++) {
      const bandMat = new THREE.MeshPhysicalMaterial({
        color: RAINBOW_COLORS[i],
        clearcoat: 0.76,
        clearcoatRoughness: 0.15,
        roughness: 0.2,
      });
      const zCenter = 0.82 - i * 0.33;
      const bandWidth = i < 2 ? 0.92 + i * 0.14 : 1.28;
      const bandHeight = i >= 5 ? 0.42 : 0.32;
      const band = new THREE.Mesh(
        new RoundedBoxGeometry(bandWidth, bandHeight, 0.31, 3, 0.07),
        bandMat
      );
      band.position.set(0, 0.52 + (i >= 5 ? 0.05 : 0), zCenter);
      band.castShadow = true;
      band.receiveShadow = true;
      this.chassisGroup.add(band);
    }

    // Rainbow arch spoiler at the back
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0.82, -1.04);
    for (let i = 0; i < 7; i++) {
      const arcMat = new THREE.MeshPhysicalMaterial({
        color: RAINBOW_COLORS[i],
        clearcoat: 0.72,
        roughness: 0.2,
      });
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.68 - i * 0.045, 0.028, 8, 20, Math.PI),
        arcMat
      );
      archGroup.add(arc);
    }
    this.rainbowArch = archGroup;
    this.chassisGroup.add(archGroup);

    // Spinning golden lucky star flag at the back!
    const flagGroup = new THREE.Group();
    flagGroup.position.set(0.46, 0.78, -1.24);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), mats.chrome);
    pole.position.y = 0.45;
    flagGroup.add(pole);

    const starSpinner = new THREE.Group();
    starSpinner.position.y = 0.96;
    const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.22, 0.095, 5), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    starGeo.center();
    const luckyStar = new THREE.Mesh(starGeo, goldMat);
    luckyStar.castShadow = true;
    starSpinner.add(luckyStar);
    flagGroup.add(starSpinner);

    this.luckyStarFlag = starSpinner;
    this.chassisGroup.add(flagGroup);

    this.addHeadlights(
      [new THREE.Vector3(-0.34, 0.56, 0.98), new THREE.Vector3(0.34, 0.56, 0.98)],
      false,
      mats,
      goldMat
    );
    this.addNumberMedallion(7, new THREE.Vector3(0, 0.72, 0.68), -Math.PI / 2 + 0.34, 0.26, mats);

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.74, 0.14, 0.62, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.64, -0.2);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(new THREE.Vector3(0, 0.98, 0.2), 0.52, goldMat, mats.body, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.54, 0.42), 0.22, goldMat, mats);
    this.driverMount.position.set(0, 0.71, -0.2);
  }

  // =========================================================================
  // 8 (EIGHT) — 8-Wheel Magenta Octo-Racer (EXACTLY 8 spinning wheels)
  // =========================================================================
  private buildCarEight(mats: SharedCarMaterials): void {
    const maskPlumMat = new THREE.MeshPhysicalMaterial({
      color: '#AD1457',
      clearcoat: 0.7,
      roughness: 0.2,
    });
    const pinkLegMat = new THREE.MeshPhysicalMaterial({
      color: '#F48FB1',
      clearcoat: 0.65,
      roughness: 0.22,
    });

    // 4 pairs along left & right sides = 8 spinning wheels with hot-pink rims!
    const zPairs = [0.96, 0.32, -0.32, -0.96];
    for (let i = 0; i < zPairs.length; i++) {
      for (const side of [-1, 1]) {
        this.addWheel(
          {
            x: side * 0.88,
            y: 0.32,
            z: zPairs[i],
            radius: 0.32,
            width: 0.24,
            rimColor: '#EC407A',
            hubColor: '#FCE4EC',
            isFront: i === 0,
          },
          mats
        );

        // 8 cute articulated pink bumper-legs arching over each fender!
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.62, 0.64, zPairs[i]);
        const baseRotZ = -side * 0.25;
        legPivot.rotation.z = baseRotZ;

        const archSegment = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.065, 0.34, 6, 10),
          mats.body
        );
        archSegment.rotation.z = side * (Math.PI / 2.2);
        archSegment.position.set(side * 0.16, 0.06, 0);
        archSegment.castShadow = true;
        legPivot.add(archSegment);

        const tipPad = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pinkLegMat);
        tipPad.position.set(side * 0.35, -0.02, 0);
        legPivot.add(tipPad);

        this.chassisGroup.add(legPivot);
        this.octoLegs.push({ pivot: legPivot, side, index: i, baseRotZ });
      }
    }

    // Heroic magenta Octoblock crawler hull
    const hull = new THREE.Mesh(
      new RoundedBoxGeometry(1.36, 0.36, 2.52, 4, 0.13),
      mats.body
    );
    hull.position.set(0, 0.48, 0);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.chassisGroup.add(hull);

    // Superhero domino eye-mask grille on front nose!
    const maskGeo = new THREE.ExtrudeGeometry(createDominoMaskShape(1.12, 0.36), {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    maskGeo.center();
    const frontMask = new THREE.Mesh(maskGeo, maskPlumMat);
    frontMask.position.set(0, 0.52, 1.26);
    frontMask.castShadow = true;
    this.chassisGroup.add(frontMask);

    this.addHeadlights(
      [new THREE.Vector3(-0.34, 0.52, 1.3), new THREE.Vector3(0.34, 0.52, 1.3)],
      false,
      mats,
      pinkLegMat
    );
    this.addNumberMedallion(8, new THREE.Vector3(0, 0.7, 0.88), -Math.PI / 2 + 0.24, 0.27, mats);

    // Rear Octo-fin & seat
    const rearSpoiler = new THREE.Mesh(
      new RoundedBoxGeometry(1.32, 0.12, 0.32, 3, 0.05),
      maskPlumMat
    );
    rearSpoiler.position.set(0, 0.94, -1.1);
    rearSpoiler.rotation.x = -0.15;
    this.chassisGroup.add(rearSpoiler);

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.84, 0.14, 0.68, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.62, -0.16);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(new THREE.Vector3(0, 0.98, 0.24), 0.54, maskPlumMat, pinkLegMat, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.54, 0.46), 0.23, pinkLegMat, mats);
    this.driverMount.position.set(0, 0.69, -0.16);
  }

  // =========================================================================
  // 9 (NINE) — 9-Wheel 3-Tone Grey Square Cruiser (EXACTLY 9 spinning wheels)
  // =========================================================================
  private buildCarNine(mats: SharedCarMaterials): void {
    const greyLight = new THREE.MeshPhysicalMaterial({
      color: '#BDBDBD',
      clearcoat: 0.58,
      roughness: 0.26,
    });
    const greyMid = new THREE.MeshPhysicalMaterial({
      color: '#9E9E9E',
      clearcoat: 0.58,
      roughness: 0.26,
    });
    const greyDark = new THREE.MeshPhysicalMaterial({
      color: '#757575',
      clearcoat: 0.58,
      roughness: 0.26,
    });
    const charcoal = new THREE.MeshPhysicalMaterial({
      color: '#424242',
      clearcoat: 0.35,
      roughness: 0.38,
    });

    // 1 wide center front steering wheel + 4 pairs along left & right sides = 9 wheels!
    this.addWheel(
      {
        x: 0,
        y: 0.36,
        z: 1.08,
        radius: 0.36,
        width: 0.4,
        rimColor: '#BDBDBD',
        hubColor: '#424242',
        isFront: true,
        centerMounted: true,
        treadStuds: true,
      },
      mats
    );

    const sideZ = [0.6, 0.06, -0.48, -1.02];
    const sideColors = ['#BDBDBD', '#9E9E9E', '#757575', '#616161'];
    for (let i = 0; i < sideZ.length; i++) {
      for (const side of [-1, 1]) {
        this.addWheel(
          {
            x: side * 0.9,
            y: i === 3 ? 0.34 : 0.32,
            z: sideZ[i],
            radius: i === 3 ? 0.34 : 0.32,
            width: 0.23,
            rimColor: sideColors[i],
            hubColor: '#ECEFF1',
            isFront: false,
          },
          mats
        );
      }
    }

    // Wide sturdy 3x3 three-tone grey stepped block chassis!
    const baseFrame = new THREE.Mesh(
      new RoundedBoxGeometry(1.48, 0.2, 2.38, 3, 0.06),
      charcoal
    );
    baseFrame.position.set(0, 0.34, -0.14);
    baseFrame.castShadow = true;
    this.chassisGroup.add(baseFrame);

    // 3-tone longitudinal block bands matching Nine's 3 grey shades!
    const bandSpecs = [
      { x: -0.46, mat: greyLight },
      { x: 0, mat: greyMid },
      { x: 0.46, mat: greyDark },
    ];
    for (const b of bandSpecs) {
      const hoodPiece = new THREE.Mesh(
        new RoundedBoxGeometry(0.44, 0.32, 0.8, 3, 0.06),
        b.mat
      );
      hoodPiece.position.set(b.x, 0.56, 0.56);
      hoodPiece.castShadow = true;
      this.chassisGroup.add(hoodPiece);

      const rearPiece = new THREE.Mesh(
        new RoundedBoxGeometry(0.44, 0.38, 0.72, 3, 0.06),
        b.mat
      );
      rearPiece.position.set(b.x, 0.6, -0.88);
      rearPiece.castShadow = true;
      this.chassisGroup.add(rearPiece);
    }

    // Dual chrome sneeze-horn pipes curving up at the rear!
    for (const side of [-1, 1]) {
      const hornGroup = new THREE.Group();
      hornGroup.position.set(side * 0.46, 0.78, -1.04);

      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.055, 0.46, 12),
        mats.chrome
      );
      stack.position.y = 0.22;
      stack.rotation.x = -0.24;
      stack.castShadow = true;
      hornGroup.add(stack);

      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.065, 0.12, 14),
        mats.chrome
      );
      bell.position.set(0, 0.46, -0.06);
      bell.rotation.x = -0.24;
      hornGroup.add(bell);

      this.sneezePipes.push(hornGroup);
      this.chassisGroup.add(hornGroup);
    }

    this.addHeadlights(
      [new THREE.Vector3(-0.46, 0.56, 0.98), new THREE.Vector3(0.46, 0.56, 0.98)],
      true,
      mats,
      charcoal
    );
    this.addNumberMedallion(9, new THREE.Vector3(0, 0.74, 0.66), -Math.PI / 2 + 0.2, 0.27, mats);

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(1.06, 0.14, 0.66, 3, 0.04),
      mats.cushion
    );
    seat.position.set(0, 0.48, -0.2);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(new THREE.Vector3(0, 0.94, 0.18), 0.54, charcoal, greyLight, mats);
    this.addPedalAssembly(new THREE.Vector3(0, 0.5, 0.38), 0.24, charcoal, mats);
    this.driverMount.position.set(0, 0.55, -0.2);
  }

  // =========================================================================
  // 10 (TEN) — 10-Wheel White & Red Rocket Car (EXACTLY 10 spinning wheels)
  // =========================================================================
  private buildCarTen(mats: SharedCarMaterials): void {
    const whiteShellMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      clearcoat: 0.82,
      clearcoatRoughness: 0.12,
      roughness: 0.16,
    });
    const redBorderMat = new THREE.MeshPhysicalMaterial({
      color: '#E53935',
      clearcoat: 0.78,
      clearcoatRoughness: 0.14,
      roughness: 0.18,
    });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#FFAB00' });
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: '#FF3D00' });

    // 5 pairs neatly spaced along left & right sides = 10 spinning wheels with bright red rims!
    const zPairs = [1.1, 0.55, 0.0, -0.55, -1.1];
    for (let i = 0; i < zPairs.length; i++) {
      for (const side of [-1, 1]) {
        this.addWheel(
          {
            x: side * 0.88,
            y: 0.3,
            z: zPairs[i],
            radius: 0.3,
            width: 0.23,
            rimColor: '#E53935',
            hubColor: '#FFFFFF',
            isFront: i === 0,
          },
          mats
        );
      }
    }

    // Long sleek white-with-red-border rocket chassis
    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(1.38, 0.18, 2.84, 4, 0.07),
      redBorderMat
    );
    floor.position.set(0, 0.32, 0);
    floor.castShadow = true;
    this.chassisGroup.add(floor);

    // Sleek white nose cone + pointed rocket tip
    const nose = new THREE.Mesh(
      new RoundedBoxGeometry(1.08, 0.32, 1.08, 5, 0.14),
      whiteShellMat
    );
    nose.position.set(0, 0.5, 0.9);
    nose.rotation.x = 0.08;
    nose.castShadow = true;
    this.chassisGroup.add(nose);

    const rocketNoseTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.46, 0.56, 20),
      redBorderMat
    );
    rocketNoseTip.rotation.x = Math.PI / 2;
    rocketNoseTip.scale.set(1.15, 1, 0.65);
    rocketNoseTip.position.set(0, 0.44, 1.56);
    rocketNoseTip.castShadow = true;
    this.chassisGroup.add(rocketNoseTip);

    // Side pods: white core framed with crisp red border trim!
    for (const side of [-1, 1]) {
      const sidePod = new THREE.Mesh(
        new RoundedBoxGeometry(0.32, 0.34, 1.62, 4, 0.1),
        whiteShellMat
      );
      sidePod.position.set(side * 0.64, 0.48, -0.02);
      sidePod.castShadow = true;
      this.chassisGroup.add(sidePod);

      const redTrim = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.085, 1.48, 2, 0.03),
        redBorderMat
      );
      redTrim.position.set(side * 0.64, 0.56, -0.02);
      this.chassisGroup.add(redTrim);

      // Swept red rocket tail fin
      const fin = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.46, 0.54, 3, 0.03),
        redBorderMat
      );
      fin.position.set(side * 0.58, 0.86, -1.16);
      fin.rotation.x = -0.32;
      fin.rotation.z = -side * 0.16;
      fin.castShadow = true;
      this.chassisGroup.add(fin);
    }

    // Rear white rocket deck
    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.18, 0.36, 0.72, 4, 0.12),
      whiteShellMat
    );
    rearDeck.position.set(0, 0.54, -1.04);
    rearDeck.castShadow = true;
    this.chassisGroup.add(rearDeck);

    // Red star nose badge + crisp 10 medallion
    const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.2, 0.09, 5), {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    starGeo.center();
    const starBadge = new THREE.Mesh(starGeo, whiteShellMat);
    starBadge.position.set(0, 0.5, 1.62);
    this.chassisGroup.add(starBadge);

    this.addHeadlights(
      [new THREE.Vector3(-0.38, 0.5, 1.42), new THREE.Vector3(0.38, 0.5, 1.42)],
      false,
      mats,
      redBorderMat
    );
    this.addNumberMedallion(10, new THREE.Vector3(0, 0.7, 0.94), -Math.PI / 2 + 0.3, 0.28, mats);

    // Twin glowing red-and-gold rocket thrusters on the back!
    for (const side of [-1, 1]) {
      const thruster = new THREE.Group();
      thruster.position.set(side * 0.3, 0.58, -1.36);

      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.42, 16),
        redBorderMat
      );
      housing.rotation.x = Math.PI / 2;
      housing.castShadow = true;
      thruster.add(housing);

      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.11, 0.14, 14),
        mats.chrome
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.z = -0.24;
      thruster.add(nozzle);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 14), innerFlameMat);
      outerFlame.rotation.x = -Math.PI / 2;
      outerFlame.position.z = -0.48;
      thruster.add(outerFlame);
      this.rocketFlames.push(outerFlame);

      const coreFlame = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.32, 12), flameMat);
      coreFlame.rotation.x = -Math.PI / 2;
      coreFlame.position.z = -0.44;
      thruster.add(coreFlame);
      this.rocketFlames.push(coreFlame);

      this.chassisGroup.add(thruster);
    }

    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(0.76, 0.14, 0.66, 3, 0.05),
      mats.cushion
    );
    seat.position.set(0, 0.46, -0.18);
    this.chassisGroup.add(seat);

    this.addRoundSteeringWheel(
      new THREE.Vector3(0, 0.94, 0.24),
      0.56,
      redBorderMat,
      whiteShellMat,
      mats
    );
    this.addPedalAssembly(new THREE.Vector3(0, 0.48, 0.48), 0.22, redBorderMat, mats);
    this.driverMount.position.set(0, 0.53, -0.18);
  }

  public update(
    dt: number,
    time: number,
    speed: number,
    steerAngle: number,
    isAirborne: boolean,
    animState?: NumberblockAnimState
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    // Smooth steering & airborne transitions
    const steerLerp = 1 - Math.exp(-12 * clampedDt);
    this.smoothedSteer += (steerAngle - this.smoothedSteer) * steerLerp;

    const airTarget = isAirborne ? 1 : 0;
    this.smoothedAirborne += (airTarget - this.smoothedAirborne) * (1 - Math.exp(-10 * clampedDt));

    // Spin all N wheels smoothly proportional to each wheel's radius
    this.wheelDistance += speed * clampedDt;
    for (const entry of this.wheelSpinEntries) {
      entry.pivot.rotation.x = this.wheelDistance / entry.radius;
    }

    // Front wheel steering pivot & steering wheel / handlebars rotation
    const visualFrontSteer = THREE.MathUtils.clamp(this.smoothedSteer, -0.52, 0.52);
    for (const frontPivot of this.frontWheelSteerPivots) {
      frontPivot.rotation.y = visualFrontSteer;
    }
    if (this.isHandlebarSteer) {
      this.steeringWheel.rotation.y = visualFrontSteer * 0.9;
      this.steeringWheel.rotation.z = 0;
    } else {
      this.steeringWheel.rotation.y = 0;
      this.steeringWheel.rotation.z = -visualFrontSteer * 1.55;
    }

    // Pedal crank spin proportional to speed
    const pedalRate = Math.max(1.2, Math.abs(speed) * 0.65);
    this.pedalAngle += pedalRate * clampedDt;
    if (this.pedalCrankPivot) {
      this.pedalCrankPivot.rotation.x = this.pedalAngle;
    }
    if (this.leftPedalArm) {
      this.leftPedalArm.rotation.x = -this.pedalAngle;
    }
    if (this.rightPedalArm) {
      this.rightPedalArm.rotation.x = -this.pedalAngle;
    }

    // Bouncy suspension spring & dynamic lean into turns (extra expressive lean on 1 & 2!)
    const speedNorm = THREE.MathUtils.clamp(Math.abs(speed) / 28, 0, 1.4);
    const roadBounce =
      !isAirborne && speedNorm > 0.05
        ? Math.sin(time * (14 + speedNorm * 8)) * 0.022 * speedNorm
        : Math.sin(time * 3.5) * 0.008;

    const leanMultiplier = this.currentId <= 2 ? 1.35 : 1.0;
    const leanRoll = -this.smoothedSteer * (0.14 + 0.06 * speedNorm) * leanMultiplier;
    const pitchTilt = this.smoothedAirborne * -0.14 + (speed > 2 ? -0.025 * speedNorm : 0);

    this.chassisGroup.position.y = roadBounce;
    this.chassisGroup.rotation.z = leanRoll;
    this.chassisGroup.rotation.x = pitchTilt;

    // Character-specific car extras animation
    if (this.jesterTailFin) {
      this.jesterTailFin.rotation.z = Math.sin(time * (6 + speedNorm * 8)) * (0.04 + 0.05 * speedNorm);
    }
    if (this.luckyStarFlag) {
      this.luckyStarFlag.rotation.y = time * (2.4 + speedNorm * 4.2);
    }
    if (this.rainbowArch) {
      this.rainbowArch.rotation.z = Math.sin(time * 5.2) * (0.03 + 0.04 * speedNorm);
    }
    for (const leg of this.octoLegs) {
      const waveFreq = 5 + speedNorm * 10;
      const phase = leg.index * 0.7 + (leg.side > 0 ? 0 : Math.PI * 0.5);
      leg.pivot.rotation.z = leg.baseRotZ + Math.sin(time * waveFreq + phase) * 0.16 * leg.side;
    }
    for (let i = 0; i < this.sneezePipes.length; i++) {
      const pipe = this.sneezePipes[i];
      if (animState === 'sneeze') {
        const jiggle = Math.sin(time * 26 + i) * 0.18;
        pipe.scale.set(1 + Math.abs(jiggle) * 0.35, 1 + jiggle * 0.4, 1 + Math.abs(jiggle) * 0.35);
        pipe.rotation.z = jiggle * 0.6;
      } else {
        const chug = 1 + Math.sin(time * (6 + speedNorm * 12) + i * Math.PI) * 0.04;
        pipe.scale.set(chug, 1, chug);
        pipe.rotation.z = 0;
      }
    }
    for (let i = 0; i < this.rocketFlames.length; i++) {
      const flame = this.rocketFlames[i];
      const baseLen = 0.65 + speedNorm * 0.95 + (animState === 'celebrate' ? 0.35 : 0);
      const flicker = 0.85 + Math.sin(time * 28 + i * 1.7) * 0.26;
      flame.scale.set(1, baseLen * flicker, 1);
    }

    // Springy pop-in scale animation on driver swap
    if (this.swapPopTimer > 0) {
      this.swapPopTimer = Math.max(0, this.swapPopTimer - clampedDt);
      const progress = 1 - this.swapPopTimer / 0.42;
      const overshoot = 1 + Math.sin(progress * Math.PI) * 0.24 * (1 - progress * 0.4);
      this.driverMount.scale.setScalar(overshoot);
      this.chassisGroup.scale.set(1 + (overshoot - 1) * 0.25, overshoot, 1);
    } else {
      this.driverMount.scale.setScalar(1);
      this.chassisGroup.scale.set(1, 1, 1);
    }

    // Delegate animation to driver NumberblockRig
    const resolvedAnim: NumberblockAnimState =
      animState ?? (Math.abs(speed) > 1.5 ? 'racing' : 'idle');
    this.driverRig.update(clampedDt, time, resolvedAnim);
  }

  private disposeChassisContents(): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();

    this.chassisGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          obj.geometry.dispose();
          disposedGeos.add(obj.geometry);
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat && !disposedMats.has(mat)) {
            if ('map' in mat && mat.map instanceof THREE.Texture) {
              mat.map.dispose();
            }
            mat.dispose();
            disposedMats.add(mat);
          }
        }
      }
    });

    for (const tex of this.disposableTextures) {
      tex.dispose();
    }
    this.disposableTextures.length = 0;
  }

  public dispose(): void {
    this.driverMount.remove(this.driverRig.group);
    this.driverRig.dispose();
    this.disposeChassisContents();
  }
}
