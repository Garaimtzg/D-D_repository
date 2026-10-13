// Herramientas del máster: generadores, encuentros, reloj, temporizadores, monedas, tablas propias...
import { api } from '../core/api.js';
import { h, clear, bind, field, selectEl, toast, toastError, confirmDialog, pickFiles } from '../core/dom.js';
import { CRS, newCharacter } from '../core/dnd.js';
import { roll } from '../core/dice.js';

const ICON = '<path d="M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2z"/>';
const TABLES_KEY = 'dnd.tools.tables';

export default { id: 'herramientas', title: 'Herramientas', icon: ICON, mount };

async function mount(root) {
  const settings = await api.settings();
  const timers = [];
  root.append(h('div', { class: 'tools-grid' },
    backupCard(), generatorsCard(), encounterCard(), clockCard(settings), timerCard(timers), playerMessageCard(settings),
    coinsCard(), splitCard(), tablesCard(), travelCard()));
  return () => timers.forEach(clearInterval);
}

// -- Copia de seguridad de la campaña -----------------------------------------
function backupCard() {
  async function importBackup() {
    const [file] = await pickFiles('.zip,application/zip');
    if (!file) return;
    const ok = await confirmDialog(`Se sustituirá la campaña actual por «${file.name}». Antes se guarda una copia automática en data/backups.`, 'Cargar copia');
    if (!ok) return;
    try {
      const res = await fetch('/api/backup', { method: 'POST', body: file });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      toast('Campaña cargada. Recargando…');
      setTimeout(() => location.reload(), 800);
    } catch (e) { toastError(e); }
  }
  return h('div', { class: 'card' }, h('h3', {}, 'Campaña'),
    h('p', { class: 'small muted', style: { marginTop: 0 } },
      'Todo se guarda en este ordenador. Descarga una copia (.zip con fichas, combates, notas, mapas y música) para guardarla o pasársela a otro máster.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn sm primary', href: '/api/backup', download: '' }, '⬇ Descargar copia'),
      h('button', { class: 'btn sm', type: 'button', onclick: importBackup }, '⬆ Cargar copia')));
}

// -- Generadores --------------------------------------------------------------
function generatorsCard() {
  const p = { race: '', tier: 1, climate: 'templado' };
  const out = h('ul', { class: 'gen-out' });
  const kinds = [['pnj', 'PNJ'], ['nombre', 'Nombre'], ['taberna', 'Taberna'], ['botin', 'Botín'], ['gancho', 'Gancho'], ['clima', 'Clima'], ['baratija', 'Baratija']];

  async function gen(kind) {
    try {
      const r = await api.post(`/api/generate/${kind}`, p);
      out.prepend(h('li', {},
        h('div', { class: 'row between' }, h('b', {}, r.title),
          h('div', { class: 'row' },
            kind === 'pnj' && h('button', { class: 'btn sm', type: 'button', onclick: async (e) => {
              await api.create('characters', newCharacter('pnj', { name: r.title, race: r.race, cls: r.occupation, notes: r.text }));
              e.target.disabled = true;
              toast(`${r.title} guardado en Personajes.`);
            } }, 'Guardar como PNJ'),
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => navigator.clipboard?.writeText(`${r.title}: ${r.text}`).then(() => toast('Copiado.')) }, 'Copiar'))),
        h('div', { class: 'small' }, r.text)));
      while (out.children.length > 15) out.lastChild.remove();
    } catch (e) { toastError(e); }
  }

  return h('div', { class: 'card span-2' }, h('h3', {}, 'Generadores'),
    h('div', { class: 'row' },
      field('Raza', selectEl([['', 'Al azar'], 'humano', 'elfo', 'enano', 'mediano', 'orco', 'dracónido', 'tiefling', 'gnomo'], '', (v) => { p.race = v; })),
      field('Nivel del botín', selectEl([[1, '1–4'], [2, '5–10'], [3, '11–16'], [4, '17–20']], 1, (v) => { p.tier = Number(v); })),
      field('Clima', selectEl([['templado', 'Templado'], ['frio', 'Frío'], ['calido', 'Cálido']], 'templado', (v) => { p.climate = v; }))),
    h('div', { class: 'row', style: { marginTop: '8px' } }, kinds.map(([k, l]) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => gen(k) }, l))),
    out);
}

