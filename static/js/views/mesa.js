// Mesa: el centro de la partida. El mapa sobre la mesa con fichas que se arrastran,
// la iniciativa del combate activo, el grupo, la bandeja de dados y las últimas tiradas.
// «Modo jugadores» lo pone a pantalla completa y oculta lo que solo debe ver el máster.
import { api, debounced } from '../core/api.js';
import {
  h, clear, icon, dieIcon, token, hpBar, shield, floatNum, modal, promptDialog, toast, toastError,
  selectEl, segmented, pickFiles, dropZone, prefs, fmtTime,
} from '../core/dom.js';
import { TYPE_LABEL, condLabel, fmtMod, initBonus, uid, applyDamage, applyHealing, passivePerception } from '../core/dnd.js';
import * as combatRules from '../core/combat.js';
import { createWeather, WEATHERS } from '../core/weather.js';
import { ambience } from '../core/ambience.js';
import { sfx } from '../core/sfx.js';
import { roll, onRoll, describe } from '../core/dice.js';

export default { id: 'mesa', title: 'Mesa', icon: 'mesa', hint: 'Mapa, fichas, iniciativa y dados · tecla 1', mount };

const DICE = [4, 6, 8, 10, 12, 20, 100];

async function mount(root) {
  const [settings, maps, chars, rolls] = await Promise.all([
    api.settings(), api.list('maps'), api.list('characters'), api.get('/api/rolls'),
  ]);
  let combat = null;
  if (settings.activeCombat) {
    combat = await api.get(`/api/combats/${settings.activeCombat}`).catch(() => null);
    if (combat?.status !== 'active') combat = null;
  }
  const state = {
    settings, maps, chars, combat, rolls,
    map: maps.find((m) => m.id === (settings.tableMap || settings.shownMap)) || null,
    who: prefs.get('mesa.who', ''), mode: '', mod: 0, player: false,
  };
  const view = { scale: 1, x: 0, y: 0 };
  const cleanups = [];

  const saveMap = debounced((m) => api.update('maps', m).catch(toastError), 400);
  const saveCombat = debounced((c) => api.update('combats', c).catch(toastError), 250);
  const saveChar = (ch) => api.update('characters', ch).catch(toastError);
  const saveView = debounced(() => state.map && prefs.set(`view.${state.map.id}`, view), 400);

  // ------------------------------------------------------------------ estructura
  const barEl = h('div', { class: 'mesa-bar' });
  const ribbonEl = h('div', { class: 'ribbon' });
  const img = h('img', { class: 'board-img', alt: '', draggable: 'false' });
  const tokensEl = h('div', { class: 'board-tokens' });
  const layer = h('div', { class: 'board-layer' }, img, tokensEl);
  const emptyEl = h('div', { class: 'board-empty' });
  const narration = h('div', { class: 'narration' });
  const clockEl = h('div', { class: 'board-clock' });
  const popEl = h('div', { class: 'tk-pop', hidden: true });
  const weatherCv = h('canvas', { class: 'board-weather', 'aria-hidden': 'true' });
  const board = h('div', { class: 'board', 'data-dice-area': '' }, layer, weatherCv, emptyEl, clockEl, narration, popEl);
  const weather = createWeather(weatherCv, { onLightning: () => setTimeout(() => sfx.thunder(), 250 + Math.random() * 1400) });
  // sonidos de ambiente que acompañan a cada clima
  const WEATHER_SOUND = { lluvia: ['lluvia'], tormenta: ['lluvia', 'viento'], nieve: ['viento'], niebla: ['viento'], brasas: ['hoguera'] };
  const frame = h('section', { class: 'table-frame' }, ribbonEl, board);
  const partyEl = h('div', { class: 'panel party' });
  const dockEl = h('div', { class: 'panel dock' });
  const feedEl = h('div', { class: 'panel feed' });
  const exitBtn = h('button', { class: 'btn exit-player', type: 'button', onclick: () => setPlayerMode(false) }, icon('close'), 'Salir del modo jugadores');
  root.append(h('div', { class: 'mesa' }, barEl, h('div', { class: 'mesa-grid' }, frame, h('aside', { class: 'mesa-side' }, partyEl, dockEl, feedEl)), exitBtn));

  // -------------------------------------------------------------------- utilidades
  const apply = () => {
    layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    board.style.setProperty('--zoom', view.scale);
    positionPopover();
  };
  const tokenSize = () => state.map?.tokenSize || Math.max(28, Math.round((img.naturalWidth || 1000) * 0.045));
  const combatantFor = (t) => state.combat?.combatants.find((x) => x.cid === t.cid || (t.charId && x.charId === t.charId && x.type === 'jugador'));

  function fit() {
    const r = board.getBoundingClientRect();
    if (!img.naturalWidth || !r.width) return;
    view.scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight) * 0.96;
    view.x = (r.width - img.naturalWidth * view.scale) / 2;
    view.y = (r.height - img.naturalHeight * view.scale) / 2;
    apply();
    saveView();
  }
  function zoomAt(factor, cx, cy) {
    const next = Math.min(10, Math.max(0.05, view.scale * factor));
    view.x = cx - (cx - view.x) * (next / view.scale);
    view.y = cy - (cy - view.y) * (next / view.scale);
    view.scale = next;
    apply();
    saveView();
  }
  const zoomCenter = (f) => { const r = board.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); };
  const toImage = (clientX, clientY) => {
    const r = board.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.scale, y: (clientY - r.top - view.y) / view.scale };
  };
  function centerOn(t) {
    const r = board.getBoundingClientRect();
    view.x = r.width / 2 - t.x * view.scale;
    view.y = r.height / 2 - t.y * view.scale;
    layer.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
    apply();
    setTimeout(() => { layer.style.transition = ''; }, 520);
  }

  // Datos vivos de una ficha del mapa: del combate activo, de la ficha o de la copia guardada.
  function tokenInfo(t) {
    const cmb = combatantFor(t);
    const ch = t.charId ? state.chars.find((c) => c.id === t.charId) : null;
    const src = cmb || ch || t;
    return {
      name: src.name ?? t.name, color: src.color ?? t.color, portrait: src.portrait ?? t.portrait, type: src.type ?? t.type,
      hp: src.hp, maxHp: src.maxHp, tempHp: src.tempHp || 0, ac: src.ac,
      conditions: cmb ? cmb.conditions.map((c) => c.name) : (ch?.conditions || []),
      hidden: !!cmb?.hidden, current: !!(cmb && state.combat && combatRules.current(state.combat) === cmb), cmb, ch,
    };
  }

  // ------------------------------------------------------------------ barra superior
  function renderBar() {
    const mapSel = selectEl([['', '— Sin mapa —'], ...state.maps.map((m) => [m.id, m.name])], state.map?.id || '', (id) => setMap(state.maps.find((m) => m.id === id) || null),
      { 'aria-label': 'Mapa sobre la mesa', class: 'map-select' });
    const sizeInput = h('input', { type: 'range', min: 12, max: 260, value: tokenSize(), 'aria-label': 'Tamaño de las fichas',
      oninput: (e) => { if (!state.map) return; state.map.tokenSize = Number(e.target.value); renderTokens(); saveMap(state.map); } });
    clear(barEl,
      h('div', { class: 'row dm-only' },
        icon('mapas'), mapSel,
        h('button', { class: 'btn sm', type: 'button', onclick: uploadMap, 'data-tip': 'Sube una imagen y ponla sobre la mesa' }, icon('upload'), 'Subir mapa'),
        state.map && h('label', { class: 'row small muted size-ctl', 'data-tip': 'Tamaño de las fichas en este mapa' }, icon('target', 16), sizeInput),
        h('button', { class: 'btn sm', type: 'button', onclick: narrate, 'data-tip': 'Muestra un texto sobre la mesa' }, icon('feather'), 'Narrar'),
        selectEl(WEATHERS, state.settings.tableWeather || '', setWeather, { 'aria-label': 'Clima sobre la mesa', class: 'weather-select', 'data-tip': 'Clima sobre el tablero (con su sonido de ambiente)' })),
      h('span', { class: 'tiny muted ping-hint', 'data-tip': 'Señala un punto del mapa a toda la mesa' }, h('kbd', {}, 'Mayús'), ' + clic: señalar'),
      h('div', { class: 'row zoom' },
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': 'Alejar', onclick: () => zoomCenter(1 / 1.25) }, icon('zoomOut', 18)),
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': 'Acercar', onclick: () => zoomCenter(1.25) }, icon('zoomIn', 18)),
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': 'Ajustar el mapa', 'data-tip': 'Ajustar (doble clic en el mapa)', onclick: fit }, icon('fit', 18))),
      h('button', { class: `btn ${state.player ? '' : 'primary'} dm-only`, type: 'button', onclick: () => setPlayerMode(true),
        'data-tip': 'Pantalla completa sin secretos: oculta los PG de los enemigos, los ocultos y las tiradas secretas' }, icon('eye'), 'Modo jugadores'));
  }

  function setPlayerMode(on) {
    state.player = on;
    document.body.classList.toggle('player-mode', on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderAll();
    setTimeout(fit, 120);
  }
  const onFs = () => { if (!document.fullscreenElement && state.player) setPlayerMode(false); };
  document.addEventListener('fullscreenchange', onFs);
  const onKey = (e) => { if (e.key === 'Escape' && state.player) setPlayerMode(false); };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onKey); document.body.classList.remove('player-mode'); });

  async function setMap(m) {
    state.map = m;
    if (m) sfx.unroll();
    state.settings = await api.saveSettings({ tableMap: m ? m.id : null }).catch((e) => { toastError(e); return state.settings; });
    loadMap();
    renderBar();
  }

  async function uploadMap(files) {
    files = Array.isArray(files) ? files : await pickFiles('image/*');
    const file = files.find((f) => f.type.startsWith('image/'));
    if (!file) return files.length && toast('Eso no es una imagen.', { kind: 'error' });
    try {
      const up = await api.upload(file);
      const m = await api.create('maps', { name: file.name.replace(/\.[^.]+$/, ''), url: up.url, notes: '', tokens: [] });
      state.maps.push(m);
      await setMap(m);
      toast(`«${m.name}» está sobre la mesa.`, { kind: 'good', iconName: 'mapas' });
    } catch (e) { toastError(e); }
  }

  async function setWeather(k) {
    (WEATHER_SOUND[state.settings.tableWeather] || []).forEach((n) => ambience.isOn(n) && ambience.stop(n));
    if (sfx.on) (WEATHER_SOUND[k] || []).forEach((n) => !ambience.isOn(n) && ambience.toggle(n, 0.35));
    weather.set(k);
    state.settings = await api.saveSettings({ tableWeather: k }).catch((e) => { toastError(e); return state.settings; });
  }

  // Mayús + clic sobre el mapa: una onda que señala ese punto a toda la mesa.
  function ping(e) {
    const p = toImage(e.clientX, e.clientY);
    const el = h('span', { class: 'ping', style: { left: `${p.x}px`, top: `${p.y}px` } }, h('i'), h('i'), h('i'));
    tokensEl.append(el);
    sfx.ping();
    setTimeout(() => el.remove(), 2600);
  }

  async function narrate() {
    const text = await promptDialog('Narración sobre la mesa', 'Texto que verán los jugadores', state.settings.playerMessage || '');
    if (text == null) return;
    state.settings = await api.saveSettings({ playerMessage: text }).catch((e) => { toastError(e); return state.settings; });
    renderNarration();
  }

  // ----------------------------------------------------------------------- tablero
  function loadMap() {
    hidePopover();
    const m = state.map;
    board.classList.toggle('has-map', !!m);
    if (!m) {
      img.removeAttribute('src');
      clear(tokensEl);
      clear(emptyEl, h('div', { class: 'empty-inner' }, icon('mapas'),
        h('h3', {}, 'La mesa está vacía'),
        h('p', {}, state.player ? 'El máster todavía no ha puesto ningún mapa.' : 'Arrastra aquí una imagen para usarla como mapa, o elige uno arriba.'),
        !state.player && h('button', { class: 'btn primary', type: 'button', onclick: uploadMap }, icon('upload'), 'Subir un mapa')));
      return;
    }
    m.tokens ||= [];
    img.onload = () => {
      const saved = prefs.get(`view.${m.id}`, null);
      if (saved && saved.scale) { Object.assign(view, saved); apply(); } else fit();
      renderTokens();
      renderBar();
    };
    img.src = m.url;
    img.alt = m.name;
  }

  function renderTokens() {
    const m = state.map;
    if (!m) return;
    const size = tokenSize();
    clear(tokensEl, m.tokens.map((t) => {
      const info = tokenInfo(t);
      if (state.player && info.hidden) return null;
      const enemyInPlayer = state.player && info.type !== 'jugador';
      let shownHp = info.hp;
      if (enemyInPlayer && info.maxHp) { // los jugadores no ven los PG exactos del enemigo
        const r = info.hp / Math.max(1, info.maxHp);
        shownHp = info.maxHp * (r >= 1 ? 1 : r > 0.5 ? 0.7 : r > 0.25 ? 0.4 : r > 0 ? 0.15 : 0);
      }
      const tk = token(info, { size, hp: shownHp, max: info.maxHp, showHp: info.maxHp != null });
      const el = h('div', {
        class: `mtoken ${info.type} ${info.current ? 'current' : ''} ${info.hidden ? 'is-hidden' : ''} ${t.id === popEl.dataset.id ? 'selected' : ''}`,
        style: { left: `${t.x - size / 2}px`, top: `${t.y - size / 2}px`, width: `${size}px`, height: `${size}px`, '--ts': `${size}px` },
        dataset: { id: t.id },
      }, tk,
      h('span', { class: 'mtoken-name' }, info.name),
      info.conditions.length > 0 && h('span', { class: 'mtoken-conds' }, info.conditions.map((c) => condLabel(c).split(' ')[0]).join('')));
      el.addEventListener('pointerdown', (e) => startTokenDrag(e, t, el));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!state.player) removeToken(t); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); if (!state.player && info.ch) location.hash = `#/personajes/${info.ch.id}`; });
      return el;
    }));
  }

  function addToken(data, at) {
    if (!state.map) return toast('Primero pon un mapa sobre la mesa.');
    const existing = state.map.tokens.find((t) => (data.cid && t.cid === data.cid) || (data.charId && !data.cid && t.charId === data.charId && !t.cid));
    if (existing) { Object.assign(existing, at); }
    else state.map.tokens.push({ id: uid(), ...data, ...at });
    renderTokens();
    saveMap(state.map);
  }

  function removeToken(t) {
    state.map.tokens = state.map.tokens.filter((x) => x !== t);
    hidePopover();
    renderTokens();
    saveMap(state.map);
    toast(`${tokenInfo(t).name} retirado del mapa.`, { iconName: 'close', ms: 2500 });
  }

  function startTokenDrag(e, t, el) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const start = { cx: e.clientX, cy: e.clientY, x: t.x, y: t.y };
    let moved = false;
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    el.classList.add('dragging');
    const move = (ev) => {
      const dx = (ev.clientX - start.cx) / view.scale;
      const dy = (ev.clientY - start.cy) / view.scale;
      if (!moved && Math.hypot(ev.clientX - start.cx, ev.clientY - start.cy) < 4) return;
      if (state.player && tokenInfo(t).type !== 'jugador') return; // en modo jugadores solo se mueven los suyos
      moved = true;
      hidePopover();
      t.x = start.x + dx; t.y = start.y + dy;
      const size = tokenSize();
      el.style.left = `${t.x - size / 2}px`;
      el.style.top = `${t.y - size / 2}px`;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      if (moved) saveMap(state.map);
      else showPopover(t);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Desplazar y hacer zoom: arrastrar el fondo, rueda del ratón o pellizco.
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const regesture = () => {
    const pts = [...pointers.values()];
    if (pts.length === 1) { drag = { x: pts[0].x - view.x, y: pts[0].y - view.y }; pinch = null; }
    else if (pts.length >= 2) { drag = null; pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), m: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } }; }
    else { drag = pinch = null; saveView(); }
    board.classList.toggle('panning', pointers.size > 0);
  };
  board.addEventListener('pointerdown', (e) => {
    if (!state.map || e.target.closest('.mtoken, .tk-pop, .narration, .board-clock, .board-empty button')) return;
    if (e.shiftKey) { ping(e); return; }
    hidePopover();
    try { board.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    regesture();
  });
  board.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.x += m.x - pinch.m.x; view.y += m.y - pinch.m.y;
      const r = board.getBoundingClientRect();
      zoomAt(d / (pinch.d || 1), m.x - r.left, m.y - r.top);
      pinch = { d, m };
    } else if (drag) { view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; apply(); }
  });
  const endPointer = (e) => { pointers.delete(e.pointerId); regesture(); };
  board.addEventListener('pointerup', endPointer);
  board.addEventListener('pointercancel', endPointer);
  board.addEventListener('wheel', (e) => {
    if (!state.map) return;
    e.preventDefault();
    const r = board.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  board.addEventListener('dblclick', (e) => { if (!e.target.closest('.mtoken, .tk-pop')) fit(); });

  // Soltar sobre la mesa: una imagen se convierte en mapa; una ficha del panel, en ficha del mapa.
  dropZone(board, (files) => uploadMap(files));
  board.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('application/x-dnd-token')) { e.preventDefault(); board.classList.add('over'); } });
  board.addEventListener('drop', (e) => {
    const raw = e.dataTransfer.getData('application/x-dnd-token');
    if (!raw) return;
    e.preventDefault();
    board.classList.remove('over');
    addToken(JSON.parse(raw), toImage(e.clientX, e.clientY));
  });
  const draggable = (el, data) => {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-dnd-token', JSON.stringify(data));
      e.dataTransfer.effectAllowed = 'copy';
    });
    return el;
  };
  const placeAtCenter = (data) => {
    const r = board.getBoundingClientRect();
    addToken(data, toImage(r.left + r.width / 2 + (Math.random() - 0.5) * 60, r.top + r.height / 2 + (Math.random() - 0.5) * 60));
  };

  // --------------------------------------------------------------- tarjeta de ficha
  function showPopover(t) {
    const info = tokenInfo(t);
    popEl.dataset.id = t.id;
    const target = info.cmb || info.ch;
    const canSeeHp = !state.player || info.type === 'jugador';
    clear(popEl,
      h('div', { class: 'row nowrap' }, token(info, { size: 42, showHp: canSeeHp && info.maxHp != null }),
        h('div', { class: 'grow' }, h('b', {}, info.name), h('div', { class: 'tiny muted' }, TYPE_LABEL[info.type] || '')),
        info.ac != null && shield(info.ac),
        h('button', { class: 'btn ghost icon xs', type: 'button', 'aria-label': 'Cerrar', onclick: hidePopover }, icon('close', 14))),
      info.maxHp != null && (canSeeHp
        ? h('div', { class: 'tk-hp' }, h('span', { class: 'tnum' }, h('b', {}, info.hp), ` / ${info.maxHp}`, info.tempHp ? h('span', { class: 'temp' }, ` +${info.tempHp}`) : ''), hpBar(info.hp, info.maxHp, info.tempHp))
        : h('div', { class: 'tk-hp' }, h('span', { class: 'chip' }, combatRules.healthWord(info)))),
      info.conditions.length > 0 && h('div', { class: 'row' }, info.conditions.map((c) => h('span', { class: 'chip cond' }, condLabel(c)))),
      !state.player && target && h('div', { class: 'row' },
        h('button', { class: 'btn sm danger', type: 'button', onclick: () => hpDialog(target, info.cmb) }, icon('drop', 15), 'PG'),
        info.ch && h('button', { class: 'btn sm', type: 'button', onclick: () => { location.hash = `#/personajes/${info.ch.id}`; } }, icon('scroll', 15), 'Ficha'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: () => removeToken(t) }, icon('trash', 15), 'Quitar')));
    popEl.hidden = false;
    renderTokens();
    positionPopover();
  }
  function positionPopover() {
    if (popEl.hidden || !state.map) return;
    const t = state.map.tokens.find((x) => x.id === popEl.dataset.id);
    if (!t) return hidePopover();
    const r = board.getBoundingClientRect();
    const px = view.x + t.x * view.scale;
    const py = view.y + (t.y + tokenSize() / 2) * view.scale + 10;
    popEl.style.left = `${Math.min(r.width - 150, Math.max(150, px))}px`;
    popEl.style.top = `${Math.min(r.height - 40, Math.max(10, py))}px`;
  }
  function hidePopover() {
    if (popEl.hidden) return;
    popEl.hidden = true;
    delete popEl.dataset.id;
    renderTokens();
  }

  // Ventana para cambiar PG (de un participante del combate o de una ficha).
  async function hpDialog(target, cmb) {
    const s = { v: '' };
    const input = h('input', { type: 'number', min: 0, class: 'hp-amount', placeholder: '0', 'aria-label': 'Cantidad' });
    input.addEventListener('input', () => { s.v = input.value; });
    const quick = h('div', { class: 'row' }, [1, 2, 5, 10, 20].map((n) => h('button', { class: 'btn sm', type: 'button', onclick: () => { input.value = String((Number(input.value) || 0) + n); s.v = input.value; } }, `+${n}`)));
    const body = h('div', { class: 'stack hp-dialog' },
      h('div', { class: 'row nowrap' }, token(target, { size: 64 }), h('div', { class: 'grow' }, h('h3', {}, target.name),
        h('div', { class: 'tnum' }, h('b', {}, target.hp), ` / ${target.maxHp} PG`, target.tempHp ? ` (+${target.tempHp} temporales)` : ''), hpBar(target.hp, target.maxHp, target.tempHp))),
      input, quick);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') body.closest('.modal').querySelector('.actions .danger').click(); });
    const action = await modal('Puntos de golpe', body, [
      { label: 'Temporales', value: 'temp', icon: 'shield' },
      { label: 'Curar', value: 'heal', class: 'success', icon: 'heart' },
      { label: 'Daño', value: 'dmg', class: 'danger', icon: 'sword' },
    ], { iconName: 'drop' });
    const v = Number(s.v);
    if (!action || !v) return;
    changeHp(target, cmb, action, v);
  }

  function changeHp(target, cmb, action, v) {
    if (cmb && state.combat) {
      if (action === 'dmg') combatRules.damage(state.combat, cmb, v);
      else if (action === 'heal') combatRules.heal(state.combat, cmb, v);
      else { cmb.tempHp = Math.max(cmb.tempHp || 0, v); sfx.shield(); }
      combatRules.syncCharacter(state.chars, cmb);
      saveCombat(state.combat);
    } else {
      if (action === 'dmg') applyDamage(target, v);
      else if (action === 'heal') applyHealing(target, v);
      else target.tempHp = Math.max(target.tempHp || 0, v);
      if (action === 'dmg') sfx.hit(); else if (action === 'heal') sfx.heal(); else sfx.shield();
      saveChar(target);
    }
    const anchor = tokensEl.querySelector(`.mtoken.selected`) || partyEl.querySelector(`[data-key="${target.charId || target.id}"]`);
    floatNum(anchor || board, action === 'dmg' ? `−${v}` : `+${v}`, action === 'dmg' ? 'dmg' : action === 'heal' ? 'heal' : 'temp');
    renderAll();
  }

  // ------------------------------------------------------------------- iniciativa
  function renderRibbon() {
    const c = state.combat;
    frame.classList.toggle('in-combat', !!c);
    if (!c) {
      clear(ribbonEl, !state.player && h('div', { class: 'ribbon-idle' }, icon('combate', 18), 'Sin combate en curso',
        h('a', { class: 'btn sm', href: '#/combate' }, 'Preparar un combate')));
      return;
    }
    const cur = combatRules.current(c);
    clear(ribbonEl,
      h('div', { class: 'round-medal', 'data-tip': c.name }, h('small', {}, 'Ronda'), h('b', {}, c.round)),
      h('ol', { class: 'ribbon-list' }, c.combatants.map((x) => {
        if (state.player && x.hidden) return null;
        const isCur = x === cur;
        const showHp = !state.player || x.type === 'jugador';
        const item = h('li', { class: `rb ${x.type} ${isCur ? 'current' : ''} ${x.hp <= 0 ? 'down' : ''} ${x.hidden ? 'is-hidden' : ''}`,
          'data-tip': `${x.name} · iniciativa ${x.init ?? '–'}${showHp ? ` · ${x.hp}/${x.maxHp} PG` : ` · ${combatRules.healthWord(x)}`}${x.conditions.length ? ` · ${x.conditions.map((k) => k.name).join(', ')}` : ''}`,
          'data-tip-pos': 'below',
          onclick: () => {
            const t = state.map?.tokens.find((tk) => tk.cid === x.cid || (x.charId && tk.charId === x.charId && x.type === 'jugador'));
            if (t) { centerOn(t); showPopover(t); } else if (!state.player && state.map) placeAtCenter({ cid: x.cid, charId: x.charId, name: x.name, color: x.color, portrait: x.portrait, type: x.type });
          } },
        h('span', { class: 'rb-init' }, x.init ?? '–'),
        token(x, { size: isCur ? 58 : 44, showHp }),
        h('span', { class: 'rb-name' }, x.name),
        x.conditions.length > 0 && h('span', { class: 'rb-conds' }, x.conditions.map((k) => condLabel(k.name).split(' ')[0]).join('')));
        if (!state.player) draggable(item, { cid: x.cid, charId: x.charId, name: x.name, color: x.color, portrait: x.portrait, type: x.type });
        return item;
      })),
      h('div', { class: 'ribbon-actions dm-only' },
        h('button', { class: 'btn icon sm', type: 'button', 'aria-label': 'Turno anterior', onclick: () => nextTurn(-1) }, icon('prev', 16)),
        h('button', { class: 'btn primary', type: 'button', onclick: () => nextTurn(1) }, 'Siguiente', icon('next', 16))));
    ribbonEl.querySelector('.rb.current')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function nextTurn(dir) {
    const x = combatRules.step(state.combat, dir);
    saveCombat(state.combat);
    renderAll();
    if (x && dir > 0) announce(x);
  }

  function announce(x) {
    const el = h('div', { class: `turn-banner ${x.type}` }, h('small', {}, `Ronda ${state.combat.round}`), h('b', {}, `Turno de ${x.name}`));
    board.append(el);
    setTimeout(() => el.remove(), 2200);
  }

  // ------------------------------------------------------------------------ grupo
  function renderParty() {
    const party = state.chars.filter((c) => c.type === 'jugador');
    clear(partyEl,
      h('div', { class: 'panel-head' }, h('h3', {}, icon('crown'), 'El grupo'),
        h('div', { class: 'actions dm-only' }, state.map && party.length > 0 && h('button', { class: 'btn xs', type: 'button', 'data-tip': 'Pon a todo el grupo sobre el mapa',
          onclick: () => party.forEach((ch) => placeAtCenter({ charId: ch.id, name: ch.name, color: ch.color, portrait: ch.portrait, type: ch.type })) }, icon('plus', 14), 'Al mapa'))),
      party.length ? h('div', { class: 'party-list' }, party.map((ch) => {
        const cmb = state.combat?.combatants.find((x) => x.charId === ch.id);
        const src = cmb || ch;
        const card = h('div', { class: `pc ${src.hp <= 0 ? 'down' : ''}`, dataset: { key: ch.id }, onclick: () => !state.player && hpDialog(src, cmb) },
          token(src, { size: 48 }),
          h('div', { class: 'grow' },
            h('div', { class: 'row between nowrap' }, h('b', { class: 'pc-name' }, ch.name), h('span', { class: 'tnum small' }, h('b', {}, src.hp), `/${src.maxHp}`)),
            hpBar(src.hp, src.maxHp, src.tempHp),
            h('div', { class: 'pc-meta' }, [ch.cls, ch.level && `nv ${ch.level}`].filter(Boolean).join(' · '),
              h('span', { 'data-tip': 'Percepción pasiva' }, ` · 👁 ${passivePerception(ch)}`),
              (src.conditions || []).length > 0 && h('span', {}, ' · ', (src.conditions || []).map((k) => condLabel(k.name || k).split(' ')[0]).join('')))),
          shield(src.ac));
        card.setAttribute('data-tip', state.player ? ch.name : 'Clic: PG · arrastra al mapa para colocar su ficha');
        return draggable(card, { charId: ch.id, name: ch.name, color: ch.color, portrait: ch.portrait, type: ch.type });
      })) : h('p', { class: 'muted small' }, 'Crea las fichas de los jugadores en ', h('a', { href: '#/personajes' }, 'Personajes'), '.'));
  }

  // ------------------------------------------------------------- bandeja de dados
  function rollerChar() { return state.chars.find((c) => c.id === state.who) || null; }

  function renderDock() {
    const ch = rollerChar();
    const cmb = ch && state.combat?.combatants.find((x) => x.charId === ch.id);
    const who = ch ? ch.name : 'Máster';
    const color = ch?.color || '';
    const modTxt = h('b', { class: 'tnum mod-val' }, fmtMod(state.mod));
    const setMod = (d) => { state.mod += d; modTxt.textContent = fmtMod(state.mod); };
    const doRoll = (expr, label, mode = '') => roll(expr, { label: `${who}: ${label}`, who, color, mode, secret: false });
    const whoOptions = [['', '🎲 Máster'], ...state.chars.filter((c) => c.type === 'jugador').map((c) => [c.id, c.name]),
      ...state.chars.filter((c) => c.type !== 'jugador').map((c) => [c.id, `${c.name} (${TYPE_LABEL[c.type].split(' ')[0]})`])];
    const whoSel = selectEl(state.player ? whoOptions.filter(([id]) => !id || state.chars.find((c) => c.id === id)?.type === 'jugador') : whoOptions,
      state.who, (v) => { state.who = v; prefs.set('mesa.who', v); renderDock(); }, { 'aria-label': 'Quién tira', class: 'who-select' });

    clear(dockEl,
      h('div', { class: 'panel-head' }, h('h3', {}, icon('dados'), 'Bandeja'), h('div', { class: 'actions' }, whoSel)),
      h('div', { class: 'dock-dice' }, DICE.map((s) => h('button', {
        class: `die-btn d${s}`, type: 'button', 'aria-label': `Tirar 1d${s}`, style: color ? { '--dc': color } : null,
        onclick: () => doRoll(`1d${s}${state.mod ? fmtMod(state.mod) : ''}`, `d${s}${state.mod ? ` ${fmtMod(state.mod)}` : ''}`, s === 20 ? state.mode : ''),
      }, dieIcon(s), h('span', {}, `d${s}`)))),
      h('div', { class: 'row between dock-opts' },
        segmented([['', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desv.']], state.mode, (v) => { state.mode = v; }),
        h('div', { class: 'row nowrap mod', 'data-tip': 'Modificador que se suma a la tirada' },
          h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Restar 1', onclick: () => setMod(-1) }, icon('minus', 14)), modTxt,
          h('button', { class: 'btn icon xs', type: 'button', 'aria-label': 'Sumar 1', onclick: () => setMod(1) }, icon('plus', 14)))),
      ch && h('div', { class: 'dock-quick' },
        h('button', { class: 'btn xs', type: 'button', onclick: () => doRoll(`1d20${fmtMod(cmb?.initBonus ?? initBonus(ch))}`, 'Iniciativa', state.mode) }, icon('bolt', 13), 'Iniciativa'),
        (ch.attacks || []).slice(0, 4).map((a) => [
          h('button', { class: 'btn xs', type: 'button', onclick: () => doRoll(`1d20${fmtMod(Number(a.bonus) || 0)}`, a.name, state.mode) }, icon('sword', 13), `${a.name} ${fmtMod(Number(a.bonus) || 0)}`),
          a.damage && a.damage !== '0' && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => doRoll(a.damage, `Daño de ${a.name}`) }, a.damage),
        ])));
  }

  // -------------------------------------------------------------- últimas tiradas
  function renderFeed() {
    const list = state.rolls.filter((r) => !(state.player && r.secret)).slice(-8).reverse();
    clear(feedEl,
      h('div', { class: 'panel-head' }, h('h3', {}, icon('scroll'), 'Últimas tiradas')),
      list.length ? h('ul', { class: 'feed-list' }, list.map((r) => {
        const ch = state.chars.find((c) => c.name === r.who);
        return h('li', { class: r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : '', 'data-tip': describe(r) },
          h('span', { class: 'dot', style: { background: ch?.color || 'var(--gold)' } }),
          h('span', { class: 'grow lbl' }, r.secret ? '🔒 ' : '', r.label || r.expr),
          h('span', { class: 'tiny muted' }, fmtTime(r.time)),
          h('b', { class: 'tot' }, r.total));
      })) : h('p', { class: 'muted small' }, 'Aún no se ha tirado nada. ¡Que rueden los dados!'));
  }

  // --------------------------------------------------------- reloj y narración
  function renderClock() {
    const cl = state.settings.clock;
    if (!cl) { clockEl.hidden = true; return; }
    clockEl.hidden = false;
    const hh = Math.floor(cl.minutes / 60);
    const night = hh < 6 || hh >= 20;
    const advance = async (mins) => {
      const total = cl.minutes + mins;
      cl.day += Math.floor(total / 1440);
      cl.minutes = ((total % 1440) + 1440) % 1440;
      state.settings = await api.saveSettings({ clock: cl }).catch((e) => { toastError(e); return state.settings; });
      renderClock();
    };
    clear(clockEl, icon(night ? 'moon' : 'sun', 18),
      h('span', {}, `Día ${cl.day} · ${String(hh).padStart(2, '0')}:${String(cl.minutes % 60).padStart(2, '0')}`),
      h('span', { class: 'dm-only clock-adv' },
        h('button', { class: 'btn xs ghost', type: 'button', onclick: () => advance(10) }, '+10′'),
        h('button', { class: 'btn xs ghost', type: 'button', onclick: () => advance(60) }, '+1h')));
    board.classList.toggle('night', night);
  }

  function renderNarration() {
    const text = state.settings.playerMessage;
    narration.hidden = !text;
    if (!text) return;
    clear(narration, icon('feather', 18), h('p', {}, text),
      h('button', { class: 'btn ghost icon xs dm-only', type: 'button', 'aria-label': 'Quitar narración', onclick: async () => {
        state.settings = await api.saveSettings({ playerMessage: '' }).catch(() => state.settings);
        renderNarration();
      } }, icon('close', 14)));
  }

  function renderAll() {
    renderBar();
    renderRibbon();
    renderTokens();
    renderParty();
    renderDock();
    renderFeed();
    renderClock();
    renderNarration();
    if (!popEl.hidden) { const t = state.map?.tokens.find((x) => x.id === popEl.dataset.id); if (t) showPopover(t); }
  }

  cleanups.push(onRoll((r) => { state.rolls.push(r); renderFeed(); }));
  const ro = new ResizeObserver(() => { weather.resize(); if (state.map && !prefs.get(`view.${state.map.id}`, null)) fit(); });
  ro.observe(board);
  cleanups.push(() => ro.disconnect(), () => weather.destroy());
  requestAnimationFrame(() => weather.set(state.settings.tableWeather || ''));

  loadMap();
  renderAll();
  return () => {
    cleanups.forEach((fn) => fn());
    if (saveMap.pending) saveMap.flush();
    if (saveCombat.pending) saveCombat.flush();
  };
}
