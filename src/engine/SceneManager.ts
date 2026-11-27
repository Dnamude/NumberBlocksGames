import * as THREE from 'three';

interface CloudEntry {
  group: THREE.Group;
  speed: number;
  baseY: number;
  phase: number;
  angle: number;
  radius: number;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public sunLight: THREE.DirectionalLight;

  private hemiLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;
  private skyDome: THREE.Mesh;
  private rainbowGroup: THREE.Group;
  private mountainsGroup: THREE.Group;
  private clouds: CloudEntry[] = [];
  private cloudsGroup: THREE.Group;

  private readonly sunOffset = new THREE.Vector3(48, 72, 34);
  private readonly desiredCamPos = new THREE.Vector3();
  private readonly desiredLookAt = new THREE.Vector3();
  private readonly currentLookAt = new THREE.Vector3();
  private readonly tempVecA = new THREE.Vector3();
  private readonly tempVecB = new THREE.Vector3();
  private cameraInitialized = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#CBEFFF', 0.0018);

    const width = Math.max(window.visualViewport?.width || window.innerWidth, 1);
    const height = Math.max(window.visualViewport?.height || window.innerHeight, 1);
    const aspect = width / height;
    const initialPortraitFactor = THREE.MathUtils.clamp((1.0 - aspect) / 0.55, 0, 1);
    const initialFov = 58 + initialPortraitFactor * 14;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.3, 1400);
    this.camera.position.set(0, 64, -18);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Sunny Numberland lighting
    this.hemiLight = new THREE.HemisphereLight('#87CEFA', '#66BB6A', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#FFF5D6', 2.05);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    this.sunLight.shadow.camera.left = -45;
    this.sunLight.shadow.camera.right = 45;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -45;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new THREE.DirectionalLight('#FFE4B5', 0.55);
    this.fillLight.position.set(-40, 26, -38);
    this.scene.add(this.fillLight);

    // Sky dome
    this.skyDome = this.createSkyDome();
    this.scene.add(this.skyDome);

    // Rainbow arc across the Numberland horizon
    this.rainbowGroup = this.createRainbowArc();
    this.scene.add(this.rainbowGroup);

    // Distant snow-capped Numberland mountains
    this.mountainsGroup = this.createMountains();
    this.scene.add(this.mountainsGroup);

    // 18 stylized puffy 3D clouds
    this.cloudsGroup = new THREE.Group();
    this.createClouds(18);
    this.scene.add(this.cloudsGroup);
  }

  private createSkyDome(): THREE.Mesh {
    const geom = new THREE.SphereGeometry(850, 32, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color('#38BDF8') },
        midColor: { value: new THREE.Color('#7DD3FC') },
        horizonColor: { value: new THREE.Color('#E0F7FA') },
        groundColor: { value: new THREE.Color('#BCE8C7') },
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        varying vec3 vLocalPos;
        void main() {
          float h = vLocalPos.y;
          vec3 col;
          if (h >= 0.0) {
            float t1 = smoothstep(0.0, 0.28, h);
            float t2 = smoothstep(0.22, 0.85, h);
            col = mix(horizonColor, midColor, t1);
            col = mix(col, topColor, t2);
          } else {
            col = mix(horizonColor, groundColor, smoothstep(0.0, -0.35, h));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = -10;
    return mesh;
  }

  private createRainbowArc(): THREE.Group {
    const group = new THREE.Group();
    const colors = [
      '#AF52DE', // Violet (inner)
      '#5856D6', // Indigo
      '#00B4D8', // Cyan-Blue
      '#34C759', // Green
      '#FFCC00', // Yellow
      '#FF9500', // Orange
      '#FF3B30', // Red (outer)
    ];

    const innerBase = 172;
    const bandWidth = 4.6;

    colors.forEach((color, idx) => {
      const rInner = innerBase + idx * bandWidth;
      const rOuter = rInner + bandWidth + 0.12;
      const geom = new THREE.RingGeometry(rInner, rOuter, 84, 1, 0, Math.PI);
      const mat = new THREE.MeshBasicMaterial({
        color,
        fog: false,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const band = new THREE.Mesh(geom, mat);
      band.renderOrder = -5;
      group.add(band);
    });

    group.position.set(15, -60, 280);
    group.rotation.y = Math.PI * 0.04;
    return group;
  }

  private createMountains(): THREE.Group {
    const group = new THREE.Group();
    const mountainMat = new THREE.MeshStandardMaterial({
      color: '#6BB8A8',
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
    });
    const farMountainMat = new THREE.MeshStandardMaterial({
      color: '#88C8DA',
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.45,
      metalness: 0.05,
      flatShading: true,
    });

    const peakCount = 26;
    for (let i = 0; i < peakCount; i++) {
      const angle = (i / peakCount) * Math.PI * 2;
      const isFar = i % 2 === 0;
      const dist = isFar ? 470 + (i % 3) * 45 : 370 + (i % 4) * 30;
      const height = isFar ? 135 + ((i * 29) % 75) : 95 + ((i * 23) % 55);
      const radius = isFar ? 72 + ((i * 13) % 28) : 54 + ((i * 17) % 22);

      const peakGroup = new THREE.Group();
      const bodyGeom = new THREE.ConeGeometry(radius, height, 7);
      const body = new THREE.Mesh(bodyGeom, isFar ? farMountainMat : mountainMat);
      body.position.y = height * 0.5 - 35;
      body.rotation.y = i * 0.7;
      peakGroup.add(body);

      // Snow cap cone
      const capHeight = height * 0.34;
      const capRadius = radius * 0.35;
      const capGeom = new THREE.ConeGeometry(capRadius, capHeight, 7);
      const cap = new THREE.Mesh(capGeom, snowMat);
      cap.position.y = height - capHeight * 0.5 - 34.4;
      cap.rotation.y = i * 0.7;
      peakGroup.add(cap);

      peakGroup.position.set(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist + 250
      );
      group.add(peakGroup);
    }

    return group;
  }

  private createClouds(count: number): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#EBF8FF',
      emissiveIntensity: 0.25,
      roughness: 0.55,
      metalness: 0.0,
    });

    const puffGeom = new THREE.SphereGeometry(1, 14, 12);

    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffSpecs = [
        { x: 0, y: 0.4, z: 0, sx: 4.5, sy: 3.1, sz: 3.4 },
        { x: -3.6, y: -0.2, z: 0.4, sx: 3.3, sy: 2.4, sz: 2.8 },
        { x: 3.7, y: -0.1, z: -0.3, sx: 3.5, sy: 2.5, sz: 2.9 },
        { x: -1.6, y: 1.4, z: -0.5, sx: 2.8, sy: 2.3, sz: 2.5 },
        { x: 1.8, y: 1.2, z: 0.5, sx: 2.7, sy: 2.1, sz: 2.4 },
      ];

      for (const p of puffSpecs) {
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(p.x, p.y, p.z);
        puff.scale.set(p.sx, p.sy, p.sz);
        cloud.add(puff);
      }

      const scale = 1.8 + (i % 5) * 0.55;
      cloud.scale.setScalar(scale);

      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.15;
      const radius = 150 + (i % 6) * 48;
      const baseY = 95 + (i % 4) * 16;

      cloud.position.set(
        Math.cos(angle) * radius,
        baseY,
        Math.sin(angle) * radius + 120
      );

      this.cloudsGroup.add(cloud);
      this.clouds.push({
        group: cloud,
        speed: 0.012 + (i % 4) * 0.004,
        baseY,
        phase: i * 1.1,
        angle,
        radius,
      });
    }
  }

  public updateEnvironment(dt: number, time: number, focusPos: THREE.Vector3): void {
    if (this.disposed) return;

    // Keep sky dome and distant mountains centered around the camera/focus area
    this.skyDome.position.copy(this.camera.position);
    this.mountainsGroup.position.set(focusPos.x * 0.35, -18, focusPos.z * 0.35);
    this.rainbowGroup.position.set(focusPos.x * 0.65 + 15, focusPos.y - 115, focusPos.z + 280);

    // Move sun shadow frustum smoothly around focusPos
    this.sunLight.position.set(
      focusPos.x + this.sunOffset.x,
      focusPos.y + this.sunOffset.y,
      focusPos.z + this.sunOffset.z
    );
    this.sunLight.target.position.copy(focusPos);
    this.sunLight.target.updateMatrixWorld();

    // Gently drift clouds around the active area
    for (const c of this.clouds) {
      c.angle += c.speed * dt;
      const cx = focusPos.x * 0.45 + Math.cos(c.angle) * c.radius;
      const cz = focusPos.z * 0.55 + Math.sin(c.angle) * c.radius;
      const cy = c.baseY + Math.sin(time * 0.45 + c.phase) * 1.8;
      c.group.position.set(cx, cy, cz);
      c.group.lookAt(focusPos.x, cy, focusPos.z);
    }
  }

  public getAspect(): number {
    const aspect = this.camera?.aspect;
    return typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  }

  public getPortraitFactor(): number {
    return THREE.MathUtils.clamp((1.0 - this.getAspect()) / 0.55, 0, 1);
  }

  public setCameraFollow(
    targetPos: THREE.Vector3,
    targetForward: THREE.Vector3,
    dt: number,
    speedRatio: number,
    isAirborne: boolean
  ): void {
    if (this.disposed) return;

    const clampedSpeed = Math.max(0, Math.min(1.3, speedRatio));
    const portraitFactor = this.getPortraitFactor();
    const fwd = this.tempVecA.copy(targetForward);
    if (fwd.lengthSq() < 0.0001) {
      fwd.set(0, 0, 1);
    } else {
      fwd.normalize();
    }

    const baseDistance = 9.2 + clampedSpeed * 1.4;
    const baseHeight = 4.5 + (isAirborne ? 1.15 : 0) + clampedSpeed * 0.35;
    const followDist = baseDistance + portraitFactor * 3.8;
    const followHeight = baseHeight + portraitFactor * 1.4;

    this.desiredCamPos
      .copy(targetPos)
      .addScaledVector(fwd, -followDist);
    this.desiredCamPos.y += followHeight;

    const lookAhead = 7.5 + clampedSpeed * 3.0 + portraitFactor * 1.5;
    this.desiredLookAt
      .copy(targetPos)
      .addScaledVector(fwd, lookAhead);
    this.desiredLookAt.y += (isAirborne ? 1.85 : 1.35) + portraitFactor * 0.25;

    const posAlpha = 1 - Math.exp(-Math.min(dt, 0.1) * 9.5);
    const lookAlpha = 1 - Math.exp(-Math.min(dt, 0.1) * 12.0);

    if (!this.cameraInitialized) {
      this.camera.position.copy(this.desiredCamPos);
      this.currentLookAt.copy(this.desiredLookAt);
      this.cameraInitialized = true;
    } else {
      this.camera.position.lerp(this.desiredCamPos, posAlpha);
      this.currentLookAt.lerp(this.desiredLookAt, lookAlpha);
    }

    this.camera.lookAt(this.currentLookAt);

    // Dynamic Mario-Kart FOV kick scaled for wide road visibility on portrait & foldables
    const baseFov = 58 + portraitFactor * 14;
    const targetFov = baseFov + Math.min(1, clampedSpeed) * 9;
    const fovAlpha = 1 - Math.exp(-Math.min(dt, 0.1) * 7.0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, fovAlpha);
      this.camera.updateProjectionMatrix();
    }
  }

  public setCameraOrbit(
    center: THREE.Vector3,
    angle: number,
    radius: number,
    height: number,
    lookAtY = 1.2,
    adaptForPortrait = true
  ): void {
    if (this.disposed) return;

    const portraitFactor = adaptForPortrait ? this.getPortraitFactor() : 0;
    const effectiveRadius = radius * (1 + portraitFactor * 0.42);
    const effectiveHeight = height + portraitFactor * (height * 0.12);

    const x = center.x + Math.sin(angle) * effectiveRadius;
    const z = center.z + Math.cos(angle) * effectiveRadius;
    const y = center.y + effectiveHeight;

    this.camera.position.set(x, y, z);
    this.tempVecB.set(center.x, center.y + lookAtY, center.z);
    this.currentLookAt.copy(this.tempVecB);
    this.camera.lookAt(this.tempVecB);
    this.cameraInitialized = false;

    const orbitFov = 54 + portraitFactor * 6;
    if (Math.abs(this.camera.fov - orbitFov) > 0.1) {
      this.camera.fov = orbitFov;
      this.camera.updateProjectionMatrix();
    }
  }

  public render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  public resize(): void {
    if (this.disposed) return;
    const width = Math.max(window.visualViewport?.width || window.innerWidth, 1);
    const height = Math.max(window.visualViewport?.height || window.innerHeight, 1);
    this.camera.aspect = width / height;
    const portraitFactor = this.getPortraitFactor();
    const baseFov = 58 + portraitFactor * 14;
    this.camera.fov = baseFov;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.scene.traverse((obj) => {
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

    this.renderer.dispose();
  }
}
