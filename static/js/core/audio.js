// Reproductor de música único: sigue sonando aunque cambies de sección.
const audio = new Audio();
const state = { queue: [], index: -1, loop: 'list' }; // loop: 'list' | 'one' | 'off'
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(player));

audio.addEventListener('ended', () => {
  if (state.loop === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (state.index < state.queue.length - 1 || state.loop === 'list') player.next();
  else emit();
});
audio.addEventListener('play', emit);
audio.addEventListener('pause', emit);

export const player = {
  audio,
  get current() { return state.queue[state.index] || null; },
  get playing() { return !audio.paused; },
  get loop() { return state.loop; },
  set loop(v) { state.loop = v; emit(); },
  setQueue(tracks) { state.queue = tracks; if (state.index >= tracks.length) state.index = -1; emit(); },
  play(track) {
    if (track) {
      state.index = state.queue.findIndex((t) => t.id === track.id);
      audio.src = track.url;
    } else if (!audio.src && state.queue.length) {
      state.index = 0;
      audio.src = state.queue[0].url;
    }
    audio.play().catch(() => {});
  },
  pause() { audio.pause(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  next() { if (!state.queue.length) return; this.play(state.queue[(state.index + 1) % state.queue.length]); },
  prev() { if (!state.queue.length) return; this.play(state.queue[(state.index - 1 + state.queue.length) % state.queue.length]); },
  stop() { audio.pause(); audio.currentTime = 0; emit(); },
  set volume(v) { audio.volume = v; },
  get volume() { return audio.volume; },
  subscribe(fn) { listeners.add(fn); fn(player); return () => listeners.delete(fn); },
};
