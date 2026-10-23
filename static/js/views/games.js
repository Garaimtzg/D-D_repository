// Minijuegos para los descansos y las tabernas, todos en el mismo ordenador: el cerdo (dados),
// carrera de bichos con apuestas, ganzúa, pulso, herri kirolak y acertijos. Los jugadores salen con su muñeco.
import { api } from '../core/api.js';
import { h, clear, avatar, selectEl, bigBanner, toast } from '../core/dom.js';
import { mod } from '../core/dnd.js';
import { roll } from '../core/dice.js';
import { sfx } from '../core/sfx.js';
import { kirolak } from './games-kirolak.js';

export default { id: 'juegos', title: 'Minijuegos', icon: 'juegos', hint: 'El cerdo, carreras, ganzúa, pulso, herri kirolak y acertijos', mount };

const GAMES = [
  ['cerdo', '🐷', 'El cerdo', 'Dados por turnos: acumula y plántate antes de sacar un 1.', pig],
  ['carrera', '🐸', 'Carrera de bichos', 'Cada uno apuesta por un corredor y a gritar.', race],
  ['ganzua', '🗝️', 'Ganzúa', 'Para la aguja en el punto justo para abrir la cerradura.', lockpick],
  ['pulso', '💪', 'Pulso', 'Dos rivales, dos teclas: gana quien pulse más rápido.', armWrestle],
  ['kirolak', '🪓', 'Herri kirolak', 'Aizkolari, piedra y sokatira: deporte rural vasco por la txapela.', (stage, chars) => kirolak(stage, players(chars))],
  ['acertijos', '❓', 'Acertijos', 'Adivinanzas para plantear a la mesa.', riddles],
];

async function mount(root, [gameId]) {
  const chars = await api.list('characters');
  const picker = h('div', { class: 'game-picker' });
  const stage = h('section', { class: 'panel game-stage' });
  let cleanup = null;
  function open(id) {
    cleanup?.();
    const g = GAMES.find((x) => x[0] === id) || GAMES[0];
    history.replaceState(null, '', `#/juegos/${g[0]}`);
    clear(picker, GAMES.map(([gid, emo, name, desc]) => h('button', { class: 'game-card', type: 'button', 'aria-pressed': String(gid === g[0]), onclick: () => { sfx.click(); open(gid); } },
      h('span', { class: 'game-emoji' }, emo), h('b', {}, name), h('span', { class: 'tiny muted' }, desc))));
    clear(stage);
    cleanup = g[4](stage, chars) || null;
  }
  root.append(h('div', { class: 'stack' }, picker, stage));
  open(gameId);
  return () => cleanup?.();
}

const players = (chars) => {
  const list = chars.filter((c) => c.type === 'jugador');
  return list.length ? list : [{ name: 'Jugador 1', color: '#5b9cff' }, { name: 'Jugador 2', color: '#e0524a' }];
};
const head = (title, text, ...extra) => h('div', { class: 'game-head' }, h('div', { class: 'grow' }, h('h2', {}, title), h('p', { class: 'muted' }, text)), ...extra);

// ---------------------------------------------------------------- el cerdo
function pig(stage, chars) {
  const ps = players(chars).map((p) => ({ ...p, score: 0 }));
  const st = { turn: 0, bank: 0, goal: 50, busy: false, over: false, last: null };
  const cur = () => ps[st.turn];
  const next = () => { st.turn = (st.turn + 1) % ps.length; };
  function hold() {
    cur().score += st.bank;
    st.bank = 0;
    sfx.coins();
    if (cur().score >= st.goal) {
      st.over = true;
      sfx.victory();
      bigBanner('¡Victoria!', `${cur().name} gana al cerdo`, 'gold', 'crown');
    } else next();
    draw();
  }
  async function throwDie() {
    st.busy = true;
    draw();
    const p = cur();
    const r = await roll('1d6', { label: `${p.name}: el cerdo`, who: p.name, color: p.color, virtual: true });
    st.busy = false;
    if (!r) return draw();
    st.last = r.total;
    if (r.total === 1) {
      sfx.fail();
      toast(`¡Un 1! ${p.name} pierde ${st.bank} puntos.`, { iconName: 'skull' });
      st.bank = 0;
      next();
    } else st.bank += r.total;
    if (p.score + st.bank >= st.goal) return hold();
    draw();
  }
  function draw() {
    clear(stage,
      head('🐷 El cerdo', 'Tira el d6 tantas veces como quieras y ve sumando. Si sale un 1, pierdes lo de este turno. Plántate para guardarlo. Gana quien llegue antes a la meta.',
        h('label', { class: 'row nowrap small' }, 'Meta', selectEl([30, 50, 100], st.goal, (v) => { st.goal = Number(v); draw(); }, { class: 'mini-sel', 'aria-label': 'Meta' }))),
      h('div', { class: 'pig-players' }, ps.map((p, i) => h('div', { class: `pig-p ${i === st.turn && !st.over ? 'on' : ''}` },
        avatar(p, 'lg'), h('b', {}, p.name),
        h('div', { class: 'pig-bar' }, h('i', { style: { width: `${Math.min(100, (p.score / st.goal) * 100)}%` } })),
        h('span', { class: 'pig-score' }, p.score)))),
      st.over
        ? h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => { ps.forEach((p) => { p.score = 0; }); Object.assign(st, { turn: 0, bank: 0, over: false }); draw(); } }, '🔁 Otra partida'))
        : h('div', { class: 'game-actions' },
          h('span', { class: 'pig-bank' }, 'Turno de ', h('b', {}, cur().name), ' · este turno lleva ', h('b', { class: 'gold' }, st.bank)),
          h('button', { class: 'btn primary lg', type: 'button', disabled: st.busy, onclick: throwDie }, '🎲 Tirar'),
          h('button', { class: 'btn lg', type: 'button', disabled: st.busy || !st.bank, onclick: hold }, '✋ Plantarse')));
  }
  draw();
}

