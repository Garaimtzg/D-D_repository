// Mapas: galería de las imágenes de la campaña. Cada una se puede poner sobre la mesa,
// renombrar y acompañar de notas que solo ve el máster.
import { sfx } from '../core/sfx.js';
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, modal, confirmDialog, toast, toastError, pickFiles, dropZone, fmtDate } from '../core/dom.js';

export default { id: 'mapas', title: 'Mapas', icon: 'mapas', hint: 'Imágenes para poner sobre la mesa · tecla 4', mount };

async function mount(root) {
  const [maps, settings] = await Promise.all([api.list('maps'), api.settings()]);
  const state = { maps, settings };
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

  render();
  return () => save.pending && save.flush();
}
