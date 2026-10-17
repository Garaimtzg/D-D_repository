// Combate: preparar encuentros, iniciativa, turnos, PG, estados, daño en área y registro.
// Las reglas viven en core/combat.js para compartirlas con la Mesa.
import { api, debounced } from '../core/api.js';
import {
  h, clear, append, icon, bigBanner, bind, field, selectEl, segmented, hpBar, token, shield, modal, confirmDialog, toast, toastError, fmtDate, floatNum,
} from '../core/dom.js';
import {
  TYPE_LABEL, TYPE_ICON, ABILITY_KEYS, ABILITY_SHORT, condLabel, reference, monsters, fmtMod, combatantFrom, fromMonster, critExpr,
} from '../core/dnd.js';
import * as R from '../core/combat.js';
import { sfx } from '../core/sfx.js';
import { roll } from '../core/dice.js';

export default { id: 'combate', title: 'Combate', icon: 'combate', hint: 'Encuentros, iniciativa y turnos · tecla 2', mount };

async function mount(root, [selId]) {
  const [ref, combats, chars, bestiary, settings] = await Promise.all([
    reference(), api.list('combats'), api.list('characters'), monsters(), api.settings(),
  ]);
  const state = { combats, chars, settings, sel: combats.find((c) => c.id === (selId || settings.activeCombat)) || null, mode: '' };
  if (!state.sel && combats.length) state.sel = combats.find((c) => c.status === 'active') || combats.find((c) => c.status === 'planned') || null;

  const side = h('aside', { class: 'panel sticky combat-side' });
  const main = h('section', { class: 'stack combat-main' });
  root.append(h('div', { class: 'split' }, side, main));

  const save = debounced(async (c) => {
    try { c.updated = (await api.update('combats', c)).updated; } catch (e) { toastError(e); }
  }, 300);
  const commit = () => { save(state.sel); render(); };
  const sync = (x) => R.syncCharacter(state.chars, x);
  const charOf = (x) => state.chars.find((ch) => ch.id === x.charId);

  // ----------------------------------------------------------------- lista
  function renderSide() {
    const order = ['active', 'planned', 'finished'];
    const sorted = [...state.combats].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.updated - a.updated);
    clear(side,
      h('div', { class: 'panel-head' }, h('h3', {}, icon('combate'), 'Encuentros'),
        h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: createCombat }, icon('plus', 15), 'Nuevo'))),
      sorted.length ? h('ul', { class: 'list' }, sorted.map((c) => h('li', { 'aria-selected': String(c === state.sel), onclick: () => select(c) },
        h('span', { class: `status-dot ${c.status}` }),
        h('div', { class: 'grow' }, h('b', {}, c.name),
          h('div', { class: 'tiny muted' }, `${c.combatants.length} participantes · ${c.status === 'planned' ? 'preparado' : c.status === 'active' ? `ronda ${c.round}` : 'terminado'} · ${fmtDate(c.updated)}`)))))
        : h('p', { class: 'muted small' }, 'Aún no hay encuentros.'));
  }

  function select(c) {
    if (save.pending) save.flush();
    state.sel = c;
    history.replaceState(null, '', c ? `#/combate/${c.id}` : '#/combate');
    render();
  }

  async function createCombat() {
    try {
      const c = await api.create('combats', R.newCombat(state.combats.length + 1));
      state.combats.push(c);
      select(c);
    } catch (e) { toastError(e); }
  }

  async function setActive(id) {
    try { state.settings = await api.saveSettings({ activeCombat: id }); } catch (e) { toastError(e); }
  }

  // ---------------------------------------------------------- flujo del combate
  async function start(c) {
    if (!c.combatants.length) return toast('Añade participantes antes de empezar.');
    await R.rollInitiative(c, true);
    setTimeout(() => { sfx.sword(); bigBanner('¡A las armas!', c.name, 'red', 'combate'); }, 750);
    c.status = 'active';
    c.round = 1;
    c.turn = 0;
    R.log(c, `¡Comienza el combate! Turno de ${R.current(c).name}.`);
    await setActive(c.id);
    commit();
    toast(h('div', {}, h('b', {}, '¡Tirad iniciativa!'), h('div', { class: 'small muted' }, c.combatants.map((x) => `${x.name} ${x.init}`).join(' · '))), { iconName: 'bolt', ms: 6000 });
  }

  function step(c, dir) {
    R.step(c, dir);
    commit();
    main.querySelector('.cbt.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function finish(c) {
    c.status = 'finished';
    const { defeated, xp } = R.xpReward(c, ref.cr_xp);
    R.log(c, `Fin del combate en la ronda ${c.round}. ${defeated.length} enemigos derrotados (${xp} PX).`);
    if (defeated.length) { sfx.victory(); bigBanner('¡Victoria!', `${defeated.length} enemigos derrotados`, 'gold', 'crown'); }
    if (state.settings.activeCombat === c.id) await setActive(null);
    commit();
    const players = c.combatants.filter((x) => x.type === 'jugador' && charOf(x));
    if (xp && players.length) {
      const each = Math.floor(xp / players.length);
      const ok = await modal('¡Victoria!', h('div', { class: 'stack center' }, h('div', { class: 'victory' }, icon('crown', 46)),
        h('p', {}, `Los ${defeated.length} enemigos derrotados valen `, h('b', {}, `${xp} PX`), '.'),
        h('p', {}, h('b', {}, `${each} PX`), ` para cada uno de los ${players.length} jugadores.`)),
      [{ label: 'Ahora no', value: false }, { label: 'Repartir experiencia', value: true, class: 'primary', icon: 'star' }], { iconName: 'star' });
      if (ok) {
        await Promise.all(players.map((x) => { const ch = charOf(x); ch.xp = (ch.xp || 0) + each; return api.update('characters', ch); }));
        sfx.coins();
        toast(`${each} PX para cada jugador.`, { kind: 'good', iconName: 'star' });
      }
    }
  }

  async function addCombatant(c, x) {
    if (c.status === 'active') {
      const r = await roll(`1d20${fmtMod(x.initBonus || 0)}`, { label: `${x.name}: Iniciativa`, who: x.name, quiet: true });
      x.init = r?.total ?? 10;
      c.combatants.push(x);
      R.sortInitiative(c);
      R.log(c, `${x.name} se une al combate (iniciativa ${x.init}).`);
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

  // ------------------------------------------------------ añadir participantes
  function addPanel(c) {
    const groups = ['jugador', 'pnj', 'enemigo'].map((t) => [t, state.chars.filter((ch) => ch.type === t)]);
    const charSel = h('select', { 'aria-label': 'Personaje' }, groups.filter(([, l]) => l.length).map(([t, l]) =>
      h('optgroup', { label: TYPE_LABEL[t] }, l.map((ch) => h('option', { value: ch.id }, ch.name)))));
    const qty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline mini', 'aria-label': 'Cantidad' });
    const monSel = selectEl(bestiary.map((m, i) => [i, `${m.name} · VD ${m.cr}`]), 0, () => {}, { 'aria-label': 'Monstruo' });
    const monQty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline mini', 'aria-label': 'Cantidad' });
    const quick = { name: '', hp: 10, ac: 12, initBonus: 0 };
    const missingPlayers = state.chars.filter((x) => x.type === 'jugador' && !c.combatants.some((y) => y.charId === x.id));

    return h('details', { class: 'panel add-panel', open: c.combatants.length === 0 },
      h('summary', {}, icon('plus', 18), h('b', {}, 'Añadir participantes'), h('span', { class: 'tiny muted' }, 'fichas, bestiario o rápido')),
      h('div', { class: 'grid cols-3', style: { marginTop: '14px' } },
        h('div', { class: 'add-col' }, h('div', { class: 'eyebrow' }, icon('personajes', 14), 'Desde las fichas'),
          state.chars.length ? h('div', { class: 'row nowrap' }, h('div', { class: 'grow' }, charSel), qty,
            h('button', { class: 'btn sm primary', type: 'button', onclick: () => {
              const ch = state.chars.find((x) => x.id === charSel.value);
              if (ch) addFromCharacter(c, ch, Number(qty.value) || 1);
            } }, 'Añadir')) : h('p', { class: 'muted small' }, 'Crea fichas en Personajes.'),
          h('button', { class: 'btn sm', type: 'button', disabled: !missingPlayers.length, onclick: async () => {
            for (const ch of missingPlayers) await addCombatant(c, combatantFrom(ch));
            commit();
          } }, icon('crown', 15), missingPlayers.length ? `Todo el grupo (${missingPlayers.length})` : 'El grupo ya está')),
        h('div', { class: 'add-col' }, h('div', { class: 'eyebrow' }, icon('book', 14), 'Desde el bestiario'),
          h('div', { class: 'row nowrap' }, h('div', { class: 'grow' }, monSel), monQty,
            h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
              const m = bestiary[Number(monSel.value)];
              const n = Number(monQty.value) || 1;
              const prev = c.combatants.filter((x) => x.name.startsWith(m.name)).length;
              for (let i = 0; i < n; i++) await addCombatant(c, combatantFrom(fromMonster(m), n > 1 || prev ? String(prev + i + 1) : ''));
              commit();
            } }, 'Añadir'))),
        h('div', { class: 'add-col' }, h('div', { class: 'eyebrow' }, icon('bolt', 14), 'Rápido, sin ficha'),
          h('div', { class: 'row nowrap' },
            field('Nombre', bind(quick, 'name', { placeholder: 'Bandido' }), 'grow'), field('PG', bind(quick, 'hp', { type: 'number', class: 'inline mini' })),
            field('CA', bind(quick, 'ac', { type: 'number', class: 'inline mini' })), field('Inic.', bind(quick, 'initBonus', { type: 'number', class: 'inline mini' }))),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => {
            if (!quick.name.trim()) return toast('Ponle un nombre.');
            await addCombatant(c, combatantFrom({ name: quick.name.trim(), type: 'enemigo', hp: quick.hp, maxHp: quick.hp, ac: quick.ac, initBonus: quick.initBonus }));
            commit();
          } }, icon('plus', 15), 'Añadir'))));
  }

  // ------------------------------------------------------------- dificultad
  function difficultyBox(c) {
    const box = h('div', { class: 'difficulty' });
    const levels = c.combatants.filter((x) => x.type === 'jugador').map((x) => charOf(x)?.level || 1);
    const crs = c.combatants.filter((x) => x.type === 'enemigo' && x.cr !== '' && x.cr != null).map((x) => x.cr);
    if (!levels.length || !crs.length) {
      clear(box, h('span', { class: 'small muted' }, icon('target', 14), ' Añade jugadores y enemigos con VD para ver la dificultad.'));
      return box;
    }
    api.post('/api/encounter', { levels, crs }).then((r) => {
      const t = r.thresholds;
      const xp = r.adjusted_xp;
      const seg = (a, b, off) => off + Math.min(1, Math.max(0, (xp - a) / Math.max(1, b - a))) * 25;
      const pos = xp < t.media ? seg(0, t.media, 0) : xp < t['difícil'] ? seg(t.media, t['difícil'], 25) : xp < t.mortal ? seg(t['difícil'], t.mortal, 50) : seg(t.mortal, t.mortal * 1.5, 75);
      clear(box,
        h('div', { class: 'row between' }, h('span', { class: `diff-word d-${r.difficulty.normalize('NFD').replace(/\p{M}/gu, '')}` }, r.difficulty),
          h('span', { class: 'small muted' }, `${xp.toLocaleString('es-ES')} PX ajustados (×${r.multiplier}) · ${r.base_xp.toLocaleString('es-ES')} PX de recompensa`)),
        h('div', { class: 'meter' }, h('span'), h('span'), h('span'), h('span'), h('i', { style: { left: `calc(${pos}% - 2px)` } })),
        h('div', { class: 'meter-labels' }, ['Fácil', 'Media', 'Difícil', 'Mortal'].map((l) => h('span', {}, l))));
    }).catch(() => clear(box));
    return box;
  }

  // ------------------------------------------------ daño en área / salvaciones
  async function areaDialog(c) {
    const opts = { ability: 'des', dc: 13, damage: '8d6', half: true };
    const targets = new Set(c.combatants.filter((x) => x.type !== 'jugador' && x.hp > 0).map((x) => x.cid));
    const body = h('div', { class: 'stack' },
      h('div', { class: 'row' },
        field('Salvación', selectEl(ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]]), opts.ability, (v) => { opts.ability = v; })),
        field('CD', bind(opts, 'dc', { type: 'number', class: 'inline' })),
        field('Daño (dados o número)', bind(opts, 'damage'), 'grow'),
        h('label', { class: 'check' }, bind(opts, 'half', { type: 'checkbox' }), 'Mitad si salva')),
      h('div', { class: 'eyebrow' }, 'Objetivos'),
      h('div', { class: 'targets' }, c.combatants.map((x) => h('label', { class: `target ${x.type}` },
        h('input', { type: 'checkbox', checked: targets.has(x.cid), onchange: (e) => (e.target.checked ? targets.add(x.cid) : targets.delete(x.cid)) }),
        token(x, { size: 30 }), h('span', {}, x.name)))),
      h('p', { class: 'tiny muted' }, 'Se tira la salvación de cada objetivo con su bonificador y se aplica el daño.'));
    if (!(await modal('Daño en área', body, [{ label: 'Cancelar', value: false }, { label: 'Lanzar', value: true, class: 'primary', icon: 'flame' }], { iconName: 'flame' }))) return;

    const dmgRoll = /d/i.test(opts.damage) ? await roll(opts.damage, { label: 'Daño en área' }) : { total: Number(opts.damage) || 0 };
    if (!dmgRoll) return;
    const lines = [];
    for (const x of c.combatants.filter((y) => targets.has(y.cid))) {
      const r = await roll(`1d20${fmtMod(x.saves?.[opts.ability] || 0)}`, { label: `${x.name}: salvación de ${ABILITY_SHORT[opts.ability]}`, who: x.name, quiet: true, secret: x.hidden });
      if (!r) continue;
      const saved = r.total >= opts.dc;
      const dmg = saved ? (opts.half ? Math.floor(dmgRoll.total / 2) : 0) : dmgRoll.total;
      if (dmg) { R.damage(c, x, dmg, 'área'); sync(x); }
      lines.push(h('li', { class: saved ? 'saved' : 'failed' }, token(x, { size: 30 }), h('b', { class: 'grow' }, x.name),
        h('span', { class: 'chip' }, `🎲 ${r.total}`), h('span', { class: `chip ${saved ? 'good' : 'bad'}` }, saved ? 'Salva' : 'Falla'), h('b', { class: 'dmg' }, `−${dmg}`)));
    }
    R.log(c, `Área de ${ABILITY_SHORT[opts.ability]} CD ${opts.dc}: ${dmgRoll.total} de daño.`);
    commit();
    modal('Resultado del área', h('ul', { class: 'area-result' }, lines), undefined, { iconName: 'flame' });
  }

  // ------------------------------------------------------------------ pintado
  function render() {
    renderSide();
    const c = state.sel;
    if (!c) {
      clear(main, h('div', { class: 'empty' }, icon('combate'), h('h3', {}, 'Organiza un combate'),
        h('p', {}, 'Crea un encuentro, añade al grupo, a los personajes de la historia y a los enemigos, tira iniciativa y lleva los turnos.'),
        h('button', { class: 'btn primary', type: 'button', onclick: createCombat }, icon('plus', 16), 'Nuevo encuentro')));
      return;
    }
    clear(main, headerCard(c), c.status !== 'finished' && addPanel(c), trackerCard(c), logCard(c));
  }

  function headerCard(c) {
    const actions = {
      planned: [h('button', { class: 'btn primary lg', type: 'button', onclick: () => start(c) }, icon('bolt', 19), 'Tirar iniciativa y empezar'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { await R.rollInitiative(c); commit(); } }, icon('dados', 16), 'Solo tirar iniciativa')],
      active: [h('button', { class: 'btn', type: 'button', onclick: () => step(c, -1) }, icon('prev', 16), 'Anterior'),
        h('button', { class: 'btn primary lg', type: 'button', onclick: () => step(c, 1) }, 'Siguiente turno', icon('next', 18)),
        h('button', { class: 'btn', type: 'button', onclick: () => areaDialog(c) }, icon('flame', 16), 'Daño en área'),
        state.settings.activeCombat !== c.id && h('button', { class: 'btn', type: 'button', onclick: async () => { await setActive(c.id); render(); } }, icon('mesa', 16), 'Llevar a la mesa'),
        h('a', { class: 'btn', href: '#/mesa' }, icon('mesa', 16), 'Ver en la mesa'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => finish(c) }, icon('crown', 16), 'Terminar')],
      finished: [h('button', { class: 'btn', type: 'button', onclick: async () => { c.status = 'active'; await setActive(c.id); R.log(c, 'Se reanuda el combate.'); commit(); } }, icon('play', 16), 'Reanudar'),
        h('button', { class: 'btn', type: 'button', onclick: () => { R.resetCombat(c); commit(); } }, icon('refresh', 16), 'Reiniciar como nuevo')],
    }[c.status];
    return h('div', { class: `panel ornate combat-head ${c.status}` },
      h('div', { class: 'row nowrap' },
        c.status !== 'planned' && h('div', { class: 'round-medal big' }, h('small', {}, 'Ronda'), h('b', {}, c.round)),
        h('div', { class: 'grow' },
          h('div', { class: 'row nowrap' }, bind(c, 'name', { class: 'title-input grow', 'aria-label': 'Nombre del combate', onChange: () => { save(c); renderSide(); } }),
            h('span', { class: `chip status ${c.status}` }, R.STATUS[c.status])),
          c.status === 'active' && h('div', { class: 'small muted' }, 'Turno de ', h('b', { class: 'gold' }, R.current(c)?.name || '—'))),
        h('button', { class: 'btn icon ghost danger', type: 'button', 'aria-label': 'Eliminar combate', 'data-tip': 'Eliminar este encuentro', onclick: async () => {
          if (!(await confirmDialog(`Se eliminará el combate «${c.name}».`))) return;
          await api.remove('combats', c.id).catch(toastError);
          if (state.settings.activeCombat === c.id) await setActive(null);
          state.combats = state.combats.filter((x) => x !== c);
          select(null);
        } }, icon('trash', 18))),
      h('div', { class: 'row combat-actions' }, actions),
      difficultyBox(c));
  }

  function trackerCard(c) {
    if (!c.combatants.length) return h('div', { class: 'empty' }, icon('personajes'), h('p', {}, 'Sin participantes todavía.'));
    return h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', {}, icon('list'), 'Orden de iniciativa'),
        h('div', { class: 'actions' }, h('span', { class: 'tiny muted' }, 'Ataques con'),
          segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.mode, (v) => { state.mode = v; }))),
      h('ol', { class: 'tracker' }, c.combatants.map((x, i) => combatantRow(c, x, i))));
  }

  function combatantRow(c, x, i) {
    const isTurn = c.status === 'active' && i === c.turn;
    const down = x.hp <= 0;
    const row = h('li', { class: `cbt ${x.type} ${isTurn ? 'current' : ''} ${down ? 'down' : ''} ${x.hidden ? 'is-hidden' : ''}` });
    const amount = h('input', { type: 'number', min: 0, class: 'inline amt', placeholder: 'PG', 'aria-label': `Cantidad para ${x.name}` });
    const apply = (kind) => () => {
      const v = Number(amount.value);
      if (!v) return amount.focus();
      if (kind === 'dmg') R.damage(c, x, v); else if (kind === 'heal') R.heal(c, x, v); else { x.tempHp = Math.max(x.tempHp || 0, v); sfx.shield(); }
      sync(x);
      floatNum(row.querySelector('.token'), kind === 'dmg' ? `−${v}` : `+${v}`, kind === 'dmg' ? 'dmg' : kind === 'heal' ? 'heal' : 'temp');
      save(c);
      setTimeout(render, 380);
    };
    amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(e.shiftKey ? 'heal' : 'dmg')(); });

    const condAdd = selectEl([['', '+ Estado'], ...ref.conditions.map((k) => [k.name, condLabel(k.name)])], '', async (name) => {
      if (!name) return;
      const rounds = await modal(`${condLabel(name)}`, h('p', { class: 'muted' }, '¿Durante cuántos turnos de esta criatura?'),
        [{ label: 'Indefinido', value: 0 }, { label: '1 turno', value: 1 }, { label: '3 turnos', value: 3 }, { label: '1 minuto (10)', value: 10, class: 'primary' }], { iconName: 'hourglass' });
      if (rounds == null) return;
      x.conditions.push({ name, rounds: rounds || null });
      sfx.magic();
      if (name === 'Concentrado') x.concentration = true;
      R.log(c, `${x.name} queda ${name.toLowerCase()}${rounds ? ` (${rounds} turnos)` : ''}.`);
      commit();
    }, { class: 'cond-add', 'aria-label': 'Añadir estado' });

    const initBox = h('label', { class: 'init-badge', 'data-tip': 'Iniciativa' }, bind(x, 'init', { type: 'number', 'aria-label': 'Iniciativa', onCommit: () => { R.sortInitiative(c); commit(); } }));

    append(row, [
      isTurn && h('span', { class: 'turn-arrow', 'aria-hidden': 'true' }, '▶'),
      initBox,
      token(x, { size: 58 }),
      h('div', { class: 'cbt-main' },
        h('div', { class: 'row cbt-title' },
          h('b', { class: 'cbt-name' }, x.name), h('span', { class: `chip ${x.type}` }, icon(TYPE_ICON[x.type], 12), TYPE_LABEL[x.type].split(' ')[0]),
          x.cr && x.type === 'enemigo' && h('span', { class: 'tiny muted' }, `VD ${x.cr}`),
          x.concentration && h('span', { class: 'chip conc', 'data-tip': 'Concentrado: al recibir daño, salvación de CON' }, icon('aura', 13), 'Concentración'),
          x.conditions.map((k, j) => h('span', { class: 'chip cond', 'data-tip': ref.conditions.find((r) => r.name === k.name)?.text || '' },
            condLabel(k.name), k.rounds ? h('span', { class: 'count' }, k.rounds) : '',
            h('button', { type: 'button', 'aria-label': `Quitar ${k.name}`, onclick: () => {
              x.conditions.splice(j, 1);
              if (k.name === 'Concentrado') x.concentration = false;
              commit();
            } }, '✕'))),
          condAdd),
        h('div', { class: 'cbt-hp' },
          h('span', { class: 'tnum hp-num' }, h('b', {}, x.hp), ` / ${x.maxHp}`, x.tempHp ? h('span', { class: 'temp' }, ` +${x.tempHp}`) : ''),
          hpBar(x.hp, x.maxHp, x.tempHp),
          h('div', { class: 'row nowrap hp-ctl' }, amount,
            h('button', { class: 'btn xs danger', type: 'button', onclick: apply('dmg'), 'data-tip': 'Daño (Intro)' }, icon('sword', 13)),
            h('button', { class: 'btn xs success', type: 'button', onclick: apply('heal'), 'data-tip': 'Curar (Mayús + Intro)' }, icon('heart', 13)),
            h('button', { class: 'btn xs', type: 'button', onclick: apply('temp'), 'data-tip': 'PG temporales' }, icon('shield', 13)))),
        x.type === 'jugador' && down && deathSaveRow(c, x),
        x.attacks?.length > 0 && h('div', { class: 'row cbt-attacks' }, x.attacks.map((a) => h('span', { class: 'attack' },
          h('button', { class: 'btn xs', type: 'button', onclick: () => roll(`1d20${fmtMod(Number(a.bonus) || 0)}`, { label: `${x.name}: ${a.name}`, who: x.name, mode: state.mode, secret: x.hidden, color: x.color }) },
            icon('dados', 12), `${a.name} ${fmtMod(Number(a.bonus) || 0)}`),
          a.damage && a.damage !== '0' && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => roll(a.damage, { label: `${x.name}: daño de ${a.name}`, who: x.name, secret: x.hidden, color: x.color }) }, a.damage),
          a.damage && a.damage !== '0' && h('button', { class: 'btn xs ghost', type: 'button', 'data-tip': 'Crítico', onclick: () => roll(critExpr(a.damage), { label: `${x.name}: crítico con ${a.name}`, who: x.name, secret: x.hidden, color: x.color }) }, '×2'))))),
      h('div', { class: 'cbt-side' },
        shield(x.ac),
        h('div', { class: 'cbt-tools' },
          h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': x.concentration ? 'Quitar concentración' : 'Marcar concentración', 'aria-pressed': String(!!x.concentration),
            onclick: () => { x.concentration = !x.concentration; commit(); } }, icon('aura', 15)),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': x.hidden ? 'Oculto a los jugadores' : 'Visible para los jugadores', 'aria-pressed': String(!!x.hidden),
            onclick: () => { x.hidden = !x.hidden; commit(); } }, icon(x.hidden ? 'eyeOff' : 'eye', 15)),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar a ${x.name}`, 'data-tip': 'Quitar del combate', onclick: () => {
            const cur = R.current(c)?.cid;
            c.combatants.splice(i, 1);
            c.turn = Math.max(0, c.combatants.findIndex((y) => y.cid === cur));
            R.log(c, `${x.name} sale del combate.`);
            commit();
          } }, icon('close', 15)))),
    ]);
    return row;
  }

  function deathSaveRow(c, x) {
    const ds = x.deathSaves;
    const bubbles = (n, cls) => [0, 1, 2].map((i) => h('span', { class: `bubble ${cls} ${n > i ? 'on' : ''}` }));
    return h('div', { class: 'row death-line' }, icon('skull', 15), h('b', { class: 'small' }, 'Salvaciones de muerte'),
      h('span', { class: 'row nowrap', 'data-tip': 'Éxitos' }, bubbles(ds.ok, 'ok')), h('span', { class: 'row nowrap', 'data-tip': 'Fallos' }, bubbles(ds.ko, 'ko')),
      h('button', { class: 'btn xs', type: 'button', onclick: async () => { if (await R.deathSave(c, x)) { sync(x); commit(); } } }, icon('dados', 12), 'Tirar'),
      h('button', { class: 'btn xs', type: 'button', onclick: () => { ds.ok = 3; R.log(c, `${x.name} es estabilizado.`); sync(x); commit(); } }, 'Estabilizar'));
  }

  function logCard(c) {
    const note = { text: '' };
    const input = bind(note, 'text', { placeholder: 'Añadir una nota al registro…', class: 'grow' });
    const add = () => { if (!note.text.trim()) return; R.log(c, note.text.trim()); commit(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return h('div', { class: 'panel parchment log-card' },
      h('div', { class: 'panel-head' }, h('h3', {}, icon('scroll'), 'Crónica del combate')),
      h('div', { class: 'row nowrap' }, input, h('button', { class: 'btn sm', type: 'button', onclick: add }, icon('feather', 14), 'Anotar')),
      c.log.length ? h('ul', { class: 'log' }, c.log.slice(0, 100).map((e) => h('li', { class: e.text.startsWith('—') ? 'round-line' : '' },
        e.round ? h('span', { class: 'log-round' }, `R${e.round}`) : null, h('span', {}, e.text))))
        : h('p', { class: 'muted small' }, 'Aquí quedará escrito todo lo que pase.'));
  }

  render();
  return () => save.pending && save.flush();
}
