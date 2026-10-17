// Reproductor de música único: sigue sonando aunque cambies de sección.
// Hace un fundido al cambiar de canción y expone un analizador para el visualizador.
const audio = new Audio();
audio.preload = 'auto';
const state = { queue: [], index: -1, loop: 'list', volume: 0.8, shuffle: false };
const listeners = new Set();
let ctx = null;
let analyser = null;
let fadeTimer = 0;

const emit = () => listeners.forEach((fn) => fn(player));

function ensureGraph() { // el analizador necesita un AudioContext, que solo se crea tras un gesto del usuario
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    src.connect(analyser).connect(ctx.destination);
  } catch { ctx = null; analyser = null; }
}

function fadeTo(target, ms, then) {
  clearInterval(fadeTimer);
  const start = audio.volume;
  const t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    audio.volume = start + (target - start) * k;
    if (k >= 1) { clearInterval(fadeTimer); then?.(); }
  }, 30);
}

audio.addEventListener('ended', () => {
  if (state.loop === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (state.index < state.queue.length - 1 || state.loop === 'list') player.next();
  else emit();
});
audio.addEventListener('play', emit);
audio.addEventListener('pause', emit);
audio.addEventListener('timeupdate', () => listeners.forEach((fn) => fn(player, 'time')));

export const player = {
  audio,
  get current() { return state.queue[state.index] || null; },
  get playing() { return !audio.paused; },
  get loop() { return state.loop; },
  set loop(v) { state.loop = v; emit(); },
  get shuffle() { return state.shuffle; },
  set shuffle(v) { state.shuffle = v; emit(); },
  get analyser() { return analyser; },
  get progress() { return audio.duration ? audio.currentTime / audio.duration : 0; },
  get time() { return { cur: audio.currentTime || 0, dur: audio.duration || 0 }; },
  seek(ratio) { if (audio.duration) audio.currentTime = ratio * audio.duration; },
  setQueue(tracks) {
    const cur = this.current;
    state.queue = tracks;
    state.index = cur ? tracks.findIndex((t) => t.id === cur.id) : -1;
    emit();
  },
  play(track) {
    ensureGraph();
    ctx?.resume?.();
    const start = (t) => {
      state.index = state.queue.findIndex((x) => x.id === t.id);
      audio.src = t.url;
      audio.volume = 0;
      audio.play().then(() => fadeTo(state.volume, 700)).catch(() => {});
      emit();
    };
    if (track && track.id !== this.current?.id) {
      if (this.playing) fadeTo(0, 400, () => start(track));
      else start(track);
    } else if (!audio.src && state.queue.length) start(state.queue[0]);
    else { audio.volume = 0; audio.play().then(() => fadeTo(state.volume, 500)).catch(() => {}); }
  },
  pause() { fadeTo(0, 300, () => audio.pause()); },
  toggle() { this.playing ? this.pause() : this.play(); },
  next() {
    if (!state.queue.length) return;
    const i = state.shuffle && state.queue.length > 1
      ? (state.index + 1 + Math.floor(Math.random() * (state.queue.length - 1))) % state.queue.length
      : (state.index + 1) % state.queue.length;
    this.play(state.queue[i]);
  },
  prev() {
    if (!state.queue.length) return;
    if (audio.currentTime > 4) { audio.currentTime = 0; return; }
    this.play(state.queue[(state.index - 1 + state.queue.length) % state.queue.length]);
  },
  stop() { fadeTo(0, 300, () => { audio.pause(); audio.currentTime = 0; emit(); }); },
  set volume(v) { state.volume = v; clearInterval(fadeTimer); audio.volume = v; },
  get volume() { return state.volume; },
  subscribe(fn) { listeners.add(fn); fn(player); return () => listeners.delete(fn); },
};
