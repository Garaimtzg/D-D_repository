// Especies, clases y trasfondos propios: un editor para cada uno que guarda en la colección «homebrew». El servidor
// los convierte a la misma forma que los del manual (server/homebrew.py), así el creador y la ficha los usan igual.
import { api } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, modal, confirmDialog, toast, toastError, pickFiles, searchBox } from '../core/dom.js';
import { ABILITY_KEYS, ABILITY_SHORT, reloadReference, SPECIES_ICON, reference, speciesIcon, speciesFacts, source, fmtM } from '../core/dnd.js';

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

// Emoticonos sugeridos para una especie (también vale escribir o pegar cualquier otro).
const EMOJIS = ['🧝', '🧙', '🧛', '🧜', '🧚', '🧞', '🧟', '🧌', '👹', '👺', '😈', '😇', '👽', '🤖', '💀', '👻', '🐉', '🐲', '🦄', '🐺', '🦊', '🐻', '🦁',
  '🐯', '🐆', '🐘', '🦅', '🦉', '🐦‍⬛', '🦇', '🐸', '🐍', '🦎', '🐢', '🐙', '🦈', '🐟', '🦀', '🐝', '🦋', '🕷️', '🐌', '🍄', '🌲', '🌿', '🌸', '🍂', '🌙', '☀️',
  '⭐', '🔥', '❄️', '🌊', '⚡', '🌪️', '🪨', '💎', '⚙️', '🗿', '🧠', '👁️', '🦴', '🪶', '🎭', '⚔️', '🛡️', '🔮', '🧬'];

// Selector de emoticono: el elegido grande, un campo para escribir o pegar cualquiera y una rejilla de sugerencias.
function emojiPicker(doc, fallback) {
  const box = h('div', { class: 'emoji-picker' });
  const draw = () => clear(box,
    h('div', { class: 'row nowrap' },
      h('span', { class: 'emoji-big', 'aria-hidden': 'true' }, doc.emoji || fallback),
      h('input', { class: 'inline', value: doc.emoji || '', maxlength: 16, placeholder: fallback, 'aria-label': 'Emoticono de la especie', style: { width: '6em' },
        onchange: (e) => { doc.emoji = e.target.value.trim(); draw(); } }),
      doc.emoji && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { doc.emoji = ''; draw(); } }, 'Quitar')),
    h('div', { class: 'emoji-grid' }, EMOJIS.map((e) => h('button', { type: 'button', class: doc.emoji === e ? 'on' : '', 'aria-label': e, onclick: () => { doc.emoji = e; draw(); } }, e))));
  draw();
  return box;
}

