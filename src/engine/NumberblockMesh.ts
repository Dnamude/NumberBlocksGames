import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NUMBERBLOCK_SPECS } from '../data/numberblocks';
import { NumberblockId } from '../types/game';
import {
  createBorderedBlockTexture,
  createDiceFaceTexture,
  createNumberlingSprite,
} from '../utils/textures';

export type NumberblockAnimState = 'idle' | 'racing' | 'celebrate' | 'sneeze' | 'bump';

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

function createStarFrameShape(
  outerRadius: number,
  innerRadius: number,
  holeRadius: number
): THREE.Shape {
  const shape = createStarShape(outerRadius, innerRadius, 5);
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function createDominoMaskShape(width: number, height: number): THREE.Shape {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + 0.04, hh);
  shape.quadraticCurveTo(0, hh * 0.65, hw - 0.04, hh);
  shape.quadraticCurveTo(hw + 0.05, 0, hw - 0.04, -hh);
  shape.quadraticCurveTo(0, -hh * 0.52, -hw + 0.04, -hh);
  shape.quadraticCurveTo(-hw - 0.05, 0, -hw + 0.04, hh);
  shape.closePath();
  return shape;
}

export class NumberblockRig {
  public readonly group: THREE.Group;
  public readonly id: NumberblockId;
  public readonly blockMeshes: THREE.Mesh[] = [];
  public readonly numberling: THREE.Sprite;
  public readonly totalHeight: number;

  private readonly blockSize: number;
  private readonly bodyGroup: THREE.Group;
  private readonly faceGroup: THREE.Group;
  private readonly eyelids: THREE.Mesh[] = [];
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly tentacles: Array<{ pivot: THREE.Group; side: number; index: number }> = [];
  private readonly rocketFlames: THREE.Mesh[] = [];
  private readonly baseNumberlingY: number;
  private readonly phaseOffset: number;
  private readonly disposableTextures: THREE.Texture[] = [];
  private readonly blockBaseColors: number[] = [];
  private highlightedIndex: number | null = null;

