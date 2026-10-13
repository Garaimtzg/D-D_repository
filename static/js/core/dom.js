// Utilidades de interfaz: creación de elementos, avisos, modales y campos enlazados.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
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

export function icon(path, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = path;
  return svg;
}

// -- Avisos -----------------------------------------------------------------
export function toast(content, { kind = '', ms = 3500 } = {}) {
  let box = document.getElementById('toasts');
  if (!box) box = document.body.appendChild(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  const t = h('div', { class: `toast ${kind}` }, content);
  box.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

export const toastError = (err) => toast(err?.message || String(err), { kind: 'error', ms: 5000 });

// -- Modales ----------------------------------------------------------------
export function modal(title, body, actions = [{ label: 'Cerrar', value: null }]) {
  return new Promise((resolve) => {
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close(null) },
      h('div', { class: 'card modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h3', {}, title), body,
        h('div', { class: 'actions' }, actions.map((a) =>
          h('button', { class: `btn ${a.class || ''}`, type: 'button', onclick: () => close(typeof a.value === 'function' ? a.value() : a.value) }, a.label)))));
    document.body.append(back);
    document.addEventListener('keydown', onKey);
    back.querySelector('input,select,textarea,button.primary')?.focus();
  });
}

export const confirmDialog = (text, okLabel = 'Eliminar') =>
  modal('¿Seguro?', h('p', {}, text), [
    { label: 'Cancelar', value: false },
    { label: okLabel, value: true, class: 'danger' },
  ]);

export async function promptDialog(title, label, initial = '') {
  const input = h('input', { value: initial });
  const form = h('label', { class: 'field' }, label, input);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') form.closest('.modal').querySelector('.primary').click(); });
  return modal(title, form, [
    { label: 'Cancelar', value: null },
    { label: 'Aceptar', value: () => input.value.trim(), class: 'primary' },
  ]);
}

// -- Campos enlazados a un objeto --------------------------------------------
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

export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const draw = (cur) => clear(wrap, options.map(([v, l]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === cur), onclick: () => { draw(v); onChange(v); } }, l)));
  draw(value);
  return wrap;
}

export function hpBar(hp, max) {
  const ratio = Math.max(0, Math.min(1, (hp || 0) / Math.max(1, max || 1)));
  const cls = ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : '';
  return h('div', { class: `hpbar ${cls}` }, h('i', { style: { width: `${ratio * 100}%` } }));
}

export function avatar(ch) {
  const initials = (ch.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const el = h('span', { class: 'avatar', style: { backgroundColor: ch.color || '#555' } });
  if (ch.portrait) el.style.backgroundImage = `url("${ch.portrait}")`;
  else el.textContent = initials;
  return el;
}

export function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function pickFiles(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple });
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}
