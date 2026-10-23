// Relaciones del mundo (como en Kanka o World Anvil): quién es familia, aliado o enemigo de quién,
// entre fichas y entradas del compendio. Se ven como una red y como un árbol familiar.
import { api } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, segmented, toast, toastError } from '../core/dom.js';
import { sfx } from '../core/sfx.js';

export const KINDS = [
  ['padre', 'es padre o madre de', '👪', '#e2b456'], ['pareja', 'es pareja de', '💞', '#ff7ab8'], ['hermano', 'es hermano o hermana de', '🫂', '#d9a35e'],
  ['aliado', 'es aliado de', '🤝', '#4cc38a'], ['enemigo', 'es enemigo de', '⚔️', '#e0524a'], ['rival', 'es rival de', '😤', '#ff8a3d'],
  ['miembro', 'pertenece a', '⚜️', '#5b9cff'], ['sirve', 'sirve a', '🙇', '#a77bff'], ['otro', 'tiene relación con', '🔗', '#9aa4ad'],
];
const KIND = Object.fromEntries(KINDS.map(([k, label, emoji, color]) => [k, { label, emoji, color }]));
const WIKI_ICON = { lugar: '🏰', faccion: '⚜️', objeto: '💎', deidad: '✨', historia: '📜', otro: '📌' };
const TYPE_ICON = { jugador: '🛡️', pnj: '🙂', enemigo: '💀' };

// Todo lo que puede tener relaciones: fichas y entradas del compendio.
export function entities(state) {
  return [
    ...state.chars.map((c) => ({ ref: `char:${c.id}`, name: c.name, icon: TYPE_ICON[c.type] || '👤', color: c.color })),
    ...state.wiki.map((e) => ({ ref: `wiki:${e.id}`, name: e.name, icon: WIKI_ICON[e.type] || '📌', color: '#8a6a3d' })),
  ];
}

// Relaciones de una entidad en texto: «⚔️ es enemigo de Tartalo».
export function relationsOf(state, ref) {
  const byRef = new Map(entities(state).map((e) => [e.ref, e]));
  return state.relations.filter((r) => r.a === ref || r.b === ref).map((r) => {
    const other = byRef.get(r.a === ref ? r.b : r.a);
    const k = KIND[r.kind] || KIND.otro;
    const text = r.a === ref ? `${k.label} ${other?.name || '?'}` : `${other?.name || '?'} ${k.label} ${byRef.get(ref)?.name || 'este'}`;
    return { r, other, text: `${k.emoji} ${text}${r.label ? ` (${r.label})` : ''}` };
  });
}

export function renderRelations(body, state, { openRef }) {
  const all = entities(state);
  const byRef = new Map(all.map((e) => [e.ref, e]));
  state.relView ||= 'red';
  const opts = [['', '— Elige —'], ...all.map((e) => [e.ref, `${e.icon} ${e.name}`])];
  const form = { a: '', kind: 'aliado', b: '', label: '', secret: false };
  const list = state.relations.filter((r) => !state.relFocus || r.a === state.relFocus || r.b === state.relFocus);

  async function add() {
    if (!form.a || !form.b || form.a === form.b) return toast('Elige dos personajes o entradas distintas.');
    try {
      state.relations.push(await api.create('relations', { ...form, label: form.label.trim() }));
      sfx.pin();
      renderRelations(body, state, { openRef });
    } catch (e) { toastError(e); }
  }
  async function remove(r) {
    await api.remove('relations', r.id).catch(toastError);
    state.relations = state.relations.filter((x) => x !== r);
    renderRelations(body, state, { openRef });
  }
  const focusSel = selectEl([['', 'Toda la red'], ...all.filter((e) => state.relations.some((r) => r.a === e.ref || r.b === e.ref)).map((e) => [e.ref, `${e.icon} ${e.name}`])],
    state.relFocus || '', (v) => { state.relFocus = v; renderRelations(body, state, { openRef }); }, { class: 'mini-sel', 'aria-label': 'Centrar en' });

  clear(body, h('div', { class: 'split relations' },
    h('aside', { class: 'panel sticky stack-sm' },
      h('div', { class: 'panel-head' }, h('h3', {}, '🕸️ Relaciones')),
      field('Quién', selectEl(opts, '', (v) => { form.a = v; }, { 'aria-label': 'Quién' })),
      field('Relación', selectEl(KINDS.map(([k, l, e]) => [k, `${e} ${l}`]), form.kind, (v) => { form.kind = v; }, { 'aria-label': 'Relación' })),
      field('De quién', selectEl(opts, '', (v) => { form.b = v; }, { 'aria-label': 'De quién' })),
      bind(form, 'label', { placeholder: 'Detalle (opcional): «le debe 100 po»…', 'aria-label': 'Detalle' }),
      h('label', { class: 'check small' }, bind(form, 'secret', { type: 'checkbox' }), '🔒 Secreta (solo el máster)'),
      h('button', { class: 'btn sm primary', type: 'button', onclick: add }, icon('plus', 14), 'Añadir relación'),
      h('div', { class: 'row between' }, h('b', { class: 'eyebrow' }, `${list.length} relaciones`), focusSel),
      h('ul', { class: 'rel-list' }, list.map((r) => {
        const k = KIND[r.kind] || KIND.otro;
        return h('li', { class: r.secret ? 'secret' : '' },
          h('span', { class: 'grow small' }, h('b', {}, byRef.get(r.a)?.name || '?'), ` ${k.emoji} ${k.label} `, h('b', {}, byRef.get(r.b)?.name || '?'), r.label && h('span', { class: 'muted' }, ` · ${r.label}`), r.secret && ' 🔒'),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar', onclick: () => remove(r) }, icon('close', 12)));
      }))),
    h('section', { class: 'panel rel-stage' },
      h('div', { class: 'row between' },
        segmented([['red', '🕸️ Red'], ['arbol', '🌳 Árbol familiar']], state.relView, (v) => { state.relView = v; renderRelations(body, state, { openRef }); }),
        h('span', { class: 'tiny muted' }, state.relView === 'red' ? 'Pulsa un nombre para centrarte en él; doble clic para abrir su ficha o entrada.' : 'Usa las relaciones «padre o madre» y «pareja».')),
      state.relView === 'red' ? graph(state, byRef, openRef, (ref) => { state.relFocus = state.relFocus === ref ? '' : ref; renderRelations(body, state, { openRef }); })
        : familyTree(state, byRef, openRef, all, () => renderRelations(body, state, { openRef })))));
}

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  kids.flat().forEach((k) => k && el.append(typeof k === 'string' ? document.createTextNode(k) : k));
  return el;
};

