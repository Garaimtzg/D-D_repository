// Herri kirolak: el deporte rural vasco de las fiestas del pueblo, con los muñecos de los jugadores.
// Tres pruebas en el mismo ordenador: aizkolari (cortar un tronco alternando golpes), harri-jasotzaile
// (subir la piedra al hombro en tres tiempos) y sokatira (tirar de la cuerda por equipos, al ritmo).
// La Fuerza y la Constitución de la ficha ayudan un poco. Quien más puntos sume se lleva la txapela.
import { api } from '../core/api.js';
import { h, clear, avatar, segmented, selectEl, bigBanner, toast, toastError, prefs } from '../core/dom.js';
import { mod } from '../core/dnd.js';
import { sfx } from '../core/sfx.js';

const EVENTS = [['aizkolari', '🪓 Aizkolari'], ['harri', '🪨 Harri-jasotzaile'], ['sokatira', '🪢 Sokatira']];
const POINTS = [3, 2, 1];
const fue = (p) => mod(p.abilities?.fue);
const con = (p) => mod(p.abilities?.con);
const typing = () => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
const secs = (ms) => (ms / 1000).toFixed(2).replace('.', ',');
const bump = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

export function kirolak(stage, ps) {
  const st = { ev: prefs.get('kirolak.ev', 'aizkolari'), scores: prefs.get('kirolak.scores', {}) };
  const arena = h('div', { class: 'hk-arena' });
  const board = h('aside', { class: 'hk-board' });
  let stop = null;
  const addPoints = (name, n) => { st.scores[name] = (st.scores[name] || 0) + n; prefs.set('kirolak.scores', st.scores); drawBoard(); };
  const podium = (ranking) => ranking.slice(0, 3).forEach((p, i) => addPoints(p.name, POINTS[i]));

  function drawBoard() {
    const rows = ps.map((p) => [p, st.scores[p.name] || 0]).sort((a, b) => b[1] - a[1]);
    const champ = rows[0]?.[1] > 0 && rows[0][1] > (rows[1]?.[1] ?? -1) ? rows[0][0] : null; // con empate en cabeza no hay txapela
    clear(board, h('h3', {}, '🏆 Torneo'),
      !champ && rows[0]?.[1] > 0 && h('p', { class: 'tiny muted' }, 'Empate en cabeza: la txapela sigue en juego.'),
      champ && h('div', { class: 'hk-champ' }, avatar({ ...champ, look: { ...(champ.look || {}), hat: 'txapela', hatColor: '#1f2433' } }, 'lg', { live: false }),
        h('b', {}, champ.name), h('span', { class: 'tiny muted' }, 'txapeldun: lleva la txapela'),
        champ.id && h('button', { class: 'btn xs', type: 'button', 'data-tip': 'Guarda la txapela en el aspecto de su ficha', onclick: () => crown(champ) }, 'Ponérsela en la ficha')),
      h('ol', { class: 'hk-scores' }, rows.map(([p, n]) => h('li', {}, avatar(p), h('span', { class: 'grow' }, p.name), h('b', {}, n)))),
      h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { st.scores = {}; prefs.set('kirolak.scores', {}); drawBoard(); } }, 'Reiniciar el torneo'),
      h('p', { class: 'tiny muted' }, 'Cada prueba da 3, 2 y 1 puntos a los tres primeros; la sokatira, 2 puntos a cada miembro del equipo ganador.'));
  }
  async function crown(p) {
    try {
      p.look = { ...(p.look || {}), hat: 'txapela' };
      await api.update('characters', p);
      sfx.victory();
      toast(`${p.name} ya lleva la txapela en su ficha.`, { kind: 'good', iconName: 'crown' });
    } catch (e) { toastError(e); }
  }
  function open(ev) {
    stop?.();
    st.ev = ev;
    prefs.set('kirolak.ev', ev);
    stop = ({ aizkolari, harri, sokatira })[ev](arena, ps, { podium, addPoints }) || null;
  }

  clear(stage,
    h('div', { class: 'game-head' }, h('div', { class: 'grow' }, h('h2', {}, '🪓 Herri kirolak'),
      h('p', { class: 'muted' }, 'El deporte rural vasco de las fiestas: cortar troncos, levantar la piedra y tirar de la cuerda. La Fuerza y la Constitución de la ficha ayudan un poco. ¡A por la txapela!')),
    segmented(EVENTS, st.ev, open)),
    h('div', { class: 'hk-layout' }, arena, board));
  drawBoard();
  open(EVENTS.some(([k]) => k === st.ev) ? st.ev : 'aizkolari');
  return () => stop?.();
}

