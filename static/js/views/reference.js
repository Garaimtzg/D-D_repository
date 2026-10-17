// Reglas: referencia rápida de 5e con buscador, estados como fichas con icono y tablas de PX.
import { h, clear, icon, searchBox, segmented } from '../core/dom.js';
import { reference, ABILITY_SHORT, CONDITION_ICON } from '../core/dnd.js';

export default { id: 'reglas', title: 'Reglas', icon: 'reglas', hint: 'Estados, acciones y tablas de 5e · tecla 9', mount };

const ACTION_ICON = {
  Atacar: '⚔️', 'Lanzar un conjuro': '✨', Correr: '🏃', Destrabarse: '🌀', Esquivar: '🛡️', Ayudar: '🤝', Esconderse: '🫥',
  Prepararse: '⏳', Buscar: '🔎', 'Usar un objeto': '🧪', 'Agarrar / Empujar': '✊',
};
const DC = [[5, 'Muy fácil'], [10, 'Fácil'], [15, 'Media'], [20, 'Difícil'], [25, 'Muy difícil'], [30, 'Casi imposible']];

async function mount(root) {
  const ref = await reference();
  const state = { q: '', section: 'todo' };
  const out = h('div', { class: 'ref-layout' });

  const match = (...txt) => !state.q || txt.join(' ').toLowerCase().includes(state.q);
  const show = (key) => state.section === 'todo' || state.section === key;

  function draw() {
    const blocks = [];
    const conds = ref.conditions.filter((c) => match(c.name, c.text));
    if (show('estados') && conds.length) {
      blocks.push(h('section', { class: 'panel wide' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('aura'), 'Estados')),
        h('div', { class: 'cond-grid' }, conds.map((c) => h('article', { class: 'cond-card' },
          h('span', { class: 'cond-emoji' }, CONDITION_ICON[c.name] || '•'), h('div', {}, h('b', {}, c.name), h('p', {}, c.text)))))));
    }
    const acts = ref.actions.filter((a) => match(a.name, a.text));
    if (show('combate') && acts.length) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('combate'), 'Acciones en combate')),
        h('ul', { class: 'act-list' }, acts.map((a) => h('li', {}, h('span', { class: 'act-ic' }, ACTION_ICON[a.name] || '•'), h('div', {}, h('b', {}, a.name), h('p', {}, a.text)))))));
    }
    const rules = ref.rules.filter((r) => match(r.name, r.text));
    if (show('reglas') && rules.length) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('reglas'), 'Reglas rápidas')),
        h('dl', { class: 'ref' }, rules.map((r) => [h('dt', {}, r.name), h('dd', {}, r.text)]))));
    }
    if (show('reglas') && match('clase de dificultad cd', ...DC.map((d) => d[1]))) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('target'), 'Clases de dificultad')),
        h('div', { class: 'dc-ladder' }, DC.map(([n, l], i) => h('div', { class: 'dc-step', style: { '--i': i } }, h('b', {}, n), h('span', {}, l))))));
    }
    if (show('reglas') && match('agotamiento', ...ref.exhaustion)) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('hourglass'), 'Agotamiento')),
        h('ol', { class: 'exh-list' }, ref.exhaustion.map((t, i) => h('li', { style: { '--i': i } }, h('b', {}, i + 1), h('span', {}, t)))),
        h('p', { class: 'tiny muted' }, 'Los efectos se acumulan. Un descanso largo con comida y bebida quita un nivel.')));
    }
    const skills = ref.skills.filter((s) => match(s.name, ABILITY_SHORT[s.ability]));
    if (show('tablas') && skills.length) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('personajes'), 'Habilidades')),
        h('div', { class: 'skill-grid' }, ['fue', 'des', 'int', 'sab', 'car'].map((ab) => {
          const list = skills.filter((s) => s.ability === ab);
          return list.length > 0 && h('div', { class: 'skill-group' }, h('span', { class: 'chip' }, ABILITY_SHORT[ab]), list.map((s) => h('div', {}, s.name)));
        }))));
    }
    if (show('tablas') && match('experiencia nivel px')) {
      const max = ref.level_xp[ref.level_xp.length - 1];
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('star'), 'Experiencia por nivel')),
        h('div', { class: 'xp-table' }, ref.level_xp.map((xp, i) => h('div', { class: 'xp-row' },
          h('b', {}, i + 1), h('div', { class: 'xp-track' }, h('i', { style: { width: `${Math.max(1, (xp / max) * 100)}%` } })), h('span', { class: 'tnum' }, xp.toLocaleString('es-ES')))))));
    }
    if (show('tablas') && match('valor de desafío vd px')) {
      blocks.push(h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('skull'), 'PX por valor de desafío')),
        h('div', { class: 'cr-grid' }, Object.entries(ref.cr_xp).map(([cr, xp]) => h('div', { class: 'cr-cell' }, h('b', {}, cr), h('span', { class: 'tnum' }, xp.toLocaleString('es-ES')))))));
    }
    clear(out, blocks.length ? blocks : h('div', { class: 'empty' }, icon('search'), h('h3', {}, 'Nada coincide'), h('p', {}, 'Prueba con otra palabra.')));
  }

  root.append(h('div', { class: 'stack' },
    h('div', { class: 'panel row' },
      h('div', { class: 'grow', style: { maxWidth: '420px' } }, searchBox('Buscar regla, estado, acción…', (v) => { state.q = v.trim().toLowerCase(); draw(); })),
      segmented([['todo', 'Todo'], ['estados', 'Estados'], ['combate', 'Combate'], ['reglas', 'Reglas'], ['tablas', 'Tablas']], state.section, (v) => { state.section = v; draw(); })),
    out));
  draw();
}
