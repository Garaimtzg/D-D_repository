// Bestiario de la mesa: ver las criaturas, crear una ficha a partir de una, editarlas (las del SRD, las de Euskal Herria
// o criaturas nuevas) y fijar una ficha de enemigo como modelo. Las ediciones se guardan en la colección «bestiary» y
// el servidor las aplica al servir el bestiario (server/monsters.py): cada criatura nueva que se saca ya sale así, y
// las fichas enlazadas a su modelo (campo monster) se pueden actualizar de una vez.
import { api } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, modal, confirmDialog, toast, toastError, searchBox, avatar, pickFiles } from '../core/dom.js';
import { ABILITY_KEYS, ABILITY_SHORT, CRS, mod, fmtMod, monsters, reloadMonsters, monsterStats, monsterFromCharacter, reference } from '../core/dnd.js';
import { sfx } from '../core/sfx.js';

const SIZES = ['Diminuto', 'Pequeño', 'Mediano', 'Grande', 'Enorme', 'Gargantuesco'];
const FIELDS = ['name', 'cr', 'creature', 'size', 'alignment', 'ac', 'hp', 'hpDice', 'speed', 'init', 'saves', 'abilities', 'skills', 'attacks', 'traits', 'lore', 'portrait', 'look', 'color', 'en', 'eu', 'source'];
const crNum = (cr) => { const [a, b] = String(cr).split('/'); return b ? Number(a) / Number(b) : Number(a); };
const pbFor = (cr) => (crNum(cr) < 1 ? 2 : 2 + Math.floor((Math.ceil(crNum(cr)) - 1) / 4));
const pick = (m) => Object.fromEntries(FIELDS.filter((k) => m[k] !== undefined).map((k) => [k, structuredClone(m[k])]));

// Retrato de una criatura (su foto, su muñeco o sus iniciales).
export const beastAvatar = (m, cls = '') => avatar({ name: m.name, portrait: m.portrait || '', look: m.look || null, color: m.color || '#8e2b2b' }, cls, { live: false });

// Aplica una criatura del bestiario a las fichas enlazadas a ella (salvo `except`). Conserva el nombre, las notas, el
// daño recibido (si estaban heridas) y los estados. Devuelve cuántas ha cambiado.
export async function applyToSheets(m, chars, except = null) {
  const linked = chars.filter((c) => c !== except && c.monster && c.monster === m.key);
  for (const c of linked) {
    const wasFull = (c.hp ?? 0) >= (c.maxHp ?? 0);
    const keep = { name: c.name, notes: c.notes, hp: c.hp, tempHp: c.tempHp, conditions: c.conditions };
    Object.assign(c, monsterStats(m), keep);
    c.hp = wasFull ? c.maxHp : Math.min(keep.hp ?? c.maxHp, c.maxHp);
    await api.update('characters', c).catch(toastError);
  }
  return linked.length;
}

// Guarda una criatura editada: con «base» si es del bestiario de serie, sin ella si es nueva. Devuelve la criatura ya
// aplicada (tal como la sirve el servidor) o null.
async function saveMonster(m, data) {
  const doc = { ...data, ...(m && !m.custom && m.key ? { base: m.key } : {}) };
  const saved = m?.editId ? await api.update('bestiary', { ...doc, id: m.editId }) : await api.create('bestiary', doc);
  const all = await reloadMonsters();
  return all.find((x) => x.editId === saved.id) || null;
}

