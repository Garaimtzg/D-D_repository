// Herramientas del máster: campaña (copia .zip), generadores, encuentros, reloj, temporizadores,
// narración, monedas, reparto de botín, tablas aleatorias propias, viajes y dados para el móvil.
import { api } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, segmented, toast, toastError, confirmDialog, pickFiles, promptDialog } from '../core/dom.js';
import { CRS, newCharacter } from '../core/dnd.js';
import { sfx } from '../core/sfx.js';
import { roll } from '../core/dice.js';
import { calendarOf, worldDate, moonOf } from '../core/calendar.js';

export default { id: 'herramientas', title: 'Herramientas', icon: 'herramientas', hint: 'Generadores, reloj, temporizadores y copia de la campaña · tecla 8', mount };

const tile = (title, iconName, cls, ...content) => h('section', { class: `panel tool ${cls || ''}` },
  h('div', { class: 'panel-head' }, h('h3', {}, h('span', { class: 'tool-ic' }, icon(iconName, 18)), title)), ...content);

async function mount(root) {
  const settings = await api.settings();
  const timers = [];
  root.append(h('div', { class: 'tools-grid' },
    campaignTile(settings), generatorsTile(), clockTile(settings), timerTile(timers), narrationTile(settings),
    encounterTile(), tablesTile(settings), coinsTile(), lootTile(), travelTile(), mobileTile()));
  return () => timers.forEach(clearInterval);
}

// -------------------------------------------------------------------- campaña
function campaignTile(settings) {
  async function importBackup() {
    const [file] = await pickFiles('.zip,application/zip');
    if (!file) return;
    const ok = await confirmDialog(`Se sustituirá la campaña actual por «${file.name}». Antes se guarda una copia automática en data/backups.`, 'Cargar copia');
    if (!ok) return;
    try {
      const res = await fetch('/api/backup', { method: 'POST', body: file });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      toast('Campaña cargada. Recargando…', { kind: 'good' });
      setTimeout(() => location.reload(), 800);
    } catch (e) { toastError(e); }
  }
  return tile('Campaña', 'save', 'campaign',
    h('div', { class: 'campaign-name' }, h('span', { class: 'tiny muted' }, 'Nombre'), h('b', {}, settings.campaignName || 'Mi campaña')),
    h('p', { class: 'small muted' }, 'Todo se guarda solo en este ordenador (carpeta data). Descarga una copia en .zip con fichas, combates, notas, mapas y música para guardarla o pasársela a otro máster.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn primary', href: '/api/backup', download: '' }, icon('download', 16), 'Descargar copia (.zip)'),
      h('button', { class: 'btn', type: 'button', onclick: importBackup }, icon('upload', 16), 'Cargar copia')));
}

// ---------------------------------------------------------------- generadores
function generatorsTile() {
  const p = { race: '', tier: 1, climate: 'templado' };
  const out = h('div', { class: 'gen-out' });
  const kinds = [['pnj', 'PNJ', 'user'], ['nombre', 'Nombre', 'feather'], ['taberna', 'Taberna', 'tavern'], ['botin', 'Botín', 'gem'],
    ['gancho', 'Gancho', 'compass'], ['clima', 'Clima', 'cloud'], ['baratija', 'Baratija', 'sparkle']];

  async function gen(kind, iconName) {
    try {
      const r = await api.post(`/api/generate/${kind}`, p);
      sfx[kind === 'botin' ? 'coins' : kind === 'taberna' ? 'page' : 'magic']();
      const card = h('article', { class: 'gen-card' },
        h('div', { class: 'gen-ic' }, icon(iconName, 20)),
        h('div', { class: 'grow' }, h('b', {}, r.title), h('p', {}, r.text)),
        h('div', { class: 'gen-actions' },
          kind === 'pnj' && h('button', { class: 'btn xs', type: 'button', onclick: async (e) => {
            await api.create('characters', newCharacter('pnj', { name: r.title, race: r.race, cls: r.occupation, notes: r.text }));
            e.currentTarget.disabled = true;
            toast(`${r.title} guardado en Personajes.`, { kind: 'good', iconName: 'user' });
          } }, icon('plus', 12), 'Guardar PNJ'),
          h('button', { class: 'btn xs ghost', type: 'button', onclick: () => navigator.clipboard?.writeText(`${r.title}: ${r.text}`).then(() => toast('Copiado.', { iconName: 'copy' })) }, icon('copy', 12))));
      out.prepend(card);
      while (out.children.length > 8) out.lastChild.remove();
    } catch (e) { toastError(e); }
  }

  return tile('Generadores', 'sparkle', 'wide',
    h('div', { class: 'row' },
      field('Especie', selectEl([['', 'Al azar'], ['aasimar', 'Aasimar'], ['dracónido', 'Dracónido'], ['elfo', 'Elfo'], ['enano', 'Enano'], ['gnomo', 'Gnomo'],
        ['goliat', 'Goliat'], ['humano', 'Humano'], ['mediano', 'Mediano'], ['orco', 'Orco'], ['tiefling', 'Tiefling']], '', (v) => { p.race = v; })),
      field('Nivel del botín', selectEl([[1, '1–4'], [2, '5–10'], [3, '11–16'], [4, '17–20']], 1, (v) => { p.tier = Number(v); })),
      field('Clima', selectEl([['templado', 'Templado'], ['frio', 'Frío'], ['calido', 'Cálido']], 'templado', (v) => { p.climate = v; }))),
    h('div', { class: 'gen-buttons' }, kinds.map(([k, l, ic]) => h('button', { class: 'gen-btn', type: 'button', onclick: () => gen(k, ic) }, icon(ic, 22), l))),
    out);
}

