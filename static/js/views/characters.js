// Personajes: jugadores, personajes de la historia (PNJ) y enemigos.
// La galería muestra cartas con retrato; la ficha imita una hoja de personaje en pergamino.
import { api, debounced } from '../core/api.js';
import {
  h, clear, icon, bind, field, selectEl, segmented, searchBox, hpBar, shield, initials, modal, confirmDialog,
  toast, toastError, pickFiles, floatNum, prefs, bigBanner,
} from '../core/dom.js';
import {
  TYPES, TYPE_LABEL, TYPE_COLOR, TYPE_ICON, CONDITION_ICON, condLabel, ABILITY_KEYS, ABILITY_SHORT, CRS, reference, monsters,
  mod, fmtMod, profBonus, initBonus, saveBonus, skillBonus, passivePerception, critExpr, xpProgress,
  newCharacter, fromMonster, applyDamage, applyHealing, longRest, shortRest, combatantFrom,
} from '../core/dnd.js';
import { sfx } from '../core/sfx.js';
import { roll } from '../core/dice.js';
import { sortInitiative } from '../core/combat.js';

export default { id: 'personajes', title: 'Personajes', icon: 'personajes', hint: 'Jugadores, personajes de la historia y enemigos · tecla 3', mount };

const COINS = [['pc', 'Cobre', '#c27a45'], ['pa', 'Plata', '#c9d1d9'], ['pe', 'Electro', '#d8cf8c'], ['po', 'Oro', '#f0c24a'], ['pp', 'Platino', '#e6eef5']];