// Red de relaciones con una disposición por fuerzas (muelles entre relacionados, repulsión entre todos).
function graph(state, byRef, openRef, onFocus) {
  let rels = state.relations;
  if (state.relFocus) { // la entidad elegida, sus vecinos y las relaciones entre ellos
    const near = new Set([state.relFocus]);
    rels.forEach((r) => { if (r.a === state.relFocus) near.add(r.b); if (r.b === state.relFocus) near.add(r.a); });
    rels = rels.filter((r) => near.has(r.a) && near.has(r.b));
  }
  const refs = [...new Set(rels.flatMap((r) => [r.a, r.b]))].filter((r) => byRef.has(r));
  if (!refs.length) return h('div', { class: 'empty' }, h('h3', {}, 'Aún no hay relaciones'), h('p', {}, 'Añade la primera a la izquierda: «Tartalo es enemigo de Basajaun», «Mari es madre de Mikelats»…'));
  const W = 1000; const H = 640;
  const pos = new Map(refs.map((r, i) => [r, { x: W / 2 + Math.cos((i / refs.length) * Math.PI * 2) * 220, y: H / 2 + Math.sin((i / refs.length) * Math.PI * 2) * 200 }]));
  if (state.relFocus && pos.has(state.relFocus)) Object.assign(pos.get(state.relFocus), { x: W / 2, y: H / 2 });
  const edges = rels.filter((r) => pos.has(r.a) && pos.has(r.b));
  for (let it = 0; it < 300; it++) {
    const f = new Map(refs.map((r) => [r, { x: 0, y: 0 }]));
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const a = pos.get(refs[i]); const b = pos.get(refs[j]);
        const dx = a.x - b.x; const dy = a.y - b.y; const d2 = Math.max(100, dx * dx + dy * dy);
        const k = 300000 / d2;
        f.get(refs[i]).x += dx * k / Math.sqrt(d2); f.get(refs[i]).y += dy * k / Math.sqrt(d2);
        f.get(refs[j]).x -= dx * k / Math.sqrt(d2); f.get(refs[j]).y -= dy * k / Math.sqrt(d2);
      }
    }
    for (const e of edges) {
      const a = pos.get(e.a); const b = pos.get(e.b);
      const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.max(1, Math.hypot(dx, dy));
      const k = (d - 200) * 0.05;
      f.get(e.a).x += (dx / d) * k; f.get(e.a).y += (dy / d) * k;
      f.get(e.b).x -= (dx / d) * k; f.get(e.b).y -= (dy / d) * k;
    }
    const step = 1 - it / 300;
    for (const r of refs) {
      if (r === state.relFocus) continue;
      const p = pos.get(r); const v = f.get(r);
      p.x = Math.min(W - 70, Math.max(70, p.x + v.x * step + (W / 2 - p.x) * 0.003));
      p.y = Math.min(H - 50, Math.max(40, p.y + v.y * step + (H / 2 - p.y) * 0.003));
    }
  }
  const out = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rel-svg', role: 'img', 'aria-label': 'Red de relaciones' },
    edges.map((e) => {
      const a = pos.get(e.a); const b = pos.get(e.b); const k = KIND[e.kind] || KIND.otro;
      return svg('g', { class: 'rel-edge' },
        svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: k.color, 'stroke-width': 3, 'stroke-dasharray': e.secret ? '8 6' : null, opacity: 0.8 }),
        svg('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6, 'text-anchor': 'middle', class: 'rel-label' }, `${k.emoji} ${e.label || k.label}`));
    }),
    refs.map((r) => {
      const p = pos.get(r); const ent = byRef.get(r);
      const g = svg('g', { class: `rel-node ${r === state.relFocus ? 'focus' : ''}`, transform: `translate(${p.x},${p.y})` },
        svg('circle', { r: 26, fill: ent.color || '#555' }), svg('text', { y: 9, 'text-anchor': 'middle', class: 'rel-emoji' }, ent.icon),
        svg('text', { y: 46, 'text-anchor': 'middle', class: 'rel-name' }, ent.name));
      g.addEventListener('click', () => onFocus(r));
      g.addEventListener('dblclick', () => openRef(r));
      return g;
    }));
  return h('div', { class: 'rel-canvas' }, out);
}

