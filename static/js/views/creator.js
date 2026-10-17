// Asistente para crear un aventurero siguiendo los cinco pasos del Manual del Jugador 2024
// (MdJ p. 33-41): clase, origen (trasfondo, especie e idiomas), características, detalles y resumen.
import { h, clear, icon, toast } from '../core/dom.js';
import {
  reference, newCharacter, ABILITY_KEYS, ABILITY_SHORT, ABILITY_NAME, mod, fmtMod, fmtM, maxHpFor, computeAC,
  slotsFor, classResources, featuresUpTo, profBonus, columnAt,
} from '../core/dnd.js';
import { roll } from '../core/dice.js';
import { sfx } from '../core/sfx.js';

const STEPS = ['Clase', 'Origen', 'Características', 'Detalles', 'Resumen'];
const CLASS_ICON = {
  barbaro: '🪓', bardo: '🎻', brujo: '👁️', clerigo: '✨', druida: '🌿', explorador: '🏹',
  guerrero: '⚔️', hechicero: '🔥', mago: '📖', monje: '👊', paladin: '🛡️', picaro: '🗡️',
};
const SPECIES_ICON = { aasimar: '😇', draconido: '🐉', elfo: '🧝', enano: '⛏️', gnomo: '⚙️', goliat: '🏔️', humano: '🧑', mediano: '🍀', orco: '💪', tiefling: '😈' };
const COLORS = ['#5b9cff', '#4cc38a', '#e2b456', '#a77bff', '#e0524a', '#ff8a3d', '#2bb3b3', '#e0527f', '#c9d1d9', '#8b5e3c'];

// Recursos que dan algunas especies (usos = bonificador por competencia salvo que se indique otra cosa).
export const SPECIES_RESOURCES = {
  aasimar: [['Manos curativas', 1, 'largo']],
  draconido: [['Ataque de aliento', 'pb', 'largo']],
  enano: [['Afinidad con la piedra', 'pb', 'largo']],
  goliat: [['Linaje gigante', 'pb', 'largo']],
  orco: [['Descarga de adrenalina', 'pb', 'corto'], ['Aguante incansable', 1, 'largo']],
};

