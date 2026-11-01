// Pantalla de jugadores en otro ordenador (static/jugadores.html, servida por server/remote.py).
// Pide el código que ve el máster, monta la Mesa en modo jugadores y la mantiene al día con lo que el servidor deja
// ver. Aquí no se guarda nada en la partida: solo se mira y, si el máster lo permite, se tiran dados (siempre públicos).
// El servidor contesta «/api/jugadores?v=…» cuando algo cambia (o a los 20 s), así que no se pregunta a lo loco.
import { h, clear, icon, initTooltips } from './core/dom.js';
import mesa from './views/mesa.js';

const COOKIE = 'mesa_codigo';
const view = document.getElementById('view');
const host = h('div', { class: 'view view-mesa' });
const curtain = h('div', { class: 'remote-curtain', hidden: true, 'aria-live': 'polite' });
const status = h('div', { class: 'remote-status', role: 'status' });
const fullBtn = h('button', { class: 'btn sm remote-full', type: 'button', 'data-tip': 'Pantalla completa (Esc para salir)', 'data-tip-pos': 'below',
  onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}) }, icon('fullscreen', 16));
view.append(host);
document.body.append(curtain, status, fullBtn);

const listeners = new Set();
let version = '';
let mounted = false;
let mounting = null;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const hasCode = () => document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE}=`));
function setCode(code) {
  document.cookie = `${COOKIE}=${encodeURIComponent(code.trim().toUpperCase())}; path=/; max-age=31536000; SameSite=Strict`;
}

// El enlace que copia el máster lleva el código (?c=…): se guarda y se quita de la barra de direcciones.
const fromUrl = new URLSearchParams(location.search).get('c');
if (fromUrl) {
  setCode(fromUrl);
  history.replaceState(null, '', location.pathname);
}

// ------------------------------------------------------------------ estado de la conexión
function setStatus(kind) {
  status.className = `remote-status ${kind}`;
  clear(status, h('i'), kind === 'ok' ? 'Conectado con la mesa' : kind === 'lost' ? 'Sin conexión con la mesa · reintentando…' : 'Conectando…');
}
setStatus('wait');

// El botón de pantalla completa y el indicador se apartan cuando no se mueve el ratón.
let idle = 0;
const wake = () => { document.body.classList.remove('remote-idle'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('remote-idle'), 3500); };
['pointermove', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
wake();

// ------------------------------------------------------------------ código del máster
function askCode(wrong) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'remote-code-in', maxlength: 6, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: '······', 'aria-label': 'Código de la mesa', oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } });
    const form = h('form', { class: 'remote-gate', onsubmit: (e) => {
      e.preventDefault();
      if (input.value.length < 6) { input.focus(); return; }
      setCode(input.value);
      form.remove();
      resolve();
    } },
    h('div', { class: 'remote-gate-card' },
      h('div', { class: 'remote-crest' }, '⚔️'),
      h('h1', {}, 'Pantalla de jugadores'),
      h('p', {}, 'Escribe el código que ve el máster en la Mesa, en ', h('b', {}, '📡 Pantalla de jugadores'), '.'),
      input,
      wrong && h('p', { class: 'remote-gate-err' }, 'Ese código no vale (o el máster ha puesto uno nuevo).'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Entrar en la mesa')));
    document.body.append(form);
    setTimeout(() => input.focus(), 50);
  });
}

// ------------------------------------------------------------------ espera y negro
function drawCurtain(b) {
  const on = b.screen !== 'mesa';
  curtain.hidden = !on;
  curtain.className = `remote-curtain ${b.screen}`;
  if (b.screen === 'espera') {
    clear(curtain, h('div', { class: 'remote-wait' },
      b.wait?.image && h('img', { class: 'remote-wait-img', src: b.wait.image, alt: '' }),
      h('h1', {}, b.campaign || 'Mesa de D&D'),
      h('p', {}, b.wait?.text || 'La partida sigue enseguida…'),
      h('div', { class: 'remote-embers' }, Array.from({ length: 3 }, () => h('i')))));
  } else clear(curtain);
}

// ------------------------------------------------------------------ lo que llega del servidor
async function apply(b) {
  document.title = `${b.campaign || 'Mesa de D&D'} · Pantalla de jugadores`;
  drawCurtain(b);
  if (b.screen !== 'mesa') return;
  if (!mounted) {
    mounting ||= mesa.mount(host, [], { remote: { bundle: b, onUpdate: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } } })
      .then(() => { mounted = true; })
      .catch((e) => {
        mounting = null;
        clear(host, h('div', { class: 'empty' }, icon('skull'), h('h3', {}, 'No se ha podido abrir la mesa'), h('p', {}, e.message)));
      });
    await mounting;
    return;
  }
  listeners.forEach((fn) => fn(b));
}

async function loop() {
  let wrong = false;
  if (!hasCode()) await askCode(false);
  let wait = 1000;
  for (;;) {
    try {
      const res = await fetch(`/api/jugadores?v=${encodeURIComponent(version)}`, { cache: 'no-store' });
      if (res.status === 401) {
        setStatus('wait');
        version = '';
        await askCode(wrong || hasCode());
        wrong = true;
        continue;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const b = await res.json();
      wrong = false;
      wait = 1000;
      setStatus('ok');
      if (b.version !== version) {
        version = b.version;
        await apply(b);
      }
    } catch {
      setStatus('lost'); // el máster la ha apagado, o se ha ido la wifi: se vuelve a intentar sin parar
      await sleep(wait);
      wait = Math.min(8000, wait * 2);
    }
  }
}

initTooltips();
loop();
