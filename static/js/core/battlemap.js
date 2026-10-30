// Tablero de combate con cuadrícula (casillas de 1,5 m, Manual del Jugador 2024).
// Dibuja el escenario en un lienzo (terreno con textura, muros con relieve, objetos, luz y llamas),
// coloca las fichas en casillas y ofrece regla, áreas de efecto, alcance de movimiento y edición.
// Lo usan el Combate, la Mesa y el editor de Escenarios.
import { api } from './api.js';
import { h, clear, icon, token } from './dom.js';
import { condLabel } from './dnd.js';
import { sfx } from './sfx.js';

export const CELL = 64; // píxeles por casilla en el lienzo base
export const METERS = 1.5; // metros por casilla
export const SIZE_CELLS = { Diminuto: 1, Pequeño: 1, Mediano: 1, Grande: 2, Enorme: 3, Gargantuesco: 4 };
export const SIZES = Object.keys(SIZE_CELLS);
export const sizeCells = (s) => SIZE_CELLS[String(s || '').split(' o ')[0]] || 1;
// Las criaturas diminutas ocupan un cuarto de casilla: caben hasta cuatro en una (MdJ 2024). Las pequeñas, como las medianas.
export const isTiny = (s) => String(s || '').split(' o ')[0] === 'Diminuto';
const SIZE_INDEX = { Diminuto: 0, Pequeño: 1, Mediano: 2, Grande: 3, Enorme: 4, Gargantuesco: 5 };
const sizeIndex = (s) => SIZE_INDEX[String(s || '').split(' o ')[0]] ?? 2;
// ¿Puede quedarse `t` con su esquina en (c, r)? `others` son las demás criaturas en pie: [{ c, r, size }].
export function spaceFree(t, c, r, others) {
  const n = sizeCells(t.size);
  const tiny = isTiny(t.size);
  let tinyHere = 0;
  for (const o of others) {
    if (o.c == null) continue;
    const m = sizeCells(o.size);
    if (o.c >= c + n || o.c + m <= c || o.r >= r + n || o.r + m <= r) continue;
    if (!tiny || !isTiny(o.size)) return false;
    tinyHere++;
  }
  return tinyHere < 4;
}
export const AREA_SHAPES = [['esfera', 'Esfera'], ['cubo', 'Cubo'], ['cono', 'Cono'], ['linea', 'Línea'], ['emanacion', 'Emanación']];
export const LIGHT_ALPHA = { dia: 0, penumbra: 0.38, noche: 0.66, oscuridad: 0.86 };
const AREA_NAME = Object.fromEntries(AREA_SHAPES);

let catalogPromise;
export function sceneCatalog() {
  catalogPromise ??= api.get('/api/scene-catalog').then((cat) => {
    cat.T = Object.fromEntries(cat.terrain.map((t) => [t.code, t]));
    cat.P = Object.fromEntries(cat.props.map((p) => [p.code, p]));
    return cat;
  });
  return catalogPromise;
}