// Árbol familiar: generaciones por filas a partir de «padre o madre» y «pareja».
function familyTree(state, byRef, openRef, all, redraw) {
  const fam = state.relations.filter((r) => r.kind === 'padre' || r.kind === 'pareja');
  const inFam = all.filter((e) => fam.some((r) => r.a === e.ref || r.b === e.ref));
  if (!inFam.length) return h('div', { class: 'empty' }, h('h3', {}, 'Sin familias todavía'), h('p', {}, 'Añade relaciones «es padre o madre de» y «es pareja de» para ver el árbol.'));
  const root = inFam.some((e) => e.ref === state.treeRoot) ? state.treeRoot : inFam[0].ref;
  // generación de cada miembro de la familia (padres arriba, hijos abajo, parejas en la misma fila)
  const gen = new Map([[root, 0]]);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    for (const r of fam) {
      const next = r.a === cur ? r.b : r.b === cur ? r.a : null;
      if (!next || gen.has(next) || !byRef.has(next)) continue;
      gen.set(next, gen.get(cur) + (r.kind === 'pareja' ? 0 : r.a === cur ? 1 : -1));
      queue.push(next);
    }
  }
  const rows = new Map();
  [...gen.entries()].sort((x, y) => x[1] - y[1]).forEach(([ref, g]) => { if (!rows.has(g)) rows.set(g, []); rows.get(g).push(ref); });
  // dentro de una fila, las parejas juntas
  for (const [g, refs] of rows) {
    const ordered = [];
    for (const ref of refs) {
      if (ordered.includes(ref)) continue;
      ordered.push(ref);
      fam.filter((r) => r.kind === 'pareja' && (r.a === ref || r.b === ref)).forEach((r) => { const o = r.a === ref ? r.b : r.a; if (refs.includes(o) && !ordered.includes(o)) ordered.push(o); });
    }
    rows.set(g, ordered);
  }
  const gens = [...rows.keys()].sort((a, b) => a - b);
  const colW = 170; const rowH = 130;
  const width = Math.max(...[...rows.values()].map((r) => r.length)) * colW + 40;
  const height = gens.length * rowH + 40;
  const pos = new Map();
  gens.forEach((g, gi) => {
    const refs = rows.get(g);
    const off = (width - refs.length * colW) / 2;
    refs.forEach((ref, i) => pos.set(ref, { x: off + i * colW + colW / 2, y: 40 + gi * rowH + 20 }));
  });
  const lines = fam.filter((r) => pos.has(r.a) && pos.has(r.b)).map((r) => {
    const a = pos.get(r.a); const b = pos.get(r.b);
    if (r.kind === 'pareja') return svg('g', {}, svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#ff7ab8', 'stroke-width': 3 }),
      svg('text', { x: (a.x + b.x) / 2, y: a.y - 8, 'text-anchor': 'middle', class: 'rel-emoji small' }, '💞'));
    const midY = (a.y + b.y) / 2;
    return svg('path', { d: `M${a.x},${a.y + 26} V${midY} H${b.x} V${b.y - 26}`, fill: 'none', stroke: '#e2b456', 'stroke-width': 2.5 });
  });
  const nodes = [...pos.entries()].map(([ref, p]) => {
    const ent = byRef.get(ref);
    const g = svg('g', { class: `rel-node ${ref === root ? 'focus' : ''}`, transform: `translate(${p.x},${p.y})` },
      svg('circle', { r: 24, fill: ent.color || '#555' }), svg('text', { y: 8, 'text-anchor': 'middle', class: 'rel-emoji' }, ent.icon),
      svg('text', { y: 44, 'text-anchor': 'middle', class: 'rel-name' }, ent.name));
    g.addEventListener('click', () => { state.treeRoot = ref; redraw(); });
    g.addEventListener('dblclick', () => openRef(ref));
    return g;
  });
  return h('div', { class: 'stack-sm' },
    field('Familia de', selectEl(inFam.map((e) => [e.ref, `${e.icon} ${e.name}`]), root, (v) => { state.treeRoot = v; redraw(); }, { class: 'mini-sel', 'aria-label': 'Familia de' })),
    h('div', { class: 'rel-canvas' }, svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'rel-svg tree', style: `max-width: ${width}px`, role: 'img', 'aria-label': 'Árbol familiar' }, lines, nodes)));
}
