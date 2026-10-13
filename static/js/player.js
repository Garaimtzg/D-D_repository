// Pantalla de jugadores: consulta al servidor cada 2 s y muestra solo lo que el máster comparte.
import { api } from './core/api.js';
import { h, clear, hpBar } from './core/dom.js';

const $ = (id) => document.getElementById(id);
let lastMapUrl = null;

function renderMap(map) {
  const url = map?.url || null;
  if (url === lastMapUrl) return;
  lastMapUrl = url;
  clear($('map'), url ? h('img', { src: url, alt: map.name }) : h('div', { class: 'empty' }, 'El máster aún no ha mostrado ningún mapa.'));
}

function renderClock(clock) {
  $('clock').hidden = !clock;
  if (!clock) return;
  const hh = String(Math.floor(clock.minutes / 60)).padStart(2, '0');
  const mm = String(clock.minutes % 60).padStart(2, '0');
  clear($('clock'), h('div', { class: 'big-clock' }, `Día ${clock.day} · ${hh}:${mm}`));
}

function renderCombat(combat) {
  $('combat').hidden = !combat;
  if (!combat) return;
  clear($('combat'),
    h('div', { class: 'row between' }, h('h3', {}, combat.name), h('span', { class: 'round-badge' }, `Ronda ${combat.round}`)),
    h('ol', { class: 'init-list' }, combat.order.map((c) => h('li', { class: `${c.type} ${c.current ? 'current' : ''}` },
      h('span', { class: 'n' }, c.init ?? '–'),
      h('div', { class: 'grow' },
        h('div', {}, c.name, c.conditions.length ? h('span', { class: 'small muted' }, ` · ${c.conditions.join(', ')}`) : ''),
        c.hp != null ? h('div', { class: 'row' }, h('div', { class: 'grow' }, hpBar(c.hp, c.maxHp)), h('span', { class: 'small tnum' }, `${c.hp}/${c.maxHp}${c.tempHp ? ` +${c.tempHp}` : ''}`))
          : h('div', { class: 'small muted' }, c.health))))));
}

function renderRolls(rolls) {
  clear($('rolls'), rolls.length ? [...rolls].reverse().map((r) => h('li', {},
    h('span', {}, h('span', { class: 'small muted' }, r.who && !r.label?.startsWith(r.who) ? `${r.who} · ` : ''), r.label || r.expr),
    h('b', {}, r.total))) : h('li', { class: 'muted' }, 'Aún no hay tiradas.'));
}

async function refresh() {
  try {
    const v = await api.get('/api/player');
    renderMap(v.map);
    renderClock(v.clock);
    renderCombat(v.combat);
    renderRolls(v.rolls);
    $('message').hidden = !v.message;
    $('message').textContent = v.message || '';
  } catch { /* el servidor puede estar reiniciándose; se reintenta */ }
}

$('full').addEventListener('click', () => document.documentElement.requestFullscreen?.());
refresh();
setInterval(refresh, 2000);
