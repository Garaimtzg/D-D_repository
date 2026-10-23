// Tiradas: el resultado lo calcula el servidor (Python, con registro de tiradas) y aquí se
// anima con dados 3D que salen desde donde has pulsado y ruedan por la pantalla.
import { api } from './api.js';
import { h, prefs, toastError, modal, dieIcon, react } from './dom.js';
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
    if (p.sum) return `${p.term.replace(/^\+/, '')} [suma ${Math.abs(p.value)}]`;
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

// Dados físicos: la mesa tira sus propios dados y aquí se apunta lo que ha salido (la app suma,
// aplica la ventaja y detecta críticos). 'jugadores': solo las tiradas de personajes jugadores.
export const PHYSICAL = [['off', '🎲 Dados de la app'], ['jugadores', '✋ Físicos: los jugadores'], ['todos', '✋ Físicos: todos']];
export const physicalMode = () => prefs.get('dice.physical', 'off');
export function setPhysicalMode(v) {
  prefs.set('dice.physical', v);
  window.dispatchEvent(new CustomEvent('dnd:physical', { detail: v }));
}

async function wantsPhysical(who) {
  const m = physicalMode();
  if (m === 'todos') return true;
  if (m !== 'jugadores') return false;
  const chars = await api.list('characters').catch(() => []);
  return chars.some((c) => c.type === 'jugador' && c.name === who);
}

// Grupos de dados de una tirada, con la ventaja ya aplicada como hace el servidor. null si no se entiende.
const TERM = /([+-]?)(?:(\d*)d(\d+|%)(?:(kh|kl|k)(\d+))?|(\d+))/iy;
export function diceGroups(expr, mode = '') {
  const src = String(expr || '').toLowerCase().replace(/\s+/g, '');
  const out = [];
  let adv = false;
  for (let pos = 0; pos < src.length;) {
    TERM.lastIndex = pos;
    const m = TERM.exec(src);
    if (!m || TERM.lastIndex === pos) return null;
    pos = TERM.lastIndex;
    if (m[6] !== undefined) continue;
    let count = Number(m[2] || 1);
    const sides = m[3] === '%' ? 100 : Number(m[3]);
    let keep = (m[4] || '').toLowerCase();
    const isAdv = (mode === 'adv' || mode === 'dis') && !adv && sides === 20 && count === 1 && !keep;
    if (isAdv) { count = 2; keep = mode === 'adv' ? 'kh' : 'kl'; adv = true; }
    if (count > 200 || sides < 2) return null;
    out.push({ count, sides, keep: !!keep, adv: isAdv });
  }
  return out;
}

// Pide los valores de los dados físicos. Devuelve la lista para el servidor, o null si se cancela.
async function askPhysical(expr, groups, { label, mode, who }) {
  const inputs = [];
  const rows = groups.map((g) => {
    const each = g.keep || g.count <= 4;
    const fields = each
      ? Array.from({ length: g.count }, (_, i) => h('input', { type: 'number', class: 'pd-in', min: 1, max: g.sides, inputmode: 'numeric', 'aria-label': `d${g.sides} n.º ${i + 1}`, dataset: { min: 1, max: g.sides } }))
      : [h('input', { type: 'number', class: 'pd-in sum', min: g.count, max: g.count * g.sides, inputmode: 'numeric', placeholder: `${g.count}–${g.count * g.sides}`, 'aria-label': `Suma de ${g.count}d${g.sides}`, dataset: { min: g.count, max: g.count * g.sides } })];
    inputs.push(...fields);
    g.fields = fields;
    g.each = each;
    return h('div', { class: 'pd-row' }, dieIcon(g.sides, 30),
      h('span', { class: 'pd-lbl' }, h('b', {}, `${g.count}d${g.sides}`), g.adv ? ` · ${mode === 'adv' ? 'ventaja: tira 2 y vale el mayor' : 'desventaja: tira 2 y vale el menor'}` : g.keep ? ' · pon cada dado' : each ? '' : ' · la suma'),
      h('span', { class: 'pd-fields' }, fields));
  });
  const ok = (el) => el.value !== '' && Number.isInteger(Number(el.value)) && Number(el.value) >= Number(el.dataset.min) && Number(el.value) <= Number(el.dataset.max);
  const done = modal('Dados físicos', h('div', { class: 'stack-sm physical-dice' },
    h('p', { class: 'pd-what' }, h('b', {}, label || expr), who && who !== 'DM' && !label.startsWith(who) ? ` · ${who}` : '', h('span', { class: 'tiny muted' }, ` (${expr})`)),
    rows,
    h('p', { class: 'tiny muted' }, 'Tira tus dados y escribe lo que ha salido. La app suma los modificadores y avisa de los críticos.')),
  [{ label: 'Que tire la app', value: 'app', icon: 'dados' },
    { label: 'Apuntar', value: () => groups.map((g) => (g.each ? g.fields.map((f) => Number(f.value)) : { sum: Number(g.fields[0].value) })), class: 'primary', icon: 'check' }],
  { iconName: 'dados' });
  const back = [...document.querySelectorAll('.modal-back')].pop();
  const primary = back?.querySelector('.actions .primary');
  const check = () => { if (primary) primary.disabled = !inputs.every(ok); inputs.forEach((el) => el.classList.toggle('bad', el.value !== '' && !ok(el))); };
  inputs.forEach((el, i) => {
    el.addEventListener('input', check);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (inputs.every(ok)) primary.click(); else (inputs.find((x) => !ok(x)) || inputs[i + 1])?.focus();
    });
  });
  check();
  return done;
}

// Lanza una tirada. Devuelve el resultado cuando los dados se han parado (o al momento si quiet).
// virtual: siempre con los dados de la app (minijuegos), aunque la mesa use dados físicos.
export async function roll(expr, { label = '', mode = '', who = 'DM', secret = false, quiet = false, color = '', virtual = false } = {}) {
  let r;
  let given = null;
  const groups = !virtual && (await wantsPhysical(who)) ? diceGroups(expr, mode) : null;
  if (groups?.length) {
    given = await askPhysical(expr, groups, { label, mode, who });
    if (given == null) return null;
    if (given === 'app') given = null;
  }
  try {
    r = await api.post('/api/roll', { expr, label, mode, who, secret, ...(given ? { dice: given } : {}) });
  } catch (e) {
    toastError(e);
    return null;
  }
  if (r.physical) {
    if (!quiet && !localTray) showResult(r, stageCenter());
    if (!quiet) dramatic(r);
  } else if (!quiet) {
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
  if (r.crit && r.who) react(r.who, r.crit === 'critico' ? 'feliz' : 'triste'); // los avatares celebran o se lamentan
  listeners.forEach((fn) => fn(r));
  return r;
}