// Idiomas que da una especie, un trasfondo o una clase: los del manual en fichas y cualquier otro escrito a mano.
function languagePicker(doc, R) {
  doc.languages ||= [];
  const known = [...new Set([...R.languages.estandar, ...R.languages.inusuales, ...R.species.flatMap((x) => x.languages || []), ...doc.languages])].filter((l) => l !== 'Común');
  const box = h('div', { class: 'stack-sm' });
  const draw = () => clear(box,
    h('div', { class: 'cr-skills' }, [...new Set([...known, ...doc.languages])].map((l) => {
      const on = doc.languages.includes(l);
      return h('button', { class: `chip pick ${on ? 'on' : ''}`, type: 'button', onclick: () => { doc.languages = on ? doc.languages.filter((x) => x !== l) : [...doc.languages, l]; draw(); } }, on ? '✓ ' : '', l);
    })),
    h('input', { class: 'inline', placeholder: 'Otro idioma (Intro para añadir)', 'aria-label': 'Otro idioma',
      onkeydown: (e) => { const v = e.target.value.trim(); if (e.key === 'Enter' && v && !doc.languages.includes(v)) { e.preventDefault(); doc.languages.push(v); draw(); } } }));
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
// prefill: documento de partida que aún no está guardado (una especie del manual que se va a editar).
// footer: algo más que poner al final del formulario (la casilla de aplicar a las fichas).
export async function editHomebrew(kind, R, existing = null, { prefill = null, footer = null } = {}) {
  const blank = {
    species: { kind, name: '', emoji: '', languages: [], summary: '', creature: 'Humanoide', size: 'Mediano', speed: 9, darkvision: 0, natural_ac: 0, hp_per_level: false,
      traits: [{ name: '', text: '' }], skills: [], skill_count: 0, skill_choice: [], tool: '', spells: [], resources: [] },
    class: { kind, name: '', summary: '', hit_die: 8, primary: ['fue'], saves: ['fue', 'con'], skills_choose: 2, skills_from: [], armor_training: ['ligera'],
      weapon_training: ['sencilla'], tools: '', masteries: 0, gold: 100, caster: '', spell_ability: 'int', spell_list: '', cantrips: 0, asi: true,
      features: [{ level: 1, name: '', text: '' }], resources: [], subclass_level: 3, subclasses: [] },
    background: { kind, name: '', summary: '', abilities: [], feat: 'Habilidoso', skills: [], tool: '', equipment: '', gold: 0, languages: [] },
  };
  const doc = structuredClone(existing || prefill || blank[kind]);
  const isEdit = !!doc.base; // especie del manual editada: borrarla es volver a la original
  const skillOpts = R.skills.map((k) => [k.key, k.name]);
  const abilOpts = ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]]);
  const body = kind === 'species' ? speciesForm(doc, R, skillOpts) : kind === 'class' ? classForm(doc, R, skillOpts, abilOpts) : backgroundForm(doc, R, skillOpts, abilOpts);
  if (footer) body.append(footer);
  const actions = [{ label: 'Cancelar', value: null },
    ...(existing ? [isEdit ? { label: 'Volver al original', value: 'delete', icon: 'undo' } : { label: 'Eliminar', value: 'delete', class: 'danger', icon: 'trash' }] : []),
    { label: 'Guardar', value: 'save', class: 'primary', icon: 'check' }];
  const what = { species: 'especie', class: 'clase', background: 'trasfondo' }[kind];
  const title = isEdit ? `Editar la especie «${doc.name}»` : `${existing ? 'Editar' : kind === 'background' ? 'Nuevo' : 'Nueva'} ${what}`;
  const choice = await modal(title, body, actions, { wide: true, iconName: 'sparkle' });
  if (choice === 'delete') {
    if (!(await confirmDialog(isEdit ? `«${existing.name}» volverá a ser la del manual. Las fichas de esa especie recuperan sus rasgos originales.`
      : `Se eliminará «${existing.name}». Las fichas que la usen se quedan con su nombre pero sin sus rasgos.`, isEdit ? 'Volver al original' : 'Eliminar'))) return null;
    await api.remove('homebrew', existing.id).catch(toastError);
    return 'deleted';
  }
  if (choice !== 'save') return null;
  if (!doc.name.trim()) { toast('Ponle un nombre.', { kind: 'error' }); return null; }
  try {
    const saved = existing ? await api.update('homebrew', doc) : await api.create('homebrew', doc);
    toast(isEdit ? `«${saved.name}» guardada: todas las fichas de esta especie usan ya sus rasgos nuevos.` : `«${saved.name}» ${kind === 'background' ? 'guardado' : 'guardada'}: ya aparece al crear personajes.`, { kind: 'good', iconName: 'sparkle' });
    return saved;
  } catch (e) { toastError(e); return null; }
}