// ----------------------------------------------------------------- encuentros
function encounterTile() {
  const s = { levels: '1, 1, 1, 1', crs: ['1/4', '1/4', '1/2'] };
  const result = h('div', { class: 'enc-result' });
  const list = h('div', { class: 'row' });
  async function calc() {
    const levels = s.levels.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 20);
    try {
      const r = await api.post('/api/encounter', { levels, crs: s.crs });
      const fmt = (n) => n.toLocaleString('es-ES');
      clear(result, h('div', { class: `big-diff d-${r.over_high ? 'mortal' : r.difficulty}` }, r.over_high ? 'Más que alto' : r.difficulty),
        h('div', { class: 'small' }, `${fmt(r.xp)} PX de monstruos · ${fmt(r.xp_per_player)} por jugador`),
        h('div', { class: 'tiny muted' }, `Presupuesto: bajo ${fmt(r.budget.bajo)} · moderado ${fmt(r.budget.moderado)} · alto ${fmt(r.budget.alto)} (2024, sin multiplicadores)`));
    } catch (e) { clear(result, e.message); }
  }
  const drawList = () => clear(list, s.crs.map((cr, i) => h('span', { class: 'chip enemigo' }, `VD ${cr}`,
    h('button', { type: 'button', 'aria-label': 'Quitar', onclick: () => { s.crs.splice(i, 1); drawList(); calc(); } }, '✕'))));
  const crSel = selectEl(CRS, '1', () => {}, { style: 'width:auto', 'aria-label': 'Valor de desafío' });
  drawList();
  calc();
  return tile('Calculadora de encuentros', 'combate', '',
    field('Niveles del grupo (separados por comas)', bind(s, 'levels', { onChange: calc })),
    h('div', { class: 'eyebrow' }, 'Monstruos'), list,
    h('div', { class: 'row' }, crSel, h('button', { class: 'btn sm', type: 'button', onclick: () => { s.crs.push(crSel.value); drawList(); calc(); } }, icon('plus', 14), 'Añadir monstruo')),
    result);
}

