import * as THREE from 'three';

function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas rendering context');
  }
  return { canvas, ctx };
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  options?: {
    repeatX?: number;
    repeatY?: number;
    wrapS?: THREE.Wrapping;
    wrapT?: THREE.Wrapping;
    anisotropy?: number;
    srgb?: boolean;
  }
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options?.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (options?.wrapS !== undefined) texture.wrapS = options.wrapS;
  if (options?.wrapT !== undefined) texture.wrapT = options.wrapT;
  if (options?.repeatX !== undefined && options?.repeatY !== undefined) {
    texture.repeat.set(options.repeatX, options.repeatY);
  }
  texture.anisotropy = options?.anisotropy ?? 8;
  texture.needsUpdate = true;
  return texture;
}

/** Deterministic pseudo-random helper so procedural textures never flicker. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Warm slate rally asphalt with crisp white dashed lane dividers,
 * subtle tarmac pebble grain, and clean edge lines.
 */
export function createRoadTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = mulberry32(1042);

  // Warm slate base gradient across width
  const baseGrad = ctx.createLinearGradient(0, 0, size, 0);
  baseGrad.addColorStop(0, '#3e4552');
  baseGrad.addColorStop(0.12, '#48505e');
  baseGrad.addColorStop(0.5, '#4e5766');
  baseGrad.addColorStop(0.88, '#48505e');
  baseGrad.addColorStop(1, '#3e4552');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle tire-track wear bands
  ctx.fillStyle = 'rgba(34, 39, 48, 0.18)';
  ctx.fillRect(size * 0.24, 0, size * 0.12, size);
  ctx.fillRect(size * 0.64, 0, size * 0.12, size);

  // Subtle tarmac pebble grain
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.7 + rand() * 1.6;
    const light = rand() > 0.5;
    ctx.fillStyle = light
      ? `rgba(180, 192, 210, ${0.06 + rand() * 0.09})`
      : `rgba(24, 28, 36, ${0.08 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp outer edge lines (warm white with subtle yellow shoulder accent)
  ctx.fillStyle = '#FFD54F';
  ctx.fillRect(10, 0, 8, size);
  ctx.fillRect(size - 18, 0, 8, size);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(24, 0, 12, size);
  ctx.fillRect(size - 36, 0, 12, size);

  // Crisp white dashed lane dividers (3 lanes -> 2 divider lines)
  const lanePositions = [size / 3, (size * 2) / 3];
  const dashCount = 4;
  const step = size / dashCount;
  const dashLen = step * 0.56;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  for (const lx of lanePositions) {
    for (let d = 0; d < dashCount; d++) {
      const y = d * step + (step - dashLen) * 0.5;
      ctx.beginPath();
      ctx.roundRect(lx - 5, y, 10, dashLen, 5);
      ctx.fill();
    }
  }

  return finalizeTexture(canvas, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 1,
    repeatY: 16,
    anisotropy: 8,
  });
}

/**
 * Vibrant sunny Numberland meadow grass with soft mown stripes
 * and subtle clover / blade texture.
 */
export function createGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = mulberry32(2026);

  // Sunny meadow base
  ctx.fillStyle = '#6BCB4B';
  ctx.fillRect(0, 0, size, size);

  // Soft mown lawn stripes
  const stripeCount = 4;
  const stripeW = size / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(139, 224, 82, 0.34)' : 'rgba(67, 160, 71, 0.24)';
    ctx.fillRect(i * stripeW, 0, stripeW, size);
  }

  // Soft organic sun-dappled blotches
  for (let i = 0; i < 45; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 24 + rand() * 48;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
    const bright = rand() > 0.45;
    grad.addColorStop(0, bright ? 'rgba(198, 255, 118, 0.16)' : 'rgba(46, 125, 50, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle grass blades
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const h = 4 + rand() * 8;
    const tilt = (rand() - 0.5) * 4;
    ctx.strokeStyle =
      rand() > 0.5 ? 'rgba(165, 240, 100, 0.38)' : 'rgba(46, 138, 56, 0.32)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tilt, y - h);
    ctx.stroke();
  }

  // Tiny playful clovers & daisy dots
  for (let i = 0; i < 36; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    ctx.fillStyle = 'rgba(56, 142, 60, 0.45)';
    for (let l = 0; l < 3; l++) {
      const a = (l * Math.PI * 2) / 3 + rand() * 0.4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 3.5, cy + Math.sin(a) * 3.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rand() > 0.72) {
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDD835';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return finalizeTexture(canvas, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 14,
    repeatY: 40,
    anisotropy: 4,
  });
}

/**
 * Crisp black-and-white racing checkered flag pattern.
 */
export function createCheckerTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const cells = 8;
  const cellSize = size / cells;

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const isWhite = (row + col) % 2 === 0;
      ctx.fillStyle = isWhite ? '#FAFAFA' : '#1E2229';
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }

  // Subtle sheen stripe across texture
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  return finalizeTexture(canvas, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 2,
    repeatY: 1,
    anisotropy: 8,
  });
}

/**
 * Warm toy-box wooden planks with painted yellow/white chevron boost arrows.
 */
export function createWoodRampTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = mulberry32(777);

  const plankCount = 5;
  const plankW = size / plankCount;

  for (let p = 0; p < plankCount; p++) {
    const px = p * plankW;
    const grad = ctx.createLinearGradient(px, 0, px + plankW, 0);
    grad.addColorStop(0, '#BA7B3E');
    grad.addColorStop(0.35, '#D69452');
    grad.addColorStop(0.7, '#C98647');
    grad.addColorStop(1, '#A96B31');
    ctx.fillStyle = grad;
    ctx.fillRect(px, 0, plankW, size);

    // Wood grain lines
    for (let g = 0; g < 24; g++) {
      const gx = px + 6 + rand() * (plankW - 12);
      ctx.strokeStyle =
        rand() > 0.5 ? 'rgba(92, 52, 18, 0.16)' : 'rgba(255, 224, 178, 0.12)';
      ctx.lineWidth = 1.2 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + (rand() - 0.5) * 14,
        size * 0.33,
        gx + (rand() - 0.5) * 14,
        size * 0.66,
        gx,
        size
      );
      ctx.stroke();
    }

    // Plank seam
    ctx.fillStyle = '#6D421B';
    ctx.fillRect(px, 0, 4, size);

    // Toy-box nail heads top & bottom
    for (const ny of [26, size - 26]) {
      ctx.fillStyle = '#4E342E';
      ctx.beginPath();
      ctx.arc(px + plankW * 0.5, ny, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#B0BEC5';
      ctx.beginPath();
      ctx.arc(px + plankW * 0.5 - 1, ny - 1, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Painted yellow & white boost chevrons pointing forward (upwards on canvas)
  const chevronYs = [size * 0.72, size * 0.46, size * 0.2];
  for (let i = 0; i < chevronYs.length; i++) {
    const cy = chevronYs[i];
    const isGold = i % 2 === 0;

    // Dark drop shadow under painted chevron
    ctx.save();
    ctx.strokeStyle = 'rgba(62, 39, 35, 0.45)';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.18, cy + 54);
    ctx.lineTo(size * 0.5, cy + 4);
    ctx.lineTo(size * 0.82, cy + 54);
    ctx.stroke();

    // Outer white border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(size * 0.18, cy + 50);
    ctx.lineTo(size * 0.5, cy);
    ctx.lineTo(size * 0.82, cy + 50);
    ctx.stroke();

    // Inner bright yellow/gold core
    ctx.strokeStyle = isGold ? '#FFD600' : '#FFAB00';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(size * 0.18, cy + 50);
    ctx.lineTo(size * 0.5, cy);
    ctx.lineTo(size * 0.82, cy + 50);
    ctx.stroke();
    ctx.restore();
  }

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
}

/**
 * Playful cartoon mud puddle texture with glossy highlights & ripples.
 */
export function createMudTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = mulberry32(909);

  ctx.clearRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;

  // Helper for organic lumpy puddle silhouette
  const drawBlob = (radiusScale: number, offsetX = 0, offsetY = 0) => {
    ctx.beginPath();
    const lobes = 18;
    for (let i = 0; i <= lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      const wobble = 0.84 + 0.14 * Math.sin(a * 3 + 0.7) + 0.08 * Math.cos(a * 5 - 1.1);
      const r = size * 0.42 * radiusScale * wobble;
      const x = cx + offsetX + Math.cos(a) * r;
      const y = cy + offsetY + Math.sin(a) * r * 0.92;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Outer darker mud rim
  drawBlob(1.0);
  ctx.fillStyle = '#4E342E';
  ctx.fill();

  // Main glossy chocolate-mud fill
  drawBlob(0.93);
  const mudGrad = ctx.createRadialGradient(cx - 35, cy - 35, 25, cx, cy, size * 0.44);
  mudGrad.addColorStop(0, '#8D5B3C');
  mudGrad.addColorStop(0.55, '#6D432B');
  mudGrad.addColorStop(1, '#543321');
  ctx.fillStyle = mudGrad;
  ctx.fill();

  // Concentric cartoon ripple rings
  ctx.strokeStyle = 'rgba(161, 110, 78, 0.5)';
  ctx.lineWidth = 6;
  drawBlob(0.72, -6, -4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(196, 146, 108, 0.42)';
  ctx.lineWidth = 4;
  drawBlob(0.46, 10, 8);
  ctx.stroke();

  // Playful little mud splat droplets around edge
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.35;
    const dist = size * (0.43 + rand() * 0.04);
    const dr = 7 + rand() * 9;
    ctx.fillStyle = '#6D432B';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * 0.92, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glossy specular shine arcs
  ctx.fillStyle = 'rgba(255, 243, 224, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - 64, cy - 72, 46, 18, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 248, 225, 0.48)';
  ctx.beginPath();
  ctx.ellipse(cx + 55, cy + 48, 28, 12, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - 22, cy - 92, 11, 0, Math.PI * 2);
  ctx.fill();

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 4,
  });
}

/**
 * Crisp white dice pips on colored background for Numberblock Six's dice blocks (1-6).
 */
export function createDiceFaceTexture(dots: number, bgHex: string): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);

  // Colored dice face base
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle recessed inner bevel frame
  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.7
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle inner rounded edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(12, 12, size - 24, size - 24, 28);
  ctx.stroke();

  const clamped = Math.max(1, Math.min(6, Math.round(dots)));
  const lo = size * 0.27;
  const mid = size * 0.5;
  const hi = size * 0.73;

  const pipLayouts: Record<number, Array<[number, number]>> = {
    1: [[mid, mid]],
    2: [
      [lo, lo],
      [hi, hi],
    ],
    3: [
      [lo, lo],
      [mid, mid],
      [hi, hi],
    ],
    4: [
      [lo, lo],
      [hi, lo],
      [lo, hi],
      [hi, hi],
    ],
    5: [
      [lo, lo],
      [hi, lo],
      [mid, mid],
      [lo, hi],
      [hi, hi],
    ],
    6: [
      [lo, lo],
      [hi, lo],
      [lo, mid],
      [hi, mid],
      [lo, hi],
      [hi, hi],
    ],
  };

  const pips = pipLayouts[clamped] ?? pipLayouts[1];
  const pipRadius = clamped === 1 ? 30 : 21;

  for (const [px, py] of pips) {
    // Pip shadow
    ctx.fillStyle = 'rgba(35, 10, 70, 0.35)';
    ctx.beginPath();
    ctx.arc(px + 2, py + 4, pipRadius, 0, Math.PI * 2);
    ctx.fill();

    // Crisp white pip
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px, py, pipRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tiny glossy pip highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(px - pipRadius * 0.25, py - pipRadius * 0.25, pipRadius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 4,
  });
}

/**
 * Crisp border-trimmed block texture (used for Ten's white blocks with red borders).
 */
export function createBorderedBlockTexture(
  fillHex: string,
  borderHex: string
): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);

  ctx.fillStyle = borderHex;
  ctx.fillRect(0, 0, size, size);

  const margin = 24;
  ctx.fillStyle = fillHex;
  ctx.beginPath();
  ctx.roundRect(margin, margin, size - margin * 2, size - margin * 2, 22);
  ctx.fill();

  // Subtle plastic inner bevel highlight
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 4;
  ctx.stroke();

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 4,
  });
}

function hexRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return 0.5;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Bold Fredoka/rounded racing numeral inside a high-contrast Mario-Kart style medallion.
 */
export function createNumberBadgeTexture(
  num: number,
  bgHex: string,
  _fgHex = '#1E2430'
): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.clearRect(0, 0, size, size);

  const lum = hexRelativeLuminance(bgHex);
  const isWhiteMedallion = lum >= 0.85;
  const isBrightYellow = lum >= 0.55 && lum < 0.85;

  const outerRingColor = isWhiteMedallion ? '#E53935' : '#FFFFFF';
  const innerFillColor = isWhiteMedallion ? '#FFFFFF' : bgHex;

  // Crisp outer racing ring
  ctx.fillStyle = outerRingColor;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2);
  ctx.fill();

  // Subtle dark outer rim keyline so white rings stand out against bright skies
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.24)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Bold inner colored medallion
  ctx.fillStyle = innerFillColor;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.385, 0, Math.PI * 2);
  ctx.fill();

  // Subtle inner bevel ring
  ctx.strokeStyle = isWhiteMedallion ? 'rgba(229, 57, 53, 0.28)' : 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Subtle glossy plastic highlight arc at top of medallion (behind numeral so text stays crisp)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.375, 0, Math.PI * 2);
  ctx.clip();
  const shine = ctx.createLinearGradient(0, size * 0.1, 0, size * 0.48);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(cx, size * 0.27, size * 0.32, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Huge bold high-contrast racing numeral (always >= 7:1 effective contrast)
  const label = String(num);
  const fontSize = num >= 10 ? 124 : 152;
  ctx.font = `900 ${fontSize}px "Fredoka", "Nunito", "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const textY = cy + 6;

  if (isWhiteMedallion) {
    // Numberblock 10: crisp red numeral on white medallion
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 6;
    ctx.strokeText(label, cx, textY);
    ctx.restore();

    ctx.fillStyle = '#E53935';
    ctx.fillText(label, cx, textY);
  } else if (isBrightYellow) {
    // Bright yellow (e.g. Three #FDD835): dark navy #1E293B numeral for ultra-crisp contrast
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#1E293B';
    ctx.fillText(label, cx, textY);
    ctx.restore();
  } else {
    // Vibrant colored Numberblocks (1, 2, 4, 5, 6, 7, 8, 9): crisp white numeral + dark navy outline & drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 14;
    ctx.strokeText(label, cx, textY);
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, cx, textY);
  }

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
}

