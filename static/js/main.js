// Punto de entrada: navegación, barra lateral, barra superior y atajos de teclado.
import { h, clear, icon, dieIcon, promptDialog, fmtTime, initTooltips } from './core/dom.js';
import { api } from './core/api.js';
import { roll, setSound, soundOn } from './core/dice.js';
import { sfx } from './core/sfx.js';
import { startAtmosphere } from './core/atmosphere.js';
import { player } from './core/audio.js';

import mesa from './views/mesa.js';
import characters from './views/characters.js';
import combat from './views/combat.js';
import scenes from './views/scenes.js';
import maps from './views/maps.js';
import dice from './views/dice.js';
import tools from './views/tools.js';
import notes from './views/notes.js';
import music from './views/music.js';
import reference from './views/reference.js';
import games from './views/games.js';
import world from './views/world.js';

const MAIN = [mesa, combat, scenes, characters, maps, dice];
const EXTRA = [notes, tools, music, world, games, reference]; // las teclas 1-9 siguen igual
const VIEWS = [...MAIN, ...EXTRA];

const rail = document.getElementById('rail');
const topbar = document.getElementById('topbar');
const view = document.getElementById('view');
let cleanup = null;
let routeSeq = 0;
let settings = {};

// -- Barra lateral -------------------------------------------------------------------
const crest = h('a', { class: 'rail-brand', href: '#/mesa', 'aria-label': 'Ir a la mesa' });
crest.innerHTML = `<svg viewBox="0 0 46 52" aria-hidden="true">
  <defs><linearGradient id="crestG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8dc94"/><stop offset=".55" stop-color="#c9963f"/><stop offset="1" stop-color="#6b4a18"/></linearGradient></defs>
  <path d="M23 2 L43 9 V26 C43 39 33 46 23 50 C13 46 3 39 3 26 V9 Z" fill="#20160f" stroke="url(#crestG)" stroke-width="2.5"/>
  <polygon points="23,12 33,18 33,30 23,36 13,30 13,18" fill="none" stroke="#f0d38c" stroke-width="1.8"/>
  <polygon points="23,18 28,27 18,27" fill="url(#crestG)"/><path d="M23 12v6M33 18l-5 9M13 18l5 9M23 36l-5-9M23 36l5-9" stroke="#f0d38c" stroke-width="1" opacity=".6"/></svg>`;
const link = (v) => h('a', { class: 'rail-link', href: `#/${v.id}`, dataset: { id: v.id }, 'data-tip': v.hint, 'data-tip-pos': 'right' }, icon(v.icon, 24), h('span', {}, v.title));

const saveDot = h('span', { class: 'save-dot' });
const soundBtn = h('button', { class: 'rail-btn', type: 'button', 'data-tip-pos': 'right', onclick: () => { setSound(!soundOn()); drawSound(); if (soundOn()) sfx.click(); } });
const drawSound = () => { clear(soundBtn, icon(soundOn() ? 'volume' : 'mute')); soundBtn.dataset.tip = soundOn() ? 'Sonido: activado' : 'Sonido: apagado'; };
drawSound();
const fullBtn = h('button', { class: 'rail-btn', type: 'button', 'data-tip': 'Pantalla completa (F11)', 'data-tip-pos': 'right',
  onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) }, icon('fullscreen'));
const saveWrap = h('div', { class: 'rail-btn', 'data-tip': 'Todo se guarda solo en este ordenador', 'data-tip-pos': 'right' }, saveDot);

rail.append(crest, ...MAIN.map(link), h('div', { class: 'rail-sep' }), ...EXTRA.map(link),
  h('div', { class: 'rail-foot' }, soundBtn, fullBtn, saveWrap));

// -- Barra superior --------------------------------------------------------------------
const campaignBtn = h('button', { class: 'campaign', type: 'button', title: 'Cambiar el nombre de la campaña' }, 'Campaña');
const titleEl = h('h1', {}, '');
campaignBtn.addEventListener('click', async () => {
  const name = await promptDialog('Nombre de la campaña', 'Nombre', settings.campaignName || '');
  if (name == null) return;
  settings = await api.saveSettings({ campaignName: name });
  drawCampaign();
});
const drawCampaign = () => {
  campaignBtn.textContent = settings.campaignName || 'Mi campaña';
  document.title = `${titleEl.textContent} · ${settings.campaignName || 'Mesa de D&D'}`;
};

