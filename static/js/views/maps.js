// Mapas: galería de las imágenes de la campaña. Cada una se puede poner sobre la mesa,
// renombrar y acompañar de notas que solo ve el máster. Como en LegendKeeper o World Anvil, los mapas
// llevan chinchetas que enlazan con el compendio, con fichas o con otro mapa (la ciudad dentro de la región).
import { sfx } from '../core/sfx.js';
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, modal, confirmDialog, toast, toastError, pickFiles, dropZone, fmtDate, selectEl, segmented, field } from '../core/dom.js';

const PIN_ICONS = ['📍', '🏰', '🏠', '🏛️', '⛪', '🍺', '⚔️', '💀', '🐉', '💎', '🗝️', '🌲', '⛰️', '🏕️', '⚓', '🌊', '🕳️', '❓', '⭐', '🔥'];
const WIKI_ICON = { lugar: '🏰', faccion: '⚜️', objeto: '💎', deidad: '✨', historia: '📜', otro: '📌' };

export default { id: 'mapas', title: 'Mapas', icon: 'mapas', hint: 'Imágenes para poner sobre la mesa · tecla 5', mount };

async function mount(root, [openId]) {
  const [maps, settings, wiki, chars] = await Promise.all([api.list('maps'), api.settings(), api.list('wiki'), api.list('characters')]);
  const state = { maps, settings, wiki, chars };
  const save = debounced((m) => api.update('maps', m).catch(toastError), 400);
  const onTable = (m) => (state.settings.tableMap || state.settings.shownMap) === m.id;

  async function upload(files) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return toast('Elige una imagen (PNG, JPG, WEBP o GIF).', { kind: 'error' });
    for (const file of images) {
      try {
        const up = await api.upload(file);
        state.maps.unshift(await api.create('maps', { name: file.name.replace(/\.[^.]+$/, ''), url: up.url, notes: '', tokens: [] }));
        toast(`Mapa «${file.name}» añadido.`, { kind: 'good', iconName: 'mapas' });
      } catch (e) { toastError(e); }
    }
    render();
  }

  async function putOnTable(m) {
    try {
      state.settings = await api.saveSettings({ tableMap: m.id });
      sfx.unroll();
      location.hash = '#/mesa';
    } catch (e) { toastError(e); }
  }

  async function remove(m) {
    if (!(await confirmDialog(`Se eliminará el mapa «${m.name}», su imagen y las fichas colocadas en él.`))) return;
    try {
      await api.remove('maps', m.id);
      await api.removeUpload(m.url);
      if (onTable(m)) state.settings = await api.saveSettings({ tableMap: null, shownMap: null });
      state.maps = state.maps.filter((x) => x !== m);
      render();
    } catch (e) { toastError(e); }
  }

  function notesDialog(m) {
    modal(`Notas de «${m.name}»`, h('div', { class: 'stack' },
      h('img', { class: 'notes-preview', src: m.url, alt: '' }),
      bind(m, 'notes', { type: 'textarea', rows: 8, placeholder: 'Trampas, salidas secretas, quién vive aquí…', onChange: () => save(m) }),
      h('p', { class: 'tiny muted' }, 'Solo para el máster: no aparecen en la mesa.')), undefined, { iconName: 'feather', wide: true });
  }

  function card(m) {
    const name = bind(m, 'name', { class: 'map-name', 'aria-label': 'Nombre del mapa', onChange: () => save(m) });
    return h('article', { class: `map-card ${onTable(m) ? 'on-table' : ''}` },
      h('button', { class: 'map-frame', type: 'button', onclick: () => putOnTable(m), 'data-tip': 'Poner sobre la mesa' },
        h('img', { src: m.url, alt: '', loading: 'lazy' }),
        onTable(m) && h('span', { class: 'ribbon-tag' }, icon('mesa', 13), 'Sobre la mesa'),
        h('span', { class: 'map-hover' }, icon('mesa', 26), 'Poner en la mesa')),
      h('div', { class: 'map-info' }, name,
        h('div', { class: 'row between' },
          h('span', { class: 'tiny muted' }, `${(m.tokens || []).length} fichas · ${fmtDate(m.created)}`),
          h('div', { class: 'row nowrap' },
            h('button', { class: 'btn xs', type: 'button', 'data-tip': 'Chinchetas: lugares enlazados con el compendio, fichas u otros mapas', onclick: () => viewer(m) }, icon('pin', 14), (m.pins || []).length || ''),
            h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': m.notes ? 'Ver notas' : 'Añadir notas', onclick: () => notesDialog(m) }, icon(m.notes ? 'scroll' : 'feather', 15)),
            h('button', { class: 'btn icon xs ghost', type: 'button', 'data-tip': 'Eliminar', onclick: () => remove(m) }, icon('trash', 15))))));
  }

  function render() {
    const drop = dropZone(h('div', { class: 'panel dropzone' },
      h('div', { class: 'drop-art' }, icon('upload', 34)),
      h('div', { class: 'grow' }, h('h3', {}, 'Añadir mapas'),
        h('p', { class: 'muted', style: { margin: 0 } }, 'Arrastra aquí imágenes (PNG, JPG, WEBP o GIF) o súbelas con el botón. Después, pon una sobre la mesa.')),
      h('button', { class: 'btn primary lg', type: 'button', onclick: async () => upload(await pickFiles('image/*', true)) }, icon('upload', 18), 'Subir imágenes')), upload);
    clear(root, h('div', { class: 'stack' }, drop,
      state.maps.length ? h('div', { class: 'map-grid' }, state.maps.map(card))
        : h('div', { class: 'empty' }, icon('mapas'), h('h3', {}, 'Todavía no hay mapas'), h('p', {}, 'Sube la imagen de una mazmorra, una ciudad o un mapa del mundo.'))));
  }

  // ---------------------------------------------------------------- chinchetas
  // Visor con el mapa a la izquierda y la chincheta elegida a la derecha. En «Colocar», un clic en el mapa
  // pone una chincheta y se pueden arrastrar. Una chincheta que lleva a otro mapa se abre aquí mismo.
  function linkInfo(link) {
    const [kind, id] = String(link || '').split(':');
    if (kind === 'wiki') { const e = state.wiki.find((x) => x.id === id); return e && { icon: WIKI_ICON[e.type] || '📖', name: e.name, text: e.summary, image: e.image, href: `#/mundo/compendio/${e.id}` }; }
    if (kind === 'char') { const c = state.chars.find((x) => x.id === id); return c && { icon: '👤', name: c.name, text: [c.race, c.cls, c.location].filter(Boolean).join(' · '), href: `#/personajes/${c.id}` }; }
    if (kind === 'map') { const m = state.maps.find((x) => x.id === id); return m && { icon: '🗺️', name: m.name, text: 'Abre este mapa', map: m }; }
    return null;
  }

  function viewer(start) {
    const trail = [start];
    const ui = { mode: 'ver', sel: null };
    const wrap = h('div', { class: 'pin-viewer' });
    const closeViewer = () => wrap.closest('.modal')?.querySelector('.panel-head [aria-label="Cerrar"]')?.click();
    const leave = (href) => { closeViewer(); location.hash = href; };
    function draw() {
      const m = trail[trail.length - 1];
      m.pins ||= [];
      const pin = m.pins.find((p) => p.id === ui.sel);
      const stage = h('div', { class: `pin-stage ${ui.mode === 'colocar' ? 'placing' : ''}` }, h('img', { src: m.url, alt: m.name, draggable: 'false' }),
        m.pins.map((p) => {
          const info = linkInfo(p.link);
          const el = h('button', { class: `pin ${p.id === ui.sel ? 'on' : ''}`, type: 'button', style: { left: `${p.x * 100}%`, top: `${p.y * 100}%` },
            'data-tip': p.label || info?.name || 'Chincheta', onclick: (e) => { e.stopPropagation(); if (!el.moved) { ui.sel = p.id; sfx.click(); draw(); } } },
          h('span', { class: 'pin-ic' }, p.icon || '📍'), (p.label || info?.name) && h('span', { class: 'pin-label' }, p.label || info.name));
          if (ui.mode === 'colocar') el.addEventListener('pointerdown', (e) => dragPin(e, el, p, m));
          return el;
        }));
      stage.addEventListener('click', (e) => {
        if (ui.mode !== 'colocar' || e.target.closest('.pin')) return;
        const r = stage.getBoundingClientRect();
        const p = { id: Math.random().toString(36).slice(2, 9), x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, icon: '📍', label: '', link: '' };
        m.pins.push(p);
        ui.sel = p.id;
        sfx.pin();
        save(m);
        draw();
      });
      clear(wrap,
        h('div', { class: 'row between pin-bar' },
          h('div', { class: 'row nowrap crumbs' }, trail.map((x, i) => [i > 0 && h('span', { class: 'muted' }, '›'),
            h('button', { class: 'btn xs ghost', type: 'button', disabled: i === trail.length - 1, onclick: () => { trail.length = i + 1; ui.sel = null; draw(); } }, x.name)])),
          h('div', { class: 'row' },
            segmented([['ver', 'Ver'], ['colocar', '📍 Colocar']], ui.mode, (v) => { ui.mode = v; draw(); }),
            h('button', { class: 'btn sm', type: 'button', onclick: () => { closeViewer(); putOnTable(m); } }, icon('mesa', 14), 'A la mesa'))),
        h('div', { class: 'pin-layout' }, stage, side(m, pin)));
    }
    function side(m, p) {
      if (!p) {
        return h('aside', { class: 'pin-side' }, h('p', { class: 'small muted' }, ui.mode === 'colocar'
          ? 'Haz clic en el mapa para poner una chincheta. Arrástralas para moverlas.'
          : `${m.pins.length ? 'Pulsa una chincheta para ver qué hay allí.' : 'Este mapa no tiene chinchetas. Pasa a «Colocar» para añadirlas.'}`),
        m.pins.length > 0 && h('ul', { class: 'pin-index' }, m.pins.map((x) => h('li', {}, h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { ui.sel = x.id; draw(); } },
          x.icon || '📍', ' ', x.label || linkInfo(x.link)?.name || 'Chincheta')))));
      }
      const info = linkInfo(p.link);
      const changed = () => { save(m); };
      const links = [['', '— Sin enlace —'],
        ...state.wiki.map((e) => [`wiki:${e.id}`, `${WIKI_ICON[e.type] || '📖'} ${e.name}`]),
        ...state.chars.map((c) => [`char:${c.id}`, `👤 ${c.name}`]),
        ...state.maps.filter((x) => x !== m).map((x) => [`map:${x.id}`, `🗺️ ${x.name}`])];
      return h('aside', { class: 'pin-side' },
        info?.image && h('img', { class: 'pin-thumb', src: info.image, alt: '' }),
        h('h3', {}, p.icon || '📍', ' ', p.label || info?.name || 'Chincheta'),
        info?.text && h('p', { class: 'small' }, info.text),
        info && h('button', { class: 'btn sm primary', type: 'button', onclick: () => {
          if (info.map) { trail.push(info.map); ui.sel = null; sfx.unroll(); draw(); } else leave(info.href);
        } }, icon('arrowRight', 14), info.map ? 'Entrar en el mapa' : 'Abrir'),
        ui.mode === 'colocar' && [
          field('Nombre', bind(p, 'label', { placeholder: info?.name || 'Aldea, cueva, torre…', onChange: () => { changed(); } })),
          field('Enlace', selectEl(links, p.link || '', (v) => { p.link = v; changed(); draw(); })),
          h('div', { class: 'pin-icons' }, PIN_ICONS.map((ic) => h('button', { class: 'look-opt', type: 'button', 'aria-pressed': String((p.icon || '📍') === ic),
            onclick: () => { p.icon = ic; changed(); draw(); } }, ic))),
          h('button', { class: 'btn sm danger', type: 'button', onclick: () => { m.pins = m.pins.filter((x) => x !== p); ui.sel = null; save(m); draw(); } }, icon('trash', 14), 'Quitar chincheta')],
        ui.mode === 'ver' && h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { ui.mode = 'colocar'; draw(); } }, icon('edit', 13), 'Editar'));
    }
    function dragPin(e, el, p, m) {
      const stage = el.parentElement;
      const r = stage.getBoundingClientRect();
      el.moved = false;
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        p.x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
        p.y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
        el.style.left = `${p.x * 100}%`;
        el.style.top = `${p.y * 100}%`;
        el.moved = true;
      };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); if (el.moved) { save(m); setTimeout(() => { el.moved = false; }, 0); } };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    }
    draw();
    modal(`Chinchetas · ${start.name}`, wrap, [], { wide: true, iconName: 'pin' }).then(() => { if (save.pending) save.flush(); render(); });
  }

  render();
  const first = state.maps.find((m) => m.id === openId);
  if (first) viewer(first);
  return () => save.pending && save.flush();
}