// Cuenta atrás «3, 2, 1, ¡Aupa!» y luego go().
function countdown(msg, timers, go) {
  timers.forEach(clearTimeout);
  timers.length = 0;
  ['3', '2', '1'].forEach((n, k) => timers.push(setTimeout(() => { msg.textContent = n; sfx.tick(); }, k * 700)));
  timers.push(setTimeout(() => { msg.textContent = '¡Aupa!'; sfx.gong(); go(); }, 2100));
}

// ---------------------------------------------------------------- aizkolari
// Cada uno corta su tronco por turnos: golpes alternando A y L; a mitad, darse la vuelta (Espacio) para la otra cara.
function aizkolari(arena, ps, { podium }) {
  const st = { i: 0, phase: 'ready', hits: 0, side: '', turned: false, t0: 0, times: [], timers: [] };
  const need = (p) => Math.max(18, 30 - 2 * fue(p));
  const cur = () => ps[st.i];
  const msg = h('div', { class: 'aw-msg' }, 'Pulsa «Empezar»');
  const timeEl = h('div', { class: 'hk-time' }, '0,00 s');
  const logEl = h('div', { class: 'hk-log' });
  const axe = h('span', { class: 'hk-axe' }, '🪓');
  const who = h('div', { class: 'hk-who' });
  const controls = h('div', { class: 'game-actions' });
  const results = h('ol', { class: 'hk-results' });
  const clock = setInterval(() => { if (st.phase === 'chop' || st.phase === 'turn') timeEl.textContent = `${secs(performance.now() - st.t0)} s`; }, 50);

  function drawLog() {
    const p = st.hits / need(cur());
    logEl.style.setProperty('--top', Math.min(1, p * 2));
    logEl.style.setProperty('--bot', Math.max(0, p * 2 - 1));
    logEl.classList.toggle('done', st.phase === 'done');
  }
  function chip() {
    const c = h('span', { class: 'hk-chip', style: { '--dx': `${(Math.random() - 0.5) * 220}px`, '--dy': `${-40 - Math.random() * 90}px` } });
    logEl.append(c);
    setTimeout(() => c.remove(), 650);
  }
  function hit(side) {
    if (st.phase !== 'chop') return;
    if (side === st.side) { msg.textContent = '¡Golpe torcido! Alterna A y L'; bump(logEl, 'shake'); return; }
    st.side = side;
    st.hits += 1;
    sfx.chop();
    chip();
    bump(axe, side === 'a' ? 'swing-l' : 'swing-r');
    const n = need(cur());
    if (st.hits >= n) finish();
    else if (!st.turned && st.hits >= Math.ceil(n / 2)) { st.phase = 'turn'; msg.textContent = '¡Date la vuelta! (Espacio)'; draw(); }
    else if (msg.textContent !== '¡Aupa!' && st.hits % 4 === 0) msg.textContent = '¡Aupa!';
    drawLog();
  }
  function turn() {
    if (st.phase !== 'turn') return;
    Object.assign(st, { turned: true, phase: 'chop', side: '' });
    msg.textContent = '¡La otra cara!';
    sfx.whoosh();
    logEl.classList.add('turned');
    draw();
  }
  function finish() {
    const ms = performance.now() - st.t0;
    st.phase = 'done';
    st.times.push([cur(), ms]);
    timeEl.textContent = `${secs(ms)} s`;
    msg.textContent = '¡Tronco cortado!';
    sfx.coins();
    if (st.times.length === ps.length) {
      const ranking = [...st.times].sort((a, b) => a[1] - b[1]);
      podium(ranking.map(([p]) => p));
      sfx.victory();
      bigBanner('¡Aizkolari txapeldun!', `${ranking[0][0].name} · ${secs(ranking[0][1])} s`, 'gold', 'crown');
    }
    draw();
  }
  function start() {
    Object.assign(st, { phase: 'count', hits: 0, side: '', turned: false });
    logEl.classList.remove('turned');
    timeEl.textContent = '0,00 s';
    draw();
    countdown(msg, st.timers, () => { st.phase = 'chop'; st.t0 = performance.now(); draw(); });
  }
  function next() {
    if (st.times.length >= ps.length) { st.times = []; st.i = 0; } else st.i = (st.i + 1) % ps.length;
    st.phase = 'ready';
    st.hits = 0;
    logEl.classList.remove('turned');
    msg.textContent = 'Pulsa «Empezar»';
    timeEl.textContent = '0,00 s';
    draw();
  }
  function draw() {
    const p = cur();
    drawLog();
    clear(who, h('span', { class: 'hk-chopper' }, avatar(p, 'lg'), axe), h('div', {}, h('b', {}, p.name),
      h('div', { class: 'tiny muted' }, `${need(p)} golpes${fue(p) ? ` (Fuerza ${fue(p) > 0 ? '+' : ''}${fue(p)})` : ''}`)));
    const all = st.times.length >= ps.length;
    clear(controls,
      st.phase === 'ready' && h('button', { class: 'btn primary lg', type: 'button', onclick: start }, `🪓 Empezar: ${p.name}`),
      (st.phase === 'chop' || st.phase === 'count') && [
        h('button', { class: 'btn lg hk-hit', type: 'button', onpointerdown: () => hit('a') }, '◀ Golpe (A)'),
        h('button', { class: 'btn lg hk-hit', type: 'button', onpointerdown: () => hit('l') }, 'Golpe (L) ▶')],
      st.phase === 'turn' && h('button', { class: 'btn primary lg', type: 'button', onclick: turn }, '🔄 Darse la vuelta (Espacio)'),
      st.phase === 'done' && h('button', { class: 'btn primary lg', type: 'button', onclick: next }, all ? '🔁 Otra ronda' : `➡️ Siguiente: ${ps[(st.i + 1) % ps.length].name}`));
    clear(results, [...st.times].sort((a, b) => a[1] - b[1]).map(([q, ms]) => h('li', {}, avatar(q), h('span', { class: 'grow' }, q.name), h('b', {}, `${secs(ms)} s`))));
  }
  const onKey = (e) => {
    if (e.repeat || typing()) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'l') hit(k);
    if (e.key === ' ') { e.preventDefault(); if (st.phase === 'turn') turn(); else if (st.phase === 'ready') start(); }
  };
  document.addEventListener('keydown', onKey);
  clear(arena,
    h('p', { class: 'small muted' }, 'Corta el tronco alternando las teclas A y L (o los dos botones). Repetir lado es un golpe torcido. A mitad, date la vuelta con Espacio para cortar la otra cara. Gana quien tarde menos.'),
    h('div', { class: 'hk-stage' }, who, h('div', { class: 'hk-wood' }, logEl), h('div', { class: 'aw-mid' }, msg, timeEl)),
    controls, results);
  draw();
  return () => { clearInterval(clock); st.timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
}