// -- Calculadora de encuentros -----------------------------------------------
function encounterCard() {
  const s = { levels: '1, 1, 1, 1', crs: ['1/4', '1/4', '1/2'] };
  const result = h('div', { class: 'small' });
  const list = h('div', { class: 'row' });

  async function calc() {
    const levels = s.levels.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 20);
    try {
      const r = await api.post('/api/encounter', { levels, crs: s.crs });
      clear(result, h('div', { class: 'big-diff' }, r.difficulty),
        h('div', {}, `PX ajustados: ${r.adjusted_xp} (×${r.multiplier}) · PX reales: ${r.base_xp} · ${r.xp_per_player} por jugador`),
        h('div', { class: 'muted' }, `Umbrales del grupo — fácil ${r.thresholds['fácil']}, media ${r.thresholds.media}, difícil ${r.thresholds['difícil']}, mortal ${r.thresholds.mortal}`));
    } catch (e) { clear(result, e.message); }
  }

  function drawList() {
    clear(list, s.crs.map((cr, i) => h('span', { class: 'chip' }, `VD ${cr}`,
      h('button', { type: 'button', 'aria-label': 'Quitar', onclick: () => { s.crs.splice(i, 1); drawList(); calc(); } }, '✕'))));
  }
  const crSel = selectEl(CRS, '1', () => {}, { style: 'width:auto' });
  drawList();
  calc();
  return h('div', { class: 'card' }, h('h3', {}, 'Calculadora de encuentros'),
    field('Niveles del grupo (separados por comas)', bind(s, 'levels', { onChange: calc })),
    h('div', { class: 'eyebrow' }, 'Monstruos'), list,
    h('div', { class: 'row', style: { marginTop: '6px' } }, crSel,
      h('button', { class: 'btn sm', type: 'button', onclick: () => { s.crs.push(crSel.value); drawList(); calc(); } }, '+ Añadir monstruo')),
    h('div', { style: { marginTop: '10px' } }, result));
}

// -- Reloj del mundo ----------------------------------------------------------
function clockCard(settings) {
  const clock = settings.clock || { day: 1, minutes: 8 * 60 };
  const show = h('div', { class: 'clock' });
  const period = (m) => { const hh = Math.floor(m / 60); return hh < 6 ? 'Madrugada' : hh < 12 ? 'Mañana' : hh < 14 ? 'Mediodía' : hh < 20 ? 'Tarde' : 'Noche'; };
  const draw = () => {
    const hh = String(Math.floor(clock.minutes / 60)).padStart(2, '0');
    const mm = String(clock.minutes % 60).padStart(2, '0');
    clear(show, h('b', {}, `Día ${clock.day} · ${hh}:${mm}`), h('span', { class: 'muted' }, ` ${period(clock.minutes)}`));
  };
  const advance = (mins) => {
    const total = clock.minutes + mins;
    clock.day += Math.floor(total / 1440);
    clock.minutes = ((total % 1440) + 1440) % 1440;
    if (clock.day < 1) { clock.day = 1; clock.minutes = 0; }
    draw();
    api.saveSettings({ clock }).catch(toastError);
  };
  draw();
  return h('div', { class: 'card' }, h('h3', {}, 'Reloj del mundo'), show,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      [['+1 asalto', 0.1], ['+10 min', 10], ['+1 h', 60], ['+8 h', 480], ['+1 día', 1440], ['−1 h', -60]].map(([l, m]) =>
        h('button', { class: 'btn sm', type: 'button', onclick: () => advance(Math.round(m) || 1) }, l)),
      h('button', { class: 'btn sm', type: 'button', onclick: () => {
        const toDawn = ((6 * 60 - clock.minutes) + 1440) % 1440 || 1440;
        advance(toDawn);
      } }, 'Al amanecer')),
    h('p', { class: 'small muted' }, 'La hora se muestra en la pantalla de jugadores. 1 asalto = 6 segundos (se redondea a 1 minuto).'));
}

