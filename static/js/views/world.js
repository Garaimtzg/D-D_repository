// Mundo: el compendio de la campaña (lugares, facciones, objetos, deidades e historia, enlazados entre sí
// con @), el calendario del mundo con lunas, estaciones y festivos, y la cronología de lo que ha pasado.
// Inspirado en World Anvil, Kanka y LegendKeeper (wiki enlazada) y en Fantasy Calendar.
import { sfx } from '../core/sfx.js';
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, segmented, searchBox, modal, confirmDialog, toast, toastError, pickFiles } from '../core/dom.js';
import { calendarOf, dateOf, dayOf, moonOf, worldDate, eventsOn, PRESETS, SEASONS } from '../core/calendar.js';
import { linkTargets, mentionsIn, renderMentions, mentionBox } from '../core/mentions.js';

export default { id: 'mundo', title: 'Mundo', icon: 'globe', hint: 'Compendio enlazado, calendario y cronología de tu mundo', mount };

export const WIKI_TYPES = [['lugar', 'Lugares', '🏰'], ['faccion', 'Facciones', '⚜️'], ['objeto', 'Objetos', '💎'],
  ['deidad', 'Deidades', '✨'], ['historia', 'Historia y leyendas', '📜'], ['otro', 'Otros', '📌']];
const TYPE_ICON = Object.fromEntries(WIKI_TYPES.map(([k, , e]) => [k, e]));
const EVENT_KINDS = [['evento', 'Suceso'], ['festivo', 'Festivo'], ['historia', 'Hecho histórico']];

