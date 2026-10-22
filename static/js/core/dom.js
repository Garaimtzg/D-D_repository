// Utilidades de interfaz: creación de elementos, iconos, avisos, modales, campos enlazados
// y piezas visuales reutilizables (tokens, anillos de PG, escudo de CA, números flotantes).

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'innerHTML') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

// -- Iconos (trazos de 24×24) ----------------------------------------------------
const ICONS = {
  mesa: '<path d="M2.5 9.5h19"/><path d="M4 9.5 5.5 20M20 9.5 18.5 20M7 14h10"/><path d="M12 2.8l3.6 2.1v4.2L12 11.2 8.4 9.1V4.9z"/>',
  personajes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c3 0 5.5 2 5.5 5"/>',
  combate: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m11 19-6-6M8 16l-4 4M5 21l-2-2"/>',
  mapas: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  juegos: '<path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5v1a3.5 3.5 0 0 1-6.3 2.1L14.5 14h-5l-1.2 1.6A3.5 3.5 0 0 1 2 13.5v-1A4.5 4.5 0 0 1 6.5 8z"/><path d="M7 10.5v3M5.5 12h3M15.5 11h.01M17.5 13h.01"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  brush: '<path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8 8.2 13z"/><path d="M7.5 14c-2 0-3.5 1.6-3.5 3.5 0 1.3-.7 2.2-2 2.5 1 .9 2.4 1.5 4 1.5 2.5 0 4.5-2 4.5-4.5z"/>',
  bucket: '<path d="M19 11 11 3 3 11l8 8z"/><path d="M3 11h16M21 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z"/>',
  eraser: '<path d="M20 20H8l-5-5a2 2 0 0 1 0-2.8L12.2 3a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L12 20"/><path d="M6 11l7 7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  dados: '<path d="M12 2 20.7 7v10L12 22l-8.7-5V7Z"/><path d="M12 7.2 16.8 15H7.2Z"/><path d="M12 2v5.2M20.7 7l-3.9 8M3.3 7l3.9 8M12 22l-4.8-7M12 22l4.8-7"/>',
  herramientas: '<path d="M14.7 6.3a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="M5 3l3 3-2 2-3-3M8 6l3 3"/>',
  notas: '<path d="M8 21h10a2 2 0 0 0 2-2V5"/><path d="M4 5a2 2 0 1 1 4 0v14a2 2 0 1 1-4 0"/><path d="M8 3h10a2 2 0 0 1 2 2M11 9h6M11 13h6M11 17h4"/>',
  musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  reglas: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M9 7h7M9 11h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.9-1.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.3-9.4C1.5 7.4 3.7 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.3 0 5.5 3.4 4.3 6.6C19.5 15.4 12 20 12 20z"/>',
  shield: '<path d="M12 2.5 20 5.5v6.2c0 5-3.4 8.4-8 9.8-4.6-1.4-8-4.8-8-9.8V5.5z"/>',
  sword: '<path d="M14.5 3.5H20.5V9.5L9 21 3 15z"/><path d="M5 13l6 6M3 21l3-3"/>',
  skull: '<path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.4 1.1 4.2 3 5.4V19h2v2h6v-2h2v-3.1c1.9-1.2 3-3 3-5.4C20 6.2 16.4 3 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M11 15h2"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 4.5v15M16 4.5v15"/>',
  next: '<path d="M5 5l10 7-10 7zM19 5v14"/>',
  prev: '<path d="M19 5 9 12l10 7zM5 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="M4 12.5 9.5 18 20 6"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-6.6 0-3.6-2.4-5.6-3.8-8.4-.6 1.8-1.7 3-3.2 3.6.3-3.3-1-6.5-3.5-8.6.4 3.4-1.6 5.6-3 7.3C4.3 10.8 5 12.3 5 15.4 5 19.3 8 22 12 22z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  pin: '<path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11z"/><circle cx="12" cy="10" r="2.3"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  wand: '<path d="M4 20 15 9M13 7l4 4"/><path d="M18 2v3M18 9v3M14.5 5.5h-3M24.5 5.5h-3M20.5 3.5l1.5-1.5M15.5 8.5 14 10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  aura: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 2.6"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="1 3"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  scroll: '<path d="M7 3h11a3 3 0 0 1 0 6h-2"/><path d="M16 9v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3"/><path d="M7 3a3 3 0 0 0-3 3v11M9 8h4M9 12h4"/>',
  book: '<path d="M12 6c-2-2-5-2.5-9-2v15c4-.5 7 0 9 2 2-2 5-2.5 9-2V4c-4-.5-7 0-9 2zM12 6v15"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V10M14 10V5a1.5 1.5 0 0 1 3 0v8c0 4.4-2.6 8-7 8-3 0-4.5-1.5-6.4-4.2L2 14a1.6 1.6 0 0 1 2.6-1.8L8 15"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  tavern: '<path d="M5 9h11v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M6 9c-1.5-2 0-5 2.5-4.5C9 3 11.5 2.5 13 4c2-.5 3.5 1.5 3 5"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.6 10 4 4 0 0 1 18 18z"/>',
  feather: '<path d="M20.2 3.8a6 6 0 0 0-8.5 0L5 10.5V19h8.5l6.7-6.7a6 6 0 0 0 0-8.5zM16 8 2 22M17.5 15H9"/>',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || name;
  return svg;
}