// -- Temporizadores -----------------------------------------------------------
function timerCard(timers) {
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const turn = { len: 60, left: 60, run: false };
  const session = { secs: 0, run: false };
  const turnEl = h('span', { class: 'timer' }, fmt(turn.left));
  const sessEl = h('b', { class: 'tnum' }, fmt(0));
  const turnBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { turn.run = !turn.run; draw(); } });
  const sessBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { session.run = !session.run; draw(); } });
  const draw = () => {
    turnEl.textContent = fmt(turn.left);
    turnEl.classList.toggle('low', turn.left <= 10);
    sessEl.textContent = `${Math.floor(session.secs / 3600)}h ${fmt(session.secs % 3600)}`;
    turnBtn.textContent = turn.run ? 'Pausa' : 'Empezar';
    sessBtn.textContent = session.run ? 'Pausa' : 'Empezar';
  };
  timers.push(setInterval(() => {
    if (turn.run && turn.left > 0) {
      turn.left -= 1;
      if (turn.left === 0) { turn.run = false; toast('⏰ ¡Se acabó el tiempo del turno!'); beep(); }
    }
    if (session.run) session.secs += 1;
    draw();
  }, 1000));
  draw();
  return h('div', { class: 'card' }, h('h3', {}, 'Temporizadores'),
    h('div', { class: 'row between' }, turnEl,
      field('Duración del turno', selectEl([[30, '30 s'], [60, '1 min'], [90, '1:30'], [120, '2 min'], [300, '5 min']], 60, (v) => { turn.len = turn.left = Number(v); draw(); }))),
    h('div', { class: 'row' }, turnBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => { turn.left = turn.len; turn.run = true; draw(); } }, 'Reiniciar')),
    h('div', { class: 'row between', style: { marginTop: '12px' } }, h('span', {}, 'Duración de la sesión: ', sessEl),
      h('div', { class: 'row' }, sessBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => { session.secs = 0; draw(); } }, 'A cero'))));
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.8);
  } catch { /* sin audio */ }
}

// -- Mensaje para la pantalla de jugadores -----------------------------------
function playerMessageCard(settings) {
  const s = { text: settings.playerMessage || '' };
  const send = (text) => api.saveSettings({ playerMessage: text }).then(() => toast(text ? 'Mensaje enviado a la pantalla de jugadores.' : 'Mensaje retirado.')).catch(toastError);
  return h('div', { class: 'card' }, h('h3', {}, 'Mensaje a los jugadores'),
    field('Texto que aparece en la pantalla de jugadores', bind(s, 'text', { type: 'textarea', rows: 3, placeholder: 'Una niebla espesa cubre el camino…' })),
    h('div', { class: 'row', style: { marginTop: '6px' } },
      h('button', { class: 'btn sm primary', type: 'button', onclick: () => send(s.text) }, 'Mostrar'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { s.text = ''; send(''); } }, 'Quitar')));
}

// -- Conversor de monedas -----------------------------------------------------
function coinsCard() {
  const RATES = { pc: 1, pa: 10, pe: 50, po: 100, pp: 1000 };
  const NAMES = { pc: 'cobre', pa: 'plata', pe: 'electro', po: 'oro', pp: 'platino' };
  const s = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  const out = h('div', { class: 'small' });
  const calc = () => {
    const total = Object.entries(s).reduce((t, [k, v]) => t + (Number(v) || 0) * RATES[k], 0);
    clear(out, h('div', {}, h('b', {}, `${(total / 100).toLocaleString('es-ES')} po`), ` en total (${total.toLocaleString('es-ES')} pc)`),
      h('div', { class: 'muted' }, 'Sin electro: ', ['pp', 'po', 'pa', 'pc'].reduce((acc, k) => {
        const n = Math.floor(acc.rest / RATES[k]);
        if (n) acc.parts.push(`${n} ${NAMES[k]}`);
        acc.rest -= n * RATES[k];
        return acc;
      }, { rest: total, parts: [] }).parts.join(', ') || '0'));
  };
  calc();
  return h('div', { class: 'card' }, h('h3', {}, 'Conversor de monedas'),
    h('div', { class: 'coins' }, Object.keys(RATES).map((k) => field(k.toUpperCase(), bind(s, k, { type: 'number', min: 0, onChange: calc })))),
    h('div', { style: { marginTop: '8px' } }, out),
    h('p', { class: 'small muted' }, '1 pp = 10 po · 1 po = 2 pe = 10 pa · 1 pa = 10 pc'));
}

