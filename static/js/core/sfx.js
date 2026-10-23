// Efectos de sonido sintetizados en el navegador (sin ficheros): espadas, gong, golpes, curación,
// monedas, fanfarrias… Un único interruptor de sonido controla esto y los dados.
import { prefs } from './dom.js';

let ctx = null;
let master = null;
const state = { on: prefs.get('sound', true), volume: prefs.get('sfx.volume', 0.7) };

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Nota simple con envolvente. f puede deslizarse hasta «to».
function tone(f, { type = 'sine', dur = 0.3, vol = 0.2, at = 0, attack = 0.006, to = null, lp = null } = {}) {
  const c = ac();
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o.connect(g);
  if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; node = g.connect(f2); node.connect(master); } else g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise({ dur = 0.2, vol = 0.2, at = 0, type = 'bandpass', freq = 1000, q = 1, to = null, attack = 0.003 } = {}) {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  click() { tone(1800, { dur: 0.04, vol: 0.05, type: 'triangle' }); },
  whoosh() { noise({ dur: 0.35, vol: 0.06, freq: 400, to: 2400, q: 0.7 }); },
  page() { // papel que se pasa
    noise({ dur: 0.12, vol: 0.1, type: 'highpass', freq: 2500, q: 0.5 });
    noise({ dur: 0.18, vol: 0.08, type: 'bandpass', freq: 3500, q: 0.8, at: 0.09 });
  },
  sword() { // choque de aceros
    noise({ dur: 0.08, vol: 0.35, type: 'highpass', freq: 3000 });
    [1180, 1870, 2650, 3420].forEach((f, i) => tone(f, { dur: 0.9 - i * 0.12, vol: 0.09, type: 'triangle', attack: 0.002 }));
    tone(520, { dur: 0.25, vol: 0.12, type: 'square', lp: 1500 });
  },
  gong() {
    [98, 147, 196, 262, 331].forEach((f, i) => tone(f, { dur: 2.6 - i * 0.3, vol: 0.13 / (i + 1) + 0.03, attack: 0.01, type: i ? 'sine' : 'triangle' }));
    noise({ dur: 0.08, vol: 0.12, type: 'lowpass', freq: 600 });
  },
  turn() { tone(784, { dur: 0.5, vol: 0.12, type: 'triangle' }); tone(1175, { dur: 0.7, vol: 0.08, at: 0.09, type: 'triangle' }); },
  hit() { // golpe seco
    tone(140, { dur: 0.22, vol: 0.4, to: 45 });
    noise({ dur: 0.12, vol: 0.25, type: 'lowpass', freq: 1800 });
    noise({ dur: 0.05, vol: 0.12, type: 'highpass', freq: 4000, at: 0.01 });
  },
  heal() { [659, 880, 1047, 1319, 1568].forEach((f, i) => tone(f, { dur: 0.6, vol: 0.07, at: i * 0.06, type: 'sine' })); noise({ dur: 0.6, vol: 0.03, type: 'highpass', freq: 6000, at: 0.05 }); },
  shield() { tone(1320, { dur: 0.5, vol: 0.1, type: 'triangle' }); tone(1980, { dur: 0.4, vol: 0.06, at: 0.02, type: 'sine' }); tone(220, { dur: 0.25, vol: 0.12, type: 'sine', to: 160 }); },
  coins() {
    for (let i = 0; i < 9; i++) {
      const f = 2600 + Math.random() * 2400;
      const at = i * 0.045 + Math.random() * 0.03;
      tone(f, { dur: 0.18, vol: 0.06, at, type: 'triangle', attack: 0.002 });
      tone(f * 1.51, { dur: 0.12, vol: 0.03, at, type: 'sine', attack: 0.002 });
    }
  },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: i === 3 ? 0.9 : 0.22, vol: 0.13, at: i * 0.11, type: 'triangle' })); tone(1568, { dur: 0.9, vol: 0.05, at: 0.33 }); },
  victory() { // fanfarria de metales
    const notes = [[392, 0], [392, 0.14], [392, 0.28], [523, 0.42], [659, 0.75], [784, 0.92]];
    notes.forEach(([f, at], i) => tone(f, { dur: i === notes.length - 1 ? 1.2 : 0.2, vol: 0.12, at, type: 'sawtooth', lp: 2400 }));
    tone(196, { dur: 1.9, vol: 0.07, at: 0.42, type: 'sawtooth', lp: 900 });
  },
  death() { tone(220, { dur: 1.2, vol: 0.12, type: 'sawtooth', to: 55, lp: 900 }); tone(233, { dur: 1.2, vol: 0.08, type: 'sawtooth', to: 58, lp: 700 }); noise({ dur: 0.8, vol: 0.06, type: 'lowpass', freq: 400 }); },
  fail() { [392, 370, 349, 294].forEach((f, i) => tone(f, { dur: i === 3 ? 0.8 : 0.28, vol: 0.1, at: i * 0.26, type: 'triangle', lp: 1500, to: i === 3 ? 262 : null })); },
  magic() { tone(400, { dur: 0.7, vol: 0.06, to: 1600, type: 'sine' }); [1760, 2093, 2637].forEach((f, i) => tone(f, { dur: 0.5, vol: 0.04, at: 0.15 + i * 0.08 })); noise({ dur: 0.6, vol: 0.03, type: 'highpass', freq: 5000, at: 0.1 }); },
  ping() { tone(1320, { dur: 0.6, vol: 0.12 }); tone(1320, { dur: 0.5, vol: 0.05, at: 0.18 }); tone(1320, { dur: 0.4, vol: 0.02, at: 0.36 }); },
  pin() { tone(180, { dur: 0.1, vol: 0.2, to: 90 }); noise({ dur: 0.05, vol: 0.12, type: 'bandpass', freq: 2200, q: 2 }); },
  step() { // miniatura que se apoya en la mesa
    tone(170, { dur: 0.09, vol: 0.16, type: 'sine', to: 95 });
    noise({ dur: 0.05, vol: 0.07, type: 'bandpass', freq: 1900, q: 3 });
  },
  brush() { noise({ dur: 0.14, vol: 0.035, type: 'bandpass', freq: 1300, q: 0.7 }); },
  chop() { noise({ dur: 0.07, vol: 0.3, type: 'bandpass', freq: 1100, q: 1.2 }); tone(150, { dur: 0.09, vol: 0.22, to: 70 }); }, // hacha en la madera
  thud() { tone(70, { dur: 0.35, vol: 0.35, to: 38 }); noise({ dur: 0.25, vol: 0.14, type: 'lowpass', freq: 380 }); }, // piedra contra el suelo
  tick() { tone(2300, { dur: 0.04, vol: 0.035, type: 'triangle' }); },
  blast() { // área de efecto
    noise({ dur: 0.9, vol: 0.12, type: 'lowpass', freq: 200, to: 2600, q: 0.8 });
    tone(110, { dur: 0.7, vol: 0.12, type: 'sawtooth', to: 50, lp: 600 });
  },
  unroll() { noise({ dur: 0.7, vol: 0.12, type: 'lowpass', freq: 300, to: 3000, q: 0.6 }); noise({ dur: 0.25, vol: 0.06, type: 'highpass', freq: 3000, at: 0.5 }); },
  thunder() { // trueno lejano
    noise({ dur: 2.8, vol: 0.32, type: 'lowpass', freq: 220, to: 60, q: 0.7, attack: 0.08 });
    noise({ dur: 0.6, vol: 0.18, type: 'lowpass', freq: 900, to: 200, attack: 0.01 });
    tone(48, { dur: 2.2, vol: 0.15, to: 32, attack: 0.1 });
  },
  drum() { // redoble de iniciativa
    for (let i = 0; i < 14; i++) {
      const at = i * 0.055 * (1 - i * 0.02);
      noise({ dur: 0.07, vol: 0.06 + i * 0.012, type: 'bandpass', freq: 180 + Math.random() * 40, q: 1.5, at });
      tone(90, { dur: 0.08, vol: 0.05 + i * 0.01, at });
    }
    tone(65, { dur: 0.6, vol: 0.35, at: 0.72, to: 40 });
    noise({ dur: 0.4, vol: 0.18, type: 'lowpass', freq: 900, at: 0.72 });
  },
};

export const sfx = new Proxy({}, {
  get(_, name) {
    if (name === 'on') return state.on;
    if (name === 'volume') return state.volume;
    if (name === 'setOn') return (v) => { state.on = v; prefs.set('sound', v); };
    if (name === 'setVolume') return (v) => { state.volume = v; prefs.set('sfx.volume', v); if (master) master.gain.value = v; };
    const fn = SOUNDS[name];
    return () => { if (state.on && fn) { try { fn(); } catch { /* sin audio */ } } };
  },
});
