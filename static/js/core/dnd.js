// Reglas de D&D (Manual del Jugador 2024) en el cliente. Los datos del manual llegan del servidor
// una sola vez (reference()) y estas funciones calculan la ficha: CA, PG, espacios, ataques…
import { api } from './api.js';
import { randomLook } from './dom.js';

export const TYPES = [
  ['jugador', 'Jugador'],
  ['pnj', 'Personaje de la historia'],
  ['enemigo', 'Enemigo'],
];
export const TYPE_LABEL = Object.fromEntries(TYPES);
export const TYPE_COLOR = { jugador: '#5b9cff', pnj: '#e2b456', enemigo: '#e0524a' };
export const TYPE_ICON = { jugador: 'crown', pnj: 'user', enemigo: 'skull' };

// Emoji para reconocer cada estado de un vistazo en fichas, tokens y combate.
export const CONDITION_ICON = {
  Agarrado: '🤝', Apresado: '⛓️', Asustado: '😱', Aturdido: '💫', Cansancio: '🥱', Cegado: '🙈', Derribado: '🛌',
  Ensordecido: '🔇', Envenenado: '🤢', Hechizado: '💘', Incapacitado: '🚫', Inconsciente: '💤',
  Invisible: '👻', Paralizado: '🧊', Petrificado: '🗿', Concentrado: '🔮', Bendecido: '✨', Marcado: '🎯', Maltrecho: '🩸', Oculto: '🫥',
};
export const condLabel = (name) => `${CONDITION_ICON[name] || '•'} ${name}`;

export const ABILITY_KEYS = ['fue', 'des', 'con', 'int', 'sab', 'car'];
export const ABILITY_SHORT = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };
export const ABILITY_NAME = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };
export const CRS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];
export const COINS = [['pc', 'Cobre', '#c27a45'], ['pp', 'Plata', '#c9d1d9'], ['pe', 'Electro', '#d8cf8c'], ['po', 'Oro', '#f0c24a'], ['ppt', 'Platino', '#e6eef5']];

let REF = null;
let refPromise;
export const reference = () => (refPromise ??= api.get('/api/reference').then((r) => { REF = r; return r; }));
// Tras crear o editar una especie o clase propia hay que volver a pedir la referencia.
export const reloadReference = () => { refPromise = null; return reference(); };
export const ref = () => REF;
let monstersPromise;
export const monsters = () => (monstersPromise ??= api.get('/api/monsters'));

export const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const fmtM = (m) => `${String(Math.round((Number(m) || 0) * 10) / 10).replace('.', ',')} m`;

export function crValue(cr) {
  if (!cr) return 0;
  const [a, b] = String(cr).split('/');
  return b ? Number(a) / Number(b) : Number(a);
}

// ------------------------------------------------------------- datos de la ficha
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
export const classOf = (ch) => REF?.classes.find((c) => c.id === ch.classId) || REF?.classes.find((c) => norm(c.name) === norm(ch.cls)) || null;
export const speciesOf = (ch) => REF?.species.find((s) => s.id === ch.speciesId) || REF?.species.find((s) => norm(s.name) === norm(ch.race)) || null;
export const backgroundOf = (ch) => REF?.backgrounds.find((b) => b.id === ch.backgroundId) || REF?.backgrounds.find((b) => norm(b.name) === norm(ch.background)) || null;
export const hasFeat = (ch, name) => (ch.feats || []).some((f) => norm(f).startsWith(norm(name)));
// Dónde mirar una regla: la página del manual o el origen del material propio (Euskal Herria).
export const source = (x) => (x?.page ? `MdJ p. ${x.page}` : x?.origin || '');

export function profBonus(ch) {
  if (ch.type === 'enemigo' && ch.cr != null && ch.cr !== '') {
    const v = crValue(ch.cr);
    return v < 1 ? 2 : 2 + Math.floor((Math.ceil(v) - 1) / 4);
  }
  return 2 + Math.floor((Math.max(1, Math.min(20, ch.level || 1)) - 1) / 4);
}

