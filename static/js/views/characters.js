// Personajes: jugadores, personajes de la historia (PNJ) y enemigos.
// La galería muestra cartas con retrato; la ficha imita una hoja de personaje en pergamino.
import { api, debounced } from '../core/api.js';
import {
  h, clear, icon, bind, field, selectEl, segmented, searchBox, hpBar, shield, modal, confirmDialog,
  toast, toastError, pickFiles, floatNum, prefs, bigBanner, avatar, token,
  SKINS, HAIR_COLORS, EYE_COLORS, BODY_COLORS, HAIRS, EXPRESSIONS, LOOK_SLOTS, LOOK_NAMES, lookPiece, randomLook, hasExtras, isSvgHat,
} from '../core/dom.js';
import {
  TYPES, TYPE_LABEL, TYPE_COLOR, TYPE_ICON, CONDITION_ICON, condLabel, ABILITY_KEYS, ABILITY_SHORT, ABILITY_NAME, CRS, COINS, reference, monsters,
  mod, fmtMod, fmtM, profBonus, initBonus, saveBonus, skillBonus, passivePerception, critExpr, xpProgress, d20, effectiveSpeed, exhaustionPenalty,
  newCharacter, migrateCharacter, fromMonster, applyDamage, applyHealing, longRest, shortRest, combatantFrom,
  classOf, speciesOf, backgroundOf, computeAC, maxHpFor, slotsFor, classResources, featuresUpTo, masteryCount, columnAt, weaponAttack, weaponProficient,
  source, grantResources, derivedAttacks, pendingChoices, featAbilities, castingOf, subclassResourceNames, grantedSpells, spellChoices,
  spellLists, spellCounts, freeUseFor, featGrants, featBonus,
} from '../core/dnd.js';
import { openCreator } from './creator.js';
import { spellTip, spellMeta, spellCard, pickSpells } from './spellui.js';
import { sfx } from '../core/sfx.js';
import { roll } from '../core/dice.js';
import { sortInitiative } from '../core/combat.js';
import { groupCheck, partyScreen } from '../core/party.js';

export default { id: 'personajes', title: 'Personajes', icon: 'personajes', hint: 'Jugadores, personajes de la historia y enemigos · tecla 4', mount };

