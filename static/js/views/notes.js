// Notas: el diario de campaña como un libro de pergamino, la preparación de cada sesión con los ocho
// pasos del «Lazy Dungeon Master» (Sly Flourish) y las misiones como un tablón de anuncios.
import { sfx } from '../core/sfx.js';
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, segmented, searchBox, confirmDialog, toast, toastError, fmtDate } from '../core/dom.js';
import { calendarOf, worldDate } from '../core/calendar.js';
import { linkTargets, mentionBox } from '../core/mentions.js';

export default { id: 'notas', title: 'Notas', icon: 'notas', hint: 'Diario, preparación de sesiones y misiones · tecla 7', mount };

// Los ocho pasos, resumidos: [campo, título, qué poner, tipo]
const PREP_STEPS = [
  ['review', 'Repasa a los personajes', '¿Qué quiere cada uno ahora? ¿Qué cabo suelto de su historia puede salir hoy?', 'text'],
  ['start', 'Un comienzo potente', 'Algo que pasa nada más empezar y mete al grupo en la acción.', 'text'],
  ['scenes', 'Escenas posibles', 'Situaciones que podrían darse. No es un guion: táchalas si salen.', 'list'],
  ['secrets', 'Secretos y pistas', 'Unos diez datos que el grupo puede descubrir de cualquier forma. Los que no salgan pasan a la próxima sesión.', 'list'],
  ['places', 'Lugares fantásticos', 'Sitios con dos o tres detalles que se recuerden.', 'list'],
  ['npcs', 'Personajes importantes', 'Quién aparece, qué quiere y cómo habla. Escribe @ para enlazar su ficha.', 'list'],
  ['monsters', 'Monstruos', 'Qué criaturas encajan con la historia y el lugar.', 'list'],
  ['rewards', 'Recompensas', 'Tesoro, objetos mágicos, favores, información.', 'list'],
];

const QUEST_STATUS = [['activa', 'Activas', 'flame'], ['pendiente', 'Rumores', 'compass'], ['completada', 'Completadas', 'check'], ['fallida', 'Fallidas', 'skull']];

