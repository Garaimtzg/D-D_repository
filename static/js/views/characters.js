// Personajes: jugadores, personajes de la historia (PNJ) y enemigos, con ficha completa.
import { api, debounced } from '../core/api.js';
import {
  h, clear, bind, field, selectEl, segmented, hpBar, avatar, modal, confirmDialog,
  toast, toastError, pickFiles,
} from '../core/dom.js';
import {
  TYPES, TYPE_LABEL, TYPE_COLOR, ABILITY_KEYS, ABILITY_SHORT, CRS, reference, monsters,
  mod, fmtMod, profBonus, initBonus, saveBonus, skillBonus, passivePerception,
  newCharacter, fromMonster, applyDamage, applyHealing, longRest, shortRest, combatantFrom,
} from '../core/dnd.js';
import { roll } from '../core/dice.js';

const ICON = '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c3 0 5.5 2 5.5 5"/>';

export default { id: 'personajes', title: 'Personajes', icon: ICON, mount };

async function mount(root, [selId]) {
  const [ref, raw] = await Promise.all([reference(), api.list('characters')]);
  const list = raw.map((c) => ({ ...newCharacter(c.type), ...c })); // fichas antiguas reciben los campos nuevos
  const state = { chars: list, filter: 'todos', search: '', sel: list.find((c) => c.id === selId) || null, attackMode: '' };

  const side = h('aside', { class: 'sidebar card' });
  const main = h('section');
  root.append(h('div', { class: 'split' }, side, main));

  const save = debounced(async (ch) => {
    try {
      const saved = await api.update('characters', ch);
      ch.updated = saved.updated;
    } catch (e) { toastError(e); }
  }, 400);
  const changed = () => { save(state.sel); renderList(); };

  // -- Lista ---------------------------------------------------------------
  const listEl = h('ul', { class: 'list' });
  const searchEl = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar personaje',
    oninput: () => { state.search = searchEl.value.toLowerCase(); renderList(); } });

  clear(side,
    h('div', { class: 'row between' }, h('h3', {}, 'Personajes'),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: createDialog }, '+ Nuevo'),
        h('button', { class: 'btn sm', type: 'button', onclick: bestiaryDialog, title: 'Crear un enemigo desde el bestiario' }, 'Bestiario'))),
    segmented([['todos', 'Todos'], ['jugador', 'Jugadores'], ['pnj', 'PNJ'], ['enemigo', 'Enemigos']], 'todos',
      (v) => { state.filter = v; renderList(); }),
    h('div', { style: { margin: '8px 0' } }, searchEl),
    listEl,
    h('div', { class: 'eyebrow' }, 'Grupo de jugadores'),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('corto') }, 'Descanso corto'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => partyRest('largo') }, 'Descanso largo'),
      h('button', { class: 'btn sm', type: 'button', onclick: awardXp }, 'Dar PX')),
  );

  function visible() {
    return state.chars
      .filter((c) => state.filter === 'todos' || c.type === state.filter)
      .filter((c) => !state.search || `${c.name} ${c.race} ${c.cls} ${c.location}`.toLowerCase().includes(state.search))
      .sort((a, b) => TYPES.findIndex((t) => t[0] === a.type) - TYPES.findIndex((t) => t[0] === b.type) || a.name.localeCompare(b.name));
  }

  function subtitle(c) {
    if (c.type === 'enemigo') return [c.creature, c.cr !== '' && `VD ${c.cr}`].filter(Boolean).join(' · ');
    if (c.type === 'pnj') return [c.race, c.cls, c.location].filter(Boolean).join(' · ');
    return [c.race, c.cls, `nv ${c.level}`].filter(Boolean).join(' · ');
  }

  function renderList() {
    const items = visible();
    clear(listEl, items.length ? items.map((c) => h('li', {
      'aria-selected': String(c === state.sel), onclick: () => select(c),
    }, avatar(c), h('div', { class: 'grow' },
      h('div', { class: 'row between' }, h('b', {}, c.name), h('span', { class: `chip ${c.type}` }, TYPE_LABEL[c.type].split(' ')[0])),
      h('div', { class: 'small muted' }, subtitle(c)),
      hpBar(c.hp, c.maxHp)))) : h('li', { class: 'muted' }, 'No hay personajes aquí todavía.'));
  }

  function select(c) {
    if (save.pending) save.flush();
    state.sel = c;
    history.replaceState(null, '', c ? `#/personajes/${c.id}` : '#/personajes');
    renderList();
    renderSheet();
  }

  // -- Crear ---------------------------------------------------------------
  async function create(doc) {
    try {
      const saved = await api.create('characters', doc);
      state.chars.push(saved);
      select(saved);
      return saved;
    } catch (e) { toastError(e); }
  }

  async function createDialog() {
    const type = await modal('Nuevo personaje', h('p', { class: 'muted' }, '¿Qué tipo de personaje quieres crear?'),
      [{ label: 'Cancelar', value: null }, ...TYPES.map(([v, l]) => ({ label: l, value: v, class: 'primary' }))]);
    if (type) create(newCharacter(type));
  }

  async function bestiaryDialog() {
    const all = await monsters();
    const listBox = h('ul', { class: 'list', style: { maxHeight: '50vh', overflow: 'auto' } });
    let chosen = null;
    const filterEl = h('input', { type: 'search', placeholder: 'Filtrar por nombre…', oninput: draw });
    function draw() {
      const q = filterEl.value.toLowerCase();
      clear(listBox, all.filter((m) => m.name.toLowerCase().includes(q)).map((m) => h('li', {
        onclick: () => { chosen = m; listBox.closest('.modal').querySelector('.primary').click(); },
      }, h('b', { class: 'grow' }, m.name), h('span', { class: 'small muted' }, `VD ${m.cr} · CA ${m.ac} · ${m.hp} PG`))));
    }
    draw();
    const ok = await modal('Bestiario (SRD)', h('div', { class: 'stack' }, filterEl, listBox,
      h('p', { class: 'small muted' }, 'Pulsa un monstruo para crear una ficha de enemigo editable.')),
    [{ label: 'Cancelar', value: null }, { label: 'Crear', value: true, class: 'primary' }]);
    if (ok && chosen) create(fromMonster(chosen));
  }

  // -- Acciones de grupo ---------------------------------------------------
  async function saveAll(chars) {
    await Promise.all(chars.map((c) => api.update('characters', c).catch(toastError)));
    renderList();
    if (state.sel) renderSheet();
  }

  async function partyRest(kind) {
    const party = state.chars.filter((c) => c.type === 'jugador');
    if (!party.length) return toast('No hay jugadores todavía.');
    party.forEach(kind === 'largo' ? longRest : shortRest);
    await saveAll(party);
    toast(kind === 'largo' ? 'Descanso largo: PG, espacios y recursos recuperados.' : 'Descanso corto: recursos de descanso corto recuperados. Gastad dados de golpe en cada ficha.');
  }

  async function awardXp() {
    const party = state.chars.filter((c) => c.type === 'jugador');
    if (!party.length) return toast('No hay jugadores todavía.');
    const amount = h('input', { type: 'number', min: 0, value: 100 });
    const split = h('input', { type: 'checkbox', checked: true });
    const ok = await modal('Dar experiencia', h('div', { class: 'stack' },
      field('PX', amount), h('label', { class: 'check' }, split, `Repartir entre los ${party.length} jugadores`)),
    [{ label: 'Cancelar', value: null }, { label: 'Dar PX', value: true, class: 'primary' }]);
    if (!ok) return;
    const each = split.checked ? Math.floor(Number(amount.value) / party.length) : Number(amount.value);
    const { level_xp: table } = ref;
    party.forEach((c) => {
      c.xp = (c.xp || 0) + each;
      const lvl = table.filter((need) => c.xp >= need).length;
      if (lvl > (c.level || 1)) toast(`¡${c.name} puede subir a nivel ${lvl}!`, { ms: 6000 });
    });
    await saveAll(party);
    toast(`${each} PX para cada jugador.`);
  }

  // -- Ficha ---------------------------------------------------------------
  function renderSheet() {
    const c = state.sel;
    if (!c) {
      clear(main, h('div', { class: 'empty' }, h('h3', {}, 'Elige o crea un personaje'),
        h('p', {}, 'Jugadores, personajes de la historia y enemigos comparten ficha. Los enemigos pueden salir del bestiario.')));
      return;
    }
    clear(main, h('div', { class: 'sheet stack' },
      headerCard(c), combatCard(c),
      h('div', { class: 'grid cols-2' }, abilitiesCard(c), skillsCard(c)),
      attacksCard(c),
      h('div', { class: 'grid cols-2' }, spellsCard(c), resourcesCard(c)),
      h('div', { class: 'grid cols-2' }, inventoryCard(c), notesCard(c)),
    ));
  }

  const num = (obj, key, extra = {}) => bind(obj, key, { type: 'number', class: 'inline', onChange: changed, ...extra });
  const txt = (obj, key, extra = {}) => bind(obj, key, { onChange: changed, ...extra });
  const rollAs = (c, expr, label, mode = '') => roll(expr, { label: `${c.name}: ${label}`, who: c.name, mode });

  function headerCard(c) {
    const portrait = avatar(c);
    portrait.classList.add('portrait');
    portrait.title = 'Cambiar retrato';
    portrait.addEventListener('click', async () => {
      const [file] = await pickFiles('image/*');
      if (!file) return;
      try {
        const up = await api.upload(file);
        await api.removeUpload(c.portrait);
        c.portrait = up.url;
        changed();
        renderSheet();
      } catch (e) { toastError(e); }
    });

    const typeFields = {
      jugador: [field('Jugador/a', txt(c, 'player')), field('Raza', txt(c, 'race')), field('Clase', txt(c, 'cls')),
        field('Nivel', num(c, 'level', { min: 1, max: 20, onCommit: renderSheet })), field('PX', num(c, 'xp', { min: 0 })),
        field('Trasfondo', txt(c, 'background')), field('Alineamiento', txt(c, 'alignment'))],
      pnj: [field('Raza', txt(c, 'race')), field('Ocupación', txt(c, 'cls')), field('Ubicación', txt(c, 'location')),
        field('Facción', txt(c, 'faction')), field('Actitud', attitudeSel(c)), field('Nivel', num(c, 'level', { min: 1, max: 20, onCommit: renderSheet }))],
      enemigo: [field('Tipo de criatura', txt(c, 'creature')),
        field('Valor de desafío', selectEl(CRS, c.cr, (v) => { c.cr = v; changed(); renderSheet(); })),
        field('Facción', txt(c, 'faction')), field('Actitud', attitudeSel(c)),
        field('Dados de golpe', txt(c, 'hpDice', { placeholder: '2d8+2' }))],
    }[c.type];

    return h('div', { class: 'card' },
      h('div', { class: 'sheet-head' }, portrait,
        h('div', { class: 'grow stack' },
          h('div', { class: 'row' },
            bind(c, 'name', { class: 'title-input grow', 'aria-label': 'Nombre', onChange: changed }),
            selectEl(TYPES, c.type, (v) => { c.type = v; if (Object.values(TYPE_COLOR).includes(c.color)) c.color = TYPE_COLOR[v]; changed(); renderSheet(); }, { 'aria-label': 'Tipo', style: 'width:auto' }),
            bind(c, 'color', { type: 'color', onChange: changed, title: 'Color', style: 'width:44px;padding:2px' })),
          h('div', { class: 'grid auto-sm' }, typeFields))),
      h('div', { class: 'row end', style: { marginTop: '10px' } },
        h('button', { class: 'btn sm', type: 'button', onclick: () => addToCombat(c) }, '⚔ Añadir al combate activo'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => duplicate(c) }, 'Duplicar'),
        h('button', { class: 'btn sm danger', type: 'button', onclick: () => remove(c) }, 'Eliminar')));
  }

  function attitudeSel(c) {
    return selectEl([['amistoso', 'Amistoso'], ['neutral', 'Neutral'], ['hostil', 'Hostil']], c.attitude, (v) => { c.attitude = v; changed(); });
  }

  function combatCard(c) {
    const amount = h('input', { type: 'number', min: 0, class: 'inline', placeholder: '0', 'aria-label': 'Cantidad' });
    const value = () => Number(amount.value) || 0;
    const act = (fn) => () => { if (!value()) return amount.focus(); fn(value()); amount.value = ''; changed(); renderSheet(); };
    const exhaustion = selectEl([0, 1, 2, 3, 4, 5, 6].map((n) => [n, n ? `Nivel ${n}` : 'Ninguno']), c.exhaustion || 0,
      (v) => { c.exhaustion = Number(v); changed(); });

    const stats = [
      ['CA', num(c, 'ac')],
      ['Velocidad', num(c, 'speed')],
      ['Iniciativa', h('div', { class: 'row', style: { gap: '4px', justifyContent: 'center' } },
        bind(c, 'initBonus', { class: 'inline', placeholder: fmtMod(mod(c.abilities.des)), onChange: changed, title: 'Vacío = modificador de Destreza' }),
        h('button', { class: 'btn sm icon', type: 'button', title: 'Tirar iniciativa', onclick: () => rollAs(c, `1d20${fmtMod(initBonus(c))}`, 'Iniciativa') }, '🎲'))],
      ['Competencia', h('b', { class: 'stat-big' }, fmtMod(profBonus(c)))],
      ['Percepción pasiva', h('b', { class: 'stat-big' }, passivePerception(c))],
    ];

    const hitDice = c.type === 'enemigo'
      ? h('button', { class: 'btn sm', type: 'button', disabled: !c.hpDice, onclick: async () => {
        const r = await rollAs(c, c.hpDice, 'Puntos de golpe');
        if (r) { c.maxHp = c.hp = Math.max(1, r.total); changed(); renderSheet(); }
      } }, 'Tirar PG')
      : h('div', { class: 'row' }, field('Dado de golpe', bind(c, 'hitDie', { class: 'inline', onChange: changed })),
        field('Quedan', num(c, 'hitDiceLeft', { min: 0 })),
        h('button', { class: 'btn sm', type: 'button', disabled: !(c.hitDiceLeft > 0), title: 'Descanso corto: gastar un dado de golpe', onclick: async () => {
          const r = await rollAs(c, `1${c.hitDie || 'd8'}${fmtMod(mod(c.abilities.con))}`, 'Dado de golpe');
          if (r) { applyHealing(c, Math.max(0, r.total)); c.hitDiceLeft -= 1; changed(); renderSheet(); }
        } }, 'Gastar'));

    return h('div', { class: 'card' },
      h('div', { class: 'combat-grid' },
        h('div', { class: 'hp-box' },
          h('div', { class: 'eyebrow' }, 'Puntos de golpe'),
          h('div', { class: 'row', style: { gap: '4px' } }, num(c, 'hp', { onCommit: renderSheet, 'aria-label': 'PG actuales' }), ' / ',
            num(c, 'maxHp', { onCommit: renderSheet, 'aria-label': 'PG máximos' }), h('span', { class: 'muted small' }, 'temp'), num(c, 'tempHp', { 'aria-label': 'PG temporales' })),
          hpBar(c.hp, c.maxHp),
          h('div', { class: 'row', style: { marginTop: '6px' } }, amount,
            h('button', { class: 'btn sm danger', type: 'button', onclick: act((v) => applyDamage(c, v)) }, 'Daño'),
            h('button', { class: 'btn sm', type: 'button', onclick: act((v) => applyHealing(c, v)) }, 'Curar'),
            h('button', { class: 'btn sm', type: 'button', onclick: act((v) => { c.tempHp = Math.max(c.tempHp || 0, v); }) }, 'Temp')),
          h('div', { style: { marginTop: '6px' } }, hitDice)),
        h('div', { class: 'stat-row' }, stats.map(([l, ctrl]) => h('div', { class: 'stat' }, h('div', { class: 'eyebrow' }, l), ctrl))),
      ),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('label', { class: 'check' }, bind(c, 'inspiration', { type: 'checkbox', onChange: changed }), 'Inspiración'),
        field('Agotamiento', exhaustion),
        c.type === 'jugador' && deathSaves(c)),
      conditionsRow(c));
  }

  function deathSaves(c) {
    const pips = (key, label) => h('span', { class: 'row', style: { gap: '3px' } }, label,
      [0, 1, 2].map((i) => h('input', { type: 'checkbox', checked: c.deathSaves[key] > i, 'aria-label': `${label} ${i + 1}`,
        onchange: (e) => { c.deathSaves[key] = e.target.checked ? i + 1 : i; changed(); } })));
    return h('div', { class: 'row death' }, h('b', {}, 'Salvaciones de muerte'), pips('ok', 'Éxitos'), pips('ko', 'Fallos'),
      h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        const r = await rollAs(c, '1d20', 'Salvación de muerte');
        if (!r) return;
        const ds = c.deathSaves;
        if (r.natural === 20) { c.hp = 1; c.deathSaves = { ok: 0, ko: 0 }; toast(`${c.name} vuelve en sí con 1 PG.`); }
        else if (r.natural === 1) ds.ko = Math.min(3, ds.ko + 2);
        else if (r.total >= 10) ds.ok = Math.min(3, ds.ok + 1);
        else ds.ko = Math.min(3, ds.ko + 1);
        if (c.deathSaves.ko >= 3) toast(`${c.name} ha muerto.`, { kind: 'error' });
        else if (c.deathSaves.ok >= 3) toast(`${c.name} está estable.`);
        changed(); renderSheet();
      } }, 'Tirar'));
  }

  function conditionsRow(c) {
    const add = selectEl([['', '+ Estado…'], ...ref.conditions.map((x) => x.name).filter((n) => !c.conditions.includes(n))], '', (v) => {
      if (v) { c.conditions.push(v); changed(); renderSheet(); }
    }, { style: 'width:auto' });
    return h('div', { class: 'row', style: { marginTop: '8px' } },
      c.conditions.map((name) => h('span', { class: 'chip', title: ref.conditions.find((x) => x.name === name)?.text || '' }, name,
        h('button', { type: 'button', 'aria-label': `Quitar ${name}`, onclick: () => { c.conditions = c.conditions.filter((x) => x !== name); changed(); renderSheet(); } }, '✕'))),
      add);
  }

  function abilitiesCard(c) {
    return h('div', { class: 'card' }, h('h3', {}, 'Características'),
      h('div', { class: 'abilities' }, ABILITY_KEYS.map((k) => {
        const name = ref.abilities.find((a) => a.key === k).name;
        return h('div', { class: 'ability' },
          h('div', { class: 'eyebrow' }, ABILITY_SHORT[k]),
          h('button', { class: 'ability-mod', type: 'button', title: `Prueba de ${name}`, onclick: () => rollAs(c, `1d20${fmtMod(mod(c.abilities[k]))}`, `Prueba de ${name}`) }, fmtMod(mod(c.abilities[k]))),
          bind(c.abilities, k, { type: 'number', class: 'inline', min: 1, max: 30, onChange: changed, onCommit: renderSheet, 'aria-label': name }),
          h('div', { class: 'row', style: { gap: '4px', justifyContent: 'center', marginTop: '4px' } },
            h('input', { type: 'checkbox', checked: c.saves.includes(k), title: 'Competente en la salvación',
              onchange: (e) => { c.saves = e.target.checked ? [...c.saves, k] : c.saves.filter((x) => x !== k); changed(); renderSheet(); } }),
            h('button', { class: 'btn sm ghost', type: 'button', title: `Salvación de ${name}`, onclick: () => rollAs(c, `1d20${fmtMod(saveBonus(c, k))}`, `Salvación de ${name}`) }, `Salv ${fmtMod(saveBonus(c, k))}`)));
      })));
  }

  function skillsCard(c) {
    const marks = ['○', '●', '◆'];
    return h('div', { class: 'card' }, h('h3', {}, 'Habilidades'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, '○ sin competencia · ● competente · ◆ pericia. Pulsa el nombre para tirar.'),
      h('ul', { class: 'skills' }, ref.skills.map((s) => h('li', {},
        h('button', { class: 'prof', type: 'button', title: 'Cambiar competencia', onclick: () => {
          c.skills[s.key] = ((c.skills[s.key] || 0) + 1) % 3; changed(); renderSheet();
        } }, marks[c.skills[s.key] || 0]),
        h('button', { class: 'skill-name', type: 'button', onclick: () => rollAs(c, `1d20${fmtMod(skillBonus(c, s))}`, s.name) },
          s.name, h('span', { class: 'muted small' }, ` (${ABILITY_SHORT[s.ability]})`)),
        h('b', { class: 'tnum' }, fmtMod(skillBonus(c, s)))))));
  }

  function attacksCard(c) {
    const rows = c.attacks.map((a, i) => h('tr', {},
      h('td', {}, bind(a, 'name', { onChange: changed, 'aria-label': 'Nombre del ataque' })),
      h('td', {}, bind(a, 'bonus', { type: 'number', class: 'inline', onChange: changed, 'aria-label': 'Bonificador' })),
      h('td', {}, bind(a, 'damage', { onChange: changed, placeholder: '1d8+3', 'aria-label': 'Daño' })),
      h('td', {}, bind(a, 'notes', { onChange: changed, placeholder: 'cortante, alcance…', 'aria-label': 'Notas' })),
      h('td', { class: 'row', style: { flexWrap: 'nowrap' } },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => rollAs(c, `1d20${fmtMod(Number(a.bonus) || 0)}`, `Ataque con ${a.name}`, state.attackMode) }, 'Atacar'),
        h('button', { class: 'btn sm', type: 'button', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, a.damage, `Daño de ${a.name}`) }, 'Daño'),
        h('button', { class: 'btn sm', type: 'button', title: 'Daño crítico (dados dobles)', disabled: !a.damage || a.damage === '0', onclick: () => rollAs(c, critExpr(a.damage), `Crítico con ${a.name}`) }, 'Crít'),
        h('button', { class: 'btn sm icon danger', type: 'button', 'aria-label': 'Quitar ataque', onclick: () => { c.attacks.splice(i, 1); changed(); renderSheet(); } }, '✕'))));
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, 'Ataques'),
        segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], state.attackMode, (v) => { state.attackMode = v; })),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Nombre', 'Ataque', 'Daño', 'Notas', ''].map((t) => h('th', {}, t)))), h('tbody', {}, rows)))
        : h('p', { class: 'muted' }, 'Sin ataques.'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => {
        c.attacks.push({ name: 'Nuevo ataque', bonus: profBonus(c) + mod(c.abilities.fue), damage: `1d6${fmtMod(mod(c.abilities.fue))}`, notes: '' });
        changed(); renderSheet();
      } }, '+ Añadir ataque'));
  }

  function spellsCard(c) {
    const ab = c.spellAbility;
    const dc = ab ? 8 + profBonus(c) + mod(c.abilities[ab]) : null;
    return h('div', { class: 'card' }, h('h3', {}, 'Conjuros'),
      h('div', { class: 'row' },
        field('Característica', selectEl([['', '—'], ...ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]])], ab, (v) => { c.spellAbility = v; changed(); renderSheet(); })),
        ab && h('div', { class: 'stat' }, h('div', { class: 'eyebrow' }, 'CD'), h('b', { class: 'stat-big' }, dc)),
        ab && h('div', { class: 'stat' }, h('div', { class: 'eyebrow' }, 'Ataque'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => rollAs(c, `1d20${fmtMod(dc - 8)}`, 'Ataque de conjuro', state.attackMode) }, fmtMod(dc - 8)))),
      h('div', { class: 'eyebrow' }, 'Espacios de conjuro (máximo y gastados)'),
      h('div', { class: 'slots' }, c.slots.map((s, i) => h('div', { class: 'slot' },
        h('span', { class: 'small muted' }, `Nv ${i + 1}`),
        bind(s, 'max', { type: 'number', class: 'inline', min: 0, max: 9, onChange: changed, onCommit: renderSheet, 'aria-label': `Espacios de nivel ${i + 1}` }),
        h('div', { class: 'pips' }, Array.from({ length: s.max || 0 }, (_, j) => h('button', {
          type: 'button', class: j < s.used ? 'pip used' : 'pip', 'aria-label': `Espacio ${j + 1}`,
          onclick: () => { s.used = j < s.used ? j : j + 1; changed(); renderSheet(); },
        })))))),
      field('Conjuros conocidos / preparados', bind(c, 'spells', { type: 'textarea', rows: 5, onChange: changed })));
  }

  function resourcesCard(c) {
    return h('div', { class: 'card' }, h('h3', {}, 'Recursos'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Furia, Ki, Canalizar divinidad, cargas de objetos…'),
      c.resources.map((r, i) => h('div', { class: 'row resource' },
        bind(r, 'name', { class: 'grow', onChange: changed, 'aria-label': 'Recurso' }),
        h('button', { class: 'btn sm icon', type: 'button', onclick: () => { r.used = Math.min(r.max, (r.used || 0) + 1); changed(); renderSheet(); } }, '−'),
        h('b', { class: 'tnum' }, `${(r.max || 0) - (r.used || 0)}/`),
        bind(r, 'max', { type: 'number', class: 'inline', min: 0, onChange: changed, onCommit: renderSheet, 'aria-label': 'Máximo' }),
        h('button', { class: 'btn sm icon', type: 'button', onclick: () => { r.used = Math.max(0, (r.used || 0) - 1); changed(); renderSheet(); } }, '+'),
        selectEl([['corto', 'Desc. corto'], ['largo', 'Desc. largo'], ['nunca', 'No se recupera']], r.reset, (v) => { r.reset = v; changed(); }, { style: 'width:auto' }),
        h('button', { class: 'btn sm icon danger', type: 'button', 'aria-label': 'Quitar recurso', onclick: () => { c.resources.splice(i, 1); changed(); renderSheet(); } }, '✕'))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { c.resources.push({ name: 'Recurso', max: 1, used: 0, reset: 'largo' }); changed(); renderSheet(); } }, '+ Añadir recurso'));
  }

  function inventoryCard(c) {
    const coins = [['pc', 'Cobre'], ['pa', 'Plata'], ['pe', 'Electro'], ['po', 'Oro'], ['pp', 'Platino']];
    return h('div', { class: 'card' }, h('h3', {}, 'Inventario'),
      h('div', { class: 'coins' }, coins.map(([k, l]) => field(l, bind(c.coins, k, { type: 'number', min: 0, onChange: changed })))),
      h('div', { class: 'eyebrow' }, 'Objetos'),
      c.inventory.map((it, i) => h('div', { class: 'row', style: { marginBottom: '4px' } },
        bind(it, 'qty', { type: 'number', class: 'inline', min: 0, onChange: changed, 'aria-label': 'Cantidad' }),
        bind(it, 'name', { class: 'grow', onChange: changed, 'aria-label': 'Objeto' }),
        bind(it, 'notes', { class: 'grow', placeholder: 'notas', onChange: changed, 'aria-label': 'Notas' }),
        h('button', { class: 'btn sm icon danger', type: 'button', 'aria-label': 'Quitar objeto', onclick: () => { c.inventory.splice(i, 1); changed(); renderSheet(); } }, '✕'))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { c.inventory.push({ name: '', qty: 1, notes: '' }); changed(); renderSheet(); } }, '+ Añadir objeto'));
  }

  function notesCard(c) {
    return h('div', { class: 'card stack' }, h('h3', {}, 'Rasgos y notas'),
      field('Rasgos, dotes y capacidades', bind(c, 'features', { type: 'textarea', rows: 4, onChange: changed })),
      field('Idiomas y competencias', bind(c, 'languages', { onChange: changed })),
      field(c.type === 'jugador' ? 'Notas (historia, aliados, objetivos)' : 'Notas del máster (secretos, motivaciones, tácticas)', bind(c, 'notes', { type: 'textarea', rows: 5, onChange: changed })));
  }

  // -- Acciones de ficha ---------------------------------------------------
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
      state.sel = null;
      select(null);
    } catch (e) { toastError(e); }
  }

  async function addToCombat(c) {
    try {
      const settings = await api.settings();
      const combat = settings.activeCombat && await api.get(`/api/combats/${settings.activeCombat}`).catch(() => null);
      if (!combat || combat.status === 'finished') return toast('No hay ningún combate activo. Créalo en la sección Combate.');
      const same = combat.combatants.filter((x) => x.charId === c.id).length;
      const entry = combatantFrom(c, c.type === 'jugador' ? '' : same ? String(same + 1) : '');
      if (combat.status === 'active') {
        const r = await roll(`1d20${fmtMod(entry.initBonus)}`, { label: `${entry.name}: Iniciativa`, who: entry.name, quiet: true });
        entry.init = r?.total ?? 10;
      }
      combat.combatants.push(entry);
      await api.update('combats', combat);
      toast(`${entry.name} se une a «${combat.name}».`);
    } catch (e) { toastError(e); }
  }

  renderList();
  renderSheet();
  return () => save.pending && save.flush();
}

// "2d6+3" -> "4d6+3": en un crítico se duplican los dados, no el modificador.
export function critExpr(expr) {
  return String(expr).replace(/(\d*)d(\d+)/gi, (_, n, s) => `${(Number(n) || 1) * 2}d${s}`);
}
