// Ambientes sintetizados en el navegador (sin ficheros ni internet): lluvia, viento, hoguera,
// cueva y taberna. Se pueden mezclar y cada capa tiene su volumen.
let ctx = null;
let master = null;
const layers = {};

function context() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(c, seconds = 3, color = 'white') {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
  }
  return buf;
}

function loopNoise(c, color, out) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4, color);
  src.loop = true;
  src.connect(out);
  src.start();
  return src;
}

// Cada receta devuelve { gain, stop } conectada al máster.
const RECIPES = {
  lluvia(c, gain) {
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    hp.connect(lp).connect(gain);
    const src = loopNoise(c, 'white', hp);
    const drops = setInterval(() => { // gotas sueltas más gordas
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.value = 1800 + Math.random() * 2500;
      g.gain.setValueAtTime(0.04, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
      o.connect(g).connect(gain); o.start(); o.stop(c.currentTime + 0.06);
    }, 90);
    return () => { src.stop(); clearInterval(drops); };
  },
  viento(c, gain) {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8;
    const src = loopNoise(c, 'brown', bp);
    bp.connect(gain);
    const lfo = c.createOscillator(); const lfoGain = c.createGain();
    lfo.frequency.value = 0.08; lfoGain.gain.value = 350;
    lfo.connect(lfoGain).connect(bp.frequency); lfo.start();
    return () => { src.stop(); lfo.stop(); };
  },
  hoguera(c, gain) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const src = loopNoise(c, 'brown', lp);
    const rumble = c.createGain(); rumble.gain.value = 0.6;
    lp.connect(rumble).connect(gain);
    const crackle = setInterval(() => { // chasquidos de la leña
      if (Math.random() > 0.55) return;
      const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.03);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000 + Math.random() * 3000; bp.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0.15 + Math.random() * 0.35;
      n.connect(bp).connect(g).connect(gain); n.start();
    }, 70);
    return () => { src.stop(); clearInterval(crackle); };
  },
  cueva(c, gain) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const src = loopNoise(c, 'brown', lp);
    const hum = c.createGain(); hum.gain.value = 0.5;
    lp.connect(hum).connect(gain);
    const delay = c.createDelay(); delay.delayTime.value = 0.28;
    const fb = c.createGain(); fb.gain.value = 0.45;
    delay.connect(fb).connect(delay); delay.connect(gain);
    const drips = setInterval(() => { // gotas con eco
      if (Math.random() > 0.35) return;
      const o = c.createOscillator(); const g = c.createGain();
      const f = 900 + Math.random() * 900;
      o.frequency.setValueAtTime(f, c.currentTime); o.frequency.exponentialRampToValueAtTime(f * 1.8, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
      o.connect(g); g.connect(gain); g.connect(delay); o.start(); o.stop(c.currentTime + 0.15);
    }, 600);
    return () => { src.stop(); clearInterval(drips); };
  },
  taberna(c, gain) {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 1.2;
    const src = loopNoise(c, 'brown', bp);
    const lfo = c.createOscillator(); const lg = c.createGain(); // murmullo que sube y baja
    lfo.frequency.value = 0.6; lg.gain.value = 120;
    lfo.connect(lg).connect(bp.frequency); lfo.start();
    bp.connect(gain);
    const clinks = setInterval(() => { // jarras y vasos
      if (Math.random() > 0.25) return;
      [1, 2.76].forEach((mult) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.type = 'sine'; o.frequency.value = 2400 * mult * (0.9 + Math.random() * 0.2);
        g.gain.setValueAtTime(0.03, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
        o.connect(g).connect(gain); o.start(); o.stop(c.currentTime + 0.45);
      });
    }, 700);
    return () => { src.stop(); lfo.stop(); clearInterval(clinks); };
  },
};

export const AMBIENCES = [
  ['lluvia', 'Lluvia', '🌧️'], ['viento', 'Viento', '🌬️'], ['hoguera', 'Hoguera', '🔥'], ['cueva', 'Cueva', '🦇'], ['taberna', 'Taberna', '🍺'],
];

export const ambience = {
  isOn: (name) => !!layers[name],
  volume: (name) => layers[name]?.gain.gain.value ?? 0.5,
  toggle(name, vol = 0.5) {
    if (layers[name]) return this.stop(name);
    const c = context();
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + 1.2);
    gain.connect(master);
    layers[name] = { gain, stop: RECIPES[name](c, gain) };
    return true;
  },
  setVolume(name, v) { if (layers[name]) layers[name].gain.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.1); },
  stop(name) {
    const l = layers[name];
    if (!l) return false;
    l.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    setTimeout(() => { l.stop(); l.gain.disconnect(); }, 1200);
    delete layers[name];
    return false;
  },
  stopAll() { Object.keys(layers).forEach((n) => this.stop(n)); },
};
