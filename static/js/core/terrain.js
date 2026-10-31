// Terreno natural con contornos suaves. Las reglas siguen siendo por casillas (cada casilla tiene un terreno), pero el
// dibujo de los terrenos «blandos» (agua, hierba, tierra, barro, lava, nieve…) sigue curvas orgánicas:
//   · Cada casilla blanda aporta a su terreno un peso que cae con la distancia (campana de Gauss centrada en la casilla).
//   · En cada punto gana el terreno con más peso, con un poco de ruido suave para que la orilla no sea geométrica.
//   · El contorno se saca con «marching squares» sobre una rejilla fina dentro de cada casilla y se usa como recorte
//     vectorial: se ve nítido a cualquier escala (pantalla, imagen de 300 ppp…).
// Los terrenos «duros» (losas, tablones, muros, puentes, abismo…) mantienen el borde recto de su casilla. Algunos
// («mezclables»: losas, adoquines, escombros, roca de cueva…) sí pueden comerse las esquinas de una casilla blanda
// vecina (un charco de lava en un suelo de losas queda redondo; una cueva, con paredes curvas), pero nunca al revés:
// lo blando no invade lo duro, así que nada transitable parece muro ni al contrario.
// Todo depende solo del punto y de las casillas de alrededor: al repintar una zona, el resto no cambia.
import { noise2 } from './paint.js';

const SIGMA2 = 2 * 0.52 * 0.52; // anchura de la campana (en casillas²)
const REACH2 = 3.2; // más lejos de esto (en casillas²) una casilla ya no influye
const AMP = 0.5; // fuerza del ruido en la orilla
const FREQ = 1.05; // frecuencia del ruido (ondulaciones por casilla)
const HARD_GAIN = 1.6; // un terreno duro pesa más: la orilla queda siempre dentro de la casilla blanda
// Orillas con contorno propio: grupo -> terrenos que lo forman. Entre terrenos del mismo grupo no hay orilla.
export const RIM_GROUPS = { agua: '~W', lava: 'l', acido: 'A', toxico: 'P', arena: 'q', roca: 'R' };
const RIM_OF = {};
for (const [g, codes] of Object.entries(RIM_GROUPS)) for (const ch of codes) RIM_OF[ch] = g;

const cache = new Map(); // contornos por casilla (con su vecindario y semilla en la clave)
const MAX_CACHE = 30000;