// ------------------------------------------------------- carrera de bichos
const RACERS = [['🐸', 'Saltarina'], ['🐌', 'Babosín'], ['🐢', 'Doña Concha'], ['🦆', 'Cuac'], ['🐔', 'Pepita']];
function race(stage, chars) {
  const ps = players(chars);
  const bets = new Map();
  let timer = null;
  let pos = RACERS.map(() => 0);
  let order = [];
  const lanes = RACERS.map(([emo, name]) => {
    const runner = h('span', { class: 'runner' }, emo);
    return { el: h('div', { class: 'lane' }, h('span', { class: 'lane-name' }, name), h('div', { class: 'track' }, runner, h('span', { class: 'finish' }))), runner };
  });
  const result = h('div', { class: 'race-result' });
  const go = h('button', { class: 'btn primary lg', type: 'button', onclick: start }, '🏁 ¡Salida!');
  const place = () => lanes.forEach((l, i) => { l.runner.style.left = `calc(${pos[i]}% - ${pos[i] * 0.36}px)`; });
  function start() {
    clearInterval(timer);
    pos = RACERS.map(() => 0);
    order = [];
    clear(result);
    go.disabled = true;
    sfx.drum();
    timer = setInterval(() => {
      RACERS.forEach((_, i) => {
        if (pos[i] >= 100) return;
        pos[i] = Math.min(100, pos[i] + Math.random() * 2.6 + (Math.random() < 0.06 ? 5 : 0)); // de vez en cuando, un acelerón
        if (pos[i] >= 100) order.push(i);
      });
      place();
      if (order.length === RACERS.length) finish();
    }, 80);
  }
  function finish() {
    clearInterval(timer);
    go.disabled = false;
    const win = order[0];
    const winners = ps.filter((p) => bets.get(p.name) === win);
    sfx.victory();
    bigBanner(`¡Gana ${RACERS[win][1]}!`, winners.length ? `Cobran: ${winners.map((p) => p.name).join(', ')}` : 'Nadie había apostado por ella', 'gold', 'crown');
    clear(result, h('ol', {}, order.slice(0, 3).map((i) => h('li', {}, RACERS[i][0], ' ', RACERS[i][1]))),
      winners.length ? h('p', {}, '💰 Cobran: ', h('b', {}, winners.map((p) => p.name).join(', '))) : h('p', { class: 'muted' }, 'La banca gana.'));
  }
  clear(stage,
    head('🐸 Carrera de bichos', 'Cada jugador apuesta por un corredor (lo que se apueste, en oro o en honor, lo decide la mesa). Luego, ¡salida!'),
    h('div', { class: 'bets' }, ps.map((p) => h('label', { class: 'bet' }, avatar(p), h('b', {}, p.name),
      selectEl([['', '— sin apuesta —'], ...RACERS.map(([emo, name], i) => [i, `${emo} ${name}`])], '', (v) => { if (v === '') bets.delete(p.name); else bets.set(p.name, Number(v)); }, { class: 'mini-sel', 'aria-label': `Apuesta de ${p.name}` })))),
    h('div', { class: 'race' }, lanes.map((l) => l.el)),
    h('div', { class: 'game-actions' }, go), result);
  place();
  return () => clearInterval(timer);
}