// Cansancio (2024): −2 por nivel a toda prueba con d20 y −1,5 m de velocidad por nivel.
export const exhaustionPenalty = (ch) => 2 * (ch.exhaustion || 0);
export const effectiveSpeed = (ch) => Math.max(0, (Number(ch.speed) || 0) - 1.5 * (ch.exhaustion || 0));
// Expresión de una prueba con d20 con su bonificador y el cansancio ya aplicado.
export const d20 = (ch, bonus) => `1d20${fmtMod((Number(bonus) || 0) - exhaustionPenalty(ch))}`;

export const initBonus = (ch) => ((ch.initBonus ?? '') === ''
  ? mod(ch.abilities?.des) + (hasFeat(ch, 'Alerta') ? profBonus(ch) : 0)
  : Number(ch.initBonus));
export const saveBonus = (ch, k) => mod(ch.abilities?.[k]) + (ch.saves?.includes(k) ? profBonus(ch) : 0);
export const skillBonus = (ch, skill) => mod(ch.abilities?.[skill.ability]) + (ch.skills?.[skill.key] || 0) * profBonus(ch);
export function passivePerception(ch) {
  return 10 + mod(ch.abilities?.sab) + (ch.skills?.percepcion || 0) * profBonus(ch);
}

// Clase de armadura: armadura del manual (con su límite de DES), escudo, Defensa sin armadura (de la clase
// o la subclase), la armadura natural de la especie y la dote Defensa. Sin armadura se usa la mejor opción.
const NO_SHIELD = ['monje', 'Colegio de la danza']; // su Defensa sin armadura no admite escudo
export function computeAC(ch) {
  const dex = mod(ch.abilities?.des);
  const armor = REF?.armor.find((a) => a.name === ch.armor);
  const cls = classOf(ch);
  let ac;
  if (armor) {
    let cap = armor.dex_max;
    if (cap === 2 && hasFeat(ch, 'Maestro en armaduras medias') && (ch.abilities?.des || 0) >= 16) cap = 3;
    ac = armor.base + (cap == null ? dex : Math.min(dex, cap));
  } else {
    const sets = [[cls?.id, cls?.unarmored], [ch.subclass, cls?.subclass_unarmored?.[ch.subclass]]]
      .filter(([who, set]) => set && !(ch.shield && NO_SHIELD.includes(who)));
    const sp = speciesOf(ch); // armadura natural: base + DES (o CON, o fija como el caparazón de la tortuga)
    const natural = sp?.natural_ac ? sp.natural_ac + (sp.natural_ac_flat ? 0 : mod(ch.abilities?.[sp.natural_ac_ability || 'des'])) : 0;
    ac = Math.max(10 + dex, natural, ...sets.map(([, set]) => 10 + set.reduce((s, k) => s + mod(ch.abilities?.[k]), 0)));
  }
  if (ch.shield) ac += 2;
  if (armor && hasFeat(ch, 'Defensa')) ac += 1;
  return ac;
}

// Capacidad de carga (MdJ p. 362): FUE × 7,5 kg para Pequeño o Mediano, la mitad para Diminuto y el doble por cada
// tamaño por encima; arrastrar, levantar o empujar, el doble de eso. Constitución poderosa y parecidos cuentan un tamaño más.
const CARRY_SIZES = ['Diminuto', 'Pequeño', 'Mediano', 'Grande', 'Enorme', 'Gargantuesco'];
const CARRY_KG = [3.75, 7.5, 7.5, 15, 30, 60];
export function carryCapacity(ch) {
  const size = CARRY_SIZES.indexOf(ch.size);
  const i = Math.min(CARRY_SIZES.length - 1, (size < 0 ? 2 : size) + (speciesOf(ch)?.carry_bigger ? 1 : 0));
  const carry = (Number(ch.abilities?.fue) || 0) * CARRY_KG[i];
  return { carry, push: carry * 2, bigger: !!speciesOf(ch)?.carry_bigger };
}
export const fmtKg = (kg) => `${String(Math.round((Number(kg) || 0) * 100) / 100).replace('.', ',')} kg`;

