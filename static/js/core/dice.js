// Tiradas: se resuelven en el servidor (registro compartido) y se muestran como aviso.
import { api } from './api.js';
import { h, toast, toastError } from './dom.js';

const listeners = new Set();
export const onRoll = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function describe(r) {
  return r.parts.map((p) => {
    if (!p.rolls) return p.term;
    const dice = p.rolls.map((v, i) => (p.kept.includes(i) ? v : `~${v}~`)).join(', ');
    return `${p.term.replace(/^\+/, '')} [${dice}]`;
  }).join(' ');
}

export async function roll(expr, { label = '', mode = '', who = 'DM', secret = false, quiet = false } = {}) {
  try {
    const r = await api.post('/api/roll', { expr, label, mode, who, secret });
    if (!quiet) showRoll(r);
    listeners.forEach((fn) => fn(r));
    return r;
  } catch (e) {
    toastError(e);
    return null;
  }
}

export function showRoll(r) {
  const tag = r.crit === 'critico' ? h('span', { class: 'crit' }, ' ¡CRÍTICO!')
    : r.crit === 'pifia' ? h('span', { class: 'fumble' }, ' ¡Pifia!') : null;
  const mode = r.mode === 'adv' ? ' (ventaja)' : r.mode === 'dis' ? ' (desventaja)' : '';
  toast([
    h('div', { class: 'small muted' }, `${r.label || r.expr}${mode}${r.secret ? ' · secreta' : ''}`),
    h('div', {}, h('span', { class: 'big' }, r.total), tag),
    h('div', { class: 'small muted' }, describe(r)),
  ], { ms: 5000 });
}