async function mount(root, [selId]) {
  const [ref, raw] = await Promise.all([reference(), api.list('characters')]);
  const state = {
    chars: raw.map(migrateCharacter), // fichas antiguas reciben los campos nuevos y las unidades de 2024
    filter: prefs.get('chars.filter', 'todos'), search: '', sel: null, attackMode: '',
  };
  state.sel = state.chars.find((c) => c.id === selId) || null;

  const savers = new Map();
  const save = (ch) => {
    if (!savers.has(ch.id)) savers.set(ch.id, debounced(() => api.update('characters', ch).then((d) => { ch.updated = d.updated; }).catch(toastError), 400));
    savers.get(ch.id)();
  };
  const flushAll = () => savers.forEach((s) => s.pending && s.flush());

  function open(c) {
    flushAll();
    state.sel = c;
    history.replaceState(null, '', c ? `#/personajes/${c.id}` : '#/personajes');
    render();
    window.scrollTo({ top: 0 });
  }
  const render = () => (state.sel ? renderSheet() : renderGallery());

  // ================================================================= galería
  const visible = () => state.chars
    .filter((c) => state.filter === 'todos' || c.type === state.filter)
    .filter((c) => !state.search || `${c.name} ${c.race} ${c.cls} ${c.location} ${c.creature}`.toLowerCase().includes(state.search))
    .sort((a, b) => TYPES.findIndex((t) => t[0] === a.type) - TYPES.findIndex((t) => t[0] === b.type) || a.name.localeCompare(b.name));

  function subtitle(c) {
    if (c.type === 'enemigo') return [c.creature || 'Criatura', c.faction].filter(Boolean).join(' · ');
    if (c.type === 'pnj') return [c.race, c.cls, c.location].filter(Boolean).join(' · ') || 'Personaje de la historia';
    return [c.race, [c.cls, c.subclass && `(${c.subclass})`].filter(Boolean).join(' '), c.background].filter(Boolean).join(' · ') || 'Aventurero';
  }

  function renderGallery() {
    const grid = h('div', { class: 'char-grid' });
    const count = (t) => state.chars.filter((c) => t === 'todos' || c.type === t).length;
    const drawGrid = () => {
      const items = visible();
      clear(grid, items.length ? items.map(card) : h('div', { class: 'empty', style: { gridColumn: '1 / -1' } },
        icon('personajes'), h('h3', {}, state.chars.length ? 'Nadie coincide con la búsqueda' : 'Aún no hay personajes'),
        h('p', {}, 'Crea a los jugadores, a los personajes de la historia y a los enemigos. Los enemigos también pueden salir del bestiario.')));
    };
    clear(root,
      h('div', { class: 'panel gallery-head' },
        h('div', { class: 'row' },
          segmented([['todos', 'Todos', count('todos')], ['jugador', 'Jugadores', count('jugador')], ['pnj', 'Historia', count('pnj')], ['enemigo', 'Enemigos', count('enemigo')]],
            state.filter, (v) => { state.filter = v; prefs.set('chars.filter', v); drawGrid(); }),
          h('div', { class: 'grow', style: { maxWidth: '320px' } }, searchBox('Buscar por nombre, raza, lugar…', (v) => { state.search = v.toLowerCase(); drawGrid(); })),
          h('div', { class: 'row', style: { marginLeft: 'auto' } },
            h('button', { class: 'btn primary', type: 'button', onclick: () => openCreator({ onCreate: create }), 'data-tip': 'Paso a paso, según el Manual del Jugador 2024' }, icon('sparkle', 16), 'Crear aventurero'),
            TYPES.map(([t, l]) => h('button', { class: 'btn', type: 'button', onclick: () => create(newCharacter(t)), 'data-tip': t === 'jugador' ? 'Ficha de jugador en blanco' : null },
              icon(TYPE_ICON[t], 16), `+ ${t === 'pnj' ? 'PNJ' : t === 'jugador' ? 'En blanco' : l}`)),
            h('button', { class: 'btn', type: 'button', onclick: bestiaryDialog }, icon('book', 16), 'Bestiario'))),
        h('div', { class: 'row party-actions' }, h('span', { class: 'eyebrow', style: { margin: 0 } }, 'Grupo'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('corto'), 'data-tip': 'Recupera los recursos de descanso corto' }, icon('hourglass', 15), 'Descanso corto'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('largo'), 'data-tip': 'PG al máximo, espacios de conjuro y recursos' }, icon('moon', 15), 'Descanso largo'),
          h('button', { class: 'btn sm', type: 'button', onclick: awardXp }, icon('star', 15), 'Dar experiencia'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => groupCheck(state.chars), 'data-tip': 'Todos tiran la misma habilidad o salvación contra una CD' }, icon('dados', 15), 'Prueba de grupo'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => partyScreen(state.chars), 'data-tip': 'CA, PG, pasivas, CD de conjuros y salvaciones de todos' }, icon('shield', 15), 'Pantalla del máster'))),
      grid);
    drawGrid();
  }

  function card(c) {
    const dressed = !c.portrait || hasExtras(c.look); // con complementos se ve el muñeco; si no, el retrato a todo lo ancho
    const banner = h('div', { class: `cc-banner ${dressed ? 'dressed' : ''}`, style: { '--c': c.color, backgroundImage: dressed ? null : `url("${c.portrait}")` } },
      dressed && avatar(c, 'xl'));
    const el = h('article', { class: `char-card ${c.type} ${c.hp <= 0 ? 'down' : ''}`, tabindex: 0, style: { '--c': c.color },
      onclick: () => open(c), onkeydown: (e) => { if (e.key === 'Enter') open(c); } },
    banner,
    h('span', { class: 'cc-type', 'data-tip': TYPE_LABEL[c.type] }, icon(TYPE_ICON[c.type], 15)),
    h('span', { class: 'cc-level' }, c.type === 'enemigo' ? `VD ${c.cr || '?'}` : `Nv ${c.level || 1}`),
    shield(c.ac),
    h('div', { class: 'cc-body' },
      h('h3', {}, c.name),
      h('div', { class: 'cc-sub' }, subtitle(c)),
      h('div', { class: 'cc-hp' }, hpBar(c.hp, c.maxHp, c.tempHp), h('span', { class: 'tnum' }, h('b', {}, c.hp), `/${c.maxHp}`)),
      h('div', { class: 'cc-stats' },
        h('span', { 'data-tip': 'Iniciativa' }, icon('bolt', 14), fmtMod(initBonus(c))),
        h('span', { 'data-tip': 'Percepción pasiva' }, icon('eye', 14), passivePerception(c)),
        h('span', { 'data-tip': 'Velocidad' }, icon('compass', 14), fmtM(effectiveSpeed(c))),
        c.type === 'pnj' && c.attitude && h('span', { class: `att ${c.attitude}` }, c.attitude)),
      c.conditions.length > 0 && h('div', { class: 'cc-conds' }, c.conditions.map((k) => h('span', { 'data-tip': k }, CONDITION_ICON[k] || '•')))));
    el.addEventListener('mousemove', (e) => { // la carta se inclina hacia el ratón, como al cogerla
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
    return el;
  }

  async function create(doc) {
    try {
      const saved = await api.create('characters', doc);
      state.chars.push(migrateCharacter(saved));
      open(state.chars[state.chars.length - 1]);
      sfx.magic();
      toast(`${saved.name} se une a la campaña.`, { kind: 'good', iconName: TYPE_ICON[saved.type] });
    } catch (e) { toastError(e); }
  }

  async function bestiaryDialog() {
    const all = await monsters();
    const grid = h('div', { class: 'bestiary' });
    let q = '';
    const draw = () => clear(grid, all.filter((m) => `${m.name} ${m.en || ''} ${m.eu || ''} ${m.source || ''} ${m.creature}`.toLowerCase().includes(q)).map((m) => h('button', {
      class: `beast ${m.source ? 'homebrew' : ''}`, type: 'button', onclick: () => { grid.closest('.modal-back').remove(); create(fromMonster(m)); },
    }, h('span', { class: 'beast-cr' }, `VD ${m.cr}`), h('b', {}, m.name), h('span', { class: 'tiny muted' }, m.source ? `${m.creature} · Euskal Herria` : m.creature),
    h('span', { class: 'beast-stats' }, h('span', {}, icon('shield', 13), m.ac), h('span', {}, icon('heart', 13), m.hp), h('span', {}, icon('sword', 13), m.attacks.length)))));
    draw();
    modal('Bestiario', h('div', { class: 'stack' },
      searchBox('Buscar por nombre o tipo (dragón, no muerto, vasca…)', (v) => { q = v.toLowerCase(); draw(); }),
      grid, h('p', { class: 'tiny muted' }, `${all.filter((m) => !m.source).length} criaturas del SRD 5.2.1 de Wizards of the Coast (CC-BY-4.0), traducidas al castellano, y ${all.filter((m) => m.source).length} de la mitología de Euskal Herria (propias de esta app, equilibradas con la Guía del DM; busca «vasca»). Al elegir una se crea una ficha de enemigo que puedes editar.`)),
    [], { wide: true, iconName: 'book' });
  }

  async function saveAll(chars) {
    await Promise.all(chars.map((c) => api.update('characters', c).catch(toastError)));
    render();
  }

  async function partyRest(kind) {
    const party = state.chars.filter((c) => c.type === 'jugador');
    if (!party.length) return toast('No hay jugadores todavía.');
    const charges = party.flatMap((c) => (kind === 'largo' ? longRest(c) : shortRest(c)) || []);
    if (kind === 'largo') sfx.heal(); else sfx.page();
    await saveAll(party);
    toast(h('div', {}, kind === 'largo' ? 'Descanso largo: PG, espacios de conjuro y recursos recuperados.' : 'Descanso corto: recursos recuperados. Cada uno puede gastar dados de golpe en su ficha.',
      charges.length > 0 && h('div', { class: 'small' }, `Al amanecer: ${charges.join(' · ')}`)),
    { kind: 'good', iconName: kind === 'largo' ? 'moon' : 'hourglass', ms: charges.length ? 8000 : 3800 });
  }

  async function awardXp() {
    const party = state.chars.filter((c) => c.type === 'jugador');
    if (!party.length) return toast('No hay jugadores todavía.');
    const amount = h('input', { type: 'number', min: 0, value: 100 });
    const split = h('input', { type: 'checkbox', checked: true });
    const ok = await modal('Dar experiencia', h('div', { class: 'stack' },
      field('PX', amount), h('label', { class: 'check' }, split, `Repartir entre los ${party.length} jugadores`)),
    [{ label: 'Cancelar', value: null }, { label: 'Dar PX', value: true, class: 'primary', icon: 'star' }], { iconName: 'star' });
    if (!ok) return;
    const each = split.checked ? Math.floor(Number(amount.value) / party.length) : Number(amount.value);
    party.forEach((c) => {
      c.xp = (c.xp || 0) + each;
      const { level } = xpProgress(c.xp, ref.level_xp);
      if (level > (c.level || 1)) toast(`¡${c.name} puede subir a nivel ${level}!`, { ms: 7000, iconName: 'sparkle', kind: 'good' });
    });
    await saveAll(party);
    sfx.coins();
    if (party.some((c) => xpProgress(c.xp, ref.level_xp).level > (c.level || 1))) setTimeout(() => sfx.levelup(), 500);
    toast(`${each} PX para cada jugador.`, { kind: 'good', iconName: 'star' });
  }

  // =================================================================== ficha
  const num = (obj, key, extra = {}) => bind(obj, key, { type: 'number', class: 'inline', onChange: () => save(state.sel), ...extra });
  const txt = (obj, key, extra = {}) => bind(obj, key, { onChange: () => save(state.sel), ...extra });
  const lastRoll = new Map(); // última tirada de cada ficha, para la inspiración heroica
  const rollAs = (c, expr, label, mode = '') => {
    const first = !lastRoll.has(c.id);
    lastRoll.set(c.id, { expr, label, mode });
    const p = roll(expr, { label: `${c.name}: ${label}`, who: c.name, mode, color: c.color });
    if (first && c.inspiration) p.then(() => { if (state.sel === c && !document.querySelector('.modal-back')) refresh(); }); // aparece «Repetir»
    return p;
  };
  const test = (c, bonus, label, mode = '') => rollAs(c, d20(c, bonus), label, mode); // prueba con d20 (aplica el cansancio)
  const refresh = () => renderSheet();

  function renderSheet() {
    const c = state.sel;
    const list = visible();
    const idx = list.indexOf(c);
    clear(root,
      h('div', { class: 'sheet-toolbar' },
        h('button', { class: 'btn', type: 'button', onclick: () => open(null) }, icon('back', 17), 'Personajes'),
        h('div', { class: 'row nowrap' },
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Anterior', disabled: idx <= 0, onclick: () => open(list[idx - 1]) }, icon('prev', 16)),
          h('span', { class: 'small muted tnum' }, idx >= 0 ? `${idx + 1} / ${list.length}` : ''),
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Siguiente', disabled: idx < 0 || idx >= list.length - 1, onclick: () => open(list[idx + 1]) }, icon('next', 16))),
        h('div', { class: 'row', style: { marginLeft: 'auto' } },
          h('button', { class: 'btn', type: 'button', onclick: () => addToCombat(c) }, icon('combate', 16), 'Al combate'),
          h('button', { class: 'btn', type: 'button', onclick: () => duplicate(c) }, icon('copy', 16), 'Duplicar'),
          h('button', { class: 'btn danger', type: 'button', onclick: () => remove(c) }, icon('trash', 16), 'Eliminar'))),
      h('article', { class: `sheet parchment ${c.type}` },
        headerSection(c),
        pendingBox(c),
        h('div', { class: 'sheet-row1' }, abilitiesCol(c), savesSkillsCol(c), combatCol(c)),
        attacksSection(c),
        h('div', { class: 'sheet-row3' }, spellsSection(c), resourcesSection(c), inventorySection(c)),
        h('div', { class: 'sheet-row4' }, notesSection(c))));
  }

  // Decisiones que el manual pide y aún no están en la ficha (maestrías, pericia, conjuros…)
  function pendingBox(c) {
    const list = c.type === 'jugador' ? pendingChoices(c) : [];
    return list.length > 0 && h('div', { class: 'pending-box' }, icon('sparkle', 15), h('b', {}, 'Por elegir:'),
      list.map((t) => h('span', { class: `chip ${t.startsWith('⚠') ? 'bad' : ''}` }, t)));
  }

  const section = (title, iconName, ...content) => h('section', { class: 'ssec' }, h('h3', { class: 'ssec-title' }, icon(iconName, 17), title), ...content);
  const sbox = (label, content, tip) => h('div', { class: 'sbox', 'data-tip': tip }, content, h('span', { class: 'sbox-label' }, label));

  function headerSection(c) {
    const portrait = h('button', { class: 'portrait', type: 'button', 'data-tip': 'Cambiar el aspecto: cara, sombrero, ropa graciosa…', onclick: () => lookDialog(c) },
      avatar(c, 'xxl'), h('span', { class: 'portrait-edit' }, icon('sparkle', 16)));

    const sp = speciesOf(c);
    const spSel = selectEl([['', '— Especie —'], ...ref.species.map((s) => [s.id, s.name])], sp?.id || '', (v) => setSpecies(c, v), { 'aria-label': 'Especie' });
    const linSel = sp?.options && selectEl([['', `— ${sp.options_label} —`], ...sp.options.map(([n]) => [n, n])], c.lineage, (v) => {
      c.lineage = v;
      if (sp.lineage_speed) c.speed = (sp.lineage_speed[v] ?? sp.speed) + featBonus(c, 'speed');
      syncGrants(c);
      save(c); refresh();
    }, { 'aria-label': sp.options_label });
    let fields;
    if (c.type === 'jugador') {
      const xp = xpProgress(c.xp, ref.level_xp);
      const cls = classOf(c);
      const bg = backgroundOf(c);
      const level = c.level || 1;
      const classSel = selectEl([['', '— Clase —'], ...ref.classes.map((k) => [k.id, k.name])], cls?.id || '', (v) => setClass(c, v), { 'aria-label': 'Clase' });
      const subSel = cls && selectEl([['', level < 3 ? 'Desde el nivel 3' : '— Subclase —'], ...cls.subclasses.map((s) => [s, s])], c.subclass,
        (v) => setSubclass(c, v), { 'aria-label': 'Subclase', disabled: level < 3 && !c.subclass });
      const bgSel = selectEl([['', '— Trasfondo —'], ...ref.backgrounds.map((b) => [b.id, b.name])], bg?.id || '', (v) => setBackground(c, v), { 'aria-label': 'Trasfondo' });
      const alSel = selectEl([['', '—'], ...ref.alignments.map((a) => [a, a])], c.alignment, (v) => { c.alignment = v; save(c); }, { 'aria-label': 'Alineamiento' });
      fields = [field('Jugador/a', txt(c, 'player')),
        field('Especie', spSel), linSel && field(sp.options_label, linSel),
        field('Clase', classSel), subSel && field('Subclase', subSel),
        h('div', { class: 'level-box' }, h('span', { class: 'sbox-label' }, 'Nivel'),
          h('div', { class: 'row nowrap' }, h('b', { class: 'big-num' }, level),
            level < 20 && h('button', { class: `btn xs ${xp.level > level ? 'primary glow' : ''}`, type: 'button', 'data-tip': 'Subir de nivel paso a paso', onclick: () => levelUp(c) }, icon('sparkle', 13), 'Subir'))),
        field('Trasfondo', bgSel), field('Alineamiento', alSel),
        h('div', { class: 'xp-box' },
          h('div', { class: 'row between nowrap' }, h('span', { class: 'sbox-label' }, 'Experiencia'), num(c, 'xp', { min: 0, onCommit: refresh })),
          h('div', { class: 'xp-bar' }, h('i', { style: { width: `${Math.min(1, xp.ratio) * 100}%` } })),
          h('div', { class: 'tiny muted' }, xp.level > level ? `¡Tiene PX para el nivel ${xp.level}!` : xp.next ? `${(xp.next - (c.xp || 0)).toLocaleString('es-ES')} PX para el nivel ${xp.level + 1}` : 'Nivel máximo'))];
    } else if (c.type === 'pnj') {
      fields = [field('Especie', spSel), linSel && field(sp.options_label, linSel), field('Ocupación', txt(c, 'cls')), field('Ubicación', txt(c, 'location')),
        field('Facción', txt(c, 'faction')), field('Actitud', attitudeSel(c)), field('Nivel', num(c, 'level', { min: 1, max: 20, onCommit: refresh }))];
    } else {
      fields = [field('Tipo de criatura', txt(c, 'creature')),
        field('Valor de desafío', selectEl(CRS, c.cr, (v) => { c.cr = v; save(c); refresh(); })),
        field('Experiencia', h('div', { class: 'static-val' }, `${(ref.cr_xp[c.cr] || 0).toLocaleString('es-ES')} PX`)),
        field('Facción', txt(c, 'faction')), field('Actitud', attitudeSel(c)),
        field('Dados de golpe', txt(c, 'hpDice', { placeholder: '2d8+2' }))];
    }
    return h('header', { class: 'sheet-head' }, portrait,
      h('div', { class: 'grow' },
        h('div', { class: 'name-row' },
          bind(c, 'name', { class: 'sheet-name', 'aria-label': 'Nombre', onChange: () => save(c) }),
          selectEl(TYPES, c.type, (v) => { if (Object.values(TYPE_COLOR).includes(c.color)) c.color = TYPE_COLOR[v]; c.type = v; save(c); refresh(); }, { 'aria-label': 'Tipo', class: 'type-sel' }),
          bind(c, 'color', { type: 'color', onChange: () => save(c), 'aria-label': 'Color', title: 'Color de la ficha y de sus dados' })),
        h('div', { class: 'head-fields' }, fields)));
  }

  // ------------------------------------------------- clase, especie y trasfondo del manual
  function setClass(c, id) {
    const cls = ref.classes.find((k) => k.id === id);
    c.classId = id;
    c.cls = cls?.name || '';
    if (cls) {
      if (!cls.subclasses.includes(c.subclass)) c.subclass = '';
      c.hitDie = `d${cls.hit_die}`;
      c.saves = [...cls.saves];
      c.spellAbility = cls.spell_ability || '';
      c.autoSlots = !!cls.caster;
      c.weaponTraining = [...cls.weapon_training];
      c.armorTraining = [...cls.armor_training];
      syncClassData(c);
      toast(h('div', {}, h('b', {}, cls.name), h('div', { class: 'small' }, `${cls.summary} Dado de golpe d${cls.hit_die}. (${source(cls)})`)), { iconName: 'book', ms: 6000 });
    }
    save(c); refresh();
  }

  function setSpecies(c, id) {
    const sp = ref.species.find((s) => s.id === id);
    c.speciesId = id;
    c.race = sp?.name || '';
    c.lineage = '';
    if (sp) {
      c.speed = sp.speed + featBonus(c, 'speed');
      if (!sp.size.includes(c.size)) c.size = sp.size.split(' o ')[0];
      toast(h('div', {}, h('b', {}, sp.name), h('div', { class: 'small' }, `${sp.traits.map(([n]) => n).join(' · ')} (${source(sp)})`)), { iconName: 'book', ms: 6000 });
    }
    syncGrants(c);
    if (c.acMode === 'auto') c.ac = computeAC(c);
    save(c); refresh();
  }

  function setBackground(c, id) {
    const bg = ref.backgrounds.find((b) => b.id === id);
    c.backgroundId = id;
    c.background = bg?.name || '';
    if (bg) {
      bg.skills.forEach((k) => { c.skills[k] = Math.max(1, c.skills[k] || 0); });
      if (!c.feats.includes(bg.feat)) { c.feats.push(bg.feat); featChanged(c, bg.feat, 1); }
      toast(h('div', {}, h('b', {}, bg.name), h('div', { class: 'small' },
        `Dote ${bg.feat} y competencia en ${bg.skills.map((k) => ref.skills.find((s) => s.key === k)?.name).join(' y ')}. Sus características (+2/+1 o +1/+1/+1): ${bg.abilities.map((k) => ABILITY_SHORT[k]).join(', ')}. (MdJ p. ${bg.page})`)),
      { iconName: 'book', ms: 7000 });
    }
    save(c); refresh();
  }

  // Espacios de conjuro (de la clase o de la subclase que lanza conjuros), recursos de clase y subclase y CA para el nivel actual.
  function syncClassData(c) {
    const cls = classOf(c);
    const level = c.level || 1;
    const cast = castingOf(c, cls);
    if (cast?.caster && c.autoSlots) {
      const max = slotsFor(cast, level);
      c.slots = max.map((m, i) => ({ max: m, used: Math.min(c.slots[i]?.used || 0, m) }));
    }
    if (cls) {
      const names = [...(cls.resources || []).map((r) => r.name), ...subclassResourceNames(cls)];
      const auto = classResources(c, cls, level).map((r) => ({ ...r, used: Math.min(c.resources.find((x) => x.name === r.name)?.used || 0, r.max) }));
      c.resources = [...auto, ...c.resources.filter((r) => !names.includes(r.name))];
    }
    syncGrants(c);
    if (c.acMode === 'auto') c.ac = computeAC(c);
  }

  // Recursos de la especie y de las dotes (con los usos gratis de sus conjuros) y ataques que la ficha calcula sola.
  const grantResNames = new Set([...ref.species.flatMap((sp) => (sp.resources || []).map(([n]) => n)),
    ...ref.feats.flatMap((f) => (f.grants?.resources || []).map(([n]) => n))]);
  function syncGrants(c) {
    const fresh = grantResources(c);
    const usedOf = (name) => c.resources.find((x) => x.name === name)?.used || 0;
    c.resources = [...c.resources.filter((r) => !r.grant && !r.species && !grantResNames.has(r.name)), ...fresh.map((r) => ({ ...r, used: Math.min(usedOf(r.name), r.max) }))];
    c.attacks = [...c.attacks.filter((a) => !a.auto), ...derivedAttacks(c)];
    if (grantedSpells(c).length && !c.spellAbility) c.spellAbility = ['int', 'sab', 'car'].reduce((best, k) => (c.abilities[k] > c.abilities[best] ? k : best), 'car');
  }

  // Subclase: si lanza conjuros (Caballero arcano, Embaucador arcano) se ponen sus espacios y su aptitud.
  function applySubclass(c) {
    const sub = classOf(c)?.subclass_casting?.[c.subclass];
    if (sub) { c.autoSlots = true; if (!c.spellAbility) c.spellAbility = sub.spell_ability; }
    syncClassData(c);
  }
  function setSubclass(c, v) {
    c.subclass = v;
    c.subclassOption = '';
    applySubclass(c);
    save(c); refresh();
  }

  // Una dote nueva o quitada: la velocidad y los PG que suma, sus recursos y los conjuros que dejaba elegir.
  function featChanged(c, name, sign) {
    const g = featGrants(name);
    if (g?.speed) c.speed = (Number(c.speed) || 0) + sign * g.speed;
    if (g?.hp) { c.maxHp = (c.maxHp || 0) + sign * g.hp; c.hp = Math.max(0, Math.min(c.maxHp, (c.hp || 0) + sign * g.hp)); }
    if (sign < 0 && c.spellPicks) Object.keys(c.spellPicks).filter((k) => k.startsWith(`${name}#`)).forEach((k) => delete c.spellPicks[k]);
    syncClassData(c);
  }

  // Orden divina u Orden primigenia: cambia el entrenamiento con armas y armaduras.
  function setClassChoice(c, v) {
    const cls = classOf(c);
    const fx = cls.choice.options.find(([n]) => n === v)?.[2] || {};
    c.classChoice = v;
    c.weaponTraining = [...new Set([...cls.weapon_training, ...(fx.weapons || [])])];
    c.armorTraining = [...new Set([...cls.armor_training, ...(fx.armor || [])])];
    if (c.acMode === 'auto') c.ac = computeAC(c);
    save(c); refresh();
  }

  // Subida de nivel guiada: PG (fijos o tirados), rasgos nuevos, subclase y mejora o dote.
  async function levelUp(c) {
    const cls = classOf(c);
    const from = c.level || 1;
    const to = Math.min(20, from + 1);
    const con = mod(c.abilities.con);
    const die = cls?.hit_die || Number(String(c.hitDie || 'd8').replace(/\D/g, '')) || 8;
    const extra = (speciesOf(c)?.hp_per_level || 0) + (c.feats.some((f) => f.startsWith('Duro')) ? 2 : 0);
    const st = { hp: Math.max(1, (ref.hp_fixed[die] ?? Math.floor(die / 2) + 1) + con) + extra, rolled: false, subclass: c.subclass, choice: 'asi', p2: '', p1: '', feat: '', boost: '' };
    const feats = cls?.features[to] || [];
    const subFeats = (sub) => (cls?.subclass_features?.[sub] || []).filter(([l]) => l === to);
    const asi = feats.includes('Mejora de característica');
    const epic = feats.includes('Don épico');
    const needsSub = cls && to >= 3 && !c.subclass;

    const hpOut = h('b', { class: 'big-num' }, `+${st.hp}`);
    const rollBtn = h('button', { class: 'btn sm', type: 'button', onclick: async () => {
      const r = await rollAs(c, `1d${die}${fmtMod(con)}`, `PG al subir a nivel ${to}`);
      if (!r) return;
      st.hp = Math.max(1, r.total) + extra;
      st.rolled = true;
      hpOut.textContent = `+${st.hp}`;
      rollBtn.disabled = true;
    } }, icon('dados', 14), `Tirar 1d${die}${fmtMod(con)}`);

    const changes = [];
    if (profBonus({ ...c, level: to }) > profBonus(c)) changes.push(`Bonificador por competencia ${fmtMod(profBonus({ ...c, level: to }))}`);
    for (const name of Object.keys(cls?.columns || {})) {
      const a = columnAt(cls, name, from); const b = columnAt(cls, name, to);
      if (a !== b && b != null) changes.push(`${name}: ${a ?? '—'} → ${b}`);
    }
    const cast = castingOf(c, cls);
    if (cast?.caster) {
      const a = slotsFor(cast, from); const b = slotsFor(cast, to);
      b.forEach((n, i) => { if (n > a[i]) changes.push(`Espacios de nivel ${i + 1}: ${a[i]} → ${n}`); });
      if (cast.cantrips && cast.cantrips[to - 1] > cast.cantrips[from - 1]) changes.push(`Trucos conocidos: ${cast.cantrips[to - 1]}`);
      if (cast.prepared && cast.prepared[to - 1] > cast.prepared[from - 1]) changes.push(`Conjuros preparados: ${cast.prepared[to - 1]}`);
    }
    const had = new Set(grantedSpells(c).map((g) => g.name));
    const newSpells = grantedSpells({ ...c, level: to }).filter((g) => !had.has(g.name)).map((g) => g.name);
    if (newSpells.length) changes.push(`Siempre preparados: ${newSpells.join(', ')}`);
    if (masteryCount(cls, to) > masteryCount(cls, from)) changes.push(`Maestría con armas: ${masteryCount(cls, to)} armas`);

    const abilSel = (key) => selectEl([['', '—'], ...ABILITY_KEYS.map((k) => [k, `${ABILITY_NAME[k]} (${c.abilities[k]})`])], st[key], (v) => { st[key] = v; }, { 'aria-label': key === 'p2' ? 'Característica +2 o +1' : 'Característica +1' });
    const featPool = ref.feats.filter((f) => (epic ? f.category === 'don épico' : f.category === 'general'));
    const featBox = h('div', { class: 'stack' });
    const drawChoice = () => clear(featBox, st.choice === 'asi'
      ? h('div', { class: 'row' }, field('+1 (o +2 si es la única)', abilSel('p2')), field('+1 a otra (opcional)', abilSel('p1')),
        h('p', { class: 'tiny muted', style: { flexBasis: '100%' } }, 'Mejora de característica: +2 a una o +1 a dos, sin pasar de 20.'))
      : h('div', { class: 'stack' },
        selectEl([['', `— ${epic ? 'Don épico' : 'Dote general'} —`], ...featPool.map((f) => [f.name, `${f.name}${f.prereq ? ` (${f.prereq})` : ''}`])], st.feat, (v) => { st.feat = v; st.boost = ''; drawFeat(); }, { 'aria-label': 'Dote' }),
        h('div', { class: 'feat-boost' }),
        h('p', { class: 'small muted feat-desc' })));
    const drawFeat = () => {
      const f = featPool.find((x) => x.name === st.feat);
      const p = featBox.querySelector('.feat-desc');
      if (p) p.textContent = f ? `${f.summary} (MdJ p. ${f.page})` : '';
      const boosts = featAbilities(f); // las dotes de 2024 también suben +1 una característica
      const box = featBox.querySelector('.feat-boost');
      if (box) clear(box, boosts.length > 0 && field('La dote sube +1', selectEl([['', '—'], ...boosts.map((k) => [k, `${ABILITY_NAME[k]} (${c.abilities[k]})`])], st.boost, (v) => { st.boost = v; }, { 'aria-label': 'Característica +1 de la dote' })));
    };
    drawChoice();

    const body = h('div', { class: 'stack level-up' },
      h('div', { class: 'lu-head' }, h('span', { class: 'lu-from' }, from), icon('arrowRight', 28), h('span', { class: 'lu-to' }, to),
        h('div', {}, h('b', {}, c.name), h('div', { class: 'small muted' }, [c.cls || 'Sin clase', c.subclass].filter(Boolean).join(' · ')))),
      h('div', { class: 'panel' }, h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, icon('heart', 17), ' Puntos de golpe'), hpOut),
        h('div', { class: 'row' }, h('span', { class: 'small muted grow' }, `Valor fijo del manual (${ref.hp_fixed[die] ?? '—'} + CON${extra ? ` + ${extra} de especie o dote` : ''}) o tirar el dado.`), rollBtn)),
      (feats.length || changes.length) && h('div', { class: 'panel' }, h('h3', {}, icon('sparkle', 17), ' Novedades'),
        h('ul', { class: 'lu-list' }, feats.filter((f) => !['Mejora de característica', 'Don épico', 'Rasgo de subclase'].includes(f)).map((f) => h('li', {}, h('b', {}, f), cls.feature_text?.[f] && h('div', { class: 'tiny muted' }, cls.feature_text[f]))),
          subFeats(c.subclass).map(([, n, t]) => h('li', {}, h('b', {}, n), h('span', { class: 'chip tiny-chip' }, c.subclass), h('div', { class: 'tiny muted' }, t))),
          changes.map((t) => h('li', { class: 'small' }, t)))),
      needsSub && h('div', { class: 'panel' }, h('h3', {}, icon('crown', 17), ' Subclase'),
        selectEl([['', '— Elige subclase —'], ...cls.subclasses.map((s) => [s, s])], st.subclass, (v) => { st.subclass = v; }, { 'aria-label': 'Subclase' })),
      (asi || epic) && h('div', { class: 'panel' }, h('h3', {}, icon('star', 17), epic ? ' Don épico o mejora' : ' Mejora de característica o dote'),
        segmented([['asi', 'Mejorar características'], ['feat', epic ? 'Don épico' : 'Dote']], st.choice, (v) => { st.choice = v; drawChoice(); }), featBox),
      !cls && h('p', { class: 'small muted' }, 'Elige una clase del manual en la ficha para ver sus rasgos al subir de nivel.'));

    const ok = await modal(`Subir a nivel ${to}`, body, [{ label: 'Cancelar', value: false }, { label: `¡Nivel ${to}!`, value: true, class: 'primary', icon: 'sparkle' }], { iconName: 'sparkle', wide: true });
    if (!ok) return;
    c.level = to;
    c.maxHp = (c.maxHp || 0) + st.hp;
    c.hp = (c.hp || 0) + st.hp;
    c.hitDiceLeft = (c.hitDiceLeft || 0) + 1;
    c.xp = Math.max(c.xp || 0, ref.level_xp[to - 1]);
    if (needsSub && st.subclass) { c.subclass = st.subclass; applySubclass(c); }
    if ((asi || epic) && st.choice === 'asi' && st.p2) {
      const cap = 20;
      if (st.p1 && st.p1 !== st.p2) { c.abilities[st.p2] = Math.min(cap, c.abilities[st.p2] + 1); c.abilities[st.p1] = Math.min(cap, c.abilities[st.p1] + 1); }
      else c.abilities[st.p2] = Math.min(cap, c.abilities[st.p2] + 2);
    } else if ((asi || epic) && st.choice === 'feat' && st.feat) {
      c.feats.push(st.feat);
      if (st.boost) c.abilities[st.boost] = Math.min(epic ? 30 : 20, c.abilities[st.boost] + 1);
      featChanged(c, st.feat, 1);
    }
    syncClassData(c);
    save(c);
    refresh();
    sfx.levelup();
    bigBanner(`¡Nivel ${to}!`, c.name, 'gold', 'sparkle');
  }

  // ------------------------------------------------------------- aspecto (muñeco)
  async function uploadPortrait(c) {
    const [file] = await pickFiles('image/*');
    if (!file) return;
    try {
      const up = await api.upload(file);
      await api.removeUpload(c.portrait);
      c.portrait = up.url;
      save(c);
    } catch (e) { toastError(e); }
  }

  // Vestir al personaje por pestañas: cara, pelo, ropa, complementos y fondo, con colores libres.
  let lookTab = 'cara';
  async function lookDialog(c) {
    c.look ||= randomLook(false);
    const L = c.look;
    L.base ||= 'cara';
    const preview = h('div', { class: 'look-preview' });
    const panel = h('div', { class: 'look-controls' });
    const set = (key, val) => { L[key] = val; sfx.click(); save(c); draw(); };
    const group = (title, ...content) => h('div', { class: 'look-group' }, h('div', { class: 'eyebrow' }, title), ...content);
    // muestras de color y, al final, un selector para cualquier otro
    const colors = (list, key, fallback) => h('div', { class: 'look-swatches' }, list.map((col) => h('button', {
      type: 'button', class: 'look-sw', style: { background: col }, 'aria-label': col, 'aria-pressed': String(L[key] === col), onclick: () => set(key, col),
    })), h('label', { class: `look-sw custom ${L[key] && !list.includes(L[key]) ? 'on' : ''}`, 'data-tip': 'Cualquier otro color', style: { background: L[key] && !list.includes(L[key]) ? L[key] : null } },
      h('input', { type: 'color', value: L[key] || fallback, 'aria-label': 'Cualquier otro color', onchange: (e) => set(key, e.target.value) })));
    const choice = (key, k, content, tip) => h('button', { type: 'button', class: `look-opt ${typeof content === 'string' && /[a-z]/i.test(content) ? 'txt' : ''}`, 'aria-pressed': String((L[key] || '') === k), 'data-tip': tip || null, onclick: () => set(key, k) }, content);
    const none = (key, tip = 'Nada') => choice(key, '', '∅', tip);
    // miniatura de la cara con ese rasgo cambiado (sin complementos para que se vea bien)
    const mini = (over) => avatar({ color: c.color, look: { ...L, base: 'cara', hat: '', face: '', outfit: '', item: '', ...over } }, 'look-mini');
    const features = (key, list) => h('div', { class: 'look-opts' }, none(key), list.map((k) => choice(key, k, mini({ [key]: k }), LOOK_NAMES[k])));
    // complementos: los de la lista y cualquier emoji que se escriba o se pegue
    const firstEmoji = (v) => [...new Intl.Segmenter().segment(v.trim())][0]?.segment || '';
    const pieces = (slot) => h('div', { class: 'look-opts' }, none(slot),
      LOOK_SLOTS[slot].map((k) => choice(slot, k, slot === 'face' && LOOK_NAMES[k] ? mini({ face: k }) : lookPiece(slot, k, L), LOOK_NAMES[k])),
      h('input', { class: 'look-emoji', maxlength: 16, placeholder: '+😀', 'aria-label': 'Otro emoji', 'data-tip': 'Escribe o pega cualquier emoji',
        value: L[slot] && !LOOK_SLOTS[slot].includes(L[slot]) ? L[slot] : '', onchange: (e) => set(slot, firstEmoji(e.target.value)) }));
    const TABS = {
      cara: () => [
        group('Piel', colors(SKINS, 'skin', '#f1c27d')),
        group('Ojos', colors(EYE_COLORS, 'eyes', '#3a2414')),
        group('Expresión', h('div', { class: 'look-opts' }, EXPRESSIONS.map(([k, l]) => choice('expr', k, mini({ expr: k }), l)))),
        group('Orejas', features('ears', LOOK_SLOTS.ears)),
        group('Marcas', features('marks', LOOK_SLOTS.marks)),
        group('Cuernos', features('horns', LOOK_SLOTS.horns))],
      pelo: () => [
        group('Peinado', h('div', { class: 'look-opts' }, HAIRS.map(([k, l]) => choice('hair', k, mini({ hair: k }), l)))),
        group('Color del pelo', colors(HAIR_COLORS, 'hairColor', '#2b1d14')),
        group('Barba y bigote (del color del pelo)', features('beard', LOOK_SLOTS.beard))],
      ropa: () => [
        group('Ropa', features('body', LOOK_SLOTS.body)),
        L.body && group('Color de la ropa', colors(BODY_COLORS, 'bodyColor', '#7b5a34')),
        group('Encima', pieces('outfit'))],
      complementos: () => [
        group('En la cabeza', pieces('hat')),
        isSvgHat(L.hat) && group('Color del sombrero', h('div', { class: 'row' }, colors(['#4b3aa8', '#2b2433', '#1f2433', '#c0392b', '#2f8f4e', '#f2c14e', '#ff5fa2', '#ffffff'], 'hatColor', '#4b3aa8'),
          L.hatColor && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => set('hatColor', '') }, 'Original'))),
        group('En la cara', pieces('face')),
        group('En la mano', pieces('item'))],
      fondo: () => [
        group('Fondo del retrato', h('div', { class: 'row' }, colors(['#1d2b3a', '#2f4f3a', '#4a2c2c', '#3b2e4f', '#6b5530', '#f4ecd8', '#87b6d6', '#c9a0dc'], 'bg', '#1d2b3a'),
          h('button', { class: 'btn xs ghost', type: 'button', 'aria-pressed': String(!L.bg), onclick: () => set('bg', '') }, 'El color del personaje')))],
    };
    function draw() {
      clear(preview, token(c, { size: 170, showHp: false, live: false }), h('b', {}, c.name),
        h('div', { class: 'row center' },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => { Object.assign(L, randomLook(), { base: L.base, bg: L.bg }); sfx.magic(); save(c); draw(); } }, '🎲 Todo al azar'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => {
            const r = randomLook(false);
            Object.assign(L, { skin: r.skin, hair: r.hair, hairColor: r.hairColor, eyes: r.eyes, expr: r.expr, ears: r.ears }); sfx.magic(); save(c); draw();
          } }, '🎲 Solo la cara'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => { Object.assign(L, { hat: '', hatColor: '', face: '', outfit: '', item: '' }); save(c); draw(); } }, icon('close', 14), 'Sin complementos')));
      const face = L.base === 'cara' && !c.portrait;
      clear(panel,
        group('Estilo', h('div', { class: 'row' },
          segmented([['cara', '🙂 Cara'], ['iniciales', 'Aa Iniciales']], L.base, (v) => set('base', v)),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => { await uploadPortrait(c); draw(); } }, icon('image', 14), c.portrait ? 'Cambiar retrato' : 'Usar una imagen'),
          c.portrait && h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => { await api.removeUpload(c.portrait).catch(() => {}); c.portrait = ''; save(c); draw(); } }, icon('trash', 14), 'Quitar imagen'))),
        segmented([['cara', 'Cara'], ['pelo', 'Pelo'], ['ropa', 'Ropa'], ['complementos', 'Complementos'], ['fondo', 'Fondo']], lookTab, (v) => { lookTab = v; draw(); }),
        !face && lookTab !== 'complementos' && h('p', { class: 'small muted' }, c.portrait ? 'Con una imagen solo se ven los complementos. Quita la imagen para dibujar la cara.' : 'Elige «Cara» en el estilo para dibujarla.'),
        TABS[lookTab]());
    }
    draw();
    await modal(`Aspecto de ${c.name}`, h('div', { class: 'look-editor' }, preview, panel), [{ label: 'Listo', value: true, class: 'primary', icon: 'check' }], { wide: true, iconName: 'sparkle' });
    refresh();
  }

  function attitudeSel(c) {
    return selectEl([['amistoso', '😊 Amistoso'], ['neutral', '😐 Neutral'], ['hostil', '😠 Hostil']], c.attitude, (v) => { c.attitude = v; save(c); });
  }

  function abilitiesCol(c) {
    return h('div', { class: 'abil-col' }, ABILITY_KEYS.map((k) => {
      const name = ref.abilities.find((a) => a.key === k).name;
      return h('div', { class: 'abil' },
        h('span', { class: 'abil-name' }, name),
        h('button', { class: 'abil-mod', type: 'button', 'data-tip': `Prueba de ${name}`, onclick: () => test(c, mod(c.abilities[k]), `Prueba de ${name}`, state.attackMode) }, fmtMod(mod(c.abilities[k]))),
        bind(c.abilities, k, { type: 'number', class: 'abil-score', min: 1, max: 30, onChange: () => save(c), onCommit: refresh, 'aria-label': `Puntuación de ${name}` }));
    }));
  }

  function profRow(active, marks, onToggle, bonus, label, onRoll, extra) {
    return h('li', { class: 'prof-row' },
      h('button', { class: `prof-dot lvl${active}`, type: 'button', 'aria-label': 'Cambiar competencia', onclick: onToggle }, marks[active]),
      h('b', { class: 'prof-bonus tnum' }, fmtMod(bonus)),
      h('button', { class: 'prof-name', type: 'button', onclick: onRoll }, label, extra && h('span', { class: 'prof-ab' }, extra)));
  }

  function savesSkillsCol(c) {
    const marks = ['', '●', '◆'];
    return h('div', { class: 'skills-col' },
      h('div', { class: 'inline-boxes' },
        sbox('Competencia', h('b', { class: 'big-num' }, fmtMod(profBonus(c))), 'Bonificador por competencia'),
        h('div', { class: 'insp-wrap' },
          h('button', { class: `inspiration ${c.inspiration ? 'on' : ''}`, type: 'button', 'data-tip': 'Inspiración heroica: gástala para repetir un dado justo después de tirarlo', onclick: () => { c.inspiration = !c.inspiration; save(c); refresh(); } },
            icon('star', 26), h('span', { class: 'sbox-label' }, 'Inspiración heroica')),
          c.inspiration && lastRoll.has(c.id) && h('button', { class: 'btn xs primary', type: 'button', 'data-tip': `Repetir «${lastRoll.get(c.id).label}» gastando la inspiración`, onclick: async () => {
            const last = lastRoll.get(c.id);
            c.inspiration = false;
            save(c); refresh();
            sfx.magic();
            await rollAs(c, last.expr, `${last.label} (inspiración heroica)`, last.mode);
          } }, icon('refresh', 13), 'Repetir'))),
      section('Tiradas de salvación', 'shield',
        h('ul', { class: 'prof-list' }, ABILITY_KEYS.map((k) => {
          const name = ref.abilities.find((a) => a.key === k).name;
          return profRow(c.saves.includes(k) ? 1 : 0, marks,
            () => { c.saves = c.saves.includes(k) ? c.saves.filter((x) => x !== k) : [...c.saves, k]; save(c); refresh(); },
            saveBonus(c, k), name, () => test(c, saveBonus(c, k), `Salvación de ${name}`, state.attackMode));
        }))),
      section('Habilidades', 'target',
        h('ul', { class: 'prof-list' }, ref.skills.map((s) => profRow(c.skills[s.key] || 0, marks,
          () => { c.skills[s.key] = ((c.skills[s.key] || 0) + 1) % 3; save(c); refresh(); },
          skillBonus(c, s), s.name, () => test(c, skillBonus(c, s), s.name, state.attackMode), ABILITY_SHORT[s.ability]))),
        h('p', { class: 'tiny muted' }, 'Pulsa el círculo para competencia (●) o pericia (◆); el nombre, para tirar.')),
      sbox('Sabiduría (Percepción) pasiva', h('b', { class: 'big-num' }, passivePerception(c))));
  }

  function combatCol(c) {
    const autoAc = c.acMode === 'auto';
    if (autoAc) c.ac = computeAC(c);
    const acShield = h('label', { class: `ac-shield ${autoAc ? 'auto' : ''}`, 'data-tip': autoAc ? 'Clase de Armadura calculada con la armadura, el escudo y la Destreza' : 'Clase de Armadura' });
    acShield.innerHTML = '<svg viewBox="0 0 48 54" aria-hidden="true"><path d="M24 2 44 8.5v15.2C44 37 35.5 46 24 51 12.5 46 4 37 4 23.7V8.5z" fill="rgba(255,250,235,.55)" stroke="#6b4a26" stroke-width="2.4"/></svg>';
    acShield.append(bind(c, 'ac', { type: 'number', 'aria-label': 'Clase de Armadura', onChange: () => save(c), readonly: autoAc }), h('span', { class: 'sbox-label' }, 'CA'));
    const recalcAc = () => { if (c.acMode === 'auto') c.ac = computeAC(c); save(c); refresh(); };
    const armorRow = c.type !== 'enemigo' && h('div', { class: 'armor-row' },
      h('select', { 'aria-label': 'Armadura', class: 'mini-sel', onchange: (e) => { c.armor = e.target.value; recalcAc(); } },
        h('option', { value: '' }, 'Sin armadura'),
        ['ligera', 'media', 'pesada'].map((cat) => h('optgroup', { label: `Armadura ${cat}` },
          ref.armor.filter((a) => a.category === cat).map((a) => h('option', { value: a.name, selected: a.name === c.armor },
            `${a.name} (CA ${a.base}${a.dex_max == null ? ' + DES' : a.dex_max ? ' + DES máx. 2' : ''})`))))),
      h('label', { class: 'check small' }, bind(c, 'shield', { type: 'checkbox', onChange: recalcAc }), 'Escudo'),
      h('label', { class: 'check small', 'data-tip': 'Calcula la CA con el manual (armadura, escudo, Defensa sin armadura, dotes)' },
        h('input', { type: 'checkbox', checked: autoAc, onchange: (e) => { c.acMode = e.target.checked ? 'auto' : 'manual'; recalcAc(); } }), 'Auto'));

    const amount = h('input', { type: 'number', min: 0, class: 'hp-amt', placeholder: '0', 'aria-label': 'Cantidad de PG' });
    const hpCard = h('div', { class: `hp-card ${c.hp <= 0 ? 'down' : ''}` });
    const act = (kind) => () => {
      const v = Number(amount.value) || 0;
      if (!v) return amount.focus();
      if (kind === 'dmg') applyDamage(c, v); else if (kind === 'heal') applyHealing(c, v); else c.tempHp = Math.max(c.tempHp || 0, v);
      sfx[kind === 'dmg' ? 'hit' : kind === 'heal' ? 'heal' : 'shield']();
      floatNum(hpCard, kind === 'dmg' ? `−${v}` : `+${v}`, kind === 'dmg' ? 'dmg' : kind === 'heal' ? 'heal' : 'temp');
      save(c);
      setTimeout(refresh, 450);
    };
    amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') act(e.shiftKey ? 'heal' : 'dmg')(); });
    clear(hpCard,
      h('div', { class: 'hp-top' },
        h('div', { class: 'hp-cur' }, num(c, 'hp', { class: 'hp-input', onCommit: refresh, 'aria-label': 'PG actuales' }), h('span', { class: 'sbox-label' }, 'PG actuales')),
        h('div', { class: 'hp-sep' }, '/'),
        h('div', { class: 'hp-max' }, num(c, 'maxHp', { onCommit: refresh, 'aria-label': 'PG máximos' }),
          h('span', { class: 'sbox-label' }, 'Máximo',
            c.type === 'jugador' && classOf(c) && maxHpFor(c) !== c.maxHp && h('button', { class: 'mini-link', type: 'button', 'data-tip': `Recalcular con los valores fijos del manual: ${maxHpFor(c)}`,
              onclick: () => { const diff = maxHpFor(c) - c.maxHp; c.maxHp += diff; c.hp = Math.max(0, Math.min(c.maxHp, c.hp + Math.max(0, diff))); save(c); refresh(); } }, '↻'))),
        h('div', { class: 'hp-temp' }, num(c, 'tempHp', { 'aria-label': 'PG temporales', onCommit: refresh }), h('span', { class: 'sbox-label' }, 'Temporales'))),
      hpBar(c.hp, c.maxHp, c.tempHp),
      h('div', { class: 'row nowrap hp-actions' }, amount,
        h('button', { class: 'btn sm primary', type: 'button', onclick: act('dmg'), 'data-tip': 'Intro' }, icon('sword', 15), 'Daño'),
        h('button', { class: 'btn sm', type: 'button', onclick: act('heal'), 'data-tip': 'Mayús + Intro' }, icon('heart', 15), 'Curar'),
        h('button', { class: 'btn sm', type: 'button', onclick: act('temp') }, icon('shield', 15), 'Temp')));

    const hitDice = c.type === 'enemigo'
      ? sbox('Dados de golpe', h('div', { class: 'row nowrap' }, h('b', {}, c.hpDice || '—'),
        h('button', { class: 'btn xs', type: 'button', disabled: !c.hpDice, onclick: async () => {
          const r = await rollAs(c, c.hpDice, 'Puntos de golpe');
          if (r) { c.maxHp = c.hp = Math.max(1, r.total); save(c); refresh(); }
        } }, icon('dados', 13), 'Tirar PG')))
      : sbox('Dados de golpe', h('div', { class: 'row nowrap' },
        bind(c, 'hitDie', { class: 'inline', onChange: () => save(c), 'aria-label': 'Tipo de dado de golpe' }),
        h('span', { class: 'small' }, '×'), num(c, 'hitDiceLeft', { min: 0, 'aria-label': 'Dados de golpe restantes' }),
        h('button', { class: 'btn xs', type: 'button', disabled: !(c.hitDiceLeft > 0), 'data-tip': 'Gastar uno en un descanso corto', onclick: async () => {
          const r = await rollAs(c, `1${c.hitDie || 'd8'}${fmtMod(mod(c.abilities.con))}`, 'Dado de golpe');
          if (r) { applyHealing(c, Math.max(0, r.total)); c.hitDiceLeft -= 1; save(c); refresh(); }
        } }, 'Gastar')));

    const deathSaves = c.type === 'jugador' && sbox('Salvaciones contra muerte', h('div', { class: 'death' },
      ['ok', 'ko'].map((key) => h('div', { class: `death-row ${key}` }, h('span', { class: 'tiny' }, key === 'ok' ? 'Éxitos' : 'Fallos'),
        [0, 1, 2].map((i) => h('button', { class: `bubble ${c.deathSaves[key] > i ? 'on' : ''}`, type: 'button', 'aria-label': `${key === 'ok' ? 'Éxito' : 'Fallo'} ${i + 1}`,
          onclick: () => { c.deathSaves[key] = c.deathSaves[key] > i ? i : i + 1; save(c); refresh(); } })))),
      h('button', { class: 'btn xs', type: 'button', onclick: async () => {
        const r = await test(c, 0, 'Salvación contra muerte');
        if (!r) return;
        const ds = c.deathSaves;
        if (r.natural === 20) { c.hp = 1; c.deathSaves = { ok: 0, ko: 0 }; toast(`${c.name} vuelve en sí con 1 PG.`, { kind: 'good', iconName: 'heart' }); }
        else if (r.natural === 1) ds.ko = Math.min(3, ds.ko + 2);
        else if (r.total >= 10) ds.ok = Math.min(3, ds.ok + 1);
        else ds.ko = Math.min(3, ds.ko + 1);
        if (c.deathSaves.ko >= 3) toast(`${c.name} ha muerto.`, { kind: 'error', iconName: 'skull' });
        else if (c.deathSaves.ok >= 3) toast(`${c.name} está estable.`, { kind: 'good' });
        save(c); refresh();
      } }, icon('dados', 13), 'Tirar')));

    const exh = c.exhaustion || 0;
    const exhaustion = h('div', { class: 'exhaustion', 'data-tip': exh ? `Cansancio ${exh}: −${exhaustionPenalty(c)} a las pruebas con d20 y −${fmtM(1.5 * exh)} de velocidad${exh >= 6 ? ' · ¡muerte!' : ''}` : 'Sin cansancio' },
      [1, 2, 3, 4, 5, 6].map((n) => h('button', { class: `ex-pip ${exh >= n ? 'on' : ''}`, type: 'button', 'aria-label': `Cansancio ${n}`,
        onclick: () => {
          c.exhaustion = exh === n ? n - 1 : n;
          if (c.exhaustion >= 6) { sfx.death(); toast(`${c.name} muere por cansancio (nivel 6).`, { kind: 'error', iconName: 'skull' }); }
          save(c); refresh();
        } }, n)));

    const allConds = [...ref.conditions, ...ref.trackers].filter((x) => x.name !== 'Cansancio');
    const condAdd = selectEl([['', '+ Añadir estado'], ...allConds.map((x) => x.name).filter((n) => !c.conditions.includes(n)).map((n) => [n, condLabel(n)])], '', (v) => {
      if (v) { c.conditions.push(v); save(c); refresh(); }
    }, { class: 'cond-add', 'aria-label': 'Añadir estado' });
    const speedNow = effectiveSpeed(c);

    return h('div', { class: 'combat-col' },
      h('div', { class: 'combat-top' }, acShield,
        sbox('Iniciativa', h('div', { class: 'row nowrap' },
          h('button', { class: 'big-num roll-num', type: 'button', 'data-tip': 'Tirar iniciativa', onclick: () => test(c, initBonus(c), 'Iniciativa', state.attackMode) }, fmtMod(initBonus(c))),
          bind(c, 'initBonus', { class: 'inline mini', placeholder: 'auto', onChange: () => save(c), onCommit: refresh, 'aria-label': 'Bonificador de iniciativa (vacío = Destreza)' }))),
        sbox('Velocidad', h('div', { class: 'row nowrap' }, num(c, 'speed', { class: 'inline mini', step: 1.5, min: 0, onCommit: refresh }), h('span', { class: 'tiny' }, 'm'),
          speedNow !== Number(c.speed) && h('span', { class: 'tiny bad-text', 'data-tip': 'Con el cansancio' }, `→ ${fmtM(speedNow)}`)),
        `${(Number(c.speed) || 0) / 1.5} casillas`)),
      armorRow,
      hpCard,
      h('div', { class: 'inline-boxes' }, hitDice, deathSaves),
      section('Estado', 'aura',
        h('div', { class: 'row' }, h('span', { class: 'sbox-label' }, 'Cansancio'), exhaustion),
        h('div', { class: 'row cond-row' },
          c.conditions.map((name) => h('span', { class: 'chip cond', 'data-tip': allConds.find((x) => x.name === name)?.text || '' }, condLabel(name),
            h('button', { type: 'button', 'aria-label': `Quitar ${name}`, onclick: () => { c.conditions = c.conditions.filter((x) => x !== name); save(c); refresh(); } }, '✕'))),
          condAdd)));
  }

  function attacksSection(c) {
    const rows = c.attacks.map((a, i) => h('div', { class: 'atk-row' },
      bind(a, 'name', { onChange: () => save(c), 'aria-label': 'Nombre del ataque', class: 'atk-name' }),
      bind(a, 'bonus', { type: 'number', class: 'inline', onChange: () => save(c), 'aria-label': 'Bonificador de ataque' }),
      bind(a, 'damage', { onChange: () => save(c), placeholder: '1d8+3', 'aria-label': 'Daño', class: 'atk-dmg' }),
      bind(a, 'notes', { onChange: () => save(c), placeholder: 'cortante, alcance 1,5 m…', 'aria-label': 'Notas', class: 'atk-notes' }),
      h('div', { class: 'row nowrap' },
        a.weapon && ref.weapons.find((w) => w.name === a.weapon) && h('button', { class: 'btn sm icon ghost', type: 'button', 'data-tip': 'Recalcular con las características actuales',
          onclick: () => { Object.assign(a, weaponAttack(c, ref.weapons.find((w) => w.name === a.weapon))); save(c); refresh(); } }, icon('refresh', 14)),
        a.save ? h('span', { class: 'chip', 'data-tip': 'Acción con salvación: tira solo el daño' }, a.save)
          : h('button', { class: 'btn sm primary', type: 'button', onclick: () => test(c, Number(a.bonus) || 0, `Ataque con ${a.name}`, state.attackMode) }, icon('dados', 15), 'Atacar'),
        h('button', { class: 'btn sm', type: 'button', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, a.damage, `Daño de ${a.name}`) }, icon('drop', 15), 'Daño'),
        h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Crítico: dados de daño dobles', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, critExpr(a.damage), `Crítico con ${a.name}`) }, '×2'),
        h('button', { class: 'btn sm icon ghost', type: 'button', 'aria-label': 'Quitar ataque', onclick: () => { c.attacks.splice(i, 1); save(c); refresh(); } }, icon('trash', 15)))));
    return section('Ataques y conjuros de ataque', 'sword',
      h('div', { class: 'row between' }, h('span', { class: 'tiny muted' }, 'Las pruebas, salvaciones y ataques usan este modo:'),
        segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.attackMode, (v) => { state.attackMode = v; })),
      rows.length ? h('div', { class: 'atk-list' }, h('div', { class: 'atk-row atk-head' }, ['Nombre', 'Ataque', 'Daño', 'Notas', ''].map((t) => h('span', {}, t))), rows)
        : h('p', { class: 'muted small' }, 'Sin ataques todavía.'),
      h('div', { class: 'row' },
        h('select', { class: 'mini-sel weapon-pick', 'aria-label': 'Añadir un arma del manual', onchange: (e) => {
          const w = ref.weapons.find((x) => x.name === e.target.value);
          if (!w) return;
          c.attacks.push(weaponAttack(c, w));
          sfx.sword?.();
          save(c); refresh();
        } }, h('option', { value: '' }, '+ Arma del manual…'),
        [['sencilla', 'Armas sencillas'], ['marcial', 'Armas marciales']].map(([cat, label]) => h('optgroup', { label },
          ref.weapons.filter((w) => w.category === cat).map((w) => h('option', { value: w.name }, `${w.name} · ${w.damage} ${w.type}${weaponProficient(c, w) ? '' : ' (sin competencia)'}`))))),
        h('button', { class: 'btn sm', type: 'button', onclick: () => {
          c.attacks.push({ name: 'Nuevo ataque', bonus: profBonus(c) + mod(c.abilities.fue), damage: `1d6${fmtMod(mod(c.abilities.fue))}`, notes: '' });
          save(c); refresh();
        } }, icon('plus', 15), 'Ataque libre')),
      masteriesBox(c));
  }

  // Maestría con armas (2024): la clase indica cuántas armas; cada una añade su propiedad de maestría.
  function masteriesBox(c) {
    const n = masteryCount(classOf(c), c.level || 1);
    if (!n && !c.masteries.length) return null;
    const free = n - c.masteries.length;
    return h('div', { class: 'mastery-box' },
      h('div', { class: 'row between' }, h('b', { class: 'small' }, icon('sword', 14), ` Maestría con armas (${c.masteries.length}/${n})`),
        h('span', { class: 'tiny muted' }, 'Puedes cambiar una tras cada descanso largo')),
      h('div', { class: 'row' },
        c.masteries.map((name) => {
          const w = ref.weapons.find((x) => x.name === name);
          const m = ref.masteries.find((x) => x.name === w?.mastery);
          return h('span', { class: 'chip mastery', 'data-tip': m ? `${m.name}: ${m.text}` : '' }, h('b', {}, name), w && ` · ${w.mastery}`,
            h('button', { type: 'button', 'aria-label': `Quitar ${name}`, onclick: () => {
              c.masteries = c.masteries.filter((x) => x !== name);
              if (w) c.attacks.filter((a) => a.weapon === name).forEach((a) => Object.assign(a, weaponAttack(c, w)));
              save(c); refresh();
            } }, '✕'));
        }),
        free > 0 && selectEl([['', `+ Elegir arma (${free})`], ...ref.weapons.filter((w) => !c.masteries.includes(w.name) && weaponProficient(c, w)).map((w) => [w.name, `${w.name} (${w.mastery})`])], '',
          (v) => {
            if (!v) return;
            c.masteries.push(v);
            c.attacks.filter((a) => a.weapon === v).forEach((a) => Object.assign(a, weaponAttack(c, ref.weapons.find((w) => w.name === v))));
            save(c); refresh();
          }, { class: 'mini-sel', 'aria-label': 'Elegir arma para la maestría' })));
  }

  function spellsSection(c) {
    const ab = c.spellAbility;
    const dc = ab ? 8 + profBonus(c) + mod(c.abilities[ab]) : null;
    const used = c.slots.some((s) => s.max > 0);
    const cls = classOf(c);
    const cast = castingOf(c, cls);
    const counts = spellCounts(c);
    const opt = cls?.subclass_spell_options?.[c.subclass];
    const count = ({ have, max }) => h('b', { class: `big-num ${have > max ? 'over' : ''}` }, `${have}/${max}`);
    return section('Conjuros', 'wand',
      h('div', { class: 'inline-boxes' },
        sbox('Aptitud mágica', selectEl([['', '—'], ...ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]])], ab, (v) => { c.spellAbility = v; save(c); refresh(); })),
        ab && sbox('CD salvación', h('b', { class: 'big-num' }, dc), '8 + competencia + modificador de la aptitud mágica'),
        ab && sbox('Ataque', h('button', { class: 'big-num roll-num', type: 'button', onclick: () => test(c, dc - 8, 'Ataque de conjuro', state.attackMode) }, fmtMod(dc - 8))),
        counts && sbox('Trucos', count(counts.cantrips), `Trucos de la clase a nivel ${c.level || 1}. Los que dan la especie, la subclase o las dotes van aparte.`),
        counts && sbox('Preparados', count(counts.prepared), `Conjuros preparados a nivel ${c.level || 1}. Los siempre preparados (subclase, dotes…) no cuentan.`)),
      opt && field(`${opt.label} (${c.subclass})`, selectEl([['', '— Elige —'], ...Object.keys(opt.options).map((k) => [k, k])], c.subclassOption || '',
        (v) => { c.subclassOption = v; save(c); refresh(); }, { 'aria-label': opt.label })),
      cast?.caster && h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!c.autoSlots, onchange: (e) => { c.autoSlots = e.target.checked; syncClassData(c); save(c); refresh(); } }),
        cast.caster === 'pact' ? 'Magia del pacto según el nivel (se recupera en descanso corto)' : 'Espacios según la tabla de la clase'),
      h('div', { class: 'slots' }, c.slots.map((s, i) => (used || i < 3) && h('div', { class: 'slot' },
        h('span', { class: 'slot-lvl' }, i + 1),
        bind(s, 'max', { type: 'number', class: 'inline mini', min: 0, max: 9, onChange: () => save(c), onCommit: refresh, 'aria-label': `Espacios de nivel ${i + 1}`, readonly: !!(cast?.caster && c.autoSlots) }),
        h('div', { class: 'gems' }, Array.from({ length: s.max || 0 }, (_, j) => h('button', {
          type: 'button', class: `gem ${j < s.used ? 'used' : ''}`, 'aria-label': `Espacio ${j + 1} de nivel ${i + 1}`,
          onclick: () => { s.used = j < s.used ? j : j + 1; save(c); refresh(); },
        })))))),
      spellBook(c),
      field('Notas de conjuros', bind(c, 'spells', { type: 'textarea', rows: 3, onChange: () => save(c), placeholder: 'Invocaciones, libro de conjuros, preparados para hoy…' })));
  }

  // Conjuros de la ficha por nivel. Los que da la ficha sola (especie, clase, subclase, dotes, extra) llevan su origen
  // y no cuentan para el máximo. Al pasar el ratón sale la descripción básica; al pulsar el nombre, la carta completa.
  function spellBook(c) {
    c.spellList ||= [];
    const byName = new Map(ref.spells.map((s) => [s.name, s]));
    const granted = new Map(grantedSpells(c).map((g) => [g.name, g]));
    const entries = [...[...granted.values()].map((g) => [byName.get(g.name), g]), ...c.spellList.filter((n) => !granted.has(n)).map((n) => [byName.get(n), null])]
      .filter(([s]) => s).sort(([a], [b]) => a.level - b.level || a.name.localeCompare(b.name));
    const levels = [...new Set(entries.map(([s]) => s.level))];
    const choices = spellChoices(c).map((x) => ({ ...x, have: (c.spellPicks?.[x.key] || []).length })).filter((x) => x.have < x.count);
    return h('div', { class: 'spellbook' },
      entries.length ? levels.map((n) => h('div', { class: 'spell-group' },
        h('div', { class: 'spell-group-head' }, n ? `Nivel ${n}` : 'Trucos',
          n > 0 && c.slots[n - 1]?.max > 0 && h('span', { class: 'tiny muted' }, ` · ${c.slots[n - 1].max - (c.slots[n - 1].used || 0)}/${c.slots[n - 1].max} espacios`)),
        h('ul', { class: 'spell-list' }, entries.filter(([s]) => s.level === n).map(([s, g]) => spellRow(c, s, g)))))
        : h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Añade los trucos y conjuros que conoce o tiene preparados.'),
      choices.map((x) => h('div', { class: 'spell-choice' }, icon('sparkle', 14),
        h('span', { class: 'small grow' }, h('b', {}, x.label), ` · ${x.from} (${x.have}/${x.count})`),
        h('button', { class: 'btn xs primary', type: 'button', onclick: () => pickChoice(c, x) }, icon('plus', 13), 'Elegir'))),
      h('div', { class: 'row' },
        h('button', { class: 'btn xs', type: 'button', onclick: () => addSpells(c, 'truco') }, icon('plus', 13), 'Truco'),
        h('button', { class: 'btn xs', type: 'button', onclick: () => addSpells(c, 'conjuro') }, icon('plus', 13), 'Conjuro'),
        h('button', { class: 'btn xs ghost', type: 'button', 'data-tip': 'De otra fuente (invocación, libro de pactos, objeto, regalo del DM…): no cuenta para tu máximo y puede tener usos gratis',
          onclick: () => addSpells(c, 'extra') }, icon('sparkle', 13), 'Extra')));
  }

  function spellRow(c, s, g) {
    const free = freeUseFor(c, s);
    const remove = g?.pick ? () => { c.spellPicks[g.pick] = c.spellPicks[g.pick].filter((n) => n !== s.name); syncGrants(c); }
      : g?.extra ? () => { c.extraSpells = c.extraSpells.filter((x) => x.name !== s.name); c.resources = c.resources.filter((r) => !(r.extra && r.name === `${s.name} (gratis)`)); }
        : g ? null : () => { c.spellList = c.spellList.filter((n) => n !== s.name); };
    return h('li', { 'data-tip': spellTip(s) },
      h('span', { class: 'slot-lvl' }, s.level || '·'),
      h('div', { class: 'grow' },
        h('button', { class: 'spell-name', type: 'button', onclick: () => spellDialog(c, s, g) }, s.name),
        s.concentration && h('span', { class: 'tiny-chip chip' }, 'C'), s.ritual && h('span', { class: 'tiny-chip chip' }, 'R'),
        g && h('span', { class: 'tiny-chip chip src' }, g.from),
        h('div', { class: 'tiny muted' }, spellMeta(s))),
      free && h('button', { class: 'btn xs', type: 'button', 'data-tip': `${free.name}: quedan ${free.max - (free.used || 0)} de ${free.max}`, onclick: () => cast(c, s, { free }) }, 'Gratis'),
      s.ritual && s.level > 0 && h('button', { class: 'btn xs ghost', type: 'button', 'data-tip': 'Como ritual: tarda 10 minutos más y no gasta espacio', onclick: () => cast(c, s, { ritual: true }) }, 'Ritual'),
      h('button', { class: 'btn xs primary', type: 'button', onclick: () => cast(c, s) }, icon('wand', 13), 'Lanzar'),
      remove && h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${s.name}`, onclick: () => { remove(); save(c); refresh(); } }, icon('close', 13)));
  }

  // Dados de daño o curación: los trucos suben en los niveles 5, 11 y 17 y los conjuros con espacio mayor suman
  // lo que dice su descripción («+1d6 por nivel superior»). Las curaciones «+ tu aptitud» suman el modificador.
  function spellDice(c, s, slotLevel = s.level) {
    let [expr] = (s.damage || s.heal).split(' ');
    const tier = 1 + [5, 11, 17].filter((l) => (c.level || 1) >= l).length;
    if (!s.level) return s.name === 'Descarga sobrenatural' ? expr : expr.replace(/^(\d+)d/, (_, n) => `${Number(n) * tier}d`);
    const up = /\+(\d+)d(\d+)[^.]*?por nivel/.exec(s.summary || '');
    if (up && slotLevel > s.level) expr = expr.replace(new RegExp(`(\\d+)d${up[2]}\\b`), (_, n) => `${Number(n) + Number(up[1]) * (slotLevel - s.level)}d${up[2]}`);
    if (s.heal && /\+ tu aptitud/.test(s.summary || '') && c.spellAbility) expr += fmtMod(mod(c.abilities[c.spellAbility]));
    return expr;
  }

  // Lanzar: con el espacio más bajo que quede (o el elegido), con un uso gratis, como ritual o con el arcanum místico
  // del brujo. Marca la concentración y tira el ataque y el daño o la curación.
  async function cast(c, s, how = {}) {
    const dc = c.spellAbility ? 8 + profBonus(c) + mod(c.abilities[c.spellAbility]) : null;
    let slotLevel = s.level;
    if (how.free) how.free.used = (how.free.used || 0) + 1;
    else if (how.ritual) toast(`${s.name} como ritual: tarda 10 minutos más y no gasta espacio.`, { iconName: 'wand' });
    else if (s.level) {
      const i = how.slot ?? c.slots.findIndex((x, j) => j >= s.level - 1 && (x.used || 0) < (x.max || 0));
      const arcanum = c.resources.find((r) => r.name === `Arcanum místico (nivel ${s.level})` && (r.used || 0) < r.max);
      if (i >= 0) { c.slots[i].used = (c.slots[i].used || 0) + 1; slotLevel = i + 1; }
      else if (arcanum) arcanum.used = (arcanum.used || 0) + 1;
      else return toast(`No te quedan espacios de nivel ${s.level} o superior${freeUseFor(c, s) ? ' (aún tienes un uso gratis)' : ''}.`, { iconName: 'wand' });
    }
    if (s.concentration && !c.conditions.includes('Concentrado')) c.conditions.push('Concentrado');
    sfx.magic();
    save(c);
    refresh();
    if (slotLevel > s.level) toast(`${s.name} con un espacio de nivel ${slotLevel}.`, { iconName: 'wand' });
    if (s.attack && dc != null) await test(c, dc - 8, `Ataque de ${s.name}`, state.attackMode);
    if (s.damage || s.heal) await rollAs(c, spellDice(c, s, slotLevel), `${s.name}: ${s.damage ? `daño de ${s.damage.split(' ')[1]}` : 'curación'}${s.name === 'Descarga sobrenatural' ? ' (por rayo)' : ''}`);
    if (s.save) toast(`${s.name}: salvación de ${s.save}${dc != null ? ` CD ${dc}` : ''}.`, { iconName: 'wand', ms: 6000 });
  }

  // Carta del conjuro con la descripción y cómo lanzarlo: con qué espacio (para subirlo de nivel), gratis o como ritual.
  async function spellDialog(c, s, g) {
    const free = freeUseFor(c, s);
    const slots = s.level ? c.slots.map((x, i) => [x, i]).filter(([x, i]) => i >= s.level - 1 && (x.max || 0) > (x.used || 0)) : [];
    const actions = [
      { label: 'Cerrar', value: null },
      ...(free ? [{ label: `Gratis (${free.max - (free.used || 0)})`, value: { free } }] : []),
      ...(s.ritual && s.level ? [{ label: 'Ritual', value: { ritual: true } }] : []),
      ...(s.level ? slots.map(([x, i]) => ({ label: `Nivel ${i + 1} (${x.max - (x.used || 0)})`, value: { slot: i }, class: 'primary', icon: 'wand' }))
        : [{ label: 'Lanzar', value: {}, class: 'primary', icon: 'wand' }]),
      ...(s.level && !slots.length && !free ? [{ label: 'Lanzar', value: {}, class: 'primary', icon: 'wand' }] : []),
    ];
    const how = await modal(s.name, spellCard(s, g?.from), actions, { iconName: 'wand' });
    if (how) cast(c, s, how);
  }

  // Nivel de conjuro más alto que puede lanzar (por sus espacios o el arcanum místico del brujo).
  function maxSpellLevel(c) {
    const fromSlots = c.slots.reduce((m, x, i) => (x.max > 0 ? i + 1 : m), 0);
    const arcanum = castingOf(c)?.caster === 'pact' ? ([[11, 6], [13, 7], [15, 8], [17, 9]].filter(([l]) => (c.level || 1) >= l).pop()?.[1] || 0) : 0;
    return Math.max(fromSlots, arcanum) || 9;
  }

  const hasSpell = (c, s) => c.spellList.includes(s.name) || grantedSpells(c).some((g) => g.name === s.name);

  // Añadir trucos o conjuros de la clase (cuentan para el máximo) o extra de otra fuente, con usos gratis si los tiene.
  function addSpells(c, mode) {
    const lists = spellLists(c);
    if (mode === 'extra') {
      const ex = { from: '', uses: 0, reset: 'largo' };
      const extra = h('div', { class: 'row' },
        field('De dónde sale', bind(ex, 'from', { placeholder: 'Invocación, libro de pactos, objeto, el DM…' }), 'grow'),
        field('Usos gratis', bind(ex, 'uses', { type: 'number', min: 0, class: 'inline mini' })),
        field('Se recuperan', selectEl([['largo', 'D. largo'], ['corto', 'D. corto'], ['nunca', 'Nunca']], ex.reset, (v) => { ex.reset = v; }, { class: 'mini-sel' })));
      return pickSpells({ title: 'Conjuro extra', spells: ref.spells, lists, isTaken: (s) => hasSpell(c, s), extra,
        note: 'No cuenta para tu máximo de trucos ni de preparados. Si tiene usos gratis, se lanza sin gastar espacio (lo verás en Recursos).',
        onPick: (s) => {
          (c.extraSpells ||= []).push({ name: s.name, from: ex.from.trim() || 'Extra' });
          if (Number(ex.uses) > 0) c.resources.push({ name: `${s.name} (gratis)`, max: Number(ex.uses), used: 0, reset: ex.reset, extra: true });
          sfx.page(); save(c);
        } }).then(refresh);
    }
    const cantrip = mode === 'truco';
    const counts = spellCounts(c);
    const now = counts && (cantrip ? counts.cantrips : counts.prepared);
    return pickSpells({ title: cantrip ? 'Añadir trucos' : 'Añadir conjuros', spells: ref.spells, lists, isTaken: (s) => hasSpell(c, s),
      levels: cantrip ? [0] : Array.from({ length: maxSpellLevel(c) }, (_, i) => i + 1),
      note: now ? `Tienes ${now.have} de ${now.max} ${cantrip ? 'trucos' : 'conjuros preparados'} de tu clase.` : '',
      onPick: (s) => { c.spellList.push(s.name); sfx.page(); save(c); } }).then(refresh);
  }

  // Elegir los conjuros que da una dote (Iniciado en la magia, Lanzador ritual…) o una subclase (Descubrimientos mágicos).
  function pickChoice(c, x) {
    const picks = ((c.spellPicks ||= {})[x.key] ||= []);
    const top = maxSpellLevel(c);
    const pool = ref.spells.filter((s) => (x.level == null ? s.level >= 1 && s.level <= top : s.level === x.level)
      && (!x.schools || x.schools.includes(s.school)) && (!x.ritual || s.ritual));
    return pickSpells({ title: `${x.label} · ${x.from}`, spells: pool, lists: x.lists || [], isTaken: (s) => picks.includes(s.name) || picks.length >= x.count,
      note: `Elige ${x.count}. Quedan siempre preparados${x.free ? ' y cada uno se lanza gratis 1 vez por descanso largo' : ''}.`,
      onPick: (s) => { picks.push(s.name); syncGrants(c); sfx.page(); save(c); } }).then(refresh);
  }

  function resourcesSection(c) {
    return section('Recursos', 'flame',
      h('p', { class: 'tiny muted' }, 'Los de la clase y la especie se calculan con el nivel; añade los tuyos (cargas de objetos…).'),
      c.resources.map((r, i) => h('div', { class: 'res-row' },
        h('div', { class: 'row nowrap' }, bind(r, 'name', { class: 'grow', onChange: () => save(c), 'aria-label': 'Recurso' }),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar recurso', onclick: () => { c.resources.splice(i, 1); save(c); refresh(); } }, icon('trash', 14))),
        h('div', { class: 'row nowrap' },
          h('div', { class: 'gems' }, Array.from({ length: Math.min(r.max || 0, 20) }, (_, j) => h('button', {
            type: 'button', class: `gem round ${j < (r.max - (r.used || 0)) ? '' : 'used'}`, 'aria-label': `Uso ${j + 1}`,
            onclick: () => { const left = r.max - (r.used || 0); r.used = r.max - (j < left ? j : j + 1); save(c); refresh(); },
          }))),
          h('span', { class: 'tiny muted' }, 'máx'), num(r, 'max', { class: 'inline mini', min: 0, onCommit: refresh }),
          selectEl([['corto', 'D. corto'], ['corto1', '1 en d. corto'], ['largo', 'D. largo'], ['nunca', 'Nunca']], r.reset, (v) => { r.reset = v; save(c); }, { class: 'mini-sel', 'aria-label': 'Se recupera con' })))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { c.resources.push({ name: 'Recurso', max: 2, used: 0, reset: 'largo' }); save(c); refresh(); } }, icon('plus', 15), 'Añadir recurso'));
  }

  function inventorySection(c) {
    return section('Inventario', 'coins',
      h('div', { class: 'coins' }, COINS.map(([k, l, col]) => h('label', { class: 'coin', 'data-tip': l },
        h('span', { class: 'coin-face', style: { '--coin': col } }, k.toUpperCase()), bind(c.coins, k, { type: 'number', min: 0, onChange: () => save(c), 'aria-label': l })))),
      h('ul', { class: 'items' }, c.inventory.map((it, i) => h('li', { class: it.magic ? 'magic' : '' },
        bind(it, 'qty', { type: 'number', class: 'inline mini', min: 0, onChange: () => save(c), 'aria-label': 'Cantidad' }),
        bind(it, 'name', { class: 'grow', onChange: () => save(c), placeholder: 'Objeto', 'aria-label': 'Objeto', 'data-tip': it.magic ? it.notes : null }),
        it.charges > 0 && chargesEl(c, it),
        it.attune != null && h('label', { class: 'check small attune', 'data-tip': `Sintonizado${it.attune ? ` (solo ${it.attune})` : ''}: como mucho 3 objetos` },
          h('input', { type: 'checkbox', checked: !!it.attuned, onchange: (e) => { it.attuned = e.target.checked; save(c); refresh(); } }), 'S'),
        bind(it, 'notes', { class: 'item-notes', placeholder: 'notas', onChange: () => save(c), 'aria-label': 'Notas' }),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar objeto', onclick: () => { c.inventory.splice(i, 1); save(c); refresh(); } }, icon('trash', 14))))),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => { c.inventory.push({ name: '', qty: 1, notes: '' }); save(c); refresh(); } }, icon('plus', 15), 'Añadir objeto'),
        h('select', { class: 'mini-sel', 'aria-label': 'Añadir un objeto mágico', onchange: (e) => {
          const m = ref.magic_items.find((x) => x.name === e.target.value);
          if (!m) return;
          c.inventory.push({ name: m.name, qty: 1, notes: `${m.rarity} · ${m.summary}`, magic: true, attune: m.attune, attuned: false,
            ...(m.charges ? { charges: m.charges, used: 0, regain: m.regain } : {}) });
          sfx.magic(); save(c); refresh();
        } }, h('option', { value: '' }, '+ Objeto mágico…'),
        [['Common', 'Comunes'], ['Uncommon', 'Poco comunes'], ['Rare', 'Raros'], ['Very Rare', 'Muy raros'], ['Legendary', 'Legendarios'], ['Rarity Varies', 'Rareza variable'], ['Artifact', 'Artefactos']]
          .map(([k, l]) => h('optgroup', { label: l }, ref.magic_items.filter((m) => m.rarityKey === k).map((m) => h('option', { value: m.name }, `${m.name}${m.attune != null ? ' (S)' : ''}`))))),
        (() => { const n = c.inventory.filter((it) => it.attuned).length; return n > 0 && h('span', { class: `chip ${n > 3 ? 'bad' : ''}`, 'data-tip': 'Objetos sintonizados (máximo 3)' }, `Sintonía ${n}/3`); })()));
  }

  // Cargas de un objeto mágico: gemas (o un contador si son muchas). Se recuperan al amanecer con el descanso largo.
  function chargesEl(c, it) {
    const left = it.charges - (it.used || 0);
    const tip = `Cargas: ${left} de ${it.charges}${it.regain ? ` · al amanecer recupera ${it.regain === 'todas' ? 'todas' : it.regain}` : ' · no se recargan'}`;
    const set = (used) => { it.used = Math.max(0, Math.min(it.charges, used)); save(c); refresh(); };
    return it.charges <= 12
      ? h('div', { class: 'gems', 'data-tip': tip }, Array.from({ length: it.charges }, (_, j) => h('button', {
        type: 'button', class: `gem round ${j < left ? '' : 'used'}`, 'aria-label': `Carga ${j + 1}`, onclick: () => set(it.charges - (j < left ? j : j + 1)) })))
      : h('div', { class: 'row nowrap', 'data-tip': tip },
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Gastar una carga', onclick: () => set((it.used || 0) + 1) }, '−'),
        h('span', { class: 'small tnum' }, `${left}/${it.charges}`),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Recuperar una carga', onclick: () => set((it.used || 0) - 1) }, '+'));
  }

  function notesSection(c) {
    const cls = classOf(c);
    const sp = speciesOf(c);
    const level = c.level || 1;
    const featInfo = (name) => ref.feats.find((f) => name.startsWith(f.name));
    const ownFeats = c.feats.map((name, i) => {
      const f = featInfo(name);
      return h('li', { class: 'feat-item' },
        h('div', { class: 'row between nowrap' }, h('b', {}, name), f && h('span', { class: 'chip tiny-chip' }, f.category),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${name}`, onclick: () => { c.feats.splice(i, 1); featChanged(c, name, -1); save(c); refresh(); } }, icon('close', 13))),
        f && h('div', { class: 'tiny muted' }, `${f.summary} (MdJ p. ${f.page})`));
    });
    const featAdd = h('select', { class: 'mini-sel', 'aria-label': 'Añadir dote', onchange: (e) => {
      if (!e.target.value) return;
      c.feats.push(e.target.value);
      featChanged(c, e.target.value, 1);
      save(c); refresh();
    } }, h('option', { value: '' }, '+ Añadir dote…'),
    ['origen', 'general', 'estilo de combate', 'don épico'].map((cat) => h('optgroup', { label: cat[0].toUpperCase() + cat.slice(1) },
      ref.feats.filter((f) => f.category === cat).map((f) => h('option', { value: f.name }, `${f.name}${f.prereq ? ` (${f.prereq})` : ''}`)))));
    const columns = cls ? Object.keys(cls.columns || {}).map((k) => [k, columnAt(cls, k, level)]).filter(([, v]) => v != null) : [];
    return [
      (cls || sp || c.feats.length || c.type === 'jugador') && section('Rasgos y dotes', 'sparkle',
        cls && h('div', { class: 'traits-block' },
          h('div', { class: 'row between' }, h('b', {}, `${cls.name} ${level}`, c.subclass ? ` · ${c.subclass}` : ''), h('span', { class: 'tiny muted' }, source(cls))),
          columns.length > 0 && h('div', { class: 'row' }, columns.map(([k, v]) => h('span', { class: 'chip' }, `${k}: `, h('b', {}, v)))),
          cls.choice && field(cls.choice.name, selectEl([['', '— Elige —'], ...cls.choice.options.map(([n, t]) => [n, `${n}: ${t}`])], c.classChoice || '', (v) => setClassChoice(c, v), { 'aria-label': cls.choice.name })),
          h('ul', { class: 'trait-list' }, featuresUpTo(cls, level, c.subclass).filter(([, f]) => f !== 'Mejora de característica').map(([l, f, t, sub]) => h('li', { class: sub ? 'sub' : '' },
            h('span', { class: 'lvl' }, l), h('b', {}, f), t && h('span', { class: 'tiny muted' }, ` — ${t}`))))),
        sp && h('div', { class: 'traits-block' },
          h('div', { class: 'row between' }, h('b', {}, sp.name, c.lineage ? ` · ${c.lineage}` : ''), h('span', { class: 'tiny muted' }, source(sp))),
          h('ul', { class: 'trait-list' }, sp.traits.map(([n, t]) => h('li', {}, h('b', {}, n), h('span', { class: 'tiny muted' }, ` — ${t}`))),
            c.lineage && sp.options && h('li', {}, h('b', {}, c.lineage), h('span', { class: 'tiny muted' }, ` — ${sp.options.find(([n]) => n === c.lineage)?.[1] || ''}`)))),
        h('div', { class: 'traits-block' }, h('b', {}, 'Dotes'), h('ul', { class: 'feat-list' }, ownFeats), featAdd)),
      section('Otros rasgos y competencias', 'scroll',
        bind(c, 'features', { type: 'textarea', rows: 5, onChange: () => save(c), placeholder: 'Invocaciones, maniobras, metamagia, objetos mágicos, bendiciones…' }),
        h('div', { class: 'row' },
          field('Idiomas', bind(c, 'languages', { onChange: () => save(c) }), 'grow'),
          field('Herramientas', bind(c, 'tools', { onChange: () => save(c) }), 'grow'))),
      section(c.type === 'jugador' ? 'Historia y notas' : 'Notas del máster', 'feather',
        bind(c, 'notes', { type: 'textarea', rows: 8, onChange: () => save(c), placeholder: c.type === 'jugador' ? 'Trasfondo, aliados, objetivos…' : 'Secretos, motivaciones, tácticas…' })),
    ];
  }

  // ------------------------------------------------------------ acciones de ficha
  async function duplicate(c) {
    const { id, created, updated, ...copy } = structuredClone(c);
    const base = copy.name.replace(/\s\d+$/, '');
    const n = state.chars.filter((x) => x.name.startsWith(base)).length + 1;
    create({ ...copy, name: `${base} ${n}` });
  }

  async function remove(c) {
    if (!(await confirmDialog(`Se eliminará la ficha de «${c.name}».`))) return;
    try {
      await api.remove('characters', c.id);
      await api.removeUpload(c.portrait);
      state.chars = state.chars.filter((x) => x !== c);
      savers.delete(c.id);
      open(null);
    } catch (e) { toastError(e); }
  }

  async function addToCombat(c) {
    try {
      const settings = await api.settings();
      let combat = settings.activeCombat && await api.get(`/api/combats/${settings.activeCombat}`).catch(() => null);
      if (!combat || combat.status === 'finished') {
        const all = await api.list('combats');
        combat = all.find((x) => x.status === 'planned') || null;
      }
      if (!combat) return toast('No hay ningún combate en curso ni preparado. Créalo en Combate.', { iconName: 'combate' });
      const same = combat.combatants.filter((x) => x.charId === c.id).length;
      if (c.type === 'jugador' && same) return toast(`${c.name} ya está en «${combat.name}».`);
      const entry = combatantFrom(c, c.type === 'jugador' ? '' : same ? String(same + 1) : '');
      if (combat.status === 'active') {
        const r = await roll(`1d20${fmtMod(entry.initBonus)}`, { label: `${entry.name}: Iniciativa`, who: entry.name, quiet: true });
        entry.init = r?.total ?? 10;
      }
      combat.combatants.push(entry);
      if (combat.status === 'active') sortInitiative(combat);
      await api.update('combats', combat);
      toast(`${entry.name} se une a «${combat.name}».`, { kind: 'good', iconName: 'combate' });
    } catch (e) { toastError(e); }
  }

  render();
  return flushAll;
}