// PG máximos con los valores fijos por nivel del manual (o la media si se prefiere no tirar).
export function maxHpFor(ch, level = ch.level || 1) {
  const cls = classOf(ch);
  if (!cls) return ch.maxHp;
  const con = mod(ch.abilities?.con);
  const fixed = REF.hp_fixed[cls.hit_die];
  let hp = cls.hit_die + con + (level - 1) * Math.max(1, fixed + con);
  if (speciesOf(ch)?.hp_per_level) hp += level * speciesOf(ch).hp_per_level;
  if (hasFeat(ch, 'Duro')) hp += 2 * level;
  hp += featBonus(ch, 'hp');
  if (ch.subclass === 'Hechicería dracónica' && level >= 3) hp += level; // Resistencia dracónica
  return Math.max(1, hp);
}

// La magia de la ficha: la de la clase o, si la subclase lanza conjuros (Caballero arcano, Embaucador arcano), la suya.
export const castingOf = (ch, cls = classOf(ch)) => (cls?.subclass_casting?.[ch.subclass] ? { ...cls, ...cls.subclass_casting[ch.subclass] } : cls);

// Espacios de conjuro (máximos por nivel de conjuro) según la clase (mejor castingOf) y el nivel.
export function slotsFor(cls, level) {
  const out = Array(9).fill(0);
  if (!cls?.caster || !REF) return out;
  const i = Math.max(1, Math.min(20, level)) - 1;
  if (cls.caster === 'pact') {
    const [n, lvl] = REF.slots.pact[i];
    out[lvl - 1] = n;
  } else (REF.slots[cls.caster][i] || []).forEach((n, j) => { out[j] = n; });
  return out;
}

export const columnAt = (cls, name, level) => cls?.columns?.[name]?.[Math.max(1, Math.min(20, level)) - 1] ?? null;
export const masteryCount = (cls, level) => (cls?.masteries ? cls.masteries[Math.max(1, Math.min(20, level)) - 1] || 0 : 0);

// Recursos de clase (furia, canalizar divinidad, puntos de concentración…) para un nivel.
// Con subclase se suman los suyos (dados de supremacía, Pasos feéricos…). Los usos pueden ir por tramos {nivel: usos}.
export const subclassResourceNames = (cls) => Object.values(cls?.subclass_resources || {}).flat().map((r) => r.name);
export function classResources(ch, cls = classOf(ch), level = ch.level || 1) {
  if (!cls) return [];
  return [...(cls.resources || []), ...(cls.subclass_resources?.[ch.subclass] || [])].map((r) => {
    if (r.from && level < r.from) return null;
    let max = r.column ? columnAt(cls, r.column, level) : r.uses;
    if (max && typeof max === 'object') max = Object.entries(max).filter(([l]) => level >= Number(l)).pop()?.[1];
    if (typeof max === 'string' && max.startsWith('mod:')) max = Math.max(1, mod(ch.abilities?.[max.slice(4)]));
    if (max === 'level*5') max = level * 5;
    if (max === 'level+1') max = level + 1;
    if (max === 'pb') max = profBonus({ ...ch, level });
    let reset = r.reset;
    if (r.reset_from) for (const [lv, rs] of Object.entries(r.reset_from)) if (level >= Number(lv)) reset = rs;
    return max ? { name: r.name, max: Number(max), used: 0, reset, auto: true } : null;
  }).filter(Boolean);
}

// Rasgos de clase hasta un nivel: [nivel, nombre, qué hace]. Con subclase, cada «Rasgo de subclase»
// se cambia por los rasgos de la subclase de ese nivel.
export function featuresUpTo(cls, level, subclass = '') {
  if (!cls) return [];
  const sub = cls.subclass_features?.[subclass] || [];
  const out = [];
  for (let l = 1; l <= level; l++) {
    for (const f of cls.features[l] || []) {
      if (f === 'Rasgo de subclase' && sub.length) continue;
      out.push([l, f, cls.feature_text?.[f] || (f === 'Rasgo de subclase' ? 'Elige subclase para ver qué te da.' : '')]);
    }
    for (const [sl, name, text] of sub) if (sl === l) out.push([l, name, text, true]);
  }
  return out;
}

// Las dotes generales y los dones épicos de 2024 suben +1 una característica: ¿cuáles se pueden elegir?
export function featAbilities(feat) {
  const m = /^\+1 ([A-Z/]+)/.exec(feat?.summary || '');
  if (m) return m[1].split('/').map((s) => ABILITY_KEYS.find((k) => ABILITY_SHORT[k] === s)).filter(Boolean);
  return /^\+1/.test(feat?.summary || '') ? [...ABILITY_KEYS] : [];
}