/**
 * Floating glossy numeral sprite with crisp white outline & drop shadow
 * positioned above each Numberblock's head ("Numberling").
 */
export function createNumberlingSprite(num: number, colorHex: string): THREE.Sprite {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size * 0.5;
  const cy = size * 0.54;

  ctx.clearRect(0, 0, size, size);

  const label = String(num);
  const fontSize = num >= 10 ? 148 : 172;
  ctx.font = `900 ${fontSize}px "Fredoka", "Nunito", "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft dark drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 30;
  ctx.strokeText(label, cx, cy);
  ctx.restore();

  // Crisp white outline
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 28;
  ctx.strokeText(label, cx, cy);

  // Subtle dark inner keyline for high contrast (especially for white #10)
  ctx.strokeStyle = 'rgba(20, 24, 35, 0.28)';
  ctx.lineWidth = 10;
  ctx.strokeText(label, cx, cy);

  // Vivid glossy gradient fill
  const fillGrad = ctx.createLinearGradient(0, cy - fontSize * 0.45, 0, cy + fontSize * 0.45);
  fillGrad.addColorStop(0, colorHex);
  fillGrad.addColorStop(0.65, colorHex);
  fillGrad.addColorStop(1, colorHex === '#FFFFFF' ? '#FFE5E5' : colorHex);
  ctx.fillStyle = colorHex === '#FFFFFF' ? '#E53935' : fillGrad;
  ctx.fillText(label, cx, cy);

  // Top highlight sheen inside numeral
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sheen = ctx.createLinearGradient(0, 20, 0, size * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.48)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size * 0.55);
  ctx.restore();

  const texture = finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 4,
  });

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.68, 0.68, 1);
  return sprite;
}

/**
 * Giant painted road-gate numeral decal texture.
 */
export function createTrackNumberDecalTexture(num: number): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.clearRect(0, 0, size, size);

  const palette: Record<number, string> = {
    1: '#E53935',
    2: '#FB8C00',
    3: '#FDD835',
    4: '#43A047',
    5: '#29B6F6',
    6: '#7E57C2',
    7: '#AB47BC',
    8: '#EC407A',
    9: '#9E9E9E',
    10: '#E53935',
  };
  const color = palette[num] ?? '#29B6F6';

  // Painted circular road medallion backing
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 18;
  ctx.setLineDash([34, 18]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Giant bold numeral
  const label = String(num);
  const fontSize = num >= 10 ? 270 : 320;
  ctx.font = `900 ${fontSize}px "Fredoka", "Nunito", "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Drop shadow on tarmac
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.fillText(label, cx + 6, cy + 16);

  // Thick white road-paint outline
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 36;
  ctx.strokeText(label, cx, cy + 6);

  // Vivid colored fill
  ctx.fillStyle = color;
  ctx.fillText(label, cx, cy + 6);

  return finalizeTexture(canvas, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
}