// ------------------------------------------------------------------------ reloj
function clockTile(settings) {
  const clock = settings.clock || { day: 1, minutes: 8 * 60 };
  const dial = h('div', { class: 'dial' });
  const label = h('div', { class: 'clock-label' });
  const period = (m) => { const hh = Math.floor(m / 60); return hh < 6 ? 'Madrugada' : hh < 12 ? 'Mañana' : hh < 14 ? 'Mediodía' : hh < 20 ? 'Tarde' : 'Noche'; };
  const draw = () => {
    const hh = Math.floor(clock.minutes / 60);
    const night = hh < 6 || hh >= 20;
    dial.style.setProperty('--angle', `${(clock.minutes / 1440) * 360}deg`);
    dial.classList.toggle('night', night);
    clear(dial, h('span', { class: 'dial-body' }, icon(night ? 'moon' : 'sun', 22)));
    const cal = calendarOf(settings);
    clear(label, h('b', { 'data-tip': `Día ${clock.day} de la campaña · ${moonOf(cal, clock.day).emoji} ${moonOf(cal, clock.day).name}` }, worldDate(cal, clock.day, { weekday: true })), h('span', { class: 'clock-time' }, `${String(hh).padStart(2, '0')}:${String(clock.minutes % 60).padStart(2, '0')}`),
      h('span', { class: 'muted small' }, period(clock.minutes)));
  };
  const advance = (mins) => {
    const total = clock.minutes + mins;
    clock.day += Math.floor(total / 1440);
    clock.minutes = ((total % 1440) + 1440) % 1440;
    if (clock.day < 1) { clock.day = 1; clock.minutes = 0; }
    sfx.click();
    draw();
    api.saveSettings({ clock }).catch(toastError);
  };
  draw();
  return tile('Reloj del mundo', 'clock', '',
    h('div', { class: 'row nowrap clock-row' }, dial, label),
    h('div', { class: 'row' },
      [['+1 min', 1], ['+10 min', 10], ['+1 h', 60], ['+8 h', 480], ['+1 día', 1440], ['−1 h', -60]].map(([l, m]) => h('button', { class: 'btn xs', type: 'button', onclick: () => advance(m) }, l)),
      h('button', { class: 'btn xs', type: 'button', onclick: () => advance(((6 * 60 - clock.minutes) + 1440) % 1440 || 1440) }, icon('sun', 12), 'Amanecer')),
    h('p', { class: 'tiny muted' }, 'La hora aparece sobre la mesa; de noche el tablero se oscurece.'));
}

// -------------------------------------------------------------- temporizadores
function timerTile(timers) {
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const turn = { len: 60, left: 60, run: false };
  const session = { secs: 0, run: false };
  const ring = h('div', { class: 'timer-ring' });
  const sessEl = h('b', { class: 'tnum' });
  const turnBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { turn.run = !turn.run; draw(); } });
  const sessBtn = h('button', { class: 'btn xs', type: 'button', onclick: () => { session.run = !session.run; draw(); } });
  const draw = () => {
    ring.style.setProperty('--p', turn.left / turn.len);
    ring.classList.toggle('low', turn.left <= 10);
    clear(ring, h('span', {}, fmt(turn.left)));
    sessEl.textContent = `${Math.floor(session.secs / 3600)}h ${fmt(session.secs % 3600)}`;
    clear(turnBtn, icon(turn.run ? 'pause' : 'play', 14), turn.run ? 'Pausa' : 'Empezar');
    clear(sessBtn, icon(session.run ? 'pause' : 'play', 12), session.run ? 'Pausa' : 'Empezar');
  };
  timers.push(setInterval(() => {
    if (turn.run && turn.left > 0) {
      turn.left -= 1;
      if (turn.left === 0) { turn.run = false; toast('¡Se acabó el tiempo del turno!', { iconName: 'hourglass' }); sfx.gong(); }
      else if (turn.run && turn.left <= 5) sfx.click();
    }
    if (session.run) session.secs += 1;
    draw();
  }, 1000));
  draw();
  return tile('Temporizadores', 'hourglass', '',
    h('div', { class: 'row nowrap' }, ring,
      h('div', { class: 'stack grow' },
        field('Duración del turno', selectEl([[30, '30 s'], [60, '1 min'], [90, '1:30'], [120, '2 min'], [300, '5 min']], 60, (v) => { turn.len = turn.left = Number(v); draw(); })),
        h('div', { class: 'row' }, turnBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => { turn.left = turn.len; turn.run = true; draw(); } }, icon('refresh', 14), 'Reiniciar')))),
    h('div', { class: 'row between session' }, h('span', { class: 'small' }, icon('clock', 14), ' Sesión: ', sessEl),
      h('div', { class: 'row nowrap' }, sessBtn, h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { session.secs = 0; draw(); } }, 'A cero'))));
}

