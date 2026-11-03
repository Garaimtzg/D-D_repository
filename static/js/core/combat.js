// Reglas del combate compartidas por la Mesa y la sección Combate: turnos, daño, curación,
// salvaciones de muerte y sincronización de los PG de los jugadores con su ficha.
import { api } from './api.js';
import { h, toast, toastError, modal, field, selectEl, bind, token } from './dom.js';
import { applyDamage, applyHealing, fmtMod, ABILITY_KEYS, ABILITY_SHORT, ABILITY_NAME } from './dnd.js';
import { roll } from './dice.js';
import { sfx } from './sfx.js';

export const STATUS = { planned: 'Preparado', active: 'En curso', finished: 'Terminado' };

export const log = (c, text) => { c.log.unshift({ t: Date.now() / 1000, round: c.round, text }); };
export const current = (c) => c.combatants[c.turn];

export function newCombat(n) {
  return { name: `Combate ${n}`, status: 'planned', round: 0, turn: 0, combatants: [], log: [] };
}

export function sortInitiative(c) {
  const curId = current(c)?.cid;
  c.combatants.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || (b.initBonus || 0) - (a.initBonus || 0) || (a.type === 'jugador' ? -1 : 1));
  c.turn = Math.max(0, c.combatants.findIndex((x) => x.cid === curId));
}

// Los PG de los jugadores se reflejan también en su ficha.
export function syncCharacter(chars, x) {
  const ch = x.type === 'jugador' && chars.find((y) => y.id === x.charId);
  if (!ch) return;
  Object.assign(ch, { hp: x.hp, tempHp: x.tempHp, deathSaves: { ...x.deathSaves } });
  api.update('characters', ch).catch(toastError);
}

export function damage(c, x, amount, source = '') {
  const hpBefore = x.hp;
  const real = applyDamage(x, amount);
  sfx.hit();
  log(c, `${x.name} recibe ${amount} de daño${source ? ` (${source})` : ''}. PG ${x.hp}/${x.maxHp}.`);
  if (x.concentration && amount > 0) {
    const dc = Math.min(30, Math.max(10, Math.floor(amount / 2))); // 2024: máximo CD 30
    toast(`${x.name}: salvación de Constitución CD ${dc} para mantener la concentración.`, { ms: 7000, iconName: 'aura' });
    log(c, `${x.name} debe superar CON CD ${dc} o perder la concentración.`);
  }
  if (x.hp === 0 && real > 0) {
    if (x.type === 'jugador') {
      if (real - hpBefore >= x.maxHp) {
        x.deathSaves = { ok: 0, ko: 3 };
        log(c, `${x.name} muere por daño masivo (el daño sobrante iguala sus PG máximos).`);
        sfx.death();
        toast(`${x.name} muere por daño masivo.`, { kind: 'error', iconName: 'skull' });
      } else {
        log(c, `${x.name} cae inconsciente.`);
        sfx.fail();
        toast(`${x.name} cae inconsciente.`, { iconName: 'skull' });
      }
    } else {
      log(c, `${x.name} cae derrotado.`);
      setTimeout(() => sfx.death(), 250);
      toast(`${x.name} cae derrotado.`, { iconName: 'skull' });
    }
  }
}

export function heal(c, x, amount) {
  applyHealing(x, amount);
  sfx.heal();
  log(c, `${x.name} recupera ${amount} PG. PG ${x.hp}/${x.maxHp}.`);
}

