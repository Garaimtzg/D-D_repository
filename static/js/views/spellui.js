// Piezas comunes para mostrar conjuros: la descripción básica al pasar el ratón, la carta con todos sus datos y el
// buscador para elegir conjuros (ficha, creador). Las descripciones son resúmenes propios; la completa está en el manual.
import { h, clear, icon, modal, searchBox, selectEl } from '../core/dom.js';

export const levelName = (n) => (n ? `Nivel ${n}` : 'Truco');
export const spellTip = (s) => (s ? `${s.summary || ''} (MdJ p. ${s.page})` : null);
export const spellMeta = (s) => [s.time, s.range, s.duration, s.save && `salv. ${s.save}`, s.damage || (s.heal && `${s.heal} curación`)].filter(Boolean).join(' · ');

// Carta del conjuro: escuela, datos de lanzamiento y la descripción básica.
export function spellCard(s, from = '') {
  const row = (k, v) => v && h('div', {}, h('dt', {}, k), h('dd', {}, v));
  return h('div', { class: 'spell-card stack-sm' },
    h('div', { class: 'row' }, h('span', { class: 'chip' }, `${levelName(s.level)} · ${s.school}`),
      s.concentration && h('span', { class: 'chip' }, 'Concentración'), s.ritual && h('span', { class: 'chip' }, 'Ritual'),
      from && h('span', { class: 'chip gold' }, from)),
    h('p', { class: 'spell-summary' }, s.summary),
    h('dl', { class: 'spell-stats' }, row('Tiempo', s.time), row('Alcance', s.range),
      row('Componentes', [s.components, s.cost].filter(Boolean).join(' · ')), row('Duración', s.duration),
      row('Salvación', s.save), row('Ataque', s.attack && (s.attack === 'cac' ? 'cuerpo a cuerpo' : 'a distancia')),
      row('Efecto', s.damage || (s.heal && `${s.heal} curación`)), row('Listas', s.classes.join(', '))),
    h('p', { class: 'tiny muted' }, `Descripción completa: Manual del Jugador 2024, p. ${s.page}.`));
}

// Buscador de conjuros en una ventana: filtra por nombre, nivel y lista, enseña la descripción de cada uno y
// llama a onPick(s) al pulsar «Añadir» (la ventana sigue abierta para añadir varios). `extra` va encima de la lista.
export function pickSpells({ title, spells, levels = null, lists = [], isTaken = () => false, onPick, extra = null, note = '' }) {
  const st = { q: '', level: '', list: lists.length ? lists[0] : '' };
  const box = h('div', { class: 'spell-pick-list' });
  const listOptions = [...lists.map((l) => [l, `Lista de ${l.toLowerCase()}`]), ['', 'Todas las listas']];
  const draw = () => {
    const q = st.q.toLowerCase();
    const found = spells.filter((s) => (!levels || levels.includes(s.level)) && (st.level === '' || s.level === Number(st.level))
      && (!st.list || s.classes.includes(st.list)) && (!q || `${s.name} ${s.school} ${s.summary}`.toLowerCase().includes(q)));
    clear(box, found.length ? found.slice(0, 200).map((s) => {
      const taken = isTaken(s);
      return h('div', { class: `spell-pick ${taken ? 'taken' : ''}` },
        h('div', { class: 'grow' },
          h('div', {}, h('b', {}, s.name), ' ', h('span', { class: 'tiny muted' }, `${levelName(s.level)} · ${s.school}${s.concentration ? ' · C' : ''}${s.ritual ? ' · R' : ''}`)),
          h('div', { class: 'small' }, s.summary),
          h('div', { class: 'tiny muted' }, `${spellMeta(s)} · MdJ p. ${s.page}`)),
        h('button', { class: 'btn xs primary', type: 'button', disabled: taken, onclick: () => { onPick(s); draw(); } },
          icon(taken ? 'check' : 'plus', 13), taken ? 'Ya está' : 'Añadir'));
    }) : h('p', { class: 'small muted' }, 'Ningún conjuro con esos filtros.'));
  };
  const levelOpts = [...new Set(spells.map((s) => s.level))].filter((n) => !levels || levels.includes(n)).sort((a, b) => a - b);
  draw();
  return modal(title, h('div', { class: 'stack' },
    note && h('p', { class: 'small muted', style: { margin: 0 } }, note),
    extra,
    h('div', { class: 'row' },
      searchBox('Buscar por nombre, escuela o efecto…', (v) => { st.q = v; draw(); }),
      levelOpts.length > 1 && selectEl([['', 'Todos los niveles'], ...levelOpts.map((n) => [n, levelName(n)])], st.level, (v) => { st.level = v; draw(); }, { class: 'mini-sel', 'aria-label': 'Nivel' }),
      selectEl(listOptions, st.list, (v) => { st.list = v; draw(); }, { class: 'mini-sel', 'aria-label': 'Lista de conjuros' })),
    box), [{ label: 'Hecho', value: true, class: 'primary', icon: 'check' }], { wide: true, iconName: 'wand' });
}