export const colName = (c) => {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export const cellName = (c, r) => `${colName(c)}${r + 1}`;
export const fmtMeters = (m) => `${String(Math.round(m * 10) / 10).replace('.', ',')} m`;

export function blankScene(cols = 24, rows = 16, fill = ',') {
  return {
    name: 'Nuevo escenario', description: '', cols, rows, tiles: fill.repeat(cols * rows), props: [],
    light: 'dia', bg: '', bgOpacity: 1, spawns: { party: [], enemies: [] }, notes: '',
  };
}

// Cambia el tamaño de un escenario conservando lo que cabe (anclado arriba a la izquierda).
export function resizeScene(sc, cols, rows, fill) {
  const tiles = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push(c < sc.cols && r < sc.rows ? sc.tiles[r * sc.cols + c] : fill);
  const fits = (x, y, w = 1, hh = 1) => x + w <= cols && y + hh <= rows;
  return {
    ...sc, cols, rows, tiles: tiles.join(''),
    props: sc.props.filter((p) => fits(p.c, p.r, p.w, p.h)),
    spawns: { party: (sc.spawns?.party || []).filter(([x, y]) => fits(x, y)), enemies: (sc.spawns?.enemies || []).filter(([x, y]) => fits(x, y)) },
  };
}

// =============================================================== dibujo del escenario
function mulberry(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cellRand = (c, r, k = 0) => mulberry(((c + 7) * 73856093) ^ ((r + 3) * 19349663) ^ ((k + 1) * 83492791));
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill(); };
const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill(); };
function seg(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function rrect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function dots(ctx, x, y, s, rand, n, colors, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    circle(ctx, x + rand() * s, y + rand() * s, s * (rmin + rand() * (rmax - rmin)));
  }
}
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
function emoji(ctx, ch, x, y, size, rot = 0) {
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
function withShadow(ctx, s, fn, strength = 0.45) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${strength})`;
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetX = s * 0.05;
  ctx.shadowOffsetY = s * 0.08;
  fn();
  ctx.restore();
}

// ----------------------------------------------------------------- terrenos
// base: color de fondo · organic: prioridad para fundir bordes · wall: muro con relieve
const TS = {
  '.': { base: '#77736b', draw: slabs },
  c: { base: '#5d5a56', draw: cobbles },
  w: { base: '#8b5a31', draw: planks },
  m: { base: '#7b2330', draw: carpet },
  S: { base: '#7a746a', draw: stairs },
  D: { base: '#77736b', draw: door },
  '=': { base: '#7a522c', draw: bridge },
  ',': { base: '#4f7d3a', organic: 2, draw: grass },
  ':': { base: '#7f5f3f', organic: 1, draw: dirt },
  s: { base: '#cdb37c', organic: 1, draw: (d) => specks(d, ['#b89c62', '#e3cc98', '#d9c08a'], 16) },
  n: { base: '#e4ecf2', organic: 2, draw: (d) => specks(d, ['#cbd8e2', '#ffffff', '#dce6ee'], 12) },
  ';': { base: '#3e6a2c', organic: 3, draw: tallGrass },
  '%': { base: '#6b655c', draw: rubble },
  p: { base: '#4d482c', organic: 3, draw: mud },
  i: { base: '#a9d4e6', organic: 2, draw: ice },
  '~': { base: '#3b83a5', organic: 4, draw: (d) => water(d, '#7cc0dd', 3) },
  W: { base: '#1c4c77', organic: 5, draw: (d) => water(d, '#3f78a6', 2) },
  l: { base: '#c2410c', organic: 6, draw: lava },
  v: { base: '#060708', organic: 7, draw: chasm },
  '#': { base: '#8d877c', wall: true, draw: stoneWall },
  H: { base: '#6a4524', wall: true, draw: woodWall },
  R: { base: '#57504a', wall: true, draw: rockWall },
  _: { base: null },
};
// Terrenos de la decoración ampliada (sus reglas, en server/scenes.py)
Object.assign(TS, {
  b: { base: '#dcd8cf', draw: marble },
  o: { base: '#4a3d33', draw: mosaic },
  X: { base: '#121314', draw: grate },
  y: { base: '#8b5a31', draw: brokenPlanks },
  J: { base: '#a0703f', draw: dais },
  G: { base: '#8a8378', organic: 1, draw: gravel },
  f: { base: '#6b5233', organic: 1, draw: leaves },
  u: { base: '#3f5f2a', organic: 2, draw: moss },
  a: { base: '#5a5753', organic: 1, draw: ash },
  e: { base: '#5e4128', draw: furrows },
  j: { base: '#4f7d3a', organic: 2, draw: flowerBed },
  k: { base: '#f2f6fa', organic: 3, draw: deepSnow },
  K: { base: '#46583a', organic: 3, draw: reeds },
  r: { base: '#6b4a2c', organic: 1, draw: roots },
  q: { base: '#c2a160', organic: 4, draw: quicksand },
  A: { base: '#3fa63a', organic: 5, draw: acid },
  P: { base: '#4a3d5c', organic: 4, draw: toxicMire },
  B: { base: '#8a3b2a', wall: true, draw: brickWall },
  L: { base: '#a9d4e6', wall: true, draw: iceWall },
  F: { base: '#5a3b1f', wall: true, draw: palisade },
  h: { base: '#1f4a22', wall: true, draw: hedge },
});
export const TERRAIN_SWATCH = Object.fromEntries(Object.entries(TS).map(([k, v]) => [k, v.base]));

function specks({ ctx, x, y, s, rand }, colors, n) { dots(ctx, x, y, s, rand, n, colors, 0.012, 0.03); }
function slabs({ ctx, x, y, s, rand }) {
  const split = rand();
  const tiles = split < 0.45 ? [[0, 0, 1, 1]] : split < 0.75 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] : [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
  ctx.lineWidth = Math.max(1, s * 0.035);
  for (const [a, b, w, hh] of tiles) {
    ctx.fillStyle = shade('#77736b', (rand() - 0.5) * 0.16);
    ctx.fillRect(x + a * s + 1, y + b * s + 1, w * s - 2, hh * s - 2);
    ctx.strokeStyle = 'rgba(30,26,22,.5)';
    ctx.strokeRect(x + a * s + s * 0.02, y + b * s + s * 0.02, w * s - s * 0.04, hh * s - s * 0.04);
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    seg(ctx, x + a * s + s * 0.05, y + b * s + s * 0.05, x + (a + w) * s - s * 0.05, y + b * s + s * 0.05);
  }
  dots(ctx, x, y, s, rand, 6, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.07)'], 0.01, 0.025);
  if (rand() < 0.16) {
    ctx.strokeStyle = 'rgba(20,18,15,.45)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    ctx.beginPath();
    let px = x + s * (0.2 + rand() * 0.3); let py = y + s * (0.2 + rand() * 0.3);
    ctx.moveTo(px, py);
    for (let i = 0; i < 3; i++) { px += s * (0.08 + rand() * 0.15); py += s * (rand() * 0.2 - 0.05); ctx.lineTo(px, py); }
    ctx.stroke();
  }
}
function cobbles({ ctx, x, y, s, rand }) {
  const n = 3;
  const q = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const off = j % 2 ? q * 0.5 : 0;
      const cx = x + (i + 0.5) * q + off - (off && i === n - 1 ? q : 0);
      const cy = y + (j + 0.5) * q;
      ctx.fillStyle = shade('#85817b', (rand() - 0.5) * 0.3);
      ellipse(ctx, cx + (rand() - 0.5) * q * 0.15, cy + (rand() - 0.5) * q * 0.15, q * 0.43, q * 0.38, rand());
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ellipse(ctx, cx - q * 0.1, cy - q * 0.12, q * 0.2, q * 0.13, 0);
    }
  }
}
function planks({ ctx, x, y, s, rand, r }) {
  const n = 3;
  const ph = s / n;
  for (let i = 0; i < n; i++) {
    const py = y + i * ph;
    const cut = ((r * 3 + i) * 0.37) % 1;
    for (const [a, b] of [[0, cut], [cut, 1]]) {
      if (b - a < 0.02) continue;
      ctx.fillStyle = shade('#8b5a31', (rand() - 0.5) * 0.22);
      ctx.fillRect(x + a * s, py, (b - a) * s, ph);
      ctx.strokeStyle = 'rgba(60,35,15,.25)';
      ctx.lineWidth = Math.max(0.5, s * 0.01);
      seg(ctx, x + a * s + s * 0.05, py + ph * (0.3 + rand() * 0.4), x + b * s - s * 0.05, py + ph * (0.3 + rand() * 0.4));
    }
    ctx.fillStyle = 'rgba(35,20,8,.55)';
    ctx.fillRect(x, py + ph - Math.max(1, s * 0.02), s, Math.max(1, s * 0.02));
    ctx.fillRect(x + cut * s, py, Math.max(1, s * 0.02), ph);
    ctx.fillStyle = 'rgba(30,30,30,.5)';
    circle(ctx, x + cut * s + s * 0.04, py + ph * 0.5, s * 0.012);
  }
}
function carpet({ ctx, x, y, s, rand, at }) {
  ctx.strokeStyle = 'rgba(240,190,90,.35)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + s * 0.2); ctx.lineTo(x + s * 0.8, y + s / 2); ctx.lineTo(x + s / 2, y + s * 0.8); ctx.lineTo(x + s * 0.2, y + s / 2); ctx.closePath();
  ctx.stroke();
  dots(ctx, x, y, s, rand, 8, ['rgba(0,0,0,.1)', 'rgba(255,200,120,.08)'], 0.01, 0.02);
  ctx.fillStyle = '#c9963f';
  const b = s * 0.07;
  if (at(0, -1) !== 'm') ctx.fillRect(x, y + s * 0.06, s, b);
  if (at(0, 1) !== 'm') ctx.fillRect(x, y + s - s * 0.06 - b, s, b);
  if (at(-1, 0) !== 'm') ctx.fillRect(x + s * 0.06, y, b, s);
  if (at(1, 0) !== 'm') ctx.fillRect(x + s - s * 0.06 - b, y, b, s);
}
function stairs({ ctx, x, y, s }) {
  for (let i = 0; i < 4; i++) {
    const g = ctx.createLinearGradient(0, y + i * s / 4, 0, y + (i + 1) * s / 4);
    g.addColorStop(0, shade('#8d877c', 0.1 - i * 0.06));
    g.addColorStop(1, shade('#5d584f', -i * 0.08));
    ctx.fillStyle = g;
    ctx.fillRect(x, y + i * s / 4, s, s / 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x, y, s * 0.06, s);
  ctx.fillRect(x + s * 0.94, y, s * 0.06, s);
}
function door(d) {
  const { ctx, x, y, s, isWall } = d;
  slabs({ ...d, rand: cellRand(d.c, d.r, 5) });
  const horizontal = isWall(-1, 0) || isWall(1, 0);
  const t = s * 0.26;
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  if (d.open) { // abierta: la hoja girada junto al marco
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(-s / 2, -t / 2 - s * 0.03, s * 0.12, t + s * 0.06);
    ctx.fillRect(s / 2 - s * 0.12, -t / 2 - s * 0.03, s * 0.12, t + s * 0.06);
    withShadow(ctx, s, () => { ctx.fillStyle = '#7a4a22'; ctx.fillRect(-s / 2 + s * 0.1, -t / 2, s * 0.12, s * 0.62); }, 0.4);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#2b2118';
  ctx.fillRect(-s / 2, -t / 2 - s * 0.03, s * 0.12, t + s * 0.06);
  ctx.fillRect(s / 2 - s * 0.12, -t / 2 - s * 0.03, s * 0.12, t + s * 0.06);
  withShadow(ctx, s, () => { ctx.fillStyle = '#7a4a22'; ctx.fillRect(-s / 2 + s * 0.1, -t / 2, s - s * 0.2, t); }, 0.4);
  ctx.strokeStyle = 'rgba(40,20,5,.6)';
  ctx.lineWidth = Math.max(0.7, s * 0.015);
  for (let i = 1; i < 4; i++) seg(ctx, -s / 2 + s * 0.1 + i * (s * 0.8) / 4, -t / 2, -s / 2 + s * 0.1 + i * (s * 0.8) / 4, t / 2);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-s * 0.3, -t / 2, s * 0.06, t);
  ctx.fillRect(s * 0.24, -t / 2, s * 0.06, t);
  ctx.fillStyle = '#d6a94a';
  circle(ctx, s * 0.15, 0, s * 0.03);
  ctx.restore();
}
function bridge({ ctx, x, y, s, at }) {
  const horizontal = at(-1, 0) === '=' || at(1, 0) === '=';
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  const n = 4;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade('#8a5d33', ((i * 37) % 10) / 50 - 0.1);
    ctx.fillRect(-s / 2 + i * (s / n) + 1, -s / 2, s / n - 2, s);
  }
  ctx.strokeStyle = '#c9a66b';
  ctx.lineWidth = Math.max(1, s * 0.04);
  const sideA = horizontal ? at(0, -1) : at(1, 0);
  const sideB = horizontal ? at(0, 1) : at(-1, 0);
  if (sideA !== '=') seg(ctx, -s / 2, -s / 2 + s * 0.05, s / 2, -s / 2 + s * 0.05);
  if (sideB !== '=') seg(ctx, -s / 2, s / 2 - s * 0.05, s / 2, s / 2 - s * 0.05);
  ctx.restore();
}
function grass({ ctx, x, y, s, rand }) {
  ctx.lineWidth = Math.max(0.6, s * 0.018);
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const px = x + rand() * s; const py = y + rand() * s;
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(120,170,80,.55)' : 'rgba(40,70,25,.5)';
    seg(ctx, px, py, px + (rand() - 0.5) * s * 0.08, py - s * (0.05 + rand() * 0.06));
  }
  if (rand() < 0.08) dots(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, rand, 3, ['#f4e7a1', '#ffffff', '#e9a3c9'], 0.015, 0.025);
}
function tallGrass({ ctx, x, y, s, rand }) {
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const px = x + s * (0.1 + rand() * 0.8); const py = y + s * (0.2 + rand() * 0.75);
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(130,175,70,.75)' : 'rgba(85,125,45,.8)';
    for (const dx of [-0.08, 0, 0.08]) seg(ctx, px, py, px + dx * s + (rand() - 0.5) * s * 0.04, py - s * (0.14 + rand() * 0.08));
  }
}
function dirt({ ctx, x, y, s, rand }) {
  dots(ctx, x, y, s, rand, 7, ['rgba(60,40,20,.35)', 'rgba(160,125,85,.35)'], 0.02, 0.06);
  dots(ctx, x, y, s, rand, 4, ['#8f877c', '#6d665c'], 0.015, 0.03);
}
function mud({ ctx, x, y, s, rand }) {
  ctx.fillStyle = 'rgba(30,28,15,.45)';
  ellipse(ctx, x + s * (0.3 + rand() * 0.4), y + s * (0.3 + rand() * 0.4), s * (0.15 + rand() * 0.15), s * (0.08 + rand() * 0.08), rand() * 3);
  ctx.fillStyle = 'rgba(200,210,170,.12)';
  ellipse(ctx, x + s * (0.2 + rand() * 0.5), y + s * (0.2 + rand() * 0.5), s * 0.08, s * 0.03, rand() * 3);
  dots(ctx, x, y, s, rand, 5, ['rgba(20,18,8,.3)', 'rgba(110,100,60,.3)'], 0.015, 0.04);
}
function ice({ ctx, x, y, s, rand }) {
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = Math.max(0.6, s * 0.015);
  for (let i = 0; i < 3; i++) seg(ctx, x + rand() * s, y + rand() * s, x + rand() * s, y + rand() * s);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ellipse(ctx, x + s * 0.35, y + s * 0.3, s * 0.2, s * 0.06, -0.5);
}
function water({ ctx, x, y, s, rand }, light, n) {
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + s * (0.15 + rand() * 0.6); const py = y + s * (0.2 + rand() * 0.6);
    ctx.beginPath();
    ctx.arc(px, py, s * (0.08 + rand() * 0.06), Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
}
function lava({ ctx, x, y, s, rand }) {
  const g = ctx.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s * 0.7);
  g.addColorStop(0, '#ffb347');
  g.addColorStop(1, 'rgba(194,65,12,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(70,20,5,.75)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const cx = x + rand() * s; const cy = y + rand() * s; const rr = s * (0.1 + rand() * 0.12);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * rr * (0.6 + rand() * 0.5), cy + Math.sin(a) * rr * (0.6 + rand() * 0.5)); }
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,230,120,.8)';
  ctx.lineWidth = Math.max(0.7, s * 0.02);
  seg(ctx, x + rand() * s, y + rand() * s, x + rand() * s, y + rand() * s);
}
function chasm({ ctx, x, y, s, at }) {
  const lip = s * 0.32;
  const sides = [[0, -1, 'top'], [0, 1, 'bottom'], [-1, 0, 'left'], [1, 0, 'right']];
  for (const [dc, dr, side] of sides) {
    const n = at(dc, dr);
    if (n == null || n === 'v') continue;
    const g = side === 'top' ? ctx.createLinearGradient(0, y, 0, y + lip) : side === 'bottom' ? ctx.createLinearGradient(0, y + s, 0, y + s - lip)
      : side === 'left' ? ctx.createLinearGradient(x, 0, x + lip, 0) : ctx.createLinearGradient(x + s, 0, x + s - lip, 0);
    g.addColorStop(0, 'rgba(92,78,62,.95)');
    g.addColorStop(0.35, 'rgba(48,40,32,.7)');
    g.addColorStop(1, 'rgba(6,7,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
  }
}
function rubble({ ctx, x, y, s, rand }) {
  for (let i = 0; i < 7; i++) {
    const cx = x + rand() * s; const cy = y + rand() * s; const rr = s * (0.05 + rand() * 0.09);
    ctx.fillStyle = shade('#8a847a', (rand() - 0.5) * 0.4);
    withShadow(ctx, s * 0.4, () => {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + rand(); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath();
      ctx.fill();
    }, 0.5);
  }
}
function stoneWall({ ctx, x, y, s, rand, r }) {
  ctx.fillStyle = '#8d877c';
  ctx.fillRect(x, y, s, s);
  const rowsN = 3;
  const bh = s / rowsN;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 0; i < rowsN; i++) {
    const off = ((r * rowsN + i) % 2) * 0.5;
    for (let k = -1; k < 2; k++) {
      const bx = x + (k + off) * s * 0.5;
      ctx.fillStyle = shade('#958f83', (rand() - 0.5) * 0.18);
      const x0 = Math.max(x, bx); const x1 = Math.min(x + s, bx + s * 0.5);
      if (x1 > x0) ctx.fillRect(x0, y + i * bh, x1 - x0, bh);
      ctx.strokeStyle = 'rgba(55,50,44,.7)';
      if (bx > x && bx < x + s) seg(ctx, bx, y + i * bh, bx, y + (i + 1) * bh);
    }
    seg(ctx, x, y + i * bh, x + s, y + i * bh);
  }
}
function woodWall({ ctx, x, y, s, rand, isWall }) {
  const vertical = isWall(0, -1) || isWall(0, 1);
  const horizontal = isWall(-1, 0) || isWall(1, 0);
  const alongX = horizontal || !vertical;
  const n = 3;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade('#6a4524', (rand() - 0.5) * 0.25);
    if (alongX) ctx.fillRect(x, y + i * s / n, s, s / n); else ctx.fillRect(x + i * s / n, y, s / n, s);
    ctx.fillStyle = 'rgba(30,15,5,.5)';
    if (alongX) ctx.fillRect(x, y + (i + 1) * s / n - 1, s, Math.max(1, s * 0.02)); else ctx.fillRect(x + (i + 1) * s / n - 1, y, Math.max(1, s * 0.02), s);
  }
}
function rockWall({ ctx, x, y, s, rand }) {
  ctx.fillStyle = '#57504a';
  ctx.fillRect(x, y, s, s);
  dots(ctx, x, y, s, rand, 6, ['rgba(120,110,100,.45)', 'rgba(30,26,22,.4)', 'rgba(90,82,74,.6)'], 0.06, 0.16);
  ctx.strokeStyle = 'rgba(20,18,15,.45)';
  ctx.lineWidth = Math.max(0.6, s * 0.02);
  seg(ctx, x + rand() * s, y + rand() * s, x + rand() * s, y + rand() * s);
}

// ------------------------------------------------------------------- objetos
// Cada pintor recibe (ctx, x, y, w, h, s, rand, env) en píxeles: (x, y) arriba a la izquierda.
const PP = {
  T(ctx, x, y, w, hh, s, rand) { tree(ctx, x, y, w, hh, s, rand, ['#284d21', '#356b2c', '#4b8a3a', '#6aa84f']); },
  P(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.47;
    withShadow(ctx, s, () => { ctx.fillStyle = '#1d3f25'; star(ctx, cx, cy, R, R * 0.7, 9, rand()); });
    [['#28552f', 0.78], ['#346b3b', 0.55], ['#46824a', 0.32]].forEach(([col, k]) => { ctx.fillStyle = col; star(ctx, cx, cy, R * k, R * k * 0.7, 9, rand()); });
    ctx.fillStyle = '#5a3d22';
    circle(ctx, cx, cy, R * 0.08);
  },
  b(ctx, x, y, w, hh, s, rand) {
    withShadow(ctx, s, () => { ctx.fillStyle = '#2f5a25'; for (let i = 0; i < 4; i++) circle(ctx, x + w * (0.3 + rand() * 0.4), y + hh * (0.3 + rand() * 0.4), s * (0.18 + rand() * 0.08)); });
    ctx.fillStyle = '#4c8a3a';
    for (let i = 0; i < 4; i++) circle(ctx, x + w * (0.3 + rand() * 0.4), y + hh * (0.28 + rand() * 0.35), s * 0.09);
    if (rand() < 0.5) dots(ctx, x + w * 0.25, y + hh * 0.25, Math.min(w, hh) * 0.5, rand, 4, ['#c23b3b'], 0.02, 0.03);
  },
  x(ctx, x, y, w, hh, s) {
    const along = w >= hh;
    const L = (along ? w : hh) - s * 0.15; const T = s * 0.36;
    ctx.save();
    ctx.translate(x + w / 2, y + hh / 2);
    if (!along) ctx.rotate(Math.PI / 2);
    withShadow(ctx, s, () => { ctx.fillStyle = '#5e3d22'; rrect(ctx, -L / 2, -T / 2, L, T, T / 2); ctx.fill(); });
    ctx.strokeStyle = 'rgba(30,18,8,.6)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    for (let i = 0; i < 3; i++) seg(ctx, -L / 2 + T * 0.5, -T * 0.25 + i * T * 0.25, L / 2 - T * 0.5, -T * 0.25 + i * T * 0.25);
    ctx.fillStyle = '#b08a5a';
    ellipse(ctx, L / 2 - T * 0.15, 0, T * 0.18, T * 0.48);
    ctx.restore();
  },
  r(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.42;
    const pts = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; const rr = R * (0.7 + rand() * 0.35); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
    withShadow(ctx, s, () => {
      const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, '#9b958c'); g.addColorStop(1, '#5a554f');
      ctx.fillStyle = g;
      ctx.beginPath(); pts.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(30,28,25,.45)';
    ctx.lineWidth = Math.max(0.6, s * 0.018);
    seg(ctx, cx - R * 0.3, cy - R * 0.1, cx + R * 0.2, cy + R * 0.3);
  },
  M(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.4;
    withShadow(ctx, s, () => { ctx.fillStyle = '#9b2f6e'; circle(ctx, cx, cy, R); });
    ctx.fillStyle = '#c94a92';
    circle(ctx, cx - R * 0.15, cy - R * 0.15, R * 0.7);
    dots(ctx, cx - R * 0.6, cy - R * 0.6, R * 1.2, rand, 5, ['#ffe9f4'], 0.03, 0.06);
  },
  Q(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(110,220,255,.9)';
    ctx.shadowBlur = s * 0.3;
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + i * 0.6 + (rand() - 0.5) * 0.3; const L = s * (0.32 + rand() * 0.14);
      ctx.save(); ctx.translate(cx, cy + s * 0.12); ctx.rotate(a);
      ctx.fillStyle = i === 1 ? '#a9f0ff' : '#5fd0f0';
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(s * 0.09, -L * 0.6); ctx.lineTo(s * 0.07, 0); ctx.lineTo(-s * 0.07, 0); ctx.lineTo(-s * 0.09, -L * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
  B(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.36;
    withShadow(ctx, s, () => { ctx.fillStyle = '#4a2e14'; circle(ctx, cx, cy, R); });
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#b07a42'); g.addColorStop(1, '#6b4320');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, R * 0.86);
    ctx.strokeStyle = '#2f2f2f';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,22,8,.5)';
    ctx.lineWidth = Math.max(0.6, s * 0.012);
    for (let i = -2; i <= 2; i++) seg(ctx, cx + i * R * 0.3, cy - R * 0.75, cx + i * R * 0.3, cy + R * 0.75);
  },
  C(ctx, x, y, w, hh, s) {
    const p = s * 0.12;
    withShadow(ctx, s, () => { ctx.fillStyle = '#a0713f'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    ctx.strokeStyle = '#5e3e1e';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    seg(ctx, x + p, y + p, x + w - p, y + hh - p);
    seg(ctx, x + w - p, y + p, x + p, y + hh - p);
  },
  S(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 2; i++) {
      const cx = x + w * (0.35 + i * 0.3); const cy = y + hh * (0.4 + i * 0.2);
      withShadow(ctx, s, () => { ctx.fillStyle = shade('#c2a874', (rand() - 0.5) * 0.15); ellipse(ctx, cx, cy, s * 0.2, s * 0.24, rand()); });
      ctx.fillStyle = '#7a6440';
      circle(ctx, cx, cy - s * 0.17, s * 0.04);
    }
  },
  K(ctx, x, y, w, hh, s) {
    const bw = w * 0.7; const bh = hh * 0.5; const bx = x + (w - bw) / 2; const by = y + (hh - bh) / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#7a4a1f'; rrect(ctx, bx, by, bw, bh, s * 0.05); ctx.fill(); });
    ctx.fillStyle = '#d4a63c';
    ctx.fillRect(bx + bw * 0.18, by, bw * 0.08, bh);
    ctx.fillRect(bx + bw * 0.74, by, bw * 0.08, bh);
    ctx.fillRect(bx, by + bh * 0.42, bw, bh * 0.12);
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(bx + bw * 0.45, by + bh * 0.36, bw * 0.1, bh * 0.25);
  },
  X(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 16; i++) {
      const cx = x + w * (0.2 + rand() * 0.6); const cy = y + hh * (0.2 + rand() * 0.6);
      ctx.fillStyle = '#8a6514';
      circle(ctx, cx + s * 0.01, cy + s * 0.015, s * 0.06);
      ctx.fillStyle = rand() < 0.15 ? '#e05b8b' : rand() < 0.1 ? '#5bc0e0' : '#f2c14e';
      circle(ctx, cx, cy, s * 0.055);
    }
  },
  t(ctx, x, y, w, hh, s, rand) {
    const p = s * 0.1;
    withShadow(ctx, s, () => { ctx.fillStyle = '#c18b4f'; rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.08); ctx.fill(); }, 0.55);
    ctx.strokeStyle = '#4a2c12';
    ctx.lineWidth = Math.max(1, s * 0.035);
    rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.08);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,50,15,.35)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    for (let i = 1; i < 4; i++) seg(ctx, x + p * 1.5, y + p + i * (hh - 2 * p) / 4, x + w - p * 1.5, y + p + i * (hh - 2 * p) / 4);
    const n = Math.max(1, Math.round((w * hh) / (s * s)));
    for (let i = 0; i < n + 1; i++) {
      const cx = x + w * (0.25 + rand() * 0.5); const cy = y + hh * (0.25 + rand() * 0.5);
      ctx.fillStyle = i % 2 ? '#e8dcc0' : '#7a5a3a';
      circle(ctx, cx, cy, s * (i % 2 ? 0.09 : 0.065));
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.15)' : '#e7c66a';
      circle(ctx, cx, cy, s * (i % 2 ? 0.05 : 0.04));
    }
  },
  h(ctx, x, y, w, hh, s) {
    const R = s * 0.19;
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#a86e38'; rrect(ctx, cx - R, cy - R, R * 2, R * 2, R * 0.45); ctx.fill(); }, 0.55);
    ctx.strokeStyle = '#3e240e';
    ctx.lineWidth = Math.max(1, s * 0.03);
    rrect(ctx, cx - R, cy - R, R * 2, R * 2, R * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#6b4120';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 0.5);
  },
  z(ctx, x, y, w, hh, s, rand, env) {
    const m = s * 0.08; const k = s * 0.07;
    const L = env.hasProp('z', -1, 0); const Rr = env.hasProp('z', 1, 0); const T = env.hasProp('z', 0, -1); const B = env.hasProp('z', 0, 1);
    const ox = x + (L ? 0 : m); const oy = y + (T ? 0 : m); const ow = w - (L ? 0 : m) - (Rr ? 0 : m); const oh = hh - (T ? 0 : m) - (B ? 0 : m);
    withShadow(ctx, s, () => { ctx.fillStyle = '#4e2f15'; ctx.fillRect(ox, oy, ow, oh); }, 0.45);
    ctx.fillStyle = '#9a6535';
    ctx.fillRect(ox + (L ? 0 : k), oy + (T ? 0 : k), ow - (L ? 0 : k) - (Rr ? 0 : k), oh - (T ? 0 : k) - (B ? 0 : k));
    ctx.fillStyle = 'rgba(255,230,180,.12)';
    ctx.fillRect(ox + (L ? 0 : k), oy + (T ? 0 : k), ow - (L ? 0 : k) - (Rr ? 0 : k), Math.max(1, s * 0.05));
    if (rand() < 0.45) {
      const cx = x + w * (0.3 + rand() * 0.4); const cy = y + hh * (0.35 + rand() * 0.3);
      ctx.fillStyle = '#d9c9a3'; circle(ctx, cx, cy, s * 0.08);
      ctx.fillStyle = '#e7b84a'; circle(ctx, cx, cy, s * 0.05);
    }
  },
  q(ctx, x, y, w, hh, s, rand) {
    const along = w >= hh;
    const bw = along ? w - s * 0.1 : s * 0.38; const bh = along ? s * 0.38 : hh - s * 0.1;
    const bx = x + (w - bw) / 2; const by = y + (hh - bh) / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#4a2e15'; ctx.fillRect(bx, by, bw, bh); });
    const n = Math.round((along ? bw : bh) / (s * 0.09));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = ['#8a2b2b', '#2b5d8a', '#2f7d57', '#b8862b', '#5e3d82'][Math.floor(rand() * 5)];
      if (along) ctx.fillRect(bx + s * 0.03 + i * s * 0.09, by + s * 0.05, s * 0.07, bh - s * 0.1);
      else ctx.fillRect(bx + s * 0.05, by + s * 0.03 + i * s * 0.09, bw - s * 0.1, s * 0.07);
    }
  },
  k(ctx, x, y, w, hh, s) {
    const bw = w * 0.72; const bh = hh * 0.88; const bx = x + (w - bw) / 2; const by = y + (hh - bh) / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5a3818'; ctx.fillRect(bx, by, bw, bh); });
    ctx.fillStyle = '#efe6d2';
    rrect(ctx, bx + bw * 0.12, by + bh * 0.06, bw * 0.76, bh * 0.2, s * 0.04); ctx.fill();
    ctx.fillStyle = '#7d2f3a';
    ctx.fillRect(bx + bw * 0.06, by + bh * 0.34, bw * 0.88, bh * 0.6);
  },
  O(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.4;
    withShadow(ctx, s, () => { ctx.fillStyle = '#6d675d'; ctx.fillRect(cx - R * 1.1, cy - R * 1.1, R * 2.2, R * 2.2); }, 0.5);
    const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#d8d2c6'); g.addColorStop(1, '#827b70');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, R);
  },
  E(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#6d675d'; ctx.fillRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8); });
    emoji(ctx, '🗿', cx, cy, s * 0.62);
  },
  Y(ctx, x, y, w, hh, s) {
    const p = s * 0.12;
    withShadow(ctx, s, () => { ctx.fillStyle = '#9a948a'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    ctx.fillStyle = '#7d1f2a';
    if (w >= hh) ctx.fillRect(x + w * 0.35, y + p, w * 0.3, hh - 2 * p); else ctx.fillRect(x + p, y + hh * 0.35, w - 2 * p, hh * 0.3);
    ctx.save();
    ctx.shadowColor = '#ffcf6b'; ctx.shadowBlur = s * 0.2;
    ctx.fillStyle = '#ffe28a';
    circle(ctx, x + p * 2, y + p * 2, s * 0.05);
    circle(ctx, x + w - p * 2, y + hh - p * 2, s * 0.05);
    ctx.restore();
  },
  Z(ctx, x, y, w, hh, s) {
    const p = s * 0.1;
    withShadow(ctx, s, () => { ctx.fillStyle = '#86807a'; rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.12); ctx.fill(); });
    ctx.strokeStyle = 'rgba(40,36,30,.5)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    rrect(ctx, x + p * 2, y + p * 2, w - 4 * p, hh - 4 * p, s * 0.08); ctx.stroke();
    const along = w >= hh;
    if (along) { seg(ctx, x + w * 0.3, y + hh / 2, x + w * 0.7, y + hh / 2); seg(ctx, x + w * 0.4, y + hh * 0.32, x + w * 0.4, y + hh * 0.68); }
    else { seg(ctx, x + w / 2, y + hh * 0.3, x + w / 2, y + hh * 0.7); seg(ctx, x + w * 0.32, y + hh * 0.4, x + w * 0.68, y + hh * 0.4); }
  },
  G(ctx, x, y, w, hh, s) {
    const bw = s * 0.5; const bh = s * 0.36; const bx = x + (w - bw) / 2; const by = y + (hh - bh) / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#8e8a84'; rrect(ctx, bx, by, bw, bh, s * 0.12); ctx.fill(); });
    ctx.strokeStyle = 'rgba(40,36,30,.6)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    seg(ctx, bx + bw / 2, by + bh * 0.2, bx + bw / 2, by + bh * 0.8);
    seg(ctx, bx + bw * 0.3, by + bh * 0.42, bx + bw * 0.7, by + bh * 0.42);
  },
  j(ctx, x, y, w, hh, s, rand) {
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const cx = x + w * (0.25 + rand() * 0.5); const cy = y + hh * (0.25 + rand() * 0.5); const a = rand() * 3; seg(ctx, cx - Math.cos(a) * s * 0.14, cy - Math.sin(a) * s * 0.14, cx + Math.cos(a) * s * 0.14, cy + Math.sin(a) * s * 0.14); }
    emoji(ctx, '💀', x + w * (0.35 + rand() * 0.3), y + hh * (0.35 + rand() * 0.3), s * 0.3, (rand() - 0.5));
  },
  y(ctx, x, y, w, hh, s) {
    ctx.strokeStyle = 'rgba(235,235,235,.55)';
    ctx.lineWidth = Math.max(0.6, s * 0.012);
    const cx = x + w / 2; const cy = y + hh / 2;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; seg(ctx, cx, cy, cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5); }
    for (let rr = 1; rr <= 3; rr++) {
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * s * 0.14 * rr, cy + Math.sin(a) * s * 0.14 * rr); }
      ctx.stroke();
    }
  },
  F(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2;
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; ctx.fillStyle = shade('#7d776d', (rand() - 0.5) * 0.3); circle(ctx, cx + Math.cos(a) * s * 0.33, cy + Math.sin(a) * s * 0.33, s * 0.08); }
    ctx.save();
    ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = s * 0.45;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.28);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#ffb347'); g.addColorStop(1, '#d9480f');
    ctx.fillStyle = g;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + rand(); ellipse(ctx, cx + Math.cos(a) * s * 0.08, cy + Math.sin(a) * s * 0.08, s * 0.14, s * 0.09, a); }
    circle(ctx, cx, cy, s * 0.16);
    ctx.restore();
  },
  L(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#2e2b28'; circle(ctx, cx, cy, s * 0.3); });
    ctx.fillStyle = '#4b4641';
    circle(ctx, cx, cy, s * 0.24);
    ctx.save();
    ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = s * 0.4;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffa53c'); g.addColorStop(1, '#c0390b');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, s * 0.19);
    ctx.restore();
  },
  a(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.fillStyle = '#4a2f18';
    ctx.fillRect(cx - s * 0.04, cy - s * 0.04, s * 0.08, s * 0.24);
    ctx.save();
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = s * 0.35;
    ctx.fillStyle = '#ffd36b';
    ellipse(ctx, cx, cy - s * 0.08, s * 0.08, s * 0.12);
    ctx.fillStyle = '#fff4c4';
    ellipse(ctx, cx, cy - s * 0.06, s * 0.035, s * 0.06);
    ctx.restore();
  },
  f(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.46;
    withShadow(ctx, s, () => { ctx.fillStyle = '#8f897f'; circle(ctx, cx, cy, R); });
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    g.addColorStop(0, '#7fc4e2'); g.addColorStop(1, '#2f6f94');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, R * 0.8);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    for (const k of [0.35, 0.55]) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#a9a398';
    circle(ctx, cx, cy, R * 0.18);
  },
  o(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.42;
    withShadow(ctx, s, () => { ctx.fillStyle = '#7d776d'; circle(ctx, cx, cy, R); });
    ctx.fillStyle = '#0d1a22';
    circle(ctx, cx, cy, R * 0.66);
    ctx.fillStyle = '#6b4320';
    ctx.fillRect(cx - R * 1.05, cy - s * 0.04, R * 2.1, s * 0.08);
  },
  u(ctx, x, y, w, hh, s) {
    const p = s * 0.08;
    withShadow(ctx, s, () => { ctx.fillStyle = '#b49a6a'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(x + w / 2, y + p, w / 2 - p, hh - 2 * p);
    ctx.strokeStyle = '#6e5a35';
    ctx.lineWidth = Math.max(1, s * 0.04);
    seg(ctx, x + w / 2, y + p, x + w / 2, y + hh - p);
    ctx.fillStyle = '#3a2d18';
    ctx.fillRect(x + w / 2 - s * 0.12, y + hh - p - s * 0.18, s * 0.24, s * 0.18);
  },
  V(ctx, x, y, w, hh, s) {
    const along = w >= hh;
    ctx.fillStyle = '#1f1a15';
    const wheels = along ? [[0.18, 0.02], [0.82, 0.02], [0.18, 0.98], [0.82, 0.98]] : [[0.02, 0.18], [0.02, 0.82], [0.98, 0.18], [0.98, 0.82]];
    for (const [a, b] of wheels) ellipse(ctx, x + w * a, y + hh * b, along ? s * 0.16 : s * 0.06, along ? s * 0.06 : s * 0.16);
    const p = s * 0.12;
    withShadow(ctx, s, () => { ctx.fillStyle = '#7a5230'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    ctx.strokeStyle = 'rgba(40,22,8,.55)';
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    const n = Math.round((along ? hh : w) / (s * 0.25));
    for (let i = 1; i < n; i++) along ? seg(ctx, x + p, y + p + i * (hh - 2 * p) / n, x + w - p, y + p + i * (hh - 2 * p) / n) : seg(ctx, x + p + i * (w - 2 * p) / n, y + p, x + p + i * (w - 2 * p) / n, y + hh - p);
  },
  g(ctx, x, y, w, hh, s) {
    const p = s * 0.12;
    ctx.fillStyle = 'rgba(10,10,10,.55)';
    ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    ctx.strokeStyle = '#4b4b4b';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    for (let i = 1; i < 4; i++) { seg(ctx, x + p + i * (w - 2 * p) / 4, y + p, x + p + i * (w - 2 * p) / 4, y + hh - p); seg(ctx, x + p, y + p + i * (hh - 2 * p) / 4, x + w - p, y + p + i * (hh - 2 * p) / 4); }
  },
  n(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => {
      ctx.fillStyle = '#3b3f45';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.36, cy - s * 0.14); ctx.lineTo(cx + s * 0.2, cy - s * 0.14); ctx.lineTo(cx + s * 0.38, cy - s * 0.04);
      ctx.lineTo(cx + s * 0.2, cy + s * 0.04); ctx.lineTo(cx + s * 0.14, cy + s * 0.18); ctx.lineTo(cx - s * 0.2, cy + s * 0.18); ctx.lineTo(cx - s * 0.2, cy + s * 0.02);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(cx - s * 0.32, cy - s * 0.12, s * 0.5, s * 0.04);
  },
  A(ctx, x, y, w, hh, s, rand, env) {
    const cx = x + w / 2; const cy = y + hh / 2;
    const dir = env.isWall(0, -1) ? -Math.PI / 2 : env.isWall(0, 1) ? Math.PI / 2 : env.isWall(-1, 0) ? Math.PI : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir);
    withShadow(ctx, s, () => { ctx.fillStyle = '#5a3a1c'; ctx.fillRect(-s * 0.3, -s * 0.24, s * 0.4, s * 0.48); });
    ctx.fillStyle = '#2b2b2e';
    rrect(ctx, -s * 0.22, -s * 0.11, s * 0.7, s * 0.22, s * 0.08); ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, s * 0.46, 0, s * 0.06);
    ctx.restore();
  },
  e(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.fillStyle = 'rgba(90,60,30,.85)';
    ctx.fillRect(cx - s * 1.4, cy - s * 0.05, s * 2.8, s * 0.1);
    withShadow(ctx, s, () => { ctx.fillStyle = '#6b4626'; circle(ctx, cx, cy, s * 0.3); });
    ctx.strokeStyle = '#3e2914';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.stroke();
  },
  N(ctx, x, y, w, hh, s) {
    ctx.save();
    ctx.strokeStyle = '#ff5a4f';
    ctx.setLineDash([s * 0.08, s * 0.06]);
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.strokeRect(x + s * 0.1, y + s * 0.1, w - s * 0.2, hh - s * 0.2);
    ctx.restore();
    emoji(ctx, '⚠️', x + w / 2, y + hh / 2, s * 0.4);
  },
};
// ------------------------------------------------------------ decoración ampliada
// Terrenos nuevos: suelos (mármol, mosaico, rejilla, tablones rotos, tarima), naturaleza (grava, hojarasca, musgo,
// ceniza, campo arado, flores, nieve profunda, juncos, raíces), peligros (arenas movedizas, ácido, ciénaga tóxica)
// y muros (ladrillo, hielo, empalizada, seto).
function marble({ ctx, x, y, s, rand, c, r }) {
  const dark = (c + r) % 2;
  ctx.fillStyle = dark ? '#3a3940' : '#dcd8cf';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.09)' : 'rgba(90,85,80,.28)';
  ctx.lineWidth = Math.max(0.6, s * 0.012);
  ctx.beginPath();
  let px = x + rand() * s; let py = y;
  ctx.moveTo(px, py);
  for (let i = 0; i < 4; i++) { px += (rand() - 0.5) * s * 0.4; py += s * 0.25; ctx.lineTo(px, py); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(x, y, s, s * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = Math.max(0.5, s * 0.01);
  ctx.strokeRect(x, y, s, s);
}
function mosaic({ ctx, x, y, s, rand }) {
  const n = 4; const q = s / n;
  const pal = ['#b4532a', '#d9a066', '#2f6f8f', '#e8dcc0'];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(pal[(i + j + (rand() < 0.2 ? 1 : 0)) % pal.length], (rand() - 0.5) * 0.18);
      ctx.fillRect(x + i * q + q * 0.07, y + j * q + q * 0.07, q * 0.86, q * 0.86);
    }
  }
}
function grate({ ctx, x, y, s }) {
  ctx.fillStyle = '#121314';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = '#5b5e63';
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let i = 0; i <= 4; i++) { seg(ctx, x + i * s / 4, y, x + i * s / 4, y + s); seg(ctx, x, y + i * s / 4, x + s, y + i * s / 4); }
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = Math.max(0.5, s * 0.015);
  for (let i = 0; i <= 4; i++) seg(ctx, x + i * s / 4 - s * 0.02, y, x + i * s / 4 - s * 0.02, y + s);
}
function brokenPlanks(d) {
  planks(d);
  const { ctx, x, y, s, rand } = d;
  ctx.fillStyle = 'rgba(10,6,3,.88)';
  for (let i = 0; i < 2; i++) {
    const px = x + s * (0.1 + rand() * 0.5); const py = y + Math.floor(rand() * 3) * s / 3;
    ctx.beginPath();
    ctx.moveTo(px, py + s * 0.03); ctx.lineTo(px + s * (0.2 + rand() * 0.2), py + s * 0.05); ctx.lineTo(px + s * 0.12, py + s / 3 - s * 0.03);
    ctx.closePath(); ctx.fill();
  }
}
function dais(d) {
  planks(d);
  const { ctx, x, y, s, at } = d;
  ctx.fillStyle = 'rgba(255,225,170,.16)';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#c9963f';
  const b = s * 0.06;
  if (at(0, -1) !== 'J') ctx.fillRect(x, y, s, b);
  if (at(-1, 0) !== 'J') ctx.fillRect(x, y, b, s);
  if (at(1, 0) !== 'J') ctx.fillRect(x + s - b, y, b, s);
  if (at(0, 1) !== 'J') { ctx.fillStyle = 'rgba(30,15,5,.65)'; ctx.fillRect(x, y + s - s * 0.14, s, s * 0.14); }
}
function gravel({ ctx, x, y, s, rand }) { dots(ctx, x, y, s, rand, 26, ['#a39c90', '#6f685e', '#bdb6aa', '#575148'], 0.02, 0.045); }
function leaves({ ctx, x, y, s, rand }) {
  dots(ctx, x, y, s, rand, 4, ['rgba(40,25,10,.35)'], 0.03, 0.06);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = ['#b5651d', '#d4a017', '#8b3a1a', '#a0522d', '#c97c2a'][Math.floor(rand() * 5)];
    ellipse(ctx, x + rand() * s, y + rand() * s, s * 0.065, s * 0.032, rand() * 3);
  }
}
function moss({ ctx, x, y, s, rand }) {
  dots(ctx, x, y, s, rand, 14, ['#567d36', '#2f4a1d', '#6d9443', '#3e6127'], 0.04, 0.09);
  dots(ctx, x, y, s, rand, 6, ['rgba(200,230,140,.25)'], 0.01, 0.02);
}
function ash({ ctx, x, y, s, rand }) {
  dots(ctx, x, y, s, rand, 12, ['#6c6965', '#45423f', '#7d7a75'], 0.02, 0.06);
  if (rand() < 0.35) dots(ctx, x, y, s, rand, 3, ['#ff8a3d', '#ffb347'], 0.01, 0.02);
}
function furrows({ ctx, x, y, s, rand }) {
  dots(ctx, x, y, s, rand, 8, ['rgba(40,25,10,.3)', 'rgba(150,110,70,.3)'], 0.015, 0.035);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const py = y + (i + 0.5) * s / 3;
    ctx.strokeStyle = 'rgba(40,24,10,.6)';
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(x, py + (rand() - 0.5) * s * 0.04);
    for (let k = 1; k <= 4; k++) ctx.lineTo(x + k * s / 4, py + (rand() - 0.5) * s * 0.05);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,120,75,.4)';
    ctx.lineWidth = Math.max(0.6, s * 0.025);
    seg(ctx, x, py + s * 0.08, x + s, py + s * 0.08 + (rand() - 0.5) * s * 0.04);
    for (let k = 0; k < 3; k++) { // brotes en el lomo del surco
      if (rand() < 0.35) continue;
      const bx = x + s * (0.12 + k * 0.33 + rand() * 0.1); const by = py + s * 0.11;
      ctx.strokeStyle = '#6aa84f';
      ctx.lineWidth = Math.max(0.7, s * 0.02);
      seg(ctx, bx, by, bx - s * 0.04, by - s * 0.06);
      seg(ctx, bx, by, bx + s * 0.04, by - s * 0.06);
    }
  }
}
function flowerBed(d) {
  grass(d);
  dots(d.ctx, d.x, d.y, d.s, d.rand, 9, ['#f4e7a1', '#ffffff', '#e9a3c9', '#c94a92', '#7aa7ff', '#ff9a3c'], 0.025, 0.04);
}
function deepSnow({ ctx, x, y, s, rand }) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(150,175,200,.35)';
    ellipse(ctx, x + s * (0.2 + rand() * 0.6), y + s * (0.25 + rand() * 0.6), s * (0.18 + rand() * 0.12), s * 0.07, (rand() - 0.5) * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ellipse(ctx, x + s * (0.2 + rand() * 0.6), y + s * (0.2 + rand() * 0.6), s * (0.14 + rand() * 0.1), s * 0.05, (rand() - 0.5) * 0.6);
  }
}
function reeds({ ctx, x, y, s, rand }) {
  ctx.fillStyle = 'rgba(59,131,165,.35)';
  ellipse(ctx, x + s * 0.5, y + s * 0.6, s * 0.4, s * 0.18, rand());
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const px = x + s * (0.1 + rand() * 0.8); const py = y + s * (0.25 + rand() * 0.7);
    ctx.strokeStyle = rand() < 0.5 ? '#8a9a4a' : '#6b7d3a';
    ctx.lineWidth = Math.max(0.7, s * 0.02);
    seg(ctx, px, py, px + (rand() - 0.5) * s * 0.08, py - s * (0.2 + rand() * 0.12));
    if (rand() < 0.4) { ctx.fillStyle = '#5a3d22'; ellipse(ctx, px, py - s * 0.2, s * 0.02, s * 0.05); }
  }
}
function roots({ ctx, x, y, s, rand }) {
  dirt({ ctx, x, y, s, rand });
  ctx.strokeStyle = '#4a3220';
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = Math.max(1, s * (0.03 + rand() * 0.03));
    ctx.beginPath();
    let px = x + rand() * s; let py = y;
    ctx.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (rand() - 0.5) * s * 0.4; py += s * 0.27; ctx.lineTo(px, py); }
    ctx.stroke();
  }
}
function quicksand({ ctx, x, y, s, rand }) {
  ctx.strokeStyle = 'rgba(120,90,40,.45)';
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  const cx = x + s * (0.4 + rand() * 0.2); const cy = y + s * (0.4 + rand() * 0.2);
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, s * 0.12 * k, rand() * 6, rand() * 6 + 4); ctx.stroke(); }
  dots(ctx, x, y, s, rand, 6, ['#d9bd7c', '#a9874a'], 0.012, 0.025);
}
function acid({ ctx, x, y, s, rand }) {
  const g = ctx.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s * 0.7);
  g.addColorStop(0, '#b6ff6b'); g.addColorStop(1, 'rgba(63,166,58,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  for (let i = 0; i < 4; i++) {
    const cx = x + rand() * s; const cy = y + rand() * s; const rr = s * (0.03 + rand() * 0.05);
    ctx.fillStyle = 'rgba(230,255,180,.55)'; circle(ctx, cx, cy, rr);
    ctx.strokeStyle = 'rgba(30,90,20,.6)'; ctx.lineWidth = Math.max(0.5, s * 0.01);
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
  }
}
function toxicMire({ ctx, x, y, s, rand }) {
  ctx.fillStyle = 'rgba(30,20,40,.45)';
  ellipse(ctx, x + s * (0.3 + rand() * 0.4), y + s * (0.3 + rand() * 0.4), s * 0.3, s * 0.15, rand() * 3);
  dots(ctx, x, y, s, rand, 5, ['rgba(140,220,90,.6)', 'rgba(190,120,220,.5)'], 0.02, 0.045);
}
function brickWall({ ctx, x, y, s, rand, r }) {
  ctx.fillStyle = '#4a2117';
  ctx.fillRect(x, y, s, s);
  const rowsN = 4; const bh = s / rowsN;
  for (let i = 0; i < rowsN; i++) {
    const off = ((r * rowsN + i) % 2) * 0.25;
    for (let k = -1; k < 4; k++) {
      const bx = x + (k + off * 2) * s / 3;
      const x0 = Math.max(x, bx + s * 0.015); const x1 = Math.min(x + s, bx + s / 3 - s * 0.015);
      if (x1 <= x0) continue;
      ctx.fillStyle = shade('#9a4532', (rand() - 0.5) * 0.25);
      ctx.fillRect(x0, y + i * bh + s * 0.015, x1 - x0, bh - s * 0.03);
    }
  }
}
function iceWall({ ctx, x, y, s, rand }) {
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, '#dff3fb'); g.addColorStop(1, '#7fb6d1');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(0.6, s * 0.018);
  for (let i = 0; i < 3; i++) seg(ctx, x + rand() * s, y + rand() * s, x + rand() * s, y + rand() * s);
  ctx.strokeStyle = 'rgba(60,110,140,.45)';
  ctx.strokeRect(x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94);
}
function palisade({ ctx, x, y, s, rand, isWall }) {
  ctx.fillStyle = '#2b1d12';
  ctx.fillRect(x, y, s, s);
  const alongX = isWall(-1, 0) || isWall(1, 0) || !(isWall(0, -1) || isWall(0, 1));
  for (let i = 0; i < 3; i++) {
    const cx = alongX ? x + (i + 0.5) * s / 3 : x + s / 2; const cy = alongX ? y + s / 2 : y + (i + 0.5) * s / 3;
    ctx.fillStyle = shade('#7a5230', (rand() - 0.5) * 0.25);
    circle(ctx, cx, cy, s * 0.16);
    ctx.strokeStyle = 'rgba(40,22,8,.6)';
    ctx.lineWidth = Math.max(0.5, s * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.09, 0, Math.PI * 2); ctx.stroke();
  }
}
function hedge({ ctx, x, y, s, rand }) {
  ctx.fillStyle = '#16301a';
  ctx.fillRect(x, y, s, s);
  dots(ctx, x, y, s, rand, 12, ['#2d5e2c', '#3f7a35', '#234b23'], 0.12, 0.2);
  dots(ctx, x, y, s, rand, 6, ['rgba(160,210,120,.35)'], 0.03, 0.05);
}

// Objetos nuevos. Los iconos (emoji) se pintan con su sombra; el resto, a mano como los de antes.
function iconProp(ctx, ch, x, y, w, hh, s, k = 0.62, glow = null) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = s * 0.35; } else { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetX = s * 0.04; ctx.shadowOffsetY = s * 0.06; }
  emoji(ctx, ch, x + w / 2, y + hh / 2, Math.min(w, hh) * k);
  ctx.restore();
}
function iconScatter(ctx, chars, n, x, y, w, hh, s, rand, k = 0.3) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = s * 0.05; ctx.shadowOffsetY = s * 0.03;
  const count = Math.max(n, Math.round(n * (w * hh) / (s * s)));
  for (let i = 0; i < count; i++) emoji(ctx, chars[Math.floor(rand() * chars.length)], x + w * (0.2 + rand() * 0.6), y + hh * (0.2 + rand() * 0.6), s * k, (rand() - 0.5) * 0.7);
  ctx.restore();
}
// Una pieza alargada que se gira según su forma (banco, valla…): fn dibuja centrada, horizontal, de largo L.
function oriented(ctx, x, y, w, hh, fn) {
  const along = w >= hh;
  ctx.save();
  ctx.translate(x + w / 2, y + hh / 2);
  if (!along) ctx.rotate(Math.PI / 2);
  fn(along ? w : hh, along ? hh : w);
  ctx.restore();
}
function glowDot(ctx, cx, cy, r, color, s) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.35;
  ctx.fillStyle = color;
  circle(ctx, cx, cy, r);
  ctx.restore();
}
// Valla y muro bajo: se unen con las piezas iguales de al lado.
function joined(ctx, x, y, w, hh, s, env, k, thick, paint) {
  const cx = x + w / 2; const cy = y + hh / 2;
  const L = env.hasProp(k, -1, 0); const R = env.hasProp(k, 1, 0); const T = env.hasProp(k, 0, -1); const B = env.hasProp(k, 0, 1);
  const lone = !L && !R && !T && !B;
  const parts = [];
  if (L || R || lone) parts.push([L ? x : cx - (lone ? s * 0.4 : 0), cy - thick / 2, (R ? x + w : cx + (lone ? s * 0.4 : 0)) - (L ? x : cx - (lone ? s * 0.4 : 0)), thick]);
  if (T || B) parts.push([cx - thick / 2, T ? y : cy, thick, (B ? y + hh : cy) - (T ? y : cy)]);
  if ((L || R) && (T || B)) parts.push([cx - thick / 2, cy - thick / 2, thick, thick]);
  paint(parts, cx, cy);
}

Object.assign(PP, {
  // naturaleza
  arbol_otono(ctx, x, y, w, hh, s, rand) { tree(ctx, x, y, w, hh, s, rand, ['#7a2e0e', '#b5541c', '#d98a2b', '#f2c14e']); },
  arbol_muerto(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.48;
    ctx.lineCap = 'round';
    withShadow(ctx, s, () => {
      ctx.strokeStyle = '#4a3a2c';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + rand() * 0.6;
        const mx = cx + Math.cos(a) * R * 0.55; const my = cy + Math.sin(a) * R * 0.55;
        ctx.lineWidth = Math.max(1, s * 0.06); seg(ctx, cx, cy, mx, my);
        ctx.lineWidth = Math.max(0.8, s * 0.03);
        seg(ctx, mx, my, cx + Math.cos(a + 0.4) * R, cy + Math.sin(a + 0.4) * R);
        seg(ctx, mx, my, cx + Math.cos(a - 0.35) * R * 0.9, cy + Math.sin(a - 0.35) * R * 0.9);
      }
    });
    ctx.fillStyle = '#5a4634';
    circle(ctx, cx, cy, R * 0.16);
  },
  palmera(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.5;
    withShadow(ctx, s, () => {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + rand() * 0.4;
        ctx.fillStyle = k % 2 ? '#3f7d32' : '#4f9a3c';
        ellipse(ctx, cx + Math.cos(a) * R * 0.48, cy + Math.sin(a) * R * 0.48, R * 0.5, R * 0.14, a);
      }
    });
    ctx.fillStyle = '#7a5a2a'; circle(ctx, cx, cy, R * 0.13);
    ctx.fillStyle = '#5a3d1c';
    for (const [dx, dy] of [[-1, 0], [1, 0.3], [0.2, -1]]) circle(ctx, cx + dx * R * 0.13, cy + dy * R * 0.13, R * 0.07);
  },
  tocon(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.3;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5e3d22'; circle(ctx, cx, cy, R); });
    ctx.fillStyle = '#c49a62'; circle(ctx, cx, cy, R * 0.82);
    ctx.strokeStyle = '#8a6238'; ctx.lineWidth = Math.max(0.6, s * 0.015);
    for (const k of [0.55, 0.3]) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); }
  },
  piedras(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 5; i++) {
      const cx = x + w * (0.2 + rand() * 0.6); const cy = y + hh * (0.2 + rand() * 0.6); const R = s * (0.07 + rand() * 0.07);
      withShadow(ctx, s * 0.5, () => {
        ctx.fillStyle = shade('#8f897f', (rand() - 0.5) * 0.35);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const rr = R * (0.7 + rand() * 0.4); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      });
    }
  },
  estalagmita(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.36;
    withShadow(ctx, s, () => {
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.05, cx, cy, R);
      g.addColorStop(0, '#d8cfc0'); g.addColorStop(0.5, '#8d8273'); g.addColorStop(1, '#4e463c');
      ctx.fillStyle = g; circle(ctx, cx, cy, R);
    });
    ctx.fillStyle = '#efe8dc'; circle(ctx, cx - R * 0.15, cy - R * 0.15, R * 0.12);
  },
  cactus(ctx, x, y, w, hh, s) { iconProp(ctx, '🌵', x, y, w, hh, s, 0.7); },
  flores(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🌼', '🌸', '🌺', '🌷'], 5, x, y, w, hh, s, rand, 0.26); },
  helecho(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🌿'], 3, x, y, w, hh, s, rand, 0.42); },
  setas(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🍄'], 4, x, y, w, hh, s, rand, 0.24); },
  nenufares(ctx, x, y, w, hh, s, rand) {
    const n = Math.max(3, Math.round(3 * (w * hh) / (s * s)));
    for (let i = 0; i < n; i++) {
      const cx = x + w * (0.2 + rand() * 0.6); const cy = y + hh * (0.2 + rand() * 0.6); const R = s * (0.11 + rand() * 0.07); const a = rand() * 6;
      ctx.fillStyle = rand() < 0.5 ? '#3f8a3a' : '#4f9a45';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a + 0.35, a + Math.PI * 2 - 0.35); ctx.closePath(); ctx.fill();
      if (rand() < 0.35) { ctx.fillStyle = '#f2a7c8'; circle(ctx, cx, cy, R * 0.32); ctx.fillStyle = '#ffe28a'; circle(ctx, cx, cy, R * 0.12); }
    }
  },
  charco(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (0.3 + rand() * 0.4); const cy = y + hh * (0.3 + rand() * 0.4);
      ctx.fillStyle = 'rgba(40,90,120,.55)';
      ellipse(ctx, cx, cy, w * (0.18 + rand() * 0.12), hh * (0.12 + rand() * 0.08), rand());
    }
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ellipse(ctx, x + w * 0.42, y + hh * 0.42, w * 0.1, hh * 0.03, -0.3);
  },
  nido(ctx, x, y, w, hh, s) { iconProp(ctx, '🪺', x, y, w, hh, s, 0.62); },
  // mobiliario
  banco(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14; const T = s * 0.3;
      withShadow(ctx, s, () => { ctx.fillStyle = '#8a5a2e'; rrect(ctx, -len / 2, -T / 2, len, T, s * 0.05); ctx.fill(); });
      ctx.strokeStyle = 'rgba(40,22,8,.5)'; ctx.lineWidth = Math.max(0.6, s * 0.015);
      seg(ctx, -len / 2 + s * 0.05, 0, len / 2 - s * 0.05, 0);
    });
  },
  mesa_redonda(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.4;
    withShadow(ctx, s, () => { ctx.fillStyle = '#b07a42'; circle(ctx, cx, cy, R); }, 0.55);
    ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) { const a = rand() * 6; ctx.fillStyle = '#e8dcc0'; circle(ctx, cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, s * 0.07); }
  },
  taburete(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#8a5a2e'; circle(ctx, cx, cy, s * 0.16); });
    ctx.fillStyle = '#a8743f'; circle(ctx, cx, cy, s * 0.11);
  },
  trono(ctx, x, y, w, hh, s) {
    const bw = Math.min(w, hh) * 0.7; const bx = x + (w - bw) / 2; const by = y + (hh - bw) / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#c9963f'; rrect(ctx, bx, by, bw, bw, s * 0.06); ctx.fill(); });
    ctx.fillStyle = '#8a1f2a'; ctx.fillRect(bx + bw * 0.15, by + bw * 0.3, bw * 0.7, bw * 0.6);
    ctx.fillStyle = '#e7c66a'; ctx.fillRect(bx, by, bw, bw * 0.22);
    ctx.fillStyle = '#5bc0e0'; circle(ctx, bx + bw / 2, by + bw * 0.11, s * 0.04);
  },
  armario(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.12; const T = s * 0.5;
      withShadow(ctx, s, () => { ctx.fillStyle = '#5a3818'; ctx.fillRect(-len / 2, -T / 2, len, T); });
      ctx.strokeStyle = 'rgba(20,10,4,.7)'; ctx.lineWidth = Math.max(1, s * 0.025);
      seg(ctx, 0, -T / 2, 0, T / 2);
      ctx.fillStyle = '#d4a63c'; circle(ctx, -s * 0.05, 0, s * 0.03); circle(ctx, s * 0.05, 0, s * 0.03);
    });
  },
  escritorio(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.12; const T = s * 0.55;
      withShadow(ctx, s, () => { ctx.fillStyle = '#7a4a22'; ctx.fillRect(-len / 2, -T / 2, len, T); });
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(-len * 0.25, -T * 0.3, len * 0.3, T * 0.5);
      ctx.fillStyle = '#1b1b1b'; circle(ctx, len * 0.22, -T * 0.1, s * 0.04);
      ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = Math.max(0.8, s * 0.015); seg(ctx, len * 0.22, -T * 0.1, len * 0.34, -T * 0.35);
    });
  },
  alfombra(ctx, x, y, w, hh, s) {
    const p = s * 0.08;
    ctx.fillStyle = '#7b2330'; rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.04); ctx.fill();
    ctx.strokeStyle = '#c9963f'; ctx.lineWidth = Math.max(1, s * 0.05);
    rrect(ctx, x + p * 2.2, y + p * 2.2, w - 4.4 * p, hh - 4.4 * p, s * 0.03); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,190,90,.45)'; ctx.lineWidth = Math.max(1, s * 0.03);
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.beginPath(); ctx.moveTo(cx, y + hh * 0.25); ctx.lineTo(x + w * 0.75, cy); ctx.lineTo(cx, y + hh * 0.75); ctx.lineTo(x + w * 0.25, cy); ctx.closePath(); ctx.stroke();
  },
  banera(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.12; const T = s * 0.6;
      withShadow(ctx, s, () => { ctx.fillStyle = '#d9d4cb'; rrect(ctx, -len / 2, -T / 2, len, T, T / 2); ctx.fill(); });
      ctx.fillStyle = '#6fb3d6'; rrect(ctx, -len / 2 + s * 0.07, -T / 2 + s * 0.07, len - s * 0.14, T - s * 0.14, T / 2 - s * 0.07); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(ctx, -len * 0.2, -T * 0.1, s * 0.04); circle(ctx, -len * 0.1, 0, s * 0.03);
    });
  },
  biombo(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.1; const n = Math.max(3, Math.round(len / (s * 0.3)));
      withShadow(ctx, s, () => {
        ctx.beginPath(); ctx.moveTo(-len / 2, 0);
        for (let i = 1; i <= n; i++) ctx.lineTo(-len / 2 + (i * len) / n, (i % 2 ? -1 : 1) * s * 0.08);
        ctx.strokeStyle = '#6b4626'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.stroke();
      });
      ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.moveTo(-len / 2, 0);
      for (let i = 1; i <= n; i++) ctx.lineTo(-len / 2 + (i * len) / n, (i % 2 ? -1 : 1) * s * 0.08);
      ctx.stroke();
    });
  },
  espejo(ctx, x, y, w, hh, s) { iconProp(ctx, '🪞', x, y, w, hh, s, 0.6); },
  jarron(ctx, x, y, w, hh, s) { iconProp(ctx, '🏺', x, y, w, hh, s, 0.6); },
  maceta(ctx, x, y, w, hh, s) { iconProp(ctx, '🪴', x, y, w, hh, s, 0.66); },
  // taberna y cocina
  tonel(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14; const T = s * 0.6;
      withShadow(ctx, s, () => {
        const g = ctx.createLinearGradient(0, -T / 2, 0, T / 2);
        g.addColorStop(0, '#6b4320'); g.addColorStop(0.5, '#b07a42'); g.addColorStop(1, '#5a3818');
        ctx.fillStyle = g; rrect(ctx, -len / 2, -T / 2, len, T, T * 0.35); ctx.fill();
      });
      ctx.fillStyle = '#2f2f2f';
      for (const k of [-0.32, 0.32]) ctx.fillRect(len * k - s * 0.025, -T / 2, s * 0.05, T);
      ctx.fillStyle = '#3a2a10'; circle(ctx, len / 2 - s * 0.06, 0, s * 0.04);
    });
  },
  caldero(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.36;
    withShadow(ctx, s, () => { ctx.fillStyle = '#1f1d1b'; circle(ctx, cx, cy, R); });
    ctx.save(); ctx.shadowColor = '#7dff6b'; ctx.shadowBlur = s * 0.25;
    ctx.fillStyle = '#4fbf3a'; circle(ctx, cx, cy, R * 0.78); ctx.restore();
    dots(ctx, cx - R * 0.6, cy - R * 0.6, R * 1.2, rand, 5, ['rgba(220,255,200,.75)'], 0.04, 0.08);
  },
  horno(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.42;
    withShadow(ctx, s, () => { ctx.fillStyle = '#8a5a3c'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#6b3f26'; circle(ctx, cx, cy, R * 0.75);
    glowDot(ctx, cx, cy + R * 0.35, R * 0.25, '#ff8a3d', s);
  },
  jarras(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🍺', '🍷', '🫙', '🍶'], 3, x, y, w, hh, s, rand, 0.28); },
  comida(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🍗', '🍞', '🧀', '🍎', '🥩'], 3, x, y, w, hh, s, rand, 0.28); },
  chimenea(ctx, x, y, w, hh, s, rand, env) {
    const dir = env.isWall(0, -1) ? 0 : env.isWall(0, 1) ? Math.PI : env.isWall(-1, 0) ? -Math.PI / 2 : env.isWall(1, 0) ? Math.PI / 2 : 0;
    ctx.save(); ctx.translate(x + w / 2, y + hh / 2); ctx.rotate(dir);
    withShadow(ctx, s, () => { ctx.fillStyle = '#6d675d'; ctx.fillRect(-w / 2 + s * 0.05, -hh / 2, w - s * 0.1, hh * 0.7); });
    ctx.fillStyle = '#1d1a17'; ctx.fillRect(-w / 2 + s * 0.18, -hh / 2 + s * 0.05, w - s * 0.36, hh * 0.45);
    ctx.save(); ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = s * 0.4;
    const g = ctx.createRadialGradient(0, -hh * 0.2, 0, 0, -hh * 0.2, s * 0.25);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffa53c'); g.addColorStop(1, 'rgba(192,57,11,0)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2 + s * 0.18, -hh / 2 + s * 0.05, w - s * 0.36, hh * 0.45);
    ctx.restore(); ctx.restore();
  },
  // biblioteca y magia
  libros(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 4; i++) {
      const cx = x + w * (0.3 + rand() * 0.4); const cy = y + hh * (0.3 + rand() * 0.4);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((rand() - 0.5) * 1.2);
      withShadow(ctx, s * 0.6, () => { ctx.fillStyle = ['#8a2b2b', '#2b5d8a', '#2f7d57', '#5e3d82'][i % 4]; ctx.fillRect(-s * 0.13, -s * 0.09, s * 0.26, s * 0.18); });
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(-s * 0.11, s * 0.05, s * 0.22, s * 0.03);
      ctx.restore();
    }
  },
  alquimia(ctx, x, y, w, hh, s, rand) {
    PP.t(ctx, x, y, w, hh, s, () => 0.5);
    const n = Math.max(3, Math.round((w * hh) / (s * s)) + 2);
    for (let i = 0; i < n; i++) {
      const cx = x + w * (0.25 + rand() * 0.5); const cy = y + hh * (0.25 + rand() * 0.5);
      glowDot(ctx, cx, cy, s * 0.05, ['#7dff6b', '#6bd5ff', '#ff6bd5', '#ffd36b'][i % 4], s);
    }
  },
  bola_cristal(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#4a2e15'; circle(ctx, cx, cy, s * 0.26); });
    ctx.save(); ctx.shadowColor = '#c08bff'; ctx.shadowBlur = s * 0.4;
    const g = ctx.createRadialGradient(cx - s * 0.06, cy - s * 0.06, s * 0.02, cx, cy, s * 0.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#c9a7ff'); g.addColorStop(1, '#5e3d82');
    ctx.fillStyle = g; circle(ctx, cx, cy, s * 0.2); ctx.restore();
  },
  runas(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.45;
    ctx.save(); ctx.shadowColor = '#7ad7ff'; ctx.shadowBlur = s * 0.25;
    ctx.strokeStyle = 'rgba(140,220,255,.9)'; ctx.lineWidth = Math.max(1, s * 0.03);
    for (const k of [1, 0.78]) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath();
    for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,230,255,.9)';
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + rand() * 0.2; ctx.fillRect(cx + Math.cos(a) * R * 0.89 - s * 0.015, cy + Math.sin(a) * R * 0.89 - s * 0.03, s * 0.03, s * 0.06); }
    ctx.restore();
  },
  portal(ctx, x, y, w, hh, s, rand) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.44;
    ctx.save(); ctx.shadowColor = '#b26bff'; ctx.shadowBlur = s * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, '#120624'); g.addColorStop(0.55, '#5e2a9a'); g.addColorStop(1, '#d5a6ff');
    ctx.fillStyle = g; circle(ctx, cx, cy, R); ctx.restore();
    ctx.strokeStyle = 'rgba(240,220,255,.7)'; ctx.lineWidth = Math.max(1, s * 0.025);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + k * 0.2), rand() * 6, rand() * 6 + 3.5); ctx.stroke(); }
  },
  atril(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5a3818'; ctx.fillRect(cx - s * 0.22, cy - s * 0.16, s * 0.44, s * 0.32); });
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(cx - s * 0.18, cy - s * 0.12, s * 0.17, s * 0.24); ctx.fillRect(cx + s * 0.01, cy - s * 0.12, s * 0.17, s * 0.24);
    ctx.fillStyle = '#8a2b2b'; ctx.fillRect(cx - s * 0.005, cy - s * 0.14, s * 0.01, s * 0.28);
  },
  telescopio(ctx, x, y, w, hh, s) { iconProp(ctx, '🔭', x, y, w, hh, s, 0.62); },
  // piedra y templo
  obelisco(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.34;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5d584f'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }, 0.6);
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, '#b9b2a5'); g.addColorStop(1, '#6d675d');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.8, cy - R * 0.8); ctx.lineTo(cx + R * 0.8, cy - R * 0.8); ctx.lineTo(cx + R * 0.8, cy + R * 0.8); ctx.lineTo(cx - R * 0.8, cy + R * 0.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,36,30,.45)'; ctx.lineWidth = Math.max(0.6, s * 0.015);
    seg(ctx, cx - R * 0.8, cy - R * 0.8, cx + R * 0.8, cy + R * 0.8); seg(ctx, cx + R * 0.8, cy - R * 0.8, cx - R * 0.8, cy + R * 0.8);
  },
  columna_rota(ctx, x, y, w, hh, s, rand) {
    PP.O(ctx, x, y, w, hh, s);
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.fillStyle = 'rgba(40,36,30,.55)';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.18); ctx.lineTo(cx + s * 0.2, cy + s * 0.05); ctx.lineTo(cx - s * 0.05, cy + s * 0.15); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = shade('#a39c90', (rand() - 0.5) * 0.3); circle(ctx, x + w * (0.15 + rand() * 0.7), y + hh * (0.75 + rand() * 0.15), s * 0.05); }
  },
  urna(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#7d776d'; circle(ctx, cx, cy, s * 0.24); });
    const g = ctx.createRadialGradient(cx - s * 0.06, cy - s * 0.06, s * 0.02, cx, cy, s * 0.2);
    g.addColorStop(0, '#d8d2c6'); g.addColorStop(1, '#8a8378');
    ctx.fillStyle = g; circle(ctx, cx, cy, s * 0.19);
    ctx.fillStyle = '#c9963f'; circle(ctx, cx, cy, s * 0.06);
  },
  gargola(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#6d675d'; ctx.fillRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8); });
    emoji(ctx, '🦇', cx, cy, s * 0.55);
  },
  pila(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#9a948a'; circle(ctx, cx, cy, s * 0.32); });
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.24);
    g.addColorStop(0, '#bfe6f5'); g.addColorStop(1, '#4a8fb0');
    ctx.fillStyle = g; circle(ctx, cx, cy, s * 0.24);
  },
  campana(ctx, x, y, w, hh, s) { iconProp(ctx, '🔔', x, y, w, hh, s, 0.62); },
  // mazmorra
  ataud(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14; const T = s * 0.5;
      withShadow(ctx, s, () => {
        ctx.fillStyle = '#3e2a1a';
        ctx.beginPath(); ctx.moveTo(-len / 2, -T * 0.3); ctx.lineTo(-len * 0.2, -T / 2); ctx.lineTo(len / 2, -T * 0.35); ctx.lineTo(len / 2, T * 0.35); ctx.lineTo(-len * 0.2, T / 2); ctx.lineTo(-len / 2, T * 0.3); ctx.closePath(); ctx.fill();
      });
      ctx.strokeStyle = '#a0a0a0'; ctx.lineWidth = Math.max(1, s * 0.03);
      seg(ctx, -len * 0.15, 0, len * 0.15, 0); seg(ctx, -len * 0.05, -T * 0.15, -len * 0.05, T * 0.15);
    });
  },
  cepo(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14; const T = s * 0.24;
      withShadow(ctx, s, () => { ctx.fillStyle = '#6b4626'; ctx.fillRect(-len / 2, -T / 2, len, T); });
      ctx.fillStyle = '#1d1a17';
      for (const k of [-0.25, 0, 0.25]) circle(ctx, len * k, 0, s * (k ? 0.04 : 0.065));
    });
  },
  cadenas(ctx, x, y, w, hh, s, rand) {
    let px = x + w * 0.18; let py = y + hh * (0.3 + rand() * 0.4);
    const links = [];
    for (let i = 0; i < 7; i++) { links.push([px, py, rand() * 1.2 - 0.6 + (i % 2) * 1.2]); px += w * 0.1; py += (rand() - 0.5) * s * 0.08; }
    for (const [color, width] of [['#1d1f22', 0.06], ['#c8ccd2', 0.03]]) { // contorno oscuro y eslabón claro: se ve en cualquier suelo
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * width);
      for (const [lx, ly, a] of links) { ctx.beginPath(); ctx.ellipse(lx, ly, s * 0.055, s * 0.032, a, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.fillStyle = '#3b3f45'; circle(ctx, x + w * 0.16, links[0][1], s * 0.07);
  },
  reja(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L; const T = s * 0.14;
      withShadow(ctx, s, () => { ctx.fillStyle = '#3b3f45'; ctx.fillRect(-len / 2, -T / 2, len, T); });
      ctx.fillStyle = '#7a7e85';
      for (let i = 0; i < Math.round(len / (s * 0.16)); i++) circle(ctx, -len / 2 + s * 0.08 + i * s * 0.16, 0, s * 0.045);
    });
  },
  calaveras(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['💀'], 5, x, y, w, hh, s, rand, 0.26); },
  sangre(ctx, x, y, w, hh, s, rand) {
    ctx.fillStyle = 'rgba(120,10,10,.75)';
    for (let i = 0; i < 4; i++) ellipse(ctx, x + w * (0.3 + rand() * 0.4), y + hh * (0.3 + rand() * 0.4), s * (0.08 + rand() * 0.14), s * (0.05 + rand() * 0.08), rand() * 3);
    dots(ctx, x, y, Math.min(w, hh), rand, 6, ['rgba(140,15,15,.8)'], 0.01, 0.025);
  },
  huevos(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (0.3 + i * 0.2) + (rand() - 0.5) * s * 0.06; const cy = y + hh * (0.4 + rand() * 0.2);
      withShadow(ctx, s * 0.6, () => {
        const g = ctx.createRadialGradient(cx - s * 0.04, cy - s * 0.05, s * 0.01, cx, cy, s * 0.14);
        g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, ['#b5541c', '#2f7d57', '#5e3d82'][i]);
        ctx.fillStyle = g; ellipse(ctx, cx, cy, s * 0.1, s * 0.13, (rand() - 0.5) * 0.4);
      });
    }
  },
  // fuego y luz
  velas(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#c9963f'; circle(ctx, cx, cy, s * 0.2); });
    for (const [dx, dy] of [[0, 0], [-0.12, 0.06], [0.12, 0.06]]) { ctx.fillStyle = '#f4ecd8'; circle(ctx, cx + dx * s, cy + dy * s, s * 0.045); glowDot(ctx, cx + dx * s, cy + dy * s - s * 0.02, s * 0.022, '#ffd36b', s); }
  },
  lampara(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#8a6514'; ellipse(ctx, cx, cy, s * 0.18, s * 0.1); });
    glowDot(ctx, cx + s * 0.12, cy - s * 0.03, s * 0.04, '#ffd36b', s);
  },
  farola(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#2b2b2e'; circle(ctx, cx, cy, s * 0.12); });
    ctx.save(); ctx.shadowColor = '#ffcf6b'; ctx.shadowBlur = s * 0.5;
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx - s * 0.08, cy - s * 0.08, s * 0.16, s * 0.16); ctx.restore();
    ctx.strokeStyle = '#2b2b2e'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.strokeRect(cx - s * 0.08, cy - s * 0.08, s * 0.16, s * 0.16);
  },
  forja(ctx, x, y, w, hh, s) {
    const p = s * 0.1;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5d584f'; rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.08); ctx.fill(); });
    ctx.fillStyle = '#2e2b28'; rrect(ctx, x + p * 2, y + p * 2, w - 4 * p, hh - 4 * p, s * 0.06); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = s * 0.45;
    const g = ctx.createRadialGradient(x + w / 2, y + hh / 2, 0, x + w / 2, y + hh / 2, Math.min(w, hh) * 0.35);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ff7a2a'); g.addColorStop(1, 'rgba(120,30,5,.4)');
    ctx.fillStyle = g; rrect(ctx, x + p * 2, y + p * 2, w - 4 * p, hh - 4 * p, s * 0.06); ctx.fill(); ctx.restore();
  },
  fuego_fatuo(ctx, x, y, w, hh, s, rand) {
    for (let i = 0; i < 3; i++) glowDot(ctx, x + w * (0.3 + rand() * 0.4), y + hh * (0.3 + rand() * 0.4), s * (0.04 + rand() * 0.03), '#8fe6ff', s);
  },
  brasas(ctx, x, y, w, hh, s, rand) {
    ctx.fillStyle = '#2e2b28';
    ellipse(ctx, x + w / 2, y + hh / 2, w * 0.4, hh * 0.32, rand());
    for (let i = 0; i < 9; i++) glowDot(ctx, x + w * (0.2 + rand() * 0.6), y + hh * (0.25 + rand() * 0.5), s * (0.02 + rand() * 0.025), rand() < 0.5 ? '#ff7a2a' : '#ffb347', s);
  },
  // exteriores y aldea
  valla(ctx, x, y, w, hh, s, rand, env) {
    joined(ctx, x, y, w, hh, s, env, 'valla', s * 0.1, (parts, cx, cy) => {
      withShadow(ctx, s, () => { ctx.fillStyle = '#8a5a2e'; parts.forEach(([a, b, c, d]) => ctx.fillRect(a, b, c, d)); }, 0.4);
      ctx.fillStyle = '#5a3818';
      circle(ctx, cx, cy, s * 0.08);
    });
  },
  muro_bajo(ctx, x, y, w, hh, s, rand, env) {
    joined(ctx, x, y, w, hh, s, env, 'muro_bajo', s * 0.3, (parts) => {
      withShadow(ctx, s, () => { ctx.fillStyle = '#8f897f'; parts.forEach(([a, b, c, d]) => ctx.fillRect(a, b, c, d)); }, 0.5);
      ctx.strokeStyle = 'rgba(50,46,40,.5)'; ctx.lineWidth = Math.max(0.6, s * 0.015);
      parts.forEach(([a, b, c, d]) => { ctx.strokeRect(a, b, c, d); if (c > d) for (let i = 1; i < c / (s * 0.25); i++) seg(ctx, a + i * s * 0.25, b, a + i * s * 0.25, b + d); });
    });
  },
  barricada(ctx, x, y, w, hh, s, rand) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.1;
      withShadow(ctx, s, () => {
        ctx.fillStyle = '#6b4626';
        for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate((rand() - 0.5) * 0.3); ctx.fillRect(-len / 2, -s * 0.2 + i * s * 0.13, len, s * 0.1); ctx.restore(); }
      });
      ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = Math.max(1, s * 0.04);
      for (let i = 0; i < Math.round(len / (s * 0.5)); i++) seg(ctx, -len / 2 + s * 0.2 + i * s * 0.5, -s * 0.3, -len / 2 + s * 0.35 + i * s * 0.5, s * 0.3);
    });
  },
  heno(ctx, x, y, w, hh, s, rand) {
    const p = s * 0.12;
    withShadow(ctx, s, () => { ctx.fillStyle = '#d9b44a'; rrect(ctx, x + p, y + p, w - 2 * p, hh - 2 * p, s * 0.06); ctx.fill(); });
    ctx.strokeStyle = 'rgba(150,110,30,.6)'; ctx.lineWidth = Math.max(0.5, s * 0.012);
    for (let i = 0; i < 10; i++) { const py = y + p + rand() * (hh - 2 * p); seg(ctx, x + p, py, x + w - p, py + (rand() - 0.5) * s * 0.05); }
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = Math.max(1, s * 0.03);
    seg(ctx, x + w * 0.35, y + p, x + w * 0.35, y + hh - p); seg(ctx, x + w * 0.65, y + p, x + w * 0.65, y + hh - p);
  },
  abrevadero(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.12; const T = s * 0.4;
      withShadow(ctx, s, () => { ctx.fillStyle = '#6b4626'; ctx.fillRect(-len / 2, -T / 2, len, T); });
      ctx.fillStyle = '#4b90b5'; ctx.fillRect(-len / 2 + s * 0.05, -T / 2 + s * 0.05, len - s * 0.1, T - s * 0.1);
    });
  },
  puesto(ctx, x, y, w, hh, s) {
    const p = s * 0.06;
    withShadow(ctx, s, () => { ctx.fillStyle = '#f2ead8'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    const n = Math.max(4, Math.round(w / (s * 0.2)));
    ctx.fillStyle = '#b5332a';
    for (let i = 0; i < n; i += 2) ctx.fillRect(x + p + (i * (w - 2 * p)) / n, y + p, (w - 2 * p) / n, hh - 2 * p);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + w / 2, y + p, w / 2 - p, hh - 2 * p);
  },
  cartel(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => {
      ctx.fillStyle = '#5a3818'; circle(ctx, cx, cy, s * 0.06);
      ctx.fillStyle = '#9a6535';
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.4);
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.07); ctx.lineTo(s * 0.32, -s * 0.07); ctx.lineTo(s * 0.4, 0); ctx.lineTo(s * 0.32, s * 0.07); ctx.lineTo(-s * 0.05, s * 0.07); ctx.closePath(); ctx.fill();
      ctx.rotate(2.2);
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.06); ctx.lineTo(s * 0.28, -s * 0.06); ctx.lineTo(s * 0.35, 0); ctx.lineTo(s * 0.28, s * 0.06); ctx.lineTo(-s * 0.05, s * 0.06); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  },
  lena(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < Math.round(len / (s * 0.18)); i++) {
          const cx = -len / 2 + s * 0.09 + i * s * 0.18 + (row % 2) * s * 0.09; const cy = -s * 0.18 + row * s * 0.17;
          if (cx > len / 2 - s * 0.05) continue;
          withShadow(ctx, s * 0.4, () => { ctx.fillStyle = '#6b4626'; circle(ctx, cx, cy, s * 0.085); });
          ctx.fillStyle = '#c49a62'; circle(ctx, cx, cy, s * 0.06);
        }
      }
    });
  },
  espantapajaros(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => {
      ctx.fillStyle = '#6b4626'; ctx.fillRect(cx - s * 0.32, cy - s * 0.04, s * 0.64, s * 0.08);
      ctx.fillStyle = '#5a7a3a'; rrect(ctx, cx - s * 0.16, cy - s * 0.1, s * 0.32, s * 0.2, s * 0.05); ctx.fill();
    });
    ctx.fillStyle = '#d9b44a'; circle(ctx, cx, cy - s * 0.02, s * 0.11);
    ctx.fillStyle = '#7a5a2a'; ellipse(ctx, cx, cy - s * 0.02, s * 0.16, s * 0.06);
  },
  calabazas(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🎃'], 3, x, y, w, hh, s, rand, 0.3); },
  carretilla(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = Math.min(L, s) - s * 0.1;
      ctx.strokeStyle = '#5a3818'; ctx.lineWidth = Math.max(1, s * 0.03);
      seg(ctx, -len * 0.1, -s * 0.15, len / 2, -s * 0.2); seg(ctx, -len * 0.1, s * 0.15, len / 2, s * 0.2);
      withShadow(ctx, s, () => { ctx.fillStyle = '#7a5230'; ctx.fillRect(-len / 2, -s * 0.2, len * 0.55, s * 0.4); });
      ctx.fillStyle = '#1f1a15'; ellipse(ctx, -len / 2 - s * 0.02, 0, s * 0.04, s * 0.1);
    });
  },
  // mar y río
  barca(ctx, x, y, w, hh, s) {
    oriented(ctx, x, y, w, hh, (L, T0) => {
      const len = L - s * 0.1; const T = Math.min(T0, s) * 0.7;
      withShadow(ctx, s, () => {
        ctx.fillStyle = '#6b4626';
        ctx.beginPath(); ctx.moveTo(-len / 2, -T / 2); ctx.lineTo(len * 0.3, -T / 2); ctx.quadraticCurveTo(len / 2 + s * 0.1, 0, len * 0.3, T / 2); ctx.lineTo(-len / 2, T / 2); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = '#9a6535';
      ctx.beginPath(); ctx.moveTo(-len / 2 + s * 0.06, -T / 2 + s * 0.06); ctx.lineTo(len * 0.28, -T / 2 + s * 0.06); ctx.quadraticCurveTo(len / 2 - s * 0.02, 0, len * 0.28, T / 2 - s * 0.06); ctx.lineTo(-len / 2 + s * 0.06, T / 2 - s * 0.06); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b4626';
      for (let i = 0; i < Math.max(1, Math.round(len / s)); i++) ctx.fillRect(-len / 2 + s * 0.3 + i * s * 0.8, -T / 2 + s * 0.06, s * 0.08, T - s * 0.12);
    });
  },
  ancla(ctx, x, y, w, hh, s) { iconProp(ctx, '⚓', x, y, w, hh, s, 0.6); },
  redes(ctx, x, y, w, hh, s, rand) {
    ctx.strokeStyle = 'rgba(200,180,140,.75)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    const p = s * 0.12;
    for (let i = 0; i <= 5; i++) { seg(ctx, x + p + (i * (w - 2 * p)) / 5, y + p, x + p + (i * (w - 2 * p)) / 5 + (rand() - 0.5) * s * 0.1, y + hh - p); seg(ctx, x + p, y + p + (i * (hh - 2 * p)) / 5, x + w - p, y + p + (i * (hh - 2 * p)) / 5 + (rand() - 0.5) * s * 0.1); }
    ctx.fillStyle = '#c9963f'; circle(ctx, x + p, y + p, s * 0.04); circle(ctx, x + w - p, y + hh - p, s * 0.04);
  },
  cuerda(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s * 0.6, () => { ctx.fillStyle = '#a07a45'; circle(ctx, cx, cy, s * 0.24); });
    ctx.strokeStyle = '#6e5230'; ctx.lineWidth = Math.max(0.8, s * 0.02);
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, s * 0.055 * k, 0, Math.PI * 2); ctx.stroke(); }
  },
  timon(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.32;
    ctx.strokeStyle = '#6b4626'; ctx.lineCap = 'round';
    withShadow(ctx, s, () => {
      ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; seg(ctx, cx, cy, cx + Math.cos(a) * R * 1.3, cy + Math.sin(a) * R * 1.3); }
    });
    ctx.fillStyle = '#c9963f'; circle(ctx, cx, cy, s * 0.06);
  },
  // guerra
  armero(ctx, x, y, w, hh, s, rand) {
    oriented(ctx, x, y, w, hh, (L) => {
      const len = L - s * 0.14;
      withShadow(ctx, s, () => { ctx.fillStyle = '#5a3818'; ctx.fillRect(-len / 2, -s * 0.06, len, s * 0.12); });
      ctx.lineCap = 'round';
      for (let i = 0; i < Math.round(len / (s * 0.16)); i++) {
        const px = -len / 2 + s * 0.08 + i * s * 0.16;
        ctx.strokeStyle = '#b8bcc2'; ctx.lineWidth = Math.max(1, s * 0.03); seg(ctx, px, -s * 0.3, px, s * 0.15);
        ctx.strokeStyle = '#5a3818'; seg(ctx, px, s * 0.15, px, s * 0.3);
        if (rand() < 0.4) { ctx.fillStyle = '#c9963f'; circle(ctx, px, -s * 0.3, s * 0.035); }
      }
    });
  },
  diana(ctx, x, y, w, hh, s) { iconProp(ctx, '🎯', x, y, w, hh, s, 0.66); },
  maniqui(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => {
      ctx.fillStyle = '#6b4626'; ctx.fillRect(cx - s * 0.3, cy - s * 0.04, s * 0.6, s * 0.08);
      ctx.fillStyle = '#c2a874'; ellipse(ctx, cx, cy, s * 0.17, s * 0.14);
    });
    ctx.fillStyle = '#b5332a'; circle(ctx, cx, cy, s * 0.06);
    ctx.strokeStyle = '#7a6440'; ctx.lineWidth = Math.max(0.6, s * 0.015); seg(ctx, cx - s * 0.12, cy - s * 0.08, cx + s * 0.1, cy + s * 0.09);
  },
  catapulta(ctx, x, y, w, hh, s) {
    const p = s * 0.15;
    ctx.fillStyle = '#1f1a15';
    for (const [a, b] of [[0.15, 0.08], [0.85, 0.08], [0.15, 0.92], [0.85, 0.92]]) ellipse(ctx, x + w * a, y + hh * b, s * 0.14, s * 0.06);
    withShadow(ctx, s, () => { ctx.fillStyle = '#7a5230'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p); });
    ctx.strokeStyle = '#4a2e15'; ctx.lineWidth = Math.max(1, s * 0.06);
    seg(ctx, x + w / 2, y + hh - p * 1.5, x + w / 2, y + p * 1.2);
    ctx.fillStyle = '#4a2e15'; circle(ctx, x + w / 2, y + p * 1.3, s * 0.14);
    ctx.fillStyle = '#7d776d'; circle(ctx, x + w / 2, y + p * 1.3, s * 0.09);
  },
  balista(ctx, x, y, w, hh, s, rand, env) {
    const cx = x + w / 2; const cy = y + hh / 2;
    ctx.save(); ctx.translate(cx, cy);
    withShadow(ctx, s, () => { ctx.fillStyle = '#6b4626'; ctx.fillRect(-s * 0.06, -s * 0.38, s * 0.12, s * 0.7); });
    ctx.strokeStyle = '#4a2e15'; ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.36, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = '#d9d0b8'; ctx.lineWidth = Math.max(0.6, s * 0.012);
    seg(ctx, -s * 0.3, -s * 0.24, 0, s * 0.1); seg(ctx, s * 0.3, -s * 0.24, 0, s * 0.1);
    ctx.fillStyle = '#b8bcc2'; ctx.beginPath(); ctx.moveTo(0, -s * 0.46); ctx.lineTo(-s * 0.04, -s * 0.36); ctx.lineTo(s * 0.04, -s * 0.36); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  estandarte(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#3a2a10'; circle(ctx, cx, cy, s * 0.06); });
    ctx.fillStyle = '#8a1f2a';
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.05); ctx.lineTo(cx + s * 0.36, cy - s * 0.12); ctx.lineTo(cx + s * 0.3, cy + s * 0.04); ctx.lineTo(cx + s * 0.36, cy + s * 0.18); ctx.lineTo(cx, cy + s * 0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e7c66a'; circle(ctx, cx + s * 0.17, cy + s * 0.02, s * 0.04);
  },
  armas(ctx, x, y, w, hh, s, rand) { iconScatter(ctx, ['🗡️', '🛡️', '🏹', '🪓'], 3, x, y, w, hh, s, rand, 0.3); },
  // secretos y trampas
  trampilla(ctx, x, y, w, hh, s) {
    const p = s * 0.14;
    ctx.fillStyle = '#5a3818'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    ctx.strokeStyle = '#2b1d12'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    for (let i = 1; i < 4; i++) seg(ctx, x + p, y + p + (i * (hh - 2 * p)) / 4, x + w - p, y + p + (i * (hh - 2 * p)) / 4);
    ctx.strokeStyle = '#8a8d92'; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.arc(x + w / 2, y + hh / 2, s * 0.07, 0, Math.PI * 2); ctx.stroke();
  },
  foso(ctx, x, y, w, hh, s, rand) {
    const p = s * 0.06;
    ctx.fillStyle = '#0d0b09'; ctx.fillRect(x + p, y + p, w - 2 * p, hh - 2 * p);
    ctx.fillStyle = '#9aa0a8';
    for (let i = 0; i < Math.round(9 * (w * hh) / (s * s)); i++) {
      const cx = x + p + rand() * (w - 2 * p); const cy = y + p + rand() * (hh - 2 * p);
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.06); ctx.lineTo(cx + s * 0.035, cy + s * 0.03); ctx.lineTo(cx - s * 0.035, cy + s * 0.03); ctx.closePath(); ctx.fill();
    }
  },
  palanca(ctx, x, y, w, hh, s) {
    const cx = x + w / 2; const cy = y + hh / 2;
    withShadow(ctx, s, () => { ctx.fillStyle = '#5b5e63'; ctx.fillRect(cx - s * 0.1, cy - s * 0.06, s * 0.2, s * 0.12); });
    ctx.strokeStyle = '#3b3f45'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.lineCap = 'round';
    seg(ctx, cx, cy, cx + s * 0.18, cy - s * 0.2);
    ctx.fillStyle = '#b5332a'; circle(ctx, cx + s * 0.18, cy - s * 0.2, s * 0.05);
  },
  placa(ctx, x, y, w, hh, s) {
    ctx.fillStyle = 'rgba(60,56,50,.7)'; ctx.fillRect(x + s * 0.2, y + s * 0.2, w - s * 0.4, hh - s * 0.4);
    ctx.strokeStyle = 'rgba(255,90,79,.85)'; ctx.setLineDash([s * 0.06, s * 0.05]); ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeRect(x + s * 0.2, y + s * 0.2, w - s * 0.4, hh - s * 0.4); ctx.setLineDash([]);
  },
  dardos(ctx, x, y, w, hh, s) {
    ctx.save();
    ctx.strokeStyle = '#ff5a4f'; ctx.setLineDash([s * 0.08, s * 0.06]); ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeRect(x + s * 0.1, y + s * 0.1, w - s * 0.2, hh - s * 0.2);
    ctx.restore();
    ctx.strokeStyle = '#d9d0b8'; ctx.lineWidth = Math.max(0.8, s * 0.02);
    for (let i = 0; i < 3; i++) { const py = y + hh * (0.35 + i * 0.15); seg(ctx, x + w * 0.25, py, x + w * 0.7, py); }
    ctx.fillStyle = '#9aa0a8';
    for (let i = 0; i < 3; i++) { const py = y + hh * (0.35 + i * 0.15); ctx.beginPath(); ctx.moveTo(x + w * 0.78, py); ctx.lineTo(x + w * 0.7, py - s * 0.03); ctx.lineTo(x + w * 0.7, py + s * 0.03); ctx.closePath(); ctx.fill(); }
  },
  puerta_secreta(ctx, x, y, w, hh, s) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,212,121,.9)'; ctx.setLineDash([s * 0.07, s * 0.05]); ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeRect(x + s * 0.12, y + s * 0.12, w - s * 0.24, hh - s * 0.24);
    ctx.restore();
    emoji(ctx, '🚪', x + w / 2, y + hh / 2, s * 0.38);
  },
});
// Objetos que van en el suelo: se dibujan debajo de los demás y pueden compartir casilla con ellos.
export const FLOOR_PROPS = new Set(['alfombra', 'sangre', 'charco', 'runas', 'placa', 'trampilla', 'N', 'flores', 'nenufares', 'puerta_secreta', 'cadenas']);
// Color de la luz de los objetos mágicos (el resto da luz de llama).
const LIGHT_COLOR = { Q: '110,210,255', portal: '178,107,255', runas: '122,215,255', fuego_fatuo: '143,230,255', bola_cristal: '192,139,255', alquimia: '125,255,107', caldero: '125,255,107' };
function star(ctx, cx, cy, R, r, n, rot = 0) {
  ctx.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = rot + (k / (n * 2)) * Math.PI * 2; const rr = k % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fill();
}
function tree(ctx, x, y, w, hh, s, rand, [dark, mid, light, top]) {
  const cx = x + w / 2; const cy = y + hh / 2; const R = Math.min(w, hh) * 0.5;
  withShadow(ctx, s, () => { ctx.fillStyle = dark; circle(ctx, cx, cy, R * 0.92); }, 0.55);
  ctx.fillStyle = mid;
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + rand(); circle(ctx, cx + Math.cos(a) * R * 0.48, cy + Math.sin(a) * R * 0.48, R * (0.36 + rand() * 0.1)); }
  ctx.fillStyle = light;
  for (let k = 0; k < 5; k++) { const a = Math.PI * 1.25 + (rand() - 0.5) * 1.6; circle(ctx, cx + Math.cos(a) * R * 0.32 * rand(), cy + Math.sin(a) * R * 0.32 * rand(), R * (0.22 + rand() * 0.1)); }
  ctx.fillStyle = top;
  for (let k = 0; k < 4; k++) circle(ctx, cx - R * (0.1 + rand() * 0.3), cy - R * (0.1 + rand() * 0.3), R * 0.09);
}

// Dibuja un escenario completo (o solo una región) en un contexto con casillas de `s` píxeles.
export function drawScene(ctx, sc, cat, { s = CELL, dm = true, region = null, bg = null, open = null } = {}) {
  const { cols, rows } = sc;
  const t = sc.tiles;
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : t[r * cols + c]);
  const wallAt = (c, r) => !!TS[at(c, r)]?.wall;
  const c0 = Math.max(0, region ? region.c0 : 0); const c1 = Math.min(cols - 1, region ? region.c1 : cols - 1);
  const r0 = Math.max(0, region ? region.r0 : 0); const r1 = Math.min(rows - 1, region ? region.r1 : rows - 1);
  const e0 = Math.max(0, c0 - 2); const e1 = Math.min(cols - 1, c1 + 2); const f0 = Math.max(0, r0 - 2); const f1 = Math.min(rows - 1, r1 + 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(c0 * s, r0 * s, (c1 - c0 + 1) * s, (r1 - r0 + 1) * s);
  ctx.clip();
  ctx.clearRect(c0 * s, r0 * s, (c1 - c0 + 1) * s, (r1 - r0 + 1) * s);
  if (bg) {
    ctx.globalAlpha = sc.bgOpacity ?? 1;
    ctx.drawImage(bg, 0, 0, cols * s, rows * s);
    ctx.globalAlpha = 1;
  }
  const each = (fn) => { for (let r = f0; r <= f1; r++) for (let c = e0; c <= e1; c++) fn(c, r, at(c, r)); };
  const env = (c, r, k) => ({
    ctx, s, c, r, x: c * s, y: r * s, code: at(c, r), rand: cellRand(c, r, k), open: !!open && open.has(r * cols + c),
    at: (dc, dr) => at(c + dc, r + dr), isWall: (dc, dr) => wallAt(c + dc, r + dr),
  });
  // 1. color de base
  each((c, r, code) => {
    const st = TS[code];
    if (!st?.base || st.wall) return;
    ctx.fillStyle = st.base;
    ctx.fillRect(c * s, r * s, s + 0.5, s + 0.5);
  });
  // 2. bordes orgánicos: la hierba, el agua o la lava invaden un poco la casilla vecina
  each((c, r, code) => {
    const st = TS[code];
    if (!st?.organic) return;
    const rand = cellRand(c, r, 9);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nb = TS[at(c + dc, r + dr)];
        if (!nb?.organic || nb.organic >= st.organic) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect((c + dc) * s, (r + dr) * s, s, s);
        ctx.clip();
        ctx.fillStyle = st.base;
        for (let i = 0; i < 3; i++) circle(ctx, (c + 0.5 + dc * 0.5) * s + (rand() - 0.5) * s * (dc ? 0.3 : 0.9), (r + 0.5 + dr * 0.5) * s + (rand() - 0.5) * s * (dr ? 0.3 : 0.9), s * (0.2 + rand() * 0.18));
        ctx.restore();
      }
    }
  });
  // 3. texturas
  each((c, r, code) => {
    const st = TS[code];
    if (st?.draw && !st.wall) st.draw(env(c, r, 1));
  });
  // 4. sombras que proyectan los muros
  each((c, r, code) => {
    if (!code || TS[code]?.wall || code === 'v') return;
    if (wallAt(c, r - 1)) {
      const g = ctx.createLinearGradient(0, r * s, 0, r * s + s * 0.4);
      g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c * s, r * s, s, s * 0.4);
    }
    if (wallAt(c - 1, r)) {
      const g = ctx.createLinearGradient(c * s, 0, c * s + s * 0.28, 0);
      g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c * s, r * s, s * 0.28, s);
    }
  });
  // 5. muros con su cara frontal
  const solid = (c, r) => { const n = at(c, r); return n == null || !!TS[n]?.wall; };
  each((c, r, code) => {
    const st = TS[code];
    if (!st?.wall) return;
    let inner = true;
    for (let dr = -1; dr <= 1 && inner; dr++) for (let dc = -1; dc <= 1; dc++) if (!solid(c + dc, r + dr)) { inner = false; break; }
    if (inner) { // roca maciza: oscura para que las salas resalten
      const rand = cellRand(c, r, 4);
      ctx.fillStyle = { H: '#2b1d12', F: '#2b1d12', h: '#16301a', L: '#4d7f99', B: '#3a1a12' }[code] || '#1d1a17';
      ctx.fillRect(c * s, r * s, s + 0.5, s + 0.5);
      dots(ctx, c * s, r * s, s, rand, 4, ['rgba(255,255,255,.035)', 'rgba(0,0,0,.25)'], 0.06, 0.16);
      return;
    }
    st.draw(env(c, r, 2));
    if (!wallAt(c, r + 1) && at(c, r + 1) != null) {
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillRect(c * s, r * s + s * 0.8, s, s * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(c * s, r * s + s * 0.78, s, Math.max(1, s * 0.03));
    }
    if (!wallAt(c, r - 1) && at(c, r - 1) != null) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(c * s, r * s, s, Math.max(1, s * 0.04));
    }
  });
  // 6. cuadrícula
  ctx.beginPath();
  each((c, r, code) => {
    if (!code || TS[code]?.wall || code === 'v') return;
    ctx.moveTo(c * s, r * s); ctx.lineTo(c * s + s, r * s);
    ctx.moveTo(c * s, r * s); ctx.lineTo(c * s, r * s + s);
    if (c === cols - 1 || TS[at(c + 1, r)]?.wall) { ctx.moveTo(c * s + s, r * s); ctx.lineTo(c * s + s, r * s + s); }
    if (r === rows - 1 || TS[at(c, r + 1)]?.wall) { ctx.moveTo(c * s, r * s + s); ctx.lineTo(c * s + s, r * s + s); }
  });
  ctx.strokeStyle = 'rgba(0,0,0,.32)';
  ctx.lineWidth = Math.max(0.5, s * 0.018);
  ctx.stroke();
  // 7. objetos
  const props = sc.props || [];
  const propAt = new Map();
  for (const p of props) for (let i = 0; i < (p.w || 1); i++) for (let j = 0; j < (p.h || 1); j++) propAt.set(`${p.c + i},${p.r + j}`, p.k);
  const sorted = props.filter((p) => p.c + (p.w || 1) - 1 >= e0 - 1 && p.c <= e1 + 1 && p.r + (p.h || 1) - 1 >= f0 - 1 && p.r <= f1 + 1)
    .sort((a, b) => FLOOR_PROPS.has(b.k) - FLOOR_PROPS.has(a.k) || (a.k === 'e') - (b.k === 'e') || a.r - b.r || a.c - b.c);
  for (const p of sorted) {
    if (p.hidden && !dm) continue;
    const paint = PP[p.k];
    if (!paint) continue;
    ctx.save();
    if (p.hidden) ctx.globalAlpha = 0.6;
    paint(ctx, p.c * s, p.r * s, (p.w || 1) * s, (p.h || 1) * s, s, cellRand(p.c, p.r, 3), {
      isWall: (dc, dr) => wallAt(p.c + dc, p.r + dr), hasProp: (k, dc, dr) => propAt.get(`${p.c + dc},${p.r + dr}`) === k,
    });
    ctx.restore();
  }
  ctx.restore();
}

// Fuentes de luz del escenario: objetos con luz y la lava.
function lightSources(sc, cat) {
  const out = [];
  for (const p of sc.props || []) {
    const info = cat.P[p.k];
    if (info?.light) out.push({ x: p.c + (p.w || 1) / 2, y: p.r + (p.h || 1) / 2, r: info.light, color: LIGHT_COLOR[p.k] || '255,160,70' });
  }
  for (let i = 0; i < sc.tiles.length; i++) {
    if (sc.tiles[i] === 'l') out.push({ x: (i % sc.cols) + 0.5, y: Math.floor(i / sc.cols) + 0.5, r: 1.8, color: '255,110,40', soft: true });
    else if (sc.tiles[i] === 'A') out.push({ x: (i % sc.cols) + 0.5, y: Math.floor(i / sc.cols) + 0.5, r: 1.2, color: '140,255,90', soft: true });
  }
  return out;
}

export function drawLight(ctx, glow, sc, cat, s) {
  const W = sc.cols * s; const H = sc.rows * s;
  ctx.clearRect(0, 0, W, H);
  glow?.clearRect(0, 0, W, H);
  const alpha = LIGHT_ALPHA[sc.light] || 0;
  const sources = lightSources(sc, cat);
  if (alpha) {
    ctx.fillStyle = `rgba(6,8,24,${alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    for (const L of sources) {
      const g = ctx.createRadialGradient(L.x * s, L.y * s, 0, L.x * s, L.y * s, L.r * s);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(L.x * s - L.r * s, L.y * s - L.r * s, L.r * s * 2, L.r * s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (glow) {
    for (const L of sources) {
      const R = L.r * s * (L.soft ? 0.8 : 0.65);
      const g = glow.createRadialGradient(L.x * s, L.y * s, 0, L.x * s, L.y * s, R);
      g.addColorStop(0, `rgba(${L.color},${L.soft ? 0.18 : 0.32})`); g.addColorStop(1, `rgba(${L.color},0)`);
      glow.fillStyle = g;
      glow.fillRect(L.x * s - R, L.y * s - R, R * 2, R * 2);
    }
  }
}

// Miniatura de un escenario para las galerías.
export function sceneThumb(sc, cat, maxW = 320, maxH = 200) {
  const s = Math.max(4, Math.floor(Math.min(maxW / sc.cols, maxH / sc.rows)));
  const cv = h('canvas', { class: 'scene-thumb', width: sc.cols * s, height: sc.rows * s });
  const ctx = cv.getContext('2d');
  const paint = (bg) => {
    drawScene(ctx, sc, cat, { s, dm: true, bg });
    const lc = document.createElement('canvas');
    const gc = document.createElement('canvas');
    lc.width = gc.width = cv.width;
    lc.height = gc.height = cv.height;
    drawLight(lc.getContext('2d'), gc.getContext('2d'), sc, cat, s);
    ctx.drawImage(lc, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(gc, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };
  if (sc.bg) {
    const img = new Image();
    img.onload = () => paint(img);
    img.onerror = () => paint(null);
    img.src = sc.bg;
  }
  paint(null);
  return cv;
}

// Imagen grande de un escenario para descargar (imprimir o usar en otra mesa virtual): terreno, objetos y luz con
// `px` píxeles por casilla y, si se pide, las letras y números de las casillas en el borde. Sin `dm` no salen los
// objetos ocultos (trampas, puertas secretas). Si no cabe en el lienzo del navegador, baja los píxeles por casilla.
export const MAX_IMAGE_PX = 60e6;
export const imagePx = (sc, px) => Math.max(8, Math.min(px, Math.floor(16000 / Math.max(sc.cols, sc.rows) / 1.1),
  Math.floor(Math.sqrt(MAX_IMAGE_PX / ((sc.cols + 1) * (sc.rows + 1))))));
export async function sceneImage(sc, cat, { px = 150, dm = false, labels = true } = {}) {
  const s = imagePx(sc, px);
  const m = labels ? Math.round(s * 0.5) : 0; // margen para las coordenadas
  const W = sc.cols * s; const H = sc.rows * s;
  const cv = document.createElement('canvas');
  cv.width = W + 2 * m;
  cv.height = H + 2 * m;
  const ctx = cv.getContext('2d');
  const bg = sc.bg ? await new Promise((ok) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => ok(null); img.src = sc.bg; }) : null;
  if (labels) {
    ctx.fillStyle = '#1b140d';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#f1e4c6';
    ctx.font = `700 ${Math.round(s * 0.26)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < sc.cols; c++) for (const y of [m / 2, m + H + m / 2]) ctx.fillText(colName(c), m + c * s + s / 2, y);
    for (let r = 0; r < sc.rows; r++) for (const x of [m / 2, m + W + m / 2]) ctx.fillText(String(r + 1), x, m + r * s + s / 2);
  }
  ctx.translate(m, m);
  drawScene(ctx, sc, cat, { s, dm, bg });
  // la luz es un degradado suave: se calcula a un cuarto de tamaño y se estira, como en el tablero
  const q = s / 4;
  const lc = document.createElement('canvas');
  const gc = document.createElement('canvas');
  lc.width = gc.width = Math.ceil(sc.cols * q);
  lc.height = gc.height = Math.ceil(sc.rows * q);
  drawLight(lc.getContext('2d'), gc.getContext('2d'), sc, cat, q);
  ctx.drawImage(lc, 0, 0, W, H);
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(gc, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

// ================================================================ reglas del tablero
// Coste de entrar en cada casilla: 1, 2 (terreno difícil) o Infinity (muro, abismo, lava, objeto que bloquea).
// Con «open» (las puertas abiertas), las puertas cerradas tampoco se pueden cruzar.
export function costGrid(sc, cat, open = null) {
  const out = new Float32Array(sc.cols * sc.rows);
  for (let i = 0; i < out.length; i++) {
    const info = cat.T[sc.tiles[i]];
    out[i] = !info || info.cost == null || info.hazard || (open && sc.tiles[i] === 'D' && !open.has(i)) ? Infinity : info.cost;
  }
  for (const p of sc.props || []) {
    const eff = cat.P[p.k]?.effect;
    if (eff !== 'bloquea' && eff !== 'dificil' && eff !== 'peligro') continue;
    for (let i = 0; i < (p.w || 1); i++) {
      for (let j = 0; j < (p.h || 1); j++) {
        const c = p.c + i; const r = p.r + j;
        if (c >= sc.cols || r >= sc.rows) continue;
        const k = r * sc.cols + c;
        out[k] = eff === 'bloquea' ? Infinity : eff === 'peligro' ? Infinity : Math.max(out[k], 2);
      }
    }
  }
  return out;
}

const side = (t) => (t.type === 'enemigo' ? 'e' : 'a');

// Distancias de movimiento (en casillas) desde la posición de una ficha, con las reglas de 2024:
// las diagonales cuestan lo mismo, el terreno difícil el doble y el espacio de otra criatura es
// terreno difícil (no se puede atravesar a un enemigo en pie ni terminar en una casilla ocupada).
export function movementField(sc, cat, costs, t, others, limit = 80) {
  const { cols, rows } = sc;
  const n = sizeCells(t.size);
  const tiny = isTiny(t.size);
  // Se puede atravesar a un aliado, a un caído, a un diminuto o a quien sea dos tamaños mayor o menor; un diminuto puede
  // terminar en una casilla con menos de cuatro diminutos. occ: casilla -> { block, big, tiny }
  const occ = new Map();
  for (const o of others) {
    if (o.id === t.id || o.c == null) continue;
    const m = sizeCells(o.size);
    const hostile = side(o) !== side(t) && !(o.hp != null && o.hp <= 0);
    const passable = isTiny(o.size) || Math.abs(sizeIndex(o.size) - sizeIndex(t.size)) >= 2;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        const k = (o.r + j) * cols + o.c + i;
        const cur = occ.get(k) || { block: false, big: false, tiny: 0 };
        if (hostile && !passable) cur.block = true;
        if (isTiny(o.size)) cur.tiny++; else cur.big = true;
        occ.set(k, cur);
      }
    }
  }
  const foot = (c, r) => {
    if (c < 0 || r < 0 || c + n > cols || r + n > rows) return [Infinity, false];
    let cost = 1; let free = true;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = (r + j) * cols + c + i;
        const base = costs[k];
        if (base === Infinity) return [Infinity, false];
        const o = occ.get(k);
        if (o?.block) return [Infinity, false];
        if (o && !(tiny && !o.big && o.tiny < 4)) { free = false; cost = Math.max(cost, 2); }
        cost = Math.max(cost, base);
      }
    }
    return [cost, free];
  };
  const dist = new Float32Array(cols * rows).fill(Infinity);
  const endable = new Uint8Array(cols * rows);
  const start = t.r * cols + t.c;
  dist[start] = 0;
  endable[start] = 1;
  const queue = [[0, t.c, t.r]];
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[bi][0]) bi = i;
    const [d, c, r] = queue[bi];
    queue[bi] = queue[queue.length - 1];
    queue.pop();
    if (d > dist[r * cols + c]) continue;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nc = c + dc; const nr = r + dr;
        if (n === 1 && dc && dr && costs[r * cols + nc] === Infinity && costs[nr * cols + c] === Infinity) continue; // esquina entre dos muros
        const [cost, free] = foot(nc, nr);
        if (cost === Infinity) continue;
        const nd = d + cost;
        if (nd > limit) continue;
        const k = nr * cols + nc;
        if (nd < dist[k]) { dist[k] = nd; endable[k] = free ? 1 : 0; queue.push([nd, nc, nr]); }
      }
    }
  }
  return { dist, endable };
}

// Casillas que cubre un área de efecto. Coordenadas en casillas (el punto de origen puede ser una esquina).
export function areaCells(shape, meters, origin, aim, cols, rows, from = null) {
  const L = meters / METERS;
  const out = [];
  const dx = (aim?.x ?? origin.x + 1) - origin.x; const dy = (aim?.y ?? origin.y) - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const eps = 1e-6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c + 0.5; const py = r + 0.5;
      let inside = false;
      if (shape === 'esfera') inside = Math.hypot(px - origin.x, py - origin.y) <= L + eps;
      else if (shape === 'cubo') {
        const sx = dx >= 0 ? 1 : -1; const sy = dy >= 0 ? 1 : -1;
        const x0 = Math.min(origin.x, origin.x + sx * L); const x1 = Math.max(origin.x, origin.x + sx * L);
        const y0 = Math.min(origin.y, origin.y + sy * L); const y1 = Math.max(origin.y, origin.y + sy * L);
        inside = px > x0 && px < x1 && py > y0 && py < y1;
      } else if (shape === 'cono' || shape === 'linea') {
        const vx = px - origin.x; const vy = py - origin.y;
        const along = vx * ux + vy * uy; const perp = Math.abs(-vx * uy + vy * ux);
        inside = along > 0 && along <= L + eps && perp <= (shape === 'cono' ? along / 2 : 0.5) + eps;
      } else if (shape === 'emanacion' && from) {
        const qx = Math.max(from.c, Math.min(px, from.c + from.n)); const qy = Math.max(from.r, Math.min(py, from.r + from.n));
        const isOwn = px > from.c && px < from.c + from.n && py > from.r && py < from.r + from.n;
        inside = !isOwn && Math.hypot(px - qx, py - qy) <= L + eps;
      }
      if (inside) out.push(r * cols + c);
    }
  }
  return out;
}

// ======================================================================= tablero
export function createBattleMap(opts = {}) {
  const o = { editable: false, dm: true, ...opts };
  const cat = o.catalog;
  const S = CELL;
  const terrainCv = h('canvas', { class: 'bm-terrain' });
  const lightCv = h('canvas', { class: 'bm-light' });
  const glowCv = h('canvas', { class: 'bm-glow' });
  const overCv = h('canvas', { class: 'bm-over' });
  const tokensEl = h('div', { class: 'bm-tokens' });
  const fogCv = h('canvas', { class: 'bm-fog' });
  const layer = h('div', { class: 'bm-layer' }, terrainCv, lightCv, glowCv, fogCv, overCv, tokensEl);
  const vp = h('div', { class: 'bm-viewport', tabindex: 0, 'aria-label': 'Tablero de combate' }, layer);
  const hud = h('div', { class: 'bm-hud' });
  const bar = h('div', { class: 'bm-bar' });
  const pop = h('div', { class: 'bm-pop', hidden: true });
  const emptyEl = h('div', { class: 'bm-empty', hidden: true });
  const el = h('div', { class: `bm ${o.editable ? 'editing' : ''}` }, vp, emptyEl, hud, bar, pop);

  let scene = null; let W = 0; let H = 0; let ratio = 1;
  // Puertas que se abren y cierran (solo en combate): cerradas tapan el paso y la vista.
  const doorsOn = !!o.onDoor;
  let openDoors = new Set();
  let costs = null; let bgImg = null; let fitted = false;
  const view = { scale: 1, x: 0, y: 0 };
  let tokens = []; const tokenEls = new Map();
  let tool = o.editable ? 'paint' : 'move';
  let showRange = o.range ?? true;
  let selected = null; let drag = null; let hover = null; let ruler = null; let rangeCache = null;
  const area = { shape: 'esfera', size: 6, origin: null, aim: null, from: null, cells: null, live: false };
  const edit = { terrain: ',', prop: 'T', w: 1, h: 1, brush: 1, hidden: false, rect: null, stroke: null };
  const undoStack = []; const redoStack = [];
  const overCtx = overCv.getContext('2d');

  // ------------------------------------------------------------------- utilidades
  const idx = (c, r) => r * scene.cols + c;
  const inside = (c, r) => scene && c >= 0 && r >= 0 && c < scene.cols && r < scene.rows;
  const toCells = (ev) => {
    const b = vp.getBoundingClientRect();
    return { x: (ev.clientX - b.left - view.x) / view.scale / S, y: (ev.clientY - b.top - view.y) / view.scale / S };
  };
  const tokenById = (id) => tokens.find((t) => t.id === id);
  function apply() {
    layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    layer.style.setProperty('--inv', String(Math.min(2.6, Math.max(0.7, 1 / view.scale))));
    drawOverlay();
  }
  function fit() {
    const b = vp.getBoundingClientRect();
    if (!scene || !b.width || !b.height) return;
    view.scale = Math.min(b.width / W, b.height / H) * 0.96;
    view.x = (b.width - W * view.scale) / 2;
    view.y = (b.height - H * view.scale) / 2;
    fitted = true;
    apply();
  }
  function zoomAt(f, cx, cy) {
    const next = Math.min(4, Math.max(0.12, view.scale * f));
    view.x = cx - (cx - view.x) * (next / view.scale);
    view.y = cy - (cy - view.y) * (next / view.scale);
    view.scale = next;
    fitted = false;
    apply();
  }
  const zoomCenter = (f) => { const b = vp.getBoundingClientRect(); zoomAt(f, b.width / 2, b.height / 2); };
  function centerOn(id) {
    const t = tokenById(id);
    if (!t || t.c == null) return;
    const n = sizeCells(t.size);
    const b = vp.getBoundingClientRect();
    view.x = b.width / 2 - (t.c + n / 2) * S * view.scale;
    view.y = b.height / 2 - (t.r + n / 2) * S * view.scale;
    layer.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
    apply();
    setTimeout(() => { layer.style.transition = ''; }, 470);
  }

  // ------------------------------------------------------------------- escenario
  function sizeCanvas(cv, k) {
    cv.width = Math.max(1, Math.round(W * k));
    cv.height = Math.max(1, Math.round(H * k));
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
  }
  function setScene(sc) {
    const same = scene && sc && scene.cols === sc.cols && scene.rows === sc.rows;
    scene = sc;
    emptyEl.hidden = !!sc;
    if (!sc) { clear(tokensEl); tokenEls.clear(); return; }
    sc.props ||= [];
    sc.spawns ||= { party: [], enemies: [] };
    W = sc.cols * S; H = sc.rows * S;
    ratio = Math.min(2, Math.sqrt(14e6 / (W * H)), Math.max(1.25, (window.devicePixelRatio || 1) * 1.25));
    layer.style.width = `${W}px`;
    layer.style.height = `${H}px`;
    sizeCanvas(terrainCv, ratio);
    sizeCanvas(overCv, 1);
    sizeCanvas(lightCv, 0.25);
    sizeCanvas(glowCv, 0.25);
    sizeCanvas(fogCv, 0.5);
    bgImg = null;
    if (sc.bg) {
      const img = new Image();
      img.onload = () => { if (scene === sc) { bgImg = img; redraw(); } };
      img.src = sc.bg;
    }
    redraw();
    if (!same) { fitted = true; fit(); }
  }
  function redraw(region = null) {
    if (!scene) return;
    costs = costGrid(scene, cat, doorsOn ? openDoors : null);
    rangeCache = null;
    const ctx = terrainCv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawScene(ctx, scene, cat, { s: S, dm: o.dm, region, bg: bgImg, open: doorsOn ? openDoors : null });
    const lctx = lightCv.getContext('2d');
    const gctx = glowCv.getContext('2d');
    lctx.setTransform(0.25, 0, 0, 0.25, 0, 0);
    gctx.setTransform(0.25, 0, 0, 0.25, 0, 0);
    drawLight(lctx, gctx, scene, cat, S);
    drawFog();
    renderTokens();
    drawOverlay();
  }

  // ------------------------------------------------------------- niebla de guerra
  // fog = { on, seen: Set de casillas reveladas }. El máster la ve translúcida; los jugadores, negra.
  let fog = null;
  let fogMode = 'revelar';
  const fogged = (c, r) => fog?.on && !fog.seen.has(idx(c, r));
  function drawFog() {
    const ctx = fogCv.getContext('2d');
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ctx.clearRect(0, 0, W, H);
    fogCv.classList.toggle('dm', !!o.dm);
    if (!scene || !fog?.on) return;
    ctx.fillStyle = o.dm ? 'rgba(8,10,22,.5)' : '#05060a';
    for (let r = 0; r < scene.rows; r++) for (let c = 0; c < scene.cols; c++) if (fogged(c, r)) ctx.fillRect(c * S - 1, r * S - 1, S + 2, S + 2);
  }
  // Lo que ve una ficha: casillas a 12 m (8 casillas) sin un muro por medio.
  function revealFrom(t, R = 8) {
    const n = sizeCells(t.size);
    const cx = t.c + (n - 1) / 2; const cy = t.r + (n - 1) / 2;
    const wall = (c, r) => cat.T[scene.tiles[idx(c, r)]]?.kind === 'muro' || (doorsOn && scene.tiles[idx(c, r)] === 'D' && !openDoors.has(idx(c, r)));
    for (let r = Math.floor(cy - R); r <= cy + R; r++) {
      for (let c = Math.floor(cx - R); c <= cx + R; c++) {
        if (!inside(c, r) || Math.hypot(c - cx, r - cy) > R + 0.5) continue;
        const steps = Math.ceil(Math.max(Math.abs(c - cx), Math.abs(r - cy)) * 2) || 1;
        let open = true;
        for (let k = 1; k < steps && open; k++) {
          const x = Math.round(cx + ((c - cx) * k) / steps); const y = Math.round(cy + ((r - cy) * k) / steps);
          if ((x !== c || y !== r) && wall(x, y)) open = false;
        }
        if (open) fog.seen.add(idx(c, r));
      }
    }
  }
  function toggleDoor(c, r) {
    const k = idx(c, r);
    if (openDoors.has(k)) openDoors.delete(k); else openDoors.add(k);
    sfx[openDoors.has(k) ? 'whoosh' : 'step']?.();
    redraw({ c0: c - 1, c1: c + 1, r0: r - 1, r1: r + 1 });
    if (fog?.on) { revealParty(); commitFog(); }
    o.onDoor([...openDoors]);
  }
  function revealParty() { if (fog?.on) tokens.filter((t) => t.type === 'jugador' && t.c != null).forEach((t) => revealFrom(t)); }
  function commitFog() { drawFog(); renderTokens(); o.onFog?.({ on: !!fog?.on, seen: [...(fog?.seen || [])] }); }
  function paintFog(c, r) {
    let changed = false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!inside(c + dc, r + dr)) continue;
      const k = idx(c + dc, r + dr);
      if (fogMode === 'revelar' ? !fog.seen.has(k) : fog.seen.has(k)) { changed = true; if (fogMode === 'revelar') fog.seen.add(k); else fog.seen.delete(k); }
    }
    if (changed) drawFog();
  }

  // ---------------------------------------------------------------------- fichas
  function setTokens(list) {
    tokens = list || [];
    rangeCache = null;
    renderTokens();
    drawOverlay();
  }
  function renderTokens() {
    if (!scene) return;
    const seen = new Set();
    const quarter = new Map(); // diminutos: qué cuarto de su casilla ocupa cada uno
    const inCell = new Map();
    for (const t of tokens.filter((x) => x.c != null && isTiny(x.size)).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const k = `${t.c},${t.r}`;
      quarter.set(t.id, [k, inCell.get(k) || 0]);
      inCell.set(k, (inCell.get(k) || 0) + 1);
    }
    for (const t of tokens) {
      if (t.c == null || t.r == null) continue;
      seen.add(t.id);
      const n = sizeCells(t.size);
      const q = quarter.get(t.id);
      const alone = q && inCell.get(q[0]) === 1;
      const box = q ? S / 2 : n * S;
      const off = q ? (alone ? [S / 4, S / 4] : [(q[1] % 2) * S / 2, (Math.floor(q[1] / 2) % 2) * S / 2]) : [0, 0];
      let tel = tokenEls.get(t.id);
      if (!tel) {
        tel = h('div', { class: 'bm-token', dataset: { id: t.id } });
        tokensEl.append(tel);
        tokenEls.set(t.id, tel);
      }
      const key = JSON.stringify([t.name, t.color, t.portrait, t.look, t.hp, t.maxHp, t.tempHp, t.showHp, box, t.conds, t.type, t.conc]);
      if (tel.dataset.key !== key) {
        tel.dataset.key = key;
        clear(tel, token(t, { size: Math.round(box * 0.84), hp: t.hp, max: t.maxHp, showHp: t.showHp !== false && t.maxHp != null }),
          h('span', { class: 'bm-name' }, t.name),
          t.conds?.length > 0 && h('span', { class: 'bm-conds' }, t.conds.map((k) => condLabel(k).split(' ')[0]).join('')),
          t.conc && h('span', { class: 'bm-conc' }, '🔮'));
      }
      const unseen = !o.dm && t.type !== 'jugador' && fog?.on && Array.from({ length: n * n }, (_, k) => [t.c + (k % n), t.r + Math.floor(k / n)]).every(([x, y]) => fogged(x, y));
      tel.hidden = unseen;
      tel.className = `bm-token ${t.type || ''} ${q ? `tiny ${alone ? '' : 'shared'}` : ''} ${t.current ? 'current' : ''} ${t.id === selected ? 'selected' : ''} ${t.hidden ? 'is-hidden' : ''} ${t.hp != null && t.hp <= 0 ? 'down' : ''} ${drag?.id === t.id ? 'dragging' : ''}`;
      tel.style.width = tel.style.height = `${box}px`;
      if (drag?.id !== t.id) {
        tel.style.left = `${t.c * S + off[0]}px`;
        tel.style.top = `${t.r * S + off[1]}px`;
      }
    }
    for (const [id, tel] of tokenEls) if (!seen.has(id)) { tel.remove(); tokenEls.delete(id); }
  }
  function rangeToken() {
    const t = (selected && tokenById(selected)) || tokens.find((x) => x.current);
    return t && t.c != null ? t : null;
  }
  function rangeFor(t) {
    if (rangeCache?.id === t.id && rangeCache.c === t.c && rangeCache.r === t.r) return rangeCache.field;
    const field = movementField(scene, cat, costs, t, tokens);
    rangeCache = { id: t.id, c: t.c, r: t.r, field };
    return field;
  }
  const speedCells = (t) => Math.floor(Math.max(0, Number(t.speed ?? 9)) / METERS + 1e-6);

  // --------------------------------------------------------------------- capa superior
  function drawOverlay() {
    const ctx = overCtx;
    ctx.clearRect(0, 0, overCv.width, overCv.height);
    if (!scene) return updateHud();
    const inv = 1 / view.scale;
    const { cols } = scene;
    if (!o.editable && showRange && (tool === 'move') && !drag) {
      const t = rangeToken();
      if (t && !(t.hp != null && t.hp <= 0)) {
        const { dist, endable } = rangeFor(t);
        const sp = speedCells(t) - (t.moved || 0) / METERS;
        for (let i = 0; i < dist.length; i++) {
          const d = dist[i];
          if (!endable[i] || d === Infinity || d === 0 || (!o.dm && fogged(i % cols, Math.floor(i / cols)))) continue;
          if (d <= sp) ctx.fillStyle = 'rgba(91,156,255,.2)';
          else if (d <= sp + speedCells(t)) ctx.fillStyle = 'rgba(91,156,255,.07)';
          else continue;
          ctx.fillRect((i % cols) * S + 1, Math.floor(i / cols) * S + 1, S - 2, S - 2);
        }
      }
    }
    if (drag?.moved) {
      const t = tokenById(drag.id);
      const n = sizeCells(t.size);
      ctx.lineWidth = 3 * inv;
      ctx.setLineDash([8 * inv, 6 * inv]);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.strokeRect(drag.from.c * S + 2, drag.from.r * S + 2, n * S - 4, n * S - 4);
      ctx.setLineDash([]);
      if (drag.to) {
        const sp = speedCells(t) - (t.moved || 0) / METERS;
        const d = drag.cost;
        const color = d == null ? '#ff6b5e' : d <= sp ? '#5fd394' : d <= sp + speedCells(t) ? '#f0b648' : '#ff6b5e';
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}33`;
        ctx.fillRect(drag.to.c * S, drag.to.r * S, n * S, n * S);
        ctx.strokeRect(drag.to.c * S + 1.5, drag.to.r * S + 1.5, n * S - 3, n * S - 3);
        ctx.beginPath();
        ctx.moveTo((drag.from.c + n / 2) * S, (drag.from.r + n / 2) * S);
        ctx.lineTo((drag.to.c + n / 2) * S, (drag.to.r + n / 2) * S);
        ctx.stroke();
      }
    }
    if (ruler) {
      const ax = (ruler.a.c + 0.5) * S; const ay = (ruler.a.r + 0.5) * S; const bx = (ruler.b.c + 0.5) * S; const by = (ruler.b.r + 0.5) * S;
      ctx.strokeStyle = '#ffd96b';
      ctx.fillStyle = '#ffd96b';
      ctx.lineWidth = 4 * inv;
      ctx.setLineDash([12 * inv, 7 * inv]);
      seg(ctx, ax, ay, bx, by);
      ctx.setLineDash([]);
      circle(ctx, ax, ay, 7 * inv);
      circle(ctx, bx, by, 7 * inv);
      const d = Math.max(Math.abs(ruler.b.c - ruler.a.c), Math.abs(ruler.b.r - ruler.a.r));
      label(ctx, fmtMeters(d * METERS), bx + 14 * inv, by - 14 * inv, inv);
    }
    if (area.origin) {
      const cellsArr = area.cells || [];
      ctx.fillStyle = 'rgba(255,110,50,.32)';
      for (const i of cellsArr) ctx.fillRect((i % cols) * S, Math.floor(i / cols) * S, S, S);
      ctx.strokeStyle = 'rgba(255,240,220,.9)';
      ctx.lineWidth = 3 * inv;
      ctx.setLineDash([10 * inv, 6 * inv]);
      outlineArea(ctx);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      circle(ctx, area.origin.x * S, area.origin.y * S, 5 * inv);
    }
    if (o.editable) {
      const sp = scene.spawns || {};
      for (const [list, color, ch] of [[sp.party || [], '#5b9cff', 'G'], [sp.enemies || [], '#e0524a', 'E']]) {
        for (const [c, r] of list) {
          ctx.fillStyle = `${color}cc`;
          circle(ctx, (c + 0.5) * S, (r + 0.5) * S, S * 0.26);
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${S * 0.26}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, (c + 0.5) * S, (r + 0.5) * S + 1);
        }
      }
      if (edit.rect) {
        const { a, b } = edit.rect;
        ctx.fillStyle = 'rgba(226,180,86,.25)';
        ctx.strokeStyle = '#e2b456';
        ctx.lineWidth = 2 * inv;
        const x0 = Math.min(a.c, b.c); const y0 = Math.min(a.r, b.r);
        ctx.fillRect(x0 * S, y0 * S, (Math.abs(a.c - b.c) + 1) * S, (Math.abs(a.r - b.r) + 1) * S);
        ctx.strokeRect(x0 * S, y0 * S, (Math.abs(a.c - b.c) + 1) * S, (Math.abs(a.r - b.r) + 1) * S);
      } else if (hover && inside(hover.c, hover.r)) {
        const [w, hh] = tool === 'prop' ? [edit.w, edit.h] : tool === 'paint' ? [edit.brush, edit.brush] : [1, 1];
        const off = tool === 'paint' ? Math.floor((edit.brush - 1) / 2) : 0;
        ctx.strokeStyle = tool === 'erase' ? '#ff6b5e' : '#ffe9a8';
        ctx.lineWidth = 2.5 * inv;
        ctx.strokeRect((hover.c - off) * S + 1, (hover.r - off) * S + 1, w * S - 2, hh * S - 2);
      }
    } else if (hover && inside(hover.c, hover.r) && !drag && tool !== 'area') {
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 2 * inv;
      ctx.strokeRect(hover.c * S + 1, hover.r * S + 1, S - 2, S - 2);
    }
    updateHud();
  }
  function label(ctx, text, x, y, inv) {
    ctx.font = `700 ${15 * inv}px "Alegreya Sans", sans-serif`;
    const w = ctx.measureText(text).width + 14 * inv;
    ctx.fillStyle = 'rgba(15,11,8,.9)';
    rrect(ctx, x, y - 13 * inv, w, 24 * inv, 8 * inv);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 7 * inv, y);
  }
  function outlineArea(ctx) {
    const { origin: O, aim, shape } = area;
    const L = area.size / METERS;
    const dx = (aim?.x ?? O.x + 1) - O.x; const dy = (aim?.y ?? O.y) - O.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len; const uy = dy / len;
    ctx.beginPath();
    if (shape === 'esfera') ctx.arc(O.x * S, O.y * S, L * S, 0, Math.PI * 2);
    else if (shape === 'cubo') {
      const sx = dx >= 0 ? 1 : -1; const sy = dy >= 0 ? 1 : -1;
      ctx.rect(Math.min(O.x, O.x + sx * L) * S, Math.min(O.y, O.y + sy * L) * S, L * S, L * S);
    } else if (shape === 'cono') {
      ctx.moveTo(O.x * S, O.y * S);
      ctx.lineTo((O.x + ux * L - uy * L / 2) * S, (O.y + uy * L + ux * L / 2) * S);
      ctx.lineTo((O.x + ux * L + uy * L / 2) * S, (O.y + uy * L - ux * L / 2) * S);
      ctx.closePath();
    } else if (shape === 'linea') {
      ctx.moveTo((O.x - uy * 0.5) * S, (O.y + ux * 0.5) * S);
      ctx.lineTo((O.x + ux * L - uy * 0.5) * S, (O.y + uy * L + ux * 0.5) * S);
      ctx.lineTo((O.x + ux * L + uy * 0.5) * S, (O.y + uy * L - ux * 0.5) * S);
      ctx.lineTo((O.x + uy * 0.5) * S, (O.y - ux * 0.5) * S);
      ctx.closePath();
    } else if (shape === 'emanacion' && area.from) {
      const f = area.from;
      rrect(ctx, (f.c - L) * S, (f.r - L) * S, (f.n + 2 * L) * S, (f.n + 2 * L) * S, L * S);
    }
    ctx.stroke();
  }
  function areaTargets() {
    if (!area.cells) return [];
    const set = new Set(area.cells);
    return tokens.filter((t) => {
      if (t.c == null || (area.shape === 'emanacion' && area.fromId === t.id)) return false;
      const n = sizeCells(t.size);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (set.has(idx(t.c + i, t.r + j))) return true;
      return false;
    });
  }
  function recomputeArea() {
    if (!area.origin) { area.cells = null; return; }
    area.cells = areaCells(area.shape, area.size, area.origin, area.aim, scene.cols, scene.rows, area.from);
  }

  // ---------------------------------------------------------------------- HUD
  function updateHud() {
    const parts = [];
    if (!scene) { clear(hud); hud.hidden = true; return; }
    if (drag?.moved && drag.to) {
      const t = tokenById(drag.id);
      const sp = speedCells(t) * METERS;
      const used = (t.moved || 0) + (drag.cost ?? 0) * METERS;
      parts.push(h('b', {}, t.name), ` → ${cellName(drag.to.c, drag.to.r)} · `,
        drag.cost == null ? h('span', { class: 'bad' }, 'sin camino a pie') : h('span', { class: used > sp * 2 ? 'bad' : used > sp ? 'warn' : 'good' },
          `${fmtMeters(drag.cost * METERS)}${t.moved ? ` (total ${fmtMeters(used)})` : ''} de ${fmtMeters(sp)}${used > sp && used <= sp * 2 ? ' · correr' : used > sp * 2 ? ' · demasiado lejos' : ''}`));
    } else if (ruler) {
      const d = Math.max(Math.abs(ruler.b.c - ruler.a.c), Math.abs(ruler.b.r - ruler.a.r));
      parts.push(icon('ruler', 15), h('b', {}, fmtMeters(d * METERS)), ` · ${d} casillas · ${cellName(ruler.a.c, ruler.a.r)} → ${cellName(ruler.b.c, ruler.b.r)}`);
    } else if (area.origin && area.cells) {
      const hit = areaTargets();
      parts.push(icon('flame', 15), h('b', {}, `${AREA_NAME[area.shape]} de ${fmtMeters(area.size)}`), ` · ${area.cells.length} casillas · `,
        h('span', { class: hit.length ? 'warn' : '' }, hit.length ? `${hit.length} criatura${hit.length > 1 ? 's' : ''}: ${hit.map((t) => t.name).join(', ')}` : 'ninguna criatura'),
        !area.live && o.onArea && hit.length > 0 && h('button', { class: 'btn xs danger', type: 'button', onclick: () => o.onArea(hit.map((t) => t.id), { shape: area.shape, size: area.size }) }, icon('flame', 13), 'Daño en área'),
        !area.live && h('button', { class: 'btn xs ghost', type: 'button', onclick: clearArea }, icon('close', 13)));
    } else if (hover && inside(hover.c, hover.r) && (o.dm || !fogged(hover.c, hover.r))) {
      const code = scene.tiles[idx(hover.c, hover.r)];
      const T = cat.T[code];
      const prop = scene.props.find((p) => hover.c >= p.c && hover.c < p.c + (p.w || 1) && hover.r >= p.r && hover.r < p.r + (p.h || 1) && (o.dm || !p.hidden));
      const P = prop && cat.P[prop.k];
      parts.push(h('b', { class: 'coord' }, cellName(hover.c, hover.r)), ` ${T?.name || ''}`,
        T?.cost === 2 ? h('span', { class: 'warn' }, ' · terreno difícil') : T?.cost == null ? h('span', { class: 'bad' }, ' · no se puede pisar') : '',
        T?.hazard ? h('span', { class: 'bad' }, ' · peligro') : '',
        P && [' · ', h('b', {}, P.name), P.effect === 'bloquea' ? ' (bloquea)' : P.effect === 'dificil' ? ' (difícil)' : '', P.cover ? ` · cobertura ${P.cover}` : '']);
      if (!o.editable) {
        const t = rangeToken();
        if (t && showRange && tool === 'move') {
          const { dist, endable } = rangeFor(t);
          const d = dist[idx(hover.c, hover.r)];
          if (d !== Infinity && d > 0) parts.push(' · ', h('span', { class: endable[idx(hover.c, hover.r)] ? 'good' : 'warn' }, `${t.name}: ${fmtMeters(d * METERS)}`));
        }
      }
    } else if (!o.editable) {
      const t = tokens.find((x) => x.current);
      if (t) parts.push(h('b', {}, `Turno de ${t.name}`), ` · velocidad ${fmtMeters(Number(t.speed ?? 9))}${t.moved ? ` · ha movido ${fmtMeters(t.moved)}` : ''}`);
    }
    clear(hud, parts);
    hud.hidden = parts.length === 0;
  }

  // ------------------------------------------------------------------- barra propia
  function drawBar() {
    const btn = (name, ic, tip, on, fn) => h('button', { class: 'btn icon sm', type: 'button', 'aria-pressed': String(!!on), 'data-tip': tip, 'data-tip-pos': 'below', 'aria-label': tip, onclick: fn }, icon(ic, 17));
    const zoom = [
      btn('out', 'zoomOut', 'Alejar', false, () => zoomCenter(1 / 1.25)),
      btn('in', 'zoomIn', 'Acercar', false, () => zoomCenter(1.25)),
      btn('fit', 'fit', 'Ajustar (doble clic)', false, fit),
    ];
    if (o.editable) { clear(bar, zoom); return; }
    clear(bar,
      btn('move', 'hand', 'Mover fichas (M)', tool === 'move', () => setTool('move')),
      btn('ruler', 'ruler', 'Regla (R)', tool === 'ruler', () => setTool('ruler')),
      btn('area', 'flame', 'Área de efecto (A)', tool === 'area', () => setTool(tool === 'area' ? 'move' : 'area')),
      btn('range', 'compass', showRange ? 'Ocultar alcance de movimiento' : 'Mostrar alcance de movimiento', showRange, () => { showRange = !showRange; drawBar(); drawOverlay(); }),
      o.dm && o.onFog && btn('fog', 'cloud', 'Niebla de guerra (N)', tool === 'fog', () => setTool(tool === 'fog' ? 'move' : 'fog')),
      h('span', { class: 'bm-sep' }), zoom);
    drawPop();
  }
  function drawPop() {
    pop.hidden = !['area', 'fog'].includes(tool) || o.editable;
    if (pop.hidden) return;
    if (tool === 'fog') {
      clear(pop,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!fog?.on, onchange: (e) => { fog ||= { on: false, seen: new Set() }; fog.on = e.target.checked; revealParty(); commitFog(); } }), h('b', {}, 'Niebla de guerra')),
        h('div', { class: 'bm-shapes' }, [['revelar', 'Revelar'], ['ocultar', 'Ocultar']].map(([k, l]) => h('button', { class: `chip ${fogMode === k ? 'on' : ''}`, type: 'button', onclick: () => { fogMode = k; drawPop(); } }, l))),
        h('div', { class: 'row nowrap' },
          h('button', { class: 'btn xs', type: 'button', onclick: () => { if (!fog?.on) return; for (let i = 0; i < scene.cols * scene.rows; i++) fog.seen.add(i); commitFog(); } }, 'Revelar todo'),
          h('button', { class: 'btn xs', type: 'button', onclick: () => { if (!fog?.on) return; fog.seen.clear(); revealParty(); commitFog(); } }, 'Cubrir todo')),
        h('p', { class: 'tiny muted' }, 'Arrastra sobre el tablero para revelar u ocultar. Las fichas de los jugadores descubren solas lo que ven a 12 m (los muros tapan). En el modo jugadores la niebla es opaca y esconde a los enemigos.'));
      return;
    }
    clear(pop,
      h('div', { class: 'bm-shapes' }, AREA_SHAPES.map(([k, l]) => h('button', { class: `chip ${area.shape === k ? 'on' : ''}`, type: 'button', onclick: () => { area.shape = k; recomputeArea(); drawPop(); drawOverlay(); } }, l))),
      h('div', { class: 'row nowrap' }, h('span', { class: 'tiny muted' }, area.shape === 'esfera' || area.shape === 'emanacion' ? 'Radio' : area.shape === 'cubo' ? 'Lado' : 'Longitud'),
        h('select', { class: 'mini-sel', 'aria-label': 'Tamaño del área', onchange: (e) => { area.size = Number(e.target.value); recomputeArea(); drawOverlay(); } },
          [1.5, 3, 4.5, 6, 9, 12, 15, 18, 27, 36].map((m) => h('option', { value: m, selected: m === area.size }, fmtMeters(m))))),
      h('p', { class: 'tiny muted' }, area.shape === 'emanacion' ? 'Pulsa sobre la criatura de la que sale.' : area.shape === 'esfera' || area.shape === 'cubo' ? 'Pulsa en una esquina de casilla y arrastra.' : 'Pulsa en el origen y arrastra hacia donde apunta.'));
  }
  function setTool(t) {
    tool = t;
    if (t !== 'ruler') ruler = null;
    if (t !== 'area') clearArea(false);
    el.dataset.tool = t;
    drawBar();
    drawOverlay();
  }
  function clearArea(redrawToo = true) {
    area.origin = null; area.aim = null; area.cells = null; area.from = null; area.fromId = null; area.live = false;
    if (redrawToo) drawOverlay();
  }

  // ------------------------------------------------------------------- edición
  function snapshot() { return { tiles: scene.tiles, props: JSON.stringify(scene.props), spawns: JSON.stringify(scene.spawns) }; }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }
  function restore(s) {
    scene.tiles = s.tiles;
    scene.props = JSON.parse(s.props);
    scene.spawns = JSON.parse(s.spawns);
    redraw();
    o.onChange?.(scene);
  }
  function undo() { if (!undoStack.length) return false; redoStack.push(snapshot()); restore(undoStack.pop()); return true; }
  function redo() { if (!redoStack.length) return false; undoStack.push(snapshot()); restore(redoStack.pop()); return true; }
  function setTiles(cells, code) {
    const arr = scene.tiles.split('');
    let c0 = Infinity; let r0 = Infinity; let c1 = -1; let r1 = -1; let changed = false;
    for (const [c, r] of cells) {
      if (!inside(c, r) || arr[idx(c, r)] === code) continue;
      arr[idx(c, r)] = code;
      changed = true;
      c0 = Math.min(c0, c); r0 = Math.min(r0, r); c1 = Math.max(c1, c); r1 = Math.max(r1, r);
    }
    if (!changed) return;
    scene.tiles = arr.join('');
    redraw({ c0: c0 - 1, r0: r0 - 1, c1: c1 + 1, r1: r1 + 1 });
    o.onChange?.(scene);
  }
  function brushCells(c, r) {
    const n = edit.brush; const off = Math.floor((n - 1) / 2);
    const out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([c - off + i, r - off + j]);
    return out;
  }
  function lineCells(a, b) {
    const out = [];
    const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r), 1);
    for (let i = 0; i <= n; i++) out.push({ c: Math.round(a.c + ((b.c - a.c) * i) / n), r: Math.round(a.r + ((b.r - a.r) * i) / n) });
    return out;
  }
  function floodFill(c, r, code) {
    const from = scene.tiles[idx(c, r)];
    if (from === code) return;
    const seen = new Set([idx(c, r)]); const stack = [[c, r]]; const cells = [];
    while (stack.length) {
      const [x, y] = stack.pop();
      cells.push([x, y]);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (inside(nx, ny) && !seen.has(idx(nx, ny)) && scene.tiles[idx(nx, ny)] === from) { seen.add(idx(nx, ny)); stack.push([nx, ny]); }
      }
    }
    setTiles(cells, code);
  }
  const covers = (p, c, r) => c >= p.c && c < p.c + (p.w || 1) && r >= p.r && r < p.r + (p.h || 1);
  function placeProp(c, r) {
    const w = edit.w; const hh = edit.h;
    c = Math.min(c, scene.cols - w); r = Math.min(r, scene.rows - hh);
    const overlaps = (p) => p.c < c + w && p.c + (p.w || 1) > c && p.r < r + hh && p.r + (p.h || 1) > r;
    const floor = FLOOR_PROPS.has(edit.prop); // una alfombra puede ir debajo de una mesa
    scene.props = scene.props.filter((p) => !overlaps(p) || FLOOR_PROPS.has(p.k) !== floor);
    const item = { k: edit.prop, c, r };
    if (w > 1 || hh > 1) Object.assign(item, { w, h: hh });
    if (edit.hidden || cat.P[edit.prop]?.hidden) item.hidden = true;
    scene.props.push(item);
    redraw({ c0: c - 2, r0: r - 2, c1: c + w + 1, r1: r + hh + 1 });
    o.onChange?.(scene);
    sfx.step();
  }
  function eraseAt(c, r) {
    const all = scene.props.filter((p) => covers(p, c, r));
    if (!all.length) return false;
    const p = all.find((x) => !FLOOR_PROPS.has(x.k)) || all[0]; // primero lo que está encima del suelo
    scene.props = scene.props.filter((x) => x !== p);
    redraw({ c0: p.c - 2, r0: p.r - 2, c1: p.c + (p.w || 1) + 1, r1: p.r + (p.h || 1) + 1 });
    o.onChange?.(scene);
    return true;
  }
  function toggleSpawn(c, r, which) {
    const list = scene.spawns[which];
    const i = list.findIndex(([x, y]) => x === c && y === r);
    if (i >= 0) list.splice(i, 1);
    else {
      const other = scene.spawns[which === 'party' ? 'enemies' : 'party'];
      const j = other.findIndex(([x, y]) => x === c && y === r);
      if (j >= 0) other.splice(j, 1);
      list.push([c, r]);
    }
    drawOverlay();
    o.onChange?.(scene);
  }

  // --------------------------------------------------------------------- punteros
  const pointers = new Map();
  let pan = null; let pinch = null; let spaceDown = false;
  function startPan(e) { pan = { x: e.clientX - view.x, y: e.clientY - view.y, sx: e.clientX, sy: e.clientY, moved: false }; vp.classList.add('panning'); }
  vp.addEventListener('pointerdown', (e) => {
    if (!scene) return;
    vp.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { vp.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      pan = null; drag = null; edit.stroke = null; edit.rect = null;
      return;
    }
    const p = toCells(e);
    const cell = { c: Math.floor(p.x), r: Math.floor(p.y) };
    const tokenEl = e.target.closest('.bm-token');
    if (e.button === 1 || spaceDown || tool === 'pan') { e.preventDefault(); startPan(e); return; }
    if (e.button !== 0) return;
    if (!o.editable) {
      if (e.shiftKey) { ping(p); return; }
      if (tool === 'move' && tokenEl) {
        const t = tokenById(tokenEl.dataset.id);
        if (!t) return;
        drag = { id: t.id, from: { c: t.c, r: t.r }, to: null, start: { x: e.clientX, y: e.clientY }, grab: { x: p.x - t.c, y: p.y - t.r }, moved: false, cost: 0, allowed: o.canMove ? o.canMove(t) : true };
        return;
      }
      if (tool === 'ruler') { ruler = { a: cell, b: cell, live: true }; sfx.tick(); drawOverlay(); return; }
      if (tool === 'fog' && fog?.on && inside(cell.c, cell.r)) { edit.stroke = cell; paintFog(cell.c, cell.r); return; }
      if (tool === 'area') {
        if (area.shape === 'emanacion') {
          const t = tokenEl ? tokenById(tokenEl.dataset.id) : tokens.find((x) => x.c != null && covers({ c: x.c, r: x.r, w: sizeCells(x.size), h: sizeCells(x.size) }, cell.c, cell.r));
          if (!t) return;
          const n = sizeCells(t.size);
          area.from = { c: t.c, r: t.r, n };
          area.fromId = t.id;
          area.origin = { x: t.c + n / 2, y: t.r + n / 2 };
          area.aim = null;
          area.live = false;
        } else {
          area.origin = { x: Math.round(p.x), y: Math.round(p.y) };
          area.aim = { x: p.x + 0.01, y: p.y };
          area.from = null;
          area.live = true;
        }
        recomputeArea();
        drawOverlay();
        if (!area.live) sfx.blast();
        return;
      }
      startPan(e);
      return;
    }
    // edición
    if (!inside(cell.c, cell.r)) { startPan(e); return; }
    if (tool === 'paint') { pushUndo(); edit.stroke = cell; setTiles(brushCells(cell.c, cell.r), edit.terrain); sfx.brush(); }
    else if (tool === 'rect') { pushUndo(); edit.rect = { a: cell, b: cell }; drawOverlay(); }
    else if (tool === 'fill') { pushUndo(); floodFill(cell.c, cell.r, edit.terrain); sfx.brush(); }
    else if (tool === 'prop') { pushUndo(); placeProp(cell.c, cell.r); }
    else if (tool === 'erase') { pushUndo(); edit.stroke = cell; if (!eraseAt(cell.c, cell.r)) undoStack.pop(); }
    else if (tool === 'spawn-party' || tool === 'spawn-enemies') { pushUndo(); toggleSpawn(cell.c, cell.r, tool === 'spawn-party' ? 'party' : 'enemies'); }
  });
  vp.addEventListener('pointermove', (e) => {
    if (!scene) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.x += m.x - pinch.m.x; view.y += m.y - pinch.m.y;
      const bb = vp.getBoundingClientRect();
      zoomAt(d / (pinch.d || 1), m.x - bb.left, m.y - bb.top);
      pinch = { d, m };
      return;
    }
    const p = toCells(e);
    const cell = { c: Math.floor(p.x), r: Math.floor(p.y) };
    if (pan) {
      view.x = e.clientX - pan.x; view.y = e.clientY - pan.y;
      if (Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) > 4) { pan.moved = true; fitted = false; }
      apply();
      return;
    }
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) < 5) return;
      if (!drag.allowed) return;
      const t = tokenById(drag.id);
      const n = sizeCells(t.size);
      if (!drag.moved) { drag.moved = true; drag.field = movementField(scene, cat, costs, { ...t, c: drag.from.c, r: drag.from.r }, tokens, 400); renderTokens(); }
      const tel = tokenEls.get(t.id);
      tel.style.left = `${(p.x - drag.grab.x) * S}px`;
      tel.style.top = `${(p.y - drag.grab.y) * S}px`;
      const to = { c: Math.round(p.x - drag.grab.x), r: Math.round(p.y - drag.grab.y) };
      to.c = Math.max(0, Math.min(scene.cols - n, to.c));
      to.r = Math.max(0, Math.min(scene.rows - n, to.r));
      if (!drag.to || drag.to.c !== to.c || drag.to.r !== to.r) {
        drag.to = to;
        const d = drag.field.dist[idx(to.c, to.r)];
        drag.cost = d === Infinity ? null : d;
        drawOverlay();
      }
      return;
    }
    if (ruler?.live) {
      if (ruler.b.c !== cell.c || ruler.b.r !== cell.r) { ruler.b = cell; sfx.tick(); drawOverlay(); }
      return;
    }
    if (!o.editable && tool === 'fog' && edit.stroke && pointers.has(e.pointerId)) {
      if (edit.stroke.c !== cell.c || edit.stroke.r !== cell.r) { lineCells(edit.stroke, cell).forEach((q) => paintFog(q.c, q.r)); edit.stroke = cell; }
      return;
    }
    if (area.live && area.origin) {
      if (area.shape === 'esfera') area.origin = { x: Math.round(p.x), y: Math.round(p.y) }; else area.aim = p;
      recomputeArea();
      drawOverlay();
      return;
    }
    if (o.editable && pointers.has(e.pointerId)) {
      if (tool === 'paint' && edit.stroke) {
        if (edit.stroke.c !== cell.c || edit.stroke.r !== cell.r) {
          const cells = lineCells(edit.stroke, cell).flatMap((q) => brushCells(q.c, q.r));
          edit.stroke = cell;
          setTiles(cells, edit.terrain);
        }
      } else if (tool === 'erase' && edit.stroke) {
        if (edit.stroke.c !== cell.c || edit.stroke.r !== cell.r) { edit.stroke = cell; eraseAt(cell.c, cell.r); }
      } else if (tool === 'rect' && edit.rect) {
        edit.rect.b = { c: Math.max(0, Math.min(scene.cols - 1, cell.c)), r: Math.max(0, Math.min(scene.rows - 1, cell.r)) };
        drawOverlay();
      }
    }
    if (!hover || hover.c !== cell.c || hover.r !== cell.r) { hover = cell; drawOverlay(); }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (pan) {
      vp.classList.remove('panning');
      const wasClick = !pan.moved;
      pan = null;
      if (wasClick && !o.editable && e.type === 'pointerup') {
        const cl = toCells(e);
        const c = Math.floor(cl.x); const r = Math.floor(cl.y);
        if (doorsOn && inside(c, r) && scene.tiles[idx(c, r)] === 'D') { toggleDoor(c, r); return; }
        selected = null; renderTokens(); drawOverlay(); o.onBackgroundClick?.();
      }
      return;
    }
    if (drag) {
      const t = tokenById(drag.id);
      const d = drag;
      drag = null;
      if (!d.moved) { o.onTokenClick?.(t.id, tokenEls.get(t.id), e); selected = t.id; renderTokens(); drawOverlay(); return; }
      if (d.to && (d.to.c !== d.from.c || d.to.r !== d.from.r) && e.type === 'pointerup') {
        const others = tokens.filter((x) => x.id !== t.id && !(x.hp != null && x.hp <= 0));
        if (spaceFree(t, d.to.c, d.to.r, others)) {
          const meters = d.cost == null ? Math.max(Math.abs(d.to.c - d.from.c), Math.abs(d.to.r - d.from.r)) * METERS : d.cost * METERS;
          t.c = d.to.c; t.r = d.to.r;
          rangeCache = null;
          sfx.step();
          if (fog?.on && t.type === 'jugador') { revealFrom(t); commitFog(); }
          o.onMove?.(t.id, t.c, t.r, meters, d.cost == null);
        }
      }
      renderTokens();
      drawOverlay();
      return;
    }
    if (ruler?.live) { ruler.live = false; drawOverlay(); return; }
    if (!o.editable && tool === 'fog' && edit.stroke) { edit.stroke = null; commitFog(); return; }
    if (area.live) {
      area.live = false;
      recomputeArea();
      sfx.blast();
      drawOverlay();
      return;
    }
    if (o.editable) {
      if (tool === 'rect' && edit.rect) {
        const { a, b } = edit.rect;
        edit.rect = null;
        const cells = [];
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) cells.push([c, r]);
        setTiles(cells, edit.terrain);
        sfx.brush();
        drawOverlay();
      }
      edit.stroke = null;
    }
  }
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);
  vp.addEventListener('pointerleave', () => { if (!pointers.size && hover) { hover = null; drawOverlay(); } });
  vp.addEventListener('wheel', (e) => {
    if (!scene) return;
    e.preventDefault();
    const b = vp.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  vp.addEventListener('dblclick', (e) => {
    const tel = e.target.closest('.bm-token');
    if (tel) { o.onTokenDbl?.(tel.dataset.id); return; }
    if (!o.editable) fit();
  });
  vp.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!scene) return;
    const tel = e.target.closest('.bm-token');
    if (tel && !o.editable) { o.onTokenContext?.(tel.dataset.id, e); return; }
    if (o.editable) {
      const p = toCells(e);
      if (inside(Math.floor(p.x), Math.floor(p.y))) { pushUndo(); if (!eraseAt(Math.floor(p.x), Math.floor(p.y))) undoStack.pop(); }
    }
  });
  vp.addEventListener('keydown', (e) => {
    if (e.key === ' ') { spaceDown = true; e.preventDefault(); }
    if (o.editable) return;
    if (e.key === 'Escape') { ruler = null; clearArea(false); selected = null; renderTokens(); drawOverlay(); }
    else if (e.key === 'r' || e.key === 'R') setTool(tool === 'ruler' ? 'move' : 'ruler');
    else if (e.key === 'a' || e.key === 'A') setTool(tool === 'area' ? 'move' : 'area');
    else if (e.key === 'm' || e.key === 'M') setTool('move');
    else if ((e.key === 'n' || e.key === 'N') && o.dm && o.onFog) setTool(tool === 'fog' ? 'move' : 'fog');
  });
  vp.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });

  // Soltar fichas desde fuera (lista de participantes, cinta de iniciativa…).
  vp.addEventListener('dragover', (e) => {
    if (scene && [...e.dataTransfer.types].includes('application/x-dnd-token')) { e.preventDefault(); e.stopPropagation(); vp.classList.add('drop-over'); }
  });
  vp.addEventListener('dragleave', () => vp.classList.remove('drop-over'));
  vp.addEventListener('drop', (e) => {
    vp.classList.remove('drop-over');
    const raw = e.dataTransfer.getData('application/x-dnd-token');
    if (!raw || !scene) return;
    e.preventDefault();
    e.stopPropagation();
    const p = toCells(e);
    const c = Math.floor(p.x); const r = Math.floor(p.y);
    if (inside(c, r)) { sfx.step(); o.onDropToken?.(JSON.parse(raw), c, r); }
  });

  function ping(p) {
    const pe = h('span', { class: 'ping', style: { left: `${p.x * S}px`, top: `${p.y * S}px` } }, h('i'), h('i'), h('i'));
    layer.style.setProperty('--zoom', view.scale);
    tokensEl.append(pe);
    sfx.ping();
    setTimeout(() => pe.remove(), 2600);
  }

  const ro = new ResizeObserver(() => { if (fitted || !layer.style.transform) fit(); else drawOverlay(); });
  ro.observe(vp);
  el.dataset.tool = tool;
  drawBar();

  return {
    el,
    setScene,
    get scene() { return scene; },
    redraw,
    setTokens,
    setDm(v) { if (o.dm !== v) { o.dm = v; redraw(); drawBar(); } },
    setDoors(list) { openDoors = new Set(list || []); if (scene && doorsOn) redraw(); },
    setFog(f) { fog = f ? { on: !!f.on, seen: new Set(f.seen || []) } : null; drawFog(); renderTokens(); if (tool === 'fog') drawPop(); },
    setTool,
    get tool() { return tool; },
    setEdit(patch) { Object.assign(edit, patch); drawOverlay(); },
    select(id) { selected = id; renderTokens(); drawOverlay(); },
    setRange(v) { showRange = v; drawBar(); drawOverlay(); },
    setEmpty(content) { clear(emptyEl, content); },
    fit, centerOn, zoom: zoomCenter, undo, redo, ping,
    cellAt(clientX, clientY) {
      const p = toCells({ clientX, clientY });
      const c = Math.floor(p.x); const r = Math.floor(p.y);
      return inside(c, r) ? { c, r } : null;
    },
    freeCell(c, r, n = 1, avoid = []) { return findFree(c, r, n, avoid); },
    destroy() { ro.disconnect(); el.remove(); },
  };

  // Casilla libre y transitable más cercana a (c, r) para una criatura de n×n.
  function findFree(c, r, n, avoid) {
    if (!scene) return null;
    const busy = new Set(avoid.map(([x, y]) => idx(x, y)));
    for (const t of tokens) {
      if (t.c == null) continue;
      const m = sizeCells(t.size);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) busy.add(idx(t.c + i, t.r + j));
    }
    const ok = (x, y) => {
      if (x < 0 || y < 0 || x + n > scene.cols || y + n > scene.rows) return false;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = idx(x + i, y + j); if (costs[k] === Infinity || busy.has(k)) return false; }
      return true;
    };
    for (let rad = 0; rad < Math.max(scene.cols, scene.rows); rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          if (ok(c + dx, r + dy)) return { c: c + dx, r: r + dy };
        }
      }
    }
    return null;
  }
}
