// Notas: el diario de campaña como un libro de pergamino y las misiones como un tablón
// de anuncios con notas clavadas.
import { sfx } from '../core/sfx.js';
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, segmented, searchBox, confirmDialog, toast, toastError, fmtDate } from '../core/dom.js';

export default { id: 'notas', title: 'Notas', icon: 'notas', hint: 'Diario de campaña y misiones · tecla 7', mount };

const QUEST_STATUS = [['activa', 'Activas', 'flame'], ['pendiente', 'Rumores', 'compass'], ['completada', 'Completadas', 'check'], ['fallida', 'Fallidas', 'skull']];

async function mount(root, [tab]) {
  const [notes, quests] = await Promise.all([api.list('notes'), api.list('quests')]);
  const state = { tab: tab === 'misiones' ? 'misiones' : 'diario', notes, quests, sel: null, search: '' };
  // un guardado con retardo por documento, para que editar uno no cancele el de otro
  const savers = new Map();
  const save = (col, doc) => {
    if (!savers.has(doc.id)) savers.set(doc.id, debounced(() => api.update(col, doc).then((d) => { doc.updated = d.updated; }).catch(toastError), 500));
    savers.get(doc.id)();
  };
  save.flush = (col, doc) => { save(col, doc); savers.get(doc.id).flush(); };

  const body = h('div');
  root.append(h('div', { class: 'stack' },
    segmented([['diario', 'Diario de campaña', notes.length], ['misiones', 'Misiones', quests.filter((q) => q.status === 'activa').length]], state.tab,
      (v) => { state.tab = v; state.sel = null; history.replaceState(null, '', `#/notas/${v}`); render(); }),
    body));

  const render = () => (state.tab === 'diario' ? renderJournal() : renderQuests());

  // ------------------------------------------------------------------- diario
  function renderJournal() {
    const listEl = h('ul', { class: 'list journal-list' });
    const page = h('section', { class: 'journal-page' });

    const drawList = () => clear(listEl, [...state.notes]
      .filter((n) => !state.search || `${n.title} ${n.body} ${n.tags}`.toLowerCase().includes(state.search))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.created - a.created)
      .map((n) => h('li', { 'aria-selected': String(n === state.sel), onclick: () => { state.sel = n; drawList(); drawPage(); } },
        h('span', { class: 'session-badge' }, n.session ?? '·'),
        h('div', { class: 'grow' }, h('b', {}, n.pinned ? '📌 ' : '', n.title || 'Sin título'),
          h('div', { class: 'tiny muted' }, fmtDate(n.created), n.tags ? ` · ${n.tags}` : '')))));

    const drawPage = () => {
      const n = state.sel;
      if (!n) {
        clear(page, h('div', { class: 'book parchment empty-book' }, icon('book'), h('h3', {}, 'El diario de la campaña'),
          h('p', {}, 'Escribe qué pasó en cada sesión, quién mintió y qué le debe el grupo a quién. Todo se guarda solo.')));
        return;
      }
      const changed = () => { save('notes', n); drawList(); };
      const words = () => (n.body || '').trim().split(/\s+/).filter(Boolean).length;
      const counter = h('span', { class: 'tiny muted' }, `${words()} palabras`);
      const text = bind(n, 'body', { type: 'textarea', class: 'book-text', placeholder: 'Querido diario: hoy el grupo…', onChange: () => { changed(); counter.textContent = `${words()} palabras`; }, 'aria-label': 'Texto de la entrada' });
      clear(page, h('article', { class: 'book parchment' },
        h('div', { class: 'book-head' },
          h('div', { class: 'row nowrap' }, h('span', { class: 'drop-cap' }, (n.title || 'S')[0]),
            bind(n, 'title', { class: 'book-title grow', placeholder: 'Título', onChange: changed, 'aria-label': 'Título' })),
          h('div', { class: 'row' },
            field('Sesión', bind(n, 'session', { type: 'number', class: 'inline mini', onChange: changed })),
            field('Etiquetas', bind(n, 'tags', { placeholder: 'villano, pistas, pueblo…', onChange: changed }), 'grow'),
            h('label', { class: 'check' }, bind(n, 'pinned', { type: 'checkbox', onChange: changed }), '📌 Fijar'),
            h('button', { class: 'btn sm ghost', type: 'button', 'data-tip': 'Insertar la fecha y hora de hoy', onclick: () => {
              const stamp = `\n— ${new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })} —\n`;
              const pos = text.selectionStart ?? text.value.length;
              text.setRangeText(stamp, pos, pos, 'end');
              text.dispatchEvent(new Event('input'));
              text.focus();
            } }, icon('clock', 14), 'Fecha'),
            h('button', { class: 'btn sm danger', type: 'button', onclick: async () => {
              if (!(await confirmDialog('Se eliminará esta entrada del diario.'))) return;
              await api.remove('notes', n.id).catch(toastError);
              state.notes = state.notes.filter((x) => x !== n);
              state.sel = null;
              renderJournal();
            } }, icon('trash', 14)))),
        text,
        h('div', { class: 'row between book-foot' }, counter, h('span', { class: 'tiny muted' }, 'Guardado automático'))));
    };

    clear(body, h('div', { class: 'split journal' },
      h('aside', { class: 'panel sticky' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('book'), 'Entradas'),
          h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
            const last = Math.max(0, ...state.notes.map((x) => Number(x.session) || 0));
            try {
              const n = await api.create('notes', { title: `Sesión ${last + 1}`, session: last + 1, body: '', tags: '', pinned: false });
              state.notes.push(n);
              sfx.page();
              state.sel = n;
              renderJournal();
              page.querySelector('textarea')?.focus();
            } catch (e) { toastError(e); }
          } }, icon('plus', 15), 'Nueva'))),
        h('div', { style: { marginBottom: '10px' } }, searchBox('Buscar en el diario…', (v) => { state.search = v.toLowerCase(); drawList(); }, state.search)),
        listEl),
      page));
    drawList();
    drawPage();
  }

  // ---------------------------------------------------------------- misiones
  function renderQuests() {
    const columns = QUEST_STATUS.map(([status, label, ic]) => {
      const items = state.quests.filter((q) => q.status === status);
      const col = h('div', { class: `quest-col q-${status}`, dataset: { status } },
        h('div', { class: 'quest-col-head' }, icon(ic, 18), h('b', {}, label), h('span', { class: 'count' }, items.length),
          status === 'activa' && h('button', { class: 'btn xs primary', type: 'button', style: { marginLeft: 'auto' }, onclick: () => newQuest('activa') }, icon('plus', 13), 'Misión'),
          status === 'pendiente' && h('button', { class: 'btn xs', type: 'button', style: { marginLeft: 'auto' }, onclick: () => newQuest('pendiente') }, icon('plus', 13), 'Rumor')),
        h('div', { class: 'quest-notes' }, items.map((q, i) => questNote(q, i)),
          !items.length && h('p', { class: 'tiny muted center' }, status === 'activa' ? 'Ninguna misión en marcha.' : 'Vacío.')));
      // arrastrar notas entre columnas
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('over');
        const q = state.quests.find((x) => x.id === e.dataTransfer.getData('text/quest'));
        if (q && q.status !== status) {
          q.status = status;
          if (status === 'completada') sfx.levelup(); else if (status === 'fallida') sfx.fail(); else sfx.pin();
          save.flush('quests', q);
          if (status === 'completada') toast(`¡Misión completada: ${q.title}!`, { kind: 'good', iconName: 'crown' });
          renderQuests();
        }
      });
      return col;
    });
    clear(body, h('div', { class: 'notice-board' }, columns),
      h('p', { class: 'tiny muted center' }, 'Arrastra las notas entre columnas para cambiar su estado.'));
  }

  async function newQuest(status) {
    try {
      const q = await api.create('quests', { title: status === 'pendiente' ? 'Nuevo rumor' : 'Nueva misión', giver: '', reward: '', status, description: '' });
      state.quests.push(q);
      sfx.pin();
      renderQuests();
      body.querySelector(`[data-id="${q.id}"] input`)?.focus();
    } catch (e) { toastError(e); }
  }

  function questNote(q, i) {
    const changed = () => save('quests', q);
    const note = h('article', { class: 'quest-note', draggable: 'true', dataset: { id: q.id }, style: { '--tilt': `${((i * 37) % 7) - 3}deg` } },
      h('span', { class: 'pin' }),
      bind(q, 'title', { class: 'quest-title', onChange: changed, 'aria-label': 'Título de la misión' }),
      h('div', { class: 'row nowrap quest-meta' },
        h('label', { class: 'grow' }, icon('user', 13), bind(q, 'giver', { placeholder: 'Quién la encarga', onChange: changed, 'aria-label': 'Quién la encarga' })),
        h('label', { class: 'grow' }, icon('coins', 13), bind(q, 'reward', { placeholder: 'Recompensa', onChange: changed, 'aria-label': 'Recompensa' }))),
      bind(q, 'description', { type: 'textarea', rows: 3, placeholder: 'Pistas, lugares, nombres…', onChange: changed, 'aria-label': 'Descripción' }),
      h('div', { class: 'row between' },
        selectEl(QUEST_STATUS.map(([v, l]) => [v, l]), q.status, (v) => { q.status = v; save.flush('quests', q); renderQuests(); }, { class: 'mini-sel', 'aria-label': 'Estado' }),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Eliminar', onclick: async () => {
          if (!(await confirmDialog(`Se eliminará «${q.title}».`))) return;
          await api.remove('quests', q.id).catch(toastError);
          state.quests = state.quests.filter((x) => x !== q);
          renderQuests();
        } }, icon('trash', 14))));
    note.addEventListener('dragstart', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      e.dataTransfer.setData('text/quest', q.id);
      note.classList.add('dragging');
    });
    note.addEventListener('dragend', () => note.classList.remove('dragging'));
    // dentro de los campos se escribe y se selecciona texto; la nota solo se arrastra desde fuera de ellos
    note.addEventListener('pointerdown', (e) => { note.draggable = !e.target.closest('input, textarea, select'); });
    return note;
  }

  render();
  return () => savers.forEach((s) => s.pending && s.flush());
}