// Icono de un dado (d4…d100), el mismo que usa el motor 3D.
export function dieIcon(sides, size = 26) {
  const span = document.createElement('span');
  span.innerHTML = window.Dice3D.icon(sides, size);
  return span.firstChild;
}

// -- Avisos ------------------------------------------------------------------------
export function toast(content, { kind = '', ms = 3800, iconName } = {}) {
  const box = document.getElementById('toasts') || document.body.appendChild(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  const ic = iconName || (kind === 'error' ? 'close' : kind === 'good' ? 'check' : 'sparkle');
  const t = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, icon(ic), h('div', { class: 'grow' }, content));
  box.append(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 320); }, ms);
  return t;
}

export const toastError = (err) => toast(err?.message || String(err), { kind: 'error', ms: 6000 });

// -- Modales -----------------------------------------------------------------------
export function modal(title, body, actions = [{ label: 'Cerrar', value: null }], { wide = false, iconName } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close(null) },
      h('div', { class: `panel ornate modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'panel-head' }, h('h3', {}, iconName && icon(iconName), title),
          h('div', { class: 'actions' }, h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Cerrar', onclick: () => close(null) }, icon('close', 18)))),
        body,
        actions.length > 0 && h('div', { class: 'actions' }, actions.map((a) =>
          h('button', { class: `btn ${a.class || ''}`, type: 'button', onclick: () => close(typeof a.value === 'function' ? a.value() : a.value) }, a.icon && icon(a.icon), a.label)))));
    document.body.append(back);
    document.addEventListener('keydown', onKey);
    (back.querySelector('input:not([type=checkbox]),select,textarea') || back.querySelector('.actions .primary'))?.focus();
  });
}

export const confirmDialog = (text, okLabel = 'Eliminar') =>
  modal('¿Seguro?', h('p', {}, text), [
    { label: 'Cancelar', value: false },
    { label: okLabel, value: true, class: 'danger', icon: 'trash' },
  ], { iconName: 'skull' });

export async function promptDialog(title, label, initial = '') {
  const input = h('input', { value: initial });
  const form = h('label', { class: 'field' }, label, input);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') form.closest('.modal').querySelector('.actions .primary').click(); });
  return modal(title, form, [
    { label: 'Cancelar', value: null },
    { label: 'Aceptar', value: () => input.value.trim(), class: 'primary', icon: 'check' },
  ], { iconName: 'edit' });
}

// -- Campos enlazados a un objeto ----------------------------------------------------
// bind(obj, 'hp', { type: 'number', onChange }) crea un input que escribe en obj.hp.
export function bind(obj, key, { type = 'text', onChange, onCommit, ...attrs } = {}) {
  const isNum = type === 'number';
  const tag = type === 'textarea' ? 'textarea' : 'input';
  const el = h(tag, { type: tag === 'input' ? type : null, ...attrs });
  if (type === 'checkbox') el.checked = !!obj[key];
  else el.value = obj[key] ?? '';
  el.addEventListener(type === 'checkbox' ? 'change' : 'input', () => {
    obj[key] = type === 'checkbox' ? el.checked : isNum ? (el.value === '' ? null : Number(el.value)) : el.value;
    onChange?.(obj[key]);
  });
  if (onCommit) el.addEventListener('change', () => onCommit(obj[key]));
  return el;
}

export function field(label, control, cls = '') {
  return h('label', { class: `field ${cls}` }, label, control);
}

export function selectEl(options, value, onChange, attrs = {}) {
  const el = h('select', attrs, options.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: String(v) === String(value) }, l);
  }));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

// options: [[valor, etiqueta, contador?], …]
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const draw = (cur) => clear(wrap, options.map(([v, l, n]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === cur), onclick: () => { draw(v); onChange(v); } },
      l, n != null && h('span', { class: 'count' }, n))));
  draw(value);
  return wrap;
}

export function searchBox(placeholder, onInput, value = '') {
  const input = h('input', { type: 'search', placeholder, value, 'aria-label': placeholder, oninput: () => onInput(input.value) });
  return h('div', { class: 'search' }, icon('search'), input);
}

// -- Piezas visuales -------------------------------------------------------------------
export function hpBar(hp, max, temp = 0) {
  const total = Math.max(1, max || 1);
  const ratio = Math.max(0, Math.min(1, (hp || 0) / total));
  const cls = ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : '';
  return h('div', { class: `hpbar ${cls}`, role: 'meter', 'aria-valuenow': hp || 0, 'aria-valuemax': total, 'aria-label': 'Puntos de golpe' },
    h('i', { style: { width: `${ratio * 100}%` } }),
    temp > 0 && h('b', { style: { width: `${Math.min(1, temp / total) * 100}%`, left: `${ratio * 100}%` } }));
}

export const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// -- Aspecto: una cara sencilla y complementos graciosos (sombreros, gafas, ropa, algo en la mano) --
// ch.look = { base: 'cara' | 'iniciales', skin, hair, hairColor, expr, hat, face, outfit, item }.
// Los complementos son emoji o, si el nombre está en HAT_SVG / FACE_SVG, un dibujo propio.
export const SKINS = ['#ffdbb4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#9ccf8a', '#93b4e8', '#c9a0dc', '#e8e8e8'];
export const HAIR_COLORS = ['#2b1d14', '#6b3e1f', '#b5651d', '#e8c26e', '#d9d9d9', '#c0392b', '#3b6fd1', '#8e44ad', '#1f8a4c', '#ff7ab8'];
export const HAIRS = [['', 'Calvo'], ['corto', 'Corto'], ['largo', 'Largo'], ['rizos', 'Rizos'], ['cresta', 'Cresta'], ['mono', 'Moño']];
export const EXPRESSIONS = [['normal', '🙂'], ['feliz', '😄'], ['picaro', '😏'], ['enfadado', '😠'], ['sorpresa', '😮'], ['dormido', '😴'], ['loco', '🤪']];
const HAT_SVG = {
  mago: '<path d="M22,86 Q36,52 54,6 Q60,40 78,86Z" fill="#4b3aa8"/><path d="M8,86 Q50,72 92,86 Q50,98 8,86Z" fill="#33277a"/><path d="M30,75 Q50,69 70,75" stroke="#f2c14e" stroke-width="5" fill="none"/><circle cx="46" cy="46" r="3" fill="#f2c14e"/><circle cx="58" cy="60" r="2.4" fill="#f2c14e"/><circle cx="52" cy="27" r="2" fill="#f2c14e"/>',
  fiesta: '<path d="M32,88 L52,10 L70,88Z" fill="#ff5fa2"/><path d="M39,66 L64,66 M45,42 L58,42" stroke="#ffe35a" stroke-width="6"/><circle cx="52" cy="9" r="7" fill="#5bd1ff"/>',
  vikingo: '<path d="M26,66 Q4,58 6,24 Q16,52 32,58Z" fill="#f4ecd8"/><path d="M74,66 Q96,58 94,24 Q84,52 68,58Z" fill="#f4ecd8"/><path d="M24,86 Q24,46 50,44 Q76,46 76,86Z" fill="#a7b0ba"/><path d="M50,46 L50,80" stroke="#7d868f" stroke-width="3"/><rect x="22" y="78" width="56" height="9" rx="3" fill="#7b5a34"/>',
  pirata: '<path d="M18,76 Q30,38 50,36 Q70,38 82,76 Q50,66 18,76Z" fill="#2a2424"/><path d="M4,84 Q20,62 50,60 Q80,62 96,84 Q74,76 50,78 Q26,76 4,84Z" fill="#1f1b1b"/><circle cx="50" cy="52" r="6" fill="#f4ecd8"/><path d="M45,61 L55,67 M55,61 L45,67" stroke="#f4ecd8" stroke-width="2.5"/>',
  cocinero: '<path d="M30,68 Q12,64 16,44 Q20,28 36,34 Q38,14 56,18 Q72,12 78,32 Q94,40 84,60 Q78,68 70,68Z" fill="#fff" stroke="#cfcfcf" stroke-width="2"/><rect x="30" y="66" width="40" height="22" rx="3" fill="#fff" stroke="#cfcfcf" stroke-width="2"/>',
  bufon: '<path d="M18,86 Q20,50 8,30 Q34,40 50,62 Q66,40 92,30 Q80,50 82,86Z" fill="#c0392b"/><path d="M50,62 Q44,30 50,8 Q58,32 50,62Z" fill="#2e7dd1"/><path d="M18,86 Q50,74 82,86 L82,91 Q50,80 18,91Z" fill="#f2c14e"/><circle cx="8" cy="30" r="5" fill="#f2c14e"/><circle cx="92" cy="30" r="5" fill="#f2c14e"/><circle cx="50" cy="8" r="5" fill="#f2c14e"/>',
};
const FACE_SVG = { // en coordenadas de la cara (0-100); bigote y barba toman el color del pelo
  bigote: '<path d="M33,63 Q41,55 50,60 Q59,55 67,63 Q61,61 56,64 Q50,61 44,64 Q39,61 33,63Z" fill="currentColor" stroke="rgba(40,20,10,.55)" stroke-width="1.4"/>',
  barba: '<path d="M21,56 Q23,90 50,92 Q77,90 79,56 Q70,75 50,75 Q30,75 21,56Z" fill="currentColor" stroke="rgba(40,20,10,.45)" stroke-width="1.4"/>',
  monoculo: '<circle cx="60" cy="53" r="8.5" fill="rgba(200,230,255,.3)" stroke="#d4a63c" stroke-width="2.5"/><path d="M67,59 Q71,72 65,88" stroke="#d4a63c" stroke-width="1.3" fill="none"/>',
  parche: '<path d="M22,41 L78,63" stroke="#111" stroke-width="2.5"/><ellipse cx="60" cy="53" rx="8.5" ry="7.5" fill="#111"/>',
  payaso: '<circle cx="50" cy="60" r="6.5" fill="#e3262e"/><circle cx="48" cy="58" r="2" fill="#fff" opacity=".6"/>',
  gafas: '<g fill="rgba(255,255,255,.18)" stroke="#2a2a2a" stroke-width="2.6"><circle cx="40" cy="53" r="8"/><circle cx="60" cy="53" r="8"/></g><path d="M48,53 Q50,50 52,53" stroke="#2a2a2a" stroke-width="2.6" fill="none"/>',
};
export const LOOK_SLOTS = {
  hat: ['mago', 'fiesta', 'vikingo', 'pirata', 'cocinero', 'bufon', '🎩', '👑', '🎓', '🧢', '👒', '⛑️', '🪖', '🎀', '🍳', '🪣', '🦆', '🐸', '🍕', '🎃', '🌻', '🧁', '🍌', '🐙'],
  face: ['bigote', 'barba', 'monoculo', 'parche', 'payaso', 'gafas', '🕶️', '🥽', '🎭'],
  outfit: ['🎀', '👔', '🧣', '🦺', '👘', '👗', '🥻', '🧥', '🏅', '📿', '🩱', '🩲'],
  item: ['🦆', '🍺', '🍗', '🐟', '🥖', '🌹', '🧀', '🍄', '🐔', '🎈', '🍭', '🧸', '🪄', '🗡️', '🥄', '🧹', '🐈', '🐉', '🥕', '🪕', '📜', '💩'],
};
export const LOOK_NAMES = {
  mago: 'Sombrero de mago', fiesta: 'Gorro de fiesta', vikingo: 'Casco vikingo', pirata: 'Sombrero pirata', cocinero: 'Gorro de cocinero', bufon: 'Gorro de bufón',
  bigote: 'Bigote', barba: 'Barba', monoculo: 'Monóculo', parche: 'Parche', payaso: 'Nariz de payaso', gafas: 'Gafas redondas',
};
const EYE = 'stroke="#3a2414" stroke-width="3.6" stroke-linecap="round" fill="none"';
const dot = (x, y, r = 3.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3a2414"/>`;
const EXPR_SVG = {
  normal: `${dot(40, 53)}${dot(60, 53)}<path d="M41,65 Q50,72 59,65" ${EYE}/>`,
  feliz: `<path d="M35,55 Q40,48 45,55 M55,55 Q60,48 65,55" ${EYE}/><path d="M39,63 Q50,78 61,63Z" fill="#7a2a20"/>`,
  picaro: `<path d="M35,53 L45,53" ${EYE}/>${dot(60, 53)}<path d="M42,67 Q53,71 61,62" ${EYE}/>`,
  enfadado: `${dot(40, 54)}${dot(60, 54)}<path d="M33,45 L46,49 M67,45 L54,49 M42,69 Q50,63 58,69" ${EYE}/>`,
  sorpresa: `${dot(40, 52, 4.6)}${dot(60, 52, 4.6)}<ellipse cx="50" cy="68" rx="4.5" ry="5.5" fill="#3a2414"/>`,
  dormido: `<path d="M35,53 Q40,57 45,53 M55,53 Q60,57 65,53" ${EYE}/>${dot(50, 67, 2.6)}<text x="70" y="32" font-size="15" font-weight="700" fill="#fff">z</text>`,
  loco: `<circle cx="40" cy="52" r="5.5" fill="#fff" stroke="#3a2414" stroke-width="2"/>${dot(41, 53, 2.2)}${dot(60, 53, 3)}<path d="M40,64 Q50,71 60,64" ${EYE}/><ellipse cx="54" cy="70" rx="4" ry="5" fill="#ff7a8a"/>`,
};
const HAIR_BACK = {
  largo: (c) => `<path d="M17,52 Q15,20 50,18 Q85,20 83,52 L86,86 Q76,92 70,80 L30,80 Q24,92 14,86Z" fill="${c}"/>`,
  rizos: (c) => Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.05 + i * 0.1125); return `<circle cx="${(50 + Math.cos(a) * 31).toFixed(1)}" cy="${(52 + Math.sin(a) * 31).toFixed(1)}" r="11" fill="${c}"/>`; }).join(''),
};
const HAIR_TOP = {
  corto: (c) => `<path d="M19,52 Q17,22 50,21 Q83,22 81,52 Q74,38 60,36 Q50,42 38,36 Q26,40 19,52Z" fill="${c}"/>`,
  largo: (c) => HAIR_TOP.corto(c),
  cresta: (c) => `<path d="M40,32 L44,6 L50,26 L55,3 L58,27 L65,9 L62,33 Q50,26 40,32Z" fill="${c}"/>`,
  mono: (c) => `<circle cx="50" cy="15" r="10" fill="${c}"/><path d="M20,50 Q18,24 50,23 Q82,24 80,50 Q66,32 50,32 Q34,32 20,50Z" fill="${c}"/>`,
};
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(cls, inner, color) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('viewBox', '0 0 100 100');
  s.setAttribute('aria-hidden', 'true');
  if (color) s.style.color = color;
  s.innerHTML = inner;
  return s;
}
function faceSvg(look) {
  const hc = look.hairColor || HAIR_COLORS[0];
  const skin = look.skin || SKINS[1];
  return svgEl('face-svg', (HAIR_BACK[look.hair]?.(hc) || '')
    + `<circle cx="50" cy="55" r="31" fill="${skin}"/><ellipse cx="33" cy="63" rx="5" ry="3" fill="#ff6b6b" opacity=".3"/><ellipse cx="67" cy="63" rx="5" ry="3" fill="#ff6b6b" opacity=".3"/>`
    + (HAIR_TOP[look.hair]?.(hc) || '') + (EXPR_SVG[look.expr] || EXPR_SVG.normal));
}
// Un complemento suelto (para el avatar o para los botones del editor).
export function lookPiece(slot, key, look = {}) {
  if (!key) return null;
  if (slot === 'hat' && HAT_SVG[key]) return svgEl('acc hat svg', HAT_SVG[key]);
  if (slot === 'face' && FACE_SVG[key]) return svgEl('acc face-svg', FACE_SVG[key], look.hairColor || HAIR_COLORS[0]);
  return h('span', { class: `acc ${slot}` }, key);
}
export const hasExtras = (look) => !!(look && (look.hat || look.face || look.outfit || look.item));
export function randomLook(extras = true) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const maybe = (a, p) => (extras && Math.random() < p ? pick(a) : '');
  return {
    base: 'cara', skin: pick(SKINS.slice(0, 6)), hair: pick(HAIRS)[0], hairColor: pick(HAIR_COLORS.slice(0, 6)), expr: pick(EXPRESSIONS)[0],
    hat: maybe(LOOK_SLOTS.hat, 0.7), face: maybe(LOOK_SLOTS.face, 0.35), outfit: maybe(LOOK_SLOTS.outfit, 0.5), item: maybe(LOOK_SLOTS.item, 0.6),
  };
}