// --------------------------------------------------------------- especie y dotes
// Recursos de la especie y de las dotes, y los usos gratis de los conjuros que dan («X (gratis)»), según el nivel.
export function grantResources(ch, level = ch.level || 1) {
  const sp = speciesOf(ch);
  const pb = profBonus({ ...ch, level });
  const free = speciesSpellEntries(ch).filter(([lvl, , uses]) => uses && level >= lvl).map(([lvl, name, uses, reset]) => [`${name} (gratis)`, uses, reset || 'largo', lvl]);
  const feats = (ch.feats || []).flatMap((f) => {
    const g = featGrants(f);
    const picks = (g?.picks || []).flatMap((p, i) => (p.free ? (ch.spellPicks?.[`${f}#${i}`] || []).map((n) => [`${n} (gratis)`, p.free, 'largo']) : []));
    return [...(g?.resources || []), ...(g?.spells || []).filter(([, uses]) => uses).map(([n, uses]) => [`${n} (gratis)`, uses, 'largo']), ...picks];
  });
  return [...(sp?.resources || []), ...(sp?.lineage_resources?.[ch.lineage] || []), ...free, ...feats].filter(([, , , min]) => level >= (min || 1))
    .map(([name, uses, reset]) => ({ name, max: uses === 'pb' ? pb : uses, used: 0, reset, auto: true, grant: true }));
}
const speciesSpellEntries = (ch) => { const sp = speciesOf(ch); return [...(sp?.spells || []), ...(sp?.lineage_spells?.[ch.lineage] || [])]; };
export const speciesSpells = (ch, level = ch.level || 1) => speciesSpellEntries(ch).filter(([lvl]) => level >= lvl).map(([, name]) => name);

// Lo que da una dote (por el principio de su nombre: «Iniciado en la magia (clérigo)»).
export const featGrants = (name) => REF?.feats.find((f) => f.grants && norm(name).startsWith(norm(f.name)))?.grants || null;
export const featBonus = (ch, key) => (ch.feats || []).reduce((s, f) => s + (featGrants(f)?.[key] || 0), 0);

// Conjuros que la ficha da sola, siempre preparados y sin contar para el máximo: de la especie, de la clase
// (marca del cazador, castigo divino…), de la subclase (dominios, juramentos, patrones; el Círculo de la tierra
// según el terreno), de las dotes y los que se eligen por una dote o subclase. Además, los extra que añade el jugador.
export function grantedSpells(ch) {
  const cls = classOf(ch);
  const level = ch.level || 1;
  const out = new Map();
  const add = (name, from, extra = {}) => { if (!out.has(name)) out.set(name, { name, from, ...extra }); };
  const rows = (list, from) => (list || []).forEach(([lv, names]) => { if (level >= lv) names.forEach((n) => add(n, from)); });
  speciesSpells(ch).forEach((n) => add(n, speciesOf(ch)?.name || 'Especie'));
  rows(cls?.class_spells, cls?.name);
  rows(cls?.subclass_spells?.[ch.subclass], ch.subclass);
  const opt = cls?.subclass_spell_options?.[ch.subclass];
  if (opt && ch.subclassOption) rows(opt.options[ch.subclassOption], `${ch.subclass} (${ch.subclassOption})`);
  for (const f of ch.feats || []) (featGrants(f)?.spells || []).forEach(([n]) => add(n, f));
  for (const choice of spellChoices(ch)) (ch.spellPicks?.[choice.key] || []).forEach((n) => add(n, choice.from, { pick: choice.key }));
  for (const x of ch.extraSpells || []) add(x.name, x.from || 'Extra', { extra: true });
  return [...out.values()];
}

