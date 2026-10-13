// Referencia rápida de reglas de 5e con buscador.
import { h, clear } from '../core/dom.js';
import { reference, ABILITY_SHORT } from '../core/dnd.js';

const ICON = '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>';

export default { id: 'referencia', title: 'Reglas', icon: ICON, mount };

async function mount(root) {
  const ref = await reference();
  const out = h('div', { class: 'ref-grid' });
  const search = h('input', { type: 'search', placeholder: 'Buscar regla, estado, acción…', 'aria-label': 'Buscar en las reglas', oninput: draw });

  const sections = () => [
    ['Estados', ref.conditions.map((c) => [c.name, c.text])],
    ['Acciones en combate', ref.actions.map((a) => [a.name, a.text])],
    ['Reglas rápidas', ref.rules.map((r) => [r.name, r.text])],
    ['Agotamiento', ref.exhaustion.map((t, i) => [`Nivel ${i + 1}`, t])],
    ['Habilidades', ref.skills.map((s) => [s.name, ABILITY_SHORT[s.ability]])],
    ['Experiencia por nivel', ref.level_xp.map((xp, i) => [`Nivel ${i + 1}`, `${xp.toLocaleString('es-ES')} PX`])],
    ['PX por valor de desafío', Object.entries(ref.cr_xp).map(([cr, xp]) => [`VD ${cr}`, `${xp.toLocaleString('es-ES')} PX`])],
  ];

  function draw() {
    const q = search.value.trim().toLowerCase();
    clear(out, sections().map(([title, rows]) => {
      const shown = rows.filter(([n, t]) => !q || `${n} ${t}`.toLowerCase().includes(q));
      if (!shown.length) return null;
      return h('div', { class: 'card' }, h('h3', {}, title),
        h('dl', { class: 'ref' }, shown.map(([n, t]) => [h('dt', {}, n), h('dd', {}, t)])));
    }));
  }

  root.append(h('div', { class: 'stack' }, h('div', { class: 'card' }, search), out));
  draw();
}