const DICE = [4, 6, 8, 10, 12, 20, 100];
const dicebar = h('div', { class: 'dicebar', role: 'group', 'aria-label': 'Tirar un dado' }, DICE.map((s) => h('button', {
  class: `die-btn d${s}`, type: 'button', 'aria-label': `Tirar 1d${s}`,
  'data-tip': s === 20 ? 'Tirar 1d20 · Mayús: ventaja · Alt: desventaja' : `Tirar 1d${s}`, 'data-tip-pos': 'below',
  onclick: (e) => roll(`1d${s}`, { mode: s === 20 ? (e.shiftKey ? 'adv' : e.altKey ? 'dis' : '') : '' }),
}, dieIcon(s), h('span', {}, `d${s}`))));

const rollInput = h('input', { placeholder: 'Tirar… 2d6+3', 'aria-label': 'Tirada libre, por ejemplo 2d6+3' });
rollInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && rollInput.value.trim()) {
    const r = await roll(rollInput.value.trim(), { mode: e.shiftKey ? 'adv' : e.altKey ? 'dis' : '' });
    if (r) rollInput.select();
  }
  if (e.key === 'Escape') rollInput.blur();
});
const rollbar = h('div', { class: 'rollbar' }, icon('dados'), rollInput, h('kbd', {}, '/'));

const miniName = h('span', { class: 'name' });
const miniPlay = h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Reproducir o pausar música', onclick: () => player.toggle() });
const mini = h('div', { class: 'mini-player', hidden: true }, h('span', { class: 'eq' }, h('i'), h('i'), h('i')), miniName, miniPlay);
player.subscribe((p, kind) => {
  if (kind === 'time') return;
  mini.hidden = !p.current;
  mini.classList.toggle('on', p.playing);
  miniName.textContent = p.current?.name || '';
  clear(miniPlay, icon(p.playing ? 'pause' : 'play', 14));
});

const saveText = h('span', {}, 'Guardado');
const saveStatus = h('div', { class: 'save-status' }, h('span', { class: 'save-dot' }), saveText);
const topDot = saveStatus.firstChild;
const setSaveState = (state, text) => {
  for (const d of [saveDot, topDot]) d.className = `save-dot ${state}`;
  saveText.textContent = text;
};
window.addEventListener('dnd:saving', () => setSaveState('saving', 'Guardando…'));
window.addEventListener('dnd:saved', (e) => setSaveState('', `Guardado · ${fmtTime(e.detail.at / 1000)}`));
window.addEventListener('dnd:save-error', () => setSaveState('error', 'No se pudo guardar'));

topbar.append(h('div', { class: 'page-title' }, campaignBtn, titleEl), dicebar, rollbar, mini, saveStatus);

// -- Navegación --------------------------------------------------------------------------
async function route() {
  const [id, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const current = VIEWS.find((v) => v.id === id) || VIEWS[0];
  rail.querySelectorAll('.rail-link').forEach((a) => {
    if (a.dataset.id === current.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  cleanup?.();
  cleanup = null;
  document.body.classList.remove('player-mode');
  const host = h('div', { class: `view view-${current.id}` }); // contenedor propio: una carga tardía no ensucia la vista nueva
  clear(view, host);
  view.style.animation = 'none';
  void view.offsetWidth;
  view.style.animation = '';
  titleEl.textContent = current.title;
  drawCampaign();
  const token = ++routeSeq;
  if (token > 1) sfx.whoosh();
  try {
    const done = await current.mount(host, params.map(decodeURIComponent));
    if (token === routeSeq) cleanup = done || null;
    else done?.(); // el usuario ya cambió de sección mientras cargaba
  } catch (e) {
    console.error(e);
    clear(host, h('div', { class: 'empty' }, icon('skull'), h('h3', {}, 'Algo ha fallado'), h('p', {}, e.message)));
  }
}

startAtmosphere();
initTooltips();
window.addEventListener('hashchange', route);
api.settings().then((s) => { settings = s; drawCampaign(); }).catch(() => {});
route();

// -- Atajos de teclado -----------------------------------------------------------------------
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
document.addEventListener('keydown', (e) => {
  if (typing(document.activeElement) || e.ctrlKey || e.metaKey) return;
  if (e.key === '/') { e.preventDefault(); rollInput.focus(); rollInput.select(); }
  const n = Number(e.key);
  if (!e.altKey && n >= 1 && n <= VIEWS.length && !e.shiftKey) location.hash = `#/${VIEWS[n - 1].id}`;
});