// Conjuros por elegir que dan las dotes (Iniciado en la magia, Influencia feérica…) y algunas subclases.
// Cada uno: { key, from, label, level (0 = truco; null = cualquiera), count, lists, schools, ritual }.
export function spellChoices(ch) {
  const cls = classOf(ch);
  const level = ch.level || 1;
  const out = [];
  for (const f of ch.feats || []) {
    (featGrants(f)?.picks || []).forEach((p, i) => {
      const paren = /\(([^)]+)\)/.exec(f)?.[1];
      const lists = p.lists === 'paren' ? (paren ? [paren[0].toUpperCase() + paren.slice(1)] : ['Clérigo', 'Druida', 'Mago']) : p.lists || null;
      out.push({ ...p, key: `${f}#${i}`, from: f, lists, count: p.count === 'pb' ? profBonus(ch) : p.count });
    });
  }
  (cls?.subclass_picks?.[ch.subclass] || []).forEach(([lv, count, lists, label], i) => {
    if (level >= lv) out.push({ key: `${ch.subclass}#${i}`, from: ch.subclass, label, level: null, count, lists });
  });
  return out;
}

// Listas de las que la clase puede preparar conjuros (el bardo suma otras con Secretos mágicos).
export function spellLists(ch, cast = castingOf(ch)) {
  if (!cast?.caster) return [];
  const extra = cast.extra_lists && (ch.level || 1) >= cast.extra_lists[0] ? cast.extra_lists[1] : [];
  return [cast.spell_list || cast.name, ...extra];
}

// Recurso que deja lanzar un conjuro sin espacio («Castigo divino (gratis)», «Mapa estelar (saeta guía gratis)»…).
export const freeUseFor = (ch, spell) => (ch.resources || []).find((r) => /gratis/i.test(r.name) && norm(r.name).includes(norm(spell.name)) && (r.used || 0) < r.max) || null;

// Ataques que la ficha calcula sola: los de la especie (aliento dracónico, peñas del jentil) y el golpe sin armas del monje.
export function derivedAttacks(ch) {
  const sp = speciesOf(ch);
  const level = ch.level || 1;
  const pb = profBonus(ch);
  const out = [];
  for (const a of sp?.attacks || []) {
    if (level < (a.level || 1)) continue;
    const ab = mod(ch.abilities?.[a.ability || a.dc]);
    const dice = a.scale ? a.damage.replace(/^1d/, `${1 + a.scale.filter((l) => level >= l).length}d`) : a.damage;
    const type = a.lineage_type ? sp.options?.find(([n]) => n === ch.lineage)?.[1] : '';
    out.push(a.save
      ? { name: a.name, bonus: '', save: `${a.save} CD ${8 + ab + pb}`, damage: dice, notes: [type, a.notes].filter(Boolean).join(' · '), auto: true }
      : { name: a.name, bonus: ab + pb, damage: `${dice}${ab ? fmtMod(ab) : ''}`, notes: a.notes, auto: true });
  }
  if (classOf(ch)?.id === 'monje') {
    const ab = Math.max(mod(ch.abilities?.fue), mod(ch.abilities?.des));
    out.push({ name: 'Golpe sin armas', bonus: ab + pb, damage: `${columnAt(classOf(ch), 'Artes marciales', level)}${fmtMod(ab)}`, notes: 'contundente · artes marciales · otro como acción adicional', auto: true });
  }
  return out;
}