export function avatar(ch, cls = '') {
  const look = ch.look || {};
  const face = look.base === 'cara' && !ch.portrait;
  const el = h('span', { class: `avatar ${cls} ${face ? 'is-face' : ''}`, style: { '--c': ch.color || '#666' } });
  if (ch.portrait) el.style.backgroundImage = `url("${ch.portrait}")`;
  else if (face) el.append(faceSvg(look));
  else el.textContent = initials(ch.name);
  for (const slot of ['face', 'outfit', 'item', 'hat']) { const p = lookPiece(slot, look[slot], look); if (p) el.append(p); }
  return el;
}

const hpColor = (r) => (r > 0.5 ? '#5fd394' : r > 0.25 ? '#f0b648' : '#ef5a4c');

// Token redondo con anillo de PG, como una miniatura sobre la mesa.
export function token(ch, { size = 52, hp = ch.hp, max = ch.maxHp, showHp = true } = {}) {
  const ratio = Math.max(0, Math.min(1, (hp ?? 0) / Math.max(1, max ?? 1)));
  const stroke = Math.max(3, size * 0.08);
  const rad = size / 2 - stroke / 2;
  const circ = 2 * Math.PI * rad;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('class', 'ring');
  ring.setAttribute('width', size);
  ring.setAttribute('height', size);
  ring.innerHTML = `<circle cx="${size / 2}" cy="${size / 2}" r="${rad}" stroke="rgba(0,0,0,.55)" stroke-width="${stroke}"/>`
    + (showHp ? `<circle cx="${size / 2}" cy="${size / 2}" r="${rad}" stroke="${hpColor(ratio)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - ratio)}"/>` : '');
  const av = avatar(ch);
  const inner = size - stroke * 2 - 4;
  Object.assign(av.style, { width: `${inner}px`, height: `${inner}px`, fontSize: `${Math.max(10, inner * 0.36)}px` });
  av.style.setProperty('--s', `${inner}px`);
  return h('span', { class: `token ${showHp && (hp ?? 1) <= 0 ? 'dead' : ''}`, style: { width: `${size}px`, height: `${size}px` } }, ring, av);
}

