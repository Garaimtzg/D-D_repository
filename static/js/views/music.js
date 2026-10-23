// Música: tus canciones por ambiente (con disco que gira y visualizador) y ambientes
// sintetizados que no necesitan ficheros: lluvia, viento, hoguera, cueva y taberna.
import { api } from '../core/api.js';
import { h, clear, icon, segmented, confirmDialog, toast, toastError, pickFiles, dropZone } from '../core/dom.js';
import { player } from '../core/audio.js';
import { ambience, AMBIENCES } from '../core/ambience.js';
import { sfx } from '../core/sfx.js';

export default { id: 'musica', title: 'Música', icon: 'musica', hint: 'Música y ambientes · tecla 9', mount };

const MOODS = [['Taberna', '🍺'], ['Exploración', '🧭'], ['Combate', '⚔️'], ['Jefe', '🐉'], ['Misterio', '🕯️'], ['Mazmorra', '💀'], ['Calma', '🌙'], ['Otra', '🎵']];
// Efectos sueltos para la mesa, como los botones de un «soundboard» (Syrinscape): suenan al pulsar.
const EFFECTS = [['sword', '⚔️', 'Espadas'], ['hit', '💥', 'Golpe'], ['blast', '🔥', 'Explosión'], ['thunder', '⛈️', 'Trueno'], ['magic', '✨', 'Magia'],
  ['heal', '💚', 'Curación'], ['shield', '🛡️', 'Escudo'], ['coins', '🪙', 'Monedas'], ['gong', '🔔', 'Gong'], ['drum', '🥁', 'Redoble'],
  ['victory', '🏆', 'Victoria'], ['levelup', '⭐', 'Fanfarria'], ['fail', '📉', 'Fracaso'], ['death', '💀', 'Muerte'], ['whoosh', '💨', 'Silbido'],
  ['unroll', '📜', 'Pergamino'], ['page', '📖', 'Página'], ['ping', '🔊', 'Aviso']];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function mount(root) {
  const state = { tracks: await api.list('tracks'), mood: 'Todas' };
  const filtered = () => state.tracks.filter((t) => state.mood === 'Todas' || t.mood === state.mood);
  let raf = 0;

  async function upload(files) {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|flac)$/i.test(f.name));
    if (!audio.length) return toast('Elige ficheros de audio (MP3, OGG, WAV, M4A o FLAC).', { kind: 'error' });
    toast(`Subiendo ${audio.length} canción(es)…`, { iconName: 'upload' });
    for (const f of audio) {
      try {
        const up = await api.upload(f);
        state.tracks.push(await api.create('tracks', { name: f.name.replace(/\.[^.]+$/, ''), url: up.url, mood: state.mood !== 'Todas' ? state.mood : 'Otra' }));
      } catch (e) { toastError(e); }
    }
    player.setQueue(filtered());
    drawAll();
  }

  // ------------------------------------------------------------- reproductor
  const vinyl = h('div', { class: 'vinyl' }, h('div', { class: 'vinyl-label' }, icon('musica', 20)));
  const title = h('div', { class: 'np-title' });
  const sub = h('div', { class: 'np-sub' });
  const fill = h('i');
  const bar = h('div', { class: 'np-bar', role: 'slider', 'aria-label': 'Progreso de la canción', tabindex: 0 }, fill);
  const times = h('div', { class: 'np-times tnum' });
  const playBtn = h('button', { class: 'btn primary icon lg play-btn', type: 'button', 'aria-label': 'Reproducir o pausar', onclick: () => { if (!player.current) player.setQueue(filtered()); player.toggle(); } });
  const viz = h('canvas', { class: 'viz', width: 600, height: 90, 'aria-hidden': 'true' });
  bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); });
  bar.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') player.seek(Math.min(1, player.progress + 0.05)); if (e.key === 'ArrowLeft') player.seek(Math.max(0, player.progress - 0.05)); });

  const hero = h('section', { class: 'panel ornate np' },
    vinyl,
    h('div', { class: 'np-body' },
      h('div', { class: 'eyebrow', style: { marginTop: 0 } }, 'Sonando'), title, sub, viz, bar, times,
      h('div', { class: 'row np-ctl' },
        h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Anterior', onclick: () => player.prev() }, icon('prev', 18)),
        playBtn,
        h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Siguiente', onclick: () => player.next() }, icon('next', 18)),
        h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Parar', onclick: () => player.stop() }, icon('stop', 18)),
        segmented([['list', '🔁 Lista'], ['one', '🔂 Canción'], ['off', 'Sin repetir']], player.loop, (v) => { player.loop = v; }),
        h('button', { class: 'btn sm', type: 'button', 'aria-pressed': String(player.shuffle), onclick: (e) => { player.shuffle = !player.shuffle; e.currentTarget.setAttribute('aria-pressed', String(player.shuffle)); } }, '🔀 Aleatorio'),
        h('label', { class: 'row nowrap small muted vol' }, icon('volume', 16),
          h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: player.volume, 'aria-label': 'Volumen', oninput: (e) => { player.volume = Number(e.target.value); } })))));

  function drawNow(p, kind) {
    const cur = p.current;
    fill.style.width = `${p.progress * 100}%`;
    const t = p.time;
    times.textContent = cur ? `${fmt(t.cur)} / ${t.dur ? fmt(t.dur) : '–:––'}` : '';
    if (kind === 'time') return;
    vinyl.classList.toggle('spin', p.playing);
    title.textContent = cur ? cur.name : 'Nada sonando';
    sub.textContent = cur ? `${MOODS.find(([m]) => m === cur.mood)?.[1] || '🎵'} ${cur.mood}` : 'Elige una canción o una escena';
    clear(playBtn, icon(p.playing ? 'pause' : 'play', 22));
    drawList();
  }

  function vizLoop() {
    raf = requestAnimationFrame(vizLoop);
    const g = viz.getContext('2d');
    const W = viz.width; const H = viz.height;
    g.clearRect(0, 0, W, H);
    const an = player.analyser;
    const n = 48;
    const data = new Uint8Array(an ? an.frequencyBinCount : n);
    if (an && player.playing) an.getByteFrequencyData(data);
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = (data[i] || 0) / 255;
      const bh = Math.max(3, v * H);
      const grad = g.createLinearGradient(0, H - bh, 0, H);
      grad.addColorStop(0, '#f8dc94'); grad.addColorStop(1, '#a8782a');
      g.fillStyle = grad;
      g.globalAlpha = 0.35 + v * 0.65;
      g.fillRect(i * bw + 2, H - bh, bw - 4, bh);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------- escenas y lista
  const scenesEl = h('div', { class: 'scenes' });
  const listEl = h('ul', { class: 'tracks' });
  const filterEl = h('div');

  function drawScenes() {
    clear(scenesEl, MOODS.map(([m, emoji]) => {
      const n = state.tracks.filter((t) => t.mood === m).length;
      return h('button', { class: `scene ${player.current?.mood === m && player.playing ? 'on' : ''}`, type: 'button', disabled: !n,
        'data-tip': n ? `Poner música de ${m.toLowerCase()}` : `Aún no hay canciones de ${m.toLowerCase()}`,
        onclick: () => {
          const list = state.tracks.filter((t) => t.mood === m);
          player.setQueue(list);
          player.play(list[Math.floor(Math.random() * list.length)]);
        } }, h('span', { class: 'scene-emoji' }, emoji), h('b', {}, m), h('span', { class: 'tiny muted' }, `${n} ${n === 1 ? 'canción' : 'canciones'}`));
    }));
  }

  function drawList() {
    const cur = player.current;
    clear(listEl, filtered().length ? filtered().map((t, i) => h('li', { class: cur?.id === t.id ? 'playing' : '' },
      h('span', { class: 'track-n tnum' }, cur?.id === t.id && player.playing ? h('span', { class: 'eq on' }, h('i'), h('i'), h('i')) : i + 1),
      h('button', { class: 'track-name', type: 'button', onclick: () => { player.setQueue(filtered()); player.play(t); } }, t.name),
      h('select', { 'aria-label': 'Ambiente', class: 'mini-sel', onchange: (e) => { t.mood = e.target.value; api.update('tracks', t).catch(toastError); drawScenes(); } },
        MOODS.map(([m, e]) => h('option', { value: m, selected: t.mood === m }, `${e} ${m}`))),
      h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Eliminar ${t.name}`, onclick: async () => {
        if (!(await confirmDialog(`Se eliminará «${t.name}».`))) return;
        try {
          await api.remove('tracks', t.id);
          await api.removeUpload(t.url);
          if (player.current?.id === t.id) player.stop();
          state.tracks = state.tracks.filter((x) => x !== t);
          player.setQueue(filtered());
          drawAll();
        } catch (e) { toastError(e); }
      } }, icon('trash', 14))))
      : h('li', { class: 'muted small' }, 'No hay canciones en esta lista. Arrástralas aquí o usa «Añadir canciones».'));
  }

  function drawFilter() {
    clear(filterEl, segmented([['Todas', 'Todas', state.tracks.length], ...MOODS.map(([m, e]) => [m, `${e} ${m}`])], state.mood,
      (v) => { state.mood = v; drawList(); }));
  }
  const drawAll = () => { drawScenes(); drawFilter(); drawList(); };

  // ---------------------------------------------------------------- ambientes
  const ambEl = h('div', { class: 'ambiences' });
  function drawAmb() {
    clear(ambEl, AMBIENCES.map(([key, label, emoji]) => {
      const on = ambience.isOn(key);
      return h('div', { class: `amb ${on ? 'on' : ''}` },
        h('button', { class: 'amb-btn', type: 'button', 'aria-pressed': String(on), onclick: () => { ambience.toggle(key); drawAmb(); } },
          h('span', { class: 'amb-emoji' }, emoji), h('b', {}, label), h('span', { class: 'tiny' }, on ? 'Sonando' : 'Apagado')),
        h('input', { type: 'range', min: 0.02, max: 1, step: 0.01, value: ambience.volume(key), disabled: !on, 'aria-label': `Volumen de ${label}`,
          oninput: (e) => ambience.setVolume(key, Number(e.target.value)) }));
    }), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { ambience.stopAll(); drawAmb(); } }, icon('stop', 14), 'Silenciar ambientes'));
  }

  const library = dropZone(h('section', { class: 'panel library' },
    h('div', { class: 'panel-head' }, h('h3', {}, icon('list'), 'Tus canciones'),
      h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: async () => upload(await pickFiles('audio/*', true)) }, icon('upload', 15), 'Añadir canciones'))),
    filterEl, listEl), upload);

  root.append(h('div', { class: 'music-layout' },
    h('div', { class: 'stack' }, hero,
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('sparkle'), 'Escenas'), h('span', { class: 'tiny muted' }, 'Un clic cambia la música de la mesa')), scenesEl),
      library),
    h('aside', { class: 'stack' },
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('cloud'), 'Ambientes')),
        h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Sonidos generados al momento, sin ficheros ni internet. Mézclalos con la música.'), ambEl),
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('bolt'), 'Efectos')),
        h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Un clic y suena en la mesa (con el sonido activado).'),
        h('div', { class: 'fx-board' }, EFFECTS.map(([key, emoji, label]) => h('button', { class: 'fx-btn', type: 'button', onclick: () => sfx[key]() }, h('span', {}, emoji), label)))),
      h('section', { class: 'panel small muted' }, h('div', { class: 'panel-head' }, h('h3', {}, icon('compass'), 'Más música')),
        'Música gratuita para rol: ',
        h('a', { href: 'https://tabletopaudio.com', target: '_blank', rel: 'noopener' }, 'Tabletop Audio'), ' · ',
        h('a', { href: 'https://www.youtube.com/results?search_query=dnd+ambience', target: '_blank', rel: 'noopener' }, 'ambientes en YouTube'),
        '. Descarga las canciones y añádelas aquí.'))));

  if (!player.current) player.setQueue(filtered());
  drawAll();
  drawAmb();
  vizLoop();
  const off = player.subscribe(drawNow);
  return () => { off(); cancelAnimationFrame(raf); };
}
