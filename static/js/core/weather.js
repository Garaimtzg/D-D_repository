// Clima dibujado sobre el tablero de la Mesa: lluvia, tormenta (con relámpagos), nieve, niebla y brasas.
export const WEATHERS = [
  ['', '☀️ Despejado'], ['lluvia', '🌧️ Lluvia'], ['tormenta', '⛈️ Tormenta'], ['nieve', '❄️ Nieve'], ['niebla', '🌫️ Niebla'], ['brasas', '🔥 Brasas'],
];

export function createWeather(canvas, { onLightning } = {}) {
  const ctx = canvas.getContext('2d');
  let kind = '';
  let parts = [];
  let raf = 0;
  let last = 0;
  let W = 0;
  let H = 0;
  let flash = 0;
  let nextBolt = 0;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.round(r.width));
    H = canvas.height = Math.max(1, Math.round(r.height));
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(k, initial) {
    if (k === 'lluvia' || k === 'tormenta') return { x: rnd(-50, W + 50), y: initial ? rnd(0, H) : rnd(-60, -10), v: rnd(700, 1000), l: rnd(10, 22), a: rnd(0.15, 0.4) };
    if (k === 'nieve') return { x: rnd(0, W), y: initial ? rnd(0, H) : -5, v: rnd(25, 70), r: rnd(1, 3.2), p: rnd(0, 6.28), a: rnd(0.5, 0.95) };
    if (k === 'niebla') return { x: rnd(-200, W), y: rnd(0, H), v: rnd(6, 18), r: rnd(140, 320), a: rnd(0.06, 0.14) };
    return { x: rnd(0, W), y: initial ? rnd(0, H) : H + 5, v: rnd(30, 90), r: rnd(1, 2.6), p: rnd(0, 6.28), life: rnd(0.4, 1) }; // brasas
  }
  const COUNT = { lluvia: 180, tormenta: 260, nieve: 140, niebla: 9, brasas: 70 };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, W, H);
    const wind = kind === 'tormenta' ? 260 : 120;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (kind === 'lluvia' || kind === 'tormenta') {
        p.y += p.v * dt; p.x += wind * dt * 0.35;
        ctx.strokeStyle = `rgba(190,215,255,${p.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * 0.3, p.y - p.l); ctx.stroke();
        if (p.y > H) {
          ctx.strokeStyle = `rgba(190,215,255,${p.a * 0.7})`;
          ctx.beginPath(); ctx.ellipse(p.x, H - rnd(2, 40), 4, 1.5, 0, 0, 6.28); ctx.stroke();
          parts[i] = spawn(kind);
        }
      } else if (kind === 'nieve') {
        p.p += dt; p.y += p.v * dt; p.x += Math.sin(p.p) * 18 * dt;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
        if (p.y > H + 5) parts[i] = spawn(kind);
      } else if (kind === 'niebla') {
        p.x += p.v * dt;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(215,222,230,${p.a})`); g.addColorStop(1, 'rgba(215,222,230,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        if (p.x - p.r > W) { parts[i] = spawn(kind); parts[i].x = -parts[i].r; }
      } else if (kind === 'brasas') {
        p.p += dt * 3; p.y -= p.v * dt; p.x += Math.sin(p.p) * 14 * dt; p.life -= dt * 0.12;
        const a = Math.max(0, p.life) * (0.6 + 0.4 * Math.sin(p.p * 2));
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,190,90,${a})`); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        if (p.y < -10 || p.life <= 0) parts[i] = spawn(kind);
      }
    }
    if (kind === 'tormenta') {
      if (now > nextBolt) { flash = 1; nextBolt = now + rnd(6000, 15000); onLightning?.(); }
      if (flash > 0) {
        ctx.fillStyle = `rgba(230,240,255,${flash * 0.55 * (Math.random() > 0.3 ? 1 : 0.3)})`;
        ctx.fillRect(0, 0, W, H);
        flash -= dt * 2.5;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    set(k) {
      kind = k || '';
      cancelAnimationFrame(raf);
      resize();
      ctx.clearRect(0, 0, W, H);
      if (!kind) { parts = []; return; }
      parts = Array.from({ length: COUNT[kind] }, () => spawn(kind, true));
      nextBolt = performance.now() + 2500;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    resize,
    destroy() { cancelAnimationFrame(raf); },
  };
}