async function mount(root, [tab, id]) {
  const [wiki, chars, maps, quests, notes, sessions, settings] = await Promise.all(
    ['wiki', 'characters', 'maps', 'quests', 'notes', 'sessions'].map((c) => api.list(c)).concat(api.settings()));
  const state = {
    tab: ['compendio', 'calendario', 'cronologia'].includes(tab) ? tab : 'compendio',
    wiki, chars, maps, quests, notes, sessions, settings, search: '', type: 'todos',
    sel: wiki.find((e) => e.id === id) || null, reading: true, day: null, view: null,
  };
  const savers = new Map();
  const save = (doc) => {
    if (!savers.has(doc.id)) savers.set(doc.id, debounced(() => api.update('wiki', doc).catch(toastError), 500));
    savers.get(doc.id)();
  };
  const targets = () => linkTargets(state);
  const cal = () => calendarOf(state.settings);
  const today = () => state.settings.clock?.day || 1;
  const go = (t, extra = '') => history.replaceState(null, '', `#/mundo/${t}${extra}`);

  const body = h('div');
  root.append(h('div', { class: 'stack' },
    segmented([['compendio', 'Compendio', wiki.length], ['calendario', 'Calendario'], ['cronologia', 'Cronología']], state.tab,
      (v) => { state.tab = v; go(v); render(); }),
    body));
  // los enlaces a otras entradas del compendio se abren aquí mismo, sin recargar la sección
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a.mention.wiki, a.wiki-link');
    if (!a) return;
    e.preventDefault();
    open(state.wiki.find((x) => x.id === a.dataset.id));
  });

  const render = () => ({ compendio: renderWiki, calendario: renderCalendar, cronologia: renderTimeline })[state.tab]();
  function open(entry) {
    if (!entry) return;
    savers.forEach((s) => s.pending && s.flush());
    Object.assign(state, { tab: 'compendio', sel: entry, reading: !!entry.body });
    go('compendio', `/${entry.id}`);
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------------------------------------------------------------- compendio
  function renderWiki() {
    const listEl = h('div', { class: 'wiki-list' });
    const page = h('section', { class: 'wiki-page' });
    const matches = (e) => (state.type === 'todos' || e.type === state.type)
      && (!state.search || `${e.name} ${e.summary} ${e.body}`.toLowerCase().includes(state.search));
    const drawList = () => {
      const shown = state.wiki.filter(matches);
      const ids = new Set(shown.map((e) => e.id));
      const item = (e, depth) => [h('button', { class: `wiki-item ${e === state.sel ? 'on' : ''}`, type: 'button', style: { '--depth': depth }, onclick: () => open(e) },
        h('span', {}, TYPE_ICON[e.type] || '📌'), h('div', { class: 'grow' }, h('b', {}, e.name || 'Sin nombre'), e.summary && h('div', { class: 'tiny muted' }, e.summary))),
      shown.filter((c) => c.parent === e.id).sort(byName).map((c) => item(c, depth + 1))];
      const roots = shown.filter((e) => !e.parent || !ids.has(e.parent)).sort(byName);
      clear(listEl, roots.length ? roots.map((e) => item(e, 0))
        : h('p', { class: 'tiny muted' }, state.wiki.length ? 'Nada coincide.' : 'Aún no hay entradas. Crea la primera: una ciudad, un gremio, una reliquia…'));
    };
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');

    clear(body, h('div', { class: 'split wiki' },
      h('aside', { class: 'panel sticky' },
        h('div', { class: 'panel-head' }, h('h3', {}, icon('globe'), 'Compendio'),
          h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: newEntry }, icon('plus', 15), 'Nueva'))),
        searchBox('Buscar en el compendio…', (v) => { state.search = v.toLowerCase(); drawList(); }, state.search),
        h('div', { class: 'wiki-types' }, [['todos', 'Todo', '🌍'], ...WIKI_TYPES].map(([k, l, e]) => h('button', {
          class: `chip pick ${state.type === k ? 'on' : ''}`, type: 'button', onclick: () => { state.type = k; renderWiki(); },
        }, e, ' ', l, ' ', h('small', {}, k === 'todos' ? state.wiki.length : state.wiki.filter((x) => x.type === k).length)))),
        listEl),
      page));
    drawList();
    drawEntry(page, drawList);
  }

  async function newEntry() {
    try {
      const e = await api.create('wiki', { name: 'Nueva entrada', type: state.type === 'todos' ? 'lugar' : state.type, summary: '', body: '', secret: '', image: '', parent: '' });
      state.wiki.push(e);
      sfx.page();
      Object.assign(state, { sel: e, reading: false });
      go('compendio', `/${e.id}`);
      renderWiki();
      body.querySelector('.wiki-name')?.select();
    } catch (err) { toastError(err); }
  }

  function drawEntry(page, drawList) {
    const e = state.sel;
    if (!e) {
      const counts = WIKI_TYPES.map(([k, l, em]) => [em, l, state.wiki.filter((x) => x.type === k).length]).filter(([, , n]) => n);
      clear(page, h('div', { class: 'book parchment empty-book' }, icon('globe'), h('h3', {}, 'El compendio de tu mundo'),
        h('p', {}, 'Apunta lugares, facciones, objetos, dioses y leyendas. Escribe @ y un nombre para enlazar otra entrada, una ficha, un mapa o una misión; cada entrada muestra quién la menciona.'),
        counts.length > 0 && h('div', { class: 'row center' }, counts.map(([em, l, n]) => h('span', { class: 'chip' }, `${em} ${n} ${l.toLowerCase()}`)))));
      return;
    }
    const changed = () => { save(e); drawList(); };
    const lower = (e.name || '').toLowerCase();
    // quién menciona esta entrada (o a quien enlaza su nombre)
    const backlinks = [
      ...state.wiki.filter((x) => x !== e && mentionsIn(`${x.body} ${x.secret}`).includes(lower)).map((x) => [TYPE_ICON[x.type], x.name, null, x.id]),
      ...state.sessions.filter((s) => mentionsIn(JSON.stringify(s)).includes(lower)).map((s) => ['🗒️', `Sesión ${s.number}: ${s.title || ''}`, '#/notas/sesiones']),
      ...state.notes.filter((n) => mentionsIn(n.body).includes(lower)).map((n) => ['📖', n.title || 'Diario', '#/notas/diario']),
    ];
    const pins = state.maps.flatMap((m) => (m.pins || []).filter((p) => p.link === `wiki:${e.id}`).map((p) => [m, p]));
    const children = state.wiki.filter((x) => x.parent === e.id);
    const parents = state.wiki.filter((x) => x !== e && !isInside(x, e));

    const text = bind(e, 'body', { type: 'textarea', rows: 12, class: 'book-text wiki-body', placeholder: 'Descripción, historia, quién manda aquí… Escribe @ para enlazar.', onChange: changed });
    const secret = bind(e, 'secret', { type: 'textarea', rows: 4, placeholder: 'Lo que los jugadores no saben (todavía)…', onChange: changed });
    const imageBox = e.image
      ? h('figure', { class: 'wiki-image' }, h('img', { src: e.image, alt: '' }),
        h('div', { class: 'row' }, h('button', { class: 'btn xs', type: 'button', onclick: () => setImage(e) }, icon('image', 13), 'Cambiar'),
          h('button', { class: 'btn xs ghost', type: 'button', onclick: async () => { await api.removeUpload(e.image).catch(() => {}); e.image = ''; changed(); drawEntry(page, drawList); } }, icon('trash', 13))))
      : h('button', { class: 'btn sm', type: 'button', onclick: () => setImage(e) }, icon('image', 14), 'Añadir imagen');
    async function setImage(x) {
      const [file] = await pickFiles('image/*');
      if (!file) return;
      try { const up = await api.upload(file); if (x.image) await api.removeUpload(x.image).catch(() => {}); x.image = up.url; changed(); drawEntry(page, drawList); } catch (err) { toastError(err); }
    }

    clear(page, h('article', { class: 'book parchment wiki-entry' },
      h('div', { class: 'book-head' },
        h('div', { class: 'row nowrap' }, h('span', { class: 'drop-cap' }, TYPE_ICON[e.type] || '📌'),
          bind(e, 'name', { class: 'book-title grow wiki-name', placeholder: 'Nombre', onChange: changed, 'aria-label': 'Nombre' })),
        h('div', { class: 'row' },
          field('Tipo', selectEl(WIKI_TYPES.map(([k, l, em]) => [k, `${em} ${l}`]), e.type, (v) => { e.type = v; changed(); drawEntry(page, drawList); })),
          field('Dentro de', selectEl([['', '—'], ...parents.sort((a, b) => a.name.localeCompare(b.name)).map((x) => [x.id, `${TYPE_ICON[x.type]} ${x.name}`])], e.parent || '', (v) => { e.parent = v; changed(); })),
          h('div', { class: 'row', style: { marginLeft: 'auto' } },
            h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Enseña el nombre, el resumen y la imagen en la mesa', onclick: () => showOnTable(e) }, icon('mesa', 14), 'Mostrar en la mesa'),
            h('button', { class: 'btn sm danger', type: 'button', 'aria-label': 'Eliminar', onclick: async () => {
              if (!(await confirmDialog(`Se eliminará «${e.name}» del compendio.`))) return;
              await api.remove('wiki', e.id).catch(toastError);
              if (e.image) await api.removeUpload(e.image).catch(() => {});
              state.wiki = state.wiki.filter((x) => x !== e);
              state.wiki.filter((x) => x.parent === e.id).forEach((x) => { x.parent = ''; save(x); });
              state.sel = null; go('compendio'); renderWiki();
            } }, icon('trash', 14))))),
      h('div', { class: 'wiki-top' }, imageBox,
        h('label', { class: 'field grow' }, 'Resumen', bind(e, 'summary', { placeholder: 'En una línea: qué es y por qué importa', onChange: changed }))),
      h('div', { class: 'row between' }, h('b', { class: 'eyebrow' }, 'Descripción'),
        segmented([[true, 'Leer'], [false, 'Editar']], state.reading, (v) => { state.reading = v; drawEntry(page, drawList); })),
      state.reading
        ? h('div', { class: 'wiki-read', ondblclick: () => { state.reading = false; drawEntry(page, drawList); } },
          e.body ? renderMentions(e.body, targets()) : h('p', { class: 'muted' }, 'Sin descripción. Pulsa «Editar».'))
        : mentionBox(text, targets),
      h('div', { class: 'wiki-secret' }, h('b', { class: 'eyebrow' }, '🔒 Secretos del máster'), mentionBox(secret, targets)),
      (children.length || backlinks.length || pins.length) > 0 && h('div', { class: 'wiki-links' },
        children.length > 0 && h('div', {}, h('b', { class: 'eyebrow' }, 'Contiene'), h('div', { class: 'row' }, children.map((x) => h('a', { class: 'chip wiki-link', href: `#/mundo/compendio/${x.id}`, dataset: { id: x.id } }, TYPE_ICON[x.type], ' ', x.name)))),
        backlinks.length > 0 && h('div', {}, h('b', { class: 'eyebrow' }, 'Mencionado en'), h('div', { class: 'row' }, backlinks.map(([em, name, href, id]) =>
          h('a', { class: `chip ${id ? 'wiki-link' : ''}`, href: href || `#/mundo/compendio/${id}`, dataset: { id: id || '' } }, em, ' ', name)))),
        pins.length > 0 && h('div', {}, h('b', { class: 'eyebrow' }, 'En los mapas'), h('div', { class: 'row' }, pins.map(([m, p]) =>
          h('a', { class: 'chip', href: `#/mapas/${m.id}` }, '📍 ', m.name, p.label && p.label !== e.name ? ` · ${p.label}` : '')))))));
    if (!state.reading) text.focus();
  }
  const isInside = (x, e) => { for (let p = x, i = 0; p && i < 50; p = state.wiki.find((y) => y.id === p.parent), i++) if (p === e) return true; return false; };

  async function showOnTable(e) {
    try {
      state.settings = await api.saveSettings({ playerMessage: `${e.name}${e.summary ? ` — ${e.summary}` : ''}`, playerImage: e.image || '' });
      sfx.unroll();
      toast(`«${e.name}» se muestra en la mesa.`, { kind: 'good', iconName: 'mesa' });
    } catch (err) { toastError(err); }
  }

  // --------------------------------------------------------------- calendario
  async function saveCalendar(patch) {
    const c = { ...cal(), ...patch };
    state.settings = await api.saveSettings({ calendar: c }).catch((err) => { toastError(err); return state.settings; });
  }

  function renderCalendar() {
    const c = cal();
    const now = dateOf(c, today());
    state.view ||= { year: now.year, month: now.month };
    const { year, month } = state.view;
    const first = dayOf(c, year, month, 1);
    const lead = dateOf(c, first).weekdayIndex;
    const days = c.months[month][1];
    const sel = state.day ?? (year === now.year && month === now.month ? now.day : 1);
    const sessionsOn = (d) => [...state.notes.filter((n) => n.gameDay === d).map((n) => ['📖', n.title]), ...state.sessions.filter((s) => s.gameDay === d).map((s) => ['🗒️', `Sesión ${s.number}`])];
    const shift = (n) => {
      let m = month + n; let y = year;
      if (m < 0) { m = c.months.length - 1; y -= 1; } else if (m >= c.months.length) { m = 0; y += 1; }
      state.view = { year: y, month: m }; state.day = null; renderCalendar();
    };
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'cal-cell blank' }));
    for (let d = 1; d <= days; d++) {
      const abs = first + d - 1;
      const moon = moonOf(c, abs);
      const prev = moonOf(c, abs - 1);
      const quarter = Math.round(moon.phase * 8) % 2 === 0 && Math.round(moon.phase * 8) % 8 !== Math.round(prev.phase * 8) % 8;
      cells.push(h('button', { class: `cal-cell ${abs === today() ? 'today' : ''} ${d === sel ? 'sel' : ''}`, type: 'button', onclick: () => { state.day = d; renderCalendar(); } },
        h('span', { class: 'cal-num' }, d), quarter && h('span', { class: 'cal-moon', 'data-tip': moon.name }, moon.emoji),
        h('div', { class: 'cal-evs' }, eventsOn(c, year, month, d).map((ev) => h('span', { class: `cal-ev ${ev.kind}` }, ev.title)),
          sessionsOn(abs).map(([em, t]) => h('span', { class: 'cal-ev sesion' }, em, ' ', t)))));
    }
    const selAbs = first + sel - 1;
    const selDate = dateOf(c, selAbs);
    const selMoon = moonOf(c, selAbs);
    const evs = eventsOn(c, year, month, sel);
    const form = { title: '', kind: 'evento', yearly: false, note: '' };
    clear(body, h('div', { class: 'split calendar' },
      h('section', { class: 'panel cal-panel' },
        h('div', { class: 'row between cal-head' },
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mes anterior', onclick: () => shift(-1) }, icon('prev', 16)),
          h('div', { class: 'center' }, h('h2', { style: { margin: 0 } }, c.months[month][0]), h('div', { class: 'small muted' }, `Año ${year} · ${SEASONS[dateOf(c, first).season].join(' ')}`)),
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => shift(1) }, icon('next', 16))),
        h('div', { class: 'cal-grid' }, c.weekdays.map((w) => h('div', { class: 'cal-wd' }, w.slice(0, 3))), cells),
        h('div', { class: 'row between' },
          h('span', { class: 'small' }, h('b', {}, 'Hoy: '), `${worldDate(c, today(), { weekday: true })} · ${moonOf(c, today()).emoji} ${moonOf(c, today()).name}`),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm', type: 'button', onclick: () => { state.view = null; state.day = null; renderCalendar(); } }, icon('target', 14), 'Ir a hoy'),
            h('button', { class: 'btn sm', type: 'button', onclick: configure }, icon('edit', 14), 'Configurar')))),
      h('aside', { class: 'panel sticky cal-day' },
        h('h3', {}, `${selDate.weekday}, ${sel} de ${c.months[month][0]}`),
        h('div', { class: 'small muted' }, `Año ${year} · ${SEASONS[selDate.season][1]} ${SEASONS[selDate.season][0]} · ${selMoon.emoji} ${selMoon.name}`),
        selAbs !== today() && h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Mueve el reloj del mundo a este día (la hora no cambia)', onclick: async () => {
          const clock = { day: selAbs, minutes: state.settings.clock?.minutes ?? 480 };
          if (selAbs < 1) return toast('Ese día es anterior al comienzo de la campaña.');
          state.settings = await api.saveSettings({ clock }).catch((err) => { toastError(err); return state.settings; });
          sfx.page(); renderCalendar();
        } }, icon('clock', 14), 'Hacer que hoy sea este día'),
        h('ul', { class: 'cal-day-list' }, evs.map((ev) => h('li', {}, h('span', { class: `cal-ev ${ev.kind}` }, ev.title), ev.yearly && h('span', { class: 'tiny muted' }, ' (cada año)'),
          ev.note && h('div', { class: 'tiny muted' }, ev.note),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${ev.title}`, onclick: async () => { await saveCalendar({ events: c.events.filter((x) => x !== ev) }); renderCalendar(); } }, icon('close', 12)))),
        sessionsOn(selAbs).map(([em, t]) => h('li', { class: 'small' }, em, ' ', t))),
        h('div', { class: 'eyebrow' }, 'Añadir a este día'),
        bind(form, 'title', { placeholder: 'Feria, eclipse, boda del conde…', 'aria-label': 'Título' }),
        h('div', { class: 'row' }, selectEl(EVENT_KINDS, form.kind, (v) => { form.kind = v; }, { class: 'mini-sel', 'aria-label': 'Tipo' }),
          h('label', { class: 'check small' }, bind(form, 'yearly', { type: 'checkbox' }), 'Cada año')),
        bind(form, 'note', { placeholder: 'Nota (opcional)', 'aria-label': 'Nota' }),
        h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
          if (!form.title.trim()) return toast('Ponle un título.');
          await saveCalendar({ events: [...c.events, { id: Math.random().toString(36).slice(2, 9), title: form.title.trim(), kind: form.kind, yearly: form.yearly, year, month, day: sel, note: form.note.trim() }] });
          sfx.pin(); renderCalendar();
        } }, icon('plus', 14), 'Añadir'))));
  }

  async function configure() {
    const c = cal();
    const st = { preset: c.preset, year: c.year, startMonth: dateOf(c, 1).month + 1, startDay: dateOf(c, 1).day, moon: c.moon,
      months: c.months.map(([n, d]) => `${n}: ${d}`).join('\n'), weekdays: c.weekdays.join(', ') };
    const monthsArea = bind(st, 'months', { type: 'textarea', rows: 8 });
    const weekIn = bind(st, 'weekdays');
    const ok = await modal('Calendario del mundo', h('div', { class: 'stack' },
      field('Plantilla', selectEl(Object.entries(PRESETS).map(([k, p]) => [k, p.name]), st.preset, (v) => {
        st.preset = v;
        monthsArea.value = st.months = PRESETS[v].months.map(([n, d]) => `${n}: ${d}`).join('\n');
        weekIn.value = st.weekdays = PRESETS[v].weekdays.join(', ');
      })),
      h('div', { class: 'row' }, field('Año en que empieza la campaña', bind(st, 'year', { type: 'number' })),
        field('Ciclo de la luna (días)', bind(st, 'moon', { type: 'number', step: 0.5, min: 1 }))),
      h('div', { class: 'row' }, field('Primer día: mes (1-12…)', bind(st, 'startMonth', { type: 'number', min: 1 })), field('y día', bind(st, 'startDay', { type: 'number', min: 1 }))),
      field('Meses (uno por línea: «Nombre: días»)', monthsArea),
      field('Días de la semana (separados por comas)', weekIn),
      h('p', { class: 'tiny muted' }, 'Al cambiar de plantilla se ponen sus meses, su semana y sus festivos. Los sucesos que ya hayas añadido se conservan.')),
    [{ label: 'Cancelar', value: false }, { label: 'Guardar', value: true, class: 'primary', icon: 'check' }], { iconName: 'clock' });
    if (!ok) return;
    const months = String(st.months).split('\n').map((l) => l.split(':')).filter(([n]) => n.trim()).map(([n, d]) => [n.trim(), Math.max(1, Number(d) || 30)]);
    if (!months.length) return toast('Hace falta al menos un mes.');
    const startMonth = Math.min(months.length, Math.max(1, Number(st.startMonth) || 1)) - 1;
    const start = months.slice(0, startMonth).reduce((s, [, d]) => s + d, 0) + Math.min(months[startMonth][1], Math.max(1, Number(st.startDay) || 1)) - 1;
    const presetChanged = st.preset !== c.preset;
    const festivals = presetChanged ? PRESETS[st.preset].festivals.map(([m, d, title], i) => ({ id: `f${i}`, title, month: m, day: d, yearly: true, kind: 'festivo' })) : [];
    await saveCalendar({
      preset: st.preset, months, weekdays: String(st.weekdays).split(',').map((w) => w.trim()).filter(Boolean),
      year: Number(st.year) || 1, start, moon: Math.max(1, Number(st.moon) || 29.5),
      events: presetChanged ? [...c.events.filter((ev) => ev.kind !== 'festivo'), ...festivals] : c.events,
    });
    state.view = null;
    renderCalendar();
  }

  // --------------------------------------------------------------- cronología
  function renderTimeline() {
    const c = cal();
    const items = [
      ...c.events.filter((ev) => !ev.yearly).map((ev) => ({ abs: dayOf(c, ev.year, ev.month, ev.day), em: ev.kind === 'historia' ? '📜' : '⭐', title: ev.title, note: ev.note, ev })),
      ...state.notes.filter((n) => n.gameDay).map((n) => ({ abs: n.gameDay, em: '📖', title: n.title || 'Diario', note: (n.body || '').slice(0, 140), href: '#/notas/diario' })),
      ...state.sessions.filter((s) => s.gameDay).map((s) => ({ abs: s.gameDay, em: '🗒️', title: `Sesión ${s.number}${s.title ? `: ${s.title}` : ''}`, note: s.recap?.slice(0, 140), href: '#/notas/sesiones' })),
      { abs: today(), em: '⏳', title: 'Hoy', today: true },
    ].sort((a, b) => a.abs - b.abs);
    let lastYear = null;
    const rows = items.flatMap((it) => {
      const { year } = dateOf(c, it.abs);
      const out = [];
      if (year !== lastYear) { out.push(h('li', { class: 'tl-year' }, `Año ${year}`)); lastYear = year; }
      const date = it.ev ? `${it.ev.day} de ${c.months[it.ev.month][0]}` : worldDate(c, it.abs, { short: true });
      out.push(h('li', { class: `tl-item ${it.today ? 'today' : ''}` }, h('span', { class: 'tl-dot' }, it.em),
        h('div', { class: 'grow' }, h('div', { class: 'tiny muted' }, date),
          it.href ? h('a', { href: it.href }, h('b', {}, it.title)) : h('b', {}, it.title), it.note && h('div', { class: 'small' }, it.note)),
        it.ev && h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${it.title}`, onclick: async () => { await saveCalendar({ events: c.events.filter((x) => x !== it.ev) }); renderTimeline(); } }, icon('close', 12))));
      return out;
    });
    clear(body, h('section', { class: 'panel timeline' },
      h('div', { class: 'panel-head' }, h('h3', {}, icon('hourglass'), 'Cronología'),
        h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: addHistory }, icon('plus', 15), 'Hecho histórico'))),
      h('p', { class: 'tiny muted' }, 'Los hechos históricos, los sucesos con fecha del calendario y las sesiones del diario, en orden. Las entradas del diario y las sesiones toman el día del reloj del mundo al crearse.'),
      h('ol', { class: 'tl' }, rows)));
  }

  async function addHistory() {
    const c = cal();
    const st = { title: '', year: c.year - 100, month: 1, day: 1, note: '' };
    const ok = await modal('Hecho histórico', h('div', { class: 'stack' },
      field('Qué pasó', bind(st, 'title', { placeholder: 'Fundación de la ciudad, caída del imperio…' })),
      h('div', { class: 'row' }, field('Año', bind(st, 'year', { type: 'number' })),
        field('Mes', selectEl(c.months.map(([n], i) => [i + 1, n]), 1, (v) => { st.month = Number(v); })),
        field('Día', bind(st, 'day', { type: 'number', min: 1 }))),
      field('Nota', bind(st, 'note', { type: 'textarea', rows: 3 }))),
    [{ label: 'Cancelar', value: false }, { label: 'Añadir', value: true, class: 'primary', icon: 'plus' }], { iconName: 'hourglass' });
    if (!ok || !st.title.trim()) return;
    await saveCalendar({ events: [...c.events, { id: Math.random().toString(36).slice(2, 9), title: st.title.trim(), kind: 'historia', yearly: false,
      year: Number(st.year) || c.year, month: Number(st.month) - 1, day: Math.max(1, Number(st.day) || 1), note: st.note.trim() }] });
    renderTimeline();
  }

  render();
  return () => savers.forEach((s) => s.pending && s.flush());
}
