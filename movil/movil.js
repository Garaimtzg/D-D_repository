// Dados en el móvil: página autónoma (sin servidor ni internet) con los mismos dados 3D de la mesa.
// Las tiradas se resuelven aquí con DiceNotation y el historial se guarda en el propio móvil.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(`dados.${k}`); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(`dados.${k}`, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  const COLORS = ['#c23b37', '#3567c8', '#2f9e6a', '#8a4fd1', '#d98b22', '#efe6d2', '#25262c', '#e0527f', '#2bb3b3', '#c9a24a', '#6b4a26', '#7d8590'];
  const DICE = [4, 6, 8, 10, 12, 20, 100];
  const state = {
    mode: store.get('mode', 'now'), adv: '', mod: 0, pool: {},
    name: store.get('name', 'Jugador'), color: store.get('color', ''), history: store.get('history', []),
  };

  Dice3D.sound.enabled = store.get('sound', true);
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };
  const tray = Dice3D.createTray($('cv'), { onImpact: (s) => vibrate(Math.round(8 + s * 20)) });

  // ----------------------------------------------------------------- tirar
  async function doRoll(expr, label) {
    let r;
    try { r = DiceNotation.roll(expr, state.adv); } catch (e) { showError(e.message); return; }
    r.label = label || expr;
    r.time = Date.now();
    $('hint').hidden = true;
    $('result').hidden = true;
    vibrate(15);
    await tray.roll(Dice3D.diceFromResult(r, state.color ? { color: state.color } : {}));
    showResult(r);
    if (r.crit) vibrate(r.crit === 'critico' ? [40, 60, 40, 60, 120] : [200]);
    state.history.unshift({ label: r.label, total: r.total, detail: DiceNotation.describe(r), crit: r.crit || '', time: r.time, mode: r.mode });
    state.history = state.history.slice(0, 60);
    store.set('history', state.history);
    drawHistory();
  }

  function showResult(r) {
    const el = $('result');
    const cls = r.crit === 'critico' ? 'crit' : r.crit === 'pifia' ? 'fumble' : '';
    el.className = `result ${cls}`;
    el.innerHTML = '';
    const add = (tag, cls2, text) => { const n = document.createElement(tag); n.className = cls2; n.textContent = text; el.append(n); };
    add('div', 'lbl', `${state.name}: ${r.label}${r.mode === 'adv' ? ' · ventaja' : r.mode === 'dis' ? ' · desventaja' : ''}`);
    add('div', 'total', String(r.total));
    add('div', 'detail', DiceNotation.describe(r));
    if (cls) add('div', 'tag', cls === 'crit' ? '¡CRÍTICO!' : '¡PIFIA!');
    el.hidden = false;
  }

  function showError(msg) {
    const el = $('result');
    el.className = 'result fumble';
    el.textContent = msg;
    el.hidden = false;
  }

  // ------------------------------------------------------------- controles
  const poolExpr = () => {
    const parts = DICE.filter((s) => state.pool[s] > 0).map((s) => `${state.pool[s]}d${s}`);
    if (state.mod) parts.push(String(state.mod));
    return parts.join('+').replace(/\+-/g, '-');
  };
  const withMod = (expr) => (state.mod ? `${expr}${state.mod > 0 ? '+' : ''}${state.mod}` : expr);
  const COLORS_BY = { 4: '#4cc38a', 6: '#efe6d2', 8: '#5b9cff', 10: '#a77bff', 12: '#f0a03a', 20: '#ff6b5e', 100: '#f1d28a' };

  function drawDice() {
    const box = $('dice');
    box.innerHTML = '';
    DICE.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'die';
      b.style.setProperty('--dc', COLORS_BY[s]);
      b.setAttribute('aria-label', state.mode === 'now' ? `Tirar 1d${s}` : `Añadir 1d${s}`);
      b.innerHTML = `${Dice3D.icon(s, 32)}<span>d${s}</span>${state.pool[s] ? `<i>${state.pool[s]}</i>` : ''}`;
      b.addEventListener('click', () => {
        if (state.mode === 'now') doRoll(withMod(`1d${s}`), `d${s}`);
        else { state.pool[s] = (state.pool[s] || 0) + 1; vibrate(8); drawDice(); }
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (state.pool[s]) { state.pool[s] -= 1; drawDice(); } });
      box.append(b);
    });
    $('pool').textContent = poolExpr() || 'Bandeja vacía';
    $('poolRow').hidden = state.mode !== 'pool';
  }

  document.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    store.set('mode', state.mode);
    document.querySelectorAll('.mode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawDice();
  }));
  document.querySelectorAll('#adv button').forEach((b) => b.addEventListener('click', () => {
    state.adv = b.dataset.v;
    document.querySelectorAll('#adv button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const drawMod = () => { $('modVal').textContent = state.mod >= 0 ? `+${state.mod}` : String(state.mod); $('pool').textContent = poolExpr() || 'Bandeja vacía'; };
  $('modMinus').addEventListener('click', () => { state.mod -= 1; drawMod(); });
  $('modPlus').addEventListener('click', () => { state.mod += 1; drawMod(); });
  $('clear').addEventListener('click', () => { state.pool = {}; state.mod = 0; drawMod(); drawDice(); });
  $('roll').addEventListener('click', () => { const e = poolExpr(); if (e) doRoll(e); });
  $('exprForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('expr').value.trim(); if (v) { $('expr').blur(); doRoll(v); } });

  // --------------------------------------------------------------- sonido
  const drawSound = () => { $('sound').textContent = Dice3D.sound.enabled ? '🔊' : '🔇'; };
  $('sound').addEventListener('click', () => { Dice3D.sound.enabled = !Dice3D.sound.enabled; store.set('sound', Dice3D.sound.enabled); drawSound(); });
  drawSound();

  // ---------------------------------------------------- agitar para tirar
  let shakeOn = false;
  let lastShake = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const force = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (force > 24 && Date.now() - lastShake > 1500 && !tray.busy) {
      lastShake = Date.now();
      const e2 = state.mode === 'pool' && poolExpr() ? poolExpr() : withMod('1d20');
      doRoll(e2, state.mode === 'pool' && poolExpr() ? '' : 'd20');
    }
  }
  $('shake').addEventListener('click', async () => {
    if (!shakeOn && window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
      try { if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return; } catch (e) { return; }
    }
    shakeOn = !shakeOn;
    $('shake').setAttribute('aria-pressed', String(shakeOn));
    if (shakeOn) window.addEventListener('devicemotion', onMotion);
    else window.removeEventListener('devicemotion', onMotion);
    showError(shakeOn ? 'Agita el móvil para tirar (la bandeja o un d20)' : 'Agitar desactivado');
    $('result').className = 'result';
  });

  // ------------------------------------------------------------- historial
  function drawHistory() {
    const ul = $('hist');
    ul.innerHTML = '';
    if (!state.history.length) { const li = document.createElement('li'); li.textContent = 'Aún no has tirado.'; ul.append(li); return; }
    state.history.forEach((h) => {
      const li = document.createElement('li');
      li.className = h.crit === 'critico' ? 'crit' : h.crit === 'pifia' ? 'fumble' : '';
      const d = document.createElement('div');
      d.textContent = h.label;
      const sm = document.createElement('small');
      sm.textContent = `${h.detail} · ${new Date(h.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
      d.append(sm);
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = h.total;
      li.append(d, t);
      ul.append(li);
    });
  }
  $('histBtn').addEventListener('click', () => { $('histSheet').hidden = false; });
  $('histClose').addEventListener('click', () => { $('histSheet').hidden = true; });
  $('histClear').addEventListener('click', () => { state.history = []; store.set('history', []); drawHistory(); });

  // ------------------------------------------------------- quién tira y color
  function drawWho() {
    $('whoName').textContent = state.name || 'Jugador';
    $('whoDot').style.background = state.color || '#c23b37';
    $('whoDot').style.color = state.color || '#c23b37';
    const sw = $('swatches');
    sw.innerHTML = '';
    ['', ...COLORS].forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c || 'conic-gradient(#4cc38a, #efe6d2, #5b9cff, #a77bff, #f0a03a, #ff6b5e, #4cc38a)';
      b.setAttribute('aria-label', c ? `Color ${c}` : 'Un color por tipo de dado');
      b.setAttribute('aria-pressed', String(c === state.color));
      b.addEventListener('click', () => { state.color = c; store.set('color', c); drawWho(); });
      sw.append(b);
    });
  }
  $('who').addEventListener('click', () => { $('whoInput').value = state.name; $('whoSheet').hidden = false; });
  $('whoClose').addEventListener('click', () => { $('whoSheet').hidden = true; });
  $('whoInput').addEventListener('input', (e) => { state.name = e.target.value.trim() || 'Jugador'; store.set('name', state.name); drawWho(); });

  document.querySelectorAll('.mode button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === state.mode)));
  drawDice();
  drawHistory();
  drawWho();
}());