// ------------------------------------------------------------------ narración
function narrationTile(settings) {
  const s = { text: settings.playerMessage || '' };
  const send = (text) => api.saveSettings({ playerMessage: text, playerImage: '' })
    .then(() => toast(text ? 'La narración aparece sobre la mesa.' : 'Narración retirada.', { iconName: 'feather' })).catch(toastError);
  const presets = ['Una niebla espesa cubre el camino…', 'Se oye un rugido en la oscuridad.', 'El suelo empieza a temblar.', 'Huele a azufre y a ceniza.'];
  return tile('Narración en la mesa', 'feather', '',
    bind(s, 'text', { type: 'textarea', rows: 3, placeholder: 'El viento trae el eco de unos tambores…' }),
    h('div', { class: 'row' }, presets.map((p) => h('button', { class: 'btn xs ghost', type: 'button', onclick: (e) => { s.text = p; e.currentTarget.closest('.tool').querySelector('textarea').value = p; } }, p.slice(0, 24) + '…'))),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm primary', type: 'button', onclick: () => send(s.text) }, icon('mesa', 14), 'Mostrar en la mesa'),
      h('button', { class: 'btn sm', type: 'button', onclick: (e) => { s.text = ''; e.currentTarget.closest('.tool').querySelector('textarea').value = ''; send(''); } }, 'Quitar')));
}

// -------------------------------------------------------- tablas aleatorias
function tablesTile(settings) {
  const tables = settings.randomTables || [{ name: 'Encuentros en el camino', items: 'Mercaderes perdidos\nLobos hambrientos\nUn puente roto\nBandidos disfrazados de peregrinos\nUn ciervo blanco que observa\nNada… por ahora' }];
  let idx = 0;
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => api.saveSettings({ randomTables: tables }).catch(toastError), 500); };
  const body = h('div', { class: 'stack' });
  const outcome = h('div', { class: 'table-outcome', hidden: true });
  const draw = () => {
    const t = tables[idx];
    clear(body,
      h('div', { class: 'row nowrap' },
        selectEl(tables.map((x, i) => [i, x.name]), idx, (v) => { idx = Number(v); draw(); }, { 'aria-label': 'Tabla' }),
        h('button', { class: 'btn icon sm', type: 'button', 'data-tip': 'Nueva tabla', onclick: async () => {
          const name = await promptDialog('Nueva tabla', 'Nombre', `Tabla ${tables.length + 1}`);
          if (!name) return;
          tables.push({ name, items: '' }); idx = tables.length - 1; persist(); draw();
        } }, icon('plus', 15)),
        tables.length > 1 && h('button', { class: 'btn icon sm ghost', type: 'button', 'data-tip': 'Borrar tabla', onclick: () => { tables.splice(idx, 1); idx = 0; persist(); draw(); } }, icon('trash', 15))),
      bind(t, 'items', { type: 'textarea', rows: 5, onChange: persist, placeholder: 'Una opción por línea', 'aria-label': 'Opciones, una por línea' }),
      h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
        const items = t.items.split('\n').map((x) => x.trim()).filter(Boolean);
        if (!items.length) return toast('La tabla está vacía.');
        const r = await roll(`1d${Math.max(2, items.length)}`, { label: t.name });
        if (!r) return;
        clear(outcome, h('span', { class: 'outcome-n' }, r.total), h('b', {}, items[(r.total - 1) % items.length]));
        outcome.hidden = false;
      } }, icon('dados', 15), 'Tirar en la tabla'),
      outcome);
  };
  draw();
  return tile('Tablas aleatorias', 'list', '', body);
}

