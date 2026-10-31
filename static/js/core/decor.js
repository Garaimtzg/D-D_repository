// Decoración de los escenarios. Tres capas que no cambian las reglas del tablero, solo su aspecto:
//   1. Acabado del terreno: manchas de color a gran escala (ruido suave) que rompen la repetición de las casillas.
//   2. Adornos: detalles libres, sin casilla fija, con giro y escala (grietas, matas, hojas, charcos, telarañas…).
//      Salen solos según el terreno («adornos automáticos», con intensidad y semilla: se adaptan al repintar) y
//      también se ponen a mano con el pincel de adornos del editor (lista `decals` del escenario).
//   3. Ambiente: un tono de color para todo el escenario (cálido, frío, sombrío…) y una viñeta en los bordes.
// Campos del escenario: autoDecor ('ninguna' | 'sutil' | 'normal' | 'recargada'), decorSeed (número),
// decals ([{ k, x, y, a, s }]: código, posición en casillas, giro en grados y escala), mood, vignette y grid.
import { cellRand, noise2, shade, circle, ellipse, seg, dots, blobPoly } from './paint.js';

export const DECOR_DEFAULTS = { autoDecor: 'normal', decorSeed: 0, mood: 'natural', vignette: false, grid: 'linea' };
export const DECOR_LEVEL = { ninguna: 0, sutil: 0.5, normal: 1, recargada: 1.8 };
export const MAX_DECALS = 4000;

// ------------------------------------------------------------------ 1. acabado del terreno
// Cada familia de terrenos tiene un tono claro y uno oscuro; el ruido decide dónde se aclara y dónde se oscurece.
const TINT_FAMILIES = [
  ['.cSDobXJ%G', '#fff2dc', '#140e0a', 0.15], // piedra
  ['wy=m', '#ffd9a0', '#241205', 0.13], // madera y alfombra
  [',j;uKh', '#e2f07a', '#0c2208', 0.22], // hierba y maleza
  [':erfp', '#ecc994', '#241406', 0.17], // tierra y barro
  ['sq', '#fff1c8', '#6a4a1e', 0.15], // arena
  ['nki', '#ffffff', '#4f6f92', 0.15], // nieve y hielo
  ['~W', '#a6e4ff', '#03102a', 0.22], // agua
  ['l', '#ffe27a', '#3a0800', 0.28],
  ['A', '#e6ff94', '#0a3008', 0.22],
  ['P', '#c79aff', '#0e0716', 0.22],
  ['a', '#d6d6d6', '#0e0e0e', 0.16],
];
const TINT = {};
for (const [codes, light, dark, k] of TINT_FAMILIES) for (const ch of codes) TINT[ch] = { light: hexRgb(light), dark: hexRgb(dark), k };
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