// sc: escenario · isSoft(code): si el terreno se dibuja con contorno suave · seed: variación del ruido ·
// isMixer(code): terrenos duros que pueden redondear las esquinas de las casillas blandas
export function softTerrain(sc, isSoft, seed = 0, isMixer = () => false) {
  const { cols, rows, tiles } = sc;
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : tiles[r * cols + c]);
  const offs = {};
  const offFor = (ch) => (offs[ch] ||= [((ch.charCodeAt(0) * 12.9898) % 61) + 3.1, ((ch.charCodeAt(0) * 78.233) % 53) + 7.7]);
  const codes = []; const ws = [];
  // Pesos de cada terreno blando en el punto (x, y), en casillas. Rellena codes/ws y devuelve cuántos hay.
  function sample(x, y) {
    let n = 0;
    const fc = Math.floor(x); const fr = Math.floor(y);
    for (let r = fr - 2; r <= fr + 2; r++) {
      for (let c = fc - 2; c <= fc + 2; c++) {
        const code = at(c, r);
        if (code == null) continue;
        const soft = isSoft(code);
        if (!soft && !isMixer(code)) continue;
        const dx = c + 0.5 - x; const dy = r + 0.5 - y; const d2 = dx * dx + dy * dy;
        if (d2 > REACH2) continue;
        const w = Math.exp(-d2 / SIGMA2) * (soft ? 1 : HARD_GAIN);
        let i = 0;
        while (i < n && codes[i] !== code) i++;
        if (i === n) { codes[n] = code; ws[n] = 0; n++; }
        ws[i] += w;
      }
    }
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        const o = offFor(codes[i]);
        ws[i] += AMP * (noise2(x * FREQ + o[0], y * FREQ + o[1], seed) - 0.5);
      }
    }
    return n;
  }
  // Terreno que se ve en el punto (x, y): el de la casilla si es duro; si es blando, el que más pesa.
  function winnerAt(x, y) {
    const own = at(Math.floor(x), Math.floor(y));
    if (own == null || !isSoft(own)) return own;
    const n = sample(x, y);
    let best = own; let bw = -Infinity;
    for (let i = 0; i < n; i++) if (ws[i] > bw) { bw = ws[i]; best = codes[i]; }
    return best;
  }
  // Contornos de la casilla (c, r): { overlays: [[código, polígonos]], rims: [[grupo, segmentos]] } en coordenadas
  // locales (0..1). overlays son los trozos de la casilla que se lleva otro terreno; rims, las líneas de orilla.
  function cellShapes(c, r, P) {
    const own = at(c, r);
    if (own == null || !isSoft(own)) return null;
    // vecindario: si no hay otro terreno blando cerca, no hay nada que calcular
    let sig = '';
    let mixed = false;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const k = at(c + dc, r + dr);
        const part = k != null && (isSoft(k) || isMixer(k));
        sig += part ? k : '·';
        if (part && k !== own) mixed = true;
      }
    }
    if (!mixed) return null;
    const key = `${c},${r},${P},${seed}|${sig}`;
    if (cache.has(key)) return cache.get(key);
    // muestras en una rejilla de (P + 1)² puntos dentro de la casilla
    const N = P + 1;
    const samples = new Array(N * N);
    const present = new Set();
    const groups = new Set();
    let foreign = false;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const n = sample(c + i / P, r + j / P);
        const m = {};
        let best = own; let bw = -Infinity;
        for (let q = 0; q < n; q++) { m[codes[q]] = ws[q]; present.add(codes[q]); if (ws[q] > bw) { bw = ws[q]; best = codes[q]; } }
        if (best !== own) foreign = true;
        samples[j * N + i] = m;
      }
    }
    for (const k of present) if (RIM_OF[k]) groups.add(RIM_OF[k]);
    const out = { overlays: [], rims: [] };
    // valor con signo: >0 dentro de lo que se pide
    const field = (inside) => samples.map((m) => {
      let a = -9; let b = -9;
      for (const [k, w] of Object.entries(m)) if (inside(k)) { if (w > a) a = w; } else if (w > b) b = w;
      return a - b;
    });
    if (foreign) {
      for (const X of present) {
        if (X === own) continue;
        const v = field((k) => k === X);
        const polys = march(v, P, false);
        if (polys.length) out.overlays.push([X, polys]);
      }
    }
    for (const g of groups) {
      const v = field((k) => RIM_OF[k] === g);
      if (v.every((x) => x > 0) || v.every((x) => x <= 0)) continue;
      const segs = march(v, P, true);
      if (segs.length) out.rims.push([g, segs]);
    }
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(key, out);
    return out;
  }
  return { at, winnerAt, cellShapes };
}

