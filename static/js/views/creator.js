// Asistente para crear un aventurero siguiendo los cinco pasos del Manual del Jugador 2024
// (MdJ p. 33-41): clase, origen (trasfondo, especie e idiomas), características, detalles y resumen.
// Junto a las del manual aparecen las especies y subclases del «Manual para casi todo» (adaptadas a 2024), las de
// Euskal Herria (material propio) y las especies y clases que crea cada mesa (editor en homebrew.js).
import { h, clear, icon, toast } from '../core/dom.js';
import { editHomebrew } from './homebrew.js';
import { api } from '../core/api.js';
import {
  reference, reloadReference, newCharacter, ABILITY_KEYS, ABILITY_SHORT, ABILITY_NAME, mod, fmtMod, fmtM, maxHpFor, computeAC,
  slotsFor, classResources, featuresUpTo, profBonus, columnAt, source, grantResources, derivedAttacks,
  pendingChoices, weaponAttack, featAbilities, initBonus, castingOf, grantedSpells, spellChoices, spellCounts, spellLists, featBonus,
} from '../core/dnd.js';
import { pickSpells, spellTip } from './spellui.js';
import { roll } from '../core/dice.js';
import { sfx } from '../core/sfx.js';

const STEPS = ['Clase', 'Origen', 'Características', 'Detalles', 'Resumen'];
const CLASS_ICON = {
  barbaro: '🪓', bardo: '🎻', brujo: '👁️', clerigo: '✨', druida: '🌿', explorador: '🏹',
  guerrero: '⚔️', hechicero: '🔥', mago: '📖', monje: '👊', paladin: '🛡️', picaro: '🗡️', artificiero: '🔧',
};
export const SPECIES_ICON = {
  aasimar: '😇', draconido: '🐉', elfo: '🧝', enano: '⛏️', gnomo: '⚙️', goliat: '🏔️', humano: '🧑', mediano: '🍀', orco: '💪', tiefling: '😈',
  jentil: '🪨', lamina: '🦆', basajaun: '🌲', iratxo: '🧚',
  aarakocra: '🦅', osgo: '🐻', centauro: '🐎', cambiaformas: '🐺', cambiante: '🎭', duergar: '⚒️', eladrin: '🍂', elfo_mar: '🐚',
  firbolg: '🌳', genasi: '🌪️', githyanki: '⚔️', githzerai: '🧘', gnomo_profundidades: '💎', goblin: '👺', hada: '🧚‍♀️', harengon: '🐇',
  hobgoblin: '🎖️', kenku: '🐦‍⬛', kobold: '🦎', hombre_lagarto: '🐊', minotauro: '🐂', satiro: '🐐', shadar_kai: '🌑', tabaxi: '🐆',
  tortuga: '🐢', triton: '🔱', yuan_ti: '🐍', buhonido: '🦉', grung: '🐸', locathah: '🐟', verdan: '🧠', semielfo: '🧝‍♂️', semiorco: '🗿',
  leonido: '🦁', loxodon: '🐘', hibrido_simic: '🧬', vedalken: '🔷', dhampiro: '🧛', sangre_maldita: '🧙‍♀️', renacido: '💀',
};
// Grupos de especies en el creador, en este orden, con una nota para los que no son del manual
const SPECIES_GROUPS = [
  ['Manual del Jugador (2024)', ''],
  ['Monstruos del Multiverso', 'Del «Manual para casi todo»: la versión de Monstruos del Multiverso adaptada a 2024 (el trasfondo da los aumentos de característica).'],
  ['Otros libros', 'Del «Manual para casi todo»: especies de otros libros y de la edición de 2014 adaptadas a 2024.'],
  ['De Euskal Herria', 'Especies propias de esta app, equilibradas como las del manual.'],
  ['Personalizadas', 'Creadas en esta mesa: pulsa «Nueva especie» para crear la tuya.'],
];
const groupOf = (s) => s.group || (s.page ? 'Manual del Jugador (2024)' : 'De Euskal Herria');
const COLORS = ['#5b9cff', '#4cc38a', '#e2b456', '#a77bff', '#e0524a', '#ff8a3d', '#2bb3b3', '#e0527f', '#c9d1d9', '#8b5e3c'];
// Alternativas al estilo de combate que dan el paladín y el explorador
const STYLE_EXTRA = { paladin: ['Guerrero bendito', 'Dos trucos de clérigo (por ejemplo guía y llama sagrada).'], explorador: ['Guerrero druídico', 'Dos trucos de druida (por ejemplo guía y voluta estelar).'] };

