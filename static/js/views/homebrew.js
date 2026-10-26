// Especies y clases propias: un editor para cada una que guarda en la colección «homebrew». El servidor
// las convierte a la misma forma que las del manual (server/homebrew.py), así el creador y la ficha las usan igual.
import { api } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, modal, confirmDialog, toast, toastError } from '../core/dom.js';
import { ABILITY_KEYS, ABILITY_SHORT } from '../core/dnd.js';

const SIZES = ['Mediano', 'Pequeño', 'Mediano o Pequeño', 'Grande'];
const USES = [['1', '1 vez por descanso'], ['2', '2 veces'], ['3', '3 veces'], ['pb', 'Bonif. por competencia']];
const RESETS = [['largo', 'Descanso largo'], ['corto', 'Descanso corto o largo']];
const LEVELS = Array.from({ length: 20 }, (_, i) => [i + 1, `Nivel ${i + 1}`]);

// Fichas de chips para elegir varios valores de una lista.
function chips(options, chosen, { max = 99 } = {}) {
  const box = h('div', { class: 'cr-skills' });
  const draw = () => clear(box, options.map(([k, label]) => h('button', {
    class: `chip pick ${chosen.includes(k) ? 'on' : ''}`, type: 'button',
    onclick: () => {
      if (chosen.includes(k)) chosen.splice(chosen.indexOf(k), 1);
      else { chosen.push(k); if (chosen.length > max) chosen.shift(); }
      draw();
    } }, chosen.includes(k) ? '✓ ' : '', label)));
  draw();
  return box;
}

// Lista editable de filas (rasgos, conjuros, recursos…): cada fila es un objeto y make(row) dibuja sus campos.
function rows(list, make, blank, addLabel) {
  const box = h('div', { class: 'hb-rows' });
  const draw = () => clear(box, list.map((row, i) => h('div', { class: 'hb-row' }, make(row),
    h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar', onclick: () => { list.splice(i, 1); draw(); } }, icon('close', 12)))),
  h('button', { class: 'btn xs', type: 'button', onclick: () => { list.push(blank()); draw(); } }, icon('plus', 12), addLabel));
  draw();
  return box;
}
const featureRow = (row) => [selectEl(LEVELS, row.level, (v) => { row.level = Number(v); }, { class: 'mini-sel', 'aria-label': 'Nivel' }),
  h('div', { class: 'grow stack-sm' }, bind(row, 'name', { placeholder: 'Nombre del rasgo', 'aria-label': 'Nombre del rasgo' }),
    bind(row, 'text', { type: 'textarea', rows: 2, placeholder: 'Qué hace (con los números que hagan falta para jugar)', 'aria-label': 'Qué hace' }))];
const resourceRow = (row, abilityUses = false) => [bind(row, 'name', { placeholder: 'Recurso (furia, cargas…)', class: 'grow', 'aria-label': 'Recurso' }),
  selectEl([...USES, ...(abilityUses ? ABILITY_KEYS.map((k) => [`mod:${k}`, `Mod. de ${ABILITY_SHORT[k]}`]) : [])], String(row.uses), (v) => { row.uses = /^\d+$/.test(v) ? Number(v) : v; }, { class: 'mini-sel', 'aria-label': 'Usos' }),
  selectEl(RESETS, row.reset, (v) => { row.reset = v; }, { class: 'mini-sel', 'aria-label': 'Se recupera' }),
  selectEl(LEVELS, row.level || 1, (v) => { row.level = Number(v); }, { class: 'mini-sel', 'aria-label': 'Desde el nivel' })];

// Abre el editor. Devuelve el documento guardado, 'deleted' o null si se cancela.
export async function editHomebrew(kind, R, existing = null) {
  const doc = structuredClone(existing || (kind === 'species'
    ? { kind, name: '', summary: '', creature: 'Humanoide', size: 'Mediano', speed: 9, darkvision: 0, natural_ac: 0, hp_per_level: false,
        traits: [{ name: '', text: '' }], skills: [], skill_count: 0, skill_choice: [], tool: '', spells: [], resources: [] }
    : { kind, name: '', summary: '', hit_die: 8, primary: ['fue'], saves: ['fue', 'con'], skills_choose: 2, skills_from: [], armor_training: ['ligera'],
        weapon_training: ['sencilla'], tools: '', masteries: 0, gold: 100, caster: '', spell_ability: 'int', spell_list: '', cantrips: 0, asi: true,
        features: [{ level: 1, name: '', text: '' }], resources: [], subclass_level: 3, subclasses: [] }));
  const skillOpts = R.skills.map((k) => [k.key, k.name]);
  const abilOpts = ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]]);
  const body = kind === 'species' ? speciesForm(doc, R, skillOpts) : classForm(doc, R, skillOpts, abilOpts);
  const actions = [{ label: 'Cancelar', value: null },
    ...(existing ? [{ label: 'Eliminar', value: 'delete', class: 'danger', icon: 'trash' }] : []),
    { label: 'Guardar', value: 'save', class: 'primary', icon: 'check' }];
  const choice = await modal(kind === 'species' ? (existing ? 'Editar especie' : 'Nueva especie') : (existing ? 'Editar clase' : 'Nueva clase'),
    body, actions, { wide: true, iconName: 'sparkle' });
  if (choice === 'delete') {
    if (!(await confirmDialog(`Se eliminará «${existing.name}». Las fichas que la usen se quedan con su nombre pero sin sus rasgos.`))) return null;
    await api.remove('homebrew', existing.id).catch(toastError);
    return 'deleted';
  }
  if (choice !== 'save') return null;
  if (!doc.name.trim()) { toast('Ponle un nombre.', { kind: 'error' }); return null; }
  try {
    const saved = existing ? await api.update('homebrew', doc) : await api.create('homebrew', doc);
    toast(`«${saved.name}» guardada: ya aparece al crear personajes.`, { kind: 'good', iconName: 'sparkle' });
    return saved;
  } catch (e) { toastError(e); return null; }
}

