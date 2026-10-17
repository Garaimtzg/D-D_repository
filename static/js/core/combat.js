// Reglas del combate compartidas por la Mesa y la sección Combate: turnos, daño, curación,
// salvaciones de muerte y sincronización de los PG de los jugadores con su ficha.
import { api } from './api.js';
import { toast, toastError } from './dom.js';
import { applyDamage, applyHealing, fmtMod } from './dnd.js';
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
    const dc = Math.max(10, Math.floor(amount / 2));
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
  for (let i = 0; i < n; i++) {
    c.turn += dir;
    if (c.turn >= n) { c.turn = 0; c.round += 1; log(c, `— Ronda ${c.round} —`); }
    if (c.turn < 0) { c.turn = n - 1; c.round = Math.max(1, c.round - 1); }
    const x = current(c);
    if (x.type === 'jugador' || x.hp > 0) break;
  }
  const x = current(c);
  if (c.round > round) sfx.gong(); else sfx.turn();
  if (dir > 0) {
    x.conditions = x.conditions.filter((cond) => {
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
  c.combatants.forEach((x) => {
    Object.assign(x, { init: null, hp: x.maxHp, tempHp: 0, conditions: [], concentration: false, deathSaves: { ok: 0, ko: 0 } });
  });
}

// Estado que ven los jugadores de un enemigo, sin números.
export function healthWord(x) {
  if (x.hp <= 0) return 'Caído';
  const r = x.hp / Math.max(1, x.maxHp);
  return r >= 1 ? 'Ileso' : r > 0.5 ? 'Herido' : r > 0.25 ? 'Malherido' : 'A las puertas';
}