async function mount(root, [selId]) {
  const [ref, raw] = await Promise.all([reference(), api.list('characters')]);
  const state = {
    chars: raw.map((c) => ({ ...newCharacter(c.type), ...c })), // fichas antiguas reciben los campos nuevos
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
    return [c.race, c.cls].filter(Boolean).join(' · ') || 'Aventurero';
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
            TYPES.map(([t, l]) => h('button', { class: `btn ${t === 'jugador' ? 'primary' : ''}`, type: 'button', onclick: () => create(newCharacter(t)) },
              icon(TYPE_ICON[t], 16), `+ ${t === 'pnj' ? 'PNJ' : l}`)),
            h('button', { class: 'btn', type: 'button', onclick: bestiaryDialog }, icon('book', 16), 'Bestiario'))),
        h('div', { class: 'row party-actions' }, h('span', { class: 'eyebrow', style: { margin: 0 } }, 'Grupo'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('corto'), 'data-tip': 'Recupera los recursos de descanso corto' }, icon('hourglass', 15), 'Descanso corto'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('largo'), 'data-tip': 'PG al máximo, espacios de conjuro y recursos' }, icon('moon', 15), 'Descanso largo'),
          h('button', { class: 'btn sm', type: 'button', onclick: awardXp }, icon('star', 15), 'Dar experiencia'))),
      grid);
    drawGrid();
  }

  function card(c) {
    const banner = h('div', { class: 'cc-banner', style: { '--c': c.color, backgroundImage: c.portrait ? `url("${c.portrait}")` : null } },
      !c.portrait && h('span', { class: 'cc-initials' }, initials(c.name)));
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
        h('span', { 'data-tip': 'Velocidad (pies)' }, icon('compass', 14), c.speed),
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
      state.chars.push({ ...newCharacter(saved.type), ...saved });
      open(state.chars[state.chars.length - 1]);
      sfx.magic();
      toast(`${saved.name} se une a la campaña.`, { kind: 'good', iconName: TYPE_ICON[saved.type] });
    } catch (e) { toastError(e); }
  }

  async function bestiaryDialog() {
    const all = await monsters();
    const grid = h('div', { class: 'bestiary' });
    let q = '';
    const draw = () => clear(grid, all.filter((m) => m.name.toLowerCase().includes(q)).map((m) => h('button', {
      class: 'beast', type: 'button', onclick: () => { grid.closest('.modal-back').remove(); create(fromMonster(m)); },
    }, h('span', { class: 'beast-cr' }, `VD ${m.cr}`), h('b', {}, m.name), h('span', { class: 'tiny muted' }, m.creature),
    h('span', { class: 'beast-stats' }, h('span', {}, icon('shield', 13), m.ac), h('span', {}, icon('heart', 13), m.hp), h('span', {}, icon('sword', 13), m.attacks.length)))));
    draw();
    modal('Bestiario', h('div', { class: 'stack' },
      searchBox('Buscar monstruo…', (v) => { q = v.toLowerCase(); draw(); }),
      grid, h('p', { class: 'tiny muted' }, 'Contenido del SRD 5.1 (CC-BY-4.0). Al elegir uno se crea una ficha de enemigo que puedes editar.')),
    [], { wide: true, iconName: 'book' });
  }

  async function saveAll(chars) {
    await Promise.all(chars.map((c) => api.update('characters', c).catch(toastError)));
    render();
  }

  async function partyRest(kind) {
    const party = state.chars.filter((c) => c.type === 'jugador');
    if (!party.length) return toast('No hay jugadores todavía.');
    party.forEach(kind === 'largo' ? longRest : shortRest);
    if (kind === 'largo') sfx.heal(); else sfx.page();
    await saveAll(party);
    toast(kind === 'largo' ? 'Descanso largo: PG, espacios de conjuro y recursos recuperados.' : 'Descanso corto: recursos recuperados. Cada uno puede gastar dados de golpe en su ficha.',
      { kind: 'good', iconName: kind === 'largo' ? 'moon' : 'hourglass' });
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
  const rollAs = (c, expr, label, mode = '') => roll(expr, { label: `${c.name}: ${label}`, who: c.name, mode, color: c.color });
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
        h('div', { class: 'sheet-row1' }, abilitiesCol(c), savesSkillsCol(c), combatCol(c)),
        attacksSection(c),
        h('div', { class: 'sheet-row3' }, spellsSection(c), resourcesSection(c), inventorySection(c)),
        h('div', { class: 'sheet-row4' }, notesSection(c))));
  }

  const section = (title, iconName, ...content) => h('section', { class: 'ssec' }, h('h3', { class: 'ssec-title' }, icon(iconName, 17), title), ...content);
  const sbox = (label, content, tip) => h('div', { class: 'sbox', 'data-tip': tip }, content, h('span', { class: 'sbox-label' }, label));

  function headerSection(c) {
    const portrait = h('button', { class: 'portrait', type: 'button', style: { '--c': c.color, backgroundImage: c.portrait ? `url("${c.portrait}")` : null }, 'data-tip': 'Cambiar el retrato' },
      !c.portrait && h('span', {}, initials(c.name)), h('span', { class: 'portrait-edit' }, icon('image', 16)));
    portrait.addEventListener('click', async () => {
      const [file] = await pickFiles('image/*');
      if (!file) return;
      try {
        const up = await api.upload(file);
        await api.removeUpload(c.portrait);
        c.portrait = up.url;
        save(c);
        refresh();
      } catch (e) { toastError(e); }
    });

    let fields;
    if (c.type === 'jugador') {
      const xp = xpProgress(c.xp, ref.level_xp);
      fields = [field('Jugador/a', txt(c, 'player')), field('Raza', txt(c, 'race')), field('Clase', txt(c, 'cls')),
        field('Nivel', num(c, 'level', { min: 1, max: 20, onCommit: refresh })), field('Trasfondo', txt(c, 'background')), field('Alineamiento', txt(c, 'alignment')),
        h('div', { class: 'xp-box' },
          h('div', { class: 'row between nowrap' }, h('span', { class: 'sbox-label' }, 'Experiencia'), num(c, 'xp', { min: 0, onCommit: refresh })),
          h('div', { class: 'xp-bar' }, h('i', { style: { width: `${Math.min(1, xp.ratio) * 100}%` } })),
          h('div', { class: 'tiny muted' }, xp.next ? `${(xp.next - (c.xp || 0)).toLocaleString('es-ES')} PX para el nivel ${xp.level + 1}` : 'Nivel máximo'),
          xp.level > (c.level || 1) && h('button', { class: 'btn xs primary', type: 'button', onclick: () => { c.level = xp.level; save(c); refresh(); sfx.levelup(); bigBanner(`¡Nivel ${c.level}!`, c.name, 'gold', 'sparkle'); toast(`${c.name} sube a nivel ${c.level}.`, { kind: 'good', iconName: 'sparkle' }); } }, icon('sparkle', 13), `¡Subir a nivel ${xp.level}!`))];
    } else if (c.type === 'pnj') {
      fields = [field('Raza', txt(c, 'race')), field('Ocupación', txt(c, 'cls')), field('Ubicación', txt(c, 'location')),
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

  function attitudeSel(c) {
    return selectEl([['amistoso', '😊 Amistoso'], ['neutral', '😐 Neutral'], ['hostil', '😠 Hostil']], c.attitude, (v) => { c.attitude = v; save(c); });
  }

  function abilitiesCol(c) {
    return h('div', { class: 'abil-col' }, ABILITY_KEYS.map((k) => {
      const name = ref.abilities.find((a) => a.key === k).name;
      return h('div', { class: 'abil' },
        h('span', { class: 'abil-name' }, name),
        h('button', { class: 'abil-mod', type: 'button', 'data-tip': `Prueba de ${name}`, onclick: () => rollAs(c, `1d20${fmtMod(mod(c.abilities[k]))}`, `Prueba de ${name}`, state.attackMode) }, fmtMod(mod(c.abilities[k]))),
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
        h('button', { class: `inspiration ${c.inspiration ? 'on' : ''}`, type: 'button', 'data-tip': 'Inspiración', onclick: () => { c.inspiration = !c.inspiration; save(c); refresh(); } }, icon('star', 26), h('span', { class: 'sbox-label' }, 'Inspiración'))),
      section('Tiradas de salvación', 'shield',
        h('ul', { class: 'prof-list' }, ABILITY_KEYS.map((k) => {
          const name = ref.abilities.find((a) => a.key === k).name;
          return profRow(c.saves.includes(k) ? 1 : 0, marks,
            () => { c.saves = c.saves.includes(k) ? c.saves.filter((x) => x !== k) : [...c.saves, k]; save(c); refresh(); },
            saveBonus(c, k), name, () => rollAs(c, `1d20${fmtMod(saveBonus(c, k))}`, `Salvación de ${name}`, state.attackMode));
        }))),
      section('Habilidades', 'target',
        h('ul', { class: 'prof-list' }, ref.skills.map((s) => profRow(c.skills[s.key] || 0, marks,
          () => { c.skills[s.key] = ((c.skills[s.key] || 0) + 1) % 3; save(c); refresh(); },
          skillBonus(c, s), s.name, () => rollAs(c, `1d20${fmtMod(skillBonus(c, s))}`, s.name, state.attackMode), ABILITY_SHORT[s.ability]))),
        h('p', { class: 'tiny muted' }, 'Pulsa el círculo para competencia (●) o pericia (◆); el nombre, para tirar.')),
      sbox('Sabiduría (Percepción) pasiva', h('b', { class: 'big-num' }, passivePerception(c))));
  }

  function combatCol(c) {
    const acShield = h('label', { class: 'ac-shield', 'data-tip': 'Clase de Armadura' });
    acShield.innerHTML = '<svg viewBox="0 0 48 54" aria-hidden="true"><path d="M24 2 44 8.5v15.2C44 37 35.5 46 24 51 12.5 46 4 37 4 23.7V8.5z" fill="rgba(255,250,235,.55)" stroke="#6b4a26" stroke-width="2.4"/></svg>';
    acShield.append(bind(c, 'ac', { type: 'number', 'aria-label': 'Clase de Armadura', onChange: () => save(c) }), h('span', { class: 'sbox-label' }, 'CA'));

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
        h('div', { class: 'hp-max' }, num(c, 'maxHp', { onCommit: refresh, 'aria-label': 'PG máximos' }), h('span', { class: 'sbox-label' }, 'Máximo')),
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
        const r = await rollAs(c, '1d20', 'Salvación de muerte');
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

    const exhaustion = h('div', { class: 'exhaustion', 'data-tip': c.exhaustion ? ref.exhaustion.slice(0, c.exhaustion).join(' · ') : 'Sin agotamiento' },
      [1, 2, 3, 4, 5, 6].map((n) => h('button', { class: `ex-pip ${c.exhaustion >= n ? 'on' : ''}`, type: 'button', 'aria-label': `Agotamiento ${n}`,
        onclick: () => { c.exhaustion = c.exhaustion === n ? n - 1 : n; save(c); refresh(); } }, n)));

    const condAdd = selectEl([['', '+ Añadir estado'], ...ref.conditions.map((x) => x.name).filter((n) => !c.conditions.includes(n)).map((n) => [n, condLabel(n)])], '', (v) => {
      if (v) { c.conditions.push(v); save(c); refresh(); }
    }, { class: 'cond-add', 'aria-label': 'Añadir estado' });

    return h('div', { class: 'combat-col' },
      h('div', { class: 'combat-top' }, acShield,
        sbox('Iniciativa', h('div', { class: 'row nowrap' },
          h('button', { class: 'big-num roll-num', type: 'button', 'data-tip': 'Tirar iniciativa', onclick: () => rollAs(c, `1d20${fmtMod(initBonus(c))}`, 'Iniciativa', state.attackMode) }, fmtMod(initBonus(c))),
          bind(c, 'initBonus', { class: 'inline mini', placeholder: 'auto', onChange: () => save(c), onCommit: refresh, 'aria-label': 'Bonificador de iniciativa (vacío = Destreza)' }))),
        sbox('Velocidad', h('div', { class: 'row nowrap' }, num(c, 'speed', { class: 'inline mini' }), h('span', { class: 'tiny' }, 'pies')))),
      hpCard,
      h('div', { class: 'inline-boxes' }, hitDice, deathSaves),
      section('Estado', 'aura',
        h('div', { class: 'row' }, h('span', { class: 'sbox-label' }, 'Agotamiento'), exhaustion),
        h('div', { class: 'row cond-row' },
          c.conditions.map((name) => h('span', { class: 'chip cond', 'data-tip': ref.conditions.find((x) => x.name === name)?.text || '' }, condLabel(name),
            h('button', { type: 'button', 'aria-label': `Quitar ${name}`, onclick: () => { c.conditions = c.conditions.filter((x) => x !== name); save(c); refresh(); } }, '✕'))),
          condAdd)));
  }

  function attacksSection(c) {
    const rows = c.attacks.map((a, i) => h('div', { class: 'atk-row' },
      bind(a, 'name', { onChange: () => save(c), 'aria-label': 'Nombre del ataque', class: 'atk-name' }),
      bind(a, 'bonus', { type: 'number', class: 'inline', onChange: () => save(c), 'aria-label': 'Bonificador de ataque' }),
      bind(a, 'damage', { onChange: () => save(c), placeholder: '1d8+3', 'aria-label': 'Daño', class: 'atk-dmg' }),
      bind(a, 'notes', { onChange: () => save(c), placeholder: 'cortante, alcance 5 pies…', 'aria-label': 'Notas', class: 'atk-notes' }),
      h('div', { class: 'row nowrap' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => rollAs(c, `1d20${fmtMod(Number(a.bonus) || 0)}`, `Ataque con ${a.name}`, state.attackMode) }, icon('dados', 15), 'Atacar'),
        h('button', { class: 'btn sm', type: 'button', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, a.damage, `Daño de ${a.name}`) }, icon('drop', 15), 'Daño'),
        h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Crítico: dados de daño dobles', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, critExpr(a.damage), `Crítico con ${a.name}`) }, '×2'),
        h('button', { class: 'btn sm icon ghost', type: 'button', 'aria-label': 'Quitar ataque', onclick: () => { c.attacks.splice(i, 1); save(c); refresh(); } }, icon('trash', 15)))));
    return section('Ataques y conjuros de ataque', 'sword',
      h('div', { class: 'row between' }, h('span', { class: 'tiny muted' }, 'Las pruebas, salvaciones y ataques usan este modo:'),
        segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.attackMode, (v) => { state.attackMode = v; })),
      rows.length ? h('div', { class: 'atk-list' }, h('div', { class: 'atk-row atk-head' }, ['Nombre', 'Ataque', 'Daño', 'Notas', ''].map((t) => h('span', {}, t))), rows)
        : h('p', { class: 'muted small' }, 'Sin ataques todavía.'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => {
        c.attacks.push({ name: 'Nuevo ataque', bonus: profBonus(c) + mod(c.abilities.fue), damage: `1d6${fmtMod(mod(c.abilities.fue))}`, notes: '' });
        save(c); refresh();
      } }, icon('plus', 15), 'Añadir ataque'));
  }

  function spellsSection(c) {
    const ab = c.spellAbility;
    const dc = ab ? 8 + profBonus(c) + mod(c.abilities[ab]) : null;
    const used = c.slots.some((s) => s.max > 0);
    return section('Conjuros', 'wand',
      h('div', { class: 'inline-boxes' },
        sbox('Aptitud mágica', selectEl([['', '—'], ...ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]])], ab, (v) => { c.spellAbility = v; save(c); refresh(); })),
        ab && sbox('CD salvación', h('b', { class: 'big-num' }, dc)),
        ab && sbox('Ataque', h('button', { class: 'big-num roll-num', type: 'button', onclick: () => rollAs(c, `1d20${fmtMod(dc - 8)}`, 'Ataque de conjuro', state.attackMode) }, fmtMod(dc - 8)))),
      h('div', { class: 'slots' }, c.slots.map((s, i) => (used || i < 3) && h('div', { class: 'slot' },
        h('span', { class: 'slot-lvl' }, i + 1),
        bind(s, 'max', { type: 'number', class: 'inline mini', min: 0, max: 9, onChange: () => save(c), onCommit: refresh, 'aria-label': `Espacios de nivel ${i + 1}` }),
        h('div', { class: 'gems' }, Array.from({ length: s.max || 0 }, (_, j) => h('button', {
          type: 'button', class: `gem ${j < s.used ? 'used' : ''}`, 'aria-label': `Espacio ${j + 1} de nivel ${i + 1}`,
          onclick: () => { s.used = j < s.used ? j : j + 1; save(c); refresh(); },
        })))))),
      field('Conjuros conocidos / preparados', bind(c, 'spells', { type: 'textarea', rows: 5, onChange: () => save(c), placeholder: 'Trucos: Luz, Mano de mago…' })));
  }

  function resourcesSection(c) {
    return section('Recursos', 'flame',
      h('p', { class: 'tiny muted' }, 'Furia, ki, canalizar divinidad, cargas de objetos…'),
      c.resources.map((r, i) => h('div', { class: 'res-row' },
        h('div', { class: 'row nowrap' }, bind(r, 'name', { class: 'grow', onChange: () => save(c), 'aria-label': 'Recurso' }),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar recurso', onclick: () => { c.resources.splice(i, 1); save(c); refresh(); } }, icon('trash', 14))),
        h('div', { class: 'row nowrap' },
          h('div', { class: 'gems' }, Array.from({ length: Math.min(r.max || 0, 20) }, (_, j) => h('button', {
            type: 'button', class: `gem round ${j < (r.max - (r.used || 0)) ? '' : 'used'}`, 'aria-label': `Uso ${j + 1}`,
            onclick: () => { const left = r.max - (r.used || 0); r.used = r.max - (j < left ? j : j + 1); save(c); refresh(); },
          }))),
          h('span', { class: 'tiny muted' }, 'máx'), num(r, 'max', { class: 'inline mini', min: 0, onCommit: refresh }),
          selectEl([['corto', 'D. corto'], ['largo', 'D. largo'], ['nunca', 'Nunca']], r.reset, (v) => { r.reset = v; save(c); }, { class: 'mini-sel', 'aria-label': 'Se recupera con' })))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { c.resources.push({ name: 'Recurso', max: 2, used: 0, reset: 'largo' }); save(c); refresh(); } }, icon('plus', 15), 'Añadir recurso'));
  }

  function inventorySection(c) {
    return section('Inventario', 'coins',
      h('div', { class: 'coins' }, COINS.map(([k, l, col]) => h('label', { class: 'coin', 'data-tip': l },
        h('span', { class: 'coin-face', style: { '--coin': col } }, k.toUpperCase()), bind(c.coins, k, { type: 'number', min: 0, onChange: () => save(c), 'aria-label': l })))),
      h('ul', { class: 'items' }, c.inventory.map((it, i) => h('li', {},
        bind(it, 'qty', { type: 'number', class: 'inline mini', min: 0, onChange: () => save(c), 'aria-label': 'Cantidad' }),
        bind(it, 'name', { class: 'grow', onChange: () => save(c), placeholder: 'Objeto', 'aria-label': 'Objeto' }),
        bind(it, 'notes', { class: 'item-notes', placeholder: 'notas', onChange: () => save(c), 'aria-label': 'Notas' }),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar objeto', onclick: () => { c.inventory.splice(i, 1); save(c); refresh(); } }, icon('trash', 14))))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { c.inventory.push({ name: '', qty: 1, notes: '' }); save(c); refresh(); } }, icon('plus', 15), 'Añadir objeto'));
  }

  function notesSection(c) {
    return [
      section('Rasgos, dotes y capacidades', 'sparkle',
        bind(c, 'features', { type: 'textarea', rows: 6, onChange: () => save(c) }),
        field('Idiomas y competencias', bind(c, 'languages', { onChange: () => save(c) }))),
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