function speciesForm(doc, R, skillOpts) {
  const spellNames = R.spells.map((s) => [s.name, `${s.name} (${s.level ? `nv ${s.level}` : 'truco'})`]);
  return h('div', { class: 'stack hb-form' },
    h('p', { class: 'small muted', style: { margin: 0 } }, 'Como en 2024, la especie no sube características (lo da el trasfondo). Para equilibrarla, compárala con las del manual: un rasgo fuerte, un par menores y, si acaso, magia a nivel 3 y 5.'),
    h('div', { class: 'row wrap' },
      field('Nombre', bind(doc, 'name', { placeholder: 'Ent joven, gente polilla…' }), 'grow'),
      field('Tipo de criatura', bind(doc, 'creature', { placeholder: 'Humanoide' })),
      field('Tamaño', selectEl(SIZES, doc.size, (v) => { doc.size = v; }))),
    field('Resumen', bind(doc, 'summary', { placeholder: 'En una línea: quiénes son' })),
    h('div', { class: 'row wrap' },
      field('Velocidad (m)', bind(doc, 'speed', { type: 'number', min: 1.5, max: 30, step: 1.5 })),
      field('Visión en la oscuridad', selectEl([[0, 'No'], [18, '18 m'], [36, '36 m']], doc.darkvision, (v) => { doc.darkvision = Number(v); })),
      field('CA natural (0 = no)', bind(doc, 'natural_ac', { type: 'number', min: 0, max: 20, 'data-tip': 'CA sin armadura = este valor + DES' })),
      h('label', { class: 'check small' }, bind(doc, 'hp_per_level', { type: 'checkbox' }), '+1 PG por nivel'),
      field('Herramienta', bind(doc, 'tool', { placeholder: 'Opcional' }))),
    h('div', { class: 'eyebrow' }, 'Rasgos'),
    rows(doc.traits, featureRowNoLevel, () => ({ name: '', text: '' }), 'Añadir rasgo'),
    h('div', { class: 'eyebrow' }, 'Competencias en habilidades que siempre tiene'), chips(skillOpts, doc.skills),
    h('div', { class: 'row wrap' }, field('Habilidades a elegir', selectEl([0, 1, 2, 3, 4], doc.skill_count, (v) => { doc.skill_count = Number(v); }))),
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'De cuáles se eligen (ninguna marcada = cualquiera):'), chips(skillOpts, doc.skill_choice),
    h('div', { class: 'eyebrow' }, 'Magia de la especie'),
    rows(doc.spells, (row) => [selectEl([[1, 'Nivel 1'], [3, 'Nivel 3'], [5, 'Nivel 5'], ...LEVELS.filter(([l]) => ![1, 3, 5].includes(l))], row.level, (v) => { row.level = Number(v); }, { class: 'mini-sel', 'aria-label': 'Desde el nivel' }),
      selectEl([['', '— Conjuro —'], ...spellNames], row.name, (v) => { row.name = v; }, { class: 'grow', 'aria-label': 'Conjuro' }),
      selectEl([['', 'Truco / a voluntad'], ['1', '1 vez gratis por descanso largo'], ['pb', 'Competencia veces por descanso largo']], String(row.uses || ''), (v) => { row.uses = v === '1' ? 1 : v; }, { class: 'mini-sel', 'aria-label': 'Usos' })],
    () => ({ level: 1, name: '', uses: '' }), 'Añadir conjuro'),
    h('div', { class: 'eyebrow' }, 'Recursos con usos'),
    rows(doc.resources, (row) => resourceRow(row), () => ({ name: '', uses: 'pb', reset: 'largo', level: 1 }), 'Añadir recurso'));
}
function featureRowNoLevel(row) {
  return [h('div', { class: 'grow stack-sm' }, bind(row, 'name', { placeholder: 'Nombre del rasgo', 'aria-label': 'Nombre del rasgo' }),
    bind(row, 'text', { type: 'textarea', rows: 2, placeholder: 'Qué hace', 'aria-label': 'Qué hace' }))];
}

