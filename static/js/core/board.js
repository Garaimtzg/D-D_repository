// Puente entre un combate y su tablero: qué escenario usa, dónde está cada participante,
// cómo se ven sus fichas (con lo que ocultar a los jugadores) y la colocación automática.
import { api } from './api.js';
import { sceneCatalog, costGrid, sizeCells, spaceFree } from './battlemap.js';
import { current } from './combat.js';

const NO_SPEED = ['Agarrado', 'Apresado', 'Inconsciente', 'Paralizado', 'Petrificado'];

// Catálogo + escenarios propios de la campaña.
export async function loadScenes() {
  const [cat, custom] = await Promise.all([sceneCatalog(), api.list('scenes')]);
  return { cat, custom };
}

export function findScene(id, { cat, custom }) {
  if (!id) return null;
  return cat.presets.find((s) => s.id === id) || custom.find((s) => s.id === id) || null;
}

export function ensureBoard(c) {
  c.board ||= { scene: null, pos: {}, moved: {} };
  c.board.pos ||= {};
  c.board.moved ||= {};
  return c.board;
}

// Velocidad que le queda a una criatura este turno (cansancio y estados que la dejan a 0).
export function speedOf(x) {
  if (x.conditions?.some((k) => NO_SPEED.includes(k.name))) return 0;
  return Math.max(0, (Number(x.speed) || 9) - 1.5 * (x.exhaustion || 0));
}

// Fichas para el tablero. En modo jugadores se esconden los ocultos y los PG exactos de los enemigos.
export function boardTokens(c, { player = false } = {}) {
  const pos = c.board?.pos || {};
  const cur = c.status === 'active' ? current(c) : null;
  return c.combatants.filter((x) => pos[x.cid] && !(player && x.hidden)).map((x) => {
    const masked = player && x.type !== 'jugador';
    let hp = x.hp;
    if (masked && x.maxHp) {
      const r = x.hp / Math.max(1, x.maxHp);
      hp = x.maxHp * (r >= 1 ? 1 : r > 0.5 ? 0.7 : r > 0.25 ? 0.4 : r > 0 ? 0.15 : 0);
    }
    return {
      id: x.cid, name: x.name, color: x.color, portrait: x.portrait, look: x.look, type: x.type, size: x.size || 'Mediano',
      c: pos[x.cid][0], r: pos[x.cid][1], hp, maxHp: x.maxHp, tempHp: masked ? 0 : x.tempHp,
      current: x === cur, hidden: !!x.hidden, conds: (x.conditions || []).map((k) => k.name), conc: !!x.concentration,
      speed: speedOf(x), moved: c.board?.moved?.[x.cid] || 0,
    };
  });
}

// Coloca a quien no esté en el tablero: el grupo en sus casillas de inicio y los enemigos en las suyas.
export function autoPlace(c, scene, cat, only = null) {
  const board = ensureBoard(c);
  const costs = costGrid(scene, cat);
  const { cols, rows } = scene;
  const placed = c.combatants.filter((x) => board.pos[x.cid]).map((x) => ({ c: board.pos[x.cid][0], r: board.pos[x.cid][1], size: x.size }));
  const fits = (x, col, row) => {
    const n = sizeCells(x.size);
    if (col < 0 || row < 0 || col + n > cols || row + n > rows) return false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (costs[(row + j) * cols + col + i] === Infinity) return false;
    return spaceFree(x, col, row, placed); // hasta cuatro diminutos por casilla
  };
  const near = (x, col, row) => {
    for (let rad = 0; rad < Math.max(cols, rows); rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === rad && fits(x, col + dx, row + dy)) return [col + dx, row + dy];
        }
      }
    }
    return null;
  };
  const spawns = {
    party: [...(scene.spawns?.party || [])], enemies: [...(scene.spawns?.enemies || [])],
  };
  const fallback = { party: [Math.floor(cols * 0.12), Math.floor(rows / 2)], enemies: [Math.floor(cols * 0.82), Math.floor(rows / 2)] };
  let count = 0;
  for (const x of c.combatants) {
    if (board.pos[x.cid] || (only && !only.includes(x.cid))) continue;
    const side = x.type === 'enemigo' ? 'enemies' : 'party';
    let spot = null;
    while (spawns[side].length && !spot) {
      const [col, row] = spawns[side].shift();
      if (fits(x, col, row)) spot = [col, row];
    }
    spot ||= near(x, ...(scene.spawns?.[side]?.[0] || fallback[side]));
    if (!spot) continue;
    board.pos[x.cid] = spot;
    placed.push({ c: spot[0], r: spot[1], size: x.size });
    count++;
  }
  return count;
}

// Coloca a un participante en la casilla libre más cercana a (col, row).
export function placeNear(c, scene, cat, x, col, row) {
  const board = ensureBoard(c);
  delete board.pos[x.cid];
  const costs = costGrid(scene, cat);
  const { cols, rows } = scene;
  const others = c.combatants.filter((y) => board.pos[y.cid]).map((y) => ({ c: board.pos[y.cid][0], r: board.pos[y.cid][1], size: y.size }));
  const n = sizeCells(x.size);
  const fits = (a, b) => {
    if (a < 0 || b < 0 || a + n > cols || b + n > rows) return false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (costs[(b + j) * cols + a + i] === Infinity) return false;
    return spaceFree(x, a, b, others); // hasta cuatro diminutos por casilla
  };
  for (let rad = 0; rad < Math.max(cols, rows); rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === rad && fits(col + dx, row + dy)) { board.pos[x.cid] = [col + dx, row + dy]; return true; }
      }
    }
  }
  return false;
}
