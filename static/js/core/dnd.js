// Reglas de D&D en el cliente y datos de referencia compartidos (se cargan del servidor una vez).
import { api } from './api.js';

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
  Agarrado: '🤝', Apresado: '⛓️', Asustado: '😱', Aturdido: '💫', Cegado: '🙈', Derribado: '🛌',
  Ensordecido: '🔇', Envenenado: '🤢', Hechizado: '💘', Incapacitado: '🚫', Inconsciente: '💤',
  Invisible: '👻', Paralizado: '🧊', Petrificado: '🗿', Concentrado: '🔮', Bendecido: '✨', Marcado: '🎯',
};
export const condLabel = (name) => `${CONDITION_ICON[name] || '•'} ${name}`;

export const ABILITY_KEYS = ['fue', 'des', 'con', 'int', 'sab', 'car'];
export const ABILITY_SHORT = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };
export const CRS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

let refPromise;
export const reference = () => (refPromise ??= api.get('/api/reference'));
let monstersPromise;
export const monsters = () => (monstersPromise ??= api.get('/api/monsters'));

export const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);

export function crValue(cr) {
  if (!cr) return 0;
  const [a, b] = String(cr).split('/');
  return b ? Number(a) / Number(b) : Number(a);
}

export function profBonus(ch) {
  if (ch.type === 'enemigo' && ch.cr != null && ch.cr !== '') {
    const v = crValue(ch.cr);
    return v < 1 ? 2 : 2 + Math.floor((Math.ceil(v) - 1) / 4);
  }
  return 2 + Math.floor((Math.max(1, Math.min(20, ch.level || 1)) - 1) / 4);
}

export const initBonus = (ch) => (ch.initBonus ?? '') === '' ? mod(ch.abilities?.des) : Number(ch.initBonus);
export const saveBonus = (ch, k) => mod(ch.abilities?.[k]) + (ch.saves?.includes(k) ? profBonus(ch) : 0);
export const skillBonus = (ch, skill) => mod(ch.abilities?.[skill.ability]) + (ch.skills?.[skill.key] || 0) * profBonus(ch);

export function passivePerception(ch) {
  return 10 + mod(ch.abilities?.sab) + (ch.skills?.percepcion || 0) * profBonus(ch);
}

export function newCharacter(type = 'jugador', extra = {}) {
  return {
    type, name: type === 'enemigo' ? 'Nuevo enemigo' : type === 'pnj' ? 'Nuevo personaje' : 'Nuevo aventurero',
    player: '', race: '', cls: '', level: 1, xp: 0, cr: type === 'enemigo' ? '1/4' : '', creature: '',
    alignment: '', background: '', attitude: type === 'enemigo' ? 'hostil' : 'neutral', location: '', faction: '',
    portrait: '', color: TYPE_COLOR[type],
    hp: 10, maxHp: 10, tempHp: 0, hitDie: 'd8', hitDiceLeft: 1, hpDice: '', ac: 10, speed: 30, initBonus: '',
    abilities: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    saves: [], skills: {},
    attacks: [], spellAbility: '', slots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })), spells: '',
    resources: [], inventory: [], coins: { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 },
    features: '', notes: '', languages: '',
    conditions: [], exhaustion: 0, inspiration: false, deathSaves: { ok: 0, ko: 0 },
    ...extra,
  };
}

export function fromMonster(m) {
  return newCharacter('enemigo', {
    name: m.name, cr: m.cr, creature: m.creature, ac: m.ac, hp: m.hp, maxHp: m.hp, hpDice: m.hpDice,
    speed: m.speed, abilities: { ...m.abilities }, attacks: m.attacks.map((a) => ({ ...a, notes: '' })),
    features: m.traits,
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

export function longRest(ch) {
  ch.hp = ch.maxHp;
  ch.tempHp = 0;
  ch.deathSaves = { ok: 0, ko: 0 };
  ch.hitDiceLeft = Math.min(ch.level || 1, (ch.hitDiceLeft || 0) + Math.max(1, Math.floor((ch.level || 1) / 2)));
  ch.exhaustion = Math.max(0, (ch.exhaustion || 0) - 1);
  (ch.slots || []).forEach((s) => { s.used = 0; });
  (ch.resources || []).forEach((r) => { r.used = 0; });
}

export function shortRest(ch) {
  (ch.resources || []).forEach((r) => { if (r.reset === 'corto') r.used = 0; });
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
