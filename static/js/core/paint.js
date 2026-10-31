// Primitivas de dibujo que comparten el tablero (battlemap.js) y la decoración (decor.js): azar determinista
// por casilla, ruido suave, colores y formas básicas sobre un lienzo 2D.

// Generador pseudoaleatorio con semilla (mulberry32): el mismo número da siempre la misma secuencia.
export function mulberry(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Azar propio de cada casilla (y de cada uso, con k): el escenario se ve igual cada vez que se dibuja.
export const cellRand = (c, r, k = 0) => mulberry(((c + 7) * 73856093) ^ ((r + 3) * 19349663) ^ ((k + 1) * 83492791));

// Ruido de valor suave (0..1): rejilla de valores al azar interpolada con suavizado. Con dos octavas da manchas
// grandes con algo de detalle, sin el aspecto de cuadrícula del azar por casilla.
function lattice(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = lattice(xi, yi, seed); const b = lattice(xi + 1, yi, seed);
  const c = lattice(xi, yi + 1, seed); const d = lattice(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const noise2 = (x, y, seed = 0) => valueNoise(x, y, seed) * 0.65 + valueNoise(x * 2.3 + 17.1, y * 2.3 + 5.7, seed + 101) * 0.35;

// Aclara (amt > 0) u oscurece (amt < 0) un color #rrggbb.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
export const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill(); };
export const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill(); };
export function seg(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
export function rrect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function dots(ctx, x, y, s, rand, n, colors, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    circle(ctx, x + rand() * s, y + rand() * s, s * (rmin + rand() * (rmax - rmin)));
  }
}
// Polígono irregular (piedras, escombros, costras): n vértices alrededor de (cx, cy) con radio entre r·(1-jit) y r.
export function blobPoly(ctx, cx, cy, r, n, rand, jit = 0.35, rot = 0) {
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2;
    const rr = r * (1 - jit + rand() * jit);
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
export function emoji(ctx, ch, x, y, size, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.fillStyle = '#000'; // opaco: el emoji en color toma la transparencia del relleno que hubiera (las losas dejan uno casi invisible)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, size * 0.05);
  ctx.restore();
}
export function withShadow(ctx, s, fn, strength = 0.45) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${strength})`;
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetX = s * 0.05;
  ctx.shadowOffsetY = s * 0.08;
  fn();
  ctx.restore();
}
