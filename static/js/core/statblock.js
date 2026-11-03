// Bloque de criatura: el texto de rasgos del bestiario («Sentidos: …», «Acciones: Mordisco (…) · Aliento (…)») leído por
// secciones para enseñarlo ordenado en la ficha: velocidades, sentidos, idiomas, defensas, rasgos, acciones, reacciones
// y acciones legendarias. El texto sigue siendo lo que se guarda (lo que se edita, lo que va al bestiario con «Fijar como
// modelo»…); esto solo lo lee. Si el texto no tiene ese formato (una ficha de jugador escrita a mano), devuelve null.
import { h, icon } from './dom.js';
import { CONDITION_ICON, condLabel, fmtM } from './dnd.js';
import { roll } from './dice.js';

const LABELS = {
  Leyenda: 'lore', Trato: 'deal', Habilidades: 'skills', 'Otras velocidades': 'speeds', Resistencias: 'resist', Inmunidades: 'immune',
  Vulnerabilidades: 'vulnerable', Sentidos: 'senses', Idiomas: 'languages', Rasgos: 'traits', Acciones: 'actions',
  'Acciones adicionales': 'bonus', Reacciones: 'reactions', 'Acciones legendarias': 'legendary',
};
const CONDITIONS = new Set(Object.keys(CONDITION_ICON).map((k) => k.toLowerCase()));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const list = (t) => String(t || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);

// «Nombre (etiquetas) (detalle). Texto» (o «Nombre (…): texto»): nombre, etiquetas cortas (recarga 5-6, 3/día…), el
// detalle largo entre paréntesis (ataque, salvación, daño) y la explicación que va tras el punto o los dos puntos.
export function parseItem(raw) {
  const s = String(raw || '').trim().replace(/\.$/, '');
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if ((s[i] === '.' || s[i] === ':') && depth === 0 && s[i + 1] === ' ') { cut = i; break; }
  }
  const head = cut >= 0 ? s.slice(0, cut) : s;
  const groups = [...head.matchAll(/\(([^()]*)\)/g)].map((g) => g[1].trim());
  const short = (g) => g.length <= 28 && !g.includes(';');
  return {
    name: head.split('(')[0].trim(),
    tags: groups.filter(short),
    detail: groups.filter((g) => !short(g)).join(' · '),
    text: cut >= 0 ? cap(s.slice(cut + 2).trim()) : '',
  };
}

export function parseStatblock(text) {
  const raw = {};
  const other = [];
  for (const line of String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = /^([^:]{3,24}):\s*(.*)$/.exec(line);
    const key = m && LABELS[m[1].trim()];
    if (key) raw[key] = m[2].replace(/\.$/, '').trim();
    else other.push(line);
  }
  if (Object.keys(raw).length < 2) return null; // texto libre: se queda como está
  const items = (t) => String(t || '').split(' · ').map(parseItem).filter((x) => x.name);
  const [senseList, passive] = String(raw.senses || '').split(';');
  // Inmunidades: «fuego, veneno; asustado, hechizado» (daño ; estados). Sin «;», cada una se mira por su nombre.
  const immune = list(raw.immune);
  const legendary = items(raw.legendary);
  const uses = legendary[0] && /^\d+\s+usos?/i.test(legendary[0].name) ? legendary.shift() : null;
  return {
    lore: raw.lore || '',
    deal: raw.deal || '', // cómo ganarse su favor (las criaturas de Euskal Herria no son malvadas sin más)
    speeds: list(raw.speeds).map((s) => { const m = /^(\S+)\s+(.+)$/.exec(s); return m ? { kind: m[1], value: m[2] } : { kind: s, value: '' }; }),
    senses: list(senseList),
    passive: (/(\d+)/.exec(passive || '') || [])[1] || '',
    languages: /^ningun/i.test(raw.languages || '') ? [] : list(raw.languages),
    noLanguages: /^ningun/i.test(raw.languages || ''),
    resist: list(raw.resist),
    vulnerable: list(raw.vulnerable),
    immune: immune.filter((x) => !CONDITIONS.has(x.toLowerCase())),
    condImmune: immune.filter((x) => CONDITIONS.has(x.toLowerCase())).map(cap),
    traits: items(raw.traits),
    actions: items(raw.actions),
    bonus: items(raw.bonus),
    reactions: items(raw.reactions),
    legendary,
    legendaryUses: uses ? [uses.name, ...uses.tags].join(' · ') : '',
    other,
  };
}

const DAMAGE_ICON = {
  fuego: '🔥', frío: '❄️', relámpago: '⚡', trueno: '🔊', veneno: '☠️', ácido: '🧪', necrótico: '💀', radiante: '✨',
  psíquico: '🧠', fuerza: '💫', contundente: '🔨', perforante: '🏹', cortante: '🗡️',
};
const SPEED_ICON = { trepar: '🧗', volar: '🪽', nadar: '🌊', excavar: '⛏️' };
const SENSE_ICON = [[/oscuridad/, '🌑'], [/ciega/, '🦇'], [/vibraci/, '〰️'], [/verdadera/, '👁️']];
const dmgChip = (t, cls) => h('span', { class: `sb-chip ${cls}` }, DAMAGE_ICON[Object.keys(DAMAGE_ICON).find((k) => t.toLowerCase().startsWith(k))] || '', ' ', t);