function speciesForm(doc, R, skillOpts) {
  const spellNames = R.spells.map((s) => [s.name, `${s.name} (${s.level ? `nv ${s.level}` : 'truco'})`]);
  const pic = h('div', { class: 'be-pic' });
  const drawPic = () => clear(pic,
    h('span', { class: 'species-pic', style: doc.image ? { backgroundImage: `url("${doc.image}")` } : {} }, doc.image ? '' : '🧬'),
    h('div', { class: 'stack-sm' },
      h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        const [file] = await pickFiles('image/*');
        if (!file) return;
        try { doc.image = (await api.upload(file)).url; drawPic(); } catch (e) { toastError(e); }
      } }, icon('image', 14), doc.image ? 'Cambiar la imagen' : 'Imagen de la especie'),
      doc.image && h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { doc.image = ''; drawPic(); } }, icon('trash', 14), 'Quitar'),
      h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Sale en el creador, en Reglas y en la ficha; también puede ser el retrato de las fichas de esta especie que no tengan uno.')));
  drawPic();
  return h('div', { class: 'stack hb-form' },
    h('p', { class: 'small muted', style: { margin: 0 } }, doc.base
      ? 'Editas una especie del manual para esta mesa: los cambios valen para todas las fichas de esta especie (sus rasgos, recursos y magia se leen de aquí). «Volver al original» la deja como en el libro.'
      : 'Como en 2024, la especie no sube características (lo da el trasfondo). Para equilibrarla, compárala con las del manual: un rasgo fuerte, un par menores y, si acaso, magia a nivel 3 y 5.'),
    pic,
    h('div', { class: 'row wrap', style: { alignItems: 'flex-start' } },
      field('Emoticono en el selector', emojiPicker(doc, doc.base ? SPECIES_ICON[doc.base] || '🧬' : '🧬'), 'grow')),
    h('div', { class: 'row wrap' },
      field('Nombre', bind(doc, 'name', { placeholder: 'Ent joven, gente polilla…' }), 'grow'),
      field('Tipo de criatura', bind(doc, 'creature', { placeholder: 'Humanoide' })),
      field('Tamaño', selectEl(SIZES, doc.size, (v) => { doc.size = v; }))),
    field('Resumen', bind(doc, 'summary', { placeholder: 'En una línea: quiénes son' })),
    field('Descripción', bind(doc, 'lore', { type: 'textarea', rows: 3, placeholder: 'Cómo son, dónde viven, cómo los ven los demás…' })),
    h('div', { class: 'row wrap' },
      field('Altura típica', bind(doc, 'height', { placeholder: '1,50 – 1,80 m' })),
      field('Esperanza de vida', bind(doc, 'lifespan', { placeholder: 'unos 80 años' }))),
    h('div', { class: 'row wrap' },
      field('Velocidad (m)', bind(doc, 'speed', { type: 'number', min: 1.5, max: 30, step: 1.5 })),
      field('Visión en la oscuridad', selectEl([[0, 'No'], [18, '18 m'], [36, '36 m']], doc.darkvision, (v) => { doc.darkvision = Number(v); })),
      field('CA natural (0 = no)', bind(doc, 'natural_ac', { type: 'number', min: 0, max: 20, 'data-tip': 'CA sin armadura = este valor + DES' })),
      h('label', { class: 'check small' }, bind(doc, 'hp_per_level', { type: 'checkbox' }), '+1 PG por nivel'),
      h('label', { class: 'check small', 'data-tip': 'Como la Constitución poderosa del goliat' }, bind(doc, 'carry_bigger', { type: 'checkbox' }), 'Un tamaño más para la carga'),
      field('Herramienta', bind(doc, 'tool', { placeholder: 'Opcional' }))),
    h('div', { class: 'eyebrow' }, 'Rasgos'),
    rows(doc.traits, featureRowNoLevel, () => ({ name: '', text: '' }), 'Añadir rasgo'),
    h('div', { class: 'eyebrow' }, 'Idioma propio (además del común)'), languagePicker(doc, R),
    h('div', { class: 'eyebrow' }, 'Competencias en habilidades que siempre tiene'), chips(skillOpts, doc.skills),
    h('div', { class: 'row wrap' }, field('Habilidades a elegir', selectEl([0, 1, 2, 3, 4], doc.skill_count, (v) => { doc.skill_count = Number(v); }))),
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'De cuáles se eligen (ninguna marcada = cualquiera):'), chips(skillOpts, doc.skill_choice),
    h('div', { class: 'eyebrow' }, 'Magia de la especie'),
    rows(doc.spells, (row) => [selectEl([[1, 'Nivel 1'], [3, 'Nivel 3'], [5, 'Nivel 5'], ...LEVELS.filter(([l]) => ![1, 3, 5].includes(l))], row.level, (v) => { row.level = Number(v); }, { class: 'mini-sel', 'aria-label': 'Desde el nivel' }),
      selectEl([['', '— Conjuro —'], ...spellNames], row.name, (v) => { row.name = v; }, { class: 'grow', 'aria-label': 'Conjuro' }),
      selectEl([['', 'Truco / a voluntad'], ['1', '1 vez gratis por descanso largo'], ['pb', 'Competencia veces por descanso largo'], ['1c', '1 vez gratis por descanso corto']],
        row.reset === 'corto' && String(row.uses) === '1' ? '1c' : String(row.uses || ''), (v) => { row.uses = v === '1' || v === '1c' ? 1 : v; row.reset = v === '1c' ? 'corto' : 'largo'; }, { class: 'mini-sel', 'aria-label': 'Usos' })],
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
    h('div', { class: 'eyebrow' }, 'Idioma que enseña la clase (opcional, como el druídico o la jerga de ladrones)'), languagePicker(doc, R),
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

// Trasfondo propio con la forma de los de 2024: tres características, una dote de origen, dos habilidades,
// una herramienta y su equipo (la otra opción del creador siempre son 50 po).
function backgroundForm(doc, R, skillOpts, abilOpts) {
  const feats = [...R.feats.filter((f) => f.category === 'origen' && f.name !== 'Iniciado en la magia').map((f) => f.name),
    ...['clérigo', 'druida', 'mago'].map((l) => `Iniciado en la magia (${l})`)];
  const featInfo = h('p', { class: 'tiny muted', style: { margin: 0 } });
  const showFeat = () => { featInfo.textContent = R.feats.find((f) => doc.feat.startsWith(f.name))?.summary || ''; };
  showFeat();
  return h('div', { class: 'stack hb-form' },
    h('p', { class: 'small muted', style: { margin: 0 } }, 'Como los de 2024: tres características (el creador reparte +2 y +1 o +1 a las tres), una dote de origen, dos habilidades, una herramienta y equipo por unas 50 po; quien lo elija puede tomar 50 po en su lugar.'),
    h('div', { class: 'row wrap' },
      field('Nombre', bind(doc, 'name', { placeholder: 'Pastor, contrabandista, monje del monasterio…' }), 'grow'),
      field('Herramienta', bind(doc, 'tool', { placeholder: 'Útiles de herborista, un instrumento…' }), 'grow')),
    field('Resumen', bind(doc, 'summary', { placeholder: 'En una línea: qué hacía antes de la aventura' })),
    h('div', { class: 'eyebrow' }, 'Características (elige 3)'), chips(abilOpts, doc.abilities, { max: 3 }),
    field('Dote de origen', selectEl(feats, doc.feat, (v) => { doc.feat = v; showFeat(); })), featInfo,
    h('div', { class: 'eyebrow' }, 'Habilidades (elige 2)'), chips(skillOpts, doc.skills, { max: 2 }),
    h('div', { class: 'eyebrow' }, 'Idiomas que da (opcional: un sabio, un marinero de muchos puertos…)'), languagePicker(doc, R),
    h('div', { class: 'row wrap' },
      field('Equipo (uno por línea; «2 Dagas» para varios)', bind(doc, 'equipment', { type: 'textarea', rows: 4, placeholder: 'Cayado\n2 Mantas\nRopas de viaje' }), 'grow'),
      field('Oro además del equipo', bind(doc, 'gold', { type: 'number', min: 0, max: 50 }))));
}

// Documento del editor a partir de una especie del manual (para editarla en esta mesa).
export function docFromSpecies(sp) {
  const type = sp.traits.find(([n]) => n === 'Tipo de criatura');
  return {
    kind: 'species', base: sp.id, name: sp.name, summary: sp.summary || '', creature: type ? type[1].replace(/\.$/, '') : 'Humanoide',
    size: sp.size, speed: sp.speed, darkvision: sp.darkvision || 0, natural_ac: Number(sp.natural_ac) || 0, hp_per_level: !!sp.hp_per_level,
    carry_bigger: !!sp.carry_bigger, tool: sp.tool || '',
    traits: sp.traits.filter(([n]) => n !== 'Tipo de criatura').map(([name, text]) => ({ name, text })),
    skills: [...(sp.skills || [])], skill_count: sp.skill_count || (sp.skill_choice ? 1 : 0), skill_choice: Array.isArray(sp.skill_choice) ? [...sp.skill_choice] : [],
    spells: (sp.spells || []).map(([level, name, uses, reset]) => ({ level, name, uses: uses ?? '', reset: reset || 'largo' })),
    resources: (sp.resources || []).map(([name, uses, reset, level]) => ({ name, uses, reset, level })),
    image: sp.image || '', lore: sp.lore || '', height: sp.height || '', lifespan: sp.lifespan || '',
    emoji: sp.emoji || '', languages: [...(sp.languages || [])],
  };
}

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Editar cualquier especie (del manual o propia) y, si se quiere, aplicar a las fichas que ya la tienen lo que se
// guarda en ellas (velocidad, tamaño, competencias fijas de la especie y la imagen como retrato de quien no tenga).
// Devuelve la referencia recargada o null.
export async function editSpecies(sp, R, chars = []) {
  const existing = sp.homebrew_id ? (await api.list('homebrew')).find((d) => d.id === sp.homebrew_id) || null : null;
  const linked = chars.filter((c) => c.speciesId === sp.id || (!c.speciesId && norm(c.race) && norm(c.race) === norm(sp.name)));
  const opts = { apply: linked.length > 0 };
  const footer = linked.length > 0 ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { opts.apply = e.target.checked; } }),
    `Ajustar ${linked.length === 1 ? 'la ficha' : `las ${linked.length} fichas`} de esta especie: velocidad, tamaño, sus competencias fijas y la imagen como retrato de quien no tenga retrato ni muñeco. (Los rasgos, recursos y magia ya se leen de la especie.)`) : null;
  const saved = await editHomebrew('species', R, existing, { prefill: existing ? null : docFromSpecies(sp), footer });
  if (!saved) return null;
  const R2 = await reloadReference();
  const ns = R2.species.find((x) => x.id === (saved === 'deleted' ? sp.id : saved.base || `hb-${saved.id}`));
  if (ns && opts.apply) {
    for (const c of linked) {
      c.speed = ns.lineage_speed?.[c.lineage] ?? ns.speed;
      if (!ns.size.includes(' o ')) c.size = ns.size;
      c.skills ||= {};
      for (const k of ns.skills || []) c.skills[k] = Math.max(1, c.skills[k] || 0);
      if (ns.image && !c.portrait && !c.look) c.portrait = ns.image;
      c.race = ns.name;
      await api.update('characters', c).catch(toastError);
    }
    if (linked.length) toast(`${linked.length === 1 ? 'Ajustada 1 ficha' : `Ajustadas ${linked.length} fichas`} de ${ns.name}.`, { kind: 'good', iconName: 'personajes' });
  }
  return R2;
}