// Editor de una criatura (m = null: criatura nueva). Devuelve la criatura guardada, 'reset' / 'deleted' o null.
export async function editMonster(m, chars = []) {
  const doc = m ? pick(m) : {
    name: '', cr: '1', creature: 'Bestia', size: 'Mediano', alignment: 'neutral', ac: 12, hp: 11, hpDice: '2d8+2', speed: 9, init: '',
    saves: [], abilities: { fue: 12, des: 12, con: 12, int: 6, sab: 12, car: 6 }, skills: {}, attacks: [{ name: 'Mordisco', bonus: 3, damage: '1d6+1', notes: 'perforante · alcance 1,5 m' }],
    traits: '', lore: '',
  };
  doc.skills ||= {}; doc.saves ||= []; doc.attacks ||= [];
  const R = await reference();
  const linked = m ? chars.filter((c) => c.monster === m.key) : [];
  const opts = { apply: linked.length > 0 };

  const pic = h('div', { class: 'be-pic' });
  const drawPic = () => clear(pic, beastAvatar(doc, 'xl'),
    h('div', { class: 'stack-sm' },
      h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        const [file] = await pickFiles('image/*');
        if (!file) return;
        try { doc.portrait = (await api.upload(file)).url; drawPic(); } catch (e) { toastError(e); }
      } }, icon('image', 14), doc.portrait ? 'Cambiar foto' : 'Poner una foto'),
      doc.portrait && h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { doc.portrait = ''; drawPic(); } }, icon('trash', 14), 'Quitar la foto'),
      h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Será la foto de todas las fichas y fichas de combate de esta criatura.')));
  drawPic();

  // características con su modificador y habilidades en tres estados (sin, competencia, pericia) con su bonificador
  const abil = h('div', { class: 'be-abil' });
  const skillBox = h('div', { class: 'cr-skills' });
  const drawSkills = () => clear(skillBox, R.skills.map((s) => {
    const lvl = doc.skills[s.key] || 0;
    const bonus = mod(doc.abilities[s.ability]) + lvl * pbFor(doc.cr);
    return h('button', { class: `chip pick ${lvl ? 'on' : ''} ${lvl === 2 ? 'expert' : ''}`, type: 'button', 'data-tip': lvl === 2 ? 'Pericia (doble competencia)' : lvl ? 'Competencia' : 'Sin competencia',
      onclick: () => { const n = (lvl + 1) % 3; if (n) doc.skills[s.key] = n; else delete doc.skills[s.key]; drawSkills(); } },
    lvl === 2 ? '★ ' : lvl ? '✓ ' : '', s.name, lvl ? ` ${fmtMod(bonus)}` : '');
  }));
  const drawAbil = () => clear(abil, ABILITY_KEYS.map((k) => h('label', { class: 'be-score' }, h('span', { class: 'tiny muted' }, ABILITY_SHORT[k]),
    bind(doc.abilities, k, { type: 'number', min: 1, max: 30, class: 'inline', onChange: () => { drawAbil(); drawSkills(); } }),
    h('b', {}, fmtMod(mod(doc.abilities[k]))),
    h('button', { class: `chip pick tiny ${doc.saves.includes(k) ? 'on' : ''}`, type: 'button', 'data-tip': 'Competencia en la salvación',
      onclick: () => { doc.saves = doc.saves.includes(k) ? doc.saves.filter((x) => x !== k) : [...doc.saves, k]; drawAbil(); } }, doc.saves.includes(k) ? '✓ salv.' : 'salv.'))));
  drawAbil(); drawSkills();

  const attackBox = h('div', { class: 'hb-rows' });
  const drawAttacks = () => clear(attackBox, doc.attacks.map((a, i) => h('div', { class: 'hb-row' },
    bind(a, 'name', { placeholder: 'Ataque', class: 'grow', 'aria-label': 'Nombre del ataque' }),
    bind(a, 'bonus', { placeholder: '+', class: 'inline mini', 'aria-label': 'Bonificador al ataque' }),
    bind(a, 'damage', { placeholder: '1d6+2', class: 'inline', 'aria-label': 'Daño' }),
    bind(a, 'notes', { placeholder: 'tipo · alcance · efectos', class: 'grow', 'aria-label': 'Notas' }),
    h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar', onclick: () => { doc.attacks.splice(i, 1); drawAttacks(); } }, icon('close', 12)))),
  h('button', { class: 'btn xs', type: 'button', onclick: () => { doc.attacks.push({ name: '', bonus: '', damage: '', notes: '' }); drawAttacks(); } }, icon('plus', 12), 'Añadir ataque'));
  drawAttacks();

  const crSel = selectEl(CRS, doc.cr, (v) => { doc.cr = v; drawSkills(); });
  const body = h('div', { class: 'stack hb-form be-form' },
    h('div', { class: 'row wrap', style: { alignItems: 'flex-start' } }, pic,
      h('div', { class: 'grow stack-sm' },
        h('div', { class: 'row wrap' }, field('Nombre', bind(doc, 'name', { placeholder: 'Lobo, sorgina, capitán bandido…' }), 'grow'), field('VD', crSel)),
        h('div', { class: 'row wrap' },
          field('Tipo', bind(doc, 'creature', { placeholder: 'Bestia, no muerto…' }), 'grow'),
          field('Tamaño', selectEl(SIZES, doc.size, (v) => { doc.size = v; })),
          field('Alineamiento', bind(doc, 'alignment', { placeholder: 'neutral' }))),
        h('div', { class: 'row wrap' },
          field('CA', bind(doc, 'ac', { type: 'number', min: 0, max: 40, class: 'inline mini' })),
          field('PG', bind(doc, 'hp', { type: 'number', min: 1, max: 3000, class: 'inline mini' })),
          field('Dados de golpe', bind(doc, 'hpDice', { placeholder: '2d8+2', class: 'inline' })),
          field('Velocidad (m)', bind(doc, 'speed', { type: 'number', min: 0, max: 60, step: 1.5, class: 'inline mini' })),
          field('Iniciativa', bind(doc, 'init', { placeholder: '+2', class: 'inline mini', 'data-tip': 'Bonificador a la iniciativa (vacío = el de DES)' }))))),
    h('div', { class: 'eyebrow' }, 'Características y salvaciones'), abil,
    h('div', { class: 'eyebrow' }, 'Habilidades: pulsa una vez para la competencia y otra para la pericia (★)'), skillBox,
    h('div', { class: 'eyebrow' }, 'Ataques'), attackBox,
    field('Rasgos, sentidos, idiomas y acciones', bind(doc, 'traits', { type: 'textarea', rows: 7, placeholder: 'Sentidos: visión en la oscuridad 18 m; Percepción pasiva 13.\nRasgos: …' })),
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'La línea «Habilidades: …» se escribe sola a partir de las que marques arriba.'),
    field('Descripción o leyenda (para el aspecto de la ficha)', bind(doc, 'lore', { type: 'textarea', rows: 2, placeholder: 'Cómo es, dónde vive, qué quiere…' })),
    linked.length > 0 && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: opts.apply, onchange: (e) => { opts.apply = e.target.checked; } }),
      `Aplicar también a ${linked.length === 1 ? 'la ficha' : `las ${linked.length} fichas`} de ${m.name} ya ${linked.length === 1 ? 'creada' : 'creadas'} (conservan su nombre, sus notas y el daño que lleven)`));

  const actions = [{ label: 'Cancelar', value: null },
    ...(m?.edited ? [{ label: 'Volver al original', value: 'reset', icon: 'undo' }] : []),
    ...(m?.custom ? [{ label: 'Eliminar', value: 'delete', class: 'danger', icon: 'trash' }] : []),
    { label: 'Guardar', value: 'save', class: 'primary', icon: 'check' }];
  const choice = await modal(m ? `Editar «${m.name}»` : 'Nueva criatura', body, actions, { wide: true, iconName: 'book' });
  try {
    if (choice === 'reset') {
      if (!(await confirmDialog(`«${m.name}» volverá a ser la del bestiario original.${linked.length ? ' Las fichas ya creadas no cambian.' : ''}`, 'Volver al original'))) return null;
      await api.remove('bestiary', m.editId);
      await reloadMonsters();
      toast(`«${m.name}» vuelve a ser la original.`, { iconName: 'undo' });
      return 'reset';
    }
    if (choice === 'delete') {
      if (!(await confirmDialog(`Se eliminará «${m.name}» del bestiario. Las fichas ya creadas se quedan como están.`))) return null;
      await api.remove('bestiary', m.editId);
      await reloadMonsters();
      return 'deleted';
    }
    if (choice !== 'save') return null;
    if (!String(doc.name).trim()) { toast('Ponle un nombre.', { kind: 'error' }); return null; }
    doc.attacks = doc.attacks.filter((a) => String(a.name).trim()).map((a) => ({ ...a, bonus: a.bonus === '' ? '' : Number(String(a.bonus).replace('+', '')) || 0 }));
    doc.init = doc.init === '' || doc.init == null ? '' : Number(String(doc.init).replace('+', '')) || 0;
    const saved = await saveMonster(m, doc);
    if (!saved) throw new Error('No se ha podido guardar la criatura.');
    const n = opts.apply ? await applyToSheets(saved, chars) : 0;
    sfx.magic();
    toast(`«${saved.name}» guardada en el bestiario: cada una que saques saldrá así.${n ? ` ${n === 1 ? 'Actualizada 1 ficha' : `Actualizadas ${n} fichas`}.` : ''}`, { kind: 'good', iconName: 'book', ms: 5000 });
    return saved;
  } catch (e) { toastError(e); return null; }
}