// Lo que falta por decidir en la ficha para jugar según el manual, y avisos de reglas.
export function pendingChoices(ch) {
  const cls = classOf(ch);
  const level = ch.level || 1;
  const out = [];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (cls && level >= (cls.subclass_level || 3) && !ch.subclass && cls.subclasses?.length) out.push('Subclase');
  if (cls?.choice && !ch.classChoice) out.push(cls.choice.name);
  if (cls?.style_level && level >= cls.style_level && !(ch.feats || []).some((f) => REF.feats.find((x) => x.name === f)?.category === 'estilo de combate' || /^Guerrero (bendito|druídico)/.test(f))) out.push('Estilo de combate (dote)');
  const masteries = masteryCount(cls, level) - (ch.masteries || []).length;
  if (masteries > 0) out.push(plural(masteries, 'maestría con armas', 'maestrías con armas'));
  const expertise = (cls?.expertise || []).filter(([l]) => level >= l).reduce((s, [, n]) => s + n, 0) - Object.values(ch.skills || {}).filter((v) => v === 2).length;
  if (expertise > 0) out.push(`Pericia en ${plural(expertise, 'habilidad', 'habilidades')} (◆)`);
  const counts = spellCounts(ch);
  if (counts) {
    if (counts.cantrips.max > counts.cantrips.have) out.push(plural(counts.cantrips.max - counts.cantrips.have, 'truco', 'trucos'));
    if (counts.prepared.max > counts.prepared.have) out.push(plural(counts.prepared.max - counts.prepared.have, 'conjuro preparado', 'conjuros preparados'));
    counts.arcanum.forEach((n) => out.push(`Arcanum místico de nivel ${n}`));
  }
  for (const choice of spellChoices(ch)) {
    const left = choice.count - (ch.spellPicks?.[choice.key] || []).length;
    if (left > 0) out.push(`${choice.label} (${choice.from}): ${left}`);
  }
  const opt = cls?.subclass_spell_options?.[ch.subclass];
  if (opt && !ch.subclassOption) out.push(`${opt.label} de ${ch.subclass}`);
  const armor = REF?.armor.find((a) => a.name === ch.armor);
  if (armor && ch.type === 'jugador') {
    if (armor.str && (ch.abilities?.fue || 0) < armor.str) out.push(`⚠ ${armor.name}: con FUE menor de ${armor.str} tu velocidad baja 3 m`);
    if (ch.armorTraining?.length && !ch.armorTraining.includes(armor.category)) out.push(`⚠ Sin entrenamiento con armadura ${armor.category}: desventaja en FUE y DES y no puedes lanzar conjuros`);
  }
  return out;
}

// Trucos y conjuros preparados de la clase: cuántos puede tener y cuántos tiene (los que da la ficha sola no cuentan).
// El brujo prepara de nivel 1 a 5; sus arcanos místicos (6-9) van aparte.
export function spellCounts(ch) {
  const cast = castingOf(ch);
  if (!cast?.caster) return null;
  const level = ch.level || 1;
  const granted = new Set(grantedSpells(ch).map((g) => g.name));
  const spells = (ch.spellList || []).filter((n) => !granted.has(n)).map((n) => REF.spells.find((s) => s.name === n)).filter(Boolean);
  const extra = ['Taumaturgo', 'Naturalista'].includes(ch.classChoice) ? 1 : 0;
  const pact = cast.caster === 'pact';
  const arcanum = pact ? [[11, 6], [13, 7], [15, 8], [17, 9]].filter(([l, n]) => level >= l && !spells.some((s) => s.level === n)).map(([, n]) => n) : [];
  return {
    cantrips: { max: (cast.cantrips?.[level - 1] || 0) + extra, have: spells.filter((s) => !s.level).length },
    prepared: { max: cast.prepared?.[level - 1] || 0, have: spells.filter((s) => s.level && !(pact && s.level > 5)).length },
    arcanum,
  };
}

// ------------------------------------------------------------------ armas
export function weaponProficient(ch, w) {
  const cls = classOf(ch);
  const training = ch.weaponTraining?.length ? ch.weaponTraining : cls?.weapon_training || [];
  if (training.includes(w.category)) return true;
  if (hasFeat(ch, 'Entrenamiento con armas marciales')) return true;
  if (w.category === 'marcial' && cls?.id === 'monje') return w.properties.includes('Ligera');
  if (w.category === 'marcial' && cls?.id === 'picaro') return w.properties.includes('Ligera') || w.properties.includes('Sutil');
  return ch.type !== 'jugador';
}

export function weaponAttack(ch, w) {
  const fue = mod(ch.abilities?.fue);
  const des = mod(ch.abilities?.des);
  // Artes marciales: con armas de monje (sencillas cuerpo a cuerpo y marciales ligeras) el monje puede usar DES
  const monkWeapon = classOf(ch)?.id === 'monje' && w.kind === 'cac' && (w.category === 'sencilla' || w.properties.includes('Ligera'));
  const ability = w.properties.includes('Sutil') || monkWeapon ? Math.max(fue, des) : w.kind === 'dist' ? des : fue;
  const prof = (weaponProficient(ch, w) ? profBonus(ch) : 0) + (w.kind === 'dist' && hasFeat(ch, 'Tiro con arco') ? 2 : 0);
  const mastery = (ch.masteries || []).includes(w.name);
  const notes = [w.type, ...w.properties.map((p) => (p === 'Arrojadiza' || p === 'Munición') && w.range ? `${p} (${w.range} m)` : p),
    mastery ? `Maestría: ${w.mastery}` : null].filter(Boolean).join(' · ');
  return {
    name: w.name, bonus: ability + prof,
    damage: w.damage === '1' ? '1' : `${w.damage}${ability ? fmtMod(ability) : ''}`,
    notes, weapon: w.name,
  };
}

