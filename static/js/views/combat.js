// Combates: preparar encuentros, iniciativa, turnos, PG, estados, salvaciones en área y registro.
import { api, debounced } from '../core/api.js';
import { h, clear, bind, field, selectEl, hpBar, avatar, modal, confirmDialog, toast, toastError, fmtDate } from '../core/dom.js';
import {
  TYPE_LABEL, ABILITY_KEYS, ABILITY_SHORT, reference, monsters, fmtMod, combatantFrom,
  fromMonster, applyDamage, applyHealing,
} from '../core/dnd.js';
import { roll } from '../core/dice.js';
import { critExpr } from './characters.js';

const ICON = '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m11 19-6-6M8 16l-4 4M5 21l-2-2"/>';
const STATUS = { planned: 'Preparado', active: 'En curso', finished: 'Terminado' };

export default { id: 'combate', title: 'Combate', icon: ICON, mount };

async function mount(root, [selId]) {
  const [ref, combats, chars, bestiary, settings] = await Promise.all([
    reference(), api.list('combats'), api.list('characters'), monsters(), api.settings(),
  ]);
  const state = { combats, chars, settings, sel: combats.find((c) => c.id === (selId || settings.activeCombat)) || null, mode: '' };

  const side = h('aside', { class: 'sidebar card' });
  const main = h('section', { class: 'stack' });
  root.append(h('div', { class: 'split' }, side, main));

  const save = debounced(async (c) => {
    try { c.updated = (await api.update('combats', c)).updated; } catch (e) { toastError(e); }
  }, 300);
  const commit = () => { save(state.sel); render(); };

  // -- Lista de combates ---------------------------------------------------
  function renderSide() {
    const order = ['active', 'planned', 'finished'];
    const sorted = [...state.combats].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.updated - a.updated);
    clear(side,
      h('div', { class: 'row between' }, h('h3', {}, 'Combates'),
        h('button', { class: 'btn sm primary', type: 'button', onclick: createCombat }, '+ Nuevo')),
      h('ul', { class: 'list' }, sorted.length ? sorted.map((c) => h('li', { 'aria-selected': String(c === state.sel), onclick: () => select(c) },
        h('div', { class: 'grow' }, h('b', {}, c.name),
          h('div', { class: 'small muted' }, `${c.combatants.length} participantes · ${fmtDate(c.updated)}`)),
        h('span', { class: `chip status-${c.status}` }, STATUS[c.status])))
        : h('li', { class: 'muted' }, 'Aún no hay combates.')));
  }

  function select(c) {
    if (save.pending) save.flush();
    state.sel = c;
    history.replaceState(null, '', c ? `#/combate/${c.id}` : '#/combate');
    render();
  }

  async function createCombat() {
    try {
      const c = await api.create('combats', { name: `Combate ${state.combats.length + 1}`, status: 'planned', round: 0, turn: 0, combatants: [], log: [] });
      state.combats.push(c);
      select(c);
    } catch (e) { toastError(e); }
  }

  // -- Utilidades ----------------------------------------------------------
  const log = (c, text) => { c.log.unshift({ t: Date.now() / 1000, round: c.round, text }); };
  const charOf = (x) => state.chars.find((ch) => ch.id === x.charId);
  const current = (c) => c.combatants[c.turn];

  function sortInitiative(c) {
    const curId = current(c)?.cid;
    c.combatants.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || (b.initBonus || 0) - (a.initBonus || 0) || (a.type === 'jugador' ? -1 : 1));
    c.turn = Math.max(0, c.combatants.findIndex((x) => x.cid === curId));
  }

  // Los PG de los jugadores se reflejan también en su ficha.
  async function syncCharacter(x) {
    const ch = x.type === 'jugador' && charOf(x);
    if (!ch) return;
    Object.assign(ch, { hp: x.hp, tempHp: x.tempHp, deathSaves: { ...x.deathSaves } });
    api.update('characters', ch).catch(toastError);
  }

  function damage(c, x, amount, source = '') {
    const hpBefore = x.hp;
    const real = applyDamage(x, amount);
    log(c, `${x.name} recibe ${amount} de daño${source ? ` (${source})` : ''}. PG ${x.hp}/${x.maxHp}.`);
    if (x.concentration && amount > 0) {
      const dc = Math.max(10, Math.floor(amount / 2));
      toast(`${x.name}: salvación de Constitución CD ${dc} para mantener la concentración.`, { ms: 7000 });
      log(c, `${x.name} debe superar CON CD ${dc} o perder la concentración.`);
    }
    if (x.hp === 0 && real > 0) {
      if (x.type === 'jugador') {
        if (real - hpBefore >= x.maxHp) {
          x.deathSaves = { ok: 0, ko: 3 };
          log(c, `${x.name} muere por daño masivo (el daño sobrante iguala sus PG máximos).`);
          toast(`${x.name} muere por daño masivo.`, { kind: 'error' });
        } else log(c, `${x.name} cae inconsciente.`);
      } else log(c, `${x.name} cae derrotado.`);
    }
    syncCharacter(x);
  }

  function heal(c, x, amount) {
    applyHealing(x, amount);
    log(c, `${x.name} recupera ${amount} PG. PG ${x.hp}/${x.maxHp}.`);
    syncCharacter(x);
  }

  // -- Flujo del combate ---------------------------------------------------
  async function rollInitiative(c, onlyMissing = false) {
    for (const x of c.combatants) {
      if (onlyMissing && x.init != null) continue;
      const r = await roll(`1d20${fmtMod(x.initBonus || 0)}`, { label: `${x.name}: Iniciativa`, who: x.name, quiet: true, secret: x.hidden });
      if (r) x.init = r.total;
    }
    sortInitiative(c);
  }

  async function start(c) {
    if (!c.combatants.length) return toast('Añade participantes antes de empezar.');
    await rollInitiative(c, true);
    c.status = 'active';
    c.round = 1;
    c.turn = 0;
    log(c, `¡Comienza el combate! Turno de ${current(c).name}.`);
    await setActive(c.id);
    commit();
  }

  async function setActive(id) {
    try { state.settings = await api.saveSettings({ activeCombat: id }); } catch (e) { toastError(e); }
  }

  function step(c, dir) {
    const n = c.combatants.length;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      c.turn += dir;
      if (c.turn >= n) { c.turn = 0; c.round += 1; log(c, `— Ronda ${c.round} —`); }
      if (c.turn < 0) { c.turn = n - 1; c.round = Math.max(1, c.round - 1); }
      const x = current(c);
      if (x.type === 'jugador' || x.hp > 0) break; // los enemigos caídos no juegan
    }
    const x = current(c);
    if (dir > 0) {
      x.conditions = x.conditions.filter((cond) => {
        if (cond.rounds == null) return true;
        cond.rounds -= 1;
        if (cond.rounds <= 0) { log(c, `${x.name} ya no está ${cond.name.toLowerCase()}.`); return false; }
        return true;
      });
      log(c, `Turno de ${x.name}.`);
      if (x.type === 'jugador' && x.hp <= 0) toast(`${x.name} está a 0 PG: tirada de salvación de muerte.`);
    }
    commit();
  }

  async function finish(c) {
    c.status = 'finished';
    const defeated = c.combatants.filter((x) => x.type === 'enemigo' && x.hp <= 0);
    const xp = defeated.reduce((s, x) => s + (ref.cr_xp[x.cr] || 0), 0);
    log(c, `Fin del combate en la ronda ${c.round}. ${defeated.length} enemigos derrotados (${xp} PX).`);
    if (state.settings.activeCombat === c.id) await setActive(null);
    commit();
    const players = c.combatants.filter((x) => x.type === 'jugador' && charOf(x));
    if (xp && players.length) {
      const each = Math.floor(xp / players.length);
      const ok = await modal('Repartir experiencia', h('p', {}, `Los enemigos derrotados valen ${xp} PX: ${each} PX para cada uno de los ${players.length} jugadores.`),
        [{ label: 'Ahora no', value: false }, { label: 'Repartir', value: true, class: 'primary' }]);
      if (ok) {
        await Promise.all(players.map((x) => { const ch = charOf(x); ch.xp = (ch.xp || 0) + each; return api.update('characters', ch); }));
        toast(`${each} PX para cada jugador.`);
      }
    }
  }

  // -- Añadir participantes -----------------------------------------------
  async function addCombatant(c, x) {
    if (c.status === 'active') {
      const r = await roll(`1d20${fmtMod(x.initBonus || 0)}`, { label: `${x.name}: Iniciativa`, who: x.name, quiet: true });
      x.init = r?.total ?? 10;
      c.combatants.push(x);
      sortInitiative(c);
      log(c, `${x.name} se une al combate (iniciativa ${x.init}).`);
    } else c.combatants.push(x);
  }

  async function addFromCharacter(c, ch, qty) {
    const existing = c.combatants.filter((x) => x.charId === ch.id).length;
    if (ch.type === 'jugador' && existing) return toast(`${ch.name} ya está en el combate.`);
    for (let i = 0; i < qty; i++) {
      const needsNumber = ch.type !== 'jugador' && (qty > 1 || existing);
      await addCombatant(c, combatantFrom(ch, needsNumber ? String(existing + i + 1) : ''));
    }
    commit();
  }

  function addPanel(c) {
    const groups = ['jugador', 'pnj', 'enemigo'].map((t) => [t, state.chars.filter((ch) => ch.type === t)]);
    const charSel = h('select', { 'aria-label': 'Personaje' }, groups.filter(([, l]) => l.length).map(([t, l]) =>
      h('optgroup', { label: TYPE_LABEL[t] }, l.map((ch) => h('option', { value: ch.id }, ch.name)))));
    const qty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline', 'aria-label': 'Cantidad' });
    const monSel = selectEl(bestiary.map((m, i) => [i, `${m.name} (VD ${m.cr})`]), 0, () => {}, { 'aria-label': 'Monstruo' });
    const monQty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline', 'aria-label': 'Cantidad' });
    const quick = { name: '', hp: 10, ac: 12, initBonus: 0 };

    return h('details', { class: 'card box-card', open: c.combatants.length === 0 },
      h('summary', {}, h('b', {}, 'Añadir participantes')),
      h('div', { class: 'grid cols-3', style: { marginTop: '10px' } },
        h('div', { class: 'stack' }, h('div', { class: 'eyebrow' }, 'Desde las fichas'),
          state.chars.length ? h('div', { class: 'row' }, h('div', { class: 'grow' }, charSel), qty,
            h('button', { class: 'btn sm primary', type: 'button', onclick: () => {
              const ch = state.chars.find((x) => x.id === charSel.value);
              if (ch) addFromCharacter(c, ch, Number(qty.value) || 1);
            } }, 'Añadir')) : h('p', { class: 'muted small' }, 'Crea fichas en Personajes.'),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => {
            for (const ch of state.chars.filter((x) => x.type === 'jugador' && !c.combatants.some((y) => y.charId === x.id))) {
              await addCombatant(c, combatantFrom(ch));
            }
            commit();
          } }, 'Añadir a todos los jugadores')),
        h('div', { class: 'stack' }, h('div', { class: 'eyebrow' }, 'Desde el bestiario'),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, monSel), monQty,
            h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
              const m = bestiary[Number(monSel.value)];
              const n = Number(monQty.value) || 1;
              const prev = c.combatants.filter((x) => x.name.startsWith(m.name)).length;
              for (let i = 0; i < n; i++) await addCombatant(c, combatantFrom(fromMonster(m), n > 1 || prev ? String(prev + i + 1) : ''));
              commit();
            } }, 'Añadir'))),
        h('div', { class: 'stack' }, h('div', { class: 'eyebrow' }, 'Rápido (sin ficha)'),
          h('div', { class: 'row' },
            field('Nombre', bind(quick, 'name'), 'grow'), field('PG', bind(quick, 'hp', { type: 'number', class: 'inline' })),
            field('CA', bind(quick, 'ac', { type: 'number', class: 'inline' })), field('Inic.', bind(quick, 'initBonus', { type: 'number', class: 'inline' }))),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => {
            if (!quick.name.trim()) return toast('Ponle un nombre.');
            await addCombatant(c, combatantFrom({ name: quick.name.trim(), type: 'enemigo', hp: quick.hp, maxHp: quick.hp, ac: quick.ac, initBonus: quick.initBonus }));
            commit();
          } }, 'Añadir'))));
  }

  // -- Dificultad ----------------------------------------------------------
  function difficultyBox(c) {
    const box = h('span', { class: 'muted small' }, 'Calculando dificultad…');
    const levels = c.combatants.filter((x) => x.type === 'jugador').map((x) => charOf(x)?.level || 1);
    const crs = c.combatants.filter((x) => x.type === 'enemigo' && x.cr !== '' && x.cr != null).map((x) => x.cr);
    if (!levels.length || !crs.length) { box.textContent = 'Añade jugadores y enemigos con VD para ver la dificultad.'; return box; }
    api.post('/api/encounter', { levels, crs }).then((r) => {
      clear(box, h('span', { class: `chip diff-${r.difficulty.normalize('NFD').replace(/\p{M}/gu, '')}` }, `Dificultad ${r.difficulty}`),
        ` ${r.adjusted_xp} PX ajustados (×${r.multiplier}) · ${r.base_xp} PX a repartir · umbrales ${Object.values(r.thresholds).join(' / ')}`);
    }).catch(() => { box.textContent = ''; });
    return box;
  }

  // -- Daño en área / salvaciones de grupo ---------------------------------
  async function areaDialog(c) {
    const opts = { ability: 'des', dc: 13, damage: '8d6', half: true };
    const targets = new Set(c.combatants.filter((x) => x.type !== 'jugador' && x.hp > 0).map((x) => x.cid));
    const body = h('div', { class: 'stack' },
      h('div', { class: 'row' },
        field('Salvación', selectEl(ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]]), opts.ability, (v) => { opts.ability = v; })),
        field('CD', bind(opts, 'dc', { type: 'number', class: 'inline' })),
        field('Daño (dados o número)', bind(opts, 'damage')),
        h('label', { class: 'check' }, bind(opts, 'half', { type: 'checkbox' }), 'Mitad si salva')),
      h('div', { class: 'eyebrow' }, 'Objetivos (los jugadores tiran sus dados; aquí se usa su bonificador)'),
      h('div', { class: 'targets' }, c.combatants.map((x) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: targets.has(x.cid), onchange: (e) => (e.target.checked ? targets.add(x.cid) : targets.delete(x.cid)) }), x.name))));
    if (!(await modal('Daño en área / salvación de grupo', body, [{ label: 'Cancelar', value: false }, { label: 'Tirar', value: true, class: 'primary' }]))) return;

    const dmgRoll = /d/i.test(opts.damage) ? await roll(opts.damage, { label: 'Daño en área' }) : { total: Number(opts.damage) || 0 };
    if (!dmgRoll) return;
    const lines = [];
    for (const x of c.combatants.filter((y) => targets.has(y.cid))) {
      const r = await roll(`1d20${fmtMod(x.saves?.[opts.ability] || 0)}`, { label: `${x.name}: salvación de ${ABILITY_SHORT[opts.ability]}`, who: x.name, quiet: true, secret: x.hidden });
      if (!r) continue;
      const saved = r.total >= opts.dc;
      const dmg = saved ? (opts.half ? Math.floor(dmgRoll.total / 2) : 0) : dmgRoll.total;
      if (dmg) damage(c, x, dmg, 'área');
      lines.push(h('li', {}, `${x.name}: ${r.total} — ${saved ? 'salva' : 'falla'} → ${dmg} de daño`));
    }
    log(c, `Área ${ABILITY_SHORT[opts.ability]} CD ${opts.dc}, ${dmgRoll.total} de daño.`);
    commit();
    modal('Resultado', h('ul', {}, lines));
  }

  // -- Pintado -------------------------------------------------------------
  function render() {
    renderSide();
    const c = state.sel;
    if (!c) {
      clear(main, h('div', { class: 'empty' }, h('h3', {}, 'Organiza un combate'),
        h('p', {}, 'Crea un combate, añade jugadores, personajes de la historia y enemigos, tira iniciativa y lleva los turnos.')));
      return;
    }
    clear(main, headerCard(c), c.status !== 'finished' && addPanel(c), trackerCard(c), logCard(c));
  }

  function headerCard(c) {
    const actions = {
      planned: [h('button', { class: 'btn primary', type: 'button', onclick: () => start(c) }, '⚔ Tirar iniciativa y empezar'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { await rollInitiative(c); commit(); } }, 'Solo tirar iniciativa')],
      active: [h('button', { class: 'btn', type: 'button', onclick: () => step(c, -1) }, '◀ Anterior'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => step(c, 1) }, 'Siguiente turno ▶'),
        h('button', { class: 'btn', type: 'button', onclick: () => areaDialog(c) }, '💥 Daño en área'),
        state.settings.activeCombat !== c.id && h('button', { class: 'btn', type: 'button', onclick: async () => { await setActive(c.id); render(); } }, 'Mostrar a jugadores'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => finish(c) }, 'Terminar combate')],
      finished: [h('button', { class: 'btn', type: 'button', onclick: async () => { c.status = 'active'; await setActive(c.id); log(c, 'Se reanuda el combate.'); commit(); } }, 'Reanudar'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          c.status = 'planned'; c.round = 0; c.turn = 0; c.log = [];
          c.combatants.forEach((x) => { x.init = null; x.hp = x.maxHp; x.tempHp = 0; x.conditions = []; x.concentration = false; x.deathSaves = { ok: 0, ko: 0 }; });
          commit();
        } }, 'Reiniciar como nuevo')],
    }[c.status];
    return h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', { class: 'row grow' }, bind(c, 'name', { class: 'title-input grow', 'aria-label': 'Nombre del combate', onChange: () => { save(c); renderSide(); } }),
          h('span', { class: `chip status-${c.status}` }, STATUS[c.status]),
          c.status !== 'planned' && h('span', { class: 'round-badge' }, `Ronda ${c.round}`)),
        h('button', { class: 'btn sm danger', type: 'button', onclick: async () => {
          if (!(await confirmDialog(`Se eliminará el combate «${c.name}».`))) return;
          await api.remove('combats', c.id).catch(toastError);
          if (state.settings.activeCombat === c.id) await setActive(null);
          state.combats = state.combats.filter((x) => x !== c);
          state.sel = null;
          select(null);
        } }, 'Eliminar')),
      h('div', { class: 'row', style: { marginTop: '10px' } }, actions),
      h('div', { style: { marginTop: '10px' } }, difficultyBox(c)));
  }

  function trackerCard(c) {
    if (!c.combatants.length) return h('div', { class: 'empty' }, 'Sin participantes todavía.');
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, 'Orden de iniciativa'),
        h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Ataques con:'),
          selectEl([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.mode, (v) => { state.mode = v; }, { style: 'width:auto' }))),
      h('ol', { class: 'tracker' }, c.combatants.map((x, i) => combatantRow(c, x, i))));
  }

  function combatantRow(c, x, i) {
    const isTurn = c.status === 'active' && i === c.turn;
    const amount = h('input', { type: 'number', min: 0, class: 'inline', placeholder: 'PG', 'aria-label': `Cantidad para ${x.name}` });
    const apply = (fn) => () => { const v = Number(amount.value); if (!v) return amount.focus(); fn(v); commit(); };
    amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply((v) => damage(c, x, v))(); });
    const down = x.hp <= 0;

    const condAdd = selectEl([['', '+ Estado'], ...ref.conditions.map((k) => [k.name, k.name])], '', async (name) => {
      if (!name) return;
      const rounds = await modal(`${name}: duración`, h('p', { class: 'muted' }, '¿Durante cuántos turnos de esta criatura?'),
        [{ label: 'Indefinido', value: null }, { label: '1', value: 1 }, { label: '3', value: 3 }, { label: '10 (1 min)', value: 10 }]);
      x.conditions.push({ name, rounds });
      if (name === 'Concentrado') x.concentration = true;
      log(c, `${x.name} queda ${name.toLowerCase()}${rounds ? ` (${rounds} turnos)` : ''}.`);
      commit();
    }, { class: 'cond-add', 'aria-label': 'Añadir estado' });

    return h('li', { class: `combatant ${x.type} ${isTurn ? 'turn' : ''} ${down ? 'down' : ''} ${x.hidden ? 'hidden-c' : ''}` },
      h('div', { class: 'c-init' }, bind(x, 'init', { type: 'number', class: 'inline', 'aria-label': 'Iniciativa', onCommit: () => { sortInitiative(c); commit(); } })),
      avatar(x),
      h('div', { class: 'c-main grow' },
        h('div', { class: 'row' },
          h('b', { class: 'c-name' }, x.name), h('span', { class: `chip ${x.type}` }, TYPE_LABEL[x.type].split(' ')[0]),
          h('span', { class: 'small muted' }, `CA ${x.ac}`),
          x.concentration && h('span', { class: 'chip', title: 'Concentrado' }, '◎ Conc.'),
          x.conditions.map((k, j) => h('span', { class: 'chip', title: ref.conditions.find((r) => r.name === k.name)?.text || '' },
            k.name, k.rounds ? ` (${k.rounds})` : '',
            h('button', { type: 'button', 'aria-label': `Quitar ${k.name}`, onclick: () => {
              x.conditions.splice(j, 1);
              if (k.name === 'Concentrado') x.concentration = false;
              commit();
            } }, '✕'))),
          condAdd),
        h('div', { class: 'row c-hp' },
          h('span', { class: 'tnum' }, h('b', {}, x.hp), ` / ${x.maxHp}`, x.tempHp ? h('span', { class: 'muted' }, ` +${x.tempHp}`) : ''),
          h('div', { class: 'grow' }, hpBar(x.hp, x.maxHp)),
          amount,
          h('button', { class: 'btn sm danger', type: 'button', onclick: apply((v) => damage(c, x, v)) }, 'Daño'),
          h('button', { class: 'btn sm', type: 'button', onclick: apply((v) => heal(c, x, v)) }, 'Curar'),
          h('button', { class: 'btn sm', type: 'button', onclick: apply((v) => { x.tempHp = Math.max(x.tempHp || 0, v); syncCharacter(x); }) }, 'Temp')),
        x.type === 'jugador' && down && deathSaveRow(c, x),
        x.attacks?.length > 0 && h('div', { class: 'row c-attacks' }, x.attacks.map((a) => h('span', { class: 'attack' },
          h('button', { class: 'btn sm', type: 'button', title: `+${a.bonus} al ataque`, onclick: () => roll(`1d20${fmtMod(Number(a.bonus) || 0)}`, { label: `${x.name}: ${a.name}`, who: x.name, mode: state.mode, secret: x.hidden }) }, `${a.name} ${fmtMod(Number(a.bonus) || 0)}`),
          a.damage && a.damage !== '0' && h('button', { class: 'btn sm ghost', type: 'button', onclick: () => roll(a.damage, { label: `${x.name}: daño de ${a.name}`, who: x.name, secret: x.hidden }) }, a.damage),
          a.damage && a.damage !== '0' && h('button', { class: 'btn sm ghost', type: 'button', title: 'Crítico', onclick: () => roll(critExpr(a.damage), { label: `${x.name}: crítico con ${a.name}`, who: x.name, secret: x.hidden }) }, '×2'))))),
      h('div', { class: 'c-tools' },
        h('button', { class: 'btn sm icon ghost', type: 'button', title: x.concentration ? 'Quitar concentración' : 'Marcar concentración', 'aria-pressed': String(!!x.concentration),
          onclick: () => { x.concentration = !x.concentration; commit(); } }, '◎'),
        h('button', { class: 'btn sm icon ghost', type: 'button', title: x.hidden ? 'Oculto a los jugadores' : 'Visible para los jugadores', 'aria-pressed': String(!!x.hidden),
          onclick: () => { x.hidden = !x.hidden; commit(); } }, x.hidden ? '🙈' : '👁'),
        h('button', { class: 'btn sm icon ghost danger', type: 'button', 'aria-label': `Quitar a ${x.name}`, onclick: () => {
          const cur = current(c)?.cid;
          c.combatants.splice(i, 1);
          c.turn = Math.max(0, c.combatants.findIndex((y) => y.cid === cur));
          log(c, `${x.name} sale del combate.`);
          commit();
        } }, '✕')));
  }

  function deathSaveRow(c, x) {
    const ds = x.deathSaves;
    return h('div', { class: 'row death' }, h('b', {}, 'Salvaciones de muerte:'),
      h('span', {}, `✔ ${'●'.repeat(ds.ok)}${'○'.repeat(3 - ds.ok)}`), h('span', {}, `✖ ${'●'.repeat(ds.ko)}${'○'.repeat(3 - ds.ko)}`),
      h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        const r = await roll('1d20', { label: `${x.name}: salvación de muerte`, who: x.name });
        if (!r) return;
        if (r.natural === 20) { x.hp = 1; x.deathSaves = { ok: 0, ko: 0 }; log(c, `${x.name} saca un 20 natural y se levanta con 1 PG.`); }
        else if (r.natural === 1) ds.ko = Math.min(3, ds.ko + 2);
        else if (r.total >= 10) ds.ok = Math.min(3, ds.ok + 1);
        else ds.ko = Math.min(3, ds.ko + 1);
        if (x.deathSaves.ko >= 3) log(c, `${x.name} ha muerto.`);
        else if (x.deathSaves.ok >= 3) log(c, `${x.name} se estabiliza.`);
        syncCharacter(x);
        commit();
      } }, 'Tirar'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { ds.ok = 3; log(c, `${x.name} es estabilizado.`); syncCharacter(x); commit(); } }, 'Estabilizar'));
  }

  function logCard(c) {
    const note = { text: '' };
    const input = bind(note, 'text', { placeholder: 'Añadir una nota al registro…', class: 'grow' });
    const add = () => { if (!note.text.trim()) return; log(c, note.text.trim()); commit(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return h('div', { class: 'card' }, h('h3', {}, 'Registro'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn sm', type: 'button', onclick: add }, 'Anotar')),
      h('ul', { class: 'log' }, c.log.slice(0, 80).map((e) => h('li', {}, h('span', { class: 'muted small' }, e.round ? `R${e.round} ` : ''), e.text))));
  }

  render();
  return () => save.pending && save.flush();
}

