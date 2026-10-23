// «La noche es de Gaueko»: tirada de la noche con criaturas de la mitología vasca. La luna, la hora,
// las fiestas del calendario y el clima de la mesa cambian lo que puede salir; el servidor decide el
// encuentro y lo ajusta al grupo (server/gaueko.py). Se abre desde el reloj de la Mesa y de Herramientas.
import { api } from '../core/api.js';
import { h, clear, icon, field, selectEl, segmented, modal, toast, toastError, prefs } from '../core/dom.js';
import { calendarOf, dateOf, moonOf, worldDate, eventsOn } from '../core/calendar.js';
import { reference, monsters, fromMonster, combatantFrom, fmtMod } from '../core/dnd.js';
import { newCombat } from '../core/combat.js';
import { loadScenes, findScene, autoPlace } from '../core/board.js';
import { roll } from '../core/dice.js';
import { sfx } from '../core/sfx.js';

export const isNight = (minutes) => { const hh = Math.floor((minutes || 0) / 60); return hh < 6 || hh >= 20; };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const BANDS = { calma: ['🌙', 'Noche tranquila'], presagio: ['🦉', 'Presagio'], encuentro: ['👣', 'Encuentro'], peligro: ['⚠️', 'Peligro'], gaueko: ['🌑', 'Gaueko'], amistoso: ['🎁', 'Visita amistosa'] };

// Fiesta especial de la fecha, según los festivos del calendario del mundo.
function festivalOf(cal, day) {
  const d = dateOf(cal, day);
  const titles = eventsOn(cal, d.year, d.month, d.day).map((e) => e.title).join(' ');
  return /san ?juan/i.test(titles) ? 'sanjuan' : /olentzero/i.test(titles) ? 'olentzero' : /noche más larga|difuntos|arimen/i.test(titles) ? 'larga' : '';
}

// Aviso cuando el reloj pasa del día a la noche.
export function announceNight(before, after) {
  if (isNight(before) || !isNight(after)) return;
  sfx.magic();
  toast(h('span', {}, h('b', {}, 'Gaua gauekoentzat. '), 'Ha caído la noche: la noche es para los de la noche. ',
    h('button', { class: 'btn xs', type: 'button', onclick: nightDialog }, '🌑 Tirar la noche')), { iconName: 'moon', ms: 9000 });
}

