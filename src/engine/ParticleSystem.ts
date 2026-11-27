import * as THREE from 'three';

type ParticleKind = 'confetti' | 'magic' | 'dust' | 'mud' | 'block';

interface ParticleSlot {
  kind: ParticleKind;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  maxAge: number;
  velocity: THREE.Vector3;
  rotVel: THREE.Vector3;
  gravity: number;
  groundY: number;
  bounceFactor: number;
  startScale: number;
  endScale: number;
  fadeOut: boolean;
  swirlPhase: number;
  swirlSpeed: number;
}

const CONFETTI_COLORS = [
  '#FF4B4B',
  '#FF9626',
  '#FFE135',
  '#4CD964',
  '#32B5FF',
  '#7E57C2',
  '#EC407A',
];

export class ParticleSystem {
  public group: THREE.Group;

  private slots: ParticleSlot[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();

    const confettiGeom = new THREE.PlaneGeometry(0.42, 0.26);
    const magicGeom = new THREE.OctahedronGeometry(0.24, 0);
    const dustGeom = new THREE.SphereGeometry(0.28, 10, 8);
    const mudGeom = new THREE.SphereGeometry(0.18, 8, 6);
    const blockGeom = new THREE.BoxGeometry(0.68, 0.68, 0.68);

    this.geometries.push(confettiGeom, magicGeom, dustGeom, mudGeom, blockGeom);

    // Pre-allocate pools for zero-GC runtime performance
    this.allocatePool('confetti', 90, confettiGeom, () =>
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
      })
    );

    this.allocatePool('magic', 80, magicGeom, () =>
      new THREE.MeshStandardMaterial({
        color: '#FFD54F',
        emissive: '#FFC107',
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 1,
      })
    );

    this.allocatePool('dust', 60, dustGeom, () =>
      new THREE.MeshStandardMaterial({
        color: '#FFF6E5',
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.65,
      })
    );

    this.allocatePool('mud', 45, mudGeom, () =>
      new THREE.MeshStandardMaterial({
        color: '#6D4C41',
        roughness: 0.35,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95,
      })
    );

    this.allocatePool('block', 24, blockGeom, () =>
      new THREE.MeshStandardMaterial({
        color: '#E53935',
        roughness: 0.22,
        metalness: 0.08,
        transparent: true,
        opacity: 1,
      })
    );
  }

  private allocatePool(
    kind: ParticleKind,
    count: number,
    geometry: THREE.BufferGeometry,
    createMat: () => THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  ): void {
    for (let i = 0; i < count; i++) {
      const material = createMat();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.castShadow = kind === 'block';
      mesh.receiveShadow = false;
      this.group.add(mesh);

      this.slots.push({
        kind,
        mesh,
        material,
        active: false,
        age: 0,
        maxAge: 1,
        velocity: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        gravity: 0,
        groundY: -999,
        bounceFactor: 0,
        startScale: 1,
        endScale: 0,
        fadeOut: true,
        swirlPhase: 0,
        swirlSpeed: 0,
      });
    }
  }

  private acquireSlot(kind: ParticleKind): ParticleSlot | null {
    let oldest: ParticleSlot | null = null;
    for (const slot of this.slots) {
      if (slot.kind !== kind) continue;
      if (!slot.active) return slot;
      if (!oldest || slot.age / slot.maxAge > oldest.age / oldest.maxAge) {
        oldest = slot;
      }
    }
    return oldest;
  }

  public emitConfetti(pos: THREE.Vector3, count = 32): void {
    if (this.disposed) return;
    for (let i = 0; i < count; i++) {
      const slot = this.acquireSlot('confetti');
      if (!slot) break;

      const angle = Math.random() * Math.PI * 2;
      const horiz = 3.5 + Math.random() * 8.5;
      slot.active = true;
      slot.age = 0;
      slot.maxAge = 1.6 + Math.random() * 0.9;
      slot.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.4,
        pos.y + Math.random() * 1.0,
        pos.z + (Math.random() - 0.5) * 1.4
      );
      slot.mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      slot.velocity.set(
        Math.cos(angle) * horiz,
        7.5 + Math.random() * 8.5,
        Math.sin(angle) * horiz
      );
      slot.rotVel.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
      slot.gravity = -11.5;
      slot.groundY = pos.y - 0.8;
      slot.bounceFactor = 0.15;
      slot.startScale = 0.9 + Math.random() * 0.6;
      slot.endScale = 0.65;
      slot.fadeOut = true;
      slot.swirlPhase = Math.random() * Math.PI * 2;
      slot.swirlSpeed = 5 + Math.random() * 4;

      const col = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      slot.material.color.set(col);
      slot.material.opacity = 1;
      slot.mesh.scale.setScalar(slot.startScale);
      slot.mesh.visible = true;
    }
  }

  public emitMathMagic(pos: THREE.Vector3, colorHex: string, count = 24): void {
    if (this.disposed) return;
    for (let i = 0; i < count; i++) {
      const slot = this.acquireSlot('magic');
      if (!slot) break;

      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.35;
      const speed = 4.2 + Math.random() * 5.2;
      const isGold = i % 2 === 0;

      slot.active = true;
      slot.age = 0;
      slot.maxAge = 0.85 + Math.random() * 0.45;
      slot.mesh.position.set(
        pos.x + Math.cos(angle) * 0.6,
        pos.y + 0.8 + Math.random() * 0.8,
        pos.z + Math.sin(angle) * 0.6
      );
      slot.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      slot.velocity.set(
        Math.cos(angle) * speed,
        3.8 + Math.random() * 5.0,
        Math.sin(angle) * speed
      );
      slot.rotVel.set(4, 6, 5);
      slot.gravity = -4.0;
      slot.groundY = -999;
      slot.bounceFactor = 0;
      slot.startScale = 0.95 + Math.random() * 0.55;
      slot.endScale = 0.08;
      slot.fadeOut = true;
      slot.swirlPhase = angle;
      slot.swirlSpeed = 8.0;

      slot.material.color.set(isGold ? '#FFE066' : colorHex);
      if (slot.material instanceof THREE.MeshStandardMaterial) {
        slot.material.emissive.set(isGold ? '#FFB300' : colorHex);
      }
      slot.material.opacity = 1;
      slot.mesh.scale.setScalar(slot.startScale);
      slot.mesh.visible = true;
    }
  }

  public emitDust(pos: THREE.Vector3, count = 5): void {
    if (this.disposed) return;
    for (let i = 0; i < count; i++) {
      const slot = this.acquireSlot('dust');
      if (!slot) break;

      slot.active = true;
      slot.age = 0;
      slot.maxAge = 0.42 + Math.random() * 0.25;
      slot.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.1,
        pos.y + 0.15 + Math.random() * 0.2,
        pos.z + (Math.random() - 0.5) * 1.1
      );
      slot.velocity.set(
        (Math.random() - 0.5) * 2.2,
        1.1 + Math.random() * 1.4,
        (Math.random() - 0.5) * 2.2
      );
      slot.rotVel.set(0, 0, 0);
      slot.gravity = 0.5;
      slot.groundY = -999;
      slot.bounceFactor = 0;
      slot.startScale = 0.65 + Math.random() * 0.45;
      slot.endScale = 1.65;
      slot.fadeOut = true;
      slot.swirlPhase = 0;
      slot.swirlSpeed = 0;

      slot.material.opacity = 0.55;
      slot.mesh.scale.setScalar(slot.startScale);
      slot.mesh.visible = true;
    }
  }

  public emitMudSplash(pos: THREE.Vector3, count = 18): void {
    if (this.disposed) return;
    for (let i = 0; i < count; i++) {
      const slot = this.acquireSlot('mud');
      if (!slot) break;

      const angle = Math.random() * Math.PI * 2;
      const horiz = 2.5 + Math.random() * 6.0;
      slot.active = true;
      slot.age = 0;
      slot.maxAge = 0.75 + Math.random() * 0.35;
      slot.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.2,
        pos.y + 0.2,
        pos.z + (Math.random() - 0.5) * 1.2
      );
      slot.velocity.set(
        Math.cos(angle) * horiz,
        5.5 + Math.random() * 5.5,
        Math.sin(angle) * horiz
      );
      slot.rotVel.set(3, 4, 2);
      slot.gravity = -18.0;
      slot.groundY = pos.y;
      slot.bounceFactor = 0.2;
      slot.startScale = 0.8 + Math.random() * 0.8;
      slot.endScale = 0.2;
      slot.fadeOut = true;
      slot.swirlPhase = 0;
      slot.swirlSpeed = 0;

      slot.material.color.set(i % 3 === 0 ? '#8D6E63' : '#5D4037');
      slot.material.opacity = 0.95;
      slot.mesh.scale.setScalar(slot.startScale);
      slot.mesh.visible = true;
    }
  }

  public emitPoppedBlocks(pos: THREE.Vector3, count: number, colorHex: string): void {
    if (this.disposed) return;
    const clampedCount = Math.max(1, Math.min(count, 10));
    for (let i = 0; i < clampedCount; i++) {
      const slot = this.acquireSlot('block');
      if (!slot) break;

      const side = i % 2 === 0 ? -1 : 1;
      const spread = 0.4 + (i * 0.25);
      slot.active = true;
      slot.age = 0;
      slot.maxAge = 1.45 + Math.random() * 0.4;
      slot.mesh.position.set(
        pos.x + side * 0.6,
        pos.y + 1.2 + i * 0.25,
        pos.z + (Math.random() - 0.5) * 0.8
      );
      slot.mesh.rotation.set(
        Math.random() * 1.2,
        Math.random() * 1.2,
        Math.random() * 1.2
      );
      slot.velocity.set(
        side * (3.8 + spread * 1.8),
        7.5 + Math.random() * 4.2,
        (Math.random() - 0.5) * 5.0
      );
      slot.rotVel.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9
      );
      slot.gravity = -20.0;
      slot.groundY = pos.y + 0.34;
      slot.bounceFactor = 0.52;
      slot.startScale = 1.0;
      slot.endScale = 0.15;
      slot.fadeOut = true;
      slot.swirlPhase = 0;
      slot.swirlSpeed = 0;

      slot.material.color.set(colorHex);
      slot.material.opacity = 1;
      slot.mesh.scale.setScalar(1.0);
      slot.mesh.visible = true;
    }
  }

  public update(dt: number): void {
    if (this.disposed) return;
    const step = Math.min(dt, 0.05);

    for (const slot of this.slots) {
      if (!slot.active) continue;

      slot.age += step;
      const t = slot.age / slot.maxAge;
      if (t >= 1) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }

      slot.velocity.y += slot.gravity * step;

      if (slot.kind === 'confetti') {
        slot.velocity.x *= 1 - 1.2 * step;
        slot.velocity.z *= 1 - 1.2 * step;
        slot.mesh.position.x += Math.sin(slot.age * slot.swirlSpeed + slot.swirlPhase) * 1.6 * step;
      } else if (slot.kind === 'magic') {
        const swirl = slot.age * slot.swirlSpeed + slot.swirlPhase;
        slot.mesh.position.x += Math.cos(swirl) * 1.4 * step;
        slot.mesh.position.z += Math.sin(swirl) * 1.4 * step;
      }

      slot.mesh.position.addScaledVector(slot.velocity, step);

      if (slot.mesh.position.y < slot.groundY) {
        slot.mesh.position.y = slot.groundY;
        if (slot.bounceFactor > 0 && Math.abs(slot.velocity.y) > 0.8) {
          slot.velocity.y = -slot.velocity.y * slot.bounceFactor;
          slot.velocity.x *= 0.78;
          slot.velocity.z *= 0.78;
        } else {
          slot.velocity.y = 0;
        }
      }

      slot.mesh.rotation.x += slot.rotVel.x * step;
      slot.mesh.rotation.y += slot.rotVel.y * step;
      slot.mesh.rotation.z += slot.rotVel.z * step;

      const scale = THREE.MathUtils.lerp(slot.startScale, slot.endScale, t * t);
      slot.mesh.scale.setScalar(Math.max(0.01, scale));

      if (slot.fadeOut) {
        const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        slot.material.opacity = (slot.kind === 'dust' ? 0.55 : 1) * Math.max(0, alpha);
      }
    }
  }

  public clear(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();

    for (const geom of this.geometries) {
      geom.dispose();
    }
    for (const slot of this.slots) {
      slot.material.dispose();
    }
    this.geometries = [];
    this.slots = [];
  }
}