// Escudo con la Clase de Armadura.
export function shield(ac, label = 'CA') {
  const el = h('span', { class: 'shield', 'data-tip': `Clase de Armadura ${ac}` });
  el.innerHTML = `<svg viewBox="0 0 48 54" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a2a"/><stop offset="1" stop-color="#211810"/></linearGradient></defs>
    <path d="M24 2 44 8.5v15.2C44 37 35.5 46 24 51 12.5 46 4 37 4 23.7V8.5z" fill="url(#sg)" stroke="#c9963f" stroke-width="2"/>
    <path d="M24 7 39.5 12v11.6C39.5 34 33 41.4 24 45.6 15 41.4 8.5 34 8.5 23.6V12z" fill="none" stroke="rgba(226,180,86,.3)" stroke-width="1"/></svg>`;
  append(el, [h('span', {}, ac ?? '–'), h('small', {}, label)]);
  return el;
}

// Número que sube y se desvanece sobre un elemento (daño, curación…).
export function floatNum(target, text, kind = 'dmg') {
  const r = (target instanceof Element ? target : document.body).getBoundingClientRect();
  const el = h('div', { class: `float-num ${kind}`, style: { left: `${r.left + r.width / 2}px`, top: `${r.top + Math.min(r.height / 2, 40)}px` } }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 1300);
  if (target instanceof Element) {
    const cls = kind === 'dmg' ? 'shake' : 'flash-heal';
    target.classList.remove(cls);
    void target.offsetWidth; // reinicia la animación
    target.classList.add(cls);
  }
}