// Ventana del bestiario: buscar, crear una ficha (onPick) o editar. chars: las fichas, para actualizar las enlazadas.
export async function bestiaryDialog({ onPick, chars = [] } = {}) {
  let all = await monsters();
  const grid = h('div', { class: 'bestiary' });
  let q = '';
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const close = () => grid.closest('.modal-back')?.remove();
  const draw = () => clear(grid, all.filter((m) => norm(`${m.name} ${m.en || ''} ${m.eu || ''} ${m.source || ''} ${m.creature} ${m.custom ? 'propia nueva' : ''} ${m.edited ? 'editada' : ''}`).includes(norm(q))).map((m) => h('div', { class: `beast ${m.source ? 'homebrew' : ''} ${m.edited ? 'edited' : ''} ${m.custom ? 'custom' : ''}` },
    h('button', { class: 'beast-main', type: 'button', onclick: () => { close(); onPick?.(m); }, 'data-tip': 'Crear una ficha de enemigo' },
      beastAvatar(m, 'beast-pic'),
      h('span', { class: 'beast-cr' }, `VD ${m.cr}`), h('b', {}, m.name),
      h('span', { class: 'tiny muted' }, m.custom ? `${m.creature} · propia` : m.source ? `${m.creature} · Euskal Herria` : m.creature, m.edited ? ' · editada' : ''),
      h('span', { class: 'beast-stats' }, h('span', {}, icon('shield', 13), m.ac), h('span', {}, icon('heart', 13), m.hp), h('span', {}, icon('sword', 13), m.attacks.length),
        Object.keys(m.skills || {}).length > 0 && h('span', { 'data-tip': Object.keys(m.skills).join(', ') }, '✓', Object.keys(m.skills).length))),
    h('button', { class: 'btn icon xs beast-edit', type: 'button', 'aria-label': `Editar ${m.name}`, 'data-tip': 'Editar en el bestiario',
      onclick: async () => { if (await editMonster(m, chars)) { all = await monsters(); draw(); } } }, icon('edit', 13)))));
  draw();
  modal('Bestiario', h('div', { class: 'stack' },
    h('div', { class: 'row nowrap' }, h('div', { class: 'grow' }, searchBox('Buscar por nombre o tipo (dragón, no muerto, vasca, editada, propia…)', (v) => { q = v; draw(); })),
      h('button', { class: 'btn', type: 'button', onclick: async () => { const m = await editMonster(null, chars); if (m) { all = await monsters(); draw(); } } }, icon('plus', 15), 'Nueva criatura')),
    grid,
    h('p', { class: 'tiny muted' }, `${all.filter((m) => !m.source && !m.custom).length} criaturas del SRD 5.2.1 de Wizards of the Coast (CC-BY-4.0), traducidas al castellano, ${all.filter((m) => m.source).length} de la mitología de Euskal Herria (propias de esta app; busca «vasca») y ${all.filter((m) => m.custom).length} creadas en esta mesa. Pulsa una para crear su ficha de enemigo; con el lápiz la editas (foto, estadísticas, habilidades, ataques…) y cada una que saques después saldrá así.`)),
  [], { wide: true, iconName: 'book' });
}