const tintCache = new Map();
const TINT_PX = 4; // píxeles por casilla: el lienzo se estira con suavizado y las manchas quedan sin bordes
// Lienzo pequeño con las manchas de todo el escenario; los muros, el abismo y «sin terreno» quedan transparentes.
// codeAt(x, y), si se da, dice qué terreno se ve en cada punto (con las orillas suaves); si no, el de la casilla.
export function tintLayer(sc, isWall, codeAt = null) {
  const seed = (sc.decorSeed | 0) + 7;
  const key = `${sc.cols}x${sc.rows}:${seed}:${sc.tiles}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const W = sc.cols * TINT_PX; const H = sc.rows * TINT_PX;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / TINT_PX; const y = (py + 0.5) / TINT_PX;
      const cell = sc.tiles[Math.floor(py / TINT_PX) * sc.cols + Math.floor(px / TINT_PX)];
      if (isWall(cell)) continue;
      const code = codeAt ? codeAt(x, y) : cell;
      const t = TINT[code];
      if (!t) continue;
      // manchas grandes (unas 6 casillas) y un poco de detalle (unas 2)
      const n = noise2(x / 6, y / 6, seed) * 0.75 + noise2(x / 1.8, y / 1.8, seed + 3) * 0.25;
      const v = Math.max(-1, Math.min(1, (n - 0.5) * 2.6));
      const [r, g, b] = v > 0 ? t.light : t.dark;
      const i = (py * W + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      d[i + 3] = Math.round(Math.min(1, Math.abs(v)) * t.k * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  tintCache.set(key, cv);
  if (tintCache.size > 12) tintCache.delete(tintCache.keys().next().value);
  return cv;
}

// ------------------------------------------------------------------ 2. adornos
// Cada pintor dibuja centrado en (0, 0) con casillas de `s` píxeles; quien lo llama ya ha girado y escalado.
// Tamaño típico: de 0,1 a 0,4 casillas de radio.
const leafColors = ['#b5651d', '#d4a017', '#8b3a1a', '#a0522d', '#c97c2a', '#7a8a2a'];
function strokeCrack(ctx, s, rand, len) {
  const pts = [[-len / 2, (rand() - 0.5) * s * 0.05]];
  for (let i = 1; i <= 5; i++) pts.push([-len / 2 + (len * i) / 5, (rand() - 0.5) * s * 0.12]);
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.save(); ctx.translate(s * 0.012, s * 0.012); path(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = 'rgba(15,12,9,.62)'; ctx.lineWidth = Math.max(0.7, s * 0.018);
  path(); ctx.stroke();
  return pts;
}
function stone(ctx, x, y, r, rand, base = '#8f897f') {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  blobPoly(ctx, x + r * 0.18, y + r * 0.28, r, 7, rand, 0.2); ctx.fill();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, shade(base, 0.25)); g.addColorStop(1, shade(base, -0.3));
  ctx.fillStyle = g;
  blobPoly(ctx, x, y, r, 7, rand, 0.25); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ellipse(ctx, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.18, -0.6);
}
function blade(ctx, x, y, len, lean, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len); ctx.stroke();
}

export const DECALS = {
  // ---------------------------------------------------------------- suelo
  grieta(ctx, s, rand) {
    const pts = strokeCrack(ctx, s, rand, s * (0.5 + rand() * 0.3));
    const [bx, by] = pts[2 + Math.floor(rand() * 2)];
    ctx.strokeStyle = 'rgba(15,12,9,.5)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    seg(ctx, bx, by, bx + s * 0.12, by + (rand() < 0.5 ? -1 : 1) * s * 0.14);
  },
  guijarros(ctx, s, rand) {
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) stone(ctx, (rand() - 0.5) * s * 0.4, (rand() - 0.5) * s * 0.4, s * (0.025 + rand() * 0.03), rand, ['#8f897f', '#7a7268', '#a39c90'][i % 3]);
  },
  piedra(ctx, s, rand) {
    stone(ctx, 0, 0, s * (0.09 + rand() * 0.05), rand, '#857f75');
    stone(ctx, s * 0.12, s * 0.06, s * 0.035, rand, '#97907f');
  },
  suciedad(ctx, s, rand) {
    const R = s * (0.22 + rand() * 0.12);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(40,28,16,.22)'); g.addColorStop(1, 'rgba(40,28,16,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.scale(1, 0.7); circle(ctx, 0, 0, R); ctx.restore();
    dots(ctx, -R / 2, -R / 2, R, rand, 5, ['rgba(30,20,10,.25)'], 0.02, 0.05);
  },
  humedad(ctx, s, rand) {
    const R = s * (0.24 + rand() * 0.1);
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, 'rgba(20,30,35,.28)'); g.addColorStop(0.75, 'rgba(20,30,35,.16)'); g.addColorStop(1, 'rgba(20,30,35,0)');
    ctx.fillStyle = g;
    blobPoly(ctx, 0, 0, R, 9, rand, 0.3); ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,210,.08)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    blobPoly(ctx, 0, 0, R * 0.8, 9, rand, 0.25); ctx.stroke();
  },
  charquito(ctx, s, rand) {
    const R = s * (0.14 + rand() * 0.08);
    ctx.fillStyle = 'rgba(25,30,30,.35)';
    blobPoly(ctx, 0, 0, R * 1.12, 10, rand, 0.25); ctx.fill();
    const g = ctx.createLinearGradient(-R, -R, R, R);
    g.addColorStop(0, 'rgba(120,160,185,.75)'); g.addColorStop(1, 'rgba(40,70,95,.75)');
    ctx.fillStyle = g;
    blobPoly(ctx, 0, 0, R, 10, rand, 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ellipse(ctx, -R * 0.3, -R * 0.3, R * 0.35, R * 0.08, -0.5);
  },
  escombro(ctx, s, rand) {
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * s * 0.45; const y = (rand() - 0.5) * s * 0.35; const r = s * (0.03 + rand() * 0.045);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; blobPoly(ctx, x + r * 0.25, y + r * 0.35, r, 5, rand, 0.4); ctx.fill();
      ctx.fillStyle = shade('#8d877c', (rand() - 0.5) * 0.4); blobPoly(ctx, x, y, r, 5, rand, 0.4, rand()); ctx.fill();
    }
    dots(ctx, -s * 0.25, -s * 0.2, s * 0.5, rand, 8, ['rgba(160,150,135,.6)', 'rgba(90,84,76,.6)'], 0.006, 0.014);
  },
  huellas(ctx, s, rand) {
    ctx.fillStyle = 'rgba(30,20,10,.3)';
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.3 + i * s * 0.2; const y = (i % 2 ? 1 : -1) * s * 0.06;
      ellipse(ctx, x, y, s * 0.055, s * 0.028, 0);
      ellipse(ctx, x - s * 0.075, y, s * 0.025, s * 0.022, 0);
    }
  },
  // -------------------------------------------------------- mazmorra y hogar
  astillas(ctx, s, rand) {
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate((rand() - 0.5) * s * 0.4, (rand() - 0.5) * s * 0.3); ctx.rotate(rand() * Math.PI);
      ctx.fillStyle = shade('#a07040', (rand() - 0.5) * 0.3);
      const L = s * (0.06 + rand() * 0.08);
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, -s * 0.012); ctx.lineTo(L * 0.8, s * 0.014); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },
  paja(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = (rand() - 0.5) * 1.2; const L = s * (0.08 + rand() * 0.12);
      const x = (rand() - 0.5) * s * 0.4; const y = (rand() - 0.5) * s * 0.3;
      ctx.strokeStyle = ['#d9b44a', '#c49a3a', '#e8cc70'][i % 3]; ctx.lineWidth = Math.max(0.6, s * 0.012);
      seg(ctx, x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L);
    }
  },
  papeles(ctx, s, rand) {
    for (let i = 0; i < 2; i++) {
      ctx.save(); ctx.translate((i - 0.5) * s * 0.16, (rand() - 0.5) * s * 0.1); ctx.rotate((rand() - 0.5) * 1.2);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-s * 0.08 + s * 0.012, -s * 0.1 + s * 0.018, s * 0.16, s * 0.2);
      ctx.fillStyle = i ? '#efe3c2' : '#e6d6ad'; ctx.fillRect(-s * 0.08, -s * 0.1, s * 0.16, s * 0.2);
      ctx.strokeStyle = 'rgba(60,40,20,.45)'; ctx.lineWidth = Math.max(0.5, s * 0.008);
      for (let k = 0; k < 5; k++) seg(ctx, -s * 0.055, -s * 0.065 + k * s * 0.033, s * (0.02 + rand() * 0.035), -s * 0.065 + k * s * 0.033);
      ctx.restore();
    }
  },
  monedas(ctx, s, rand) {
    const n = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * s * 0.3; const y = (rand() - 0.5) * s * 0.25;
      ctx.fillStyle = '#7a5810'; circle(ctx, x + s * 0.008, y + s * 0.012, s * 0.035);
      ctx.fillStyle = rand() < 0.2 ? '#c0c4c8' : '#e9be4a'; circle(ctx, x, y, s * 0.032);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, x - s * 0.01, y - s * 0.01, s * 0.01);
    }
  },
  cera(ctx, s, rand) {
    ctx.fillStyle = 'rgba(240,232,210,.85)';
    blobPoly(ctx, 0, 0, s * 0.11, 9, rand, 0.35); ctx.fill();
    ctx.fillStyle = '#f6efdc'; circle(ctx, 0, 0, s * 0.04);
    ctx.fillStyle = '#2a2420'; circle(ctx, 0, 0, s * 0.008);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(240,232,210,.8)'; circle(ctx, (rand() - 0.5) * s * 0.3, (rand() - 0.5) * s * 0.3, s * 0.015); }
  },
  huesos(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.save(); ctx.translate((i - 0.5) * s * 0.12, (rand() - 0.5) * s * 0.12); ctx.rotate(rand() * Math.PI);
      const L = s * (0.1 + rand() * 0.06);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, s * 0.035); seg(ctx, -L + 1, 1.5, L + 1, 1.5);
      ctx.strokeStyle = '#e4dccb'; ctx.lineWidth = Math.max(1, s * 0.028); seg(ctx, -L, 0, L, 0);
      ctx.fillStyle = '#e4dccb';
      for (const e of [-L, L]) { circle(ctx, e, -s * 0.014, s * 0.018); circle(ctx, e, s * 0.014, s * 0.018); }
      ctx.restore();
    }
  },
  telarana(ctx, s) {
    // en una esquina: nace en (0, 0) y se abre hacia +x, +y (se gira para cada esquina)
    const R = s * 0.48;
    ctx.strokeStyle = 'rgba(235,235,235,.5)'; ctx.lineWidth = Math.max(0.5, s * 0.008);
    for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); seg(ctx, 0, 0, Math.cos(a) * R, Math.sin(a) * R); }
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let k = 0; k <= 4; k++) {
        const a = (k / 4) * (Math.PI / 2); const rr = (R * ring) / 4.3;
        const x = Math.cos(a) * rr; const y = Math.sin(a) * rr;
        if (!k) ctx.moveTo(x, y); else { const m = (k - 0.5) / 4 * (Math.PI / 2); ctx.quadraticCurveTo(Math.cos(m) * rr * 0.86, Math.sin(m) * rr * 0.86, x, y); }
      }
      ctx.stroke();
    }
  },
  sangre(ctx, s, rand) {
    ctx.fillStyle = 'rgba(105,8,8,.8)';
    blobPoly(ctx, 0, 0, s * (0.1 + rand() * 0.05), 12, rand, 0.45); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2; const d = s * (0.14 + rand() * 0.16);
      ctx.fillStyle = 'rgba(120,10,10,.75)';
      circle(ctx, Math.cos(a) * d, Math.sin(a) * d, s * (0.008 + rand() * 0.02));
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ellipse(ctx, -s * 0.03, -s * 0.03, s * 0.04, s * 0.015, -0.5);
  },
  vino(ctx, s, rand) {
    const R = s * (0.1 + rand() * 0.05);
    ctx.fillStyle = 'rgba(90,15,45,.28)';
    blobPoly(ctx, 0, 0, R, 10, rand, 0.25); ctx.fill();
    ctx.strokeStyle = 'rgba(80,10,40,.45)'; ctx.lineWidth = Math.max(0.6, s * 0.014);
    ctx.beginPath(); ctx.arc(R * 0.6, R * 0.2, R * 0.55, 0, Math.PI * 1.6); ctx.stroke();
  },
  quemadura(ctx, s, rand) {
    const R = s * (0.24 + rand() * 0.1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(10,8,6,.75)'); g.addColorStop(0.5, 'rgba(20,14,10,.45)'); g.addColorStop(1, 'rgba(20,14,10,0)');
    ctx.fillStyle = g;
    blobPoly(ctx, 0, 0, R, 11, rand, 0.3); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = rand() < 0.5 ? 'rgba(255,120,40,.7)' : 'rgba(255,190,90,.6)'; circle(ctx, (rand() - 0.5) * R, (rand() - 0.5) * R, s * 0.01); }
  },
  // ------------------------------------------------------------- naturaleza
  mata(ctx, s, rand) {
    ctx.lineCap = 'round';
    const n = 7 + Math.floor(rand() * 4);
    const greens = ['#5f9a3a', '#4a8030', '#7cb04a', '#3c6a26'];
    ctx.fillStyle = 'rgba(20,40,10,.25)'; ellipse(ctx, 0, s * 0.02, s * 0.1, s * 0.05);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * s * 0.12;
      blade(ctx, x, s * 0.03, s * (0.1 + rand() * 0.1), (rand() - 0.5) * s * 0.22, Math.max(0.7, s * 0.016), greens[i % greens.length]);
    }
  },
  hierba_alta(ctx, s, rand) {
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(15,35,8,.3)'; ellipse(ctx, 0, s * 0.04, s * 0.16, s * 0.07);
    for (let i = 0; i < 14; i++) {
      const x = (rand() - 0.5) * s * 0.2;
      blade(ctx, x, s * 0.05, s * (0.18 + rand() * 0.14), (rand() - 0.5) * s * 0.3, Math.max(0.8, s * 0.02), ['#6a9a38', '#527f2c', '#8ab550', '#3f6a22'][i % 4]);
    }
    if (rand() < 0.5) { ctx.fillStyle = '#c9b46a'; for (let i = 0; i < 3; i++) ellipse(ctx, (rand() - 0.5) * s * 0.3, -s * (0.15 + rand() * 0.1), s * 0.015, s * 0.035, rand()); }
  },
  flores_silvestres(ctx, s, rand) {
    const pal = [['#f4e7a1', '#d9a400'], ['#ffffff', '#f2c14e'], ['#e9a3c9', '#b0306a'], ['#9db8ff', '#3a5ad8'], ['#ff9a3c', '#a83a0a']];
    const [petal, heart] = pal[Math.floor(rand() * pal.length)];
    for (let i = 0; i < 6; i++) {
      const x = (rand() - 0.5) * s * 0.35; const y = (rand() - 0.5) * s * 0.3; const r = s * (0.016 + rand() * 0.012);
      ctx.fillStyle = 'rgba(40,80,25,.5)'; circle(ctx, x + r * 0.4, y + r * 0.6, r * 1.6);
      ctx.fillStyle = petal;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75); }
      ctx.fillStyle = heart; circle(ctx, x, y, r * 0.6);
    }
  },
  trebol(ctx, s, rand) {
    for (let i = 0; i < 7; i++) {
      const x = (rand() - 0.5) * s * 0.3; const y = (rand() - 0.5) * s * 0.25; const r = s * 0.022;
      ctx.fillStyle = rand() < 0.5 ? '#5aa03a' : '#4a8a30';
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + rand(); circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.9); }
    }
  },
  hojas(ctx, s, rand) {
    const n = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.translate((rand() - 0.5) * s * 0.45, (rand() - 0.5) * s * 0.4); ctx.rotate(rand() * Math.PI * 2);
      const L = s * (0.045 + rand() * 0.03);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ellipse(ctx, s * 0.008, s * 0.01, L, L * 0.5);
      ctx.fillStyle = leafColors[Math.floor(rand() * leafColors.length)]; ellipse(ctx, 0, 0, L, L * 0.5);
      ctx.strokeStyle = 'rgba(60,30,10,.5)'; ctx.lineWidth = Math.max(0.4, s * 0.006); seg(ctx, -L, 0, L, 0);
      ctx.restore();
    }
  },
  ramitas(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate((rand() - 0.5) * s * 0.3, (rand() - 0.5) * s * 0.3); ctx.rotate(rand() * Math.PI);
      const L = s * (0.1 + rand() * 0.08);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(0.8, s * 0.022); seg(ctx, -L + 1, 1.5, L + 1, 1.5);
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(0.7, s * 0.018); seg(ctx, -L, 0, L, 0);
      ctx.lineWidth = Math.max(0.5, s * 0.01); seg(ctx, L * 0.2, 0, L * 0.5, -s * 0.05);
      ctx.restore();
    }
  },
  setitas(ctx, s, rand) {
    const red = rand() < 0.4;
    for (let i = 0; i < 4; i++) {
      const x = (rand() - 0.5) * s * 0.25; const y = (rand() - 0.5) * s * 0.2; const r = s * (0.025 + rand() * 0.025);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; circle(ctx, x + r * 0.3, y + r * 0.45, r);
      ctx.fillStyle = red ? '#b5332a' : shade('#b08a5a', (rand() - 0.5) * 0.3); circle(ctx, x, y, r);
      ctx.fillStyle = red ? '#f4ecd8' : 'rgba(255,240,210,.35)';
      if (red) { circle(ctx, x - r * 0.3, y - r * 0.2, r * 0.2); circle(ctx, x + r * 0.3, y + r * 0.1, r * 0.15); } else circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.35);
    }
  },
  musgo(ctx, s, rand) {
    dots(ctx, -s * 0.2, -s * 0.15, s * 0.4, rand, 16, ['rgba(70,110,40,.75)', 'rgba(45,80,28,.75)', 'rgba(95,135,55,.7)'], 0.02, 0.05);
    dots(ctx, -s * 0.15, -s * 0.12, s * 0.3, rand, 6, ['rgba(190,220,130,.35)'], 0.008, 0.015);
  },
  raiz(ctx, s, rand) {
    ctx.lineCap = 'round';
    const path = (dx) => { ctx.beginPath(); ctx.moveTo(-s * 0.35 + dx, (rand() - 0.5) * s * 0.1); ctx.bezierCurveTo(-s * 0.1 + dx, -s * 0.15, s * 0.1 + dx, s * 0.15, s * 0.35 + dx, (rand() - 0.5) * s * 0.1); };
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, s * 0.05); path(s * 0.015); ctx.stroke();
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = Math.max(1, s * 0.04); path(0); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,160,110,.25)'; ctx.lineWidth = Math.max(0.5, s * 0.01); path(-s * 0.008); ctx.stroke();
  },
  helecho(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let f = 0; f < 4; f++) {
      ctx.save(); ctx.rotate((f / 4) * Math.PI * 2 + rand() * 0.6);
      const L = s * (0.2 + rand() * 0.08);
      ctx.strokeStyle = '#3f7a2c'; ctx.lineWidth = Math.max(0.6, s * 0.012); seg(ctx, 0, 0, L, 0);
      ctx.fillStyle = f % 2 ? '#4f8f36' : '#5ea042';
      for (let k = 1; k < 7; k++) { const x = (L * k) / 7; const w = s * 0.045 * (1 - k / 8); ellipse(ctx, x, -w * 0.7, w, w * 0.35, -0.6); ellipse(ctx, x, w * 0.7, w, w * 0.35, 0.6); }
      ctx.restore();
    }
  },
  // ------------------------------------------------------------------- agua
  nenufar(ctx, s, rand) {
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * s * 0.35; const y = (rand() - 0.5) * s * 0.3; const R = s * (0.07 + rand() * 0.05); const a = rand() * 6;
      ctx.fillStyle = 'rgba(0,20,30,.3)'; ctx.beginPath(); ctx.moveTo(x + 1, y + 2); ctx.arc(x + 1, y + 2, R, a + 0.3, a + Math.PI * 2 - 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rand() < 0.5 ? '#3f8a3a' : '#4f9a45'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, R, a + 0.3, a + Math.PI * 2 - 0.3); ctx.closePath(); ctx.fill();
      if (rand() < 0.4) { ctx.fillStyle = '#f2a7c8'; circle(ctx, x, y, R * 0.3); ctx.fillStyle = '#ffe28a'; circle(ctx, x, y, R * 0.1); }
    }
  },
  ondas(ctx, s, rand) {
    ctx.strokeStyle = 'rgba(220,245,255,.45)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.06 * k, s * 0.04 * k, 0, rand() * 2, rand() * 2 + 3.6); ctx.stroke(); }
  },
  juncos(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = (rand() - 0.5) * s * 0.25; const y = s * 0.08 + (rand() - 0.5) * s * 0.08;
      const L = s * (0.22 + rand() * 0.14); const lean = (rand() - 0.5) * s * 0.12;
      blade(ctx, x, y, L, lean, Math.max(0.8, s * 0.018), rand() < 0.5 ? '#7d8f40' : '#62762f');
      if (rand() < 0.5) { ctx.fillStyle = '#5a3d22'; ellipse(ctx, x + lean, y - L, s * 0.016, s * 0.045, Math.atan2(lean, L)); }
    }
  },
  reflejo(ctx, s, rand) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.lineWidth = Math.max(0.6, s * (0.01 + rand() * 0.012)); const y = (i - 1) * s * 0.06; const L = s * (0.06 + rand() * 0.12); seg(ctx, -L + rand() * s * 0.05, y, L, y); }
  },
  algas(ctx, s, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(60,120,60,.6)' : 'rgba(40,95,55,.6)'; ctx.lineWidth = Math.max(0.8, s * 0.02);
      const x = (rand() - 0.5) * s * 0.3;
      ctx.beginPath(); ctx.moveTo(x, s * 0.15);
      ctx.bezierCurveTo(x + s * 0.08, s * 0.05, x - s * 0.08, -s * 0.05, x + (rand() - 0.5) * s * 0.1, -s * 0.18); ctx.stroke();
    }
  },
  espuma(ctx, s, rand) {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(240,250,255,${0.35 + rand() * 0.35})`;
      circle(ctx, (rand() - 0.5) * s * 0.5, (rand() - 0.5) * s * 0.18, s * (0.012 + rand() * 0.025));
    }
  },
  // ------------------------------------------------------------ nieve y fuego
  ventisca(ctx, s, rand) {
    ctx.fillStyle = 'rgba(120,150,180,.3)'; ellipse(ctx, s * 0.02, s * 0.04, s * 0.22, s * 0.08, (rand() - 0.5) * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ellipse(ctx, 0, 0, s * 0.2, s * 0.07, (rand() - 0.5) * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ellipse(ctx, -s * 0.08, -s * 0.02, s * 0.1, s * 0.05, 0);
  },
  escarcha(ctx, s, rand) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(0.5, s * 0.009);
    for (let i = 0; i < 3; i++) {
      const x = (rand() - 0.5) * s * 0.35; const y = (rand() - 0.5) * s * 0.35; const r = s * (0.03 + rand() * 0.03);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; seg(ctx, x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r); }
    }
  },
  ceniza(ctx, s, rand) {
    const R = s * 0.18;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(70,68,64,.8)'); g.addColorStop(1, 'rgba(70,68,64,0)');
    ctx.fillStyle = g; circle(ctx, 0, 0, R);
    dots(ctx, -R * 0.6, -R * 0.6, R * 1.2, rand, 8, ['#4a4744', '#2e2c2a', '#8a8580'], 0.01, 0.025);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,130,50,.8)'; circle(ctx, (rand() - 0.5) * R, (rand() - 0.5) * R, s * 0.009); }
  },
  costra(ctx, s, rand) {
    ctx.fillStyle = 'rgba(40,12,4,.85)';
    blobPoly(ctx, 0, 0, s * (0.12 + rand() * 0.08), 7, rand, 0.4, rand()); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,90,.7)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    blobPoly(ctx, 0, 0, s * 0.13, 7, rand, 0.4, rand()); ctx.stroke();
  },
  // ------------------------------------------------------------------ magia
  runa(ctx, s, rand) {
    ctx.strokeStyle = 'rgba(25,20,15,.45)'; ctx.lineWidth = Math.max(0.7, s * 0.016); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2); ctx.stroke();
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) seg(ctx, (rand() - 0.5) * s * 0.18, (rand() - 0.5) * s * 0.18, (rand() - 0.5) * s * 0.18, (rand() - 0.5) * s * 0.18);
  },
  glifo(ctx, s, rand) {
    ctx.save(); ctx.shadowColor = '#7ad7ff'; ctx.shadowBlur = s * 0.2;
    ctx.strokeStyle = 'rgba(150,225,255,.9)'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2); ctx.stroke();
    const n = 3 + Math.floor(rand() * 3);
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI * Math.floor(n / 2)) / n; ctx.lineTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); }
    ctx.stroke();
    ctx.restore();
  },
  cristales(ctx, s, rand) {
    ctx.save(); ctx.shadowColor = 'rgba(150,120,255,.9)'; ctx.shadowBlur = s * 0.15;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(-0.8 + i * 0.5 + (rand() - 0.5) * 0.3);
      const L = s * (0.1 + rand() * 0.08);
      ctx.fillStyle = i % 2 ? '#c8b6ff' : '#9a80ff';
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(s * 0.03, -L * 0.6); ctx.lineTo(s * 0.022, 0); ctx.lineTo(-s * 0.022, 0); ctx.lineTo(-s * 0.03, -L * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
};
// Adornos que dan algo de luz (color «r,g,b» y radio en casillas).
const DECAL_LIGHT = { glifo: ['122,215,255', 1.4], cristales: ['170,140,255', 1.1] };

// Dibuja un adorno { k, x, y, a, s } (posición en casillas, giro en grados, escala) en casillas de `s` píxeles.
export function paintDecal(ctx, d, s) {
  const fn = DECALS[d.k];
  if (!fn) return;
  ctx.save();
  ctx.translate(d.x * s, d.y * s);
  if (d.a) ctx.rotate((d.a * Math.PI) / 180);
  if (d.s && d.s !== 1) ctx.scale(d.s, d.s);
  fn(ctx, s, cellRand(Math.round(d.x * 97), Math.round(d.y * 89), 13));
  ctx.restore();
}

export function decalLights(sc) {
  const out = [];
  for (const d of sc.decals || []) {
    const L = DECAL_LIGHT[d.k];
    if (L) out.push({ x: d.x, y: d.y, r: L[1] * (d.s || 1), color: L[0], soft: true });
  }
  return out;
}

// Adornos automáticos: qué puede salir en cada terreno y con qué probabilidad por casilla (intensidad normal).
const AUTO = {
  '.': [['grieta', 0.1], ['suciedad', 0.08], ['guijarros', 0.04], ['humedad', 0.035]],
  c: [['suciedad', 0.08], ['charquito', 0.035], ['paja', 0.025], ['hojas', 0.02], ['grieta', 0.04]],
  w: [['astillas', 0.035], ['paja', 0.035], ['vino', 0.03], ['suciedad', 0.04]],
  m: [['vino', 0.02]],
  b: [['grieta', 0.03]],
  o: [['grieta', 0.04], ['suciedad', 0.04]],
  X: [['humedad', 0.12]],
  y: [['astillas', 0.22]],
  '=': [['astillas', 0.03]],
  ',': [['mata', 0.4], ['trebol', 0.06], ['flores_silvestres', 0.06], ['guijarros', 0.035], ['piedra', 0.02], ['setitas', 0.012]],
  j: [['mata', 0.2]],
  u: [['musgo', 0.25], ['setitas', 0.06]],
  ':': [['guijarros', 0.2], ['ramitas', 0.06], ['piedra', 0.03], ['huellas', 0.025]],
  f: [['hojas', 0.3], ['ramitas', 0.15], ['setitas', 0.05]],
  G: [['piedra', 0.12]],
  s: [['guijarros', 0.06], ['huellas', 0.03], ['ramitas', 0.02]],
  a: [['ceniza', 0.15], ['quemadura', 0.06]],
  n: [['ventisca', 0.14], ['escarcha', 0.05], ['huellas', 0.025]],
  k: [['ventisca', 0.2]],
  ';': [['hierba_alta', 0.45], ['helecho', 0.1], ['flores_silvestres', 0.04]],
  r: [['raiz', 0.2], ['hojas', 0.08]],
  '%': [['escombro', 0.3], ['suciedad', 0.1]],
  p: [['charquito', 0.14], ['huellas', 0.05], ['ramitas', 0.05]],
  i: [['escarcha', 0.18], ['grieta', 0.06]],
  '~': [['reflejo', 0.12], ['ondas', 0.1], ['algas', 0.04], ['nenufar', 0.04]],
  W: [['reflejo', 0.1], ['ondas', 0.05]],
  l: [['costra', 0.3]],
  P: [['algas', 0.06]],
};
const INDOOR = new Set(['.', 'w', 'o', 'b', 'S', 'c', 'X']); // suelos donde caben telarañas y escombros junto a los muros
const LAND = new Set([',', ':', ';', 'p', 'u', 'f', 's', 'G', 'j', 'r']);
const WATER = new Set(['~', 'W']);

// Adornos que salen solos en la casilla (c, r): [{ k, x, y, a, s }] en casillas.
// at(dc, dr) da el terreno vecino; isWall(dc, dr), si es muro. Depende solo de la casilla y sus vecinas: al repintar
// una zona, el resto del escenario no cambia.
export function cellDecals(c, r, code, at, isWall, seed, level) {
  const mult = DECOR_LEVEL[level] ?? 1;
  if (!mult) return [];
  const rand = cellRand(c + seed * 977, r - seed * 389, 21);
  const out = [];
  const put = (k, x = 0.2 + rand() * 0.6, y = 0.2 + rand() * 0.6, a = rand() * 360, sc = 0.8 + rand() * 0.4) => out.push({ k, x: c + x, y: r + y, a, s: sc });
  for (const [k, p] of AUTO[code] || []) if (rand() < p * mult) put(k);
  if (INDOOR.has(code)) {
    const N = isWall(0, -1); const S = isWall(0, 1); const Wl = isWall(-1, 0); const E = isWall(1, 0);
    // telarañas en las esquinas entre dos muros
    for (const [w1, w2, x, y, a] of [[N, Wl, 0, 0, 0], [N, E, 1, 0, 90], [S, E, 1, 1, 180], [S, Wl, 0, 1, 270]]) {
      if (w1 && w2 && rand() < 0.3 * mult) put('telarana', x, y, a, 0.7 + rand() * 0.5);
    }
    // escombro y musgo arrimados a un muro
    const walls = [[N, 0.5, 0.15], [S, 0.5, 0.85], [Wl, 0.15, 0.5], [E, 0.85, 0.5]].filter(([w]) => w);
    if (walls.length && rand() < 0.12 * mult) { const [, x, y] = walls[Math.floor(rand() * walls.length)]; put(rand() < 0.6 ? 'escombro' : 'musgo', x + (rand() - 0.5) * 0.4, y + (rand() - 0.5) * 0.1); }
  }
  // orillas: juncos y espuma donde el agua toca tierra
  if (WATER.has(code) || LAND.has(code)) {
    const sides = [[0, -1, 0.5, 0.1], [0, 1, 0.5, 0.9], [-1, 0, 0.1, 0.5], [1, 0, 0.9, 0.5]];
    for (const [dc, dr, x, y] of sides) {
      const nb = at(dc, dr);
      if (nb == null) continue;
      const shore = WATER.has(code) ? LAND.has(nb) : WATER.has(nb);
      if (!shore) continue;
      if (code === '~' && rand() < 0.22 * mult) put('juncos', x + (rand() - 0.5) * 0.5 * !dc, y + (rand() - 0.5) * 0.5 * !dr, (rand() - 0.5) * 30);
      else if (code === 'W' && rand() < 0.2 * mult) put('espuma', x, y, dc ? 90 : 0);
      else if (LAND.has(code) && rand() < 0.12 * mult) put('juncos', x + (rand() - 0.5) * 0.5 * !dc, y + (rand() - 0.5) * 0.5 * !dr, (rand() - 0.5) * 30);
    }
  }
  // camino de tierra junto a la hierba: matas en el borde
  if (code === ':' && [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dc, dr]) => at(dc, dr) === ',') && rand() < 0.25 * mult) put('mata');
  return out;
}