// ------------------------------------------------------------------ compendio de especies
// Las especies jugables (del manual, del «Manual para casi todo», de Euskal Herria y las propias) en una ventana como
// la del bestiario: buscar, ver sus rasgos, editarlas para la mesa, crear una nueva o empezar un aventurero con ella.
const SPECIES_SOURCE = (s) => (s.homebrew_id && !s.edited ? 'propia' : s.origin === 'Euskal Herria' ? 'Euskal Herria' : s.page ? 'Manual del Jugador' : s.origin || '');
export async function speciesDialog({ chars = [], onCreate = null } = {}) {
  let R = await reference();
  let q = '';
  const grid = h('div', { class: 'species-grid' });
  const norm2 = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const close = () => grid.closest('.modal-back')?.remove();
  const meta = (s) => [s.size, fmtM(s.speed), s.darkvision ? `visión en la oscuridad ${s.darkvision} m` : ''].filter(Boolean).join(' · ');
  const reload = async (R2) => { if (R2) { R = R2; draw(); } };
  const detail = async (s) => {
    const body = h('div', { class: 'stack sp-detail' },
      h('div', { class: 'row nowrap', style: { alignItems: 'flex-start' } },
        h('span', { class: 'species-pic', style: s.image ? { backgroundImage: `url("${s.image}")` } : {} }, s.image ? '' : speciesIcon(s)),
        h('div', { class: 'grow stack-sm' },
          h('div', { class: 'row' }, h('span', { class: 'chip' }, SPECIES_SOURCE(s)), s.edited && h('span', { class: 'chip' }, 'editada'), h('span', { class: 'tiny muted' }, source(s))),
          h('div', { class: 'small' }, meta(s)),
          h('div', { class: 'small' }, `Idiomas: común${s.languages?.length ? `, ${s.languages.join(', ').toLowerCase()}` : ''}`),
          speciesFacts(s) && h('div', { class: 'tiny muted' }, speciesFacts(s)))),
      (s.lore || s.summary) && h('p', { class: 'species-lore', style: { margin: 0 } }, s.lore || s.summary),
      h('dl', { class: 'ref compact' }, s.traits.map(([n, t]) => [h('dt', {}, n), h('dd', {}, t)])),
      s.options && h('div', { class: 'stack-sm' }, h('div', { class: 'eyebrow' }, s.options_label || 'Linajes'),
        h('dl', { class: 'ref compact' }, s.options.map(([n, t]) => [h('dt', {}, n), h('dd', {}, t)]))));
    const choice = await modal(`${speciesIcon(s)} ${s.name}`, body, [
      { label: 'Cerrar', value: null },
      { label: 'Editar', value: 'edit', icon: 'edit' },
      onCreate && { label: 'Crear un aventurero', value: 'create', class: 'primary', icon: 'sparkle' },
    ].filter(Boolean), { wide: true, iconName: 'personajes' });
    if (choice === 'edit') reload(await editSpecies(s, R, chars));
    if (choice === 'create') { close(); onCreate(s); }
  };
  const draw = () => {
    const list = R.species.filter((s) => norm2(`${s.name} ${SPECIES_SOURCE(s)} ${s.edited ? 'editada' : ''} ${s.traits.map(([n]) => n).join(' ')} ${s.size}`).includes(norm2(q)));
    clear(grid, list.length ? list.map((s) => h('div', { class: `sp-card ${s.origin === 'Euskal Herria' ? 'homebrew' : ''} ${s.homebrew_id && !s.edited ? 'custom' : ''} ${s.edited ? 'edited' : ''}` },
      h('button', { class: 'sp-card-main', type: 'button', onclick: () => detail(s), 'data-tip': s.summary || null },
        h('span', { class: 'species-pic', style: s.image ? { backgroundImage: `url("${s.image}")` } : {} }, s.image ? '' : speciesIcon(s)),
        h('b', {}, s.name),
        h('span', { class: 'tiny muted' }, meta(s)),
        h('span', { class: 'tiny sp-src' }, SPECIES_SOURCE(s), s.edited ? ' · editada' : '')),
      h('button', { class: 'btn icon xs beast-edit', type: 'button', 'aria-label': `Editar ${s.name}`, 'data-tip': 'Editar la especie para tu mesa',
        onclick: async () => reload(await editSpecies(s, R, chars)) }, icon('edit', 13))))
      : h('p', { class: 'muted' }, 'Ninguna especie coincide con la búsqueda.'));
  };
  draw();
  modal('Especies', h('div', { class: 'stack' },
    h('div', { class: 'row nowrap' }, h('div', { class: 'grow' }, searchBox('Buscar por nombre, rasgo u origen (vasca, propia, editada…)', (v) => { q = v; draw(); })),
      h('button', { class: 'btn', type: 'button', onclick: async () => { if (await editHomebrew('species', R)) reload(await reloadReference()); } }, icon('plus', 15), 'Nueva especie')),
    grid,
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Pulsa una especie para ver sus rasgos, editarla para tu mesa o empezar un aventurero con ella. Con el lápiz la editas directamente (los cambios valen para todas las fichas de esa especie).')),
  [], { wide: true, iconName: 'personajes' });
}
