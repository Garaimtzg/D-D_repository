// Punto de entrada: navegación entre secciones y barra superior.
import { h, clear, icon } from './core/dom.js';
import { roll } from './core/dice.js';
import { player } from './core/audio.js';

import characters from './views/characters.js';
import combat from './views/combat.js';
import maps from './views/maps.js';
import dice from './views/dice.js';
import tools from './views/tools.js';
import notes from './views/notes.js';
import music from './views/music.js';
import reference from './views/reference.js';

const VIEWS = [characters, combat, maps, dice, tools, notes, music, reference];
const nav = document.getElementById('nav');
const view = document.getElementById('view');
let cleanup = null;
let routeSeq = 0;

for (const v of VIEWS) {
  nav.append(h('a', { href: `#/${v.id}`, dataset: { id: v.id } }, icon(v.icon), h('span', {}, v.title)));
}

async function route() {
  const [id, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const current = VIEWS.find((v) => v.id === id) || VIEWS[0];
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.id === current.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  cleanup?.();
  cleanup = null;
  const host = h('div', { class: `view-${current.id}` }); // contenedor propio: una carga tardía no ensucia la vista nueva
  clear(view, host);
  document.title = `${current.title} · Mesa de D&D`;
  const token = ++routeSeq;
  const done = await current.mount(host, params.map(decodeURIComponent));
  if (token === routeSeq) cleanup = done || null;
  else done?.(); // el usuario ya cambió de sección mientras cargaba
}

window.addEventListener('hashchange', route);
route();

// -- Barra superior: dados rápidos, música y pantalla de jugadores -----------
const topTools = document.getElementById('topTools');
const quick = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
topTools.append(
  ...quick.map((d) => h('button', { class: `btn sm ${d === 'd20' ? 'primary' : ''}`, type: 'button', title: `Tirar 1${d}`, onclick: () => roll(`1${d}`) }, d)),
);

const trackName = h('span', {}, '');
const playBtn = h('button', { class: 'btn sm icon', type: 'button', 'aria-label': 'Reproducir o pausar música', onclick: () => player.toggle() });
const mini = h('div', { class: 'mini-player', hidden: true }, icon('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', 16), trackName, playBtn);
player.subscribe((p) => {
  mini.hidden = !p.current;
  trackName.textContent = p.current?.name || '';
  playBtn.textContent = p.playing ? '❚❚' : '▶';
});
topTools.append(mini,
  h('a', { class: 'btn sm', href: 'player.html', target: '_blank', rel: 'noopener', title: 'Abrir la pantalla para los jugadores (segunda pantalla o televisión)' },
    icon('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', 16), 'Pantalla jugadores'));
