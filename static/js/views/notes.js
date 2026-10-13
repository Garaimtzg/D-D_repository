// Diario de campaña y misiones.
import { api, debounced } from '../core/api.js';
import { h, clear, bind, field, selectEl, segmented, confirmDialog, toastError, fmtDate } from '../core/dom.js';

const ICON = '<path d="M5 3h11l3 3v15H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>';
const QUEST_STATUS = [['activa', 'Activa'], ['pendiente', 'Pendiente'], ['completada', 'Completada'], ['fallida', 'Fallida']];

export default { id: 'notas', title: 'Notas', icon: ICON, mount };

async function mount(root, [tab]) {
  const [notes, quests] = await Promise.all([api.list('notes'), api.list('quests')]);
  const state = { tab: tab === 'misiones' ? 'misiones' : 'diario', notes, quests, sel: null, search: '' };
  // Un guardado con retardo por documento, para que editar uno no cancele el de otro.
  const savers = new Map();
  const save = (col, doc) => {
    if (!savers.has(doc.id)) savers.set(doc.id, debounced(() => api.update(col, doc).then((d) => { doc.updated = d.updated; }).catch(toastError), 500));
    savers.get(doc.id)();
  };
  save.flush = (col, doc) => { save(col, doc); savers.get(doc.id).flush(); };

  const body = h('div');
  root.append(h('div', { class: 'stack' },
    segmented([['diario', 'Diario de campaña'], ['misiones', 'Misiones']], state.tab, (v) => { state.tab = v; state.sel = null; render(); }),
    body));

  function render() {
    if (state.tab === 'diario') renderJournal(); else renderQuests();
  }

  // -- Diario ----------------------------------------------------------------
  function renderJournal() {
    const listEl = h('ul', { class: 'list' });
    const editor = h('section');
    const search = h('input', { type: 'search', placeholder: 'Buscar en el diario…', value: state.search,
      oninput: () => { state.search = search.value.toLowerCase(); drawList(); } });

    const drawList = () => clear(listEl, [...state.notes]
      .filter((n) => !state.search || `${n.title} ${n.body} ${n.tags}`.toLowerCase().includes(state.search))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.created - a.created)
      .map((n) => h('li', { 'aria-selected': String(n === state.sel), onclick: () => { state.sel = n; drawList(); drawEditor(); } },
        h('div', { class: 'grow' }, h('b', {}, n.pinned ? '📌 ' : '', n.title || 'Sin título'),
          h('div', { class: 'small muted' }, `${n.session ? `Sesión ${n.session} · ` : ''}${fmtDate(n.created)}`)))));

    const drawEditor = () => {
      const n = state.sel;
      if (!n) return clear(editor, h('div', { class: 'empty' }, 'Elige una entrada o crea una nueva.'));
      const changed = () => { save('notes', n); drawList(); };
      clear(editor, h('div', { class: 'card stack' },
        h('div', { class: 'row' }, bind(n, 'title', { class: 'title-input grow', placeholder: 'Título', onChange: changed }),
          h('label', { class: 'check' }, bind(n, 'pinned', { type: 'checkbox', onChange: changed }), 'Fijar'),
          h('button', { class: 'btn sm danger', type: 'button', onclick: async () => {
            if (!(await confirmDialog('Se eliminará esta entrada del diario.'))) return;
            await api.remove('notes', n.id).catch(toastError);
            state.notes = state.notes.filter((x) => x !== n);
            state.sel = null;
            renderJournal();
          } }, 'Eliminar')),
        h('div', { class: 'row' }, field('Sesión nº', bind(n, 'session', { type: 'number', class: 'inline', onChange: changed })),
          field('Etiquetas', bind(n, 'tags', { placeholder: 'pueblo, villano, pistas…', onChange: changed }), 'grow')),
        bind(n, 'body', { type: 'textarea', rows: 18, placeholder: 'Qué pasó, quién mintió, qué debe el grupo…', onChange: changed, 'aria-label': 'Texto' })));
    };

    clear(body, h('div', { class: 'split' },
      h('aside', { class: 'sidebar card' },
        h('div', { class: 'row between' }, h('h3', {}, 'Diario'),
          h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
            const last = Math.max(0, ...state.notes.map((n) => Number(n.session) || 0));
            try {
              const n = await api.create('notes', { title: `Sesión ${last + 1}`, session: last + 1, body: '', tags: '', pinned: false });
              state.notes.push(n);
              state.sel = n;
              renderJournal();
            } catch (e) { toastError(e); }
          } }, '+ Entrada')),
        h('div', { style: { margin: '8px 0' } }, search), listEl),
      editor));
    drawList();
    drawEditor();
  }

  // -- Misiones --------------------------------------------------------------
  function renderQuests() {
    const columns = QUEST_STATUS.map(([status, label]) => {
      const items = state.quests.filter((q) => q.status === status);
      return h('div', { class: `card quest-col q-${status}` },
        h('div', { class: 'row between' }, h('h3', {}, `${label} (${items.length})`),
          status === 'activa' && h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
            try {
              state.quests.push(await api.create('quests', { title: 'Nueva misión', giver: '', reward: '', status: 'activa', description: '' }));
              renderQuests();
            } catch (e) { toastError(e); }
          } }, '+ Misión')),
        items.map((q) => questCard(q)));
    });
    clear(body, h('div', { class: 'quest-board' }, columns));
  }

  function questCard(q) {
    const changed = () => save('quests', q);
    return h('details', { class: 'quest' },
      h('summary', {}, h('b', {}, q.title), q.giver && h('span', { class: 'small muted' }, ` · ${q.giver}`)),
      h('div', { class: 'stack', style: { marginTop: '8px' } },
        field('Título', bind(q, 'title', { onChange: changed })),
        h('div', { class: 'row' }, field('Quién la encarga', bind(q, 'giver', { onChange: changed }), 'grow'), field('Recompensa', bind(q, 'reward', { onChange: changed }), 'grow')),
        field('Descripción y pistas', bind(q, 'description', { type: 'textarea', rows: 4, onChange: changed })),
        h('div', { class: 'row between' },
          field('Estado', selectEl(QUEST_STATUS, q.status, (v) => { q.status = v; save.flush('quests', q); renderQuests(); })),
          h('button', { class: 'btn sm danger', type: 'button', onclick: async () => {
            if (!(await confirmDialog(`Se eliminará la misión «${q.title}».`))) return;
            await api.remove('quests', q.id).catch(toastError);
            state.quests = state.quests.filter((x) => x !== q);
            renderQuests();
          } }, 'Eliminar'))));
  }

  render();
  return () => savers.forEach((s) => s.pending && s.flush());
}
