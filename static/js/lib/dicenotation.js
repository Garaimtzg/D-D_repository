/*
 * DiceNotation — intérprete de tiradas para la página de dados del móvil, que funciona sin servidor.
 * Es la misma notación y el mismo formato de resultado que server/dice.py:
 * "1d20+5", "2d6+1d4-1", "4d6kh3", "2d20kl1", "d%"; modo "adv"/"dis" para ventaja/desventaja.
 */
(function (global) {
  'use strict';
  const MAX_DICE = 200;
  const MAX_SIDES = 1000;
  const TERM = /([+-]?)(?:(\d*)d(\d+|%)(?:(kh|kl|k)(\d+))?|(\d+))/iy;

  function randInt(max) { // entero uniforme en [1, max] con el generador criptográfico si existe
    if (global.crypto && global.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0x100000000 / max) * max;
      do { global.crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return (buf[0] % max) + 1;
    }
    return 1 + Math.floor(Math.random() * max);
  }

  function roll(expr, mode) {
    const src = String(expr || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!src) throw new Error('Escribe una tirada, por ejemplo 1d20+3');
    let pos = 0; let total = 0; let advUsed = false;
    const parts = [];
    while (pos < src.length) {
      TERM.lastIndex = pos;
      const m = TERM.exec(src);
      if (!m || m.index !== pos || TERM.lastIndex === pos) throw new Error(`No entiendo «${src.slice(pos)}»`);
      if (pos > 0 && !m[1]) throw new Error('Separa los términos con + o -');
      pos = TERM.lastIndex;
      const sign = m[1] === '-' ? -1 : 1;
      if (m[6] !== undefined) {
        const v = Number(m[6]);
        parts.push({ term: `${sign < 0 ? '-' : '+'}${v}`, value: sign * v });
        total += sign * v;
        continue;
      }
      let count = Number(m[2] || 1);
      const sides = m[3] === '%' ? 100 : Number(m[3]);
      let keep = (m[4] || '').toLowerCase();
      let keepN = Number(m[5] || 0);
      if (keep === 'k') keep = 'kh';
      if ((mode === 'adv' || mode === 'dis') && !advUsed && sides === 20 && count === 1 && !keep) {
        count = 2; keep = mode === 'adv' ? 'kh' : 'kl'; keepN = 1; advUsed = true;
      }
      if (!(count >= 1 && count <= MAX_DICE) || !(sides >= 2 && sides <= MAX_SIDES)) {
        throw new Error(`Como mucho ${MAX_DICE} dados de ${MAX_SIDES} caras`);
      }
      const rolls = Array.from({ length: count }, () => randInt(sides));
      let kept = rolls.map((_, i) => i);
      if (keep) {
        keepN = Math.max(1, Math.min(keepN, count));
        const order = kept.slice().sort((a, b) => (keep === 'kh' ? rolls[b] - rolls[a] : rolls[a] - rolls[b]));
        kept = order.slice(0, keepN).sort((a, b) => a - b);
      }
      const value = sign * kept.reduce((s, i) => s + rolls[i], 0);
      total += value;
      parts.push({ term: `${sign < 0 ? '-' : '+'}${count}d${sides}${keep}${keep ? keepN : ''}`, sides, rolls, kept, value });
    }
    const result = { expr: String(expr).trim(), mode: mode || '', total, parts };
    const d20 = parts.filter((p) => p.sides === 20);
    if (d20.length === 1 && d20[0].kept.length === 1) {
      const nat = d20[0].rolls[d20[0].kept[0]];
      result.natural = nat;
      result.crit = nat === 20 ? 'critico' : nat === 1 ? 'pifia' : '';
    }
    return result;
  }

  function describe(r) {
    return r.parts.map((p) => {
      if (!p.rolls) return p.term;
      const dice = p.rolls.map((v, i) => (p.kept.includes(i) ? String(v) : `(${v})`)).join(', ');
      return `${p.term.replace(/^\+/, '')} [${dice}]`;
    }).join(' ');
  }

  global.DiceNotation = { roll, describe };
})(typeof window !== 'undefined' ? window : globalThis);