// ------------------------------------------------------------------ ganzúa
const LOCKS = { facil: ['Fácil', 3, 0.24, 0.5], media: ['Media', 4, 0.16, 0.7], dificil: ['Difícil', 5, 0.1, 0.95] }; // pernos, ancho del hueco, velocidad
function lockpick(stage) {
  const st = { diff: 'media', pin: 0, picks: 3, pos: 0, dir: 1, zone: 0.5, over: '' };
  const zone = h('span', { class: 'lp-zone' });
  const needle = h('span', { class: 'lp-needle' });
  const bar = h('div', { class: 'lp-bar' }, zone, needle);
  const info = h('div', { class: 'lp-info' });
  let timer = 0;
  let last = 0;
  const cfg = () => LOCKS[st.diff];
  function newZone() {
    const w = cfg()[2];
    st.zone = w / 2 + Math.random() * (1 - w);
    Object.assign(zone.style, { left: `${(st.zone - w / 2) * 100}%`, width: `${w * 100}%` });
  }
  function reset() { Object.assign(st, { pin: 0, picks: 3, pos: 0, dir: 1, over: '' }); newZone(); drawInfo(); }
  function drawInfo() {
    clear(info,
      h('div', { class: 'lp-pins' }, Array.from({ length: cfg()[1] }, (_, i) => h('span', { class: `lp-pin ${i < st.pin ? 'set' : ''}` }))),
      h('span', {}, 'Ganzúas: ', '🗝️'.repeat(st.picks) || '—'),
      st.over && h('b', { class: st.over === 'win' ? 'gold' : 'bad-text' }, st.over === 'win' ? '¡Cerradura abierta!' : 'Se han roto todas las ganzúas'),
      st.over && h('button', { class: 'btn sm', type: 'button', onclick: reset }, '🔁 Otra cerradura'));
  }
  function tick(t) {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (!st.over) {
      st.pos += st.dir * cfg()[3] * (1 + st.pin * 0.18) * dt;
      if (st.pos >= 1 || st.pos <= 0) { st.dir *= -1; st.pos = Math.max(0, Math.min(1, st.pos)); }
      needle.style.left = `${st.pos * 100}%`;
    }
  }
  function attempt() {
    if (st.over) return;
    if (Math.abs(st.pos - st.zone) <= cfg()[2] / 2) {
      st.pin += 1;
      sfx.pin();
      if (st.pin >= cfg()[1]) { st.over = 'win'; sfx.coins(); bigBanner('¡Abierta!', `Cerradura ${cfg()[0].toLowerCase()}`, 'gold', 'crown'); } else newZone();
    } else {
      st.picks -= 1;
      sfx.fail();
      bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake');
      if (!st.picks) st.over = 'lose';
    }
    drawInfo();
  }
  const onKey = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement?.tagName)) { e.preventDefault(); attempt(); } };
  document.addEventListener('keydown', onKey);
  clear(stage,
    head('🗝️ Ganzúa', 'La aguja va y viene: pulsa «¡Ya!» (o la barra espaciadora) cuando esté sobre el hueco dorado para levantar cada perno. Cada fallo rompe una ganzúa.',
      h('label', { class: 'row nowrap small' }, 'Cerradura', selectEl(Object.entries(LOCKS).map(([k, [l]]) => [k, l]), st.diff, (v) => { st.diff = v; reset(); }, { class: 'mini-sel', 'aria-label': 'Dificultad' }))),
    h('div', { class: 'lp' }, bar, info),
    h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: attempt }, '✋ ¡Ya!')));
  reset();
  timer = setInterval(() => tick(performance.now()), 16); // temporizador: sigue aunque el navegador no pinte fotogramas
  return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
}