// Adorno apropiado para el terreno (pincel «según el terreno» del editor).
export function decalFor(code, rand) {
  const list = (AUTO[code] || []).filter(([k]) => k !== 'huellas');
  if (!list.length) return INDOOR.has(code) ? 'suciedad' : 'guijarros';
  const total = list.reduce((a, [, p]) => a + p, 0);
  let x = rand() * total;
  for (const [k, p] of list) { x -= p; if (x <= 0) return k; }
  return list[0][0];
}

// ------------------------------------------------------------------ 3. ambiente
// Tono de color de todo el escenario: se multiplica por un color casi blanco (o se tiñe, en sepia).
export const MOODS = {
  natural: null,
  calido: { op: 'multiply', color: '#ffe2bd' },
  frio: { op: 'multiply', color: '#d2e1ff' },
  sombrio: { op: 'multiply', color: '#aeaabd' },
  misterio: { op: 'multiply', color: '#d8c6ff' },
  enfermizo: { op: 'multiply', color: '#d5eeb4' },
  infernal: { op: 'multiply', color: '#ffc4a0' },
  sepia: { op: 'color', color: 'rgba(150,110,60,.5)' },
};

// Tono y viñeta sobre la zona (c0..c1, r0..r1). `paintable(c, r)` dice qué casillas tienen algo dibujado.
export function finishScene(ctx, sc, s, c0, c1, r0, r1, paintable) {
  const mood = MOODS[sc.mood];
  if (mood) {
    ctx.save();
    ctx.globalCompositeOperation = mood.op;
    ctx.fillStyle = mood.color;
    ctx.beginPath();
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (paintable(c, r)) ctx.rect(c * s, r * s, s, s);
    ctx.fill();
    ctx.restore();
  }
  if (sc.vignette) {
    const W = sc.cols * s; const H = sc.rows * s;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,5,2,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(c0 * s, r0 * s, (c1 - c0 + 1) * s, (r1 - r0 + 1) * s);
  }
}