export async function openCreator({ onCreate }) {
  let R = await reference();
  const st = {
    step: 0, classId: '', classSkills: [], classChoice: '', backgroundId: '', speciesId: '', lineage: '', size: '', speciesSkills: [], humanFeat: '',
    languages: ['Común'], method: 'estandar', assign: blank(''), points: blank(8), rolled: [], rolledAssign: blank(''),
    bgMode: '2-1', plus2: '', plus1: '', name: '', player: '', alignment: 'Neutral bueno', level: 1, subclass: '', style: '', asi: {},
    kit: 0, bgKit: 0, color: COLORS[Math.floor(Math.random() * COLORS.length)], spells: [], picks: {},
  };
  const cls = () => R.classes.find((c) => c.id === st.classId);
  const bg = () => R.backgrounds.find((b) => b.id === st.backgroundId);
  const sp = () => R.species.find((s) => s.id === st.speciesId);
  const skillName = (k) => R.skills.find((s) => s.key === k)?.name || k;
  // Niveles en los que la clase da Mejora de característica o Don épico hasta el nivel elegido
  const asiLevels = () => Object.entries(cls()?.features || {}).filter(([l, fs]) => Number(l) <= st.level && fs.some((f) => f === 'Mejora de característica' || f === 'Don épico')).map(([l]) => Number(l));

  const body = h('div', { class: 'cr-body' });
  const steps = h('ol', { class: 'cr-steps' });
  const back = h('button', { class: 'btn', type: 'button', onclick: () => go(st.step - 1) }, icon('back', 16), 'Atrás');
  const next = h('button', { class: 'btn primary lg', type: 'button', onclick: () => (st.step === 4 ? create() : go(st.step + 1)) });
  const hint = h('span', { class: 'cr-hint small muted' });
  const overlay = h('div', { class: 'creator', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Crear un aventurero' },
    h('div', { class: 'cr-frame' },
      h('header', { class: 'cr-head' },
        h('div', {}, h('div', { class: 'eyebrow', style: { margin: 0 } }, `${R.edition} · Capítulo 2`), h('h2', {}, 'Crea tu aventurero')),
        steps,
        h('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Cerrar', onclick: close }, icon('close'))),
      body,
      h('footer', { class: 'cr-foot' }, back, hint, next)));
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  render();

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }

  function go(i) {
    if (i < 0 || i > 4) return;
    if (i > st.step && !valid(st.step)) return toast(problem(st.step), { iconName: 'sparkle' });
    st.step = i;
    sfx.page();
    render();
    body.scrollTop = 0;
  }

  // ------------------------------------------------------------- validación
  function valid(step) { return !problem(step); }
  function problem(step) {
    const c = cls();
    if (step === 0) {
      if (!c) return 'Elige una clase.';
      if (st.classSkills.length !== c.skills.choose) return `Elige ${c.skills.choose} habilidades de clase.`;
      if (c.choice && !st.classChoice) return `Elige tu ${c.choice.name.toLowerCase()}.`;
    }
    if (step === 1) {
      if (!bg()) return 'Elige un trasfondo.';
      if (!sp()) return 'Elige una especie.';
      if (sp().options && !st.lineage) return `Elige ${sp().options_label.toLowerCase()}.`;
      if (st.speciesSkills.length < speciesSkillCount(sp())) return `Elige ${speciesSkillCount(sp())} habilidades de tu especie.`;
      if (sp().origin_feat_choice && !st.humanFeat) return 'Elige la dote de origen de «Versátil».';
      if (st.languages.length !== 3) return 'Elige dos idiomas además del común.';
      if (st.classSkills.length !== c.skills.choose) return 'Te falta una habilidad de clase (tu trasfondo ya te daba alguna).';
    }
    if (step === 2) {
      const base = baseScores();
      if (ABILITY_KEYS.some((k) => !base[k])) return 'Asigna una puntuación a cada característica.';
      if (st.method === 'puntos' && spent() > R.point_buy.budget) return 'Te has pasado de los 27 puntos.';
      if (st.bgMode === '2-1' && (!st.plus2 || !st.plus1 || st.plus2 === st.plus1)) return 'Elige dónde van el +2 y el +1 de tu trasfondo.';
    }
    if (step === 3) {
      if (!st.name.trim()) return 'Ponle un nombre.';
      if (c?.style_level && st.level >= c.style_level && !st.style) return 'Elige tu estilo de combate.';
      if (asiLevels().some((l) => !st.asi[l]?.pick)) return 'Elige qué mejoras en cada nivel con Mejora de característica.';
    }
    return '';
  }

  // ------------------------------------------------- especies y clases propias
  async function homebrew(kind, existing = null) {
    const saved = await editHomebrew(kind, R, existing);
    if (!saved) return;
    R = await reloadReference();
    const id = saved === 'deleted' ? '' : `hb-${saved.id}`;
    if (kind === 'species') Object.assign(st, { speciesId: id, lineage: '', speciesSkills: [], size: R.species.find((s) => s.id === id)?.size.split(' o ')[0] || '' });
    else Object.assign(st, { classId: id, classSkills: [], subclass: '', classChoice: '', style: '', asi: {}, kit: 0 });
    render();
  }
  const homebrewDoc = async (kind, x) => (await api.list('homebrew')).find((d) => d.id === x.homebrew_id && d.kind === kind);

  // ---------------------------------------------------------- características
  function blank(v) { return Object.fromEntries(ABILITY_KEYS.map((k) => [k, v])); }
  function spent() { return ABILITY_KEYS.reduce((s, k) => s + R.point_buy.cost[st.points[k]], 0); }
  function baseScores() {
    if (st.method === 'puntos') return { ...st.points };
    const src = st.method === 'estandar' ? st.assign : st.rolledAssign;
    return Object.fromEntries(ABILITY_KEYS.map((k) => [k, Number(src[k]) || 0]));
  }
  function finalScores() {
    const s = baseScores();
    const b = bg();
    if (!b) return s;
    if (st.bgMode === '1-1-1') b.abilities.forEach((k) => { s[k] += 1; });
    else { if (st.plus2) s[st.plus2] += 2; if (st.plus1) s[st.plus1] += 1; }
    ABILITY_KEYS.forEach((k) => { s[k] = Math.min(20, s[k]); });
    return s;
  }
  // Puntuaciones con las mejoras de los niveles 4, 8… (las dotes generales y los dones épicos suben +1)
  function withImprovements(s) {
    const out = { ...s };
    const feats = [];
    for (const l of asiLevels()) {
      const { pick = '', boost = '' } = st.asi[l] || {};
      const [kind, val] = pick.split(':');
      if (kind === '2') out[val] = Math.min(20, out[val] + 2);
      if (kind === '1') val.split(',').forEach((k) => { out[k] = Math.min(20, out[k] + 1); });
      if (kind === 'feat') {
        const f = R.feats.find((x) => x.name === val);
        feats.push(val);
        if (boost) out[boost] = Math.min(f?.category === 'don épico' ? 30 : 20, out[boost] + 1);
      }
    }
    return { scores: out, feats };
  }

  // ------------------------------------------------------------------ pintado
  function render() {
    clear(steps, STEPS.map((name, i) => h('li', { class: `${i === st.step ? 'on' : ''} ${i < st.step ? 'done' : ''}` },
      h('button', { type: 'button', onclick: () => { if (i <= st.step || STEPS.slice(0, i).every((_, j) => valid(j))) { st.step = i; render(); } } },
        h('span', { class: 'cr-n' }, i < st.step ? '✓' : i + 1), name))));
    back.disabled = st.step === 0;
    clear(next, st.step === 4 ? [icon('sparkle', 18), '¡Crear aventurero!'] : ['Siguiente', icon('arrowRight', 18)]);
    hint.textContent = problem(st.step);
    clear(body, [stepClass, stepOrigin, stepAbilities, stepDetails, stepSummary][st.step]());
  }
  const refresh = () => { const y = body.scrollTop; render(); body.scrollTop = y; };
  // Tras elegir una carta, muestra el detalle que aparece debajo de su rejilla.
  const choose = (e) => {
    const gi = [...body.querySelectorAll('.cr-grid')].indexOf(e.currentTarget.parentElement);
    refresh();
    const next = body.querySelectorAll('.cr-grid')[gi]?.nextElementSibling;
    if (next?.classList.contains('cr-detail')) requestAnimationFrame(() => next.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const option = (on, onclick, title, text) => h('button', { class: `cr-option ${on ? 'sel' : ''}`, type: 'button', onclick: () => { onclick(); refresh(); } },
    h('b', {}, title), text && h('span', { class: 'tiny' }, text));

  // Paso 1: clase
  function stepClass() {
    const c = cls();
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'La clase es la decisión más importante: define la vocación, los talentos y las tácticas de tu personaje.'),
      h('div', { class: 'cr-grid' }, R.classes.map((k) => h('button', {
        class: `cr-card ${k.id === st.classId ? 'sel' : ''}`, type: 'button',
        onclick: (e) => { if (st.classId !== k.id) { Object.assign(st, { classId: k.id, classSkills: [], subclass: '', classChoice: '', style: '', asi: {}, kit: 0 }); sfx.click(); } choose(e); },
      }, h('span', { class: 'cr-emoji' }, CLASS_ICON[k.id] || '🧩'), h('b', {}, k.name),
      h('span', { class: 'small' }, k.summary),
      h('span', { class: 'cr-tags' }, h('span', { class: 'chip' }, `d${k.hit_die}`), h('span', { class: 'chip' }, k.primary.map((a) => ABILITY_SHORT[a]).join(' y ')),
        h('span', { class: `chip cx-${k.complexity.toLowerCase()}` }, k.complexity)))),
      h('button', { class: 'cr-card cr-new', type: 'button', onclick: () => homebrew('class') }, h('span', { class: 'cr-emoji' }, '➕'), h('b', {}, 'Nueva clase'),
        h('span', { class: 'small' }, 'Crea una clase propia con sus rasgos, magia y subclases.'))),
      c && h('section', { class: 'panel cr-detail' },
        h('div', { class: 'panel-head' }, h('h3', {}, CLASS_ICON[c.id] || '🧩', ' ', c.name),
          h('div', { class: 'actions' }, c.homebrew_id && h('button', { class: 'btn xs', type: 'button', onclick: async () => homebrew('class', await homebrewDoc('class', c)) }, icon('edit', 13), 'Editar'),
            h('span', { class: 'chip' }, source(c)))),
        h('dl', { class: 'cr-dl' },
          h('dt', {}, 'Dado de golpe'), h('dd', {}, `d${c.hit_die} por nivel · ${c.hit_die} + CON en el nivel 1`),
          h('dt', {}, 'Salvaciones'), h('dd', {}, c.saves.map((k) => ABILITY_NAME[k]).join(' y ')),
          h('dt', {}, 'Armas'), h('dd', {}, c.weapons), h('dt', {}, 'Armaduras'), h('dd', {}, c.armor),
          c.tools && [h('dt', {}, 'Herramientas'), h('dd', {}, c.tools)],
          c.caster && [h('dt', {}, 'Magia'), h('dd', {}, `${c.caster === 'pact' ? 'Magia del pacto' : 'Lanzamiento de conjuros'} con ${ABILITY_NAME[c.spell_ability]}`)]),
        h('ul', { class: 'cr-traits small' }, featuresUpTo(c, 1).map(([, f, t]) => h('li', {}, h('b', {}, f), t && ` — ${t}`))),
        c.choice && [h('div', { class: 'eyebrow' }, c.choice.name),
          h('div', { class: 'cr-options' }, c.choice.options.map(([n, t]) => option(st.classChoice === n, () => { st.classChoice = n; }, n, t)))],
        h('div', { class: 'eyebrow' }, `Elige ${c.skills.choose} habilidades (${st.classSkills.length}/${c.skills.choose})`),
        skillPicker(c.skills.from, st.classSkills, c.skills.choose, bg()?.skills || [])));
  }

  function skillPicker(options, chosen, max, taken = []) {
    return h('div', { class: 'cr-skills' }, options.map((k) => {
      const on = chosen.includes(k);
      const blocked = taken.includes(k);
      return h('button', { class: `chip pick ${on ? 'on' : ''}`, type: 'button', disabled: blocked && !on, 'data-tip': blocked ? 'Ya la tienes por tu trasfondo' : null,
        onclick: () => {
          if (on) chosen.splice(chosen.indexOf(k), 1);
          else if (chosen.length < max) chosen.push(k);
          else { chosen.shift(); chosen.push(k); }
          sfx.click();
          refresh();
        } }, on ? '✓ ' : '', skillName(k));
    }));
  }

  // Paso 2: origen
  function stepOrigin() {
    const b = bg();
    const s = sp();
    const c = cls();
    // si el trasfondo da una habilidad ya elegida por la clase, hay que elegir otra
    if (b) st.classSkills = st.classSkills.filter((k) => !b.skills.includes(k));
    const originFeats = R.feats.filter((f) => f.category === 'origen');
    const speciesCard = (k) => h('button', {
      class: `cr-card ${k.id === st.speciesId ? 'sel' : ''} ${k.page ? '' : 'homebrew'}`, type: 'button',
      onclick: (e) => { if (st.speciesId !== k.id) { Object.assign(st, { speciesId: k.id, lineage: '', speciesSkills: [], humanFeat: '', size: k.size.split(' o ')[0] }); sfx.click(); } choose(e); },
    }, h('span', { class: 'cr-emoji' }, SPECIES_ICON[k.id] || '🧬'), h('b', {}, k.name),
    h('span', { class: 'tiny muted' }, `${k.size} · ${fmtM(k.speed)}${k.darkvision ? ` · visión ${k.darkvision} m` : ''}`));
    const nSkills = speciesSkillCount(s);
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'Tu origen es lo que eras antes de la aventura: un trasfondo, una especie y los idiomas que hablas.'),
      h('h3', { class: 'cr-h' }, '1 · Trasfondo'),
      h('div', { class: 'cr-grid small-cards' }, R.backgrounds.map((k) => h('button', {
        class: `cr-card ${k.id === st.backgroundId ? 'sel' : ''}`, type: 'button',
        onclick: (e) => { st.backgroundId = k.id; st.plus2 = ''; st.plus1 = ''; sfx.click(); choose(e); },
      }, h('b', {}, k.name), h('span', { class: 'cr-tags' }, k.abilities.map((a) => h('span', { class: 'chip' }, ABILITY_SHORT[a]))),
      h('span', { class: 'tiny' }, `Dote: ${k.feat}`), h('span', { class: 'tiny muted' }, k.skills.map(skillName).join(' · '))))),
      b && h('div', { class: 'cr-note' }, `${b.name} (${source(b)}): competencias en ${b.skills.map(skillName).join(' y ')}, ${b.tool.toLowerCase()} y la dote ${b.feat}.`),
      c && st.classSkills.length < c.skills.choose && h('div', { class: 'panel cr-detail' },
        h('div', { class: 'eyebrow', style: { marginTop: 0 } }, `Tu trasfondo ya te da alguna habilidad de clase: elige ${c.skills.choose - st.classSkills.length} más`),
        skillPicker(c.skills.from, st.classSkills, c.skills.choose, b?.skills || [])),
      h('h3', { class: 'cr-h' }, '2 · Especie'),
      SPECIES_GROUPS.map(([g, note], i) => {
        const list = R.species.filter((k) => groupOf(k) === g);
        if (!list.length && g !== 'Personalizadas') return null;
        return [i > 0 && h('div', { class: 'eyebrow cr-basque' }, g, note && ` · ${note}`),
          h('div', { class: 'cr-grid small-cards' }, list.map(speciesCard),
            g === 'Personalizadas' && h('button', { class: 'cr-card cr-new', type: 'button', onclick: () => homebrew('species') }, h('span', { class: 'cr-emoji' }, '➕'), h('b', {}, 'Nueva especie'),
              h('span', { class: 'tiny muted' }, 'Crea la tuya')))];
      }),
      s && h('section', { class: 'panel cr-detail' },
        h('div', { class: 'panel-head' }, h('h3', {}, SPECIES_ICON[s.id] || '🧬', ' ', s.name),
          h('div', { class: 'actions' }, s.homebrew_id && h('button', { class: 'btn xs', type: 'button', onclick: async () => homebrew('species', await homebrewDoc('species', s)) }, icon('edit', 13), 'Editar'),
            h('span', { class: 'chip' }, source(s)))),
        s.summary && h('p', { class: 'small' }, s.summary),
        h('ul', { class: 'cr-traits' }, s.traits.map(([n, t]) => h('li', {}, h('b', {}, n), ' — ', t))),
        s.skills?.length > 0 && h('p', { class: 'small' }, h('b', {}, 'Competencias: '), s.skills.map(skillName).join(', ')),
        s.size.includes(' o ') && [h('div', { class: 'eyebrow' }, 'Tamaño'),
          h('div', { class: 'cr-options' }, s.size.split(' o ').map((z) => option(st.size === z, () => { st.size = z; }, z)))],
        s.options && [h('div', { class: 'eyebrow' }, s.options_label),
          h('div', { class: 'cr-options' }, s.options.map(([n, t]) => option(st.lineage === n, () => { st.lineage = n; }, n, t)))],
        nSkills > 0 && [h('div', { class: 'eyebrow' }, s.id === 'elfo' ? 'Sentidos agudos' : s.id === 'humano' ? 'Diestro: una habilidad' : `Habilidades de tu especie: elige ${nSkills} (${st.speciesSkills.length}/${nSkills})`),
          h('div', { class: 'cr-skills' }, (s.skill_choice && s.skill_choice !== 'any' ? s.skill_choice : R.skills.map((k) => k.key)).map((k) => {
            const on = st.speciesSkills.includes(k);
            const taken = (b?.skills || []).includes(k) || st.classSkills.includes(k) || (s.skills || []).includes(k);
            return h('button', { class: `chip pick ${on ? 'on' : ''}`, type: 'button', disabled: taken && !on,
              onclick: () => { st.speciesSkills = on ? st.speciesSkills.filter((x) => x !== k) : [...st.speciesSkills, k].slice(-nSkills); refresh(); } }, skillName(k));
          }))],
        s.origin_feat_choice && [h('div', { class: 'eyebrow' }, 'Versátil: una dote de origen'),
          h('div', { class: 'cr-options' }, originFeats.map((f) => option(st.humanFeat === f.name, () => { st.humanFeat = f.name; }, f.name, f.summary)))]),
      h('h3', { class: 'cr-h' }, '3 · Idiomas'),
      h('p', { class: 'small muted' }, 'Sabes común y otros dos idiomas estándar.'),
      h('div', { class: 'cr-skills' }, R.languages.estandar.map((l) => {
        const on = st.languages.includes(l);
        return h('button', { class: `chip pick ${on ? 'on' : ''}`, type: 'button', disabled: l === 'Común',
          onclick: () => {
            if (on) st.languages = st.languages.filter((x) => x !== l);
            else if (st.languages.length < 3) st.languages.push(l);
            else st.languages = ['Común', st.languages[2], l];
            refresh();
          } }, on ? '✓ ' : '', l);
      })));
  }

  // Paso 3: características
  function stepAbilities() {
    const c = cls();
    const b = bg();
    const base = baseScores();
    const fin = finalScores();
    const methodBtn = (id, label) => h('button', { type: 'button', 'aria-pressed': String(st.method === id), onclick: () => { st.method = id; refresh(); } }, label);
    const pool = st.method === 'estandar' ? R.standard_array : st.rolled;
    const assigner = (src) => h('div', { class: 'cr-abil-grid' }, ABILITY_KEYS.map((k) => {
      const used = ABILITY_KEYS.filter((x) => x !== k && src[x] !== '').map((x) => String(src[x]));
      const remaining = pool.map(String).filter((v, i, arr) => {
        const before = arr.slice(0, i).filter((x) => x === v).length;
        return used.filter((u) => u === v).length <= before;
      });
      const sel = h('select', { 'aria-label': ABILITY_NAME[k], onchange: (e) => { src[k] = e.target.value; refresh(); } },
        h('option', { value: '' }, '—'), [...new Set(remaining)].map((v) => h('option', { value: v, selected: String(src[k]) === v }, v)));
      return abilBox(k, sel);
    }));
    const abilBox = (k, control) => h('div', { class: `cr-abil ${c?.primary.includes(k) ? 'primary' : ''}` },
      h('span', { class: 'cr-abil-name' }, ABILITY_NAME[k], c?.primary.includes(k) && h('span', { 'data-tip': 'Característica principal de tu clase' }, ' ★')),
      control,
      h('span', { class: 'cr-abil-final' }, fin[k] || '—', h('small', {}, fin[k] ? fmtMod(mod(fin[k])) : '')),
      fin[k] !== base[k] && base[k] ? h('span', { class: 'cr-bonus' }, `+${fin[k] - base[k]}`) : null);

    let methodBody;
    if (st.method === 'estandar') {
      methodBody = [h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Reparte 15, 14, 13, 12, 10 y 8.'),
        c && h('button', { class: 'btn sm', type: 'button', onclick: () => { st.assign = Object.fromEntries(ABILITY_KEYS.map((k) => [k, String(c.standard[k])])); refresh(); } },
          icon('sparkle', 14), `Reparto recomendado para ${c.name}`)), assigner(st.assign)];
    } else if (st.method === 'puntos') {
      const left = R.point_buy.budget - spent();
      methodBody = [h('div', { class: `cr-points ${left < 0 ? 'over' : ''}` }, h('b', {}, left), ' puntos libres de 27'),
        h('div', { class: 'cr-abil-grid' }, ABILITY_KEYS.map((k) => abilBox(k, h('div', { class: 'row nowrap cr-pb' },
          h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Bajar', disabled: st.points[k] <= 8, onclick: () => { st.points[k] -= 1; refresh(); } }, icon('minus', 13)),
          h('b', {}, st.points[k]), h('span', { class: 'tiny muted' }, `(${R.point_buy.cost[st.points[k]]})`),
          h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Subir', disabled: st.points[k] >= 15, onclick: () => { st.points[k] += 1; refresh(); } }, icon('plus', 13))))))];
    } else {
      methodBody = [h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          const out = [];
          for (let i = 0; i < 6; i++) { const r = await roll('4d6kh3', { label: `Característica ${i + 1}`, quiet: true }); if (r) out.push(r.total); }
          st.rolled = out.sort((a, z) => z - a);
          st.rolledAssign = blank('');
          sfx.magic();
          refresh();
        } }, icon('dados', 16), st.rolled.length ? 'Volver a tirar' : 'Tirar 4d6 seis veces'),
        st.rolled.length > 0 && h('span', { class: 'cr-rolled' }, st.rolled.map((v) => h('b', {}, v)))),
      st.rolled.length > 0 && assigner(st.rolledAssign)];
    }

    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'Genera seis puntuaciones con uno de los tres métodos del manual y luego aplica los aumentos de tu trasfondo.'),
      h('div', { class: 'seg' }, methodBtn('estandar', 'Conjunto estándar'), methodBtn('puntos', 'Coste en puntos'), methodBtn('tirar', 'Tirar 4d6')),
      methodBody,
      b && h('section', { class: 'panel cr-detail' },
        h('div', { class: 'panel-head' }, h('h3', {}, `Aumentos de ${b.name}`), h('span', { class: 'small muted' }, b.abilities.map((k) => ABILITY_NAME[k]).join(', '))),
        h('div', { class: 'seg' },
          h('button', { type: 'button', 'aria-pressed': String(st.bgMode === '2-1'), onclick: () => { st.bgMode = '2-1'; refresh(); } }, '+2 y +1'),
          h('button', { type: 'button', 'aria-pressed': String(st.bgMode === '1-1-1'), onclick: () => { st.bgMode = '1-1-1'; refresh(); } }, '+1 a las tres')),
        st.bgMode === '2-1' && h('div', { class: 'row', style: { marginTop: '10px' } },
          h('span', { class: 'small' }, '+2 a'), h('div', { class: 'seg' }, b.abilities.map((k) => h('button', { type: 'button', 'aria-pressed': String(st.plus2 === k), onclick: () => { st.plus2 = k; if (st.plus1 === k) st.plus1 = ''; refresh(); } }, ABILITY_SHORT[k]))),
          h('span', { class: 'small' }, '+1 a'), h('div', { class: 'seg' }, b.abilities.map((k) => h('button', { type: 'button', disabled: st.plus2 === k, 'aria-pressed': String(st.plus1 === k), onclick: () => { st.plus1 = k; refresh(); } }, ABILITY_SHORT[k])))),
        h('p', { class: 'tiny muted' }, 'Ninguna puntuación puede superar 20.')));
  }

  // Mejora de característica (o dote) de un nivel: un desplegable con todas las opciones
  function asiRow(l) {
    const epic = cls().features[l].includes('Don épico');
    const cur = st.asi[l] || {};
    const pairs = ABILITY_KEYS.flatMap((a, i) => ABILITY_KEYS.slice(i + 1).map((b) => [a, b]));
    const pool = R.feats.filter((f) => f.category === (epic ? 'don épico' : 'general') && f.name !== 'Mejora de característica');
    const sel = h('select', { 'aria-label': `Mejora del nivel ${l}`, onchange: (e) => { st.asi[l] = { pick: e.target.value, boost: '' }; refresh(); } },
      h('option', { value: '' }, '— Elige —'),
      h('optgroup', { label: '+2 a una característica' }, ABILITY_KEYS.map((k) => h('option', { value: `2:${k}`, selected: cur.pick === `2:${k}` }, `+2 ${ABILITY_NAME[k]}`))),
      h('optgroup', { label: '+1 a dos características' }, pairs.map(([a, b]) => h('option', { value: `1:${a},${b}`, selected: cur.pick === `1:${a},${b}` }, `+1 ${ABILITY_SHORT[a]} y +1 ${ABILITY_SHORT[b]}`))),
      h('optgroup', { label: epic ? 'Dones épicos' : 'Dotes generales' }, pool.map((f) => h('option', { value: `feat:${f.name}`, selected: cur.pick === `feat:${f.name}` }, `${f.name}${f.prereq ? ` (${f.prereq})` : ''}`))));
    const feat = cur.pick?.startsWith('feat:') && R.feats.find((f) => f.name === cur.pick.slice(5));
    const boosts = featAbilities(feat);
    return h('div', { class: 'cr-asi' }, h('span', { class: 'chip' }, `Nv ${l}`), sel,
      boosts.length > 0 && h('select', { 'aria-label': 'Característica +1 de la dote', onchange: (e) => { cur.boost = e.target.value; refresh(); } },
        h('option', { value: '' }, '+1 a…'), boosts.map((k) => h('option', { value: k, selected: cur.boost === k }, `+1 ${ABILITY_NAME[k]}`))),
      feat && h('span', { class: 'tiny muted grow' }, feat.summary));
  }

  // Lista de objetos de un paquete de equipo
  const kitText = (items, gold) => `${items.map(([n, name]) => (n > 1 ? `${n} × ${name}` : name)).join(', ')} y ${gold} po`;

  // Paso 4: detalles
  function stepDetails() {
    const c = cls();
    const b = bg();
    const nameIn = h('input', { value: st.name, placeholder: 'Nombre del personaje', oninput: (e) => { st.name = e.target.value; hint.textContent = problem(3); } });
    const playerIn = h('input', { value: st.player, placeholder: 'Quién lo juega', oninput: (e) => { st.player = e.target.value; } });
    const styles = c?.style_level && st.level >= c.style_level
      ? [...R.feats.filter((f) => f.category === 'estilo de combate').map((f) => [f.name, f.summary]), ...(STYLE_EXTRA[c.id] ? [STYLE_EXTRA[c.id]] : [])] : [];
    const letters = 'ABC';
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'Ponle nombre, elige su alineamiento, con qué nivel empieza y su equipo.'),
      h('div', { class: 'grid cols-2' },
        h('label', { class: 'field' }, 'Nombre', nameIn), h('label', { class: 'field' }, 'Jugador/a', playerIn)),
      h('div', { class: 'eyebrow' }, 'Alineamiento'),
      h('div', { class: 'cr-align' }, R.alignments.map((a) => option(st.alignment === a, () => { st.alignment = a; }, a))),
      h('div', { class: 'grid cols-2' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Nivel inicial'),
          h('div', { class: 'row nowrap' }, h('input', { type: 'range', min: 1, max: 20, value: st.level, oninput: (e) => { st.level = Number(e.target.value); refresh(); } }),
            h('b', { class: 'cr-level' }, st.level)),
          h('p', { class: 'tiny muted' }, `Empiezas con ${R.level_xp[st.level - 1].toLocaleString('es-ES')} PX. Los PG de cada nivel usan el valor fijo del manual.`)),
        h('div', {}, h('div', { class: 'eyebrow' }, 'Color de la ficha y los dados'),
          h('div', { class: 'row' }, COLORS.map((col) => h('button', { class: `cr-color ${st.color === col ? 'sel' : ''}`, type: 'button', style: { background: col }, 'aria-label': `Color ${col}`, onclick: () => { st.color = col; refresh(); } }))))),
      c && st.level >= subLevel(c) && c.subclasses.length > 0 && [h('div', { class: 'eyebrow' }, `Subclase (nivel ${subLevel(c)}) · ${source(c)}`),
        h('div', { class: 'cr-options' }, c.subclasses.map((s) => option(st.subclass === s, () => { st.subclass = s; }, s,
          [c.subclass_source?.[s] && c.subclass_source[s] !== 'Manual del Jugador 2024' ? `[${c.subclass_source[s]}]` : '',
            (c.subclass_features[s] || []).filter(([l]) => l === subLevel(c)).map(([, n]) => n).join(' · ')].filter(Boolean).join(' '))))],
      styles.length > 0 && [h('div', { class: 'eyebrow' }, `Estilo de combate (nivel ${c.style_level})`),
        h('div', { class: 'cr-options' }, styles.map(([n, t]) => option(st.style === n, () => { st.style = n; }, n, t)))],
      asiLevels().length > 0 && [h('div', { class: 'eyebrow' }, 'Mejoras de característica y dotes de tus niveles'),
        h('div', { class: 'stack-sm' }, asiLevels().map(asiRow))],
      spellsPanel(),
      c && b && [h('div', { class: 'eyebrow' }, 'Equipo inicial'),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'cr-options vertical' }, h('b', { class: 'small' }, `${c.name}`),
            c.kits.map((k, i) => option(st.kit === i, () => { st.kit = i; }, `Opción ${letters[i]}`, kitText(k.items, k.gold))),
            option(st.kit === c.kits.length, () => { st.kit = c.kits.length; }, `Opción ${letters[c.kits.length]}`, `${c.gold} po para comprar a tu gusto`)),
          h('div', { class: 'cr-options vertical' }, h('b', { class: 'small' }, b.name),
            option(st.bgKit === 0, () => { st.bgKit = 0; }, 'Opción A', kitText(b.kit.items, b.kit.gold)),
            option(st.bgKit === 1, () => { st.bgKit = 1; }, 'Opción B', `${b.kit_gold} po`)))]);
  }

  // Trucos y conjuros de la clase y los que dejan elegir las dotes (Iniciado en la magia…). Todo opcional: lo que
  // falte se puede elegir luego en la ficha.
  function spellsPanel() {
    if (!cls() || !bg() || !sp()) return null;
    const ch = build();
    const counts = spellCounts(ch);
    const choices = spellChoices(ch);
    if (!counts && !choices.length) return null;
    const lists = spellLists(ch);
    const top = Math.max(1, ch.slots.reduce((m, x, i) => (x.max > 0 ? i + 1 : m), 0));
    const taken = (s) => st.spells.includes(s.name) || grantedSpells(ch).some((g) => g.name === s.name);
    const chips = (names, remove) => names.map((n) => h('span', { class: 'chip', 'data-tip': spellTip(R.spells.find((x) => x.name === n)) }, n,
      h('button', { type: 'button', class: 'chip-x', 'aria-label': `Quitar ${n}`, onclick: () => { remove(n); refresh(); } }, '✕')));
    const row = (label, have, max, names, remove, open) => h('div', { class: 'cr-spell-row' },
      h('b', { class: 'small' }, `${label} (${have}/${max})`), chips(names, remove),
      h('button', { class: 'btn xs', type: 'button', onclick: open }, icon('plus', 13), 'Elegir'));
    const classPick = (cantrip) => pickSpells({ title: cantrip ? 'Trucos' : 'Conjuros preparados', spells: R.spells, lists, isTaken: taken,
      levels: cantrip ? [0] : Array.from({ length: top }, (_, i) => i + 1), onPick: (s) => { st.spells.push(s.name); } }).then(refresh);
    const ofLevel = (cantrip) => st.spells.filter((n) => !R.spells.find((x) => x.name === n)?.level === cantrip);
    const granted = grantedSpells(ch).filter((g) => !g.pick);
    return [h('div', { class: 'eyebrow' }, 'Conjuros'),
      h('div', { class: 'stack-sm' },
        counts && counts.cantrips.max > 0 && row('Trucos', counts.cantrips.have, counts.cantrips.max, ofLevel(true), (n) => { st.spells = st.spells.filter((x) => x !== n); }, () => classPick(true)),
        counts && counts.prepared.max > 0 && row('Conjuros preparados', counts.prepared.have, counts.prepared.max, ofLevel(false), (n) => { st.spells = st.spells.filter((x) => x !== n); }, () => classPick(false)),
        choices.map((x) => {
          const picks = (st.picks[x.key] ||= []);
          const pool = R.spells.filter((s) => (x.level == null ? s.level >= 1 && s.level <= top : s.level === x.level) && (!x.schools || x.schools.includes(s.school)) && (!x.ritual || s.ritual));
          return row(`${x.label} · ${x.from}`, picks.length, x.count, picks, (n) => { st.picks[x.key] = picks.filter((y) => y !== n); },
            () => pickSpells({ title: `${x.label} · ${x.from}`, spells: pool, lists: x.lists || [], isTaken: (s) => picks.includes(s.name) || picks.length >= x.count,
              onPick: (s) => { picks.push(s.name); } }).then(refresh));
        }),
        granted.length > 0 && h('p', { class: 'tiny muted' }, 'Siempre preparados (no cuentan): ', granted.map((g) => g.name).join(', ')),
        h('p', { class: 'tiny muted' }, 'Puedes dejarlo para luego: en la ficha avisa de lo que falte.'))];
  }

  // Construye la ficha final.
  function build() {
    const c = cls();
    const b = bg();
    const s = sp();
    const { scores, feats: levelFeats } = withImprovements(finalScores());
    const skills = {};
    [...st.classSkills, ...(b?.skills || []), ...(s.skills || []), ...st.speciesSkills].filter(Boolean).forEach((k) => { skills[k] = 1; });
    const lineageText = st.lineage ? ` (${st.lineage.split(' (')[0]})` : '';
    const effects = c.choice?.options.find(([n]) => n === st.classChoice)?.[2] || {};
    const ch = newCharacter('jugador', {
      name: st.name.trim(), player: st.player.trim(), color: st.color, alignment: st.alignment,
      classId: c.id, cls: c.name, subclass: st.level >= subLevel(c) ? st.subclass : '', classChoice: st.classChoice, level: st.level, xp: R.level_xp[st.level - 1],
      speciesId: s.id, race: s.name, lineage: st.lineage, size: st.size || s.size.split(' o ')[0],
      backgroundId: b.id, background: b.name,
      abilities: scores, saves: [...c.saves], skills,
      feats: [b.feat, st.humanFeat, st.style, ...levelFeats].filter(Boolean), masteries: [],
      weaponTraining: [...new Set([...c.weapon_training, ...(effects.weapons || [])])], armorTraining: [...new Set([...c.armor_training, ...(effects.armor || [])])],
      tools: [b.tool, c.tools, s.tool].filter(Boolean).join('; '),
      languages: st.languages.join(', '),
      speed: s.lineage_speed?.[st.lineage] ?? s.speed,
      hitDie: `d${c.hit_die}`, hitDiceLeft: st.level,
      spellAbility: c.spell_ability || c.subclass_casting?.[st.subclass]?.spell_ability || '', autoSlots: !!(c.caster || c.subclass_casting?.[st.subclass]), acMode: 'auto',
      spellList: [...st.spells], spellPicks: structuredClone(st.picks),
      notes: `Especie: ${s.name}${lineageText}. Trasfondo: ${b.name}. Alineamiento: ${st.alignment}.`,
    });
    // equipo inicial: armas a la lista de ataques, armadura y escudo a la CA, el resto al inventario
    const kit = c.kits[st.kit];
    const bkit = st.bgKit === 0 ? b.kit : null;
    ch.coins.po = (kit ? kit.gold : c.gold) + (bkit ? bkit.gold : b.kit_gold);
    for (const [qty, name] of [...(kit?.items || []), ...(bkit?.items || [])]) {
      const w = R.weapons.find((x) => x.name === name);
      if (R.armor.some((a) => a.name === name) && !ch.armor) ch.armor = name;
      if (name === 'Escudo') ch.shield = true;
      if (w && !ch.attacks.some((a) => a.weapon === name)) ch.attacks.push(weaponAttack(ch, w));
      const same = ch.inventory.find((it) => it.name === name);
      if (same) same.qty += qty; else ch.inventory.push({ name, qty, notes: '' });
    }
    ch.attacks.push(...derivedAttacks(ch));
    // magia de la especie, la subclase y las dotes: sin aptitud de clase se usa la mejor mental
    if (grantedSpells(ch).length && !ch.spellAbility) ch.spellAbility = ['int', 'sab', 'car'].reduce((best, k) => (scores[k] > scores[best] ? k : best), 'car');
    ch.speed += featBonus(ch, 'speed');
    ch.maxHp = ch.hp = maxHpFor(ch, st.level);
    ch.ac = computeAC(ch);
    ch.slots = slotsFor(castingOf(ch, c), st.level).map((max) => ({ max, used: 0 }));
    ch.resources = [...classResources(ch, c, st.level), ...grantResources(ch, st.level)];
    return ch;
  }

  // Paso 5: resumen
  function stepSummary() {
    const ch = build();
    const c = cls();
    const s = sp();
    const pb = profBonus(ch);
    const cantrips = c.cantrips ? columnAt({ columns: { x: c.cantrips } }, 'x', ch.level) : null;
    const prepared = c.prepared ? c.prepared[ch.level - 1] : null;
    const pending = pendingChoices(ch);
    return h('div', { class: 'cr-summary' },
      h('div', { class: 'cr-sum-head' },
        h('span', { class: 'cr-avatar', style: { background: ch.color } }, CLASS_ICON[c.id]),
        h('div', {}, h('h2', {}, ch.name),
          h('div', { class: 'muted' }, `${ch.cls}${ch.subclass ? ` (${ch.subclass})` : ''} de nivel ${ch.level} · ${s.name}${st.lineage ? ` (${st.lineage.split(' (')[0]})` : ''} · ${ch.size} · ${ch.background} · ${ch.alignment}`))),
      h('div', { class: 'cr-sum-stats' },
        [['PG', ch.maxHp], ['CA', ch.ac], ['Velocidad', fmtM(ch.speed)], ['Iniciativa', fmtMod(initBonus(ch))],
          ['Competencia', fmtMod(pb)], ['Dados de golpe', `${ch.level}${ch.hitDie}`]].map(([l, v]) => h('div', { class: 'cr-stat' }, h('b', {}, v), h('span', {}, l)))),
      h('div', { class: 'cr-sum-abil' }, ABILITY_KEYS.map((k) => h('div', { class: 'cr-stat' }, h('span', {}, ABILITY_SHORT[k]), h('b', {}, fmtMod(mod(ch.abilities[k]))), h('small', {}, ch.abilities[k], ch.saves.includes(k) ? ' · salv.' : '')))),
      h('div', { class: 'grid cols-2' },
        h('div', { class: 'panel' }, h('h3', {}, 'Competencias'),
          h('p', { class: 'small' }, h('b', {}, 'Habilidades: '), Object.keys(ch.skills).map(skillName).join(', ')),
          h('p', { class: 'small' }, h('b', {}, 'Armas: '), c.weapons, effects(ch, 'weapons', 'marciales'), h('br'), h('b', {}, 'Armaduras: '), c.armor, effects(ch, 'armor', ch.armorTraining.includes('pesada') ? 'pesadas' : 'medias')),
          h('p', { class: 'small' }, h('b', {}, 'Herramientas: '), ch.tools || '—', h('br'), h('b', {}, 'Idiomas: '), ch.languages),
          h('p', { class: 'small' }, h('b', {}, 'Dotes: '), ch.feats.join(', ')),
          ch.attacks.length > 0 && h('p', { class: 'small' }, h('b', {}, 'Ataques: '), ch.attacks.map((a) => (a.save ? `${a.name} (${a.save}, ${a.damage})` : `${a.name} ${fmtMod(a.bonus)} (${a.damage})`)).join(' · ')),
          h('p', { class: 'small' }, h('b', {}, 'Equipo: '), [ch.armor, ch.shield && 'escudo'].filter(Boolean).join(' y ') || 'sin armadura', ` · ${ch.inventory.length} objetos · ${ch.coins.po} po`)),
        h('div', { class: 'panel' }, h('h3', {}, 'Rasgos'),
          h('ul', { class: 'cr-traits small' }, featuresUpTo(c, ch.level, ch.subclass).map(([l, f, t]) => h('li', { 'data-tip': t || null }, h('span', { class: 'chip' }, `Nv ${l}`), ' ', f)),
            s.traits.map(([n, t]) => h('li', { 'data-tip': t }, h('span', { class: 'chip' }, s.name), ' ', n))),
          c.caster && h('p', { class: 'small' }, h('b', {}, 'Magia: '), [cantrips != null && `${cantrips} trucos`, prepared != null && `${prepared} conjuros preparados`,
            `espacios ${ch.slots.map((x, i) => (x.max ? `${x.max}×nv${i + 1}` : null)).filter(Boolean).join(', ')}`].filter(Boolean).join(' · ')),
          grantedSpells(ch).length + ch.spellList.length > 0 && h('p', { class: 'small' }, h('b', {}, 'Conjuros: '),
            [...ch.spellList, ...grantedSpells(ch).map((g) => g.name)].join(', ')))),
      pending.length > 0 && h('div', { class: 'cr-note' }, h('b', {}, 'Te quedará por elegir en la ficha: '), pending.join(' · ')),
      h('p', { class: 'tiny muted center' }, 'Todo queda editable en la ficha.'));
  }
  // Entrenamiento extra que da la elección de clase (Protector, Guardián)
  function effects(ch, key, what) {
    const extra = cls().choice?.options.find(([n]) => n === ch.classChoice)?.[2];
    return extra?.[key] ? ` (y ${what} por tu ${cls().choice.name.toLowerCase()})` : '';
  }

  function create() {
    for (let i = 0; i < 4; i++) if (!valid(i)) { st.step = i; render(); return toast(problem(i)); }
    const ch = build();
    close();
    onCreate(ch);
  }
}

// Cuántas habilidades elige el jugador por su especie (el humano y el elfo, una; otras, las que digan).
const speciesSkillCount = (s) => (s ? s.skill_count || (s.skill_choice ? 1 : 0) : 0);
const subLevel = (c) => c?.subclass_level || 3;