// Marching squares sobre una rejilla de (P + 1)² valores. Sin `lines`: polígonos de la zona con valor > 0 (cada
// cuadradito recortado por la interpolación lineal). Con `lines`: segmentos de la curva de nivel 0.
function march(v, P, lines) {
  const N = P + 1;
  const out = [];
  for (let j = 0; j < P; j++) {
    for (let i = 0; i < P; i++) {
      const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const vals = [v[j * N + i], v[j * N + i + 1], v[(j + 1) * N + i + 1], v[(j + 1) * N + i]];
      const ins = vals.map((x) => x > 0);
      const all = ins.every(Boolean); const none = !ins.some(Boolean);
      if (lines) {
        if (all || none) continue;
        const cross = [];
        for (let k = 0; k < 4; k++) {
          const a = vals[k]; const b = vals[(k + 1) % 4];
          if ((a > 0) !== (b > 0)) {
            const t = a / (a - b); const [x0, y0] = corners[k]; const [x1, y1] = corners[(k + 1) % 4];
            cross.push([(x0 + (x1 - x0) * t) / P, (y0 + (y1 - y0) * t) / P]);
          }
        }
        for (let k = 0; k + 1 < cross.length; k += 2) out.push([cross[k][0], cross[k][1], cross[k + 1][0], cross[k + 1][1]]);
        continue;
      }
      if (none) continue;
      if (all) { out.push([[i / P, j / P], [(i + 1) / P, j / P], [(i + 1) / P, (j + 1) / P], [i / P, (j + 1) / P]]); continue; }
      const poly = [];
      for (let k = 0; k < 4; k++) {
        const a = vals[k]; const b = vals[(k + 1) % 4];
        const [x0, y0] = corners[k]; const [x1, y1] = corners[(k + 1) % 4];
        if (a > 0) poly.push([x0 / P, y0 / P]);
        if ((a > 0) !== (b > 0)) { const t = a / (a - b); poly.push([(x0 + (x1 - x0) * t) / P, (y0 + (y1 - y0) * t) / P]); }
      }
      if (poly.length >= 3) out.push(poly);
    }
  }
  return out;
}

// Estilo de cada orilla: trazos de fuera a dentro [color, ancho en casillas, brillo].
export const RIM_STYLE = {
  agua: [['rgba(28,40,30,.32)', 0.12], ['rgba(70,140,170,.35)', 0.06], ['rgba(228,246,255,.7)', 0.026]],
  lava: [['rgba(25,6,0,.78)', 0.14], ['rgba(255,170,60,.95)', 0.035, '#ff8a2a']],
  roca: [['rgba(0,0,0,.28)', 0.16], ['rgba(14,10,7,.88)', 0.045]],
  acido: [['rgba(15,45,10,.6)', 0.1], ['rgba(210,255,120,.9)', 0.03, '#b6ff6b']],
  toxico: [['rgba(20,10,30,.55)', 0.1], ['rgba(200,140,255,.7)', 0.025]],
  arena: [['rgba(90,60,20,.35)', 0.07]],
};

// Sombra de la roca de cueva: más oscura cuanto más lejos queda del suelo abierto, con un degradado continuo en vez
// de escalones por casilla. Lienzo pequeño (4 px por casilla) que se estira con suavizado.
const shadeCache = new Map();
export function rockShade(sc, isRock, isOpen) {
  const key = `${sc.cols}x${sc.rows}:${sc.tiles}`;
  if (shadeCache.has(key)) return shadeCache.get(key);
  const K = 4;
  const { cols, rows, tiles } = sc;
  const cv = document.createElement('canvas');
  cv.width = cols * K; cv.height = rows * K;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  for (let py = 0; py < cv.height; py++) {
    for (let px = 0; px < cv.width; px++) {
      const c = Math.floor(px / K); const r = Math.floor(py / K);
      if (!isRock(tiles[r * cols + c])) continue;
      const x = (px + 0.5) / K; const y = (py + 0.5) / K;
      let d = 3;
      for (let rr = r - 3; rr <= r + 3; rr++) {
        for (let cc = c - 3; cc <= c + 3; cc++) {
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || !isOpen(tiles[rr * cols + cc])) continue;
          const dx = Math.max(cc - x, 0, x - cc - 1); const dy = Math.max(rr - y, 0, y - rr - 1);
          d = Math.min(d, Math.hypot(dx, dy));
        }
      }
      const t = Math.min(1, Math.max(0, (d - 0.1) / 2.2));
      img.data[(py * cv.width + px) * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 0.82 * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  shadeCache.set(key, cv);
  if (shadeCache.size > 8) shadeCache.delete(shadeCache.keys().next().value);
  return cv;
}
