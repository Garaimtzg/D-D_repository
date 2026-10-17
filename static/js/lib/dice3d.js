/*
 * Dice3D — dados poliédricos en 3D dibujados en un <canvas>, sin dependencias.
 *
 * Los dados se lanzan con física sencilla (rebotes, rozamiento, choques entre ellos),
 * giran en 3D y terminan mostrando hacia arriba la cara con el valor que se les pide:
 * el resultado lo decide quien llama (el servidor en Python o el móvil), el motor solo
 * lo anima.
 *
 *   const tray = Dice3D.createTray(canvas, { overlay: true });
 *   await tray.roll([{ sides: 20, value: 17 }, { sides: 6, value: 3 }], { origin: { x, y } });
 *
 * Es un script clásico (no módulo) para poder incrustarlo en la página de dados del móvil,
 * que se abre como fichero sin servidor.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- vectores
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mulS = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ------------------------------------------------------------- cuaterniones [w, x, y, z]
  const qMul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
  const qNorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  const qAxis = (axis, angle) => { const a = norm(axis); const s = Math.sin(angle / 2); return [Math.cos(angle / 2), a[0] * s, a[1] * s, a[2] * s]; };
  function qBetween(u, v) { // rotación mínima que lleva u a v (unitarios)
    const d = dot(u, v);
    if (d < -0.999999) {
      let axis = cross([1, 0, 0], u);
      if (len(axis) < 1e-6) axis = cross([0, 1, 0], u);
      return qAxis(axis, Math.PI);
    }
    const c = cross(u, v);
    return qNorm([1 + d, c[0], c[1], c[2]]);
  }
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map((x) => -x); d = -d; }
    if (d > 0.9995) return qNorm(a.map((x, i) => x + (b[i] - x) * t));
    const th = Math.acos(d);
    const s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s;
    const wb = Math.sin(t * th) / s;
    return a.map((x, i) => x * wa + b[i] * wb);
  }
  function qMatrix(q) {
    const [w, x, y, z] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
      2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
      2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
    ];
  }
  const mApply = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
  const qRotate = (q, v) => mApply(qMatrix(q), v);
  function qRandom() {
    const u1 = Math.random(); const u2 = Math.random() * 2 * Math.PI; const u3 = Math.random() * 2 * Math.PI;
    const a = Math.sqrt(1 - u1); const b = Math.sqrt(u1);
    return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  }

  // ---------------------------------------------------------------- geometría
  // Envolvente convexa por fuerza bruta: basta para poliedros de hasta ~20 vértices.
  function hull(points) {
    const n = points.length;
    const eps = 1e-5;
    const seen = new Set();
    const faces = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      let nrm = cross(sub(points[j], points[i]), sub(points[k], points[i]));
      if (len(nrm) < 1e-9) continue;
      nrm = norm(nrm);
      let d = dot(nrm, points[i]);
      let pos = 0; let neg = 0;
      for (const p of points) { const s = dot(nrm, p) - d; if (s > eps) pos++; else if (s < -eps) neg++; }
      if (pos && neg) continue;
      if (pos) { nrm = mulS(nrm, -1); d = -d; }
      const on = [];
      points.forEach((p, idx) => { if (Math.abs(dot(nrm, p) - d) <= eps) on.push(idx); });
      const key = on.slice().sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const c = mulS(on.reduce((acc, idx) => add(acc, points[idx]), [0, 0, 0]), 1 / on.length);
      const u = norm(sub(points[on[0]], c));
      const v = cross(nrm, u);
      on.sort((a, b) => {
        const pa = sub(points[a], c); const pb = sub(points[b], c);
        return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
      });
      faces.push({ idx: on, n: nrm, c });
    }
    return faces;
  }

  const PHI = (1 + Math.sqrt(5)) / 2;
  const SHAPES = {
    4: () => [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    6: () => { const p = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) p.push([x, y, z]); return p; },
    8: () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    10: () => {
      const a = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5)); // hace planas las caras de cometa
      const p = [[0, 0, 1], [0, 0, -1]];
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI) / 5;
        p.push([Math.cos(ang), Math.sin(ang), i % 2 ? -a : a]);
      }
      return p;
    },
    12: () => {
      const p = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) p.push([x, y, z]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        p.push([0, a / PHI, b * PHI]);
        p.push([a / PHI, b * PHI, 0]);
        p.push([a * PHI, 0, b / PHI]);
      }
      return p;
    },
    20: () => {
      const p = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        p.push([0, a, b * PHI]);
        p.push([a, b * PHI, 0]);
        p.push([a * PHI, 0, b]);
      }
      return p;
    },
    2: () => { // moneda: prisma de 16 lados muy plano
      const p = [];
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI) / 8;
        p.push([Math.cos(ang), Math.sin(ang), 0.16]);
        p.push([Math.cos(ang), Math.sin(ang), -0.16]);
      }
      return p;
    },
  };

  const geoCache = {};
  function geometry(kind) {
    if (geoCache[kind]) return geoCache[kind];
    const pts = SHAPES[kind]();
    const r = Math.max(...pts.map(len));
    const verts = pts.map((p) => mulS(p, 1 / r));
    let faces = hull(verts);
    if (kind === 2) faces = faces.filter((f) => Math.abs(f.n[2]) > 0.9).concat(faces.filter((f) => Math.abs(f.n[2]) <= 0.9));
    // Vector «arriba» del número de cada cara: hacia un vértice (en el d4, hacia una punta).
    faces.forEach((f) => {
      let up = sub(verts[f.idx[0]], f.c);
      if (kind === 6) up = sub(mulS(add(verts[f.idx[0]], verts[f.idx[1]]), 0.5), f.c); // número recto, hacia una arista
      if (kind === 10) { // en las cometas del d10, hacia el vértice más lejano (el polo)
        up = f.idx.map((i) => sub(verts[i], f.c)).sort((a, b) => len(b) - len(a))[0];
      }
      up = norm(sub(up, mulS(f.n, dot(up, f.n))));
      f.up = up;
      f.size = Math.min(...f.idx.map((i) => len(sub(verts[i], f.c))));
    });
    // Caras opuestas suman N+1, como en los dados de verdad.
    const labelled = kind === 2 ? faces.slice(0, 2) : faces;
    const N = labelled.length;
    const labels = new Array(faces.length).fill(0);
    let next = 1;
    labelled.forEach((f, i) => {
      if (labels[i]) return;
      labels[i] = next;
      const opp = labelled.findIndex((g, j) => j !== i && !labels[j] && dot(g.n, f.n) < -0.999);
      if (opp >= 0) labels[opp] = N + 1 - next;
      next = next + 1;
      while (labels.includes(next) && next <= N) next++;
    });
    geoCache[kind] = { verts, faces, labels };
    return geoCache[kind];
  }

  // ------------------------------------------------------------- aspecto
  const PALETTE = {
    4: { body: '#2f9e6a', ink: '#f4fff8' },
    6: { body: '#efe6d2', ink: '#3a2412' },
    8: { body: '#3567c8', ink: '#f2f6ff' },
    10: { body: '#8a4fd1', ink: '#fbf5ff' },
    12: { body: '#d98b22', ink: '#2b1500' },
    20: { body: '#c23b37', ink: '#fff6ef' },
    100: { body: '#25262c', ink: '#f1d28a' },
    2: { body: '#c9a24a', ink: '#3a2a08' },
    0: { body: '#5c6470', ink: '#ffffff' },
  };
  const LABEL_SCALE = { 4: 0.36, 6: 0.5, 8: 0.36, 10: 0.32, 12: 0.32, 20: 0.26, 2: 0.55 };
  const LIGHT = norm([-0.45, -0.65, 0.9]);
  const HALF = norm(add(LIGHT, [0, 0, 1]));
  const CAM = 5.5; // distancia de la cámara en radios: perspectiva suave

  function hexRgb(hex) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  const shade = (rgb, k, spec = 0) => `rgb(${rgb.map((c) => Math.round(Math.min(255, c * k + 255 * spec))).join(',')})`;

  // ------------------------------------------------------------------ sonido
  let audioCtx = null;
  const sound = { enabled: true, volume: 0.6 };
  function clack(strength) {
    if (!sound.enabled || strength < 0.05) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      const ctx = audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const dur = 0.045 + Math.random() * 0.03;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 2600;
      bp.Q.value = 2.5 + Math.random() * 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.min(1, strength) * sound.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(t);
    } catch (e) { /* sin audio */ }
  }
  // Los dados agitándose en la mano o en el cubilete antes de lanzarlos.
  function rattle(count) {
    if (!sound.enabled) return;
    const n = 5 + Math.min(6, count || 1);
    for (let i = 0; i < n; i++) setTimeout(() => clack(0.12 + Math.random() * 0.22), i * 38 + Math.random() * 22);
  }

  function chime(good) {
    if (!sound.enabled) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      const ctx = audioCtx;
      const t = ctx.currentTime;
      const notes = good ? [523.25, 659.25, 783.99, 1046.5] : [196, 174.61, 146.83];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = good ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        const start = t + i * (good ? 0.07 : 0.11);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(good ? 0.18 * sound.volume : 0.08 * sound.volume, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + (good ? 0.5 : 0.45));
        o.connect(g).connect(ctx.destination);
        o.start(start);
        o.stop(start + 0.6);
      });
    } catch (e) { /* sin audio */ }
  }

  // ------------------------------------------------------------------ bandeja
  function createTray(canvas, opts) {
    opts = Object.assign({ overlay: false, hold: 2400, fade: 700, font: '800 {px}px "Alegreya Sans", "Segoe UI", system-ui, sans-serif' }, opts || {});
    const ctx = canvas.getContext('2d');
    const impact = (strength) => { clack(strength); if (opts.onImpact && strength > 0.15) opts.onImpact(strength); };
    let W = 0; let H = 0; let dpr = 1;
    let dice = [];
    let particles = [];
    let scheduled = false;
    let destroyed = false;
    let last = 0;
    let rollToken = 0;
    let fadeStart = 0;
    let alpha = 1;
    let area = null; // límites de la tirada actual (por defecto, todo el lienzo)

    function resize() {
      const rect = opts.overlay ? { width: global.innerWidth, height: global.innerHeight } : canvas.getBoundingClientRect();
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (opts.overlay) { canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; }
      draw();
    }

    function bounds() {
      if (area) return area;
      const pad = opts.overlay ? Math.min(W, H) * 0.12 : 6;
      return { x0: pad, y0: pad, x1: W - pad, y1: H - pad };
    }

    function radiusFor(count) {
      const b = bounds();
      const base = opts.overlay ? Math.min(W, H, (b.x1 - b.x0) * 1.6, (b.y1 - b.y0) * 1.6) * 0.055 : Math.min(W, H) * 0.12;
      const shrink = count > 12 ? 0.6 : count > 6 ? 0.75 : count > 3 ? 0.88 : 1;
      return Math.max(16, Math.min(opts.overlay ? 58 : 64, base * shrink));
    }

    function makeDie(spec, i, count, origin, target) {
      let kind = spec.sides;
      let labelsOf = null;
      if (![2, 4, 6, 8, 10, 12, 20].includes(kind)) {
        if (kind === 3) { kind = 6; labelsOf = (g) => g.labels.map((l) => ((l - 1) % 3) + 1); }
        else { kind = 20; labelsOf = (g) => g.labels.map(() => 1 + Math.floor(Math.random() * spec.sides)); }
      }
      const geo = geometry(kind);
      const labels = labelsOf ? labelsOf(geo) : geo.labels.slice();
      let value = spec.value;
      if (kind === 10 && (value === 0)) value = 10;
      let face = labels.map((l, fi) => (l === value ? fi : -1)).filter((fi) => fi >= 0);
      if (!face.length) { // valor fuera de lo normal en este dado: se escribe en una cara cualquiera
        const fi = Math.floor(Math.random() * labels.length);
        labels[fi] = value;
        face = [fi];
      }
      const target_face = face[Math.floor(Math.random() * face.length)];
      const pal = PALETTE[spec.palette || spec.sides] || PALETTE[kind] || PALETTE[0];
      const body = spec.color || pal.body;
      const rgb = hexRgb(body);
      const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
      const ink = spec.ink || (spec.color ? (lum > 0.6 ? '#2a1a0c' : '#ffffff') : pal.ink);
      const display = spec.display || (kind === 10 ? (l) => (l === 10 ? '0' : String(l)) : (l) => String(l));

      const r = radiusFor(count);
      const b = bounds();
      const spread = (i - (count - 1) / 2) * r * 0.9;
      const ox = origin ? origin.x : (b.x0 + b.x1) / 2 + spread;
      const oy = origin ? origin.y : b.y1;
      const tx = target.x + (Math.random() - 0.5) * Math.min(W, H) * 0.35 + spread;
      const ty = target.y + (Math.random() - 0.5) * Math.min(W, H) * 0.25;
      const dx = tx - ox; const dy = ty - oy;
      const dist = Math.hypot(dx, dy) || 1;
      // velocidad pensada para que el dado se pare cerca del destino tras volar, rebotar y rodar
      const speed = Math.max(260, Math.min(1600, dist * 1.05)) * (0.85 + Math.random() * 0.3);
      const omega = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
      const duration = 1500 + Math.random() * 450 + Math.min(600, count * 40);

      return {
        kind, geo, labels, display, face: target_face, rgb, ink, edge: shade(rgb, 1.25, 0.12),
        dropped: !!spec.dropped, fx: spec.fx || '', value,
        x: Math.min(Math.max(ox, r), W - r), y: Math.min(Math.max(oy, r), H - r), h: 70 + Math.random() * 60,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed, vh: 380 + Math.random() * 260,
        r, q: qRandom(), w: mulS(omega, 14 + Math.random() * 10), inside: false,
        t: 0, duration, settleFrom: null, settled: false, settleQ: null, glow: 0,
      };
    }

    function targetQuat(d) {
      const f = d.geo.faces[d.face];
      const align = qBetween(f.n, [0, 0, 1]);
      const up = qRotate(align, f.up);
      const want = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // número casi derecho, con un poco de gracia
      const spin = qAxis([0, 0, 1], want - Math.atan2(up[1], up[0]));
      return qNorm(qMul(spin, align));
    }

    function step(dt) {
      const b = bounds();
      let moving = false;
      for (const d of dice) {
        if (d.settled) continue;
        moving = true;
        d.t += dt * 1000;
        const p = d.t / d.duration;
        // altura y rebotes
        d.vh -= 2600 * dt;
        d.h += d.vh * dt;
        if (d.h <= 0) {
          d.h = 0;
          if (d.vh < -90) { impact(Math.min(1, -d.vh / 900)); d.vh = -d.vh * 0.42; d.vx *= 0.86; d.vy *= 0.86; }
          else d.vh = 0;
        }
        // rozamiento en la mesa
        const fr = d.h <= 0.5 ? (d.settleFrom != null ? 5.5 : 1.9) : 0.25;
        d.vx *= Math.exp(-fr * dt);
        d.vy *= Math.exp(-fr * dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        // paredes (solo cuando el dado ya ha entrado en la mesa: puede salir de un botón de fuera)
        if (!d.inside) d.inside = d.x > b.x0 + d.r && d.x < b.x1 - d.r && d.y > b.y0 + d.r && d.y < b.y1 - d.r;
        if (d.inside && d.x < b.x0 + d.r) { d.x = b.x0 + d.r; d.vx = Math.abs(d.vx) * 0.65; impact(Math.abs(d.vx) / 900); }
        if (d.inside && d.x > b.x1 - d.r) { d.x = b.x1 - d.r; d.vx = -Math.abs(d.vx) * 0.65; impact(Math.abs(d.vx) / 900); }
        if (d.inside && d.y < b.y0 + d.r) { d.y = b.y0 + d.r; d.vy = Math.abs(d.vy) * 0.65; impact(Math.abs(d.vy) / 900); }
        if (d.inside && d.y > b.y1 - d.r) { d.y = b.y1 - d.r; d.vy = -Math.abs(d.vy) * 0.65; impact(Math.abs(d.vy) / 900); }
        // giro: en el aire libre; en la mesa, rodando en la dirección del movimiento
        const speed = Math.hypot(d.vx, d.vy);
        if (d.h <= 0.5) {
          const roll = mulS([d.vy, -d.vx, 0], 1 / d.r);
          const k = Math.min(1, dt * 8);
          d.w = add(mulS(d.w, 1 - k), mulS(add(roll, [0, 0, d.w[2] * 0.9]), k));
        }
        if (d.settleFrom == null && p >= 0.62) { d.settleFrom = d.t; d.q0 = d.q; d.settleQ = targetQuat(d); }
        if (d.settleFrom != null) {
          const e = Math.min(1, (d.t - d.settleFrom) / (d.duration - d.settleFrom));
          const ease = 1 - Math.pow(1 - e, 3);
          // se sigue integrando un giro residual que se apaga, para que no «encaje» de golpe
          const dq0 = qMul([0, d.w[0], d.w[1], d.w[2]], d.q0);
          d.q0 = qNorm(d.q0.map((x, i) => x + 0.5 * dq0[i] * dt * (1 - ease)));
          d.q = qSlerp(d.q0, d.settleQ, ease);
          if (e >= 1) {
            d.settled = true; d.settledAt = performance.now(); d.h = 0; d.q = d.settleQ;
            if (d.fx) { burst(d); chime(d.fx === 'crit'); }
          }
        } else {
          const wq = [0, d.w[0], d.w[1], d.w[2]];
          const dq = qMul(wq, d.q);
          d.q = qNorm(d.q.map((x, i) => x + 0.5 * dq[i] * dt));
        }
        if (speed < 1) { d.vx = 0; d.vy = 0; }
      }
      // choques entre dados
      for (let i = 0; i < dice.length; i++) for (let j = i + 1; j < dice.length; j++) {
        const a = dice[i]; const c = dice[j];
        if (a.settled && c.settled) continue;
        const dx = c.x - a.x; const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = (a.r + c.r) * 0.82;
        if (dist < min) {
          const nx = dx / dist; const ny = dy / dist;
          const push = (min - dist) / 2;
          if (!a.settled) { a.x -= nx * push; a.y -= ny * push; }
          if (!c.settled) { c.x += nx * push; c.y += ny * push; }
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.85;
            if (!a.settled) { a.vx -= nx * imp; a.vy -= ny * imp; }
            if (!c.settled) { c.vx += nx * imp; c.vy += ny * imp; }
            impact(Math.min(1, -rel / 700));
          }
        }
      }
      // partículas
      particles = particles.filter((pt) => (pt.life -= dt) > 0);
      for (const pt of particles) {
        pt.vy += pt.g * dt;
        pt.vx *= Math.exp(-1.5 * dt); pt.vy *= Math.exp(-1.5 * dt);
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      }
      for (const d of dice) if (d.fx && d.settled) d.glow = Math.min(1, d.glow + dt * 2.5);
      return moving;
    }

    function burst(d) {
      const crit = d.fx === 'crit';
      const colors = crit ? ['#ffe28a', '#8dffb0', '#ffffff', '#ffd25a'] : ['#ff5a4a', '#8b1a12', '#ff9a6a', '#3a0b08'];
      for (let i = 0; i < (crit ? 70 : 45); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (crit ? 160 : 90) + Math.random() * (crit ? 380 : 200);
        particles.push({
          x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (crit ? 120 : 0),
          g: crit ? 380 : -60, life: 0.7 + Math.random() * 0.8, max: 1.5,
          size: (crit ? 2 : 3) + Math.random() * (crit ? 3 : 5), color: colors[i % colors.length], smoke: !crit,
        });
      }
    }

    // ---------------------------------------------------------------- dibujo
    function drawDie(d) {
      const m = qMatrix(d.q);
      const R = d.r * (1 + d.h * 0.0022);
      const pts = d.geo.verts.map((v) => {
        const p = mApply(m, v);
        const s = CAM / (CAM - p[2]);
        return [d.x + p[0] * R * s, d.y - d.h * 0.12 + p[1] * R * s, p[2], s];
      });
      // sombra
      const sh = Math.max(0, 1 - d.h / 260);
      const sx = d.x + d.h * 0.28 + R * 0.12; const sy = d.y + d.h * 0.42 + R * 0.22;
      const grad = ctx.createRadialGradient(sx, sy, R * 0.1, sx, sy, R * (1.15 + d.h * 0.004));
      grad.addColorStop(0, `rgba(0,0,0,${0.42 * sh + 0.08})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy, R * (1.15 + d.h * 0.004), R * (0.95 + d.h * 0.003), 0, 0, Math.PI * 2);
      ctx.fill();
      // halo de crítico / pifia
      if (d.glow > 0) {
        const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
        const col = d.fx === 'crit' ? '120,255,160' : '255,60,40';
        const g2 = ctx.createRadialGradient(d.x, d.y, R * 0.4, d.x, d.y, R * 2.1);
        g2.addColorStop(0, `rgba(${col},${0.45 * d.glow * pulse})`);
        g2.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(d.x, d.y, R * 2.1, 0, Math.PI * 2); ctx.fill();
      }
      const faces = d.geo.faces.map((f, fi) => ({ f, fi, n: mApply(m, f.n) })).filter((o) => o.n[2] > 0.0001)
        .sort((a, b) => a.n[2] - b.n[2]);
      const labelScale = LABEL_SCALE[d.kind] || 0.28;
      for (const { f, fi, n } of faces) {
        const diff = Math.max(0, dot(n, LIGHT));
        const spec = Math.pow(Math.max(0, dot(n, HALF)), 28) * 0.55;
        const k = 0.42 + 0.68 * diff;
        ctx.beginPath();
        f.idx.forEach((vi, j) => (j ? ctx.lineTo(pts[vi][0], pts[vi][1]) : ctx.moveTo(pts[vi][0], pts[vi][1])));
        ctx.closePath();
        ctx.fillStyle = shade(d.rgb, k, spec);
        ctx.fill();
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, R * 0.035);
        ctx.strokeStyle = d.edge;
        ctx.globalAlpha *= 0.55;
        ctx.stroke();
        ctx.globalAlpha /= 0.55;
        // número sobre la cara, deformado con la perspectiva de la cara
        const label = d.labels[fi];
        if (!label || n[2] < 0.18) continue;
        const c = mApply(m, f.c);
        const s = CAM / (CAM - c[2]);
        const up = mApply(m, f.up);
        const right = cross(n, up);
        const cx = d.x + c[0] * R * s; const cy = d.y - d.h * 0.12 + c[1] * R * s;
        const px = Math.round(R * labelScale * (f.size / 0.5 > 1.6 ? 1.15 : 1));
        const text = d.display(label);
        ctx.save();
        ctx.setTransform(dpr * right[0] * s, dpr * right[1] * s, dpr * -up[0] * s, dpr * -up[1] * s, dpr * cx, dpr * cy);
        ctx.font = opts.font.replace('{px}', px);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha *= Math.min(1, (n[2] - 0.18) * 3);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillText(text, px * 0.04, px * 0.07);
        ctx.fillStyle = d.ink;
        ctx.fillText(text, 0, 0);
        if ((text === '6' || text === '9') && d.kind > 8) ctx.fillRect(-px * 0.28, px * 0.5, px * 0.56, px * 0.09);
        ctx.restore();
      }
      if (d.dropped && d.settled) { // dado descartado (ventaja, 4d6kh3…): se apaga
        ctx.beginPath();
        ctx.arc(d.x, d.y, R * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15,10,8,0.55)';
        ctx.fill();
      }
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = alpha;
      const order = dice.slice().sort((a, b) => a.h - b.h);
      for (const d of order) drawDie(d);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      for (const pt of particles) {
        const a = Math.max(0, pt.life / pt.max) * alpha;
        ctx.globalAlpha = pt.smoke ? a * 0.5 : a;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (pt.smoke ? 1 + (1 - a) * 2 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      // subpasos fijos: la física va a tiempo real aunque el navegador dibuje pocos fotogramas
      let remaining = Math.min(0.25, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      while (remaining > 0.0005) {
        const dt = Math.min(1 / 120, remaining);
        moving = step(dt) || moving;
        remaining -= dt;
      }
      if (!moving && opts.overlay && dice.length) {
        fadeStart = fadeStart || now + opts.hold;
        if (now > fadeStart) alpha = Math.max(0, 1 - (now - fadeStart) / opts.fade);
        if (alpha <= 0) { dice = []; particles = []; alpha = 1; fadeStart = 0; }
      }
      draw();
      const glowing = dice.some((d) => d.glow > 0 && now - d.settledAt < 5000); // el halo late unos segundos
      if (dice.length && (moving || particles.length || glowing || (opts.overlay && dice.length))) schedule();
    }

    // Siguiente fotograma. Si el navegador no los pide (ventana minimizada o tapada), un temporizador
    // sigue moviendo los dados para que la tirada termine igualmente.
    function schedule() {
      if (scheduled || destroyed) return;
      scheduled = true;
      let fired = false;
      const fire = (t) => {
        if (fired) return;
        fired = true;
        cancelAnimationFrame(id);
        clearTimeout(tm);
        scheduled = false;
        if (!destroyed) loop(t);
      };
      const id = requestAnimationFrame(fire);
      const tm = setTimeout(() => fire(performance.now()), 120);
    }

    function start() {
      if (!scheduled) { last = performance.now(); schedule(); }
    }

    function roll(specs, rollOpts) {
      rollOpts = rollOpts || {};
      const token = ++rollToken;
      resize(); // mide de nuevo: el lienzo puede haber cambiado de tamaño o acabar de entrar en la página
      const list = specs.slice(0, rollOpts.max || 24);
      area = rollOpts.bounds || null;
      const b = bounds();
      const target = rollOpts.target || { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
      alpha = 1; fadeStart = 0; particles = [];
      dice = list.map((s, i) => makeDie(s, i, list.length, rollOpts.origin || null, target));
      start();
      if (rollOpts.rattle !== false) rattle(list.length);
      const deadline = performance.now() + 6000 + list.length * 60;
      return new Promise((resolve) => {
        const check = () => {
          if (token === rollToken && performance.now() > deadline) { // seguro por si el navegador deja de dibujar
            for (const d of dice) if (!d.settled) { d.q = d.settleQ || targetQuat(d); d.settled = true; d.settledAt = performance.now(); d.h = 0; }
            draw();
          }
          if (token !== rollToken) return resolve(null); // otra tirada la ha sustituido
          if (dice.every((d) => d.settled)) {
            const cx = dice.reduce((s, d) => s + d.x, 0) / dice.length;
            const cy = dice.reduce((s, d) => s + d.y, 0) / dice.length;
            const top = Math.min(...dice.map((d) => d.y - d.r));
            resolve({ x: cx, y: cy, top });
          } else setTimeout(check, 60);
        };
        check();
      });
    }

    function clear() { rollToken++; dice = []; particles = []; draw(); }

    const onResize = () => resize();
    if (opts.overlay) global.addEventListener('resize', onResize);
    let ro = null;
    if (!opts.overlay && global.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(canvas); }
    resize();

    return {
      roll, clear, resize,
      get busy() { return dice.some((d) => !d.settled); },
      destroy() { destroyed = true; if (ro) ro.disconnect(); global.removeEventListener('resize', onResize); },
    };
  }

  // ------------------------------------------------------------ iconos SVG
  const ICONS = {
    4: '<path d="M12 2.6 21.6 19.6H2.4Z"/><path d="M12 2.6 12 13.4M2.4 19.6 12 13.4l9.6 6.2"/>',
    6: '<path d="M12 2.2 20.8 7v10L12 21.8 3.2 17V7Z"/><path d="M3.2 7 12 12l8.8-5M12 12v9.8"/>',
    8: '<path d="M12 2 21 12 12 22 3 12Z"/><path d="M3 12h18M12 2 8.2 12 12 22l3.8-10Z"/>',
    10: '<path d="M12 2 21.5 10.5 12 22 2.5 10.5Z"/><path d="M2.5 10.5 7 12.4 12 9.5l5 2.9 4.5-1.9M7 12.4 12 22l5-9.6M12 2v7.5"/>',
    12: '<path d="M12 2 21.5 8.9 17.9 20.1H6.1L2.5 8.9Z"/><path d="M12 6.6 16.4 9.8 14.7 15H9.3L7.6 9.8Z"/><path d="M12 2v4.6M21.5 8.9l-5.1.9M17.9 20.1 14.7 15M6.1 20.1 9.3 15M2.5 8.9l5.1.9"/>',
    20: '<path d="M12 2 20.7 7v10L12 22l-8.7-5V7Z"/><path d="M12 7.2 16.8 15H7.2Z"/><path d="M12 2v5.2M20.7 7l-3.9 8M3.3 7l3.9 8M3.3 17l3.9-2M20.7 17l-3.9-2M12 22l-4.8-7M12 22l4.8-7"/>',
    100: '<path d="M8 3 14 8.5 8 19.5 2 8.5Z"/><path d="M16 4.5 22 10 16 21l-6-11Z"/>',
    2: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>',
  };
  function icon(sides, size) {
    const s = size || 24;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICONS[sides] || ICONS[20]}</svg>`;
  }

  // Convierte el resultado de una tirada (formato del servidor o de DiceNotation) en dados a animar.
  function diceFromResult(result, extra) {
    extra = extra || {};
    const out = [];
    const nat = result.crit;
    for (const p of result.parts || []) {
      if (!p.rolls) continue;
      p.rolls.forEach((v, i) => {
        const dropped = !(p.kept || []).includes(i);
        if (p.sides === 100) {
          const tens = v === 100 ? 10 : Math.floor(v / 10) || 10;
          const units = v % 10 || 10;
          out.push(Object.assign({ sides: 10, value: tens, dropped, palette: 100, display: (l) => (l === 10 ? '00' : String(l * 10)) }, extra));
          out.push(Object.assign({ sides: 10, value: units, dropped, palette: 100 }, extra));
          return;
        }
        const spec = Object.assign({ sides: p.sides, value: v, dropped }, extra);
        if (p.sides === 20 && !dropped && nat && v === result.natural) spec.fx = nat === 'critico' ? 'crit' : 'fumble';
        out.push(spec);
      });
    }
    return out;
  }

  global.Dice3D = { createTray, icon, diceFromResult, sound, geometry, rattle, clack };
})(typeof window !== 'undefined' ? window : globalThis);
