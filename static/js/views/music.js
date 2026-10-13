// Música: sube canciones al servidor y reprodúcelas en lista mientras juegas.
import { api } from '../core/api.js';
import { h, clear, segmented, confirmDialog, toast, toastError, pickFiles } from '../core/dom.js';
import { player } from '../core/audio.js';

const ICON = '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>';
const MOODS = ['Taberna', 'Exploración', 'Combate', 'Jefe', 'Misterio', 'Mazmorra', 'Calma', 'Otra'];

export default { id: 'musica', title: 'Música', icon: ICON, mount };

async function mount(root) {
  const state = { tracks: await api.list('tracks'), mood: 'Todas' };
  const listEl = h('ul', { class: 'tracks' });
  const nowEl = h('div', { class: 'now-playing' });
  const filtered = () => state.tracks.filter((t) => state.mood === 'Todas' || t.mood === state.mood);

  async function upload(files) {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|flac)$/i.test(f.name));
    if (!audio.length) return toast('Elige ficheros de audio (MP3, OGG, WAV, M4A, FLAC).');
    toast(`Subiendo ${audio.length} canción(es)…`);
    for (const f of audio) {
      try {
        const up = await api.upload(f);
        state.tracks.push(await api.create('tracks', { name: f.name.replace(/\.[^.]+$/, ''), url: up.url, mood: 'Otra' }));
      } catch (e) { toastError(e); }
    }
    player.setQueue(filtered());
    draw();
  }

  function draw() {
    const cur = player.current;
    clear(listEl, filtered().length ? filtered().map((t) => h('li', { class: cur?.id === t.id ? 'playing' : '' },
      h('button', { class: 'btn sm icon', type: 'button', 'aria-label': `Reproducir ${t.name}`, onclick: () => { player.setQueue(filtered()); player.play(t); } },
        cur?.id === t.id && player.playing ? '❚❚' : '▶'),
      h('span', { class: 'grow' }, t.name),
      h('select', { 'aria-label': 'Ambiente', style: 'width:auto', onchange: (e) => { t.mood = e.target.value; api.update('tracks', t).catch(toastError); } },
        MOODS.map((m) => h('option', { value: m, selected: t.mood === m }, m))),
      h('button', { class: 'btn sm icon danger', type: 'button', 'aria-label': `Eliminar ${t.name}`, onclick: async () => {
        if (!(await confirmDialog(`Se eliminará «${t.name}».`))) return;
        try {
          await api.remove('tracks', t.id);
          await api.removeUpload(t.url);
          if (player.current?.id === t.id) player.stop();
          state.tracks = state.tracks.filter((x) => x !== t);
          player.setQueue(filtered());
          draw();
        } catch (e) { toastError(e); }
      } }, '✕')))
      : h('li', { class: 'muted' }, 'No hay canciones en esta lista.'));
    clear(nowEl, cur ? [h('span', { class: 'muted small' }, 'Sonando'), h('b', {}, ` ${cur.name}`)] : h('span', { class: 'muted' }, 'Nada sonando'));
  }

  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: player.volume, 'aria-label': 'Volumen', oninput: (e) => { player.volume = Number(e.target.value); } });
  const drop = h('div', { class: 'card dropzone stack' },
    h('div', { class: 'row between' }, h('h3', {}, 'Música de rol'),
      h('button', { class: 'btn primary', type: 'button', onclick: async () => upload(await pickFiles('audio/*', true)) }, '+ Añadir canciones')),
    h('p', { class: 'muted', style: { margin: 0 } }, 'Arrastra aquí tus canciones. Se guardan en el servidor y siguen sonando aunque cambies de sección.'),
    nowEl,
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => player.prev() }, '«'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { if (!player.current) player.setQueue(filtered()); player.toggle(); } }, '▶ / ❚❚'),
      h('button', { class: 'btn', type: 'button', onclick: () => player.next() }, '»'),
      h('button', { class: 'btn', type: 'button', onclick: () => player.stop() }, '■'),
      segmented([['list', 'Repetir lista'], ['one', 'Repetir canción'], ['off', 'Sin repetir']], player.loop, (v) => { player.loop = v; }),
      h('label', { class: 'row small muted' }, 'Volumen', vol)));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]); });

  root.append(h('div', { class: 'stack' }, drop,
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, 'Listas por ambiente'),
        segmented(['Todas', ...MOODS].map((m) => [m, m]), state.mood, (v) => { state.mood = v; player.setQueue(filtered()); draw(); })),
      listEl),
    h('div', { class: 'card small muted' }, 'Más música gratuita para rol: ',
      h('a', { href: 'https://tabletopaudio.com', target: '_blank', rel: 'noopener' }, 'Tabletop Audio'), ' · ',
      h('a', { href: 'https://www.youtube.com/results?search_query=dnd+ambience', target: '_blank', rel: 'noopener' }, 'ambientes en YouTube'))));

  if (!player.current) player.setQueue(filtered());
  draw();
  return player.subscribe(draw);
}