// -- Reparto de botín ---------------------------------------------------------
function splitCard() {
  const s = { gold: 100, people: 4 };
  const out = h('div');
  const calc = () => {
    const n = Math.max(1, Number(s.people) || 1);
    const cp = Math.round((Number(s.gold) || 0) * 100);
    const each = Math.floor(cp / n);
    clear(out, h('b', {}, `${(each / 100).toLocaleString('es-ES')} po por cabeza`), h('span', { class: 'muted' }, cp - each * n ? ` · sobran ${cp - each * n} pc para el fondo común` : ''));
  };
  calc();
  return h('div', { class: 'card' }, h('h3', {}, 'Repartir botín'),
    h('div', { class: 'row' }, field('Oro total', bind(s, 'gold', { type: 'number', min: 0, onChange: calc })), field('Personas', bind(s, 'people', { type: 'number', min: 1, onChange: calc }))),
    h('div', { style: { marginTop: '8px' } }, out));
}

// -- Tablas aleatorias propias -----------------------------------------------
function tablesCard() {
  let tables;
  try { tables = JSON.parse(localStorage.getItem(TABLES_KEY)) || null; } catch { tables = null; }
  tables ??= [{ name: 'Encuentros en el camino', items: 'Mercaderes perdidos\nLobos hambrientos\nUn puente roto\nBandidos disfrazados de peregrinos\nUn ciervo blanco que observa\nNada… por ahora' }];
  let idx = 0;
  const persist = () => { try { localStorage.setItem(TABLES_KEY, JSON.stringify(tables)); } catch { /* sin almacenamiento */ } };
  const body = h('div', { class: 'stack' });
  const draw = () => {
    const t = tables[idx];
    clear(body,
      h('div', { class: 'row' },
        selectEl(tables.map((x, i) => [i, x.name]), idx, (v) => { idx = Number(v); draw(); }, { style: 'flex:1' }),
        h('button', { class: 'btn sm', type: 'button', onclick: () => { tables.push({ name: `Tabla ${tables.length + 1}`, items: '' }); idx = tables.length - 1; persist(); draw(); } }, '+ Nueva'),
        tables.length > 1 && h('button', { class: 'btn sm danger', type: 'button', onclick: () => { tables.splice(idx, 1); idx = 0; persist(); draw(); } }, 'Borrar')),
      field('Nombre', bind(t, 'name', { onChange: persist })),
      field('Una opción por línea', bind(t, 'items', { type: 'textarea', rows: 5, onChange: persist })),
      h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
        const items = t.items.split('\n').map((x) => x.trim()).filter(Boolean);
        if (!items.length) return toast('La tabla está vacía.');
        const r = await roll(`1d${Math.max(2, items.length)}`, { label: t.name, quiet: true });
        if (r) toast(h('div', {}, h('div', { class: 'small muted' }, `${t.name} (${r.total})`), h('b', {}, items[(r.total - 1) % items.length])), { ms: 7000 });
      } }, 'Tirar en la tabla'));
  };
  draw();
  return h('div', { class: 'card' }, h('h3', {}, 'Tablas aleatorias propias'), body);
}

// -- Viajes -------------------------------------------------------------------
function travelCard() {
  const s = { miles: 24, pace: 24 };
  const out = h('div');
  const calc = () => {
    const days = (Number(s.miles) || 0) / Number(s.pace);
    clear(out, h('b', {}, `${days.toFixed(1)} días`), h('span', { class: 'muted' }, ` (${Math.ceil(days * 8)} horas de marcha)`));
  };
  calc();
  return h('div', { class: 'card' }, h('h3', {}, 'Calculadora de viaje'),
    h('div', { class: 'row' }, field('Distancia (millas)', bind(s, 'miles', { type: 'number', min: 0, onChange: calc })),
      field('Ritmo', selectEl([[30, 'Rápido (30/día)'], [24, 'Normal (24/día)'], [18, 'Lento (18/día)']], 24, (v) => { s.pace = Number(v); calc(); }))),
    h('div', { style: { marginTop: '8px' } }, out),
    h('p', { class: 'small muted' }, 'Rápido: −5 a Percepción pasiva. Lento: se puede avanzar con sigilo. A caballo o en carro, igual pero con más carga.'));
}
