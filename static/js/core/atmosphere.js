// Ambiente de fondo: unas pocas motas de luz, como brasas de una chimenea, que flotan muy
// despacio detrás de la interfaz. Se para si la ventana no se ve o si se prefiere menos movimiento.
export function startAtmosphere() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'atmosphere';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mote = (y) => ({ x: rnd(0, W), y: y ?? rnd(0, H), v: rnd(6, 18), r: rnd(0.8, 2.2), p: rnd(0, 6.28), s: rnd(0.3, 0.9) });
  const motes = Array.from({ length: 38 }, () => mote());
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += now - last;
    last = now;
    if (acc < 33 || document.hidden) return; // ~30 fps es suficiente
    const dt = Math.min(0.1, acc / 1000);
    acc = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.p += dt * m.s;
      m.y -= m.v * dt;
      m.x += Math.sin(m.p) * 6 * dt;
      if (m.y < -10) motes[i] = mote(H + 10);
      const a = 0.25 + 0.2 * Math.sin(m.p * 3);
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
      g.addColorStop(0, `rgba(255,200,120,${a})`);
      g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 5, 0, 6.28);
      ctx.fill();
    }
  }
  requestAnimationFrame(frame);
}
