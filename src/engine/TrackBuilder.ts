import * as THREE from 'three';
import { NUMBERBLOCK_SPECS } from '../data/numberblocks';
import { GameMode, NumberblockId, TrackFeature } from '../types/game';
import {
  createCheckerTexture,
  createGrassTexture,
  createMudTexture,
  createNumberBadgeTexture,
  createRoadTexture,
  createTrackNumberDecalTexture,
  createWoodRampTexture,
} from '../utils/textures';

export interface TrackSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  width: number;
  dipHeight: number;
}

export interface BlobPickup {
  id: string;
  mesh: THREE.Group;
  s: number;
  laneX: number;
  collected: boolean;
  color: string;
}

interface AnimatedBadge {
  mesh: THREE.Object3D;
  baseY: number;
  phase: number;
  spin: boolean;
}

interface AnimatedSpectator {
  mesh: THREE.Object3D;
  baseY: number;
  phase: number;
  speed: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const BLOB_COLORS = [
  '#FF5252',
  '#FF9800',
  '#FFEB3B',
  '#4CAF50',
  '#29B6F6',
  '#7E57C2',
  '#EC407A',
];

export class RallyTrack {
  public group: THREE.Group;
  public length = 1100;
  public roadHalfWidth = 11;
  public features: TrackFeature[] = [];
  public featureMeshes: Map<string, THREE.Object3D> = new Map();
  public blobPickups: BlobPickup[] = [];
  public finishTrophy: THREE.Group;

  private windmills: THREE.Object3D[] = [];
  private animatedBadges: AnimatedBadge[] = [];
  private spectators: AnimatedSpectator[] = [];
  private disposed = false;

  constructor(mode: GameMode, maxCountTarget: 5 | 10) {
    this.group = new THREE.Group();
    this.finishTrophy = new THREE.Group();

    this.buildTerrainAndRoad();
    this.buildStartGantry(12);
    this.buildFinishArea(this.length - 40);
    this.buildScenicProps();

    if (mode === 'count-cruise') {
      this.buildCountCruiseFeatures(maxCountTarget);
    } else {
      this.buildRallyMathFeatures();
    }
  }

  private computeTrackPoint(s: number, out: THREE.Vector3): number {
    const x = Math.sin(s * 0.0085) * 34 + Math.sin(s * 0.019) * 14;
    let dipHeight = 0;

    if (s >= 540 && s <= 680) {
      const t = (s - 540) / 140;
      // Smooth twin rollercoaster dips with zero slope at entry/exit
      dipHeight = -5.8 * 0.5 * (1 - Math.cos(4 * Math.PI * t));
    }

    const y = 58 - s * 0.048 + dipHeight;
    const z = s;
    out.set(x, y, z);
    return dipHeight;
  }

  public sampleAt(s: number): TrackSample {
    const clampedS = THREE.MathUtils.clamp(s, -30, this.length + 50);
    const position = new THREE.Vector3();
    const dipHeight = this.computeTrackPoint(clampedS, position);

    const prev = new THREE.Vector3();
    const next = new THREE.Vector3();
    this.computeTrackPoint(clampedS - 0.5, prev);
    this.computeTrackPoint(clampedS + 0.5, next);

    const tangent = next.sub(prev).normalize();
    // Right-handed: tangent (+Z) x up (+Y) = -X (screen-right from chase cam)
    const right = new THREE.Vector3().crossVectors(tangent, WORLD_UP).normalize();

    return {
      position,
      tangent,
      right,
      width: this.roadHalfWidth * 2,
      dipHeight,
    };
  }

  public getWorldPosition(s: number, laneOffset: number, yOffset = 0): THREE.Vector3 {
    const sample = this.sampleAt(s);
    const pos = sample.position.clone();
    pos.addScaledVector(sample.right, laneOffset * this.roadHalfWidth);
    pos.y += yOffset;
    return pos;
  }

  private orientToTrack(obj: THREE.Object3D, sample: TrackSample): void {
    const lookTarget = sample.position.clone().add(sample.tangent);
    obj.position.copy(sample.position);
    obj.lookAt(lookTarget);
  }

  private buildTerrainAndRoad(): void {
    const startS = -28;
    const endS = this.length + 44;
    const step = 2;
    const samples: TrackSample[] = [];
    for (let s = startS; s <= endS; s += step) {
      samples.push(this.sampleAt(s));
    }

    // 1. Asphalt Road Ribbon
    const roadGeom = this.buildRibbonGeometry(
      samples,
      -this.roadHalfWidth,
      this.roadHalfWidth,
      0,
      0,
      step,
      1,
      14
    );
    const roadTex = createRoadTexture();
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.72,
      metalness: 0.05,
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // 2. Red-and-White Racing Curbs (left & right)
    const curbWidth = 1.25;
    const leftCurbGeom = this.buildCurbGeometry(
      samples,
      -this.roadHalfWidth - curbWidth,
      -this.roadHalfWidth + 0.08,
      0.06,
      0.02,
      step
    );
    const rightCurbGeom = this.buildCurbGeometry(
      samples,
      this.roadHalfWidth - 0.08,
      this.roadHalfWidth + curbWidth,
      0.02,
      0.06,
      step
    );
    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.05,
    });
    const leftCurb = new THREE.Mesh(leftCurbGeom, curbMat);
    const rightCurb = new THREE.Mesh(rightCurbGeom, curbMat);
    leftCurb.receiveShadow = true;
    rightCurb.receiveShadow = true;
    this.group.add(leftCurb, rightCurb);