async function mount(root, [tab]) {
  const [notes, quests, sessions, chars, wiki, maps, settings] = await Promise.all(
    ['notes', 'quests', 'sessions', 'characters', 'wiki', 'maps'].map((c) => api.list(c)).concat(api.settings()));
  const state = { tab: ['misiones', 'sesiones'].includes(tab) ? tab : 'diario', notes, quests, sessions, chars, wiki, maps, settings, sel: null, prep: null, search: '' };
  const targets = () => linkTargets(state);
  const cal = calendarOf(settings);
  const gameDay = () => settings.clock?.day || 1;
  // un guardado con retardo por documento, para que editar uno no cancele el de otro
  const savers = new Map();
  const save = (col, doc) => {
    if (!savers.has(doc.id)) savers.set(doc.id, debounced(() => api.update(col, doc).then((d) => { doc.updated = d.updated; }).catch(toastError), 500));
    savers.get(doc.id)();
  };
  save.flush = (col, doc) => { save(col, doc); savers.get(doc.id).flush(); };

  const body = h('div');
  root.append(h('div', { class: 'stack' },
    segmented([['diario', 'Diario de campaña', notes.length], ['sesiones', 'Preparar sesión', sessions.length], ['misiones', 'Misiones', quests.filter((q) => q.status === 'activa').length]], state.tab,
      (v) => { state.tab = v; state.sel = null; history.replaceState(null, '', `#/notas/${v}`); render(); }),
    body));

  const render = () => ({ diario: renderJournal, sesiones: renderSessions, misiones: renderQuests })[state.tab]();

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
          h('div', { class: 'tiny muted' }, n.gameDay ? `${worldDate(cal, n.gameDay, { short: true })} · ` : '', fmtDate(n.created), n.tags ? ` · ${n.tags}` : '')))));

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
      const text = bind(n, 'body', { type: 'textarea', class: 'book-text', placeholder: 'Querido diario: hoy el grupo… (escribe @ para enlazar lugares, fichas o mapas)', onChange: () => { changed(); counter.textContent = `${words()} palabras`; }, 'aria-label': 'Texto de la entrada' });
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
        mentionBox(text, targets),
        h('div', { class: 'row between book-foot' }, counter, h('span', { class: 'tiny muted' }, n.gameDay ? `En el mundo: ${worldDate(cal, n.gameDay, { weekday: true })} · guardado automático` : 'Guardado automático'))));
    };

    clear(body, h('div', { class: 'split journal' },
      h('aside', { class: 'panel sticky' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('book'), 'Entradas'),
          h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
            const last = Math.max(0, ...state.notes.map((x) => Number(x.session) || 0));
            try {
              const n = await api.create('notes', { title: `Sesión ${last + 1}`, session: last + 1, body: '', tags: '', pinned: false, gameDay: gameDay() });
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

  // --------------------------------------------------------- preparar sesión
  function renderSessions() {
    const sorted = [...state.sessions].sort((a, b) => b.number - a.number);
    state.prep ||= sorted[0] || null;
    const s = state.prep;
    const list = h('ul', { class: 'list journal-list' }, sorted.map((x) => h('li', { 'aria-selected': String(x === s), onclick: () => { state.prep = x; renderSessions(); } },
      h('span', { class: 'session-badge' }, x.number),
      h('div', { class: 'grow' }, h('b', {}, x.title || `Sesión ${x.number}`),
        h('div', { class: 'tiny muted' }, `${(x.secrets || []).filter((t) => t.done).length}/${(x.secrets || []).length} secretos descubiertos`, x.gameDay ? ` · ${worldDate(cal, x.gameDay, { short: true })}` : '')))));
    clear(body, h('div', { class: 'split journal' },
      h('aside', { class: 'panel sticky' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('scroll'), 'Sesiones'),
          h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: newSession }, icon('plus', 15), 'Preparar'))),
        h('p', { class: 'tiny muted' }, 'Los ocho pasos del «máster perezoso» de Sly Flourish: lo justo para improvisar con soltura.'),
        list),
      s ? prepPage(s) : h('div', { class: 'book parchment empty-book' }, icon('scroll'), h('h3', {}, 'Prepara la próxima sesión'),
        h('p', {}, 'Ocho pasos cortos: repasar a los personajes, un comienzo potente, escenas, secretos y pistas, lugares, personajes, monstruos y recompensas. Los secretos que no salgan pasan solos a la sesión siguiente.'))));
  }

  async function newSession() {
    const last = [...state.sessions].sort((a, b) => b.number - a.number)[0];
    const players = state.chars.filter((c) => c.type === 'jugador');
    try {
      const s = await api.create('sessions', {
        number: (last?.number || 0) + 1, title: '', gameDay: gameDay(),
        review: players.map((c) => `${c.name}: `).join('\n'), start: '',
        scenes: [], secrets: (last?.secrets || []).filter((t) => !t.done).map((t) => ({ text: t.text, done: false })),
        places: [], npcs: [], monsters: [], rewards: [], recap: '',
      });
      state.sessions.push(s);
      state.prep = s;
      sfx.page();
      if (last?.secrets?.some((t) => !t.done)) toast('Los secretos que no salieron la última vez ya están en la lista.', { iconName: 'scroll' });
      renderSessions();
    } catch (e) { toastError(e); }
  }

  function prepPage(s) {
    const changed = () => save('sessions', s);
    const showOnTable = async (text) => {
      if (!text.trim()) return toast('No hay nada que mostrar todavía.');
      state.settings = await api.saveSettings({ playerMessage: text.replace(/@\[([^\]]+)\]/g, '$1'), playerImage: '' }).catch((e) => { toastError(e); return state.settings; });
      sfx.unroll();
      toast('Se muestra en la mesa.', { kind: 'good', iconName: 'mesa' });
    };
    const listStep = (key, checkLabel) => {
      s[key] ||= [];
      const ul = h('ul', { class: 'prep-list' }, s[key].map((item, i) => h('li', { class: item.done ? 'done' : '' },
        h('input', { type: 'checkbox', checked: !!item.done, 'aria-label': checkLabel, 'data-tip': checkLabel, onchange: (e) => { item.done = e.target.checked; changed(); renderSessions(); } }),
        bind(item, 'text', { class: 'grow', onChange: changed, 'aria-label': 'Texto' }),
        h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': 'Quitar', onclick: () => { s[key].splice(i, 1); changed(); renderSessions(); } }, icon('close', 12)))));
      const add = h('input', { placeholder: '+ Añadir y pulsar Intro', 'aria-label': 'Añadir', onkeydown: (e) => {
        if (e.key !== 'Enter' || !add.value.trim()) return;
        s[key].push({ text: add.value.trim(), done: false });
        changed(); renderSessions();
        body.querySelector(`[data-step="${key}"] input[placeholder^="+"]`)?.focus();
      } });
      return [ul, add];
    };
    const step = ([key, title, help, kind], i) => h('section', { class: 'prep-step', dataset: { step: key } },
      h('div', { class: 'row between nowrap' }, h('h4', {}, h('span', { class: 'prep-n' }, i + 1), title),
        key === 'start' && h('button', { class: 'btn xs', type: 'button', onclick: () => showOnTable(s.start) }, icon('mesa', 13), 'Leer en la mesa')),
      h('p', { class: 'tiny muted' }, help),
      kind === 'text'
        ? mentionBox(bind(s, key, { type: 'textarea', rows: key === 'review' ? Math.max(3, (s.review || '').split('\n').length) : 3, onChange: changed }), targets)
        : listStep(key, key === 'secrets' ? 'Descubierto' : 'Hecho'));
    const npcPick = selectEl([['', '+ Ficha de un personaje…'], ...state.chars.filter((c) => c.type !== 'jugador').map((c) => [c.name, c.name])], '', (v) => {
      if (!v) return;
      s.npcs.push({ text: `@[${v}]: `, done: false });
      changed(); renderSessions();
    }, { class: 'mini-sel', 'aria-label': 'Añadir una ficha' });
    const page = h('article', { class: 'book parchment prep' },
      h('div', { class: 'book-head' },
        h('div', { class: 'row nowrap' }, h('span', { class: 'drop-cap' }, s.number),
          bind(s, 'title', { class: 'book-title grow', placeholder: `Sesión ${s.number}: título`, onChange: () => { changed(); }, 'aria-label': 'Título' })),
        h('div', { class: 'row' },
          s.gameDay && h('span', { class: 'chip' }, '📅 ', worldDate(cal, s.gameDay, { short: true })),
          h('button', { class: 'btn sm danger', type: 'button', style: { marginLeft: 'auto' }, 'aria-label': 'Eliminar', onclick: async () => {
            if (!(await confirmDialog(`Se eliminará la preparación de la sesión ${s.number}.`))) return;
            await api.remove('sessions', s.id).catch(toastError);
            state.sessions = state.sessions.filter((x) => x !== s);
            state.prep = null;
            renderSessions();
          } }, icon('trash', 14)))),
      h('div', { class: 'prep-grid' }, PREP_STEPS.map(step)),
      h('section', { class: 'prep-step recap' },
        h('div', { class: 'row between' }, h('h4', {}, '📜 Después de jugar: qué pasó'),
          h('div', { class: 'row' },
            h('button', { class: 'btn xs', type: 'button', 'data-tip': 'Ideal para empezar la próxima sesión', onclick: () => showOnTable(`Anteriormente… ${s.recap || ''}`) }, icon('mesa', 13), '«Anteriormente…» en la mesa'),
            h('button', { class: 'btn xs', type: 'button', onclick: async () => {
              if (!(s.recap || '').trim()) return toast('Escribe primero el resumen.');
              const n = await api.create('notes', { title: s.title || `Sesión ${s.number}`, session: s.number, body: s.recap, tags: 'resumen', pinned: false, gameDay: s.gameDay || gameDay() }).catch(toastError);
              if (n) { state.notes.push(n); toast('Resumen copiado al diario.', { kind: 'good', iconName: 'book' }); }
            } }, icon('book', 13), 'Pasar al diario'))),
        mentionBox(bind(s, 'recap', { type: 'textarea', rows: 4, placeholder: 'Resumen de la sesión: lo que descubrieron, a quién enfadaron, qué quedó pendiente…', onChange: changed }), targets)));
    page.querySelector('[data-step="npcs"]')?.append(npcPick);
    return page;
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