// ---------------------------------------------------------------- monedas
function coinsTile() {
  const RATES = { pc: 1, pp: 10, pe: 50, po: 100, ppt: 1000 };
  const NAMES = { pc: 'cobre', pp: 'plata', pe: 'electro', po: 'oro', ppt: 'platino' };
  const COLORS = { pc: '#c27a45', pp: '#c9d1d9', pe: '#d8cf8c', po: '#f0c24a', ppt: '#e6eef5' };
  const s = { pc: 0, pp: 0, pe: 0, po: 0, ppt: 0 };
  const out = h('div', { class: 'small' });
  const calc = () => {
    const total = Object.entries(s).reduce((t, [k, v]) => t + (Number(v) || 0) * RATES[k], 0);
    let rest = total;
    const parts = [];
    for (const k of ['ppt', 'po', 'pp', 'pc']) { const n = Math.floor(rest / RATES[k]); if (n) parts.push(`${n} ${NAMES[k]}`); rest -= n * RATES[k]; }
    clear(out, h('div', { class: 'coin-total' }, `${(total / 100).toLocaleString('es-ES')} po`), h('div', { class: 'muted' }, parts.join(', ') || 'Nada'));
  };
  calc();
  return tile('Conversor de monedas', 'coins', '',
    h('div', { class: 'coins dark' }, Object.keys(RATES).map((k) => h('label', { class: 'coin' },
      h('span', { class: 'coin-face', style: { '--coin': COLORS[k] } }, k.toUpperCase()), bind(s, k, { type: 'number', min: 0, onChange: calc, 'aria-label': NAMES[k] })))),
    out, h('p', { class: 'tiny muted' }, '1 ppt = 10 po · 1 po = 2 pe = 10 pp · 1 pp = 10 pc (MdJ 2024)'));
}

function lootTile() {
  const s = { gold: 100, people: 4 };
  const out = h('div');
  const calc = () => {
    const n = Math.max(1, Number(s.people) || 1);
    const cp = Math.round((Number(s.gold) || 0) * 100);
    const each = Math.floor(cp / n);
    clear(out, h('div', { class: 'coin-total' }, `${(each / 100).toLocaleString('es-ES')} po`), h('div', { class: 'small muted' }, 'por cabeza', cp - each * n ? ` · sobran ${cp - each * n} pc para el fondo común` : ''));
  };
  calc();
  return tile('Repartir botín', 'gem', '',
    h('div', { class: 'row nowrap' }, field('Oro total', bind(s, 'gold', { type: 'number', min: 0, onChange: calc })), field('Personas', bind(s, 'people', { type: 'number', min: 1, onChange: calc }))), out);
}

function travelTile() {
  const PACES = { 45: ['Rápido', 6, 'desventaja en Percepción, Supervivencia y Sigilo'], 36: ['Normal', 4.5, 'desventaja en Sigilo'], 27: ['Lento', 3, 'ventaja en Percepción y Supervivencia'] };
  const s = { km: 36, pace: 36 };
  const out = h('div');
  const calc = () => {
    const [, kmh, effect] = PACES[s.pace];
    const hours = (Number(s.km) || 0) / kmh;
    const days = hours / 8;
    clear(out, h('div', { class: 'coin-total' }, `${days.toFixed(1).replace('.', ',')} días`),
      h('div', { class: 'small muted' }, `${Math.ceil(hours)} horas de marcha a ${String(kmh).replace('.', ',')} km/h · ${effect}`));
  };
  calc();
  return tile('Viajes', 'compass', '',
    h('div', { class: 'row nowrap' }, field('Kilómetros', bind(s, 'km', { type: 'number', min: 0, onChange: calc })),
      field('Ritmo', selectEl(Object.entries(PACES).map(([d, [l]]) => [d, `${l} · ${d} km`]), 36, (v) => { s.pace = Number(v); calc(); }))),
    out, h('p', { class: 'tiny muted' }, 'Ritmos de viaje del Manual del Jugador 2024: 8 horas de marcha al día.'));
}

// ---------------------------------------------------------- dados en el móvil
function mobileTile() {
  return tile('Dados en el móvil', 'dados', 'mobile',
    h('p', { class: 'small' }, 'Una página de dados que funciona sola en cualquier móvil, sin instalar nada y sin internet.'),
    h('ol', { class: 'small steps' }, h('li', {}, 'Descárgala con el botón.'), h('li', {}, 'Pásala al móvil (WhatsApp, correo, cable…).'), h('li', {}, 'Ábrela en el navegador del móvil.')),
    h('a', { class: 'btn primary', href: '/dados-movil.html', download: 'dados-movil.html' }, icon('download', 16), 'Descargar dados-movil.html'),
    h('a', { class: 'btn ghost sm', href: '/dados-movil.html', target: '_blank', rel: 'noopener' }, icon('eye', 14), 'Probarla aquí'));
}