    // 3. Lush Rolling Green Hillside Terrain Aprons (±75 units)
    const grassTex = createGrassTexture();
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(1, 1);
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.0,
    });

    const leftHillGeom = this.buildHillsideGeometry(samples, -1, step);
    const rightHillGeom = this.buildHillsideGeometry(samples, 1, step);
    const leftHill = new THREE.Mesh(leftHillGeom, grassMat);
    const rightHill = new THREE.Mesh(rightHillGeom, grassMat);
    leftHill.receiveShadow = true;
    rightHill.receiveShadow = true;
    this.group.add(leftHill, rightHill);
  }

  private buildRibbonGeometry(
    samples: TrackSample[],
    leftOffset: number,
    rightOffset: number,
    leftY: number,
    rightY: number,
    step: number,
    uRepeat: number,
    vScale: number
  ): THREE.BufferGeometry {
    const count = samples.length;
    const positions = new Float32Array(count * 2 * 3);
    const uvs = new Float32Array(count * 2 * 2);
    const indices: number[] = [];

    const pL = new THREE.Vector3();
    const pR = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const smp = samples[i];
      pL.copy(smp.position).addScaledVector(smp.right, leftOffset);
      pL.y += leftY;
      pR.copy(smp.position).addScaledVector(smp.right, rightOffset);
      pR.y += rightY;

      const vIdx = i * 2;
      positions[vIdx * 3] = pL.x;
      positions[vIdx * 3 + 1] = pL.y;
      positions[vIdx * 3 + 2] = pL.z;

      positions[(vIdx + 1) * 3] = pR.x;
      positions[(vIdx + 1) * 3 + 1] = pR.y;
      positions[(vIdx + 1) * 3 + 2] = pR.z;

      const vCoord = (i * step) / vScale;
      uvs[vIdx * 2] = 0;
      uvs[vIdx * 2 + 1] = vCoord;
      uvs[(vIdx + 1) * 2] = uRepeat;
      uvs[(vIdx + 1) * 2 + 1] = vCoord;

      if (i < count - 1) {
        const a = vIdx;
        const b = vIdx + 1;
        const c = vIdx + 2;
        const d = vIdx + 3;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private buildCurbGeometry(
    samples: TrackSample[],
    innerOffset: number,
    outerOffset: number,
    innerY: number,
    outerY: number,
    step: number
  ): THREE.BufferGeometry {
    const segs = samples.length - 1;
    const positions = new Float32Array(segs * 4 * 3);
    const colors = new Float32Array(segs * 4 * 3);
    const indices: number[] = [];

    const red = new THREE.Color('#E53935');
    const white = new THREE.Color('#FFFFFF');
    const p0L = new THREE.Vector3();
    const p0R = new THREE.Vector3();
    const p1L = new THREE.Vector3();
    const p1R = new THREE.Vector3();

    for (let i = 0; i < segs; i++) {
      const s0 = samples[i];
      const s1 = samples[i + 1];

      p0L.copy(s0.position).addScaledVector(s0.right, innerOffset);
      p0L.y += innerY;
      p0R.copy(s0.position).addScaledVector(s0.right, outerOffset);
      p0R.y += outerY;

      p1L.copy(s1.position).addScaledVector(s1.right, innerOffset);
      p1L.y += innerY;
      p1R.copy(s1.position).addScaledVector(s1.right, outerOffset);
      p1R.y += outerY;

      const base = i * 4;
      const pts = [p0L, p0R, p1L, p1R];
      const isRed = Math.floor((i * step) / 4) % 2 === 0;
      const c = isRed ? red : white;

      for (let k = 0; k < 4; k++) {
        const idx = (base + k) * 3;
        positions[idx] = pts[k].x;
        positions[idx + 1] = pts[k].y;
        positions[idx + 2] = pts[k].z;
        colors[idx] = c.r;
        colors[idx + 1] = c.g;
        colors[idx + 2] = c.b;
      }

      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private buildHillsideGeometry(
    samples: TrackSample[],
    sideSign: -1 | 1,
    step: number
  ): THREE.BufferGeometry {
    // Multi-strip cross-section from curb edge out to ±75 units
    const latOffsets = [12.1, 18, 28, 46, 75];
    const cols = latOffsets.length;
    const rows = samples.length;

    const positions = new Float32Array(rows * cols * 3);
    const colors = new Float32Array(rows * cols * 3);
    const uvs = new Float32Array(rows * cols * 2);
    const indices: number[] = [];

    const lightGrass = new THREE.Color('#9CE87A');
    const midGrass = new THREE.Color('#7AD957');
    const hillGrass = new THREE.Color('#5EC249');
    const tempCol = new THREE.Color();
    const p = new THREE.Vector3();

    for (let r = 0; r < rows; r++) {
      const smp = samples[r];
      const sVal = r * step;

      for (let c = 0; c < cols; c++) {
        const lat = latOffsets[c] * sideSign;
        p.copy(smp.position).addScaledVector(smp.right, lat);

        let hillY = -0.08;
        if (c === 1) {
          hillY = -0.25 + Math.sin(sVal * 0.04 + sideSign) * 0.35;
        } else if (c === 2) {
          hillY = 1.2 + Math.sin(sVal * 0.032 + sideSign * 1.4) * 1.4;
        } else if (c === 3) {
          hillY = 4.8 + Math.sin(sVal * 0.025 + sideSign * 2.1) * 2.6;
        } else if (c === 4) {
          hillY = 10.5 + Math.sin(sVal * 0.02 + sideSign * 0.7) * 4.0;
        }
        p.y += hillY;

        const vIdx = r * cols + c;
        positions[vIdx * 3] = p.x;
        positions[vIdx * 3 + 1] = p.y;
        positions[vIdx * 3 + 2] = p.z;

        uvs[vIdx * 2] = latOffsets[c] / 12;
        uvs[vIdx * 2 + 1] = sVal / 12;

        if (c <= 1) {
          tempCol.copy(lightGrass);
        } else if (c === 2) {
          tempCol.copy(midGrass);
        } else {
          tempCol.copy(hillGrass);
        }
        const wave = Math.sin(sVal * 0.06 + c) * 0.04;
        colors[vIdx * 3] = THREE.MathUtils.clamp(tempCol.r + wave, 0, 1);
        colors[vIdx * 3 + 1] = THREE.MathUtils.clamp(tempCol.g + wave, 0, 1);
        colors[vIdx * 3 + 2] = THREE.MathUtils.clamp(tempCol.b + wave, 0, 1);
      }

      if (r < rows - 1) {
        for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c;
          const b = a + 1;
          const d = (r + 1) * cols + c;
          const e = d + 1;

          if (sideSign === 1) {
            indices.push(a, b, d, b, e, d);
          } else {
            indices.push(a, d, b, b, d, e);
          }
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private buildStartGantry(s: number): void {
    const sample = this.sampleAt(s);
    const gantry = new THREE.Group();
    this.orientToTrack(gantry, sample);

    const span = this.roadHalfWidth + 1.5;
    const redMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFD54F',
      roughness: 0.25,
      metalness: 0.35,
    });

    // Candy-striped pillars (raised +1.6 units so Title logo sits cleanly in sky/frame)
    for (const side of [-1, 1]) {
      const pillarX = side * span;
      for (let seg = 0; seg < 7; seg++) {
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.72, 1.62, 16),
          seg % 2 === 0 ? redMat : whiteMat
        );
        cyl.position.set(pillarX, 0.81 + seg * 1.58, 0);
        cyl.castShadow = true;
        gantry.add(cyl);
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), goldMat);
      cap.position.set(pillarX, 11.8, 0);
      cap.castShadow = true;
      gantry.add(cap);
    }

    // Checkered overhead banner
    const checkerTex = createCheckerTexture();
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.wrapT = THREE.RepeatWrapping;
    checkerTex.repeat.set(6, 1.5);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: checkerTex,
      roughness: 0.35,
    });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(span * 2 + 1.6, 2.2, 0.9),
      bannerMat
    );
    banner.position.set(0, 11.2, 0);
    banner.castShadow = true;
    gantry.add(banner);

    // Painted starting grid decal
    const startLineMat = new THREE.MeshStandardMaterial({
      map: checkerTex,
      roughness: 0.7,
    });
    const startStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roadHalfWidth * 1.9, 2.6),
      startLineMat
    );
    startStrip.rotation.x = -Math.PI / 2;
    startStrip.position.set(0, 0.04, 0);
    startStrip.receiveShadow = true;
    gantry.add(startStrip);

    // Colorful pennant triangles under banner
    const pennantColors = ['#FF4B4B', '#FF9800', '#FFEB3B', '#4CAF50', '#29B6F6', '#AB47BC'];
    const pennantGeom = new THREE.ConeGeometry(0.55, 1.15, 3);
    for (let i = -8; i <= 8; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: pennantColors[Math.abs(i) % pennantColors.length],
        roughness: 0.4,
      });
      const pennant = new THREE.Mesh(pennantGeom, mat);
      pennant.rotation.x = Math.PI;
      pennant.position.set(i * 1.35, 9.5, 0);
      gantry.add(pennant);
    }

    // Major Three's Red-and-Yellow Wooden Commentary Booth on the right sideline
    const booth = this.createCommentaryBooth();
    booth.position.set(-(this.roadHalfWidth + 5.2), 0, -2.5);
    booth.rotation.y = Math.PI - 0.55;
    gantry.add(booth);

    this.group.add(gantry);
  }

  private createCommentaryBooth(): THREE.Group {
    const booth = new THREE.Group();

    const woodRed = new THREE.MeshStandardMaterial({ color: '#D32F2F', roughness: 0.55 });
    const woodYellow = new THREE.MeshStandardMaterial({ color: '#FDD835', roughness: 0.45 });
    const deskMat = new THREE.MeshStandardMaterial({ color: '#8D6E63', roughness: 0.65 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 });

    // Raised wooden platform
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.8, 4.4), deskMat);
    deck.position.y = 0.4;
    deck.castShadow = true;
    deck.receiveShadow = true;
    booth.add(deck);

    // Lower front & side booth walls
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 0.35), woodRed);
    frontWall.position.set(0, 1.9, 1.9);
    frontWall.castShadow = true;
    booth.add(frontWall);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.4, 0.55), woodYellow);
    trim.position.set(0, 3.05, 1.9);
    booth.add(trim);

    // 4 corner posts
    for (const px of [-2.3, 2.3]) {
      for (const pz of [-1.8, 1.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 10), woodYellow);
        post.position.set(px, 3.0, pz);
        post.castShadow = true;
        booth.add(post);
      }
    }

    // Striped pitched canopy roof
    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 4.8), woodRed);
    roofLeft.position.set(-1.3, 5.5, 0);
    roofLeft.rotation.z = 0.35;
    roofLeft.castShadow = true;
    booth.add(roofLeft);

    const roofRight = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 4.8), woodYellow);
    roofRight.position.set(1.3, 5.5, 0);
    roofRight.rotation.z = -0.35;
    roofRight.castShadow = true;
    booth.add(roofRight);

    // "3" crest on booth front
    const badgeTex = createNumberBadgeTexture(3, '#FDD835', '#D32F2F');
    const crest = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ map: badgeTex })
    );
    crest.position.set(0, 1.95, 2.1);
    booth.add(crest);

    // Cheerful Major Three commentator figure inside booth
    const threeGroup = new THREE.Group();
    const blockMat = new THREE.MeshStandardMaterial({ color: '#FDD835', roughness: 0.25 });
    for (let i = 0; i < 3; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), blockMat);
      cube.position.y = 0.42 + i * 0.86;
      cube.castShadow = true;
      threeGroup.add(cube);
    }
    // Jester crown hat
    const hatA = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.75, 10), woodRed);
    hatA.position.set(-0.28, 3.1, 0);
    hatA.rotation.z = 0.35;
    const hatB = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.75, 10), woodRed);
    hatB.position.set(0.28, 3.1, 0);
    hatB.rotation.z = -0.35;
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#1A1A1A' });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), whiteMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), whiteMat);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeL.position.set(-0.18, 2.25, 0.42);
    eyeR.position.set(0.18, 2.25, 0.42);
    pupilL.position.set(-0.18, 2.25, 0.47);
    pupilR.position.set(0.18, 2.25, 0.47);
    threeGroup.add(hatA, hatB, eyeL, eyeR, pupilL, pupilR);
    threeGroup.position.set(0, 1.3, 0.4);
    booth.add(threeGroup);

    return booth;
  }

  private buildFinishArea(s: number): void {
    const sample = this.sampleAt(s);
    const finishGroup = new THREE.Group();
    this.orientToTrack(finishGroup, sample);

    const span = this.roadHalfWidth + 1.8;
    const checkerTex = createCheckerTexture();
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.wrapT = THREE.RepeatWrapping;
    checkerTex.repeat.set(8, 2);

    const checkerMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.35 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFD54F',
      emissive: '#FFA000',
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.65,
    });
    const redMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.3 });

    // Giant Finish Arch Pillars
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.0, 11.5, 18),
        checkerMat
      );
      pillar.position.set(side * span, 5.75, 0);
      pillar.castShadow = true;
      finishGroup.add(pillar);

      const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), goldMat);
      star.position.set(side * span, 12.2, 0);
      finishGroup.add(star);
    }

    // Overhead Checkered Arch Beam
    const archBeam = new THREE.Mesh(
      new THREE.BoxGeometry(span * 2 + 2.2, 2.8, 1.2),
      checkerMat
    );
    archBeam.position.set(0, 10.8, 0);
    archBeam.castShadow = true;
    finishGroup.add(archBeam);

    // Golden Crown Accent on Arch
    const archTrim = new THREE.Mesh(
      new THREE.BoxGeometry(span * 2 + 2.6, 0.45, 1.35),
      goldMat
    );
    archTrim.position.set(0, 12.35, 0);
    finishGroup.add(archTrim);

    // Finish line checkered strip on road
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roadHalfWidth * 1.95, 3.4),
      new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.65 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.05, 0);
    strip.receiveShadow = true;
    finishGroup.add(strip);

    // Cheering Crowd Bleachers on both sides
    for (const side of [-1, 1]) {
      const bleacher = this.createBleacherGroup(8);
      bleacher.position.set(side * (this.roadHalfWidth + 6.5), 0, -4);
      bleacher.rotation.y = side === 1 ? -Math.PI * 0.42 : Math.PI * 0.42;
      finishGroup.add(bleacher);
    }

    // Golden Numberblock Rally Trophy on Podium Pedestal past the finish line
    const podiumSample = this.sampleAt(s + 22);
    const podiumBase = new THREE.Group();
    this.orientToTrack(podiumBase, podiumSample);

    const basePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.1, 1.8, 24),
      redMat
    );
    basePedestal.position.y = 0.9;
    basePedestal.castShadow = true;
    basePedestal.receiveShadow = true;
    podiumBase.add(basePedestal);

    const goldRing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.75, 2.75, 0.35, 24),
      goldMat
    );
    goldRing.position.y = 1.85;
    podiumBase.add(goldRing);

    // Build spinning Golden Trophy
    const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 1.5, 16), goldMat);
    cupStem.position.y = 0.75;
    const cupBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 0.65, 1.9, 20),
      goldMat
    );
    cupBowl.position.y = 2.15;
    const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.16, 10, 18), goldMat);
    handleL.position.set(-1.35, 2.25, 0);
    const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.16, 10, 18), goldMat);
    handleR.position.set(1.35, 2.25, 0);
    const crownStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), goldMat);
    crownStar.position.y = 3.55;

    this.finishTrophy.add(cupStem, cupBowl, handleL, handleR, crownStar);
    this.finishTrophy.position.set(0, 2.05, 0);
    this.finishTrophy.traverse((c) => {
      if (c instanceof THREE.Mesh) c.castShadow = true;
    });
    podiumBase.add(this.finishTrophy);

    this.group.add(finishGroup, podiumBase);
  }

  private createBleacherGroup(spectatorCount: number): THREE.Group {
    const g = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ color: '#1E88E5', roughness: 0.55 });
    const stepMat = new THREE.MeshStandardMaterial({ color: '#FDD835', roughness: 0.45 });

    for (let row = 0; row < 3; row++) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.5, 1.4),
        row % 2 === 0 ? plankMat : stepMat
      );
      bench.position.set(0, 0.5 + row * 0.9, -row * 1.45);
      bench.castShadow = true;
      bench.receiveShadow = true;
      g.add(bench);
    }

    for (let i = 0; i < spectatorCount; i++) {
      const row = i % 3;
      const col = Math.floor(i / 3);
      const colColor = BLOB_COLORS[i % BLOB_COLORS.length];
      const blob = this.createNumberblobMesh(colColor, 0.65);
      const bx = -3.8 + col * 3.1 + (row % 2) * 0.8;
      const by = 0.8 + row * 0.9;
      const bz = -row * 1.45;
      blob.position.set(bx, by, bz);
      g.add(blob);
      this.spectators.push({
        mesh: blob,
        baseY: by,
        phase: i * 0.85,
        speed: 4.5 + (i % 3) * 0.8,
      });
    }

    return g;
  }

  private buildScenicProps(): void {
    // Pine trees, lollipop trees, windmills, crowd bleachers, and rainbow arches along the valley
    for (let s = 30; s < this.length - 50; s += 24) {
      const sample = this.sampleAt(s);
      for (const side of [-1, 1]) {
        const dist = this.roadHalfWidth + 6.5 + ((s * 7 + (side > 0 ? 13 : 3)) % 14);
        const pos = sample.position.clone().addScaledVector(sample.right, side * dist);
        pos.y += (dist - this.roadHalfWidth) * 0.08;

        if ((s + (side > 0 ? 12 : 0)) % 48 === 0) {
          const tree = this.createLollipopTree(BLOB_COLORS[(s / 24 + (side > 0 ? 2 : 0)) % BLOB_COLORS.length | 0]);
          tree.position.copy(pos);
          this.group.add(tree);
        } else {
          const pine = this.createPineTree(0.9 + ((s % 5) * 0.14));
          pine.position.copy(pos);
          this.group.add(pine);
        }
      }
    }

    // Windmills on scenic hillsides
    const windmillPositions = [
      { s: 165, side: -1 },
      { s: 370, side: 1 },
      { s: 735, side: -1 },
      { s: 960, side: 1 },
    ];
    for (const wm of windmillPositions) {
      const sample = this.sampleAt(wm.s);
      const pos = sample.position.clone().addScaledVector(sample.right, wm.side * (this.roadHalfWidth + 16));
      pos.y += 1.4;
      const mill = this.createWindmill();
      mill.position.copy(pos);
      mill.rotation.y = wm.side === 1 ? -0.5 : 0.5;
      this.group.add(mill);
    }

    // Rainbow celebration arches over scenic track sections
    const rainbowArches = [245, 790];
    for (const rs of rainbowArches) {
      const sample = this.sampleAt(rs);
      const arch = this.createRainbowGateArch();
      this.orientToTrack(arch, sample);
      this.group.add(arch);
    }

    // Mid-track cheering bleachers
    const midBleachers = [
      { s: 310, side: -1 },
      { s: 710, side: 1 },
    ];
    for (const mb of midBleachers) {
      const sample = this.sampleAt(mb.s);
      const container = new THREE.Group();
      this.orientToTrack(container, sample);
      const bleacher = this.createBleacherGroup(6);
      bleacher.position.set(mb.side * (this.roadHalfWidth + 6.5), 0.15, 0);
      bleacher.rotation.y = mb.side === 1 ? -Math.PI * 0.45 : Math.PI * 0.45;
      container.add(bleacher);
      this.group.add(container);
    }
  }

  private createPineTree(scale: number): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.8 })
    );
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.6 });
    const leafLight = new THREE.MeshStandardMaterial({ color: '#43A047', roughness: 0.55 });
    const tiers = [
      { y: 3.1, r: 2.3, h: 2.8, mat: leafMat },
      { y: 4.8, r: 1.75, h: 2.4, mat: leafLight },
      { y: 6.2, r: 1.15, h: 2.0, mat: leafMat },
    ];
    for (const t of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 12), t.mat);
      cone.position.y = t.y;
      cone.castShadow = true;
      tree.add(cone);
    }

    tree.scale.setScalar(scale);
    return tree;
  }

  private createLollipopTree(colorHex: string): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.48, 3.6, 10),
      new THREE.MeshStandardMaterial({ color: '#8D6E63', roughness: 0.7 })
    );
    trunk.position.y = 1.8;
    trunk.castShadow = true;
    tree.add(trunk);

    const candyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.05,
    });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 14), candyMat);
    canopy.position.y = 4.6;
    canopy.castShadow = true;
    tree.add(canopy);

    return tree;
  }

  private createWindmill(): THREE.Group {
    const mill = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.45 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.35 });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.05, 8.5, 14), whiteMat);
    tower.position.y = 4.25;
    tower.castShadow = true;
    mill.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 2.4, 14), redMat);
    roof.position.y = 9.7;
    roof.castShadow = true;
    mill.add(roof);

    const bladesPivot = new THREE.Group();
    bladesPivot.position.set(0, 7.6, 1.45);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), redMat);
    bladesPivot.add(hub);

    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const sail = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 3.8, 0.14),
        i % 2 === 0 ? redMat : whiteMat
      );
      sail.position.y = 2.1;
      sail.castShadow = true;
      arm.add(sail);
      bladesPivot.add(arm);
    }

    mill.add(bladesPivot);
    this.windmills.push(bladesPivot);
    return mill;
  }

  private createRainbowGateArch(): THREE.Group {
    const g = new THREE.Group();
    const colors = ['#FF4B4B', '#FF9626', '#FFE135', '#4CD964', '#32B5FF', '#5C6BC0', '#AB47BC'];
    const baseRadius = this.roadHalfWidth + 1.8;

    colors.forEach((col, i) => {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius + i * 0.42, 0.22, 10, 36, Math.PI),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.15,
          roughness: 0.25,
        })
      );
      torus.position.y = 0.5;
      g.add(torus);
    });

    return g;
  }

  private createNumberblobMesh(colorHex: string, scale = 1): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.24,
      metalness: 0.06,
    });
    const whiteMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#111111' });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 14), bodyMat);
    body.scale.set(1.05, 0.92, 1.0);
    body.position.y = 0.66;
    body.castShadow = true;
    g.add(body);

    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
    earL.position.set(-0.46, 1.24, 0);
    const earR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
    earR.position.set(0.46, 1.24, 0);
    g.add(earL, earR);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), whiteMat);
      eye.position.set(side * 0.24, 0.78, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
      pupil.position.set(side * 0.24, 0.78, 0.71);
      g.add(eye, pupil);
    }

    g.scale.setScalar(scale);
    return g;
  }

  private spawnBlobLine(count: number, startS: number, endS: number, waveAmp: number, phaseOffset: number): void {
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const s = THREE.MathUtils.lerp(startS, endS, t);
      const laneX = Math.sin(t * Math.PI * 5 + phaseOffset) * waveAmp;
      const color = BLOB_COLORS[i % BLOB_COLORS.length];

      const mesh = this.createNumberblobMesh(color, 0.95);
      const worldPos = this.getWorldPosition(s, laneX, 0.25);
      mesh.position.copy(worldPos);
      // Face toward approaching racers (-tangent)
      const sample = this.sampleAt(s);
      mesh.lookAt(worldPos.clone().sub(sample.tangent));

      this.group.add(mesh);
      this.blobPickups.push({
        id: `blob-${this.blobPickups.length + 1}`,
        mesh,
        s,
        laneX,
        collected: false,
        color,
      });
    }
  }

  private createJumpRampMesh(): THREE.Group {
    const g = new THREE.Group();
    const rampTex = createWoodRampTexture();
    const rampMat = new THREE.MeshStandardMaterial({
      map: rampTex,
      roughness: 0.48,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: '#FFB300',
      roughness: 0.35,
    });

    // Wedge prism built with ExtrudeGeometry for crisp bevels
    const shape = new THREE.Shape();
    shape.moveTo(-2.6, 0);
    shape.lineTo(2.6, 0);
    shape.lineTo(2.6, 1.35);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 4.8,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
    extrude.center();

    // Rotate so ramp rises along +Z
    const wedge = new THREE.Mesh(extrude, rampMat);
    wedge.rotation.y = -Math.PI / 2;
    wedge.position.y = 0.68;
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    g.add(wedge);

    // Yellow glowing side rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 5.2), sideMat);
      rail.position.set(side * 2.45, 0.45, 0);
      rail.rotation.x = -0.24;
      g.add(rail);
    }

    return g;
  }

  private buildCountCruiseFeatures(maxCountTarget: 5 | 10): void {
    const startS = 90;
    const endS = this.length - 90;

    // 1. Counting Gates 1..maxCountTarget
    for (let i = 0; i < maxCountTarget; i++) {
      const num = (i + 1) as NumberblockId;
      const t = i / (maxCountTarget - 1);
      const s = THREE.MathUtils.lerp(startS, endS, t);
      const id = `count-gate-${num}`;

      const feature: TrackFeature = {
        id,
        type: 'count-gate',
        z: s,
        laneX: 0,
        value: num,
        label: `${num}`,
        triggered: false,
      };
      this.features.push(feature);

      const gateMesh = this.createCountingGateMesh(num);
      const sample = this.sampleAt(s);
      this.orientToTrack(gateMesh, sample);
      this.group.add(gateMesh);
      this.featureMeshes.set(id, gateMesh);
    }

    // 2. 3 gentle Jump Ramps between gates
    const rampPositions = [
      { s: 255, laneX: -0.35 },
      { s: 565, laneX: 0.0 },
      { s: 825, laneX: 0.35 },
    ];
    rampPositions.forEach((rp, idx) => {
      const id = `cruise-ramp-${idx + 1}`;
      const feature: TrackFeature = {
        id,
        type: 'ramp',
        z: rp.s,
        laneX: rp.laneX,
        value: 1,
        label: 'JUMP!',
        triggered: false,
      };
      this.features.push(feature);

      const ramp = this.createJumpRampMesh();
      const sample = this.sampleAt(rp.s);
      this.orientToTrack(ramp, sample);
      ramp.position.addScaledVector(sample.right, rp.laneX * this.roadHalfWidth);
      this.group.add(ramp);
      this.featureMeshes.set(id, ramp);
    });

    // 3. 28 cheerful bouncing Numberblobs in curved steering ribbons
    this.spawnBlobLine(28, 55, this.length - 70, 0.55, 0.4);
  }

  private createCountingGateMesh(num: NumberblockId): THREE.Group {
    const spec = NUMBERBLOCK_SPECS[num];
    const g = new THREE.Group();
    const span = this.roadHalfWidth - 0.6;

    const pillarMat = new THREE.MeshStandardMaterial({
      color: spec.primaryColor,
      emissive: spec.primaryColor,
      emissiveIntensity: 0.16,
      roughness: 0.25,
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.25 });

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.72, 8.2, 16),
        pillarMat
      );
      pillar.position.set(side * span, 4.1, 0);
      pillar.castShadow = true;
      g.add(pillar);

      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.05, 0.5, 16),
        whiteMat
      );
      baseRing.position.set(side * span, 0.25, 0);
      g.add(baseRing);
    }

    // Overhead luminous arch beam
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(span, 0.48, 12, 32, Math.PI),
      pillarMat
    );
    arch.position.y = 7.6;
    arch.scale.y = 0.42;
    g.add(arch);

    // Giant spinning Number Badge in center (two back-to-back discs so numerals are never mirrored)
    const badgeTex = createNumberBadgeTexture(num, spec.primaryColor);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTex,
      transparent: true,
      side: THREE.FrontSide,
    });
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 7.6, 0);

    const badgeGeom = new THREE.CircleGeometry(2.35, 32);
    const frontBadge = new THREE.Mesh(badgeGeom, badgeMat);
    frontBadge.rotation.y = Math.PI; // Faces approaching player (-tangent)
    frontBadge.position.z = -0.04;
    badgeGroup.add(frontBadge);

    const backBadge = new THREE.Mesh(badgeGeom, badgeMat);
    backBadge.position.z = 0.04;
    badgeGroup.add(backBadge);

    // Glow halo ring around badge
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.48, 0.18, 10, 32),
      whiteMat
    );
    badgeGroup.add(halo);
    g.add(badgeGroup);

    this.animatedBadges.push({
      mesh: badgeGroup,
      baseY: 7.6,
      phase: num * 0.7,
      spin: true,
    });

    // Painted road decal (oriented upright & un-mirrored toward approaching player)
    const decalTex = createTrackNumberDecalTexture(num);
    const decalMat = new THREE.MeshStandardMaterial({
      map: decalTex,
      transparent: true,
      roughness: 0.65,
      depthWrite: false,
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), decalMat);
    decal.rotation.set(-Math.PI / 2, 0, Math.PI);
    decal.position.set(0, 0.05, 0);
    decal.receiveShadow = true;
    g.add(decal);

    return g;
  }

  private buildRallyMathFeatures(): void {
    // Curated Numberblock Rally episode obstacles, boosts, Double-Dipper & Mud Puddle
    const rocks: Array<{ s: number; laneX: number; value: number }> = [
      { s: 120, laneX: -0.45, value: 1 },
      { s: 235, laneX: 0.48, value: 2 },
      { s: 385, laneX: -0.32, value: 1 },
      { s: 495, laneX: 0.42, value: 2 },
      { s: 735, laneX: -0.48, value: 3 },
      { s: 865, laneX: 0.38, value: 2 },
    ];

    rocks.forEach((rk, idx) => {
      const id = `rock-${idx + 1}`;
      this.features.push({
        id,
        type: 'rock',
        z: rk.s,
        laneX: rk.laneX,
        value: rk.value,
        label: `-${rk.value}`,
        triggered: false,
      });

      const rockMesh = this.createRockHazardMesh(rk.value);
      const sample = this.sampleAt(rk.s);
      this.orientToTrack(rockMesh, sample);
      rockMesh.position.addScaledVector(sample.right, rk.laneX * this.roadHalfWidth);
      this.group.add(rockMesh);
      this.featureMeshes.set(id, rockMesh);
    });

    // Wooden Jump Ramps
    const ramps: Array<{ s: number; laneX: number }> = [
      { s: 175, laneX: 0.35 },
      { s: 325, laneX: -0.35 },
      { s: 560, laneX: 0.58 }, // Double-Dipper bypass ramp 1
      { s: 630, laneX: -0.58 }, // Double-Dipper bypass ramp 2
      { s: 810, laneX: 0.0 },
    ];

    ramps.forEach((rp, idx) => {
      const id = `rally-ramp-${idx + 1}`;
      this.features.push({
        id,
        type: 'ramp',
        z: rp.s,
        laneX: rp.laneX,
        value: 1,
        label: 'BOOST!',
        triggered: false,
      });

      const rampMesh = this.createJumpRampMesh();
      const sample = this.sampleAt(rp.s);
      this.orientToTrack(rampMesh, sample);
      rampMesh.position.addScaledVector(sample.right, rp.laneX * this.roadHalfWidth);
      this.group.add(rampMesh);
      this.featureMeshes.set(id, rampMesh);
    });

    // Combine Boost Gates (+1, +2, +3)
    const mergeGates: Array<{ s: number; laneX: number; value: number }> = [
      { s: 285, laneX: 0.0, value: 1 },
      { s: 445, laneX: -0.35, value: 2 },
      { s: 700, laneX: 0.3, value: 2 },
      { s: 895, laneX: -0.25, value: 3 },
      { s: 990, laneX: 0.0, value: 1 },
    ];

    mergeGates.forEach((mg, idx) => {
      const id = `merge-gate-${idx + 1}`;
      this.features.push({
        id,
        type: 'merge-gate',
        z: mg.s,
        laneX: mg.laneX,
        value: mg.value,
        label: `+${mg.value}`,
        triggered: false,
      });

      const gateMesh = this.createMergeGateMesh(mg.value);
      const sample = this.sampleAt(mg.s);
      this.orientToTrack(gateMesh, sample);
      gateMesh.position.addScaledVector(sample.right, mg.laneX * this.roadHalfWidth);
      this.group.add(gateMesh);
      this.featureMeshes.set(id, gateMesh);
    });

    // Iconic Double-Dipper Twin Dip Gates (s = 560 and s = 630)
    const dippers = [560, 630];
    dippers.forEach((ds, idx) => {
      const id = `double-dipper-${idx + 1}`;
      this.features.push({
        id,
        type: 'double-dipper',
        z: ds,
        laneX: 0,
        value: 3,
        label: 'DOUBLE DIPPER!',
        triggered: false,
      });

      const dipArch = this.createDoubleDipperArch(idx + 1);
      const sample = this.sampleAt(ds);
      this.orientToTrack(dipArch, sample);
      this.group.add(dipArch);
      this.featureMeshes.set(id, dipArch);
    });

    // Mud Puddle splash zone near s = 940
    const mudId = 'mud-puddle-1';
    this.features.push({
      id: mudId,
      type: 'mud-puddle',
      z: 940,
      laneX: 0,
      value: 1,
      label: 'SPLASH!',
      triggered: false,
    });
    const mudMesh = this.createMudPuddleMesh();
    const mudSample = this.sampleAt(940);
    this.orientToTrack(mudMesh, mudSample);
    this.group.add(mudMesh);
    this.featureMeshes.set(mudId, mudMesh);

    // 32 collectible Numberblobs in racing lines
    this.spawnBlobLine(32, 60, this.length - 75, 0.68, 0.9);
  }

  private createRockHazardMesh(subtractVal: number): THREE.Group {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#78909C',
      roughness: 0.78,
      flatShading: true,
    });
    const rockDark = new THREE.MeshStandardMaterial({
      color: '#546E7A',
      roughness: 0.85,
      flatShading: true,
    });

    const mainBoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), rockMat);
    mainBoulder.scale.set(1.25, 0.92, 1.1);
    mainBoulder.position.y = 1.2;
    mainBoulder.castShadow = true;
    mainBoulder.receiveShadow = true;
    g.add(mainBoulder);

    const sideStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), rockDark);
    sideStone.position.set(1.25, 0.65, 0.55);
    sideStone.castShadow = true;
    g.add(sideStone);

    // Floating "-N" warning badge above rock
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 256;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#E53935';
      ctx.beginPath();
      ctx.arc(128, 128, 114, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 112px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`-${subtractVal}`, 128, 134);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;

    const signMat = new THREE.MeshBasicMaterial({
      map: signTex,
      transparent: true,
      side: THREE.FrontSide,
    });
    const signGroup = new THREE.Group();
    signGroup.position.set(0, 3.65, 0);

    const signGeom = new THREE.CircleGeometry(1.05, 24);
    const frontSign = new THREE.Mesh(signGeom, signMat);
    frontSign.rotation.y = Math.PI; // Faces approaching player (-tangent)
    frontSign.position.z = -0.02;
    signGroup.add(frontSign);

    const backSign = new THREE.Mesh(signGeom, signMat);
    backSign.position.z = 0.02;
    signGroup.add(backSign);

    g.add(signGroup);

    this.animatedBadges.push({
      mesh: signGroup,
      baseY: 3.65,
      phase: subtractVal * 1.2,
      spin: false,
    });

    return g;
  }

  private createMergeGateMesh(addVal: number): THREE.Group {
    const g = new THREE.Group();
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: '#00E676',
      emissive: '#00C853',
      emissiveIntensity: 0.35,
      roughness: 0.22,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFD54F',
      emissive: '#FFA000',
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.4,
    });

    const halfW = 3.2;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.4, 5.2, 12),
        emeraldMat
      );
      post.position.set(side * halfW, 2.6, 0);
      post.castShadow = true;
      g.add(post);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), goldMat);
      orb.position.set(side * halfW, 5.35, 0);
      g.add(orb);
    }

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.5, 0.5), goldMat);
    topBar.position.set(0, 5.2, 0);
    g.add(topBar);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 256;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#00C853';
      ctx.beginPath();
      ctx.arc(128, 128, 114, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#FFD54F';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 112px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${addVal}`, 128, 134);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;

    const badgeMat = new THREE.MeshBasicMaterial({
      map: signTex,
      transparent: true,
      side: THREE.FrontSide,
    });
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 4.1, 0);

    const badgeGeom = new THREE.CircleGeometry(1.35, 24);
    const frontBadge = new THREE.Mesh(badgeGeom, badgeMat);
    frontBadge.rotation.y = Math.PI; // Faces approaching player (-tangent)
    frontBadge.position.z = -0.03;
    badgeGroup.add(frontBadge);

    const backBadge = new THREE.Mesh(badgeGeom, badgeMat);
    backBadge.position.z = 0.03;
    badgeGroup.add(backBadge);

    g.add(badgeGroup);

    this.animatedBadges.push({
      mesh: badgeGroup,
      baseY: 4.1,
      phase: addVal * 1.1,
      spin: true,
    });

    return g;
  }

  private createDoubleDipperArch(dipNumber: number): THREE.Group {
    const g = new THREE.Group();
    const checkerTex = createCheckerTexture();
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.wrapT = THREE.RepeatWrapping;
    checkerTex.repeat.set(5, 1);

    const archMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.35 });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: '#FF7043',
      emissive: '#FF5722',
      emissiveIntensity: 0.2,
      roughness: 0.3,
    });

    const span = this.roadHalfWidth + 0.5;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 7.5, 14), orangeMat);
      post.position.set(side * span, 3.75, 0);
      post.castShadow = true;
      g.add(post);
    }

    const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 1.2, 1.8, 0.8), archMat);
    banner.position.set(0, 7.4, 0);
    g.add(banner);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 160;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FF6D00';
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, 496, 144);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`DOUBLE DIPPER ${dipNumber}!`, 256, 82);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.FrontSide });
    const signGeom = new THREE.PlaneGeometry(9.6, 3.0);

    const frontBoard = new THREE.Mesh(signGeom, signMat);
    frontBoard.rotation.y = Math.PI; // Faces approaching player (-tangent)
    frontBoard.position.set(0, 9.6, -0.04);
    g.add(frontBoard);

    const backBoard = new THREE.Mesh(signGeom, signMat);
    backBoard.position.set(0, 9.6, 0.04);
    g.add(backBoard);

    return g;
  }

  private createMudPuddleMesh(): THREE.Group {
    const g = new THREE.Group();
    const mudTex = createMudTexture();
    const mudMat = new THREE.MeshStandardMaterial({
      map: mudTex,
      roughness: 0.16,
      metalness: 0.12,
    });

    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), mudMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(this.roadHalfWidth * 0.88, 6.2, 1);
    puddle.position.y = 0.05;
    puddle.receiveShadow = true;
    g.add(puddle);

    // Cheering mini-Ones on the banks of the mud puddle
    for (const side of [-1, 1]) {
      for (let k = -1; k <= 1; k += 2) {
        const miniOne = new THREE.Group();
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.9, 0.9),
          new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.25 })
        );
        block.position.y = 0.45;
        block.castShadow = true;
        miniOne.add(block);
        miniOne.position.set(side * (this.roadHalfWidth + 2.4), 0.1, k * 2.2);
        miniOne.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
        g.add(miniOne);

        this.spectators.push({
          mesh: miniOne,
          baseY: 0.1,
          phase: (side + 2) + k,
          speed: 6.0,
        });
      }
    }

    return g;
  }

  public hideFeature(featureId: string): void {
    const obj = this.featureMeshes.get(featureId);
    if (obj) {
      obj.visible = false;
    }
  }

  public update(dt: number, time: number): void {
    if (this.disposed) return;

    // Rotate windmill blades
    for (const blades of this.windmills) {
      blades.rotation.z -= dt * 1.6;
    }

    // Spin golden finish trophy
    this.finishTrophy.rotation.y += dt * 1.4;
    this.finishTrophy.position.y = 2.05 + Math.sin(time * 2.6) * 0.22;

    // Bounce uncollected Numberblobs
    for (let i = 0; i < this.blobPickups.length; i++) {
      const b = this.blobPickups[i];
      if (b.collected) {
        if (b.mesh.visible) b.mesh.visible = false;
        continue;
      }
      const bounce = Math.abs(Math.sin(time * 4.2 + i * 0.65)) * 0.48;
      b.mesh.position.y = this.sampleAt(b.s).position.y + 0.22 + bounce;
      b.mesh.rotation.y += dt * 1.3;
    }

    // Bounce cheering crowd spectators
    for (const sp of this.spectators) {
      sp.mesh.position.y = sp.baseY + Math.abs(Math.sin(time * sp.speed + sp.phase)) * 0.35;
    }

    // Pulse/spin gate badges
    for (const badge of this.animatedBadges) {
      const pulse = 1 + Math.sin(time * 3.4 + badge.phase) * 0.06;
      badge.mesh.scale.setScalar(pulse);
      badge.mesh.position.y = badge.baseY + Math.sin(time * 2.5 + badge.phase) * 0.18;
      if (badge.spin) {
        badge.mesh.rotation.y = Math.sin(time * 1.4 + badge.phase) * 0.35;
      }
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m && typeof m.dispose === 'function') {
            const anyMat = m as unknown as { map?: THREE.Texture | null };
            if (anyMat.map) {
              anyMat.map.dispose();
            }
            m.dispose();
          }
        }
      }
    });

    this.featureMeshes.clear();
    this.blobPickups = [];
    this.windmills = [];
    this.animatedBadges = [];
    this.spectators = [];
  }
}