  constructor(id: NumberblockId, blockSize = 0.56) {
    this.id = id;
    this.blockSize = blockSize;
    this.phaseOffset = id * 0.93;

    const spec = NUMBERBLOCK_SPECS[id];
    this.totalHeight = spec.rows * blockSize;

    this.group = new THREE.Group();
    this.group.name = `numberblock-${id}`;

    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    // Build glossy toy-plastic blocks
    const cubeExtent = blockSize * 0.96;
    const cubeRadius = blockSize * 0.14;
    const blockGeo = new RoundedBoxGeometry(cubeExtent, cubeExtent, cubeExtent, 4, cubeRadius);

    for (const block of spec.blocks) {
      let materialOrArray: THREE.Material | THREE.Material[];

      if (block.hasDiceDots !== undefined) {
        const diceTex = createDiceFaceTexture(block.hasDiceDots, block.color);
        this.disposableTextures.push(diceTex);

        const sideMat = new THREE.MeshPhysicalMaterial({
          color: block.color,
          clearcoat: 0.55,
          clearcoatRoughness: 0.18,
          roughness: 0.25,
          metalness: 0.04,
        });
        const faceMat = new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          map: diceTex,
          clearcoat: 0.55,
          clearcoatRoughness: 0.18,
          roughness: 0.25,
          metalness: 0.04,
        });
        // RoundedBoxGeometry material groups: 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z (front), 5:-Z (back)
        materialOrArray = [
          sideMat,
          sideMat.clone(),
          sideMat.clone(),
          sideMat.clone(),
          faceMat,
          faceMat.clone(),
        ];
      } else if (block.borderColor) {
        const borderTex = createBorderedBlockTexture(block.color, block.borderColor);
        this.disposableTextures.push(borderTex);
        materialOrArray = new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          map: borderTex,
          clearcoat: 0.55,
          clearcoatRoughness: 0.18,
          roughness: 0.25,
          metalness: 0.04,
        });
      } else {
        materialOrArray = new THREE.MeshPhysicalMaterial({
          color: block.color,
          clearcoat: 0.55,
          clearcoatRoughness: 0.18,
          roughness: 0.25,
          metalness: 0.04,
        });
      }

      const mesh = new THREE.Mesh(blockGeo, materialOrArray);
      mesh.position.set(block.x * blockSize, (block.y + 0.5) * blockSize, block.z * blockSize);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.bodyGroup.add(mesh);
      this.blockMeshes.push(mesh);
      this.blockBaseColors.push(new THREE.Color(block.color).getHex());
    }

    // Face position on upper front block(s)
    const faceZ = blockSize * 0.485;
    const faceY =
      spec.rows === 1
        ? blockSize * 0.5
        : spec.rows === 2
          ? blockSize * 1.46
          : (spec.rows - 0.62) * blockSize;

    this.faceGroup = new THREE.Group();
    this.faceGroup.position.set(0, faceY, faceZ);
    this.bodyGroup.add(this.faceGroup);

    this.buildFace(spec.id, spec.columns, spec.primaryColor);
    this.buildAccessory(spec.id, spec.accessory, spec.columns, faceY, faceZ);

    // Stubby toy-plastic arms
    const { leftArm, rightArm } = this.buildArms(spec.id, spec.columns, spec.primaryColor);
    this.leftArm = leftArm;
    this.rightArm = rightArm;

    // Floating Numberling sprite above head (and above tall hats)
    let hatHeadroom = blockSize * 0.55;
    if (spec.accessory === 'jester-hat') hatHeadroom = blockSize * 0.98;
    else if (spec.accessory === 'rainbow') hatHeadroom = blockSize * 0.85;

    this.baseNumberlingY = this.totalHeight + hatHeadroom;
    this.numberling = createNumberlingSprite(id, spec.primaryColor);
    this.numberling.position.set(0, this.baseNumberlingY, 0);
    const numScale = Math.max(0.56, Math.min(0.86, blockSize * 1.28));
    this.numberling.scale.set(numScale, numScale, 1);
    this.group.add(this.numberling);
  }

  private buildFace(id: NumberblockId, columns: number, primaryColor: string): void {
    const s = this.blockSize;
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      clearcoat: 0.7,
      roughness: 0.14,
    });
    const pupilMat = new THREE.MeshPhysicalMaterial({
      color: '#1A1E29',
      clearcoat: 0.85,
      roughness: 0.1,
    });
    const shineMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const rimMat = new THREE.MeshStandardMaterial({
      color: id === 10 ? '#E53935' : '#1E2430',
      roughness: 0.4,
    });
    const lidColor = id === 10 ? '#E53935' : primaryColor;
    const lidMat = new THREE.MeshPhysicalMaterial({
      color: lidColor,
      clearcoat: 0.45,
      roughness: 0.28,
    });

    if (id === 1) {
      // Adorable single centered eye for One
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(0, s * 0.08, 0);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(s * 0.195, s * 0.022, 10, 28),
        rimMat
      );
      eyeGroup.add(rim);

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(s * 0.19, 20, 16), whiteMat);
      eyeball.scale.set(1, 1.04, 0.42);
      eyeGroup.add(eyeball);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s * 0.095, 16, 14), pupilMat);
      pupil.scale.set(1, 1, 0.45);
      pupil.position.set(0, -s * 0.01, s * 0.068);
      eyeGroup.add(pupil);

      const shine1 = new THREE.Mesh(new THREE.SphereGeometry(s * 0.032, 10, 10), shineMat);
      shine1.position.set(s * 0.038, s * 0.036, s * 0.1);
      eyeGroup.add(shine1);

      const shine2 = new THREE.Mesh(new THREE.SphereGeometry(s * 0.017, 8, 8), shineMat);
      shine2.position.set(-s * 0.028, -s * 0.03, s * 0.1);
      eyeGroup.add(shine2);

      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        lidMat
      );
      lid.scale.set(1, 0.05, 0.5);
      lid.position.set(0, s * 0.02, s * 0.01);
      eyeGroup.add(lid);
      this.eyelids.push(lid);

      this.faceGroup.add(eyeGroup);
    } else {
      // Expressive pair of eyes for 2-10
      const eyeSpread = columns >= 2 ? s * 0.25 : s * 0.21;
      const eyeRadius = s * 0.132;
      const eyeY = s * 0.095;

      for (const side of [-1, 1]) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * eyeSpread, eyeY, 0);

        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(eyeRadius * 1.04, s * 0.017, 8, 22),
          rimMat
        );
        eyeGroup.add(rim);

        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 18, 14), whiteMat);
        eyeball.scale.set(0.96, 1.08, 0.42);
        eyeGroup.add(eyeball);

        const pupil = new THREE.Mesh(
          new THREE.SphereGeometry(eyeRadius * 0.52, 14, 12),
          pupilMat
        );
        pupil.scale.set(1, 1, 0.45);
        pupil.position.set(-side * s * 0.01, -s * 0.008, s * 0.048);
        eyeGroup.add(pupil);

        const shine1 = new THREE.Mesh(new THREE.SphereGeometry(s * 0.023, 8, 8), shineMat);
        shine1.position.set(s * 0.024, s * 0.028, s * 0.072);
        eyeGroup.add(shine1);

        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(eyeRadius * 1.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
          lidMat
        );
        lid.scale.set(1, 0.05, 0.52);
        lid.position.set(0, s * 0.015, s * 0.008);
        eyeGroup.add(lid);
        this.eyelids.push(lid);

        this.faceGroup.add(eyeGroup);
      }
    }

    // Cheerful curved smile
    const smileRadius = id === 1 ? s * 0.145 : s * 0.155;
    const smileY = id === 1 ? -s * 0.12 : -s * 0.11;
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#2B1B24', roughness: 0.35 });
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(smileRadius, s * 0.024, 10, 24, Math.PI),
      mouthMat
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, smileY, s * 0.018);
    this.faceGroup.add(smile);

    // Cute tiny tongue inside smile
    const tongueMat = new THREE.MeshStandardMaterial({ color: '#FF6B8B', roughness: 0.3 });
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(s * 0.042, 10, 10), tongueMat);
    tongue.scale.set(1.2, 0.65, 0.5);
    tongue.position.set(0, smileY - smileRadius * 0.72, s * 0.025);
    this.faceGroup.add(tongue);

    // Rosy cheeks
    const cheekColor = id === 1 || id === 8 ? '#FF8A80' : '#FF7EB6';
    const cheekMat = new THREE.MeshStandardMaterial({
      color: cheekColor,
      roughness: 0.45,
      transparent: true,
      opacity: 0.78,
    });
    const cheekSpread = columns >= 2 ? s * 0.36 : s * 0.29;
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(s * 0.052, 10, 10), cheekMat);
      cheek.scale.set(1.2, 0.8, 0.32);
      cheek.position.set(side * cheekSpread, -s * 0.13, s * 0.012);
      this.faceGroup.add(cheek);
    }
  }

  private buildAccessory(
    id: NumberblockId,
    accessory: string,
    columns: number,
    faceY: number,
    faceZ: number
  ): void {
    const s = this.blockSize;

    switch (accessory) {
      case 'glasses': {
        // Two's purple glasses frames bridging eyes
        const purpleMat = new THREE.MeshPhysicalMaterial({
          color: '#8E24AA',
          clearcoat: 0.65,
          roughness: 0.2,
        });
        const spread = s * 0.21;
        const eyeY = s * 0.095;
        for (const side of [-1, 1]) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(s * 0.165, s * 0.025, 10, 24),
            purpleMat
          );
          ring.position.set(side * spread, eyeY, s * 0.04);
          this.faceGroup.add(ring);

          // Temple arm wrapping to side of head
          const temple = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.03, s * 0.03, s * 0.48),
            purpleMat
          );
          temple.position.set(side * (s * 0.48), eyeY + s * 0.02, -s * 0.22);
          this.faceGroup.add(temple);
        }
        const bridge = new THREE.Mesh(
          new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.13, 8),
          purpleMat
        );
        bridge.rotation.z = Math.PI / 2;
        bridge.position.set(0, eyeY + s * 0.02, s * 0.045);
        this.faceGroup.add(bridge);
        break;
      }

      case 'jester-hat': {
        // Three's iconic red 3-point jester crown hat + 3 red chest buttons
        const redMat = new THREE.MeshPhysicalMaterial({
          color: '#E53935',
          clearcoat: 0.6,
          roughness: 0.22,
        });
        const goldBallMat = new THREE.MeshPhysicalMaterial({
          color: '#FFEB3B',
          clearcoat: 0.65,
          roughness: 0.2,
        });

        const hatGroup = new THREE.Group();
        hatGroup.position.set(0, this.totalHeight - s * 0.02, 0);

        const headband = new THREE.Mesh(
          new THREE.CylinderGeometry(s * 0.36, s * 0.39, s * 0.14, 18),
          redMat
        );
        headband.position.y = s * 0.05;
        hatGroup.add(headband);

        const prongs: Array<{ angleZ: number; height: number }> = [
          { angleZ: 0.56, height: s * 0.42 },
          { angleZ: 0, height: s * 0.48 },
          { angleZ: -0.56, height: s * 0.42 },
        ];
        for (const p of prongs) {
          const pivot = new THREE.Group();
          pivot.rotation.z = p.angleZ;
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(s * 0.115, p.height, 14),
            redMat
          );
          cone.position.y = p.height * 0.5 + s * 0.06;
          cone.castShadow = true;
          pivot.add(cone);

          const tipBall = new THREE.Mesh(new THREE.SphereGeometry(s * 0.075, 12, 12), goldBallMat);
          tipBall.position.y = p.height + s * 0.06;
          pivot.add(tipBall);
          hatGroup.add(pivot);
        }
        this.bodyGroup.add(hatGroup);

        // 3 red chest buttons down the front
        for (let b = 0; b < 3; b++) {
          const btn = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.068, s * 0.068, s * 0.04, 14), redMat);
          btn.rotation.x = Math.PI / 2;
          btn.position.set(0, (b + 0.5) * s - (b === 2 ? s * 0.32 : 0), faceZ + s * 0.01);
          if (b < 2) {
            this.bodyGroup.add(btn);
          } else {
            // Third button sits cleanly on lower part of middle/top transition
            btn.position.set(0, s * 1.88, faceZ + s * 0.01);
            this.bodyGroup.add(btn);
          }
        }
        break;
      }

      case 'square-brows': {
        // Four's bold dark-green square eyebrows
        const browMat = new THREE.MeshPhysicalMaterial({
          color: '#1B5E20',
          clearcoat: 0.4,
          roughness: 0.3,
        });
        const spread = s * 0.25;
        for (const side of [-1, 1]) {
          const brow = new THREE.Mesh(
            new RoundedBoxGeometry(s * 0.26, s * 0.085, s * 0.06, 2, s * 0.015),
            browMat
          );
          brow.position.set(side * spread, s * 0.28, s * 0.03);
          brow.rotation.z = -side * 0.08;
          this.faceGroup.add(brow);
        }
        break;
      }

      case 'star-eye': {
        // Five's bright red 5-point star patch around right eye (viewer's left = -X, or character's right = -X)
        const starShape = createStarShape(s * 0.26, s * 0.115, 5);
        const starGeo = new THREE.ExtrudeGeometry(starShape, {
          depth: s * 0.028,
          bevelEnabled: true,
          bevelThickness: s * 0.008,
          bevelSize: s * 0.008,
          bevelSegments: 2,
        });
        const starMat = new THREE.MeshPhysicalMaterial({
          color: '#E53935',
          clearcoat: 0.55,
          roughness: 0.22,
        });
        const starPatch = new THREE.Mesh(starGeo, starMat);
        // Character's right eye is at -X from viewer's perspective when facing +Z
        starPatch.position.set(-s * 0.21, s * 0.095, s * 0.004);
        this.faceGroup.add(starPatch);
        break;
      }

      case 'dice': {
        // Six gets cute purple eyebrows above her eyes
        const browMat = new THREE.MeshPhysicalMaterial({
          color: '#4A148C',
          clearcoat: 0.45,
          roughness: 0.28,
        });
        for (const side of [-1, 1]) {
          const brow = new THREE.Mesh(
            new RoundedBoxGeometry(s * 0.21, s * 0.06, s * 0.05, 2, s * 0.012),
            browMat
          );
          brow.position.set(side * s * 0.25, s * 0.27, s * 0.03);
          brow.rotation.z = side * 0.12;
          this.faceGroup.add(brow);
        }
        break;
      }

      case 'rainbow': {
        // Seven's gold lucky star on top of the violet top block
        const starShape = createStarShape(s * 0.26, s * 0.11, 5);
        const starGeo = new THREE.ExtrudeGeometry(starShape, {
          depth: s * 0.08,
          bevelEnabled: true,
          bevelThickness: s * 0.015,
          bevelSize: s * 0.015,
          bevelSegments: 2,
        });
        starGeo.center();
        const goldMat = new THREE.MeshPhysicalMaterial({
          color: '#FFD54F',
          emissive: '#FF8F00',
          emissiveIntensity: 0.18,
          clearcoat: 0.75,
          roughness: 0.18,
          metalness: 0.25,
        });
        const star = new THREE.Mesh(starGeo, goldMat);
        star.position.set(0, this.totalHeight + s * 0.24, 0);
        star.castShadow = true;
        this.bodyGroup.add(star);
        break;
      }

      case 'octo-mask': {
        // Eight's magenta superhero eye-mask + 8 lively tentacles along sides
        const maskShape = createDominoMaskShape(s * 0.92, s * 0.34);
        const maskGeo = new THREE.ExtrudeGeometry(maskShape, {
          depth: s * 0.03,
          bevelEnabled: true,
          bevelThickness: s * 0.01,
          bevelSize: s * 0.01,
          bevelSegments: 2,
        });
        const maskMat = new THREE.MeshPhysicalMaterial({
          color: '#AD1457',
          clearcoat: 0.6,
          roughness: 0.2,
        });
        const mask = new THREE.Mesh(maskGeo, maskMat);
        mask.position.set(0, s * 0.095, s * 0.006);
        this.faceGroup.add(mask);

        // 8 tentacles (4 per side)
        const tentacleMat = new THREE.MeshPhysicalMaterial({
          color: '#EC407A',
          clearcoat: 0.55,
          roughness: 0.25,
        });
        const tipMat = new THREE.MeshPhysicalMaterial({
          color: '#F48FB1',
          clearcoat: 0.6,
          roughness: 0.2,
        });

        const sideOffset = (columns * 0.5) * s - s * 0.02;
        for (let row = 0; row < 4; row++) {
          for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * sideOffset, (row + 0.5) * s, 0);

            const limb = new THREE.Mesh(
              new THREE.CapsuleGeometry(s * 0.078, s * 0.34, 6, 10),
              tentacleMat
            );
            limb.rotation.z = side * (Math.PI / 2);
            limb.position.set(side * s * 0.22, 0, 0);
            limb.castShadow = true;
            pivot.add(limb);

            const tip = new THREE.Mesh(new THREE.SphereGeometry(s * 0.095, 10, 10), tipMat);
            tip.position.set(side * s * 0.42, 0, 0);
            pivot.add(tip);

            this.bodyGroup.add(pivot);
            this.tentacles.push({ pivot, side, index: row });
          }
        }
        break;
      }

      case 'grey-square': {
        // Nine's thick expressive dark-grey eyebrows
        const browMat = new THREE.MeshPhysicalMaterial({
          color: '#424242',
          clearcoat: 0.35,
          roughness: 0.35,
        });
        const spread = s * 0.25;
        for (const side of [-1, 1]) {
          const brow = new THREE.Mesh(
            new RoundedBoxGeometry(s * 0.28, s * 0.095, s * 0.06, 2, s * 0.015),
            browMat
          );
          brow.position.set(side * spread, s * 0.29, s * 0.03);
          brow.rotation.z = side * 0.14;
          this.faceGroup.add(brow);
        }
        break;
      }

      case 'rocket-stars': {
        // Ten's red star-shaped eye frames + dual mini rocket thrusters on back
        const starFrameShape = createStarFrameShape(s * 0.245, s * 0.135, s * 0.115);
        const starFrameGeo = new THREE.ExtrudeGeometry(starFrameShape, {
          depth: s * 0.032,
          bevelEnabled: true,
          bevelThickness: s * 0.008,
          bevelSize: s * 0.008,
          bevelSegments: 2,
        });
        const redMat = new THREE.MeshPhysicalMaterial({
          color: '#E53935',
          clearcoat: 0.65,
          roughness: 0.2,
        });
        const spread = s * 0.25;
        const eyeY = s * 0.095;
        for (const side of [-1, 1]) {
          const starFrame = new THREE.Mesh(starFrameGeo, redMat);
          starFrame.position.set(side * spread, eyeY, s * 0.025);
          this.faceGroup.add(starFrame);
        }
        const bridge = new THREE.Mesh(
          new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.16, 8),
          redMat
        );
        bridge.rotation.z = Math.PI / 2;
        bridge.position.set(0, eyeY, s * 0.038);
        this.faceGroup.add(bridge);

        // Mini rocket thrusters on back (-Z)
        const silverMat = new THREE.MeshPhysicalMaterial({
          color: '#CFD8DC',
          metalness: 0.45,
          roughness: 0.25,
          clearcoat: 0.5,
        });
        const flameMat = new THREE.MeshBasicMaterial({ color: '#FFAB00' });

        for (const side of [-1, 1]) {
          const rocket = new THREE.Group();
          rocket.position.set(side * s * 0.48, s * 1.45, -s * 0.58);

          const body = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.13, s * 0.14, s * 0.72, 14),
            redMat
          );
          body.castShadow = true;
          rocket.add(body);

          const nose = new THREE.Mesh(new THREE.ConeGeometry(s * 0.13, s * 0.26, 14), silverMat);
          nose.position.y = s * 0.49;
          rocket.add(nose);

          const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.09, s * 0.13, s * 0.14, 12),
            silverMat
          );
          nozzle.position.y = -s * 0.41;
          rocket.add(nozzle);

          const flame = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.28, 12), flameMat);
          flame.rotation.x = Math.PI;
          flame.position.y = -s * 0.6;
          rocket.add(flame);
          this.rocketFlames.push(flame);

          this.bodyGroup.add(rocket);
        }
        break;
      }

      default:
        break;
    }

    // Keep unused parameter reference clean
    void id;
    void faceY;
  }

  private buildArms(
    id: NumberblockId,
    columns: number,
    primaryColor: string
  ): { leftArm: THREE.Group; rightArm: THREE.Group } {
    const s = this.blockSize;
    const armColor = id === 7 ? '#29B6F6' : id === 10 ? '#E53935' : primaryColor;
    const armMat = new THREE.MeshPhysicalMaterial({
      color: armColor,
      clearcoat: 0.5,
      roughness: 0.26,
    });
    const handMat = new THREE.MeshPhysicalMaterial({
      color: id === 10 ? '#E53935' : armColor,
      clearcoat: 0.55,
      roughness: 0.22,
    });
    const fiveGloveMat = new THREE.MeshPhysicalMaterial({
      color: '#1565C0',
      clearcoat: 0.65,
      roughness: 0.18,
    });
    const cuffMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      clearcoat: 0.5,
      roughness: 0.25,
    });

    const mountY =
      this.totalHeight <= s * 1.1 ? s * 0.42 : Math.min(this.totalHeight * 0.55, s * 2.1);
    const sideOffset = columns * 0.5 * s + s * 0.02;

    const makeArm = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * sideOffset, mountY, 0);

      // For Octoblock (8), tentacles act as his side arms; keep invisible helper pivots or small hero arms
      if (id === 8) {
        return pivot;
      }

      const limb = new THREE.Mesh(
        new THREE.CapsuleGeometry(s * 0.085, s * 0.26, 6, 10),
        armMat
      );
      limb.rotation.z = side * (Math.PI / 2.6);
      limb.position.set(side * s * 0.16, -s * 0.06, s * 0.04);
      limb.castShadow = true;
      pivot.add(limb);

      // Five wears a bright blue hero glove on her right hand (side === -1 when facing +Z)
      const isFiveGlove = id === 5 && side === -1;
      if (isFiveGlove) {
        const cuff = new THREE.Mesh(
          new THREE.CylinderGeometry(s * 0.105, s * 0.105, s * 0.06, 12),
          cuffMat
        );
        cuff.rotation.z = side * (Math.PI / 2.6);
        cuff.position.set(side * s * 0.26, -s * 0.1, s * 0.06);
        pivot.add(cuff);
      }

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(isFiveGlove ? s * 0.135 : s * 0.11, 12, 12),
        isFiveGlove ? fiveGloveMat : handMat
      );
      hand.position.set(side * s * 0.33, -s * 0.13, s * 0.08);
      hand.castShadow = true;
      pivot.add(hand);

      this.bodyGroup.add(pivot);
      return pivot;
    };

    const rightArm = makeArm(-1); // Character's right
    const leftArm = makeArm(1); // Character's left
    return { leftArm, rightArm };
  }

  public highlightBlock(index: number | null): void {
    this.highlightedIndex = index;

    for (let i = 0; i < this.blockMeshes.length; i++) {
      const mesh = this.blockMeshes[i];
      const isSelected = index !== null && i === index;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (isSelected) {
            mat.emissive.setHex(0xffd54f);
            mat.emissiveIntensity = 0.55;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }

      const scale = isSelected ? 1.18 : 1.0;
      mesh.scale.set(scale, scale, scale);
    }
  }

  public update(dt: number, time: number, animState: NumberblockAnimState): void {
    void dt;
    const t = time + this.phaseOffset;

    // Periodic blinking (~3.2s cycle)
    const blinkCycle = (t % 3.2) / 3.2;
    const isBlinking = blinkCycle > 0.94;
    const blinkAmount = isBlinking
      ? Math.sin(((blinkCycle - 0.94) / 0.06) * Math.PI)
      : 0;
    for (const lid of this.eyelids) {
      lid.scale.y = 0.05 + blinkAmount * 0.95;
    }

    // Reset body transforms smoothly
    let bobY = 0;
    let squashX = 1;
    let squashY = 1;
    let rotX = 0;
    let rotZ = 0;

    if (animState === 'idle') {
      bobY = Math.sin(t * 3.1) * 0.025 * this.blockSize;
      const stretch = Math.sin(t * 3.1) * 0.035;
      squashY = 1 + stretch;
      squashX = 1 - stretch * 0.5;
      this.leftArm.rotation.z = Math.sin(t * 3.0) * 0.14;
      this.rightArm.rotation.z = -Math.sin(t * 3.0) * 0.14;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    } else if (animState === 'racing') {
      bobY = Math.abs(Math.sin(t * 11)) * 0.022 * this.blockSize;
      rotX = 0.08 + Math.sin(t * 11) * 0.025;
      this.leftArm.rotation.x = -0.55 + Math.sin(t * 12) * 0.12;
      this.rightArm.rotation.x = -0.55 - Math.sin(t * 12) * 0.12;
      this.leftArm.rotation.z = -0.22;
      this.rightArm.rotation.z = 0.22;
    } else if (animState === 'celebrate') {
      const bounce = Math.abs(Math.sin(t * 7.5));
      bobY = bounce * 0.22 * this.blockSize;
      squashY = 1 + (bounce - 0.4) * 0.09;
      squashX = 1 - (bounce - 0.4) * 0.045;
      rotZ = Math.sin(t * 5.2) * 0.09;
      this.leftArm.rotation.z = 0.85 + Math.sin(t * 12) * 0.35;
      this.rightArm.rotation.z = -0.85 - Math.sin(t * 12) * 0.35;
      this.leftArm.rotation.x = -0.25;
      this.rightArm.rotation.x = -0.25;
    } else if (animState === 'sneeze') {
      // Classic Nine "Achoo!" wobble
      const sneezeWave = Math.sin(t * 18);
      rotX = -0.14 + sneezeWave * 0.16;
      rotZ = Math.cos(t * 22) * 0.1;
      squashY = 0.94 + Math.abs(sneezeWave) * 0.1;
      squashX = 1.05 - Math.abs(sneezeWave) * 0.05;
      this.leftArm.rotation.z = 0.35;
      this.rightArm.rotation.z = -0.35;
    } else if (animState === 'bump') {
      const wobble = Math.sin(t * 22);
      rotZ = wobble * 0.16;
      rotX = Math.cos(t * 19) * 0.12;
      squashY = 0.92;
      squashX = 1.08;
      this.leftArm.rotation.z = 0.65;
      this.rightArm.rotation.z = -0.65;
    }

    this.bodyGroup.position.y = bobY;
    this.bodyGroup.scale.set(squashX, squashY, squashX);
    this.bodyGroup.rotation.set(rotX, 0, rotZ);

    // Octoblock tentacle wiggle
    for (const tent of this.tentacles) {
      const waveFreq = animState === 'racing' ? 11 : animState === 'celebrate' ? 14 : 5;
      const phase = tent.index * 0.75 + (tent.side > 0 ? 0 : Math.PI * 0.5);
      tent.pivot.rotation.z = Math.sin(t * waveFreq + phase) * 0.24 * tent.side;
      tent.pivot.rotation.y = Math.cos(t * waveFreq * 0.8 + phase) * 0.16;
    }

    // Ten's rocket booster flame flicker
    for (let i = 0; i < this.rocketFlames.length; i++) {
      const flame = this.rocketFlames[i];
      const baseScale = animState === 'racing' ? 1.35 : animState === 'celebrate' ? 1.55 : 0.7;
      const flicker = 0.85 + Math.sin(t * 26 + i * 1.4) * 0.25;
      flame.scale.set(1, baseScale * flicker, 1);
    }

    // Floating Numberling gentle bob
    this.numberling.position.y =
      this.baseNumberlingY + bobY * 0.6 + Math.sin(time * 2.8 + this.phaseOffset) * 0.055;

    // Keep highlighted block scale crisp if highlighted
    if (this.highlightedIndex !== null && this.blockMeshes[this.highlightedIndex]) {
      this.blockMeshes[this.highlightedIndex].scale.set(1.18, 1.18, 1.18);
    }
  }

  public dispose(): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
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
}