// Cuadrícula con su estilo: 'linea', 'puntos' (un punto en cada esquina), 'cruces' (una cruz en cada esquina) o 'ninguna'.
// cells: [c, r, derecha, abajo] de cada casilla que la lleva (derecha/abajo: si cierra también ese lado).
export function drawGrid(ctx, s, cells, style) {
  if (style === 'ninguna') return;
  ctx.save();
  if (style === 'puntos' || style === 'cruces') {
    const seen = new Set();
    const corners = [];
    for (const [c, r, right, down] of cells) {
      for (const [x, y] of [[c, r], ...(right ? [[c + 1, r]] : []), ...(down ? [[c, r + 1]] : []), ...(right && down ? [[c + 1, r + 1]] : [])]) {
        const k = `${x},${y}`;
        if (!seen.has(k)) { seen.add(k); corners.push([x, y]); }
      }
    }
    if (style === 'puntos') {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath();
      for (const [x, y] of corners) { ctx.moveTo(x * s + s * 0.035, y * s); ctx.arc(x * s, y * s, s * 0.035, 0, Math.PI * 2); }
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,.42)';
      ctx.lineWidth = Math.max(0.6, s * 0.022);
      ctx.beginPath();
      const L = s * 0.1;
      for (const [x, y] of corners) { ctx.moveTo(x * s - L, y * s); ctx.lineTo(x * s + L, y * s); ctx.moveTo(x * s, y * s - L); ctx.lineTo(x * s, y * s + L); }
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    for (const [c, r, right, down] of cells) {
      ctx.moveTo(c * s, r * s); ctx.lineTo(c * s + s, r * s);
      ctx.moveTo(c * s, r * s); ctx.lineTo(c * s, r * s + s);
      if (right) { ctx.moveTo(c * s + s, r * s); ctx.lineTo(c * s + s, r * s + s); }
      if (down) { ctx.moveTo(c * s, r * s + s); ctx.lineTo(c * s + s, r * s + s); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.32)';
    ctx.lineWidth = Math.max(0.5, s * 0.018);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ follaje
// Copa de árbol o arbusto vista desde arriba: lóbulos con sombra en el suelo, volumen (luz arriba a la izquierda)
// y motas de hojas. colors: [oscuro, medio, claro, brillo].
export function foliage(ctx, cx, cy, R, rand, [dark, mid, light, top], lobes = 9) {
  const pts = Array.from({ length: lobes }, (_, k) => {
    const a = (k / lobes) * Math.PI * 2 + rand() * 0.5;
    const d = R * (0.5 + rand() * 0.14);
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.36 + rand() * 0.12)];
  });
  const path = (dx = 0, dy = 0) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx + R * 0.6, cy + dy);
    ctx.arc(cx + dx, cy + dy, R * 0.6, 0, Math.PI * 2);
    for (const [x, y, r] of pts) { ctx.moveTo(x + dx + r, y + dy); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); }
  };
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  path(R * 0.14, R * 0.22); ctx.fill();
  ctx.fillStyle = dark;
  path(); ctx.fill();
  ctx.fillStyle = mid;
  for (const [x, y, r] of pts) circle(ctx, cx + (x - cx) * 0.8 - R * 0.05, cy + (y - cy) * 0.8 - R * 0.06, r * 0.74);
  circle(ctx, cx - R * 0.06, cy - R * 0.07, R * 0.48);
  ctx.fillStyle = light;
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * 1.25 + (rand() - 0.5) * 1.5; const d = R * (0.12 + rand() * 0.34);
    circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.14 + rand() * 0.1));
  }
  ctx.fillStyle = top;
  for (let k = 0; k < 12; k++) {
    const a = Math.PI * 1.25 + (rand() - 0.5) * 2.2; const d = R * rand() * 0.6;
    circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.03 + rand() * 0.03));
  }
  // volumen: más claro arriba a la izquierda, más oscuro en el borde de abajo a la derecha
  ctx.save();
  path(); ctx.clip();
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.15);
  g.addColorStop(0, 'rgba(255,255,220,.16)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  ctx.restore();
}