export async function nightDialog() {
  const [settings, ref, chars] = await Promise.all([api.settings(), reference(), api.list('characters')]);
  const cal = calendarOf(settings);
  const clock = settings.clock || { day: 1, minutes: 22 * 60 };
  const moon = moonOf(cal, clock.day);
  const players = chars.filter((c) => c.type === 'jugador');
  const ctx = {
    terrain: prefs.get('night.terrain', 'bosque'), situation: prefs.get('night.situation', 'acampada'),
    moon: moon.name === 'Luna llena' ? 'llena' : moon.name === 'Luna nueva' ? 'nueva' : '',
    late: Math.floor(clock.minutes / 60) < 5, storm: settings.tableWeather === 'tormenta', festival: festivalOf(cal, clock.day),
    eguzkilore: false, challenged: false,
  };
  const FEST = { sanjuan: '🔥 Noche de San Juan', olentzero: '🎁 Noche de Olentzero', larga: '🕯️ La noche más larga' };
  const modsEl = h('ul', { class: 'night-mods' });
  const rollBtn = h('button', { class: 'btn primary lg', type: 'button', onclick: doRoll }, '🎲 Tirar la noche');
  const out = h('div', { class: 'night-out' });
  let bonus = 0;

  async function refresh() {
    prefs.set('night.terrain', ctx.terrain);
    prefs.set('night.situation', ctx.situation);
    try {
      const r = await api.post('/api/night', { ctx });
      bonus = r.bonus;
      clear(modsEl, r.mods.map(([why, v]) => h('li', { class: v > 0 ? 'up' : 'down' }, h('b', {}, fmtMod(v)), ' ', why)),
        ctx.challenged && h('li', { class: 'up' }, h('b', {}, '😈'), ' Han desafiado a la noche: venga lo que venga, aparece Gaueko'),
        !r.mods.length && !ctx.challenged && h('li', { class: 'muted' }, 'Sin modificadores.'));
      clear(rollBtn, `🎲 Tirar la noche (1d20${bonus ? fmtMod(bonus) : ''})`);
    } catch (e) { toastError(e); }
  }

  async function doRoll() {
    const r = await roll(`1d20${bonus ? fmtMod(bonus) : ''}`, { label: 'La noche de Gaueko', who: 'DM' });
    if (!r) return;
    try {
      const { result } = await api.post('/api/night', { ctx, total: r.total, levels: players.map((c) => c.level || 1) });
      show(result, r.total);
    } catch (e) { toastError(e); }
  }

  function show(res, total) {
    const [emo, band] = BANDS[res.band] || BANDS.calma;
    if (res.band === 'gaueko') sfx.thunder(); else if (res.creatures.length) sfx.drum(); else sfx.page();
    const diff = res.difficulty && (res.difficulty.over_high ? 'mortal' : res.difficulty.difficulty);
    clear(out, h('div', { class: `night-card b-${res.band}` },
      h('div', { class: 'row between' }, h('span', { class: 'chip' }, `${emo} ${band} · ${total}`), diff && h('span', { class: `chip d-${diff}` }, diff === 'mortal' ? '☠️ Mortal para el grupo' : `Dificultad: ${diff}`)),
      h('h3', {}, res.title),
      h('p', { class: 'night-text' }, res.text),
      res.dm && h('p', { class: 'small night-dm' }, h('b', {}, '🔒 Para el máster: '), res.dm),
      res.creatures.length > 0 && h('p', { class: 'small' }, res.creatures.map((c) => `${c.count} × ${c.name} (VD ${c.cr})`).join(' · ')),
      diff === 'mortal' && h('p', { class: 'tiny muted' }, 'Demasiado para este grupo: que huyan, negocien o tiren del saber popular (lo que cuenta la nota del máster).'),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => readAloud(res) }, icon('feather', 14), 'Leer en la mesa'),
        res.creatures.length > 0 && h('button', { class: 'btn sm primary', type: 'button', onclick: () => prepareCombat(res) }, '⚔️ Preparar combate'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: toDawn }, '🌅 Pasar la noche'))));
  }

  async function readAloud(res) {
    await api.saveSettings({ playerMessage: `${res.title} — ${res.text}`, playerImage: '' }).catch(toastError);
    sfx.unroll();
    toast('Se lee en la mesa.', { kind: 'good', iconName: 'mesa' });
  }

  async function toDawn() {
    const cl = { ...clock };
    if (cl.minutes >= 6 * 60) cl.day += 1;
    cl.minutes = 6 * 60;
    await api.saveSettings({ clock: cl }).catch(toastError);
    sfx.levelup();
    toast(`Amanece: ${worldDate(cal, cl.day, { weekday: true })}, 06:00.`, { kind: 'good', iconName: 'sun' });
    close();
  }

  async function prepareCombat(res) {
    try {
      const [bestiary, scenes] = await Promise.all([monsters(), loadScenes()]);
      const c = { ...newCombat(1), name: `Noche: ${res.title}` };
      for (const { name, count } of res.creatures) {
        const m = bestiary.find((x) => x.name === name);
        for (let i = 0; m && i < count; i++) c.combatants.push(combatantFrom(fromMonster(m), count > 1 ? String(i + 1) : ''));
      }
      players.forEach((p) => c.combatants.push(combatantFrom(p)));
      c.board = { scene: res.scene, pos: {}, moved: {} };
      const scene = findScene(res.scene, scenes);
      if (scene) autoPlace(c, scene, scenes.cat);
      const saved = await api.create('combats', c);
      close();
      location.hash = `#/combate/${saved.id}`;
    } catch (e) { toastError(e); }
  }

  const body = h('div', { class: 'stack-sm night' },
    h('p', { class: 'night-when' }, `${worldDate(cal, clock.day, { weekday: true })} · ${hhmm(clock.minutes)} · ${moon.emoji} ${moon.name}`,
      ctx.festival && h('span', { class: 'chip' }, FEST[ctx.festival])),
    !isNight(clock.minutes) && h('p', { class: 'tiny muted' }, 'Ahora es de día en el reloj del mundo. Puedes tirar igualmente para preparar la noche.'),
    h('blockquote', { class: 'night-motto' }, '«Gaua gauekoentzat, eguna egunekoentzat»', h('small', {}, 'La noche, para los de la noche; el día, para los del día.')),
    h('div', { class: 'row wrap' },
      field('Dónde', selectEl(ref.night.terrains, ctx.terrain, (v) => { ctx.terrain = v; refresh(); }, { 'aria-label': 'Dónde pasan la noche' })),
      field('Qué hacen', segmented(ref.night.situations.map(([k, l]) => [k, l]), ctx.situation, (v) => { ctx.situation = v; refresh(); }))),
    h('div', { class: 'row wrap' },
      h('label', { class: 'check small', 'data-tip': 'La flor del sol clavada en la puerta: los seres de la noche tienen que contarle todos los pelillos antes de entrar, y amanece antes de que acaben' },
        h('input', { type: 'checkbox', onchange: (e) => { ctx.eguzkilore = e.target.checked; refresh(); } }), '🌼 Eguzkilore en la puerta'),
      h('label', { class: 'check small', 'data-tip': 'Lo marca el clima de la mesa; puedes cambiarlo' },
        h('input', { type: 'checkbox', checked: ctx.storm, onchange: (e) => { ctx.storm = e.target.checked; refresh(); } }), '⛈️ Tormenta'),
      h('label', { class: 'check small', 'data-tip': 'Alguien se ha burlado de la noche, ha contestado a la voz del viento o trabaja de noche sin necesidad' },
        h('input', { type: 'checkbox', onchange: (e) => { ctx.challenged = e.target.checked; refresh(); } }), '😈 Han desafiado a la noche')),
    modsEl,
    h('div', { class: 'row' }, rollBtn),
    out);
  const done = modal('La noche es de Gaueko', body, [{ label: 'Cerrar', value: null }], { iconName: 'moon', wide: true });
  const close = () => body.closest('.modal-back')?.querySelector('.panel-head .actions button')?.click();
  refresh();
  return done;
}
