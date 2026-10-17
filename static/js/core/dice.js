// Tiradas: el resultado lo calcula el servidor (Python, con registro de tiradas) y aquí se
// anima con dados 3D que salen desde donde has pulsado y ruedan por la pantalla.
import { api } from './api.js';
import { h, prefs, toastError } from './dom.js';
import { sfx } from './sfx.js';

const Dice3D = window.Dice3D;
Dice3D.sound.enabled = prefs.get('sound', true);

const listeners = new Set();
export const onRoll = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Los dados salen desde el último sitio donde se ha pulsado (el botón de la tirada).
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight - 60 };
window.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, true);

let overlay = null;
let localTray = null;      // la bandeja de la sección Dados, si está abierta
let resultEl = null;
let resultTimer = 0;

export function setLocalTray(tray) { localTray = tray; }

export function setSound(on) {
  Dice3D.sound.enabled = on;
  sfx.setOn(on);
}

// Crítico: destello dorado. Pifia: destello rojo y la pantalla tiembla.
function dramatic(r) {
  if (!r.crit) return;
  const flash = h('div', { class: `screen-flash ${r.crit === 'critico' ? 'crit' : 'fumble'}` });
  document.body.append(flash);
  setTimeout(() => flash.remove(), 1100);
  if (r.crit === 'pifia') {
    const v = document.getElementById('view');
    v?.classList.remove('quake'); void v?.offsetWidth; v?.classList.add('quake');
  }
}
export const soundOn = () => Dice3D.sound.enabled;

export function describe(r) {
  return r.parts.map((p) => {
    if (!p.rolls) return p.term.replace(/^\+/, '+ ');
    const dice = p.rolls.map((v, i) => (p.kept.includes(i) ? v : `(${v})`)).join(' · ');
    return `${p.term.replace(/^\+/, '')} [${dice}]`;
  }).join('  ');
}

function stageCenter() {
  const main = document.getElementById('view')?.getBoundingClientRect();
  if (!main) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: main.left + main.width / 2, y: Math.min(window.innerHeight * 0.55, main.top + Math.min(main.height, window.innerHeight) / 2) };
}

// Si la vista marca una zona de juego (el tablero de la Mesa), los dados caen dentro de ella.
function diceArea() {
  const el = document.querySelector('[data-dice-area]');
  const r = el?.getBoundingClientRect();
  if (!r || r.width < 240 || r.height < 200 || r.bottom < 0 || r.top > window.innerHeight) return null;
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  if (bottom - top < 200) return null;
  return { x0: r.left + 10, y0: top + 10, x1: r.right - 10, y1: bottom - 10 };
}

function showResult(r, pos) {
  clearTimeout(resultTimer);
  resultEl?.remove();
  const cls = r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : '';
  const mode = r.mode === 'adv' ? ' · ventaja' : r.mode === 'dis' ? ' · desventaja' : '';
  resultEl = h('div', { class: `roll-result ${cls}`, role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'lbl' }, `${r.label || r.expr}${mode}${r.secret ? ' · secreta' : ''}`),
    h('div', { class: 'total' }, r.total),
    h('div', { class: 'detail' }, describe(r)),
    cls && h('span', { class: 'tag' }, cls === 'crit' ? '¡CRÍTICO!' : '¡PIFIA!'));
  const top = Math.max(110, (pos?.top ?? window.innerHeight / 2) - 18);
  Object.assign(resultEl.style, { left: `${Math.min(window.innerWidth - 120, Math.max(120, pos?.x ?? window.innerWidth / 2))}px`, top: `${top}px` });
  document.body.append(resultEl);
  const el = resultEl;
  resultTimer = setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 600); }, 2600);
}

// Lanza una tirada. Devuelve el resultado cuando los dados se han parado (o al momento si quiet).
export async function roll(expr, { label = '', mode = '', who = 'DM', secret = false, quiet = false, color = '' } = {}) {
  let r;
  try {
    r = await api.post('/api/roll', { expr, label, mode, who, secret });
  } catch (e) {
    toastError(e);
    return null;
  }
  if (!quiet) {
    const specs = Dice3D.diceFromResult(r, color ? { color } : {});
    if (specs.length) {
      const tray = localTray || (overlay ??= Dice3D.createTray(document.getElementById('dice-overlay'), { overlay: true }));
      // una tirada nueva recoge los dados de la anterior y los vuelve a lanzar
      const area = localTray ? null : diceArea();
      const pos = await tray.roll(specs, localTray ? {} : { origin: lastPointer, bounds: area, target: area ? null : stageCenter() });
      if (!localTray && pos) showResult(r, pos);
      if (pos) dramatic(r);
    } else if (!localTray) showResult(r, stageCenter());
  }
  listeners.forEach((fn) => fn(r));
  return r;
}
