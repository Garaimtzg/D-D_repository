// Herramientas del máster sobre el grupo: pruebas de grupo (todos tiran a la vez contra una CD)
// y una «pantalla del máster» con los números que más se preguntan en la mesa.
import { h, modal, segmented, selectEl, avatar, toast } from './dom.js';
import { reference, ABILITY_KEYS, ABILITY_SHORT, ABILITY_NAME, mod, fmtMod, d20, saveBonus, skillBonus, profBonus, passivePerception, effectiveSpeed, fmtM } from './dnd.js';
import { roll } from './dice.js';
import { sfx } from './sfx.js';

const party = (chars) => chars.filter((c) => c.type === 'jugador');

// Prueba de grupo (2024): si al menos la mitad supera la CD, el grupo tiene éxito.
export async function groupCheck(chars) {
  const ref = await reference();
  const members = party(chars);
  if (!members.length) return toast('No hay jugadores todavía.');
  const st = { what: 'skill:percepcion', dc: 15, mode: '', secret: false, who: new Set(members.map((c) => c.id)) };
  const options = [
    h('optgroup', { label: 'Habilidades' }, ref.skills.map((s) => h('option', { value: `skill:${s.key}`, selected: `skill:${s.key}` === st.what }, `${s.name} (${ABILITY_SHORT[s.ability]})`))),
    h('optgroup', { label: 'Salvaciones' }, ABILITY_KEYS.map((k) => h('option', { value: `save:${k}` }, `Salvación de ${ABILITY_NAME[k]}`))),
    h('optgroup', { label: 'Características' }, ABILITY_KEYS.map((k) => h('option', { value: `abil:${k}` }, `Prueba de ${ABILITY_NAME[k]}`))),
  ];
  const body = h('div', { class: 'stack' },
    h('div', { class: 'row' },
      h('label', { class: 'field grow' }, 'Tirada', h('select', { onchange: (e) => { st.what = e.target.value; } }, options)),
      h('label', { class: 'field' }, 'CD', selectEl([5, 10, 12, 13, 15, 18, 20, 25, 30], st.dc, (v) => { st.dc = Number(v); }))),
    h('div', { class: 'row' }, segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desventaja']], st.mode, (v) => { st.mode = v; }),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', onchange: (e) => { st.secret = e.target.checked; } }), 'Secreta (no sale en el modo jugadores)')),
    h('div', { class: 'targets' }, members.map((c) => h('label', { class: 'target' },
      h('input', { type: 'checkbox', checked: true, onchange: (e) => (e.target.checked ? st.who.add(c.id) : st.who.delete(c.id)) }), avatar(c), h('span', {}, c.name)))));
  if (!(await modal('Prueba de grupo', body, [{ label: 'Cancelar', value: false }, { label: 'Tirar', value: true, class: 'primary', icon: 'dados' }], { iconName: 'dados' }))) return;

  const [kind, key] = st.what.split(':');
  const skill = ref.skills.find((s) => s.key === key);
  const label = kind === 'skill' ? skill.name : kind === 'save' ? `Salvación de ${ABILITY_NAME[key]}` : `Prueba de ${ABILITY_NAME[key]}`;
  const results = [];
  sfx.drum();
  for (const c of members.filter((m) => st.who.has(m.id))) {
    const bonus = kind === 'skill' ? skillBonus(c, skill) : kind === 'save' ? saveBonus(c, key) : mod(c.abilities?.[key]);
    const r = await roll(d20(c, bonus), { label: `${c.name}: ${label}`, who: c.name, mode: st.mode, secret: st.secret, quiet: true, color: c.color });
    if (r) results.push([c, r]);
  }
  if (!results.length) return;
  const ok = results.filter(([, r]) => r.total >= st.dc).length;
  const win = ok * 2 >= results.length;
  if (win) sfx.levelup(); else sfx.fail();
  modal(`${label} · CD ${st.dc}`, h('div', { class: 'stack' },
    h('ul', { class: 'area-result' }, results.sort((a, b) => b[1].total - a[1].total).map(([c, r]) => h('li', {},
      avatar(c), h('b', { class: 'grow' }, c.name),
      r.natural === 20 && h('span', { class: 'chip good' }, '20 natural'), r.natural === 1 && h('span', { class: 'chip bad' }, '1 natural'),
      h('span', { class: `chip ${r.total >= st.dc ? 'good' : 'bad'}` }, r.total >= st.dc ? 'Supera' : 'Falla'), h('b', { class: 'dmg' }, r.total)))),
    h('p', { class: `group-verdict ${win ? 'good' : 'bad'}` }, win ? '✔ Éxito del grupo' : '✘ Fallo del grupo', h('span', { class: 'small muted' }, ` · ${ok} de ${results.length} superan (hace falta la mitad)`))),
  undefined, { iconName: 'dados' });
}

// Pantalla del máster: CA, PG, velocidad, pasivas, CD de conjuros y salvaciones de todo el grupo.
export async function partyScreen(chars) {
  const ref = await reference();
  const members = party(chars);
  if (!members.length) return toast('No hay jugadores todavía.');
  const passive = (c, key) => 10 + skillBonus(c, ref.skills.find((s) => s.key === key)) - 2 * (c.exhaustion || 0);
  const table = h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table party-table' },
    h('thead', {}, h('tr', {}, ['', 'CA', 'PG', 'Velocidad', 'Percepción', 'Perspicacia', 'Investigación', 'CD conj.', ...ABILITY_KEYS.map((k) => ABILITY_SHORT[k])].map((t) => h('th', {}, t)))),
    h('tbody', {}, members.map((c) => h('tr', {},
      h('td', {}, h('div', { class: 'row nowrap' }, avatar(c), h('div', {}, h('b', {}, c.name), h('div', { class: 'tiny muted' }, [c.cls, c.level && `nv ${c.level}`].filter(Boolean).join(' · '))))),
      h('td', {}, h('b', {}, c.ac)), h('td', { class: c.hp <= c.maxHp / 2 ? 'bad-text' : '' }, `${c.hp}/${c.maxHp}`), h('td', {}, fmtM(effectiveSpeed(c))),
      h('td', {}, passivePerception(c) - 2 * (c.exhaustion || 0)), h('td', {}, passive(c, 'perspicacia')), h('td', {}, passive(c, 'investigacion')),
      h('td', {}, c.spellAbility ? 8 + profBonus(c) + mod(c.abilities[c.spellAbility]) : '—'),
      ABILITY_KEYS.map((k) => h('td', { class: c.saves?.includes(k) ? 'gold' : '' }, fmtMod(saveBonus(c, k)))))))));
  const next = await modal('Pantalla del máster', h('div', { class: 'stack' }, table,
    h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Pasivas = 10 + bonificador (con el cansancio aplicado). Las salvaciones con competencia salen en dorado.')),
  [{ label: 'Cerrar', value: null }, { label: 'Prueba de grupo', value: 'check', class: 'primary', icon: 'dados' }], { iconName: 'shield', wide: true });
  if (next === 'check') groupCheck(chars);
}