// Avanza (dir = 1) o retrocede (dir = -1) el turno. Los enemigos caídos se saltan.
export function step(c, dir) {
  const n = c.combatants.length;
  if (!n) return null;
  const round = c.round;
  if (dir > 0 && c.status === 'active' && c.round > 0) expireBy(c, current(c), 'fin'); // termina el turno de quien estaba
  for (let i = 0; i < n; i++) {
    c.turn += dir;
    if (c.turn >= n) { c.turn = 0; c.round += 1; log(c, `— Ronda ${c.round} —`); }
    if (c.turn < 0) { c.turn = n - 1; c.round = Math.max(1, c.round - 1); }
    const x = current(c);
    if (x.type === 'jugador' || x.hp > 0) break;
    if (dir > 0) { expireBy(c, x, 'inicio'); expireBy(c, x, 'fin'); } // un enemigo caído no juega: sus efectos se acaban
  }
  if (c.board) c.board.moved = {}; // el movimiento se cuenta por turno
  const x = current(c);
  if (c.round > round) sfx.gong(); else sfx.turn();
  if (dir > 0) {
    expireBy(c, x, 'inicio'); // empieza su turno: se acaban Debilitado y Ralentizado que causó
    x.conditions = x.conditions.filter((cond) => {
      if (cond.by) return true; // los de maestría duran según el turno de quien los causó, no el suyo
      if (cond.rounds == null) return true;
      cond.rounds -= 1;
      if (cond.rounds <= 0) {
        log(c, `${x.name} ya no está ${cond.name.toLowerCase()}.`);
        if (cond.name === 'Concentrado') x.concentration = false;
        return false;
      }
      return true;
    });
    log(c, `Turno de ${x.name}.`);
    if (x.type === 'jugador' && x.hp <= 0 && x.deathSaves.ko < 3 && x.deathSaves.ok < 3) toast(`${x.name} está a 0 PG: tirada de salvación de muerte.`, { iconName: 'skull' });
  }
  return x;
}

// Estados de maestría (Debilitado, Ralentizado, Molestado) que causó `who`: se acaban al inicio o al final de su turno.
// skip: cuántas veces más hay que esperar (Molestar dura hasta el final de su PRÓXIMO turno, no del actual).
function expireBy(c, who, moment) {
  if (!who) return;
  for (const y of c.combatants) {
    y.conditions = (y.conditions || []).filter((cond) => {
      if (cond.by !== who.cid || cond.ends !== moment) return true;
      if (cond.skip > 0) { cond.skip -= 1; return true; }
      log(c, `${y.name} ya no está ${cond.name.toLowerCase()}.`);
      return false;
    });
  }
}

// Aplica un estado de maestría de armas: el de la referencia (mastery_states) que causa `by` sobre `target`. No se
// acumulan: si ya lo tenía, se renueva. Derribado dura hasta que se levante.
export function applyMastery(c, target, state, by) {
  target.conditions = (target.conditions || []).filter((k) => k.name !== state.name);
  const during = by && current(c) === by; // en su turno: Molestar aguanta también todo su turno siguiente
  target.conditions.push(state.ends
    ? { name: state.name, rounds: null, by: by?.cid || null, ends: state.ends, skip: state.ends === 'fin' && during ? 1 : 0 }
    : { name: state.name, rounds: null });
  log(c, `${target.name} queda ${state.name.toLowerCase()}${by ? ` (${state.mastery} de ${by.name})` : ''}.`);
}

export async function rollInitiative(c, onlyMissing = false) {
  sfx.drum();
  for (const x of c.combatants) {
    if (onlyMissing && x.init != null) continue;
    const r = await roll(`1d20${fmtMod(x.initBonus || 0)}`, { label: `${x.name}: Iniciativa`, who: x.name, quiet: true, secret: x.hidden });
    if (r) x.init = r.total;
  }
  sortInitiative(c);
}