export function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function pickFiles(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple });
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}

// Zona donde soltar ficheros (además del botón de subir).
export function dropZone(el, onFiles) {
  el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('over'); } });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
  el.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    el.classList.remove('over');
    onFiles([...e.dataTransfer.files]);
  });
  return el;
}

// Guardado en el navegador para preferencias de esta pantalla (no para datos de la campaña).
export const prefs = {
  get(key, fallback) { try { const v = localStorage.getItem(`dnd.${key}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`dnd.${key}`, JSON.stringify(value)); } catch { /* sin almacenamiento */ } },
};

// Cartel grande y breve para los momentos importantes («¡A las armas!», «¡Victoria!»…).
export function bigBanner(title, sub = '', kind = 'gold', iconName = 'crown') {
  const el = h('div', { class: `big-banner ${kind}`, role: 'status' },
    h('div', { class: 'bb-inner' }, h('span', { class: 'bb-icon' }, icon(iconName, 54)), h('b', {}, title), sub && h('small', {}, sub)));
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// Globos de ayuda para todo lo que tenga data-tip. Es un único elemento flotante encima de todo,
// así ningún panel con desplazamiento o recorte (la barra lateral, el tablero…) lo corta.
export function initTooltips() {
  const tip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
  document.body.append(tip);
  let cur = null;
  let timer = null;
  const hide = () => { cur = null; tip.hidden = true; clearInterval(timer); };
  function place(el) {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const m = 8; const vw = window.innerWidth; const vh = window.innerHeight;
    let pos = el.dataset.tipPos || 'above';
    if (pos === 'above' && r.top - t.height - m < 4) pos = 'below';
    if (pos === 'below' && r.bottom + t.height + m > vh - 4) pos = 'above';
    if (pos === 'right' && r.right + t.width + m > vw - 4) pos = 'above';
    let x = pos === 'right' ? r.right + m + 2 : r.left + r.width / 2 - t.width / 2;
    let y = pos === 'right' ? r.top + r.height / 2 - t.height / 2 : pos === 'below' ? r.bottom + m : r.top - t.height - m;
    x = Math.max(6, Math.min(vw - t.width - 6, x));
    y = Math.max(6, Math.min(vh - t.height - 6, y));
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
    tip.dataset.pos = pos;
  }
  function show(el) {
    const text = el.getAttribute('data-tip');
    if (!text) return hide();
    cur = el;
    tip.textContent = text;
    tip.hidden = false;
    tip.classList.remove('in');
    void tip.offsetWidth;
    tip.classList.add('in');
    place(el);
    clearInterval(timer);
    timer = setInterval(() => { if (!cur?.isConnected) hide(); }, 300); // la vista se volvió a pintar
  }
  const track = (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (el === cur) return;
    if (el) show(el); else hide();
  };
  document.addEventListener('pointerover', track);
  document.addEventListener('pointermove', track, { passive: true });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('wheel', hide, { passive: true, capture: true });
  document.addEventListener('focusin', (e) => { if (e.target.matches?.(':focus-visible') && e.target.closest('[data-tip]')) show(e.target.closest('[data-tip]')); });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
}
