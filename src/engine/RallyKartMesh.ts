import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NUMBERBLOCK_SPECS } from '../data/numberblocks';
import { NumberblockId } from '../types/game';
import { createNumberBadgeTexture } from '../utils/textures';
import { NumberblockAnimState, NumberblockRig } from './NumberblockMesh';

function getSmartDriverBlockSize(id: NumberblockId): number {
  switch (id) {
    case 1:
      return 0.56;
    case 2:
      return 0.5;
    case 3:
      return 0.44;
    case 4:
      return 0.46;
    case 5:
      return 0.34;
    case 6:
      return 0.4;
    case 7:
      return 0.28;
    case 8:
      return 0.36;
    case 9:
      return 0.35;
    case 10:
      return 0.32;
    default:
      return 0.44;
  }
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
  private readonly wheelSpinPivots: THREE.Group[] = [];
  private readonly rimMeshes: THREE.Mesh[] = [];
  private readonly bodyMat: THREE.MeshPhysicalMaterial;
  private readonly stripeMat: THREE.MeshPhysicalMaterial;
  private readonly accentMat: THREE.MeshPhysicalMaterial;
  private readonly badgeMat: THREE.MeshStandardMaterial;
  private readonly pedalCrankPivot: THREE.Group;
  private readonly leftPedalArm: THREE.Group;
  private readonly rightPedalArm: THREE.Group;
  private badgeTexture: THREE.Texture;

  private wheelSpinAngle = 0;
  private pedalAngle = 0;
  private swapPopTimer = 0;
  private smoothedSteer = 0;
  private smoothedAirborne = 0;

  constructor(id: NumberblockId) {
    this.currentId = id;
    const spec = NUMBERBLOCK_SPECS[id];

    this.group = new THREE.Group();
    this.group.name = `rally-kart-${id}`;

    this.chassisGroup = new THREE.Group();
    this.group.add(this.chassisGroup);

    // Shared glossy painted kart materials
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: spec.kartColor,
      clearcoat: 0.78,
      clearcoatRoughness: 0.14,
      roughness: 0.2,
      metalness: 0.06,
    });
    this.stripeMat = new THREE.MeshPhysicalMaterial({
      color: spec.kartStripeColor,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
      roughness: 0.22,
      metalness: 0.04,
    });
    this.accentMat = new THREE.MeshPhysicalMaterial({
      color: spec.accentColor,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      roughness: 0.24,
      metalness: 0.08,
    });

    const darkFrameMat = new THREE.MeshPhysicalMaterial({
      color: '#263238',
      clearcoat: 0.3,
      roughness: 0.45,
      metalness: 0.2,
    });
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: '#ECEFF1',
      metalness: 0.65,
      roughness: 0.2,
      clearcoat: 0.5,
    });
    const cushionMat = new THREE.MeshPhysicalMaterial({
      color: '#37474F',
      roughness: 0.55,
      clearcoat: 0.15,
    });

    // 1. Lower floorpan / chassis frame
    const floorPan = new THREE.Mesh(
      new RoundedBoxGeometry(1.52, 0.18, 2.38, 4, 0.07),
      darkFrameMat
    );
    floorPan.position.set(0, 0.34, 0);
    floorPan.castShadow = true;
    floorPan.receiveShadow = true;
    this.chassisGroup.add(floorPan);

    // Front & rear bumpers
    const frontBumper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 1.38, 6, 12),
      chromeMat
    );
    frontBumper.rotation.z = Math.PI / 2;
    frontBumper.position.set(0, 0.36, 1.24);
    frontBumper.castShadow = true;
    this.chassisGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 1.42, 6, 12),
      chromeMat
    );
    rearBumper.rotation.z = Math.PI / 2;
    rearBumper.position.set(0, 0.36, -1.24);
    rearBumper.castShadow = true;
    this.chassisGroup.add(rearBumper);

    // 2. Sculpted rounded body shell & nose cone
    const noseCone = new THREE.Mesh(
      new RoundedBoxGeometry(1.16, 0.38, 0.96, 5, 0.16),
      this.bodyMat
    );
    noseCone.position.set(0, 0.52, 0.78);
    noseCone.rotation.x = 0.08;
    noseCone.castShadow = true;
    noseCone.receiveShadow = true;
    this.chassisGroup.add(noseCone);

    // Nose tip rounded fairing (tapered flush with the sloped nose cone)
    const noseTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.52, 0.32, 18),
      this.bodyMat
    );
    noseTip.scale.set(1.12, 0.72, 0.44);
    noseTip.rotation.x = Math.PI / 2;
    noseTip.position.set(0, 0.46, 1.15);
    noseTip.castShadow = true;
    this.chassisGroup.add(noseTip);

    // Side pods flanking the open cockpit
    for (const side of [-1, 1]) {
      const sidePod = new THREE.Mesh(
        new RoundedBoxGeometry(0.32, 0.4, 1.32, 4, 0.12),
        this.bodyMat
      );
      sidePod.position.set(side * 0.66, 0.52, -0.04);
      sidePod.castShadow = true;
      sidePod.receiveShadow = true;
      this.chassisGroup.add(sidePod);

      // Contrasting racing stripe trim along side pod
      const sideTrim = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.09, 1.08, 2, 0.03),
        this.stripeMat
      );
      sideTrim.position.set(side * 0.66, 0.58, -0.04);
      this.chassisGroup.add(sideTrim);
    }

    // Rear engine cowling deck
    const rearDeck = new THREE.Mesh(
      new RoundedBoxGeometry(1.26, 0.44, 0.64, 4, 0.14),
      this.bodyMat
    );
    rearDeck.position.set(0, 0.56, -0.82);
    rearDeck.castShadow = true;
    rearDeck.receiveShadow = true;
    this.chassisGroup.add(rearDeck);

    // Center racing stripe across nose cone & rear deck
    const hoodStripe = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.04, 0.9, 2, 0.015),
      this.stripeMat
    );
    hoodStripe.position.set(0, 0.72, 0.78);
    hoodStripe.rotation.x = 0.08;
    this.chassisGroup.add(hoodStripe);

    const rearStripe = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.04, 0.56, 2, 0.015),
      this.stripeMat
    );
    rearStripe.position.set(0, 0.79, -0.82);
    this.chassisGroup.add(rearStripe);

    // 3. Front circular racing number badge mounted prominently on top/front of the nose cone
    this.badgeTexture = createNumberBadgeTexture(id, spec.primaryColor);
    this.badgeMat = new THREE.MeshStandardMaterial({
      map: this.badgeTexture,
      roughness: 0.25,
      metalness: 0.05,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const badgeMount = new THREE.Group();
    badgeMount.position.set(0, 0.755, 0.89);
    badgeMount.rotation.x = -Math.PI / 2 + 0.34;

    const badgeBacking = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.33, 0.04, 28),
      chromeMat
    );
    badgeBacking.rotation.x = Math.PI / 2;
    badgeBacking.position.z = -0.022;
    badgeMount.add(badgeBacking);

    const badgeDisc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), this.badgeMat);
    badgeDisc.position.z = 0.002;
    badgeDisc.renderOrder = 2;
    badgeMount.add(badgeDisc);

    this.chassisGroup.add(badgeMount);

    // Cute glowing rally headlights on front fenders
    const headlightMat = new THREE.MeshBasicMaterial({ color: '#FFFDE7' });
    for (const side of [-1, 1]) {
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.12, 0.08, 14),
        chromeMat
      );
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(side * 0.44, 0.54, 1.19);
      this.chassisGroup.add(bezel);

      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), headlightMat);
      lens.scale.set(1, 1, 0.4);
      lens.position.set(side * 0.44, 0.54, 1.23);
      this.chassisGroup.add(lens);
    }

    // 4. Open cockpit seat & cozy seatback
    const seatBase = new THREE.Mesh(
      new RoundedBoxGeometry(0.84, 0.14, 0.72, 3, 0.05),
      cushionMat
    );
    seatBase.position.set(0, 0.46, -0.18);
    seatBase.receiveShadow = true;
    this.chassisGroup.add(seatBase);

    const seatBack = new THREE.Mesh(
      new RoundedBoxGeometry(0.82, 0.62, 0.18, 3, 0.07),
      cushionMat
    );
    seatBack.position.set(0, 0.76, -0.5);
    seatBack.rotation.x = -0.14;
    seatBack.castShadow = true;
    this.chassisGroup.add(seatBack);

    // 5. Chunky tubular rollbar behind driver
    const rollbar = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.065, 10, 24, Math.PI),
      chromeMat
    );
    rollbar.position.set(0, 0.96, -0.62);
    rollbar.castShadow = true;
    this.chassisGroup.add(rollbar);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.34, 10),
        chromeMat
      );
      post.position.set(side * 0.46, 0.8, -0.62);
      post.castShadow = true;
      this.chassisGroup.add(post);
    }

    // 6. Playful rear spoiler & dual shiny toy exhaust pipes
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 1.05, -1.04);

    const wingBlade = new THREE.Mesh(
      new RoundedBoxGeometry(1.48, 0.1, 0.34, 3, 0.04),
      this.bodyMat
    );
    wingBlade.rotation.x = -0.14;
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);

    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(
        new RoundedBoxGeometry(0.06, 0.24, 0.4, 2, 0.02),
        this.stripeMat
      );
      endplate.position.set(side * 0.73, 0.02, 0);
      wingGroup.add(endplate);

      const strut = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.36, 0.14, 2, 0.02),
        darkFrameMat
      );
      strut.position.set(side * 0.38, -0.2, 0.06);
      strut.rotation.x = -0.2;
      wingGroup.add(strut);
    }
    this.chassisGroup.add(wingGroup);

    // Dual shiny toy exhaust pipes
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.07, 0.38, 12),
        chromeMat
      );
      pipe.rotation.x = Math.PI / 2 - 0.22;
      pipe.position.set(side * 0.34, 0.6, -1.18);
      pipe.castShadow = true;
      this.chassisGroup.add(pipe);

      const pipeHole = new THREE.Mesh(
        new THREE.CircleGeometry(0.062, 12),
        new THREE.MeshBasicMaterial({ color: '#1A1E29' })
      );
      pipeHole.rotation.y = Math.PI;
      pipeHole.rotation.x = 0.22;
      pipeHole.position.set(side * 0.34, 0.642, -1.368);
      this.chassisGroup.add(pipeHole);
    }

    // 7. Steering column + rotatable spoked steering wheel
    const steeringCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.46, 10),
      darkFrameMat
    );
    steeringCol.position.set(0, 0.75, 0.36);
    steeringCol.rotation.x = 0.58;
    this.chassisGroup.add(steeringCol);

    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(0, 0.94, 0.22);
    this.steeringWheel.rotation.x = 0.58;

    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.035, 10, 24),
      darkFrameMat
    );
    this.steeringWheel.add(wheelRim);

    const wheelHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.05, 14),
      this.accentMat
    );
    wheelHub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(wheelHub);

    for (let sp = 0; sp < 3; sp++) {
      const spoke = new THREE.Mesh(
        new RoundedBoxGeometry(0.036, 0.16, 0.025, 2, 0.01),
        chromeMat
      );
      const ang = (sp * Math.PI * 2) / 3 + Math.PI / 2;
      spoke.position.set(Math.cos(ang) * 0.09, Math.sin(ang) * 0.09, 0);
      spoke.rotation.z = ang + Math.PI / 2;
      this.steeringWheel.add(spoke);
    }
    this.chassisGroup.add(this.steeringWheel);

    // 8. Animated foot pedals in front footwell (Signature Pedal-Powered Kart!)
    this.pedalCrankPivot = new THREE.Group();
    this.pedalCrankPivot.position.set(0, 0.52, 0.42);

    const crankAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.52, 10),
      chromeMat
    );
    crankAxle.rotation.z = Math.PI / 2;
    this.pedalCrankPivot.add(crankAxle);

    const makePedalArm = (side: -1 | 1): THREE.Group => {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.24, 0, 0);

      const crankBar = new THREE.Mesh(
        new RoundedBoxGeometry(0.035, 0.16, 0.035, 2, 0.01),
        chromeMat
      );
      crankBar.position.set(0, side * 0.07, 0);
      armGroup.add(crankBar);

      const pedalPad = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.04, 0.1, 2, 0.015),
        this.accentMat
      );
      pedalPad.position.set(side * 0.04, side * 0.14, 0);
      armGroup.add(pedalPad);

      this.pedalCrankPivot.add(armGroup);
      return armGroup;
    };

    this.leftPedalArm = makePedalArm(-1);
    this.rightPedalArm = makePedalArm(1);
    this.chassisGroup.add(this.pedalCrankPivot);

    // 9. Four chunky rubber tires with colored rims & hubcaps
    // Order: [0: front-left, 1: front-right, 2: rear-left, 3: rear-right]
    const wheelConfigs: Array<{ x: number; y: number; z: number; isFront: boolean; radius: number }> =
      [
        { x: -0.86, y: 0.38, z: 0.78, isFront: true, radius: 0.36 },
        { x: 0.86, y: 0.38, z: 0.78, isFront: true, radius: 0.36 },
        { x: -0.9, y: 0.41, z: -0.78, isFront: false, radius: 0.4 },
        { x: 0.9, y: 0.41, z: -0.78, isFront: false, radius: 0.4 },
      ];

    const tireMat = new THREE.MeshPhysicalMaterial({
      color: '#21252D',
      roughness: 0.72,
      clearcoat: 0.1,
    });

    for (const cfg of wheelConfigs) {
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(cfg.x, cfg.y, cfg.z);

      const spinPivot = new THREE.Group();
      wheelPivot.add(spinPivot);

      const tireWidth = cfg.isFront ? 0.28 : 0.34;
      const tireCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.radius, cfg.radius, tireWidth, 24),
        tireMat
      );
      tireCyl.rotation.z = Math.PI / 2;
      tireCyl.castShadow = true;
      tireCyl.receiveShadow = true;
      spinPivot.add(tireCyl);

      // Rounded tire sidewall bulge
      const sidewall = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.radius * 0.74, cfg.radius * 0.26, 10, 24),
        tireMat
      );
      sidewall.rotation.y = Math.PI / 2;
      spinPivot.add(sidewall);

      // Colored rim
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.radius * 0.56, cfg.radius * 0.56, tireWidth + 0.02, 18),
        this.bodyMat
      );
      rim.rotation.z = Math.PI / 2;
      spinPivot.add(rim);
      this.rimMeshes.push(rim);

      // Chrome hubcap + lug ring
      const sideSign = Math.sign(cfg.x);
      const hubcap = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.radius * 0.26, 14, 12),
        chromeMat
      );
      hubcap.scale.set(0.55, 1, 1);
      hubcap.position.x = sideSign * (tireWidth * 0.5 + 0.01);
      spinPivot.add(hubcap);

      // Axle strut connecting wheel to chassis
      const axleStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.28, 10),
        darkFrameMat
      );
      axleStrut.rotation.z = Math.PI / 2;
      axleStrut.position.set(-sideSign * 0.16, 0, 0);
      wheelPivot.add(axleStrut);

      this.chassisGroup.add(wheelPivot);
      this.wheels.push(wheelPivot);
      this.wheelSpinPivots.push(spinPivot);
      if (cfg.isFront) {
        this.frontWheelSteerPivots.push(wheelPivot);
      }
    }

    // 10. Driver mount inside cockpit & initial NumberblockRig
    this.driverMount = new THREE.Group();
    this.driverMount.position.set(0, 0.53, -0.14);
    this.chassisGroup.add(this.driverMount);

    this.driverRig = new NumberblockRig(id, getSmartDriverBlockSize(id));
    this.driverMount.add(this.driverRig.group);
  }

  public setDriver(newId: NumberblockId): void {
    if (newId === this.currentId) {
      this.swapPopTimer = 0.35;
      return;
    }

    this.currentId = newId;
    const spec = NUMBERBLOCK_SPECS[newId];

    // Dispose old driver cleanly
    this.driverMount.remove(this.driverRig.group);
    this.driverRig.dispose();

    // Mount new scaled Numberblock driver
    this.driverRig = new NumberblockRig(newId, getSmartDriverBlockSize(newId));
    this.driverMount.add(this.driverRig.group);

    // Update kart shell & stripe colors
    this.bodyMat.color.set(spec.kartColor);
    this.stripeMat.color.set(spec.kartStripeColor);
    this.accentMat.color.set(spec.accentColor);

    // Update front racing number badge
    const oldBadgeTex = this.badgeTexture;
    this.badgeTexture = createNumberBadgeTexture(newId, spec.primaryColor);
    this.badgeMat.map = this.badgeTexture;
    this.badgeMat.needsUpdate = true;
    oldBadgeTex.dispose();

    // Trigger springy pop-in animation
    this.swapPopTimer = 0.42;
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

    // Wheel spin based on forward speed
    this.wheelSpinAngle += (speed / 0.38) * clampedDt;
    for (const spinPivot of this.wheelSpinPivots) {
      spinPivot.rotation.x = this.wheelSpinAngle;
    }

    // Front wheel steering pivot & steering wheel rotation
    const visualFrontSteer = THREE.MathUtils.clamp(this.smoothedSteer, -0.55, 0.55);
    for (const frontPivot of this.frontWheelSteerPivots) {
      frontPivot.rotation.y = visualFrontSteer;
    }
    this.steeringWheel.rotation.z = -visualFrontSteer * 1.65;

    // Pedal crank spin proportional to speed (with gentle idle spin when slow)
    const pedalRate = Math.max(1.2, Math.abs(speed) * 0.65);
    this.pedalAngle += pedalRate * clampedDt;
    this.pedalCrankPivot.rotation.x = this.pedalAngle;
    // Keep pedal pads roughly horizontal as crank spins
    this.leftPedalArm.rotation.x = -this.pedalAngle;
    this.rightPedalArm.rotation.x = -this.pedalAngle;

    // Bouncy suspension spring & dynamic lean into turns
    const speedNorm = THREE.MathUtils.clamp(Math.abs(speed) / 28, 0, 1.4);
    const roadBounce =
      !isAirborne && speedNorm > 0.05
        ? Math.sin(time * (14 + speedNorm * 8)) * 0.022 * speedNorm
        : Math.sin(time * 3.5) * 0.008;

    const leanRoll = -this.smoothedSteer * (0.14 + 0.06 * speedNorm);
    const pitchTilt = this.smoothedAirborne * -0.14 + (speed > 2 ? -0.025 * speedNorm : 0);

    this.chassisGroup.position.y = roadBounce;
    this.chassisGroup.rotation.z = leanRoll;
    this.chassisGroup.rotation.x = pitchTilt;

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

  public dispose(): void {
    this.driverRig.dispose();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();

    this.group.traverse((obj) => {
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

    this.badgeTexture.dispose();
  }
}