// Tira la salvación de muerte con dados animados y aplica el resultado.
export async function deathSave(c, x) {
  const r = await roll('1d20', { label: `${x.name}: salvación de muerte`, who: x.name, color: x.color });
  if (!r) return null;
  const ds = x.deathSaves;
  if (r.natural === 20) { x.hp = 1; x.deathSaves = { ok: 0, ko: 0 }; log(c, `${x.name} saca un 20 natural y se levanta con 1 PG.`); }
  else if (r.natural === 1) ds.ko = Math.min(3, ds.ko + 2);
  else if (r.total >= 10) ds.ok = Math.min(3, ds.ok + 1);
  else ds.ko = Math.min(3, ds.ko + 1);
  if (x.deathSaves.ko >= 3) { log(c, `${x.name} ha muerto.`); sfx.death(); }
  else if (x.deathSaves.ok >= 3) { log(c, `${x.name} se estabiliza.`); sfx.heal(); }
  else if (x.hp > 0) sfx.levelup();
  return r;
}

export function xpReward(c, crXp) {
  const defeated = c.combatants.filter((x) => x.type === 'enemigo' && x.hp <= 0);
  return { defeated, xp: defeated.reduce((s, x) => s + (crXp[x.cr] || 0), 0) };
}

export function resetCombat(c) {
  c.status = 'planned'; c.round = 0; c.turn = 0; c.log = [];
  if (c.board) c.board.moved = {};
  c.combatants.forEach((x) => {
    Object.assign(x, { init: null, hp: x.maxHp, tempHp: 0, conditions: [], concentration: false, deathSaves: { ok: 0, ko: 0 } });
  });
}

// Estado que ven los jugadores de un enemigo, sin números.
export function healthWord(x) {
  if (x.hp <= 0) return 'Caído';
  if (x.maxHp == null) return 'En pie'; // la pantalla de jugadores en otro ordenador puede no llevar los PG del enemigo
  const r = x.hp / Math.max(1, x.maxHp);
  return r >= 1 ? 'Ileso' : r > 0.5 ? 'Herido' : r > 0.25 ? 'Maltrecho' : 'A las puertas';
}

// ------------------------------------------------------------- tiradas de salvación
// Lo que cambia una salvación según los estados (reglas de 2024): paralizado, aturdido, inconsciente o petrificado
// fallan las de FUE y DES sin tirar; apresado, desventaja en DES; esquivando, ventaja en DES; bendecido, +1d4;
// y el cansancio resta 2 por nivel a toda prueba con d20.
const AUTO_FAIL = ['Paralizado', 'Aturdido', 'Inconsciente', 'Petrificado'];
export function saveInfo(x, k) {
  const names = (x.conditions || []).map((c) => c.name || c);
  const physical = k === 'fue' || k === 'des';
  const fail = physical ? names.find((n) => AUTO_FAIL.includes(n)) : null;
  const dis = k === 'des' && names.includes('Apresado');
  const adv = k === 'des' && names.includes('Esquivando') && !fail;
  const blessed = names.includes('Bendecido');
  const bonus = (Number(x.saves?.[k]) || 0) - 2 * (x.exhaustion || 0);
  const notes = [fail && `${fail.toLowerCase()}: falla sin tirar`, dis && 'apresado: desventaja', adv && 'esquivando: ventaja',
    blessed && 'bendecido: +1d4', x.exhaustion && `cansancio ${x.exhaustion}: −${2 * x.exhaustion}`].filter(Boolean);
  return { bonus, fail, adv, dis, blessed, expr: `1d20${fmtMod(bonus)}${blessed ? '+1d4' : ''}`, notes };
}
// Ventaja y desventaja se anulan entre sí (la elegida en la bandeja más la de los estados).
const mergeMode = (...modes) => {
  const adv = modes.includes('adv'); const dis = modes.includes('dis');
  return adv && dis ? '' : adv ? 'adv' : dis ? 'dis' : '';
};
// Tira la salvación de un participante y la apunta en el registro. Con CD dice si salva.
// Devuelve { total, saved, auto } (auto: falló sin tirar) o null si se cancela.
export async function saveRoll(c, x, k, { mode = '', dc = null, quiet = false } = {}) {
  const s = saveInfo(x, k);
  const what = `salvación de ${ABILITY_NAME[k]}`;
  if (s.fail) {
    log(c, `${x.name} falla la ${what} sin tirar (${s.fail.toLowerCase()}).`);
    if (!quiet) toast(`${x.name} falla la ${what}: está ${s.fail.toLowerCase()}.`, { iconName: 'shield' });
    return { total: null, saved: false, auto: true };
  }
  const r = await roll(s.expr, { label: `${x.name}: ${what}${dc ? ` (CD ${dc})` : ''}`, who: x.name, mode: mergeMode(mode, s.adv && 'adv', s.dis && 'dis'),
    secret: !!x.hidden, color: x.color, quiet });
  if (!r) return null;
  const saved = dc ? r.total >= Number(dc) : null;
  log(c, `${x.name}: ${what} ${r.total}${dc ? ` contra CD ${dc}: ${saved ? 'salva' : 'falla'}` : ''}.`);
  if (dc && !quiet) toast(h('span', {}, h('b', {}, x.name), ` ${saved ? 'supera' : 'falla'} la ${what} (${r.total} contra CD ${dc})`), { kind: saved ? 'good' : 'error', iconName: 'shield' });
  return { ...r, saved, auto: false };
}