function classForm(doc, R, skillOpts, abilOpts) {
  const lists = R.classes.filter((c) => c.caster && !c.homebrew_id).map((c) => [c.name, c.name]);
  const subBox = h('div', { class: 'stack-sm' });
  const drawSubs = () => clear(subBox, doc.subclasses.map((s, i) => h('div', { class: 'hb-sub' },
    h('div', { class: 'row' }, bind(s, 'name', { placeholder: 'Nombre de la subclase', class: 'grow', 'aria-label': 'Subclase' }),
      h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar subclase', onclick: () => { doc.subclasses.splice(i, 1); drawSubs(); } }, icon('trash', 13))),
    rows(s.features, featureRow, () => ({ level: doc.subclass_level, name: '', text: '' }), 'Añadir rasgo de subclase'))),
  h('button', { class: 'btn sm', type: 'button', onclick: () => { doc.subclasses.push({ name: '', features: [{ level: doc.subclass_level, name: '', text: '' }] }); drawSubs(); } }, icon('plus', 14), 'Añadir subclase'));
  drawSubs();
  return h('div', { class: 'stack hb-form' },
    h('p', { class: 'small muted', style: { margin: 0 } }, 'La app añade sola las Mejoras de característica (niveles 4, 8, 12 y 16) y el Don épico (19), los espacios de conjuro según el tipo de lanzador y los PG por nivel según el dado de golpe.'),
    h('div', { class: 'row wrap' },
      field('Nombre', bind(doc, 'name', { placeholder: 'Caballero sombrío, cazador de brujas…' }), 'grow'),
      field('Dado de golpe', selectEl([[6, 'd6'], [8, 'd8'], [10, 'd10'], [12, 'd12']], doc.hit_die, (v) => { doc.hit_die = Number(v); })),
      field('Oro inicial', bind(doc, 'gold', { type: 'number', min: 0, max: 1000 }))),
    field('Resumen', bind(doc, 'summary', { placeholder: 'En una línea: qué hace esta clase' })),
    h('div', { class: 'grid cols-2' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Característica principal'), chips(abilOpts, doc.primary, { max: 2 })),
      h('div', {}, h('div', { class: 'eyebrow' }, 'Salvaciones'), chips(abilOpts, doc.saves, { max: 2 }))),
    h('div', { class: 'row wrap' }, field('Habilidades a elegir', selectEl([1, 2, 3, 4], doc.skills_choose, (v) => { doc.skills_choose = Number(v); })),
      field('Maestrías con armas', selectEl([0, 1, 2, 3], doc.masteries, (v) => { doc.masteries = Number(v); })),
      field('Herramientas', bind(doc, 'tools', { placeholder: 'Opcional' }), 'grow')),
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Habilidades de la clase (ninguna marcada = cualquiera):'), chips(skillOpts, doc.skills_from),
    h('div', { class: 'grid cols-2' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Armaduras'), chips([['ligera', 'Ligeras'], ['media', 'Medias'], ['pesada', 'Pesadas'], ['escudo', 'Escudos']], doc.armor_training)),
      h('div', {}, h('div', { class: 'eyebrow' }, 'Armas'), chips([['sencilla', 'Sencillas'], ['marcial', 'Marciales']], doc.weapon_training))),
    h('div', { class: 'eyebrow' }, 'Magia'),
    h('div', { class: 'row wrap' },
      field('Lanzador', selectEl([['', 'No lanza conjuros'], ['full', 'Completo (como el mago)'], ['half', 'Semilanzador (como el paladín)'], ['pact', 'Magia del pacto (como el brujo)']], doc.caster, (v) => { doc.caster = v; })),
      field('Aptitud mágica', selectEl(abilOpts.filter(([k]) => ['int', 'sab', 'car'].includes(k)), doc.spell_ability, (v) => { doc.spell_ability = v; })),
      field('Lista de conjuros', selectEl([['', '— Elige —'], ...lists], doc.spell_list, (v) => { doc.spell_list = v; })),
      field('Trucos a nivel 1', selectEl([0, 1, 2, 3, 4], doc.cantrips, (v) => { doc.cantrips = Number(v); }))),
    h('label', { class: 'check small' }, bind(doc, 'asi', { type: 'checkbox' }), 'Mejoras de característica y Don épico de siempre'),
    h('div', { class: 'eyebrow' }, 'Rasgos de clase'),
    rows(doc.features, featureRow, () => ({ level: 1, name: '', text: '' }), 'Añadir rasgo'),
    h('div', { class: 'eyebrow' }, 'Recursos con usos'),
    rows(doc.resources, (row) => resourceRow(row, true), () => ({ name: '', uses: 'pb', reset: 'largo', level: 1 }), 'Añadir recurso'),
    h('div', { class: 'row wrap' }, h('div', { class: 'eyebrow grow' }, 'Subclases'),
      field('Se elige en el nivel', selectEl(LEVELS, doc.subclass_level, (v) => { doc.subclass_level = Number(v); }))),
    subBox);
}
