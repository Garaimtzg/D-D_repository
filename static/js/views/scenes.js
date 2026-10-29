// Escenarios: tableros con cuadrícula para los combates. Galería de prediseñados y propios,
// vista previa, «usar en un combate» y un editor para pintar terreno, colocar objetos,
// marcar las zonas de inicio, cambiar la luz o usar una imagen de fondo.
import { api, debounced } from '../core/api.js';
import { h, clear, icon, field, selectEl, segmented, modal, confirmDialog, toast, toastError, pickFiles, fmtDate } from '../core/dom.js';
import { createBattleMap, sceneCatalog, sceneThumb, drawScene, blankScene, resizeScene, fmtMeters, sceneImage, imagePx } from '../core/battlemap.js';
import { autoPlace, ensureBoard } from '../core/board.js';
import { newCombat } from '../core/combat.js';
import { sfx } from '../core/sfx.js';

export default { id: 'escenarios', title: 'Escenarios', icon: 'grid', hint: 'Tableros con cuadrícula para los combates · tecla 3', mount };

const KIND_GROUPS = [
  ['suelo', 'Suelos'], ['natural', 'Naturaleza'], ['agua', 'Agua'], ['peligro', 'Peligros'], ['vacio', 'Abismos'], ['muro', 'Muros'],
];
const PROP_GROUPS = [
  ['Naturaleza', 'TPbxrMQ'], ['Mobiliario', 'tzhqkBCSKX'], ['Piedra y templo', 'OEYZGjy'], ['Fuego y luz', 'FLa'],
  ['Exteriores', 'fouVgnAe'], ['Secretos', 'N'],
];
const TOOLS = [
  ['paint', 'brush', 'Pincel'], ['rect', 'grid', 'Rectángulo'], ['fill', 'bucket', 'Rellenar'], ['prop', 'gem', 'Objeto'],
  ['erase', 'eraser', 'Borrar objeto'], ['spawn-party', 'crown', 'Inicio grupo'], ['spawn-enemies', 'skull', 'Inicio enemigos'], ['pan', 'hand', 'Mover vista'],
];
const LIGHT_ICON = { dia: '☀️', penumbra: '🌆', noche: '🌙', oscuridad: '🌑' };