export async function openCreator({ onCreate }) {
  const R = await reference();
  const st = {
    step: 0, classId: '', classSkills: [], backgroundId: '', speciesId: '', lineage: '', speciesSkill: '', humanFeat: '',
    languages: ['Común'], method: 'estandar', assign: blank(''), points: blank(8), rolled: [], rolledAssign: blank(''),
    bgMode: '2-1', plus2: '', plus1: '', name: '', player: '', alignment: 'Neutral bueno', level: 1, subclass: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)], gold: true,
  };
  const cls = () => R.classes.find((c) => c.id === st.classId);
  const bg = () => R.backgrounds.find((b) => b.id === st.backgroundId);
  const sp = () => R.species.find((s) => s.id === st.speciesId);
  const skillName = (k) => R.skills.find((s) => s.key === k)?.name || k;

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
    }
    if (step === 1) {
      if (!bg()) return 'Elige un trasfondo.';
      if (!sp()) return 'Elige una especie.';
      if (sp().options && !st.lineage) return `Elige ${sp().options_label.toLowerCase()}.`;
      if (sp().skill_choice && !st.speciesSkill) return 'Elige la habilidad que te da tu especie.';
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
    if (step === 3 && !st.name.trim()) return 'Ponle un nombre.';
    return '';
  }

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

  // Paso 1: clase
  function stepClass() {
    const c = cls();
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'La clase es la decisión más importante: define la vocación, los talentos y las tácticas de tu personaje.'),
      h('div', { class: 'cr-grid' }, R.classes.map((k) => h('button', {
        class: `cr-card ${k.id === st.classId ? 'sel' : ''}`, type: 'button',
        onclick: () => { if (st.classId !== k.id) { st.classId = k.id; st.classSkills = []; st.subclass = ''; sfx.click(); } refresh(); },
      }, h('span', { class: 'cr-emoji' }, CLASS_ICON[k.id]), h('b', {}, k.name),
      h('span', { class: 'small' }, k.summary),
      h('span', { class: 'cr-tags' }, h('span', { class: 'chip' }, `d${k.hit_die}`), h('span', { class: 'chip' }, k.primary.map((a) => ABILITY_SHORT[a]).join(' y ')),
        h('span', { class: `chip cx-${k.complexity.toLowerCase()}` }, k.complexity))))),
      c && h('section', { class: 'panel cr-detail' },
        h('div', { class: 'panel-head' }, h('h3', {}, CLASS_ICON[c.id], ' ', c.name), h('span', { class: 'chip' }, `MdJ p. ${c.page}`)),
        h('dl', { class: 'cr-dl' },
          h('dt', {}, 'Dado de golpe'), h('dd', {}, `d${c.hit_die} por nivel · ${c.hit_die} + CON en el nivel 1`),
          h('dt', {}, 'Salvaciones'), h('dd', {}, c.saves.map((k) => ABILITY_NAME[k]).join(' y ')),
          h('dt', {}, 'Armas'), h('dd', {}, c.weapons), h('dt', {}, 'Armaduras'), h('dd', {}, c.armor),
          c.tools && [h('dt', {}, 'Herramientas'), h('dd', {}, c.tools)],
          c.caster && [h('dt', {}, 'Magia'), h('dd', {}, `${c.caster === 'pact' ? 'Magia del pacto' : 'Lanzamiento de conjuros'} con ${ABILITY_NAME[c.spell_ability]}`)],
          h('dt', {}, 'Rasgos de nivel 1'), h('dd', {}, c.features[1].join(', '))),
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
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'Tu origen es lo que eras antes de la aventura: un trasfondo, una especie y los idiomas que hablas.'),
      h('h3', { class: 'cr-h' }, '1 · Trasfondo'),
      h('div', { class: 'cr-grid small-cards' }, R.backgrounds.map((k) => h('button', {
        class: `cr-card ${k.id === st.backgroundId ? 'sel' : ''}`, type: 'button',
        onclick: () => { st.backgroundId = k.id; st.plus2 = ''; st.plus1 = ''; sfx.click(); refresh(); },
      }, h('b', {}, k.name), h('span', { class: 'cr-tags' }, k.abilities.map((a) => h('span', { class: 'chip' }, ABILITY_SHORT[a]))),
      h('span', { class: 'tiny' }, `Dote: ${k.feat}`), h('span', { class: 'tiny muted' }, k.skills.map(skillName).join(' · '))))),
      b && h('div', { class: 'cr-note' }, `${b.name} (MdJ p. ${b.page}): competencias en ${b.skills.map(skillName).join(' y ')}, ${b.tool.toLowerCase()} y la dote ${b.feat}.`),
      c && st.classSkills.length < c.skills.choose && h('div', { class: 'panel cr-detail' },
        h('div', { class: 'eyebrow', style: { marginTop: 0 } }, `Tu trasfondo ya te da alguna habilidad de clase: elige ${c.skills.choose - st.classSkills.length} más`),
        skillPicker(c.skills.from, st.classSkills, c.skills.choose, b?.skills || [])),
      h('h3', { class: 'cr-h' }, '2 · Especie'),
      h('div', { class: 'cr-grid small-cards' }, R.species.map((k) => h('button', {
        class: `cr-card ${k.id === st.speciesId ? 'sel' : ''}`, type: 'button',
        onclick: () => { if (st.speciesId !== k.id) { st.speciesId = k.id; st.lineage = ''; st.speciesSkill = ''; st.humanFeat = ''; sfx.click(); } refresh(); },
      }, h('span', { class: 'cr-emoji' }, SPECIES_ICON[k.id]), h('b', {}, k.name),
      h('span', { class: 'tiny muted' }, `${k.size} · ${fmtM(k.speed)}${k.darkvision ? ` · visión ${k.darkvision} m` : ''}`)))),
      s && h('section', { class: 'panel cr-detail' },
        h('div', { class: 'panel-head' }, h('h3', {}, SPECIES_ICON[s.id], ' ', s.name), h('span', { class: 'chip' }, `MdJ p. ${s.page}`)),
        h('ul', { class: 'cr-traits' }, s.traits.map(([n, t]) => h('li', {}, h('b', {}, n), ' — ', t))),
        s.options && [h('div', { class: 'eyebrow' }, s.options_label),
          h('div', { class: 'cr-options' }, s.options.map(([n, t]) => h('button', { class: `cr-option ${st.lineage === n ? 'sel' : ''}`, type: 'button', onclick: () => { st.lineage = n; refresh(); } },
            h('b', {}, n), h('span', { class: 'tiny' }, t))))],
        s.skill_choice && [h('div', { class: 'eyebrow' }, s.id === 'elfo' ? 'Sentidos agudos' : 'Diestro: una habilidad'),
          h('div', { class: 'cr-skills' }, (s.skill_choice === 'any' ? R.skills.map((k) => k.key) : s.skill_choice).map((k) => {
            const taken = (b?.skills || []).includes(k) || st.classSkills.includes(k);
            return h('button', { class: `chip pick ${st.speciesSkill === k ? 'on' : ''}`, type: 'button', disabled: taken,
              onclick: () => { st.speciesSkill = k; refresh(); } }, skillName(k));
          }))],
        s.origin_feat_choice && [h('div', { class: 'eyebrow' }, 'Versátil: una dote de origen'),
          h('div', { class: 'cr-options' }, originFeats.map((f) => h('button', { class: `cr-option ${st.humanFeat === f.name ? 'sel' : ''}`, type: 'button', onclick: () => { st.humanFeat = f.name; refresh(); } },
            h('b', {}, f.name), h('span', { class: 'tiny' }, f.summary))))]),
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

  // Paso 4: detalles
  function stepDetails() {
    const c = cls();
    const nameIn = h('input', { value: st.name, placeholder: 'Nombre del personaje', oninput: (e) => { st.name = e.target.value; hint.textContent = problem(3); } });
    const playerIn = h('input', { value: st.player, placeholder: 'Quién lo juega', oninput: (e) => { st.player = e.target.value; } });
    return h('div', { class: 'stack' },
      h('p', { class: 'cr-intro' }, 'Ponle nombre, elige su alineamiento y con qué nivel empieza la aventura.'),
      h('div', { class: 'grid cols-2' },
        h('label', { class: 'field' }, 'Nombre', nameIn), h('label', { class: 'field' }, 'Jugador/a', playerIn)),
      h('div', { class: 'eyebrow' }, 'Alineamiento'),
      h('div', { class: 'cr-align' }, R.alignments.map((a) => h('button', { class: `cr-option ${st.alignment === a ? 'sel' : ''}`, type: 'button', onclick: () => { st.alignment = a; refresh(); } }, a))),
      h('div', { class: 'grid cols-2' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Nivel inicial'),
          h('div', { class: 'row nowrap' }, h('input', { type: 'range', min: 1, max: 20, value: st.level, oninput: (e) => { st.level = Number(e.target.value); refresh(); } }),
            h('b', { class: 'cr-level' }, st.level)),
          h('p', { class: 'tiny muted' }, `Empiezas con ${R.level_xp[st.level - 1].toLocaleString('es-ES')} PX. Los PG de cada nivel usan el valor fijo del manual.`)),
        h('div', {}, h('div', { class: 'eyebrow' }, 'Color de la ficha y los dados'),
          h('div', { class: 'row' }, COLORS.map((col) => h('button', { class: `cr-color ${st.color === col ? 'sel' : ''}`, type: 'button', style: { background: col }, 'aria-label': `Color ${col}`, onclick: () => { st.color = col; refresh(); } }))))),
      c && st.level >= 3 && [h('div', { class: 'eyebrow' }, `Subclase (nivel 3) · MdJ p. ${c.page}`),
        h('div', { class: 'cr-options' }, c.subclasses.map((s) => h('button', { class: `cr-option ${st.subclass === s ? 'sel' : ''}`, type: 'button', onclick: () => { st.subclass = s; refresh(); } }, h('b', {}, s))))],
      c && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.gold, onchange: (e) => { st.gold = e.target.checked; } }),
        `Equipo inicial: tomar el oro (${c.gold} po de la clase + 50 po del trasfondo) y comprar luego`));
  }

  // Construye la ficha final.
  function build() {
    const c = cls();
    const b = bg();
    const s = sp();
    const fin = finalScores();
    const skills = {};
    [...st.classSkills, ...(b?.skills || []), st.speciesSkill].filter(Boolean).forEach((k) => { skills[k] = 1; });
    const lineageText = st.lineage ? ` (${st.lineage.split(' (')[0]})` : '';
    const ch = newCharacter('jugador', {
      name: st.name.trim(), player: st.player.trim(), color: st.color, alignment: st.alignment,
      classId: c.id, cls: c.name, subclass: st.level >= 3 ? st.subclass : '', level: st.level, xp: R.level_xp[st.level - 1],
      speciesId: s.id, race: s.name, lineage: st.lineage, size: s.size.includes(' o ') ? s.size.split(' o ')[0] : s.size,
      backgroundId: b.id, background: b.name,
      abilities: fin, saves: [...c.saves], skills,
      feats: [b.feat, st.humanFeat].filter(Boolean), masteries: [],
      weaponTraining: [...c.weapon_training], armorTraining: [...c.armor_training],
      tools: [b.tool, c.tools].filter(Boolean).join('; '),
      languages: st.languages.join(', '),
      speed: st.lineage === 'Elfo de los bosques' ? 10.5 : s.speed,
      hitDie: `d${c.hit_die}`, hitDiceLeft: st.level,
      spellAbility: c.spell_ability || '', autoSlots: !!c.caster, acMode: 'auto',
      coins: { pc: 0, pp: 0, pe: 0, po: st.gold ? c.gold + 50 : 0, ppt: 0 },
      notes: `Especie: ${s.name}${lineageText}. Trasfondo: ${b.name}. Alineamiento: ${st.alignment}.`,
    });
    ch.maxHp = ch.hp = maxHpFor(ch, st.level);
    ch.ac = computeAC(ch);
    ch.slots = slotsFor(c, st.level).map((max) => ({ max, used: 0 }));
    const pb = profBonus(ch);
    ch.resources = [...classResources(ch, c, st.level),
      ...(SPECIES_RESOURCES[s.id] || []).map(([name, uses, reset]) => ({ name, max: uses === 'pb' ? pb : uses, used: 0, reset, auto: true }))];
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
    return h('div', { class: 'cr-summary' },
      h('div', { class: 'cr-sum-head' },
        h('span', { class: 'cr-avatar', style: { background: ch.color } }, CLASS_ICON[c.id]),
        h('div', {}, h('h2', {}, ch.name),
          h('div', { class: 'muted' }, `${ch.cls}${ch.subclass ? ` (${ch.subclass})` : ''} de nivel ${ch.level} · ${s.name}${st.lineage ? ` (${st.lineage.split(' (')[0]})` : ''} · ${ch.background} · ${ch.alignment}`))),
      h('div', { class: 'cr-sum-stats' },
        [['PG', ch.maxHp], ['CA', ch.ac], ['Velocidad', fmtM(ch.speed)], ['Iniciativa', fmtMod(mod(ch.abilities.des) + (ch.feats.includes('Alerta') ? pb : 0))],
          ['Competencia', fmtMod(pb)], ['Dados de golpe', `${ch.level}${ch.hitDie}`]].map(([l, v]) => h('div', { class: 'cr-stat' }, h('b', {}, v), h('span', {}, l)))),
      h('div', { class: 'cr-sum-abil' }, ABILITY_KEYS.map((k) => h('div', { class: 'cr-stat' }, h('span', {}, ABILITY_SHORT[k]), h('b', {}, fmtMod(mod(ch.abilities[k]))), h('small', {}, ch.abilities[k], ch.saves.includes(k) ? ' · salv.' : '')))),
      h('div', { class: 'grid cols-2' },
        h('div', { class: 'panel' }, h('h3', {}, 'Competencias'),
          h('p', { class: 'small' }, h('b', {}, 'Habilidades: '), Object.keys(ch.skills).map(skillName).join(', ')),
          h('p', { class: 'small' }, h('b', {}, 'Armas: '), c.weapons, h('br'), h('b', {}, 'Armaduras: '), c.armor),
          h('p', { class: 'small' }, h('b', {}, 'Herramientas: '), ch.tools || '—', h('br'), h('b', {}, 'Idiomas: '), ch.languages),
          h('p', { class: 'small' }, h('b', {}, 'Dotes: '), ch.feats.join(', '))),
        h('div', { class: 'panel' }, h('h3', {}, 'Rasgos'),
          h('ul', { class: 'cr-traits small' }, featuresUpTo(c, ch.level).map(([l, f]) => h('li', {}, h('span', { class: 'chip' }, `Nv ${l}`), ' ', f)),
            s.traits.map(([n]) => h('li', {}, h('span', { class: 'chip' }, s.name), ' ', n))),
          c.caster && h('p', { class: 'small' }, h('b', {}, 'Magia: '), [cantrips != null && `${cantrips} trucos`, prepared != null && `${prepared} conjuros preparados`,
            `espacios ${ch.slots.map((x, i) => (x.max ? `${x.max}×nv${i + 1}` : null)).filter(Boolean).join(', ')}`].filter(Boolean).join(' · ')))),
      h('p', { class: 'tiny muted center' }, 'Elige tus conjuros, equipo y maestrías con armas en la ficha. Todo queda editable.'));
  }

  function create() {
    for (let i = 0; i < 4; i++) if (!valid(i)) { st.step = i; render(); return toast(problem(i)); }
    const ch = build();
    close();
    onCreate(ch);
  }
}
