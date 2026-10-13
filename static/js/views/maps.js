// Mapas: imágenes subidas por el máster, con zoom, desplazamiento y opción de mostrarlas a los jugadores.
import { api, debounced } from '../core/api.js';
import { h, clear, bind, field, confirmDialog, toast, toastError, pickFiles } from '../core/dom.js';

const ICON = '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>';

export default { id: 'mapas', title: 'Mapas', icon: ICON, mount };

async function mount(root, [selId]) {
  const [maps, settings] = await Promise.all([api.list('maps'), api.settings()]);
  const state = { maps, settings, sel: maps.find((m) => m.id === selId) || null };
  const save = debounced((m) => api.update('maps', m).catch(toastError), 400);
  let teardown = null;

  async function upload(files) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return toast('Elige una imagen (PNG, JPG, WEBP o GIF).');
    for (const file of images) {
      try {
        const up = await api.upload(file);
        const m = await api.create('maps', { name: file.name.replace(/\.[^.]+$/, ''), url: up.url, notes: '' });
        state.maps.push(m);
      } catch (e) { toastError(e); }
    }
    render();
  }

  async function show(m) {
    try {
      state.settings = await api.saveSettings({ shownMap: m ? m.id : null });
      toast(m ? `«${m.name}» se ve ahora en la pantalla de jugadores.` : 'Mapa retirado de la pantalla de jugadores.');
      render();
    } catch (e) { toastError(e); }
  }

  async function remove(m) {
    if (!(await confirmDialog(`Se eliminará el mapa «${m.name}» y su imagen.`))) return;
    try {
      await api.remove('maps', m.id);
      await api.removeUpload(m.url);
      if (state.settings.shownMap === m.id) await show(null);
      state.maps = state.maps.filter((x) => x !== m);
      open(null);
    } catch (e) { toastError(e); }
  }

  function open(m) {
    state.sel = m;
    history.replaceState(null, '', m ? `#/mapas/${m.id}` : '#/mapas');
    render();
  }

  function render() {
    teardown?.();
    teardown = null;
    if (state.sel) return renderViewer(state.sel);
    const drop = h('div', { class: 'card dropzone' },
      h('div', { class: 'row between' },
        h('div', {}, h('h3', {}, 'Mapas'), h('p', { class: 'muted', style: { margin: 0 } }, 'Sube una imagen como mapa (o arrástrala aquí). Puedes mostrarla en la pantalla de jugadores.')),
        h('button', { class: 'btn primary', type: 'button', onclick: async () => upload(await pickFiles('image/*', true)) }, '+ Subir imagen')));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]); });

    clear(root, h('div', { class: 'stack' }, drop,
      state.maps.length ? h('div', { class: 'map-grid' }, state.maps.map((m) => h('button', { class: 'map-card', type: 'button', onclick: () => open(m) },
        h('img', { src: m.url, alt: '', loading: 'lazy' }),
        h('div', { class: 'row between' }, h('b', {}, m.name), state.settings.shownMap === m.id && h('span', { class: 'chip' }, '📺 En pantalla')))))
        : h('div', { class: 'empty' }, 'Todavía no hay mapas.')));
  }

  function renderViewer(m) {
    const view = { scale: 1, x: 0, y: 0 };
    const img = h('img', { src: m.url, alt: m.name, draggable: 'false' });
    const stage = h('div', { class: 'map-stage' }, img);
    const zoomLbl = h('span', { class: 'tnum small' }, '100%');
    const apply = () => {
      img.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
      zoomLbl.textContent = `${Math.round(view.scale * 100)}%`;
    };
    const fit = () => {
      const r = stage.getBoundingClientRect();
      if (!img.naturalWidth) return;
      view.scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      view.x = (r.width - img.naturalWidth * view.scale) / 2;
      view.y = (r.height - img.naturalHeight * view.scale) / 2;
      apply();
    };
    const zoomAt = (factor, cx, cy) => {
      const next = Math.min(8, Math.max(0.05, view.scale * factor));
      view.x = cx - (cx - view.x) * (next / view.scale);
      view.y = cy - (cy - view.y) * (next / view.scale);
      view.scale = next;
      apply();
    };
    const zoomCenter = (f) => { const r = stage.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); };
    img.addEventListener('load', fit);

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    let drag = null;
    stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX - view.x, y: e.clientY - view.y }; stage.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
    stage.addEventListener('pointermove', (e) => { if (!drag) return; view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; apply(); });
    stage.addEventListener('pointerup', () => { drag = null; stage.classList.remove('dragging'); });
    stage.addEventListener('dblclick', fit);
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    teardown = () => window.removeEventListener('resize', onResize);

    const shown = state.settings.shownMap === m.id;
    clear(root, h('div', { class: 'stack' },
      h('div', { class: 'card' },
        h('div', { class: 'row between' },
          h('div', { class: 'row grow' },
            h('button', { class: 'btn sm', type: 'button', onclick: () => open(null) }, '◀ Mapas'),
            bind(m, 'name', { class: 'title-input grow', 'aria-label': 'Nombre del mapa', onChange: () => save(m) })),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm icon', type: 'button', 'aria-label': 'Alejar', onclick: () => zoomCenter(1 / 1.25) }, '−'), zoomLbl,
            h('button', { class: 'btn sm icon', type: 'button', 'aria-label': 'Acercar', onclick: () => zoomCenter(1.25) }, '+'),
            h('button', { class: 'btn sm', type: 'button', onclick: fit }, 'Ajustar'),
            h('button', { class: 'btn sm', type: 'button', onclick: () => stage.requestFullscreen?.() }, 'Pantalla completa'),
            h('button', { class: `btn sm ${shown ? '' : 'primary'}`, type: 'button', onclick: () => show(shown ? null : m) }, shown ? 'Quitar de pantalla jugadores' : '📺 Mostrar a jugadores'),
            h('button', { class: 'btn sm danger', type: 'button', onclick: () => remove(m) }, 'Eliminar')))),
      stage,
      h('div', { class: 'card' }, field('Notas del mapa (solo para el máster)', bind(m, 'notes', { type: 'textarea', rows: 4, onChange: () => save(m) })))));
    requestAnimationFrame(fit);
  }

  render();
  return () => { teardown?.(); if (save.pending) save.flush(); };
}