// --------------------------------------------------------- harri-jasotzaile
// 30 segundos para subir la piedra al hombro tantas veces como se pueda: tres tiempos (rodillas, pecho,
// hombro), cada uno pulsando cuando la aguja pasa por la zona dorada. La fatiga la estrecha; la Constitución la frena.
const STONES = { cilindro: ['Cilindro · 100 kg', 0.3], cubo: ['Cubo · 125 kg', 0.24], bola: ['Bola · 112 kg', 0.18] };
const STAGES = ['A las rodillas', 'Al pecho', '¡Al hombro!'];
function harri(arena, ps, { podium }) {
  const st = { i: 0, stone: prefs.get('kirolak.stone', 'cilindro'), phase: 'ready', stage: 0, lifts: 0, left: 30, pos: 0, dir: 1, zone: 0.5, stun: 0, results: [], timers: [] };
  const cur = () => ps[st.i];
  const width = () => Math.max(0.07, Math.min(0.5, STONES[st.stone][1] + 0.02 * fue(cur()) - st.lifts * Math.max(0.004, 0.014 - 0.003 * con(cur()))));
  const zoneEl = h('span', { class: 'lp-zone' });
  const needle = h('span', { class: 'lp-needle' });
  const bar = h('div', { class: 'lp-bar' }, zoneEl, needle);
  const stone = h('span', { class: 'hk-stone' }, '🪨');
  const lifter = h('div', { class: 'hk-lifter' });
  const msg = h('div', { class: 'aw-msg' }, 'Pulsa «Empezar»');
  const info = h('div', { class: 'hk-time' });
  const controls = h('div', { class: 'game-actions' });
  const results = h('ol', { class: 'hk-results' });
  let last = 0;

  function newZone() {
    const w = width();
    st.zone = w / 2 + Math.random() * (1 - w);
    Object.assign(zoneEl.style, { left: `${(st.zone - w / 2) * 100}%`, width: `${w * 100}%` });
  }
  const placeStone = () => { stone.dataset.stage = String(st.stage); };
  function tick() {
    const t = performance.now();
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (st.phase !== 'lift') return;
    st.left -= dt;
    if (st.left <= 0) return finish();
    if (t > st.stun) {
      st.pos += st.dir * (0.8 + 0.3 * st.stage) * dt;
      if (st.pos >= 1 || st.pos <= 0) { st.dir *= -1; st.pos = Math.max(0, Math.min(1, st.pos)); }
      needle.style.left = `${st.pos * 100}%`;
    }
    info.textContent = `${Math.ceil(st.left)} s · ${st.lifts} ${st.lifts === 1 ? 'alzada' : 'alzadas'}`;
  }
  function press() {
    if (st.phase !== 'lift' || performance.now() < st.stun) return;
    if (Math.abs(st.pos - st.zone) <= width() / 2) {
      st.stage += 1;
      sfx.pin();
      if (st.stage === 3) {
        st.lifts += 1;
        msg.textContent = `¡Arriba! ${st.lifts}`;
        sfx.coins();
        placeStone();
        st.stun = performance.now() + 450;
        st.timers.push(setTimeout(() => { st.stage = 0; placeStone(); sfx.thud(); }, 420));
      } else msg.textContent = STAGES[st.stage];
    } else {
      st.stage = 0;
      st.stun = performance.now() + 800;
      msg.textContent = '¡Se te cae!';
      sfx.thud();
      bump(bar, 'shake');
    }
    placeStone();
    newZone();
  }
  function start() {
    Object.assign(st, { phase: 'count', stage: 0, lifts: 0, left: 30, pos: 0, dir: 1, stun: 0 });
    newZone();
    placeStone();
    draw();
    countdown(msg, st.timers, () => { st.phase = 'lift'; msg.textContent = STAGES[0]; draw(); });
  }
  function finish() {
    st.phase = 'done';
    st.results.push([cur(), st.lifts]);
    msg.textContent = `${st.lifts} ${st.lifts === 1 ? 'alzada' : 'alzadas'}`;
    info.textContent = '¡Tiempo!';
    sfx.gong();
    if (st.results.length === ps.length) {
      const ranking = [...st.results].sort((a, b) => b[1] - a[1]);
      podium(ranking.map(([p]) => p));
      sfx.victory();
      bigBanner('¡Harri-jasotzaile txapeldun!', `${ranking[0][0].name} · ${ranking[0][1]} alzadas`, 'gold', 'crown');
    }
    draw();
  }
  function next() {
    if (st.results.length >= ps.length) { st.results = []; st.i = 0; } else st.i = (st.i + 1) % ps.length;
    Object.assign(st, { phase: 'ready', stage: 0, lifts: 0, left: 30 });
    msg.textContent = 'Pulsa «Empezar»';
    info.textContent = '';
    placeStone();
    draw();
  }
  function draw() {
    const p = cur();
    clear(lifter, h('div', { class: 'hk-lift-col' }, stone, avatar(p, 'lg')), h('div', {}, h('b', {}, p.name),
      h('div', { class: 'tiny muted' }, `Fuerza ${fue(p) >= 0 ? '+' : ''}${fue(p)} · Constitución ${con(p) >= 0 ? '+' : ''}${con(p)}`),
      h('ol', { class: 'hk-stages' }, STAGES.map((s, i) => h('li', { class: i < st.stage ? 'ok' : '' }, s)))));
    const all = st.results.length >= ps.length;
    clear(controls,
      st.phase === 'ready' && [selectEl(Object.entries(STONES).map(([k, [l]]) => [k, l]), st.stone, (v) => { st.stone = v; prefs.set('kirolak.stone', v); newZone(); }, { class: 'mini-sel', 'aria-label': 'Piedra' }),
        h('button', { class: 'btn primary lg', type: 'button', onclick: start }, `🪨 Empezar: ${p.name}`)],
      (st.phase === 'lift' || st.phase === 'count') && h('button', { class: 'btn primary lg hk-hit', type: 'button', onpointerdown: press }, '💪 ¡Aupa! (Espacio)'),
      st.phase === 'done' && h('button', { class: 'btn primary lg', type: 'button', onclick: next }, all ? '🔁 Otra ronda' : `➡️ Siguiente: ${ps[(st.i + 1) % ps.length].name}`));
    clear(results, [...st.results].sort((a, b) => b[1] - a[1]).map(([q, n]) => h('li', {}, avatar(q), h('span', { class: 'grow' }, q.name), h('b', {}, `${n} alzadas`))));
  }
  const onKey = (e) => {
    if (e.repeat || typing() || e.key !== ' ') return;
    e.preventDefault();
    if (st.phase === 'lift') press(); else if (st.phase === 'ready') start();
  };
  document.addEventListener('keydown', onKey);
  const timer = setInterval(tick, 16);
  clear(arena,
    h('p', { class: 'small muted' }, '30 segundos para subir la piedra al hombro tantas veces como puedas, en tres tiempos: pulsa Espacio (o «¡Aupa!») cuando la aguja pase por la zona dorada. Si fallas, la piedra se cae y vuelves a empezar. Con cada alzada cansa más.'),
    h('div', { class: 'hk-stage' }, lifter, h('div', { class: 'aw-mid' }, msg, info)),
    h('div', { class: 'lp' }, bar), controls, results);
  newZone();
  placeStone();
  draw();
  return () => { clearInterval(timer); st.timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
}

// ------------------------------------------------------------------ sokatira
// Dos equipos tiran de la cuerda, cada jugador con su tecla. El bombo marca el ritmo: tirar justo con el
// golpe cuenta doble, como cuando el equipo tira a una.
const KEYS = { gorri: ['q', 'w', 'e', 'r', 't'], urdin: ['p', 'o', 'i', 'u', 'y'] };
const TEAM = { gorri: '🟥 Gorriak', urdin: '🟦 Urdinak' };
const BEAT = 800;
function sokatira(arena, ps, { addPoints }) {
  if (ps.length < 2) { clear(arena, h('p', { class: 'muted' }, 'Hacen falta al menos dos jugadores para la sokatira.')); return null; }
  const team = new Map(ps.map((p, i) => [p.name, i % 2 ? 'urdin' : 'gorri']));
  const st = { v: 0, live: false, t0: 0, timers: [], beats: 0 };
  const members = (t) => ps.filter((p) => team.get(p.name) === t);
  const keyOf = (p) => KEYS[team.get(p.name)][members(team.get(p.name)).indexOf(p)] || '';
  const knot = h('span', { class: 'aw-knot' }, '🎗️');
  const rope = h('div', { class: 'aw-rope hk-rope' }, h('i', { class: 'hk-mark l' }), h('i', { class: 'hk-mark r' }), knot);
  const msg = h('div', { class: 'aw-msg' }, 'Pulsa «Empezar»');
  const drum = h('span', { class: 'hk-drum' }, '🥁');
  const sides = { gorri: h('div', { class: 'hk-team gorri' }), urdin: h('div', { class: 'hk-team urdin' }) };
  const place = () => { knot.style.left = `${50 + st.v * 45}%`; };
  let beatTimer = 0;

  function pull(p) {
    if (!st.live) return;
    const ph = (performance.now() - st.t0) % BEAT;
    const sync = Math.min(ph, BEAT - ph) <= 150;
    st.v += (team.get(p.name) === 'gorri' ? -1 : 1) * 0.011 * (1 + 0.15 * fue(p)) * (sync ? 2 : 1);
    place();
    const chipEl = sides[team.get(p.name)].querySelector(`[data-who="${CSS.escape(p.name)}"]`);
    if (chipEl) { chipEl.classList.toggle('sync', sync); bump(chipEl, 'pulled'); }
    if (Math.abs(st.v) >= 1) win(st.v < 0 ? 'gorri' : 'urdin');
  }
  function win(t) {
    st.live = false;
    clearInterval(beatTimer);
    msg.textContent = `¡Ganan los ${TEAM[t].split(' ')[1]}!`;
    members(t).forEach((p) => addPoints(p.name, 2));
    sfx.victory();
    bigBanner('¡Sokatira!', `Ganan ${TEAM[t]}: ${members(t).map((p) => p.name).join(', ')}`, 'gold', 'crown');
  }
  function start() {
    clearInterval(beatTimer);
    st.v = 0;
    st.live = false;
    place();
    countdown(msg, st.timers, () => {
      st.live = true;
      st.t0 = performance.now();
      beatTimer = setInterval(() => { sfx.tick(); bump(drum, 'beat'); msg.textContent = (st.beats++ % 2) ? '¡Tira!' : '¡Aupa!'; }, BEAT);
    });
  }
  function drawTeams() {
    for (const t of ['gorri', 'urdin']) {
      clear(sides[t], h('b', {}, TEAM[t]), members(t).map((p) => h('div', { class: 'hk-puller', dataset: { who: p.name } },
        avatar(p), h('span', { class: 'grow' }, p.name),
        h('button', { class: 'btn xs ghost', type: 'button', 'data-tip': 'Cambiar de equipo', onclick: () => { if (st.live) return; team.set(p.name, t === 'gorri' ? 'urdin' : 'gorri'); drawTeams(); } }, '⇄'),
        h('button', { class: 'btn sm hk-key', type: 'button', onpointerdown: () => pull(p) }, keyOf(p) ? keyOf(p).toUpperCase() : 'Tirar'))));
    }
  }
  const onKey = (e) => {
    if (e.repeat || typing()) return;
    const p = ps.find((x) => keyOf(x) === e.key.toLowerCase());
    if (p) pull(p);
  };
  document.addEventListener('keydown', onKey);
  clear(arena,
    h('p', { class: 'small muted' }, 'Gorriak contra Urdinak. Cada jugador tira con su tecla (o su botón); el bombo marca el ritmo y tirar justo con el golpe cuenta doble. Gana el equipo que lleve el lazo hasta su marca. Pulsa ⇄ para cambiar a alguien de equipo.'),
    h('div', { class: 'aw' }, sides.gorri, h('div', { class: 'aw-mid' }, drum, msg, rope), sides.urdin),
    h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: start }, '🪢 Empezar')));
  drawTeams();
  place();
  return () => { clearInterval(beatTimer); st.timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
}