// Daño en área con salvación: se tira la salvación de cada objetivo con su bonificador
// (su cansancio y sus estados) y se aplica el daño, la mitad si salva. Devuelve true si se aplicó.
export async function areaDialog(c, { chars = [], preselect = null, title = 'Daño en área' } = {}) {
  const opts = { ability: 'des', dc: 13, damage: '8d6', half: true };
  const targets = new Set(preselect || c.combatants.filter((x) => x.type !== 'jugador' && x.hp > 0).map((x) => x.cid));
  const body = h('div', { class: 'stack' },
    h('div', { class: 'row' },
      field('Salvación', selectEl(ABILITY_KEYS.map((k) => [k, ABILITY_SHORT[k]]), opts.ability, (v) => { opts.ability = v; })),
      field('CD', bind(opts, 'dc', { type: 'number', class: 'inline' })),
      field('Daño (dados o número)', bind(opts, 'damage'), 'grow'),
      h('label', { class: 'check' }, bind(opts, 'half', { type: 'checkbox' }), 'Mitad si salva')),
    h('div', { class: 'eyebrow' }, 'Objetivos'),
    h('div', { class: 'targets' }, c.combatants.map((x) => h('label', { class: `target ${x.type}` },
      h('input', { type: 'checkbox', checked: targets.has(x.cid), onchange: (e) => (e.target.checked ? targets.add(x.cid) : targets.delete(x.cid)) }),
      token(x, { size: 30 }), h('span', {}, x.name)))),
    h('p', { class: 'tiny muted' }, 'Se tira la salvación de cada objetivo con su bonificador y se aplica el daño.'));
  if (!(await modal(title, body, [{ label: 'Cancelar', value: false }, { label: 'Lanzar', value: true, class: 'primary', icon: 'flame' }], { iconName: 'flame' }))) return false;

  const dmgRoll = /d/i.test(opts.damage) ? await roll(opts.damage, { label: 'Daño en área' }) : { total: Number(opts.damage) || 0 };
  if (!dmgRoll) return false;
  const lines = [];
  for (const x of c.combatants.filter((y) => targets.has(y.cid))) {
    const r = await saveRoll(c, x, opts.ability, { dc: opts.dc, quiet: true });
    if (!r) continue;
    const saved = r.saved;
    const dmg = saved ? (opts.half ? Math.floor(dmgRoll.total / 2) : 0) : dmgRoll.total;
    if (dmg) { damage(c, x, dmg, 'área'); syncCharacter(chars, x); }
    lines.push(h('li', { class: saved ? 'saved' : 'failed' }, token(x, { size: 30 }), h('b', { class: 'grow' }, x.name),
      h('span', { class: 'chip' }, r.auto ? '✖ sin tirar' : `🎲 ${r.total}`), h('span', { class: `chip ${saved ? 'good' : 'bad'}` }, saved ? 'Salva' : 'Falla'), h('b', { class: 'dmg' }, `−${dmg}`)));
  }
  log(c, `Área de ${ABILITY_SHORT[opts.ability]} CD ${opts.dc}: ${dmgRoll.total} de daño.`);
  modal('Resultado del área', h('ul', { class: 'area-result' }, lines), undefined, { iconName: 'flame' });
  return true;
}