// La vista: who (nombre de la ficha, para las tiradas de recarga), speed (su velocidad a pie), extra(item) (botones
// que añade la ficha a una acción, como tirar su ataque) y onEdit (pasar a editar el texto).
export function statblockView(sb, { who = '', speed = null, extra = null, onEdit = null } = {}) {
  const recharge = (it) => {
    const tag = it.tags.find((t) => /^recarga/i.test(t));
    const n = tag && Number((/(\d)/.exec(tag) || [])[1]);
    return n ? h('button', { class: 'sb-chip recharge', type: 'button', 'data-tip': `Al inicio de su turno tira 1d6: con ${n} o más vuelve a tenerla`,
      onclick: () => roll('1d6', { label: `${who ? `${who}: ` : ''}recarga de ${it.name} (${n}-6)`, who: who || 'DM' }) }, '🎲 ', tag) : null;
  };
  const item = (it) => h('li', { class: 'sb-item' },
    h('div', { class: 'sb-item-head' }, h('b', {}, it.name),
      it.tags.map((t) => (/^recarga/i.test(t) ? recharge(it) : h('span', { class: 'sb-chip tag' }, t))),
      extra?.(it)),
    it.detail && h('div', { class: 'sb-detail' }, it.detail.split(/;\s*/).map((part, i) => [i ? h('span', { class: 'sb-sep' }, ' · ') : '',
      /^salv\./.test(part) ? h('span', { class: 'sb-chip save' }, '🛡 ', part.replace(/^salv\.\s*/, 'Salvación de ')) : part])),
    it.text && h('div', { class: 'sb-text' }, it.text));
  const block = (title, iconName, arr, note = '') => arr.length > 0 && h('div', { class: 'sb-block' },
    h('h4', { class: 'sb-title' }, icon(iconName, 15), title, note && h('span', { class: 'sb-chip tag' }, note)),
    h('ul', { class: 'sb-list' }, arr.map(item)));
  const fact = (emoji, label, content) => h('div', { class: 'sb-fact' }, h('span', { class: 'sb-fact-label' }, emoji, ' ', label), h('div', { class: 'sb-fact-val' }, content));
  const defs = [
    sb.resist.length > 0 && fact('🛡️', 'Resistencias', sb.resist.map((t) => dmgChip(t, 'resist'))),
    sb.immune.length > 0 && fact('⛔', 'Inmune al daño', sb.immune.map((t) => dmgChip(t, 'immune'))),
    sb.condImmune.length > 0 && fact('🚫', 'Inmune a estados', sb.condImmune.map((t) => h('span', { class: 'sb-chip immune' }, condLabel(t)))),
    sb.vulnerable.length > 0 && fact('💥', 'Vulnerable', sb.vulnerable.map((t) => dmgChip(t, 'vulnerable'))),
  ].filter(Boolean);
  return h('div', { class: 'statblock' },
    sb.lore && h('p', { class: 'sb-lore' }, cap(sb.lore)),
    sb.deal && h('div', { class: 'sb-deal' }, h('b', {}, '🤝 Trato'), h('span', {}, cap(sb.deal))),
    h('div', { class: 'sb-facts' },
      fact('🦶', 'Velocidad', [speed != null && h('span', { class: 'sb-chip' }, '🚶 ', fmtM(speed)),
        sb.speeds.map((s) => h('span', { class: 'sb-chip' }, SPEED_ICON[s.kind] || '➜', ' ', s.kind, ' ', s.value))]),
      (sb.senses.length > 0 || sb.passive) && fact('👁️', 'Sentidos', [sb.senses.map((s) => h('span', { class: 'sb-chip' }, (SENSE_ICON.find(([rx]) => rx.test(s)) || [0, '✦'])[1], ' ', s)),
        sb.passive && h('span', { class: 'sb-chip passive' }, `Percepción pasiva ${sb.passive}`)]),
      fact('🗣️', 'Idiomas', sb.languages.length ? sb.languages.map((l) => h('span', { class: 'sb-chip' }, cap(l))) : h('span', { class: 'tiny muted' }, sb.noLanguages ? 'Ninguno' : '—'))),
    defs.length > 0 && h('div', { class: 'sb-facts defs' }, defs),
    block('Rasgos', 'sparkle', sb.traits),
    block('Acciones', 'sword', sb.actions),
    block('Acciones adicionales', 'bolt', sb.bonus),
    block('Reacciones', 'shield', sb.reactions),
    block('Acciones legendarias', 'crown', sb.legendary, sb.legendaryUses),
    sb.other.length > 0 && h('div', { class: 'sb-block' }, h('h4', { class: 'sb-title' }, icon('scroll', 15), 'Más'), sb.other.map((t) => h('p', { class: 'sb-text' }, t))),
    onEdit && h('button', { class: 'btn xs ghost sb-edit', type: 'button', onclick: onEdit, 'data-tip': 'Editar el texto de rasgos, sentidos, idiomas y acciones' }, icon('edit', 13), 'Editar como texto'));
}
