// Dados: una bandeja de fieltro donde ruedan los dados, constructor de tiradas, favoritos,
// generador de características, historial y la estadística de la suerte con el d20.
import { api } from '../core/api.js';
import { h, clear, icon, dieIcon, segmented, selectEl, toast, toastError, fmtTime, promptDialog, prefs } from '../core/dom.js';
import { roll, onRoll, describe, setLocalTray } from '../core/dice.js';
import { TYPE_LABEL } from '../core/dnd.js';

export default { id: 'dados', title: 'Dados', icon: 'dados', hint: 'Bandeja de dados e historial · tecla 6', mount };

const DICE = [4, 6, 8, 10, 12, 20, 100];
const DEFAULT_FAVS = [
  { label: 'Bola de fuego', expr: '8d6' },
  { label: 'Proyectil mágico', expr: '3d4+3' },
  { label: 'Poción de curación', expr: '2d4+2' },
  { label: 'Ataque furtivo', expr: '3d6' },
  { label: 'Percepción con ventaja', expr: '2d20kh1' },
];

async function mount(root) {
  const [history, chars, settings] = await Promise.all([api.get('/api/rolls'), api.list('characters'), api.settings()]);
  const state = {
    pool: {}, mod: 0, mode: '', secret: false, history, chars,
    who: prefs.get('dice.who', ''), favs: settings.diceFavorites || DEFAULT_FAVS, last: null,
  };
  const Dice3D = window.Dice3D;

  // ------------------------------------------------------------------ bandeja
  const canvas = h('canvas', { class: 'tray-canvas', 'aria-label': 'Bandeja de dados' });
  const trayHint = h('div', { class: 'tray-hint' }, icon('dados', 40), h('b', {}, 'Elige dados y tira'), h('span', {}, 'o pulsa un dado de arriba para tirarlo al momento'));
  const resultEl = h('div', { class: 'tray-result', hidden: true });
  const tray = Dice3D.createTray(canvas, {});
  setLocalTray(tray);

  const poolEl = h('div', { class: 'pool-expr' });
  const builder = h('div', { class: 'builder' });
  const histEl = h('ul', { class: 'roll-history' });
  const statsEl = h('div', { class: 'luck' });
  const favEl = h('div', { class: 'favs' });

  const roller = () => state.chars.find((c) => c.id === state.who) || null;
  const who = () => roller()?.name || 'Máster';
  const poolExpr = () => {
    const parts = DICE.filter((s) => state.pool[s] > 0).map((s) => `${state.pool[s]}d${s}`);
    if (state.mod) parts.push(String(state.mod));
    return parts.join('+').replace(/\+-/g, '-');
  };
  async function doRoll(expr, label = '') {
    if (!expr) return toast('Añade algún dado a la bandeja.');
    trayHint.hidden = true;
    resultEl.hidden = true;
    canvas.closest('.tray').classList.add('rolling');
    const r = await roll(expr, { label: label ? `${who()}: ${label}` : `${who()}: ${expr}`, mode: state.mode, secret: state.secret, who: who(), color: roller()?.color || '' });
    canvas.closest('.tray')?.classList.remove('rolling');
    return r;
  }

  function renderBuilder() {
    clear(builder, DICE.map((s) => h('button', {
      class: `die-btn big d${s}`, type: 'button', 'aria-label': `Añadir 1d${s}`,
      'data-tip': 'Clic: añadir · Clic derecho: quitar · Doble clic: tirar solo este dado', 'data-tip-pos': 'below',
      onclick: () => { state.pool[s] = (state.pool[s] || 0) + 1; renderBuilder(); },
      ondblclick: () => { state.pool[s] = Math.max(0, (state.pool[s] || 0) - 2); renderBuilder(); doRoll(`1d${s}`); },
      oncontextmenu: (e) => { e.preventDefault(); state.pool[s] = Math.max(0, (state.pool[s] || 0) - 1); renderBuilder(); },
    }, dieIcon(s, 34), h('span', {}, `d${s}`), state.pool[s] > 0 && h('i', { class: 'badge' }, state.pool[s]))));
    const expr = poolExpr();
    clear(poolEl, expr ? h('b', {}, expr) : h('span', { class: 'muted' }, 'Bandeja vacía'));
  }

  function showResult(r) {
    state.last = r;
    const cls = r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : '';
    resultEl.className = `tray-result ${cls}`;
    clear(resultEl,
      h('div', { class: 'lbl' }, r.label || r.expr, r.mode === 'adv' ? ' · ventaja' : r.mode === 'dis' ? ' · desventaja' : ''),
      h('div', { class: 'total' }, r.total),
      h('div', { class: 'detail' }, describe(r)),
      cls && h('div', { class: 'tag' }, cls === 'crit' ? '¡CRÍTICO!' : '¡PIFIA!'));
    resultEl.hidden = false;
  }

  // ---------------------------------------------------------------- favoritos
  const saveFavs = () => api.saveSettings({ diceFavorites: state.favs }).catch(toastError);
  function renderFavs() {
    clear(favEl, state.favs.map((f, i) => h('span', { class: 'fav' },
      h('button', { class: 'btn sm', type: 'button', 'data-tip': f.expr, onclick: () => doRoll(f.expr, f.label) }, icon('star', 14), f.label),
      h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${f.label}`, onclick: () => { state.favs.splice(i, 1); saveFavs(); renderFavs(); } }, icon('close', 12)))),
    h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
      const expr = poolExpr() || exprInput.value.trim();
      if (!expr) return toast('Prepara una tirada en la bandeja o escríbela primero.');
      const label = await promptDialog('Guardar favorito', `Nombre para «${expr}»`, expr);
      if (label) { state.favs.push({ label, expr }); saveFavs(); renderFavs(); }
    } }, icon('plus', 14), 'Guardar la tirada actual'));
  }

  // ----------------------------------------------------------- características
  async function abilityScores() {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const r = await roll('4d6kh3', { label: `${who()}: característica ${i + 1}`, quiet: true, who: who() });
      if (r) results.push(r);
    }
    if (results.length < 6) return;
    trayHint.hidden = true;
    resultEl.hidden = true;
    const combined = { parts: results.map((r) => r.parts[0]) };
    await tray.roll(Dice3D.diceFromResult(combined, roller()?.color ? { color: roller().color } : {}));
    const totals = results.map((r) => r.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const mod = (v) => Math.floor((v - 10) / 2);
    resultEl.className = 'tray-result scores';
    clear(resultEl, h('div', { class: 'lbl' }, 'Características (4d6, descartando el más bajo)'),
      h('div', { class: 'score-row' }, totals.map((t) => h('span', { class: `score ${t >= 16 ? 'high' : t <= 7 ? 'low' : ''}` }, h('b', {}, t), h('small', {}, mod(t) >= 0 ? `+${mod(t)}` : mod(t))))),
      h('div', { class: 'detail' }, `Total ${sum} · modificadores ${totals.reduce((a, t) => a + mod(t), 0) >= 0 ? '+' : ''}${totals.reduce((a, t) => a + mod(t), 0)}`));
    resultEl.hidden = false; // las tiradas ya entraron en el historial al hacerse
  }

  // ------------------------------------------------------- historial y suerte
  function renderHistory() {
    const list = [...state.history].reverse().slice(0, 60);
    clear(histEl, list.length ? list.map((r) => {
      const ch = state.chars.find((c) => c.name === r.who);
      return h('li', { class: r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : '' },
        h('span', { class: 'h-who', style: { '--c': ch?.color || 'var(--gold)' } }, (r.who || '?').slice(0, 1)),
        h('div', { class: 'grow' },
          h('div', { class: 'h-lbl' }, r.label || r.expr, r.secret ? h('span', { class: 'chip' }, '🔒 secreta') : '', r.mode ? h('span', { class: 'chip' }, r.mode === 'adv' ? 'ventaja' : 'desventaja') : ''),
          h('div', { class: 'tiny muted' }, `${describe(r)} · ${fmtTime(r.time)}`)),
        h('b', { class: 'h-total' }, r.total),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': 'Repetir esta tirada', onclick: () => doRoll(r.expr, (r.label || '').replace(/^[^:]+:\s*/, '')) }, icon('refresh', 14)));
    }) : h('li', { class: 'muted' }, 'Sin tiradas todavía.'));
    renderStats();
  }

  function renderStats() {
    const nats = state.history.filter((r) => r.natural).map((r) => r.natural);
    const counts = Array.from({ length: 20 }, (_, i) => nats.filter((n) => n === i + 1).length);
    const max = Math.max(1, ...counts);
    const avg = nats.length ? (nats.reduce((a, b) => a + b, 0) / nats.length) : 0;
    const verdict = !nats.length ? 'Sin datos' : avg >= 12 ? 'Los dados te sonríen' : avg >= 9.5 ? 'Suerte normal' : 'Dados malditos';
    clear(statsEl,
      h('div', { class: 'row between' },
        h('div', {}, h('div', { class: 'luck-avg' }, nats.length ? avg.toFixed(1).replace('.', ',') : '—'), h('div', { class: 'tiny muted' }, `media de ${nats.length} d20 naturales`)),
        h('div', { class: 'luck-verdict' }, verdict),
        h('div', { class: 'row nowrap luck-counts' },
          h('span', { class: 'chip good' }, `20 × ${counts[19]}`), h('span', { class: 'chip bad' }, `1 × ${counts[0]}`))),
      h('div', { class: 'histo', role: 'img', 'aria-label': 'Distribución de los d20 naturales' }, counts.map((n, i) => h('div', {
        class: `bar ${i === 0 ? 'one' : i === 19 ? 'twenty' : ''}`, 'data-tip': `${i + 1}: ${n} ${n === 1 ? 'vez' : 'veces'}`,
      }, h('i', { style: { height: `${(n / max) * 100}%` } }), h('span', {}, i + 1)))));
  }

  // ----------------------------------------------------------------- estructura
  const exprInput = h('input', { placeholder: '1d20+5 · 2d6+1d4+3 · 4d6kh3 · d%', 'aria-label': 'Expresión de dados' });
  exprInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRoll(exprInput.value.trim()); });
  const modTxt = h('b', { class: 'mod-val' }, '+0');
  const setMod = (d) => { state.mod += d; modTxt.textContent = state.mod >= 0 ? `+${state.mod}` : String(state.mod); renderBuilder(); };
  const whoOptions = [['', '🎲 Máster'], ...state.chars.map((c) => [c.id, `${c.name} · ${TYPE_LABEL[c.type].split(' ')[0]}`])];

  root.append(h('div', { class: 'dice-layout' },
    h('section', { class: 'dice-main' },
      h('div', { class: 'panel builder-panel' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('dados'), 'Prepara la tirada'),
          h('div', { class: 'actions' }, h('span', { class: 'tiny muted' }, 'Tira'),
            selectEl(whoOptions, state.who, (v) => { state.who = v; prefs.set('dice.who', v); }, { class: 'who-select', 'aria-label': 'Quién tira' }))),
        builder,
        h('div', { class: 'row builder-opts' },
          h('div', { class: 'row nowrap mod', 'data-tip': 'Modificador' }, h('span', { class: 'tiny muted' }, 'Mod.'),
            h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Restar 1', onclick: () => setMod(-1) }, icon('minus', 14)), modTxt,
            h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Sumar 1', onclick: () => setMod(1) }, icon('plus', 14))),
          segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.mode, (v) => { state.mode = v; }),
          h('label', { class: 'check', 'data-tip': 'No sale en la mesa ni en el modo jugadores' }, h('input', { type: 'checkbox', onchange: (e) => { state.secret = e.target.checked; } }), '🔒 Secreta'),
          h('div', { class: 'grow' }),
          poolEl,
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.pool = {}; state.mod = 0; modTxt.textContent = '+0'; renderBuilder(); } }, icon('trash', 15), 'Vaciar'),
          h('button', { class: 'btn primary lg', type: 'button', onclick: () => doRoll(poolExpr()) }, icon('dados', 20), '¡Tirar!'))),
      h('div', { class: 'tray' }, canvas, trayHint, resultEl),
      h('div', { class: 'grid cols-2' },
        h('div', { class: 'panel' },
          h('div', { class: 'panel-head' }, h('h3', {}, icon('edit'), 'Tirada libre')),
          h('div', { class: 'row nowrap' }, h('div', { class: 'grow' }, exprInput), h('button', { class: 'btn primary', type: 'button', onclick: () => doRoll(exprInput.value.trim()) }, 'Tirar')),
          h('p', { class: 'tiny muted' }, h('b', {}, 'NdM'), ' suma dados · ', h('b', {}, 'kh/kl'), ' se queda con los más altos o bajos (4d6kh3) · ', h('b', {}, 'd%'), ' es un d100'),
          h('div', { class: 'eyebrow' }, 'Favoritos'), favEl),
        h('div', { class: 'panel' },
          h('div', { class: 'panel-head' }, h('h3', {}, icon('sparkle'), 'Crear personaje')),
          h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Seis tiradas de 4d6 quedándote con los tres más altos, todas a la vez en la bandeja.'),
          h('button', { class: 'btn', type: 'button', onclick: abilityScores }, icon('dados', 16), 'Tirar características'),
          h('p', { class: 'tiny muted' }, 'Alternativa de compra de puntos: 15, 14, 13, 12, 10 y 8.')))),
    h('aside', { class: 'dice-side' },
      h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('target'), 'La suerte del d20')), statsEl),
      h('div', { class: 'panel history-panel' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('scroll'), 'Historial'),
          h('div', { class: 'actions' }, h('button', { class: 'btn xs ghost', type: 'button', onclick: async () => {
            await api.del('/api/rolls').catch(toastError);
            state.history = [];
            renderHistory();
          } }, icon('trash', 13), 'Borrar'))),
        histEl))));

  renderBuilder();
  renderFavs();
  renderHistory();
  const off = onRoll((r) => { state.history.push(r); showResult(r); renderHistory(); });
  return () => { off(); setLocalTray(null); tray.destroy(); };
}
