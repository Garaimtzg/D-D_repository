// Enlaces entre las notas de la campaña: «@[Nombre]» apunta a una entrada del compendio, una ficha,
// un mapa o una misión. Al escribir @ aparecen sugerencias; al leer, cada nombre es un enlace.
import { h, clear } from './dom.js';

export const MENTION = /@\[([^\]\n]+)\]/g;
const KIND_ICON = { wiki: '📖', char: '👤', map: '🗺️', quest: '📌' };

// Todo lo que se puede enlazar y adónde lleva.
export function linkTargets({ wiki = [], chars = [], maps = [], quests = [] }) {
  return [
    ...wiki.map((e) => ({ name: e.name, kind: 'wiki', id: e.id, href: `#/mundo/compendio/${e.id}` })),
    ...chars.map((c) => ({ name: c.name, kind: 'char', id: c.id, href: `#/personajes/${c.id}` })),
    ...maps.map((m) => ({ name: m.name, kind: 'map', id: m.id, href: `#/mapas/${m.id}` })),
    ...quests.map((q) => ({ name: q.title, kind: 'quest', id: q.id, href: '#/notas/misiones' })),
  ].filter((t) => t.name);
}

// Nombres mencionados en un texto (en minúsculas).
export const mentionsIn = (text) => [...String(text || '').matchAll(MENTION)].map((m) => m[1].trim().toLowerCase());

// Texto → párrafos con los nombres enlazados.
export function renderMentions(text, targets) {
  const byName = new Map(targets.map((t) => [t.name.toLowerCase(), t]));
  return String(text || '').split(/\n{2,}/).filter((p) => p.trim()).map((para) => {
    const p = h('p', { class: 'mention-text' });
    let last = 0;
    for (const m of para.matchAll(MENTION)) {
      p.append(para.slice(last, m.index));
      const t = byName.get(m[1].trim().toLowerCase());
      p.append(t ? h('a', { class: `mention ${t.kind}`, href: t.href, dataset: { id: t.id } }, m[1])
        : h('span', { class: 'mention missing', 'data-tip': 'Aún no existe: créalo en el compendio' }, m[1]));
      last = m.index + m[0].length;
    }
    p.append(para.slice(last));
    return p;
  });
}

// Envuelve un textarea: al escribir «@» y unas letras propone nombres y los completa como @[Nombre].
export function mentionBox(textarea, getTargets) {
  const list = h('ul', { class: 'mention-list', hidden: true, role: 'listbox' });
  let items = [];
  let active = 0;
  const query = () => /@([^@[\]\n]{0,30})$/.exec(textarea.value.slice(0, textarea.selectionStart));
  const pick = (t) => {
    const q = query();
    if (!q) return;
    const end = textarea.selectionStart;
    textarea.setRangeText(`@[${t.name}] `, end - q[0].length, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    hide();
    textarea.focus();
  };
  const hide = () => { list.hidden = true; items = []; };
  const draw = () => clear(list, items.map((t, i) => h('li', { role: 'option', 'aria-selected': String(i === active),
    onmousedown: (e) => { e.preventDefault(); pick(t); } }, h('span', {}, KIND_ICON[t.kind]), t.name)));
  textarea.addEventListener('input', () => {
    const q = query();
    if (!q) return hide();
    const needle = q[1].trim().toLowerCase();
    items = getTargets().filter((t) => t.name.toLowerCase().includes(needle)).slice(0, 7);
    active = 0;
    list.hidden = !items.length;
    draw();
  });
  textarea.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; draw(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') hide();
  });
  textarea.addEventListener('blur', () => setTimeout(hide, 150));
  return h('div', { class: 'mention-wrap' }, textarea, list);
}