// Salvación de grupo, sin daño: aliento que asusta, presencia aterradora, un conjuro que hechiza… Cada objetivo tira
// la suya contra la CD y, si se elige, quien falla queda con ese estado. Devuelve true si se tiró.
export async function saveDialog(c, { conditions = [], preselect = null } = {}) {
  const opts = { ability: 'sab', dc: 13, cond: '', rounds: 10 };
  const targets = new Set(preselect || c.combatants.filter((x) => x.type === 'jugador' && x.hp > 0).map((x) => x.cid));
  const body = h('div', { class: 'stack' },
    h('div', { class: 'row' },
      field('Salvación', selectEl(ABILITY_KEYS.map((k) => [k, ABILITY_NAME[k]]), opts.ability, (v) => { opts.ability = v; })),
      field('CD', bind(opts, 'dc', { type: 'number', class: 'inline' })),
      field('Si falla, queda', selectEl([['', '— nada —'], ...conditions.map((n) => [n, n])], opts.cond, (v) => { opts.cond = v; })),
      field('Durante', selectEl([[0, 'Indefinido'], [1, '1 turno'], [10, '1 minuto (10)']], opts.rounds, (v) => { opts.rounds = Number(v); }))),
    h('div', { class: 'eyebrow' }, 'Quién tira'),
    h('div', { class: 'targets' }, c.combatants.map((x) => h('label', { class: `target ${x.type}` },
      h('input', { type: 'checkbox', checked: targets.has(x.cid), onchange: (e) => (e.target.checked ? targets.add(x.cid) : targets.delete(x.cid)) }),
      token(x, { size: 30 }), h('span', {}, x.name), h('span', { class: 'tiny muted' }, ` ${fmtMod(saveInfo(x, opts.ability).bonus)}`)))),
    h('p', { class: 'tiny muted' }, 'Cada uno tira con su bonificador, su cansancio y sus estados (paralizado o aturdido fallan FUE y DES; apresado, desventaja en DES; esquivando, ventaja en DES; bendecido, +1d4).'));
  if (!(await modal('Salvación', body, [{ label: 'Cancelar', value: false }, { label: 'Tirar', value: true, class: 'primary', icon: 'shield' }], { iconName: 'shield' }))) return false;
  const lines = [];
  for (const x of c.combatants.filter((y) => targets.has(y.cid))) {
    const r = await saveRoll(c, x, opts.ability, { dc: opts.dc, quiet: true });
    if (!r) continue;
    if (!r.saved && opts.cond && !x.conditions.some((k) => k.name === opts.cond)) {
      x.conditions.push({ name: opts.cond, rounds: opts.rounds || null });
      log(c, `${x.name} queda ${opts.cond.toLowerCase()}.`);
    }
    lines.push(h('li', { class: r.saved ? 'saved' : 'failed' }, token(x, { size: 30 }), h('b', { class: 'grow' }, x.name),
      h('span', { class: 'chip' }, r.auto ? '✖ sin tirar' : `🎲 ${r.total}`), h('span', { class: `chip ${r.saved ? 'good' : 'bad'}` }, r.saved ? 'Salva' : 'Falla'),
      !r.saved && opts.cond && h('span', { class: 'chip cond' }, opts.cond)));
  }
  if (!lines.length) return false;
  sfx.magic();
  modal(`Salvación de ${ABILITY_NAME[opts.ability]} · CD ${opts.dc}`, h('ul', { class: 'area-result' }, lines), undefined, { iconName: 'shield' });
  return true;
}