// ------------------------------------------------------------------- pulso
function armWrestle(stage, chars) {
  const pool = chars.length ? chars : players(chars);
  const pick = [pool[0], pool[1] || pool[0]];
  const st = { v: 0, live: false, timers: [] };
  const knot = h('span', { class: 'aw-knot' }, '✊');
  const msg = h('div', { class: 'aw-msg' }, 'Pulsa «Empezar»');
  const sides = [h('div', { class: 'aw-side' }), h('div', { class: 'aw-side' })];
  const strength = (i) => 1 + Math.max(0, mod(pick[i]?.abilities?.fue)) * 0.12; // la Fuerza ayuda un poco
  const place = () => { knot.style.left = `${50 + st.v * 50}%`; };
  function push(i) {
    if (!st.live) return;
    st.v += (i === 0 ? -1 : 1) * 0.03 * strength(i);
    place();
    if (Math.abs(st.v) >= 1) {
      st.live = false;
      const w = pick[st.v < 0 ? 0 : 1];
      msg.textContent = `¡Gana ${w.name}!`;
      sfx.victory();
      bigBanner('¡Pulso ganado!', w.name, 'gold', 'crown');
    }
  }
  function start() {
    st.timers.forEach(clearTimeout);
    st.v = 0;
    st.live = false;
    place();
    ['3', '2', '1'].forEach((n, i) => st.timers.push(setTimeout(() => { msg.textContent = n; sfx.tick(); }, i * 700)));
    st.timers.push(setTimeout(() => { msg.textContent = '¡YA!'; sfx.gong(); st.live = true; }, 2100));
  }
  const onKey = (e) => {
    if (e.repeat || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    if (e.key.toLowerCase() === 'a') push(0);
    if (e.key.toLowerCase() === 'l') push(1);
  };
  document.addEventListener('keydown', onKey);
  const drawSide = (i) => clear(sides[i], avatar(pick[i], 'lg'),
    selectEl(pool.map((c, j) => [j, c.name]), pool.indexOf(pick[i]), (v) => { pick[i] = pool[Number(v)]; drawSide(i); }, { class: 'mini-sel', 'aria-label': `Rival ${i + 1}` }),
    h('button', { class: 'btn lg aw-btn', type: 'button', onpointerdown: () => push(i) }, i === 0 ? 'Tecla A' : 'Tecla L'));
  drawSide(0);
  drawSide(1);
  clear(stage,
    head('💪 Pulso', 'Dos rivales frente a frente: el de la izquierda machaca la tecla A y el de la derecha la L (o sus botones). Quien lleve el puño a su lado, gana. La Fuerza de la ficha ayuda un poco.'),
    h('div', { class: 'aw' }, sides[0], h('div', { class: 'aw-mid' }, msg, h('div', { class: 'aw-rope' }, knot)), sides[1]),
    h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: start }, '💪 Empezar')));
  place();
  return () => { st.timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
}

// --------------------------------------------------------------- acertijos
const RIDDLES = [
  ['Oro parece, plata no es. ¿Qué es?', 'El plátano'],
  ['Tiene dientes y no come, tiene barbas y no es hombre.', 'El ajo'],
  ['Cuanto más le quitas, más grande se hace.', 'Un agujero'],
  ['Cuanto más me secas, más mojada estoy.', 'La toalla'],
  ['Tengo agujas y no sé coser, tengo números y no sé leer.', 'El reloj'],
  ['Todos me pisan y yo no piso a nadie; todos preguntan por mí y yo no pregunto por nadie.', 'El camino'],
  ['Guardo tesoros sin tener manos; me abre el hierro y me cierran los avaros.', 'Un cofre'],
  ['Nazco en la montaña, muero en el mar y nunca dejo de caminar.', 'El río'],
  ['Te sigo de día, me escondo de noche y, si enciendes una vela, vuelvo sin reproche.', 'La sombra'],
  ['Si me nombras, desaparezco.', 'El silencio'],
  ['Cuanto más grande es, menos se ve.', 'La oscuridad'],
  ['Tiene cuello y no tiene cabeza, tiene brazos y no tiene manos.', 'La camisa'],
];
function riddles(stage) {
  let i = Math.floor(Math.random() * RIDDLES.length);
  let shown = false;
  function draw() {
    const [q, a] = RIDDLES[i];
    clear(stage,
      head('❓ Acertijos', 'Léelo en voz alta o déjalo en pantalla. Cuando la mesa se rinda (o acierte), muestra la respuesta.'),
      h('blockquote', { class: 'riddle' }, q),
      h('div', { class: 'riddle-answer' }, shown ? h('b', {}, a) : h('span', { class: 'muted' }, '???')),
      h('div', { class: 'game-actions' },
        h('button', { class: 'btn lg', type: 'button', onclick: () => { shown = !shown; if (shown) sfx.magic(); draw(); } }, shown ? '🙈 Ocultar' : '👁️ Ver respuesta'),
        h('button', { class: 'btn primary lg', type: 'button', onclick: () => { i = (i + 1 + Math.floor(Math.random() * (RIDDLES.length - 1))) % RIDDLES.length; shown = false; sfx.page(); draw(); } }, '🔁 Otro')));
  }
  draw();
}