// --------------------------------------------------------------- personaje
export function newCharacter(type = 'jugador', extra = {}) {
  return {
    type, name: type === 'enemigo' ? 'Nuevo enemigo' : type === 'pnj' ? 'Nuevo personaje' : 'Nuevo aventurero',
    player: '', race: '', speciesId: '', lineage: '', cls: '', classId: '', subclass: '', level: 1, xp: 0,
    cr: type === 'enemigo' ? '1/4' : '', creature: '',
    alignment: '', background: '', backgroundId: '', attitude: type === 'enemigo' ? 'hostil' : 'neutral', location: '', faction: '',
    portrait: '', color: TYPE_COLOR[type], size: 'Mediano',
    hp: 10, maxHp: 10, tempHp: 0, hitDie: 'd8', hitDiceLeft: 1, hpDice: '', ac: 10, acMode: type === 'enemigo' ? 'manual' : 'auto', armor: '', shield: false,
    speed: 9, initBonus: '',
    abilities: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    saves: [], skills: {}, feats: [], masteries: [], weaponTraining: [], armorTraining: [], tools: '',
    attacks: [], spellList: [], spellAbility: '', autoSlots: false, slots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })), spells: '',
    resources: [], inventory: [], coins: { pc: 0, pp: 0, pe: 0, po: 0, ppt: 0 },
    features: '', notes: '', languages: '', height: '', weight: '', appearance: '', personality: '',
    conditions: [], exhaustion: 0, inspiration: false, deathSaves: { ok: 0, ko: 0 },
    look: type === 'enemigo' ? null : randomLook(false), // cara sencilla; los complementos se eligen en la ficha
    ...extra,
  };
}

// Ficha guardada con una versión anterior de la app: se completa y se pasa a las unidades de 2024.
export function migrateCharacter(c) {
  const out = { ...newCharacter(c.type), look: null, ...c }; // sin cara al azar: las fichas antiguas siguen con sus iniciales
  if (c.coins && 'pa' in c.coins) { // antes: pa = plata, pp = platino
    out.coins = { pc: c.coins.pc || 0, pp: c.coins.pa || 0, pe: c.coins.pe || 0, po: c.coins.po || 0, ppt: c.coins.pp || 0 };
  }
  if (Number(out.speed) > 15) out.speed = Math.round((Number(out.speed) * 0.3) / 1.5) * 1.5; // pies -> metros
  out.slots = (out.slots || []).map((s) => ({ max: s.max || 0, used: s.used || 0 }));
  while (out.slots.length < 9) out.slots.push({ max: 0, used: 0 });
  return out;
}

