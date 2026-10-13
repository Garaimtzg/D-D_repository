// Dados: bandeja con dados acumulables, expresiones libres, favoritos e historial compartido.
import { api } from '../core/api.js';
import { h, clear, segmented, toast, toastError, fmtDate, promptDialog } from '../core/dom.js';
import { roll, onRoll, describe } from '../core/dice.js';

const ICON = '<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7"/><polygon points="12,7 16.5,15 7.5,15"/>';
const DICE = [4, 6, 8, 10, 12, 20, 100];
const FAV_KEY = 'dnd.dice.favorites';
const DEFAULT_FAVS = [
  { label: 'Estadísticas (4d6, descarta el menor)', expr: '4d6kh3' },
  { label: 'Bola de fuego', expr: '8d6' },
  { label: 'Proyectil mágico', expr: '3d4+3' },
  { label: 'Poción de curación', expr: '2d4+2' },
  { label: 'Ataque furtivo (nv 5)', expr: '3d6' },
];

const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || DEFAULT_FAVS; } catch { return DEFAULT_FAVS; } };
const saveFavs = (f) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch { /* sin almacenamiento */ } };

export default { id: 'dados', title: 'Dados', icon: ICON, mount };

async function mount(root) {
  const state = { pool: {}, mod: 0, mode: '', secret: false, who: 'DM', favs: loadFavs(), history: [] };
  const poolEl = h('div', { class: 'pool' });
  const exprInput = h('input', { placeholder: 'Ej.: 1d20+5, 2d6+1d4+3, 4d6kh3, d%', 'aria-label': 'Expresión de dados' });
  const histEl = h('ul', { class: 'roll-history' });
  const favEl = h('div', { class: 'row' });

  const poolExpr = () => {
    const parts = Object.entries(state.pool).filter(([, n]) => n > 0).map(([s, n]) => `${n}d${s}`);
    if (state.mod) parts.push(String(state.mod));
    return parts.join('+').replace(/\+-/g, '-');
  };
  const doRoll = (expr, label = '') => expr && roll(expr, { label, mode: state.mode, secret: state.secret, who: state.who });

  function renderPool() {
    const expr = poolExpr();
    clear(poolEl, expr ? h('span', { class: 'pool-expr' }, expr) : h('span', { class: 'muted' }, 'Pulsa dados para añadirlos a la bandeja'));
  }

  function renderFavs() {
    clear(favEl, state.favs.map((f, i) => h('span', { class: 'fav' },
      h('button', { class: 'btn sm', type: 'button', title: f.expr, onclick: () => doRoll(f.expr, f.label) }, f.label),
      h('button', { class: 'btn sm icon ghost', type: 'button', 'aria-label': `Quitar ${f.label}`, onclick: () => { state.favs.splice(i, 1); saveFavs(state.favs); renderFavs(); } }, '✕'))));
  }

  function renderHistory() {
    clear(histEl, state.history.length ? [...state.history].reverse().map((r) => h('li', {},
      h('div', { class: 'row between' },
        h('span', {}, h('b', {}, r.who && !r.label?.startsWith(r.who) ? `${r.who} · ` : ''), r.label || r.expr, r.secret ? h('span', { class: 'chip' }, 'secreta') : ''),
        h('span', { class: `total ${r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : ''}` }, r.total)),
      h('div', { class: 'small muted' }, `${describe(r)} · ${fmtDate(r.time)}`)))
      : h('li', { class: 'muted' }, 'Sin tiradas todavía.'));
  }

  async function loadHistory() {
    try { state.history = await api.get('/api/rolls'); renderHistory(); } catch (e) { toastError(e); }
  }

  exprInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRoll(exprInput.value.trim()); });

  root.append(h('div', { class: 'grid cols-2' },
    h('div', { class: 'stack' },
      h('div', { class: 'card' },
        h('h3', {}, 'Bandeja de dados'),
        h('div', { class: 'dice-buttons' }, DICE.map((s) => h('button', {
          class: 'die', type: 'button', title: 'Clic: añadir · Clic derecho: quitar',
          onclick: () => { state.pool[s] = (state.pool[s] || 0) + 1; renderPool(); },
          oncontextmenu: (e) => { e.preventDefault(); state.pool[s] = Math.max(0, (state.pool[s] || 0) - 1); renderPool(); },
        }, `d${s}`))),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('span', { class: 'small muted' }, 'Modificador'),
          h('button', { class: 'btn sm icon', type: 'button', onclick: () => { state.mod -= 1; renderPool(); } }, '−'),
          h('button', { class: 'btn sm icon', type: 'button', onclick: () => { state.mod += 1; renderPool(); } }, '+'),
          poolEl),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], '', (v) => { state.mode = v; }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { state.secret = e.target.checked; } }), 'Tirada secreta')),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', { class: 'btn primary', type: 'button', onclick: () => doRoll(poolExpr()) }, '🎲 Tirar bandeja'),
          h('button', { class: 'btn', type: 'button', onclick: () => { state.pool = {}; state.mod = 0; renderPool(); } }, 'Vaciar'),
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            const expr = poolExpr();
            if (!expr) return toast('La bandeja está vacía.');
            const label = await promptDialog('Guardar favorito', 'Nombre', expr);
            if (label) { state.favs.push({ label, expr }); saveFavs(state.favs); renderFavs(); }
          } }, '★ Guardar como favorito'))),
      h('div', { class: 'card' },
        h('h3', {}, 'Expresión libre'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, exprInput), h('button', { class: 'btn primary', type: 'button', onclick: () => doRoll(exprInput.value.trim()) }, 'Tirar')),
        h('p', { class: 'small muted' }, 'NdM suma dados · kh/kl se queda con los más altos/bajos (4d6kh3, 2d20kl1) · d% es un d100 · con «Ventaja» el primer d20 se tira doble.')),
      h('div', { class: 'card' }, h('h3', {}, 'Favoritos'), favEl),
      h('div', { class: 'card' },
        h('h3', {}, 'Generar características'),
        h('p', { class: 'small muted' }, 'Seis tiradas de 4d6 descartando el dado más bajo.'),
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          const results = [];
          for (let i = 0; i < 6; i++) { const r = await roll('4d6kh3', { label: `Característica ${i + 1}`, quiet: true }); if (r) results.push(r.total); }
          toast(h('div', {}, h('div', { class: 'small muted' }, 'Características'), h('div', { class: 'big' }, results.sort((a, b) => b - a).join(' · ')),
            h('div', { class: 'small muted' }, `Total ${results.reduce((a, b) => a + b, 0)}`)), { ms: 10000 });
        } }, 'Tirar 6 características'),
        h('p', { class: 'small muted' }, 'Compra de puntos alternativa: 15, 14, 13, 12, 10, 8.'))),
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, 'Historial compartido'),
        h('button', { class: 'btn sm danger', type: 'button', onclick: async () => { await api.del('/api/rolls').catch(toastError); loadHistory(); } }, 'Borrar historial')),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Las tiradas no secretas aparecen también en la pantalla de jugadores.'),
      histEl)));

  renderPool();
  renderFavs();
  await loadHistory();
  const off = onRoll((r) => { state.history.push(r); renderHistory(); });
  return off;
}