// «Fijar como modelo»: guarda una ficha de enemigo en el bestiario (como edición de su criatura o como criatura nueva)
// y, si se quiere, actualiza las demás fichas de esa criatura. Devuelve la criatura guardada o null.
export async function fixAsModel(c, chars) {
  const all = await monsters();
  const baseName = (n) => String(n || '').replace(/\s+(\d+|\(copia\))$/i, '').trim().toLowerCase();
  let target = all.find((m) => m.key && m.key === c.monster) || all.find((m) => m.name.toLowerCase() === baseName(c.name)) || null;
  const st = { key: target?.key || '', name: target?.name || c.name.replace(/\s+(\d+|\(copia\))$/i, ''), apply: true };
  const others = () => chars.filter((x) => x !== c && x.monster && x.monster === st.key);
  const info = h('p', { class: 'small', style: { margin: 0 } });
  const applyBox = h('div');
  const nameIn = bind(st, 'name', { placeholder: 'Nombre en el bestiario' });
  const drawInfo = () => {
    target = all.find((m) => m.key === st.key) || null;
    info.textContent = target
      ? `Las estadísticas, habilidades, ataques, rasgos, la foto y el aspecto de esta ficha pasan a ser los de «${target.name}» en el bestiario: cada una que saques desde ahora saldrá así.`
      : 'Se añade al bestiario como criatura nueva, con todo lo de esta ficha.';
    const n = others().length;
    clear(applyBox, n > 0 && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.apply, onchange: (e) => { st.apply = e.target.checked; } }),
      `Actualizar también ${n === 1 ? 'la otra ficha' : `las otras ${n} fichas`} de ${target?.name || st.name} (conservan su nombre, sus notas y el daño que lleven)`));
  };
  drawInfo();
  const ok = await modal('Fijar como modelo del bestiario', h('div', { class: 'stack' },
    h('div', { class: 'row nowrap', style: { alignItems: 'center' } }, beastAvatar({ ...c }, 'lg'), h('div', { class: 'grow stack-sm' },
      field('Es el modelo de', selectEl([['', '➕ Una criatura nueva'], ...all.map((m) => [m.key, `${m.name} · VD ${m.cr}${m.custom ? ' · propia' : m.edited ? ' · editada' : ''}`])], st.key, (v) => {
        st.key = v; const m = all.find((x) => x.key === v); if (m) { st.name = m.name; nameIn.value = m.name; } drawInfo();
      })),
      field('Nombre en el bestiario', nameIn))),
    info, applyBox),
  [{ label: 'Cancelar', value: false }, { label: 'Fijar como modelo', value: true, class: 'primary', icon: 'check' }], { iconName: 'book' });
  if (!ok) return null;
  try {
    const saved = await saveMonster(target, { ...monsterFromCharacter(c), name: st.name.trim() || c.name, ...(target?.lore ? { lore: target.lore } : {}) });
    if (!saved) throw new Error('No se ha podido guardar en el bestiario.');
    c.monster = saved.key;
    await api.update('characters', c);
    const n = st.apply ? await applyToSheets(saved, chars, c) : 0;
    sfx.magic();
    toast(`«${saved.name}» fijada como modelo: cada una que saques del bestiario saldrá así.${n ? ` ${n === 1 ? 'Actualizada 1 ficha más' : `Actualizadas ${n} fichas más`}.` : ''}`, { kind: 'good', iconName: 'book', ms: 5500 });
    return saved;
  } catch (e) { toastError(e); return null; }
}