export function fromMonster(m) {
  return newCharacter('enemigo', {
    name: m.name, cr: m.cr, creature: m.creature, ac: m.ac, hp: m.hp, maxHp: m.hp, hpDice: m.hpDice,
    speed: m.speed, size: m.size || 'Mediano', abilities: { ...m.abilities }, attacks: m.attacks.map((a) => ({ notes: '', ...a })),
    saves: [...(m.saves || [])], initBonus: m.init ?? '', alignment: m.alignment || '',
    features: m.traits, notes: m.source ? `${m.eu} · mitología de Euskal Herria (criatura propia de esta app)` : m.en ? `${m.en} · SRD 5.2.1 (CC-BY-4.0)` : '',
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// Participante de combate a partir de una ficha. Guarda una copia de sus datos de combate.
export function combatantFrom(ch, suffix = '') {
  return {
    cid: uid(), charId: ch.id || null, name: suffix ? `${ch.name} ${suffix}` : ch.name,
    type: ch.type || 'enemigo', color: ch.color || TYPE_COLOR[ch.type] || '#888', portrait: ch.portrait || '',
    init: null, initBonus: initBonus(ch), hp: ch.hp ?? ch.maxHp ?? 1, maxHp: ch.maxHp ?? ch.hp ?? 1,
    tempHp: ch.tempHp || 0, ac: ch.ac ?? 10, cr: ch.cr ?? '', attacks: (ch.attacks || []).map((a) => ({ ...a })),
    saves: Object.fromEntries(ABILITY_KEYS.map((k) => [k, ch.abilities ? saveBonus(ch, k) : 0])),
    exhaustion: ch.exhaustion || 0, size: ch.size || 'Mediano', speed: Number(ch.speed) || 9, look: ch.look || null,
    conditions: (ch.conditions || []).map((name) => ({ name, rounds: null })),
    concentration: false, deathSaves: { ok: 0, ko: 0 }, hidden: false, notes: '',
  };
}

// Aplica daño respetando PG temporales. Devuelve el daño real a los PG.
export function applyDamage(target, amount) {
  amount = Math.max(0, Math.floor(amount));
  const fromTemp = Math.min(target.tempHp || 0, amount);
  target.tempHp = (target.tempHp || 0) - fromTemp;
  const rest = amount - fromTemp;
  target.hp = Math.max(0, (target.hp || 0) - rest);
  return rest;
}

export function applyHealing(target, amount) {
  if ((target.hp || 0) <= 0) target.deathSaves = { ok: 0, ko: 0 };
  target.hp = Math.min(target.maxHp || 0, (target.hp || 0) + Math.max(0, Math.floor(amount)));
}

// Descanso largo (2024): todos los PG y dados de golpe, −1 cansancio, espacios y recursos.
export function longRest(ch) {
  ch.hp = ch.maxHp;
  ch.tempHp = 0;
  ch.deathSaves = { ok: 0, ko: 0 };
  ch.hitDiceLeft = ch.level || 1;
  ch.exhaustion = Math.max(0, (ch.exhaustion || 0) - 1);
  (ch.slots || []).forEach((s) => { s.used = 0; });
  (ch.resources || []).forEach((r) => { r.used = 0; });
  if (speciesOf(ch)?.id === 'humano') ch.inspiration = true; // Ingenioso
  return rechargeItems(ch);
}

// Al amanecer los objetos mágicos recuperan cargas (1d6+1 una varita, por ejemplo). Devuelve qué recuperó cada uno.
const rollExpr = (expr) => String(expr).split('+').reduce((s, t) => {
  if (!t.includes('d')) return s + (Number(t) || 0);
  const [n, d] = t.split('d').map(Number);
  return s + Array.from({ length: n || 1 }, () => 1 + Math.floor(Math.random() * d)).reduce((a, b) => a + b, 0);
}, 0);
export function rechargeItems(ch) {
  const out = [];
  for (const it of ch.inventory || []) {
    if (!it.charges || !it.used || !it.regain) continue;
    const back = it.regain === 'todas' ? it.used : Math.min(it.used, rollExpr(it.regain));
    it.used -= back;
    out.push(`${it.name}: +${back} ${back === 1 ? 'carga' : 'cargas'}`);
  }
  return out;
}

// Descanso corto: recursos de descanso corto (algunos solo recuperan un uso) y la magia del pacto.
export function shortRest(ch) {
  (ch.resources || []).forEach((r) => {
    if (r.reset === 'corto') r.used = 0;
    if (r.reset === 'corto1') r.used = Math.max(0, (r.used || 0) - 1);
  });
  if (classOf(ch)?.caster === 'pact') (ch.slots || []).forEach((s) => { s.used = 0; });
}

// "2d6+3" -> "4d6+3": en un crítico se duplican los dados, no el modificador.
export function critExpr(expr) {
  return String(expr).replace(/(\d*)d(\d+)/gi, (_, n, s) => `${(Number(n) || 1) * 2}d${s}`);
}

// Progreso de experiencia hacia el siguiente nivel.
export function xpProgress(xp, table) {
  const level = table.filter((need) => (xp || 0) >= need).length;
  const cur = table[level - 1] ?? 0;
  const next = table[level] ?? null;
  return { level, cur, next, ratio: next ? ((xp || 0) - cur) / (next - cur) : 1 };
}
