// Combate: preparar encuentros, tablero con cuadrícula, iniciativa, turnos, PG, estados, daño en área y registro.
// Las reglas viven en core/combat.js y el tablero en core/battlemap.js para compartirlos con la Mesa.
import { api, debounced } from '../core/api.js';
import {
  h, clear, append, icon, bigBanner, bind, field, selectEl, segmented, hpBar, token, shield, modal, confirmDialog, toast, toastError, fmtDate, floatNum,
} from '../core/dom.js';
import {
  TYPE_LABEL, TYPE_ICON, condLabel, reference, monsters, fmtMod, combatantFrom, fromMonster, critExpr,
} from '../core/dnd.js';
import * as R from '../core/combat.js';
import { createBattleMap, sceneThumb, fmtMeters, SIZES } from '../core/battlemap.js';
import { loadScenes, findScene, ensureBoard, boardTokens, autoPlace, placeNear, speedOf } from '../core/board.js';
import { sfx } from '../core/sfx.js';
import { roll } from '../core/dice.js';

export default { id: 'combate', title: 'Combate', icon: 'combate', hint: 'Encuentros, tablero, iniciativa y turnos · tecla 2', mount };

async function mount(root, [selId]) {
  const [ref, combats, chars, bestiary, settings, scenes] = await Promise.all([
    reference(), api.list('combats'), api.list('characters'), monsters(), api.settings(), loadScenes(),
  ]);
  combats.forEach((c) => c.combatants.forEach((x) => { const ch = chars.find((y) => y.id === x.charId); if (ch) x.look = ch.look; })); // aspecto al día
  const state = { combats, chars, settings, sel: combats.find((c) => c.id === (selId || settings.activeCombat)) || null, mode: '' };
  if (!state.sel && combats.length) state.sel = combats.find((c) => c.status === 'active') || combats.find((c) => c.status === 'planned') || null;
  const allConds = [...ref.conditions, ...ref.trackers];

  const side = h('aside', { class: 'panel sticky combat-side' });
  // huecos fijos: así el tablero no se vuelve a crear (ni sale de pantalla completa) al actualizar
  const slot = () => h('div', { class: 'view-slot' });
  const slots = { head: slot(), add: slot(), tracker: slot(), log: slot() };
  const boardPanel = h('section', { class: 'panel board-card' });
  const main = h('section', { class: 'stack combat-main' }, slots.head, slots.add, boardPanel, slots.tracker, slots.log);
  root.append(h('div', { class: 'split' }, side, main));

  const save = debounced(async (c) => {
    try { c.updated = (await api.update('combats', c)).updated; } catch (e) { toastError(e); }
  }, 300);
  const commit = () => { save(state.sel); render(); };
  const sync = (x) => R.syncCharacter(state.chars, x);
  const charOf = (x) => state.chars.find((ch) => ch.id === x.charId);
  const sceneOf = (c) => findScene(c?.board?.scene, scenes);

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
          h('div', { class: 'tiny muted' }, `${c.combatants.length} participantes · ${c.status === 'planned' ? 'preparado' : c.status === 'active' ? `ronda ${c.round}` : 'terminado'}${sceneOf(c) ? ` · ${sceneOf(c).name}` : ''} · ${fmtDate(c.updated)}`)))))
        : h('p', { class: 'muted small' }, 'Aún no hay encuentros.'));
  }

  function select(c) {
    if (save.pending) save.flush();
    state.sel = c;
    hideTokenPop();
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
    const scene = sceneOf(c);
    if (scene) autoPlace(c, scene, scenes.cat);
    await R.rollInitiative(c, true);
    setTimeout(() => { sfx.sword(); bigBanner('¡A las armas!', c.name, 'red', 'combate'); }, 750);
    c.status = 'active';
    c.round = 1;
    c.turn = 0;
    if (c.board) c.board.moved = {};
    R.log(c, `¡Comienza el combate! Turno de ${R.current(c).name}.`);
    await setActive(c.id);
    commit();
    toast(h('div', {}, h('b', {}, '¡Tirad iniciativa!'), h('div', { class: 'small muted' }, c.combatants.map((x) => `${x.name} ${x.init}`).join(' · '))), { iconName: 'bolt', ms: 6000 });
  }

  function step(c, dir) {
    R.step(c, dir);
    commit();
    main.querySelector('.cbt.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (document.fullscreenElement === boardPanel && bm) bm.centerOn(R.current(c)?.cid);
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
    const scene = sceneOf(c);
    if (scene) autoPlace(c, scene, scenes.cat, [x.cid]);
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

  function removeCombatant(c, i) {
    const x = c.combatants[i];
    const cur = R.current(c)?.cid;
    c.combatants.splice(i, 1);
    c.turn = Math.max(0, c.combatants.findIndex((y) => y.cid === cur));
    if (c.board) delete c.board.pos[x.cid];
    R.log(c, `${x.name} sale del combate.`);
    commit();
  }

  // ------------------------------------------------------ añadir participantes
  function addPanel(c) {
    const groups = ['jugador', 'pnj', 'enemigo'].map((t) => [t, state.chars.filter((ch) => ch.type === t)]);
    const charSel = h('select', { 'aria-label': 'Personaje' }, groups.filter(([, l]) => l.length).map(([t, l]) =>
      h('optgroup', { label: TYPE_LABEL[t] }, l.map((ch) => h('option', { value: ch.id }, ch.name)))));
    const qty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline mini', 'aria-label': 'Cantidad' });
    const crNum = (cr) => { const [a, b] = String(cr).split('/'); return b ? Number(a) / Number(b) : Number(a); };
    const tiers = [['VD 0 – 1', 0, 1], ['VD 2 – 4', 2, 4], ['VD 5 – 10', 5, 10], ['VD 11 – 16', 11, 16], ['VD 17 o más', 17, 99]];
    const monSel = h('select', { 'aria-label': 'Monstruo' }, tiers.map(([label, lo, hi]) => h('optgroup', { label },
      bestiary.map((m, i) => [m, i]).filter(([m]) => crNum(m.cr) >= lo && crNum(m.cr) <= hi)
        .map(([m, i]) => h('option', { value: i }, `${m.name} · VD ${m.cr}${m.size && !m.size.startsWith('Mediano') ? ` · ${m.size}` : ''}`)))));
    const monQty = h('input', { type: 'number', min: 1, max: 20, value: 1, class: 'inline mini', 'aria-label': 'Cantidad' });
    const quick = { name: '', hp: 10, ac: 12, initBonus: 0, size: 'Mediano' };
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
          h('div', { class: 'row nowrap' },
            field('Tamaño', selectEl(SIZES, quick.size, (v) => { quick.size = v; })),
            h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-end' }, onclick: async () => {
              if (!quick.name.trim()) return toast('Ponle un nombre.');
              await addCombatant(c, combatantFrom({ name: quick.name.trim(), type: 'enemigo', hp: quick.hp, maxHp: quick.hp, ac: quick.ac, initBonus: quick.initBonus, size: quick.size }));
              commit();
            } }, icon('plus', 15), 'Añadir')))));
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
      const b = r.budget;
      const xp = r.xp;
      // cuatro tramos: por debajo de bajo, bajo-moderado, moderado-alto y por encima de alto
      const seg = (a, z, off) => off + Math.min(1, Math.max(0, (xp - a) / Math.max(1, z - a))) * 25;
      const pos = xp < b.bajo ? seg(0, b.bajo, 0) : xp < b.moderado ? seg(b.bajo, b.moderado, 25) : xp < b.alto ? seg(b.moderado, b.alto, 50) : seg(b.alto, b.alto * 1.5, 75);
      const word = r.over_high ? 'mortal' : r.difficulty;
      const fmt = (n) => n.toLocaleString('es-ES');
      clear(box,
        h('div', { class: 'row between' }, h('span', { class: `diff-word d-${word}` }, r.over_high ? 'Por encima de alto' : word),
          h('span', { class: 'small muted' }, `${fmt(xp)} PX de monstruos · presupuesto bajo ${fmt(b.bajo)} · moderado ${fmt(b.moderado)} · alto ${fmt(b.alto)}`)),
        h('div', { class: 'meter' }, h('span'), h('span'), h('span'), h('span'), h('i', { style: { left: `calc(${pos}% - 2px)` } })),
        h('div', { class: 'meter-labels' }, ['Trivial', 'Bajo', 'Moderado', 'Alto'].map((l) => h('span', {}, l))),
        r.over_high && h('p', { class: 'tiny bad-text', style: { margin: 0 } }, 'Supera el presupuesto alto: puede ser letal para el grupo.'));
    }).catch(() => clear(box));
    return box;
  }

  async function areaDialog(c, preselect = null) {
    if (await R.areaDialog(c, { chars: state.chars, preselect })) commit();
  }

  // ------------------------------------------------------------------ tablero
  const boardHead = h('div', { class: 'panel-head' });
  const boardTools = h('div', { class: 'board-tools' });
  const stage = h('div', { class: 'board-stage' });
  const bench = h('div', { class: 'bench' });
  const boardOff = h('div', { class: 'board-off' });
  const popEl = h('div', { class: 'tk-pop board-pop', hidden: true });
  boardPanel.append(boardHead, boardTools, stage, bench, boardOff, popEl);
  const thumbs = new Map();
  let bm = null;
  let pickerFor = null;

  function ensureBm() {
    if (bm) return bm;
    bm = createBattleMap({
      catalog: scenes.cat, dm: true,
      onMove: (cid, col, row, meters, jump) => {
        const c = state.sel;
        const b = ensureBoard(c);
        b.pos[cid] = [col, row];
        if (c.status === 'active' && R.current(c)?.cid === cid && !jump) b.moved[cid] = (b.moved[cid] || 0) + meters;
        hideTokenPop();
        save(c);
        refreshBoard();
      },
      onTokenClick: (cid, tel) => showTokenPop(cid, tel),
      onTokenDbl: (cid) => { const ch = charOf(state.sel.combatants.find((x) => x.cid === cid) || {}); if (ch) location.hash = `#/personajes/${ch.id}`; },
      onTokenContext: (cid) => takeOffBoard(cid),
      onArea: (cids) => areaDialog(state.sel, cids),
      onDropToken: (data, col, row) => {
        const c = state.sel;
        const x = c.combatants.find((y) => y.cid === data.cid);
        if (!x) return;
        placeNear(c, sceneOf(c), scenes.cat, x, col, row);
        save(c);
        refreshBoard();
        drawBench(c);
      },
      onBackgroundClick: hideTokenPop,
      onFog: (f) => { const c = state.sel; ensureBoard(c).fog = f; save(c); },
    });
    stage.append(bm.el);
    return bm;
  }
  const refreshBoard = () => { if (bm && state.sel && sceneOf(state.sel)) { bm.setTokens(boardTokens(state.sel)); bm.setFog(state.sel.board?.fog); } };

  function takeOffBoard(cid) {
    const c = state.sel;
    if (!c.board?.pos[cid]) return;
    delete c.board.pos[cid];
    hideTokenPop();
    save(c);
    refreshBoard();
    drawBench(c);
  }

  async function setScene(c, id) {
    ensureBoard(c);
    const changed = c.board.scene !== id;
    c.board.scene = id || null;
    if (changed) { c.board.pos = {}; c.board.moved = {}; c.board.fog = null; }
    const scene = sceneOf(c);
    if (scene) {
      autoPlace(c, scene, scenes.cat);
      sfx.unroll();
      toast(`Tablero: ${scene.name}`, { iconName: 'grid' });
    }
    commit();
  }

  async function customize(c) {
    const scene = sceneOf(c);
    if (!scene) return;
    if (!scene.preset) { location.hash = `#/escenarios/${scene.id}`; return; }
    try {
      const { id, preset, created, updated, ...rest } = structuredClone(scene);
      const copy = await api.create('scenes', { ...rest, name: `${scene.name} (mi versión)`, from: id });
      scenes.custom.push(copy);
      c.board.scene = copy.id;
      save.flush?.();
      await api.update('combats', c);
      location.hash = `#/escenarios/${copy.id}`;
    } catch (e) { toastError(e); }
  }

  function sceneOptions(value) {
    return h('select', { class: 'scene-select', 'aria-label': 'Escenario del tablero', onchange: (e) => setScene(state.sel, e.target.value) },
      h('option', { value: '', selected: !value }, '— Sin tablero —'),
      h('optgroup', { label: 'Prediseñados' }, scenes.cat.presets.map((s) => h('option', { value: s.id, selected: s.id === value }, s.name))),
      scenes.custom.length > 0 && h('optgroup', { label: 'Tus escenarios' }, scenes.custom.map((s) => h('option', { value: s.id, selected: s.id === value }, s.name))));
  }

  function thumb(s) {
    const key = `${s.id}:${s.updated || ''}`;
    if (!thumbs.has(key)) thumbs.set(key, sceneThumb(s, scenes.cat, 260, 120));
    return thumbs.get(key);
  }

  function drawBoardPanel(c) {
    const scene = sceneOf(c);
    boardPanel.classList.toggle('has-scene', !!scene);
    clear(boardHead, h('h3', {}, icon('grid'), 'Tablero de combate'),
      h('div', { class: 'actions' }, scene && h('span', { class: 'tiny muted' }, `${scene.name} · ${scene.cols}×${scene.rows} casillas de 1,5 m`)));
    if (!scene) {
      stage.hidden = true; bench.hidden = true; boardTools.hidden = true; boardOff.hidden = false;
      hideTokenPop();
      if (pickerFor !== c.id) {
        pickerFor = c.id;
        clear(boardOff,
          h('p', { class: 'muted', style: { margin: 0 } }, 'Elige dónde se lucha. Las fichas se colocan solas en las zonas de inicio y luego se arrastran por la cuadrícula.'),
          h('div', { class: 'scene-pick' }, [...scenes.cat.presets, ...scenes.custom].map((s) => h('button', { class: 'scene-mini', type: 'button', 'data-tip': s.description || s.name, onclick: () => setScene(c, s.id) },
            thumb(s), h('b', {}, s.name)))),
          h('a', { class: 'btn sm', href: '#/escenarios' }, icon('edit', 14), 'Crear o editar escenarios'));
      }
      return;
    }
    pickerFor = null;
    stage.hidden = false; bench.hidden = false; boardTools.hidden = false; boardOff.hidden = true;
    ensureBm();
    if (bm.scene !== scene) bm.setScene(scene);
    const cur = c.status === 'active' ? R.current(c) : null;
    const fs = document.fullscreenElement === boardPanel;
    clear(boardTools,
      sceneOptions(scene.id),
      cur && h('div', { class: 'row nowrap board-turn' },
        h('span', { class: 'round-medal' }, h('small', {}, 'Ronda'), h('b', {}, c.round)),
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': 'Turno anterior', onclick: () => step(c, -1) }, icon('prev', 15)),
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => step(c, 1) }, 'Siguiente', icon('next', 15)),
        h('span', { class: 'small' }, 'Turno de ', h('b', { class: 'gold' }, cur.name), ` · ${fmtMeters(speedOf(cur))}${c.board?.moved?.[cur.cid] ? ` (movido ${fmtMeters(c.board.moved[cur.cid])})` : ''}`)),
      h('div', { class: 'row nowrap', style: { marginLeft: 'auto' } },
        h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Coloca a quien no esté en el tablero en las zonas de inicio', onclick: () => {
          const n = autoPlace(c, scene, scenes.cat);
          if (n) { sfx.step(); commit(); } else toast('Todos están ya en el tablero.');
        } }, icon('personajes', 15), 'Colocar'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => areaDialog(c) }, icon('flame', 15), 'Daño en área'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => customize(c), 'data-tip': scene.preset ? 'Haz una copia editable de este escenario' : 'Abrir en el editor' }, icon('edit', 15), scene.preset ? 'Personalizar' : 'Editar'),
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': fs ? 'Salir de pantalla completa' : 'Tablero a pantalla completa', 'data-tip': fs ? 'Salir de pantalla completa' : 'Tablero a pantalla completa',
          onclick: () => (fs ? document.exitFullscreen() : boardPanel.requestFullscreen?.())?.catch(() => {}) }, icon('fullscreen', 16))));
    drawBench(c);
    refreshBoard();
  }

  function drawBench(c) {
    const out = c.combatants.filter((x) => !c.board?.pos?.[x.cid]);
    clear(bench, out.length
      ? [h('span', { class: 'tiny muted' }, icon('hand', 13), ' Fuera del tablero (arrastra o pulsa):'),
        out.map((x) => {
          const item = h('button', { class: `bench-item ${x.type}`, type: 'button', draggable: 'true', onclick: () => { autoPlace(c, sceneOf(c), scenes.cat, [x.cid]); sfx.step(); commit(); } },
            token(x, { size: 26 }), x.name);
          item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-dnd-token', JSON.stringify({ cid: x.cid })); e.dataTransfer.effectAllowed = 'move'; });
          return item;
        })]
      : h('span', { class: 'tiny muted' }, icon('check', 13), ' Todos en el tablero. Arrastra las fichas; clic derecho para retirarlas · Mayús + clic para señalar · R regla · A áreas.'));
  }

  // Tarjeta rápida al pulsar una ficha del tablero (funciona también a pantalla completa).
  function showTokenPop(cid, tel) {
    const c = state.sel;
    const x = c.combatants.find((y) => y.cid === cid);
    if (!x || !tel) return;
    popEl.dataset.cid = cid;
    const amount = h('input', { type: 'number', min: 0, class: 'inline amt', placeholder: 'PG', 'aria-label': `Cantidad para ${x.name}` });
    const apply = (kind) => () => {
      const v = Number(amount.value);
      if (!v) return amount.focus();
      if (kind === 'dmg') R.damage(c, x, v); else if (kind === 'heal') R.heal(c, x, v); else { x.tempHp = Math.max(x.tempHp || 0, v); sfx.shield(); }
      sync(x);
      floatNum(tel, kind === 'dmg' ? `−${v}` : `+${v}`, kind === 'dmg' ? 'dmg' : kind === 'heal' ? 'heal' : 'temp');
      commit();
      showTokenPop(cid, tel);
    };
    amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(e.shiftKey ? 'heal' : 'dmg')(); });
    clear(popEl,
      h('div', { class: 'row nowrap' }, token(x, { size: 42 }),
        h('div', { class: 'grow' }, h('b', {}, x.name), h('div', { class: 'tiny muted' }, `${TYPE_LABEL[x.type]} · ${x.size || 'Mediano'} · ${fmtMeters(speedOf(x))}`)),
        shield(x.ac),
        h('button', { class: 'btn ghost icon xs', type: 'button', 'aria-label': 'Cerrar', onclick: hideTokenPop }, icon('close', 14))),
      h('div', { class: 'tk-hp' }, h('span', { class: 'tnum' }, h('b', {}, x.hp), ` / ${x.maxHp}`, x.tempHp ? h('span', { class: 'temp' }, ` +${x.tempHp}`) : ''), hpBar(x.hp, x.maxHp, x.tempHp)),
      h('div', { class: 'row nowrap' }, amount,
        h('button', { class: 'btn xs danger', type: 'button', onclick: apply('dmg'), 'data-tip': 'Daño (Intro)' }, icon('sword', 13)),
        h('button', { class: 'btn xs success', type: 'button', onclick: apply('heal'), 'data-tip': 'Curar (Mayús + Intro)' }, icon('heart', 13)),
        h('button', { class: 'btn xs', type: 'button', onclick: apply('temp'), 'data-tip': 'PG temporales' }, icon('shield', 13))),
      x.conditions.length > 0 && h('div', { class: 'row' }, x.conditions.map((k) => h('span', { class: 'chip cond' }, condLabel(k.name), k.rounds ? ` (${k.rounds})` : ''))),
      h('div', { class: 'row' },
        x.attacks?.slice(0, 3).map((a) => h('button', { class: 'btn xs', type: 'button', onclick: () => (a.save
          ? roll(a.damage, { label: `${x.name}: ${a.name} (${a.save})`, who: x.name, secret: x.hidden, color: x.color })
          : roll(`1d20${fmtMod((Number(a.bonus) || 0) - 2 * (x.exhaustion || 0))}`, { label: `${x.name}: ${a.name}`, who: x.name, mode: state.mode, secret: x.hidden, color: x.color })) }, icon(a.save ? 'flame' : 'dados', 12), a.name)),
        h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { hideTokenPop(); flashRow(cid); } }, icon('list', 13), 'En la lista'),
        h('button', { class: 'btn xs ghost', type: 'button', onclick: () => takeOffBoard(cid) }, icon('close', 13), 'Retirar')));
    popEl.hidden = false;
    const pr = boardPanel.getBoundingClientRect();
    const tr = tel.getBoundingClientRect();
    popEl.style.left = `${Math.min(pr.width - 160, Math.max(160, tr.left - pr.left + tr.width / 2))}px`;
    popEl.style.top = `${Math.min(pr.height - 60, tr.bottom - pr.top + 8)}px`;
  }
  function hideTokenPop() { popEl.hidden = true; delete popEl.dataset.cid; }

  function flashRow(cid) {
    const row = main.querySelector(`.cbt[data-cid="${cid}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  }

  const onFs = () => { if (state.sel) drawBoardPanel(state.sel); setTimeout(() => bm?.fit(), 120); };
  document.addEventListener('fullscreenchange', onFs);

  // ------------------------------------------------------------------ pintado
  function render() {
    renderSide();
    const c = state.sel;
    if (!c) {
      clear(slots.head, h('div', { class: 'empty' }, icon('combate'), h('h3', {}, 'Organiza un combate'),
        h('p', {}, 'Crea un encuentro, elige un escenario con cuadrícula, añade al grupo, a los personajes de la historia y a los enemigos, tira iniciativa y lleva los turnos.'),
        h('button', { class: 'btn primary', type: 'button', onclick: createCombat }, icon('plus', 16), 'Nuevo encuentro')));
      clear(slots.add); clear(slots.tracker); clear(slots.log);
      boardPanel.hidden = true;
      return;
    }
    boardPanel.hidden = false;
    clear(slots.head, headerCard(c));
    clear(slots.add, c.status !== 'finished' && addPanel(c));
    drawBoardPanel(c);
    clear(slots.tracker, trackerCard(c));
    clear(slots.log, logCard(c));
    if (!popEl.hidden && popEl.dataset.cid) {
      const tel = stage.querySelector(`.bm-token[data-id="${popEl.dataset.cid}"]`);
      if (tel) showTokenPop(popEl.dataset.cid, tel); else hideTokenPop();
    }
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
    const onBoard = !!(sceneOf(c) && c.board?.pos?.[x.cid]);
    const row = h('li', { class: `cbt ${x.type} ${isTurn ? 'current' : ''} ${down ? 'down' : ''} ${x.hidden ? 'is-hidden' : ''}`, dataset: { cid: x.cid } });
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

    const condAdd = selectEl([['', '+ Estado'], ...allConds.map((k) => [k.name, condLabel(k.name)])], '', async (name) => {
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
          x.size && x.size !== 'Mediano' && h('span', { class: 'tiny muted' }, x.size),
          x.concentration && h('span', { class: 'chip conc', 'data-tip': 'Concentrado: al recibir daño, salvación de CON (CD 10 o la mitad del daño, máx. 30)' }, icon('aura', 13), 'Concentración'),
          x.conditions.map((k, j) => h('span', { class: 'chip cond', 'data-tip': allConds.find((r) => r.name === k.name)?.text || '' },
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
        x.attacks?.length > 0 && h('div', { class: 'row cbt-attacks' }, x.attacks.map((a) => h('span', { class: 'attack', 'data-tip': a.notes || null },
          a.save
            ? h('button', { class: 'btn xs', type: 'button', onclick: () => roll(a.damage, { label: `${x.name}: ${a.name} (${a.save})`, who: x.name, secret: x.hidden, color: x.color }) }, icon('flame', 12), `${a.name} · ${a.save} · ${a.damage}`)
            : [h('button', { class: 'btn xs', type: 'button', onclick: () => roll(`1d20${fmtMod((Number(a.bonus) || 0) - 2 * (x.exhaustion || 0))}`, { label: `${x.name}: ${a.name}`, who: x.name, mode: state.mode, secret: x.hidden, color: x.color }) },
              icon('dados', 12), `${a.name} ${fmtMod(Number(a.bonus) || 0)}`),
            a.damage && a.damage !== '0' && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => roll(a.damage, { label: `${x.name}: daño de ${a.name}`, who: x.name, secret: x.hidden, color: x.color }) }, a.damage),
            a.damage && a.damage !== '0' && h('button', { class: 'btn xs ghost', type: 'button', 'data-tip': 'Crítico', onclick: () => roll(critExpr(a.damage), { label: `${x.name}: crítico con ${a.name}`, who: x.name, secret: x.hidden, color: x.color }) }, '×2')])))),
      h('div', { class: 'cbt-side' },
        shield(x.ac),
        h('div', { class: 'cbt-tools' },
          sceneOf(c) && h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': onBoard ? 'Ver en el tablero' : 'Colocar en el tablero', 'aria-pressed': String(onBoard),
            onclick: () => {
              if (!onBoard) { autoPlace(c, sceneOf(c), scenes.cat, [x.cid]); sfx.step(); commit(); }
              boardPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              setTimeout(() => { bm?.centerOn(x.cid); bm?.select(x.cid); }, 250);
            } }, icon('pin', 15)),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': x.concentration ? 'Quitar concentración' : 'Marcar concentración', 'aria-pressed': String(!!x.concentration),
            onclick: () => { x.concentration = !x.concentration; commit(); } }, icon('aura', 15)),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': x.hidden ? 'Oculto a los jugadores' : 'Visible para los jugadores', 'aria-pressed': String(!!x.hidden),
            onclick: () => { x.hidden = !x.hidden; commit(); } }, icon(x.hidden ? 'eyeOff' : 'eye', 15)),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar a ${x.name}`, 'data-tip': 'Quitar del combate', onclick: () => removeCombatant(c, i) }, icon('close', 15)))),
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
  return () => {
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement === boardPanel) document.exitFullscreen().catch(() => {});
    bm?.destroy();
    if (save.pending) save.flush();
  };
}