async function mount(root, [sceneId]) {
  const [cat, custom, combats] = await Promise.all([sceneCatalog(), api.list('scenes'), api.list('combats')]);
  const state = { custom, combats };
  const lightName = Object.fromEntries(cat.lights.map((l) => [l.key, l.name]));
  const findAny = (id) => cat.presets.find((s) => s.id === id) || state.custom.find((s) => s.id === id) || null;
  let cleanup = null;

  // ------------------------------------------------------------------ acciones comunes
  async function duplicate(sc, open = true) {
    const { id, preset, created, updated, ...rest } = structuredClone(sc);
    try {
      const copy = await api.create('scenes', { ...rest, name: preset ? sc.name : `${sc.name} (copia)`, from: id });
      state.custom.push(copy);
      sfx.magic();
      toast(preset ? `«${copy.name}» copiado a tus escenarios: ya puedes editarlo.` : `Copia de «${sc.name}» creada.`, { kind: 'good', iconName: 'copy' });
      if (open) location.hash = `#/escenarios/${copy.id}`; else renderGallery();
      return copy;
    } catch (e) { toastError(e); return null; }
  }

  async function useInCombat(sc) {
    const open = state.combats.filter((c) => c.status !== 'finished');
    let picked = open.find((c) => c.status === 'active')?.id || open[0]?.id || null;
    const list = h('div', { class: 'stack-sm pick-list' });
    const draw = () => clear(list, open.map((c) => h('button', {
      class: 'btn pick-item', type: 'button', 'aria-pressed': String(c.id === picked),
      onclick: () => { picked = c.id; draw(); },
      ondblclick: (e) => e.currentTarget.closest('.modal').querySelector('.actions .primary')?.click(),
    }, h('span', { class: `status-dot ${c.status}` }), h('b', {}, c.name), h('span', { class: 'tiny muted' }, ` · ${c.combatants.length} participantes${c.board?.scene ? ` · ahora: ${findAny(c.board.scene)?.name || '—'}` : ''}`))));
    draw();
    const choice = await modal(`Usar «${sc.name}» en un combate`, h('div', { class: 'stack' },
      h('p', { class: 'muted', style: { margin: 0 } }, 'Las fichas se colocan solas en las zonas de inicio del escenario.'),
      open.length ? list : h('p', { class: 'small' }, 'No hay combates preparados ni en curso: crea uno nuevo.')),
    [{ label: 'Cancelar', value: null }, { label: 'Nuevo combate', value: 'new', icon: 'plus' },
      ...(open.length ? [{ label: 'Usar en el elegido', value: () => picked, class: 'primary', icon: 'check' }] : [])],
    { iconName: 'grid' });
    if (!choice) return;
    try {
      let combat = choice === 'new' ? await api.create('combats', { ...newCombat(state.combats.length + 1), name: `Combate en ${sc.name}` }) : state.combats.find((c) => c.id === choice);
      if (!combat) return;
      const board = ensureBoard(combat);
      if (board.scene !== sc.id) { board.pos = {}; board.moved = {}; board.fog = null; }
      board.scene = sc.id;
      autoPlace(combat, sc, cat);
      combat = await api.update('combats', combat);
      sfx.unroll();
      location.hash = `#/combate/${combat.id}`;
    } catch (e) { toastError(e); }
  }

  async function remove(sc) {
    const users = state.combats.filter((c) => c.board?.scene === sc.id);
    if (!(await confirmDialog(`Se eliminará el escenario «${sc.name}».${users.length ? ` Lo usan ${users.length} combate(s), que se quedarán sin tablero.` : ''}`))) return false;
    try {
      await api.remove('scenes', sc.id);
      if (sc.bg) await api.removeUpload(sc.bg);
      state.custom = state.custom.filter((x) => x !== sc);
      return true;
    } catch (e) { toastError(e); return false; }
  }

  async function newSceneDialog(bgUrl = '', aspect = 0) {
    const s = { name: bgUrl ? 'Mapa con cuadrícula' : 'Nuevo escenario', cols: 24, rows: aspect ? Math.max(8, Math.round(24 / aspect)) : 16, fill: bgUrl ? '_' : ',', walls: false };
    const fills = cat.terrain.filter((t) => t.kind !== 'muro' && t.code !== 'v' && t.code !== 'l' && (bgUrl || t.code !== '_'));
    const ok = await modal(bgUrl ? 'Escenario desde una imagen' : 'Nuevo escenario', h('div', { class: 'stack' },
      field('Nombre', h('input', { value: s.name, oninput: (e) => { s.name = e.target.value; } })),
      h('div', { class: 'row' },
        field('Columnas', h('input', { type: 'number', min: 6, max: 60, value: s.cols, oninput: (e) => { s.cols = Number(e.target.value); } })),
        field('Filas', h('input', { type: 'number', min: 6, max: 60, value: s.rows, oninput: (e) => { s.rows = Number(e.target.value); } })),
        field('Terreno base', selectEl(fills.map((t) => [t.code, t.name]), s.fill, (v) => { s.fill = v; }))),
      !bgUrl && h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { s.walls = e.target.checked; } }), 'Rodear de muros de piedra (una sala)'),
      h('p', { class: 'tiny muted' }, bgUrl
        ? 'La imagen se estira sobre la cuadrícula. Ajusta columnas y filas hasta que coincidan con las casillas dibujadas en la imagen; luego pinta muros o agua encima si quieres que cuenten para el movimiento.'
        : `Cada casilla mide 1,5 m: ${s.cols} × ${s.rows} casillas son ${fmtMeters(s.cols * 1.5)} × ${fmtMeters(s.rows * 1.5)}.`)),
    [{ label: 'Cancelar', value: false }, { label: 'Crear', value: true, class: 'primary', icon: 'plus' }], { iconName: 'grid' });
    if (!ok) return;
    const cols = Math.max(6, Math.min(60, Math.round(s.cols) || 24));
    const rows = Math.max(6, Math.min(60, Math.round(s.rows) || 16));
    const sc = blankScene(cols, rows, s.fill);
    sc.name = s.name.trim() || 'Nuevo escenario';
    if (bgUrl) sc.bg = bgUrl;
    if (s.walls) {
      const t = sc.tiles.split('');
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!r || !c || r === rows - 1 || c === cols - 1) t[r * cols + c] = '#';
      sc.tiles = t.join('');
    }
    try {
      const saved = await api.create('scenes', sc);
      state.custom.push(saved);
      sfx.unroll();
      location.hash = `#/escenarios/${saved.id}`;
    } catch (e) { toastError(e); }
  }

  // Mazmorra o cueva al azar (como donjon o el «One Page Dungeon» de watabou): se ve antes de guardarla.
  async function dungeonDialog() {
    const s = { size: 'mediana', kind: 'mazmorra', seed: '' };
    const stage = h('div', { class: 'preview-stage' });
    const keyEl = h('pre', { class: 'dungeon-key' });
    const bm = createBattleMap({ catalog: cat, dm: true, range: false });
    stage.append(bm.el);
    let sc = null;
    const make = async (seed = '') => {
      try {
        sc = await api.post('/api/dungeon', { ...s, seed });
        s.seed = sc.seed;
        seedIn.value = sc.seed;
        bm.setScene(sc);
        bm.fit();
        keyEl.textContent = sc.description;
        sfx.unroll();
      } catch (e) { toastError(e); }
    };
    const seedIn = h('input', { class: 'inline', type: 'number', min: 1, 'aria-label': 'Semilla', onchange: (e) => make(e.target.value) });
    const done = modal('Mazmorra al azar', h('div', { class: 'stack' },
      h('div', { class: 'row' },
        segmented([['mazmorra', '🏰 Mazmorra'], ['cueva', '🕳️ Cueva']], s.kind, (v) => { s.kind = v; make(); }),
        segmented([['pequena', 'Pequeña'], ['mediana', 'Mediana'], ['grande', 'Grande']], s.size, (v) => { s.size = v; make(); }),
        h('button', { class: 'btn', type: 'button', onclick: () => make() }, '🎲 Otra'),
        field('Semilla', seedIn)),
      h('div', { class: 'dungeon-layout' }, stage, keyEl),
      h('p', { class: 'tiny muted' }, 'Las puertas empiezan cerradas: en combate se abren con un clic. Con la misma semilla sale la misma mazmorra.')),
    [{ label: 'Cancelar', value: false }, { label: 'Guardar como escenario', value: true, class: 'primary', icon: 'save' }], { wide: true, iconName: 'grid' });
    requestAnimationFrame(() => make());
    const ok = await done;
    bm.destroy();
    if (!ok || !sc) return;
    try {
      const saved = await api.create('scenes', sc);
      state.custom.push(saved);
      toast(`«${saved.name}» guardada en tus escenarios.`, { kind: 'good', iconName: 'grid' });
      renderGallery();
    } catch (e) { toastError(e); }
  }

  async function fromImage() {
    const [file] = await pickFiles('image/*');
    if (!file) return;
    try {
      const up = await api.upload(file);
      const img = new Image();
      const aspect = await new Promise((res) => { img.onload = () => res(img.naturalWidth / img.naturalHeight); img.onerror = () => res(1.5); img.src = up.url; });
      await newSceneDialog(up.url, aspect);
    } catch (e) { toastError(e); }
  }

  async function preview(sc) {
    const stage = h('div', { class: 'preview-stage' });
    const bm = createBattleMap({ catalog: cat, dm: true, range: false });
    stage.append(bm.el);
    const done = modal(sc.name, h('div', { class: 'stack' }, h('p', { class: 'muted', style: { margin: 0 } }, sc.description || ''), stage,
      h('p', { class: 'tiny muted' }, 'Pasa el ratón por las casillas para ver el terreno y la cobertura. Rueda para acercar, arrastra para moverte, R para la regla y A para las áreas.')),
    [{ label: 'Cerrar', value: null }, sc.preset ? { label: 'Personalizar', value: 'copy', icon: 'edit' } : { label: 'Editar', value: 'edit', icon: 'edit' },
      { label: 'Usar en un combate', value: 'use', class: 'primary', icon: 'combate' }], { wide: true, iconName: 'grid' });
    requestAnimationFrame(() => bm.setScene(sc));
    const v = await done;
    bm.destroy();
    if (v === 'copy') duplicate(sc);
    else if (v === 'edit') location.hash = `#/escenarios/${sc.id}`;
    else if (v === 'use') useInCombat(sc);
  }

  // Descargar el escenario como una imagen grande (PNG) para imprimirlo o usarlo en otra mesa virtual.
  async function downloadDialog(sc) {
    const st = { px: 150, dm: false, labels: true };
    const info = h('p', { class: 'small muted', style: { margin: 0 } });
    const update = () => {
      const s = imagePx(sc, st.px);
      const m = st.labels ? Math.round(s * 0.5) : 0;
      info.textContent = `Saldrá de ${sc.cols * s + 2 * m} × ${sc.rows * s + 2 * m} píxeles (${s} por casilla)`
        + (s < st.px ? '; el escenario es tan grande que se reduce para que el navegador pueda crearla.' : '.')
        + (s === 300 ? ' Impresa a 300 ppp, cada casilla mide 2,54 cm, el tamaño de las miniaturas.' : '');
    };
    const body = h('div', { class: 'stack' },
      field('Calidad', segmented([[96, 'Pantalla'], [150, 'Alta'], [300, 'Para imprimir']], st.px, (v) => { st.px = v; update(); })),
      field('Versión', segmented([[false, 'Para los jugadores'], [true, 'Del máster']], st.dm, (v) => { st.dm = v; })),
      h('p', { class: 'tiny muted', style: { margin: 0 } }, 'La del máster incluye lo oculto (trampas y puertas secretas); la de los jugadores, no.'),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: st.labels, onchange: (e) => { st.labels = e.target.checked; update(); } }),
        'Letras y números de las casillas en el borde (A1, B2…)'),
      info);
    update();
    const ok = await modal(`Descargar «${sc.name}»`, body,
      [{ label: 'Cancelar', value: false }, { label: 'Descargar PNG', value: true, class: 'primary', icon: 'download' }], { iconName: 'download' });
    if (!ok) return;
    try {
      const cv = await sceneImage(sc, cat, st);
      const blob = await new Promise((done) => cv.toBlob(done, 'image/png'));
      if (!blob) throw new Error('El navegador no ha podido crear una imagen tan grande: prueba con menos calidad.');
      const file = `${sc.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Escenario'}${st.dm ? ' (máster)' : ''}.png`;
      const a = h('a', { href: URL.createObjectURL(blob), download: file });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast(`«${file}» descargado (${cv.width} × ${cv.height} px).`, { kind: 'good', iconName: 'download' });
    } catch (e) { toastError(e); }
  }
  const downloadBtn = (sc, cls = 'btn sm icon') => h('button', { class: cls, type: 'button', 'aria-label': 'Descargar imagen', 'data-tip': 'Descargar como imagen de alta resolución',
    onclick: () => downloadDialog(sc) }, icon('download', 14), !cls.includes('icon') && 'Descargar imagen');

  // =================================================================== galería
  function card(sc) {
    const users = state.combats.filter((c) => c.board?.scene === sc.id && c.status !== 'finished').length;
    return h('article', { class: 'scene-card' },
      h('button', { class: 'scene-art', type: 'button', onclick: () => (sc.preset ? preview(sc) : (location.hash = `#/escenarios/${sc.id}`)), 'data-tip': sc.preset ? 'Ver de cerca' : 'Editar' },
        sceneThumb(sc, cat, 560, 340),
        users > 0 && h('span', { class: 'ribbon-tag' }, icon('combate', 13), `En ${users} combate${users > 1 ? 's' : ''}`),
        h('span', { class: 'scene-size' }, `${sc.cols}×${sc.rows} · ${fmtMeters(sc.cols * 1.5)} × ${fmtMeters(sc.rows * 1.5)}`)),
      h('div', { class: 'scene-body' },
        h('div', { class: 'row between nowrap' }, h('h3', {}, sc.name), h('span', { class: 'chip light-chip', 'data-tip': lightName[sc.light] || '' }, LIGHT_ICON[sc.light] || '☀️', ` ${lightName[sc.light] || ''}`)),
        h('p', {}, sc.description || (sc.preset ? '' : `Creado el ${fmtDate(sc.created)}`)),
        h('div', { class: 'scene-actions' },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => useInCombat(sc) }, icon('combate', 14), 'Usar en combate'),
          sc.preset
            ? [h('button', { class: 'btn sm', type: 'button', onclick: () => preview(sc) }, icon('eye', 14), 'Ver'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => duplicate(sc), 'data-tip': 'Haz tu propia versión editable' }, icon('edit', 14), 'Personalizar'),
              downloadBtn(sc)]
            : [h('a', { class: 'btn sm', href: `#/escenarios/${sc.id}` }, icon('edit', 14), 'Editar'),
              downloadBtn(sc),
              h('button', { class: 'btn sm icon', type: 'button', 'aria-label': 'Duplicar', 'data-tip': 'Duplicar', onclick: () => duplicate(sc, false) }, icon('copy', 14)),
              h('button', { class: 'btn sm icon ghost', type: 'button', 'aria-label': 'Eliminar', 'data-tip': 'Eliminar', onclick: async () => { if (await remove(sc)) renderGallery(); } }, icon('trash', 14))])));
  }

  function renderGallery() {
    clear(root, h('div', { class: 'scene-gallery' },
      h('div', { class: 'panel ornate row' },
        h('div', { class: 'grow' }, h('h2', { style: { margin: 0 } }, 'Escenarios de combate'),
          h('p', { class: 'muted', style: { margin: '4px 0 0' } }, 'Tableros con cuadrícula de 1,5 m por casilla. Usa uno prediseñado tal cual, personalízalo o crea el tuyo pintando el terreno y colocando objetos.')),
        h('button', { class: 'btn', type: 'button', onclick: dungeonDialog, 'data-tip': 'Salas, pasillos, puertas y la clave de cada sala' }, '🎲 Mazmorra al azar'),
        h('button', { class: 'btn', type: 'button', onclick: fromImage, 'data-tip': 'Sube un mapa de batalla y ponle cuadrícula encima' }, icon('image', 16), 'Desde una imagen'),
        h('button', { class: 'btn primary lg', type: 'button', onclick: () => newSceneDialog() }, icon('plus', 18), 'Nuevo escenario')),
      h('section', { class: 'stack' },
        h('div', { class: 'eyebrow' }, icon('edit', 14), `Tus escenarios (${state.custom.length})`),
        state.custom.length ? h('div', { class: 'scene-grid' }, state.custom.map(card))
          : h('div', { class: 'empty' }, icon('grid'), h('h3', {}, 'Todavía no has creado ninguno'), h('p', {}, 'Pulsa «Personalizar» en un prediseñado para empezar desde él, o crea uno desde cero.'))),
      h('section', { class: 'stack' },
        h('div', { class: 'eyebrow' }, icon('star', 14), `Prediseñados (${cat.presets.length})`),
        h('div', { class: 'scene-grid' }, cat.presets.map(card)))));
  }

  // ===================================================================== editor
  function swatch(code, isProp) {
    const cv = h('canvas', { width: 80, height: 80 });
    const sc = { cols: 1, rows: 1, tiles: isProp ? '.' : code, props: isProp ? [{ k: code, c: 0, r: 0 }] : [], spawns: {} };
    drawScene(cv.getContext('2d'), sc, cat, { s: 80, dm: true });
    return cv;
  }

  function renderEditor(sc) {
    if (sc.preset) return renderPresetPage(sc);
    const save = debounced(() => api.update('scenes', sc).then((d) => { sc.updated = d.updated; }).catch(toastError), 500);
    const stage = h('div', { class: 'editor-stage' });
    const ed = { tool: 'paint', terrain: sc.bg ? '_' : ',', prop: 'T', w: 1, h: 1, brush: 1, hidden: false };
    const bm = createBattleMap({ catalog: cat, editable: true, dm: true, onChange: () => save() });
    stage.append(bm.el);
    const side = h('aside', { class: 'editor-side' });

    const applyEdit = () => { bm.setTool(ed.tool); bm.setEdit({ terrain: ed.terrain, prop: ed.prop, w: ed.w, h: ed.h, brush: ed.brush, hidden: ed.hidden }); };
    const toolBtn = ([k, ic, l]) => h('button', { class: 'ed-tool', type: 'button', 'aria-pressed': String(ed.tool === k), onclick: () => { ed.tool = k; applyEdit(); drawSide(); } },
      h('span', { class: 'ic' }, icon(ic, 18)), l);
    const terrainSw = (t) => h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(ed.terrain === t.code && ['paint', 'rect', 'fill'].includes(ed.tool)), 'data-tip': `${t.name}${t.cost === 2 ? ' · terreno difícil' : t.cost == null ? ' · no se puede pisar' : ''}${t.hazard ? ' · peligroso' : ''}`,
      onclick: () => { ed.terrain = t.code; if (!['paint', 'rect', 'fill'].includes(ed.tool)) ed.tool = 'paint'; applyEdit(); drawSide(); } }, swatch(t.code, false), t.name);
    const propSw = (p) => h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(ed.prop === p.code && ed.tool === 'prop'),
      'data-tip': `${p.name}${p.effect === 'bloquea' ? ' · bloquea el paso' : p.effect === 'dificil' ? ' · terreno difícil' : p.effect === 'peligro' ? ' · peligroso' : ''}${p.cover ? ` · cobertura ${p.cover}` : ''}${p.light ? ` · da luz (${fmtMeters(p.light * 1.5)})` : ''}`,
      onclick: () => { ed.prop = p.code; ed.tool = 'prop'; applyEdit(); drawSide(); } }, swatch(p.code, true), p.name);

    const size = { cols: sc.cols, rows: sc.rows };
    function drawSide() {
      const showTerrain = ['paint', 'rect', 'fill'].includes(ed.tool);
      const propsFirst = ed.tool === 'prop' || ed.tool === 'erase';
      clear(side,
        h('div', { class: 'panel stack' },
          h('div', { class: 'ed-tools' }, TOOLS.map(toolBtn)),
          ed.tool === 'paint' && h('div', { class: 'ed-row' }, h('span', { class: 'tiny muted' }, 'Pincel'),
            segmented([[1, '1×1'], [2, '2×2'], [3, '3×3']], ed.brush, (v) => { ed.brush = v; applyEdit(); })),
          ed.tool === 'prop' && h('div', { class: 'ed-row' }, h('span', { class: 'tiny muted' }, 'Tamaño'),
            selectEl([1, 2, 3, 4].map((n) => [n, `${n} de ancho`]), ed.w, (v) => { ed.w = Number(v); applyEdit(); }, { class: 'mini-sel', 'aria-label': 'Ancho del objeto' }),
            selectEl([1, 2, 3, 4].map((n) => [n, `${n} de alto`]), ed.h, (v) => { ed.h = Number(v); applyEdit(); }, { class: 'mini-sel', 'aria-label': 'Alto del objeto' }),
            h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: ed.hidden, onchange: (e) => { ed.hidden = e.target.checked; applyEdit(); } }), 'Solo lo ve el máster')),
          ed.tool.startsWith('spawn') && h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Pulsa casillas para marcar (o quitar) dónde aparecen las fichas al colocarlas automáticamente.'),
          ed.tool === 'erase' && h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Pulsa o arrastra sobre los objetos para quitarlos. También vale el clic derecho con cualquier herramienta.'),
          h('div', { class: 'ed-row' },
            h('button', { class: 'btn sm', type: 'button', onclick: () => bm.undo() || toast('Nada que deshacer.') }, icon('undo', 14), 'Deshacer'),
            h('button', { class: 'btn sm', type: 'button', onclick: () => bm.redo() || toast('Nada que rehacer.') }, icon('redo', 14), 'Rehacer'))),
        h('div', { class: `panel stack ${showTerrain ? '' : 'dim'}`, style: { order: propsFirst ? 2 : 1 } },
          h('h3', { style: { margin: 0 } }, icon('brush', 16), ' Terreno'),
          KIND_GROUPS.map(([kind, label]) => {
            const list = cat.terrain.filter((t) => t.kind === kind || (kind === 'suelo' && t.code === '_' && sc.bg));
            const shown = list.filter((t) => t.code !== '_' || sc.bg);
            return shown.length > 0 && [h('div', { class: 'ed-group-title' }, label), h('div', { class: 'swatches' }, shown.map(terrainSw))];
          })),
        h('div', { class: 'panel stack', style: { order: propsFirst ? 1 : 2 } },
          h('h3', { style: { margin: 0 } }, icon('gem', 16), ' Objetos'),
          PROP_GROUPS.map(([label, codes]) => [h('div', { class: 'ed-group-title' }, label),
            h('div', { class: 'swatches' }, [...codes].map((k) => cat.P[k]).filter(Boolean).map(propSw))])),
        h('div', { class: 'panel stack', style: { order: 3 } },
          h('h3', { style: { margin: 0 } }, icon('grid', 16), ' Escenario'),
          field('Luz', selectEl(cat.lights.map((l) => [l.key, `${LIGHT_ICON[l.key]} ${l.name}`]), sc.light, (v) => { sc.light = v; bm.redraw(); save(); })),
          h('div', { class: 'ed-row size-inputs' },
            field('Columnas', h('input', { type: 'number', min: 6, max: 60, value: size.cols, oninput: (e) => { size.cols = Number(e.target.value); } })),
            field('Filas', h('input', { type: 'number', min: 6, max: 60, value: size.rows, oninput: (e) => { size.rows = Number(e.target.value); } })),
            h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-end' }, onclick: () => {
              const cols = Math.max(6, Math.min(60, Math.round(size.cols) || sc.cols));
              const rows = Math.max(6, Math.min(60, Math.round(size.rows) || sc.rows));
              if (cols === sc.cols && rows === sc.rows) return;
              Object.assign(sc, resizeScene(sc, cols, rows, ed.terrain));
              bm.setScene(sc);
              save();
              toast(`Ahora mide ${cols} × ${rows} casillas.`, { iconName: 'grid' });
            } }, 'Aplicar')),
          h('div', { class: 'ed-row' },
            h('button', { class: 'btn sm', type: 'button', onclick: async () => {
              const [file] = await pickFiles('image/*');
              if (!file) return;
              try {
                const up = await api.upload(file);
                if (sc.bg) await api.removeUpload(sc.bg);
                sc.bg = up.url;
                bm.setScene(sc);
                save();
                drawSide();
              } catch (e) { toastError(e); }
            } }, icon('image', 14), sc.bg ? 'Cambiar imagen de fondo' : 'Imagen de fondo'),
            sc.bg && h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
              await api.removeUpload(sc.bg).catch(() => {});
              sc.bg = '';
              sc.tiles = sc.tiles.replaceAll('_', ',');
              bm.setScene(sc);
              save();
              drawSide();
            } }, icon('trash', 14), 'Quitar')),
          sc.bg && field('Opacidad de la imagen', h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: sc.bgOpacity ?? 1, oninput: (e) => { sc.bgOpacity = Number(e.target.value); bm.redraw(); save(); } })),
          sc.bg && h('p', { class: 'tiny muted', style: { margin: 0 } }, 'Usa el terreno «Sin terreno» para dejar ver la imagen y pinta muros o agua donde quieras que cuenten para el movimiento.'),
          field('Descripción', h('textarea', { rows: 3, value: sc.description || '', placeholder: 'Qué hay aquí, quién espera, trampas…', oninput: (e) => { sc.description = e.target.value; save(); } }))));
    }

    clear(root, h('div', { class: 'stack' },
      h('div', { class: 'panel ed-head' },
        h('a', { class: 'btn', href: '#/escenarios' }, icon('back', 16), 'Escenarios'),
        h('input', { class: 'title-input', value: sc.name, 'aria-label': 'Nombre del escenario', oninput: (e) => { sc.name = e.target.value; save(); } }),
        h('span', { class: 'tiny muted' }, 'Se guarda solo'),
        h('button', { class: 'btn', type: 'button', onclick: () => duplicate(sc, false) }, icon('copy', 15), 'Duplicar'),
        downloadBtn(sc, 'btn'),
        h('button', { class: 'btn ghost danger', type: 'button', onclick: async () => { if (await remove(sc)) location.hash = '#/escenarios'; } }, icon('trash', 15), 'Eliminar'),
        h('button', { class: 'btn primary', type: 'button', onclick: async () => { if (save.pending) await save.flush(); useInCombat(sc); } }, icon('combate', 15), 'Usar en combate')),
      h('div', { class: 'editor' }, side, stage)));
    drawSide();
    applyEdit();
    requestAnimationFrame(() => bm.setScene(sc));

    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); bm.undo(); }
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); bm.redo(); }
    };
    document.addEventListener('keydown', onKey);
    cleanup = () => { document.removeEventListener('keydown', onKey); bm.destroy(); if (save.pending) save.flush(); };
  }

  // Un prediseñado no se edita: se ve de cerca y se personaliza con una copia.
  function renderPresetPage(sc) {
    const stage = h('div', { class: 'editor-stage' });
    const bm = createBattleMap({ catalog: cat, dm: true, range: false });
    stage.append(bm.el);
    clear(root, h('div', { class: 'stack' },
      h('div', { class: 'panel ed-head' },
        h('a', { class: 'btn', href: '#/escenarios' }, icon('back', 16), 'Escenarios'),
        h('div', { class: 'grow' }, h('h2', { style: { margin: 0 } }, sc.name), h('div', { class: 'small muted' }, sc.description)),
        h('button', { class: 'btn', type: 'button', onclick: () => duplicate(sc) }, icon('edit', 15), 'Personalizar'),
        downloadBtn(sc, 'btn'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => useInCombat(sc) }, icon('combate', 15), 'Usar en combate')),
      stage));
    requestAnimationFrame(() => bm.setScene(sc));
    cleanup = () => bm.destroy();
  }

  if (sceneId) {
    const sc = findAny(sceneId);
    if (sc) renderEditor(sc);
    else { toast('Ese escenario ya no existe.'); renderGallery(); }
  } else renderGallery();
  return () => cleanup?.();
}
