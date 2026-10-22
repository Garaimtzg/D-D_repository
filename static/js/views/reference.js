// Reglas: referencia rápida del Manual del Jugador 2024 con buscador. Estados, acciones, clases,
// especies, trasfondos, dotes, armas y armaduras, y las tablas de PX. Cada entrada remite a su página.
import { h, clear, icon, searchBox, segmented, selectEl } from '../core/dom.js';
import { roll } from '../core/dice.js';
import { reference, ABILITY_SHORT, CONDITION_ICON, fmtM } from '../core/dnd.js';

export default { id: 'reglas', title: 'Reglas', icon: 'reglas', hint: 'Manual del Jugador 2024: estados, acciones, clases y tablas', mount };

const ACTION_ICON = {
  Atacar: '⚔️', Ayudar: '🤝', Buscar: '🔎', Correr: '🏃', Destrabarse: '🌀', Esconderse: '🫥', Esquivar: '🛡️',
  Estudiar: '📖', Influir: '🗣️', Magia: '✨', 'Preparar una acción': '⏳', Utilizar: '🧪',
};
const CLASS_ICON = { barbaro: '🪓', bardo: '🪕', brujo: '👁️', clerigo: '☀️', druida: '🌿', explorador: '🏹', guerrero: '⚔️', hechicero: '🔥', mago: '📜', monje: '👊', paladin: '🛡️', picaro: '🗡️' };
const DC = [[5, 'Muy fácil'], [10, 'Fácil'], [15, 'Media'], [20, 'Difícil'], [25, 'Muy difícil'], [30, 'Casi imposible']];
const CASTER = { full: 'Lanzador completo', half: 'Medio lanzador', pact: 'Magia del pacto' };
const SECTIONS = [['todo', 'Todo'], ['estados', 'Estados'], ['combate', 'Combate'], ['personajes', 'Personajes'], ['conjuros', 'Conjuros'], ['equipo', 'Equipo'], ['tablas', 'Tablas']];

async function mount(root) {
  const ref = await reference();
  const state = { q: '', section: 'todo', level: '', cls: '', conc: false, ritual: false };
  const out = h('div', { class: 'ref-layout' });
  const skillName = (k) => ref.skills.find((s) => s.key === k)?.name || k;

  const match = (...txt) => !state.q || txt.flat().join(' ').toLowerCase().includes(state.q);
  const show = (key) => state.section === 'todo' || state.section === key;
  const panel = (title, iconName, cls, ...content) => h('section', { class: `panel ${cls}` }, h('div', { class: 'panel-head' }, h('h3', {}, icon(iconName), title)), ...content);
  const page = (p) => h('span', { class: 'page-ref' }, `MdJ p. ${p}`);

  function draw() {
    const blocks = [];

    // ---------------------------------------------------------------- estados
    const conds = ref.conditions.filter((c) => match(c.name, c.text));
    if (show('estados') && conds.length) {
      blocks.push(panel('Estados', 'aura', 'wide', h('div', { class: 'cond-grid' }, conds.map((c) => h('article', { class: 'cond-card' },
        h('span', { class: 'cond-emoji' }, CONDITION_ICON[c.name] || '•'), h('div', {}, h('b', {}, c.name), h('p', {}, c.text))))),
      h('p', { class: 'tiny muted' }, 'Glosario de reglas del Manual del Jugador 2024 (p. 360 y siguientes). Resúmenes propios: consulta el manual para el texto completo.')));
    }
    const trackers = ref.trackers.filter((c) => match(c.name, c.text));
    if (show('estados') && trackers.length) {
      blocks.push(panel('Marcadores de la mesa', 'target', '', h('div', { class: 'cond-grid one' }, trackers.map((c) => h('article', { class: 'cond-card' },
        h('span', { class: 'cond-emoji' }, CONDITION_ICON[c.name] || '•'), h('div', {}, h('b', {}, c.name), h('p', {}, c.text)))))));
    }

    // ---------------------------------------------------------------- combate
    const acts = ref.actions.filter((a) => match(a.name, a.text));
    if (show('combate') && acts.length) {
      blocks.push(panel('Acciones', 'combate', '', h('ul', { class: 'act-list' }, acts.map((a) => h('li', {},
        h('span', { class: 'act-ic' }, ACTION_ICON[a.name] || '•'), h('div', {}, h('b', {}, a.name), h('p', {}, a.text)))))));
    }
    const rules = ref.rules.filter((r) => match(r.name, r.text));
    if (show('combate') && rules.length) {
      blocks.push(panel('Reglas rápidas', 'reglas', '', h('dl', { class: 'ref' }, rules.map((r) => [h('dt', {}, r.name), h('dd', {}, r.text)]))));
    }
    if (show('combate') && match('clase de dificultad cd', DC.map((d) => d[1]))) {
      blocks.push(panel('Clases de dificultad', 'target', '',
        h('div', { class: 'dc-ladder' }, DC.map(([n, l], i) => h('div', { class: 'dc-step', style: { '--i': i } }, h('b', {}, n), h('span', {}, l))))));
    }
    if (show('combate') && match('cansancio agotamiento')) {
      blocks.push(panel('Cansancio', 'hourglass', '',
        h('ol', { class: 'exh-list' }, [1, 2, 3, 4, 5, 6].map((n) => h('li', { style: { '--i': n - 1 } }, h('b', {}, n),
          h('span', {}, n === 6 ? 'Muerte.' : `−${2 * n} a las pruebas con d20 · velocidad −${fmtM(1.5 * n)}`)))),
        h('p', { class: 'tiny muted' }, 'Cada descanso largo quita un nivel. Los niveles se acumulan.')));
    }
    if (show('combate') && match('cuadrícula casilla movimiento área cono esfera cubo línea emanación cilindro tamaño')) {
      blocks.push(panel('Cuadrícula y áreas', 'ruler', '',
        h('dl', { class: 'ref' },
          h('dt', {}, 'Casilla'), h('dd', {}, '1,5 m. Entrar en una casilla cuesta 1,5 m de movimiento, también en diagonal; el terreno difícil cuesta el doble.'),
          h('dt', {}, 'Tamaño'), h('dd', {}, 'Diminuto ¼ de casilla · Pequeño y Mediano 1 · Grande 2×2 · Enorme 3×3 · Gargantuesco 4×4.'),
          h('dt', {}, 'Cono'), h('dd', {}, 'Se extiende desde ti; su anchura en cada punto es igual a su distancia al origen.'),
          h('dt', {}, 'Esfera y cilindro'), h('dd', {}, 'Radio desde un punto. El cilindro además tiene altura.'),
          h('dt', {}, 'Cubo'), h('dd', {}, 'El origen está en una de sus caras; el tamaño es la longitud del lado.'),
          h('dt', {}, 'Emanación'), h('dd', {}, 'Se extiende desde una criatura u objeto y se mueve con ella.'),
          h('dt', {}, 'Línea'), h('dd', {}, 'Recta desde el origen con la longitud y anchura indicadas.')),
        h('p', { class: 'tiny muted' }, 'El tablero de combate dibuja estas áreas sobre la cuadrícula.')));
    }

    // ------------------------------------------------------------- personajes
    const classes = ref.classes.filter((c) => match(c.name, c.summary, c.subclasses, Object.values(c.features).flat()));
    if (show('personajes') && classes.length) {
      blocks.push(panel('Clases', 'crown', 'wide', h('div', { class: 'class-grid' }, classes.map((c) => h('details', { class: 'class-card' },
        h('summary', {}, h('span', { class: 'class-ic' }, CLASS_ICON[c.id] || '⚜️'),
          h('div', { class: 'grow' }, h('b', {}, c.name), h('div', { class: 'tiny muted' }, `d${c.hit_die} · ${c.primary.map((k) => ABILITY_SHORT[k]).join('/')} · ${c.complexity}`)), page(c.page)),
        h('p', { class: 'small' }, c.summary),
        h('dl', { class: 'ref compact' },
          h('dt', {}, 'Salvaciones'), h('dd', {}, c.saves.map((k) => ABILITY_SHORT[k]).join(', ')),
          h('dt', {}, 'Habilidades'), h('dd', {}, `Elige ${c.skills.choose}: ${c.skills.from.length >= 18 ? 'cualquiera' : c.skills.from.map(skillName).join(', ')}`),
          h('dt', {}, 'Armas'), h('dd', {}, c.weapons), h('dt', {}, 'Armaduras'), h('dd', {}, c.armor || '—'),
          c.tools && [h('dt', {}, 'Herramientas'), h('dd', {}, c.tools)],
          c.caster && [h('dt', {}, 'Magia'), h('dd', {}, `${CASTER[c.caster]} (${ABILITY_SHORT[c.spell_ability]})`)],
          h('dt', {}, 'Subclases'), h('dd', {}, c.subclasses.join(' · '))),
        h('ol', { class: 'feat-levels' }, Object.entries(c.features).map(([l, fs]) => h('li', {}, h('span', { class: 'lvl' }, l), fs.join(', ')))))))));
    }
    const species = ref.species.filter((s) => match(s.name, s.traits));
    if (show('personajes') && species.length) {
      blocks.push(panel('Especies', 'personajes', '', h('div', { class: 'stack-sm' }, species.map((s) => h('details', { class: 'class-card' },
        h('summary', {}, h('div', { class: 'grow' }, h('b', {}, s.name), h('div', { class: 'tiny muted' },
          `${s.size} · ${fmtM(s.speed)}${s.darkvision ? ` · visión en la oscuridad ${s.darkvision} m` : ''}`)), page(s.page)),
        h('dl', { class: 'ref compact' }, s.traits.map(([n, t]) => [h('dt', {}, n), h('dd', {}, t)])),
        s.options && h('p', { class: 'tiny muted' }, `${s.options_label}: ${s.options.map(([n]) => n).join(', ')}`))))));
    }
    const bgs = ref.backgrounds.filter((b) => match(b.name, b.feat, b.skills.map(skillName)));
    if (show('personajes') && bgs.length) {
      blocks.push(panel('Trasfondos', 'scroll', '', h('table', { class: 'ref-table' },
        h('thead', {}, h('tr', {}, ['Trasfondo', 'Características', 'Dote', 'Habilidades'].map((t) => h('th', {}, t)))),
        h('tbody', {}, bgs.map((b) => h('tr', {}, h('td', {}, h('b', {}, b.name), ' ', page(b.page)), h('td', {}, b.abilities.map((k) => ABILITY_SHORT[k]).join(' ')),
          h('td', {}, b.feat), h('td', {}, b.skills.map(skillName).join(', '))))))));
    }
    const feats = ref.feats.filter((f) => match(f.name, f.summary, f.category));
    if (show('personajes') && feats.length) {
      blocks.push(panel('Dotes', 'star', 'wide', h('div', { class: 'feat-cols' }, ['origen', 'general', 'estilo de combate', 'don épico'].map((cat) => {
        const list = feats.filter((f) => f.category === cat);
        return list.length > 0 && h('div', { class: 'feat-col' }, h('div', { class: 'eyebrow' }, cat),
          list.map((f) => h('div', { class: 'feat-ref' }, h('div', { class: 'row between nowrap' }, h('b', {}, f.name), page(f.page)),
            f.prereq && h('div', { class: 'tiny gold' }, f.prereq), h('p', {}, f.summary))));
      }))));
    }

    // ---------------------------------------------------------------- conjuros
    if (state.section === 'conjuros' || (state.section === 'todo' && state.q)) {
      const list = ref.spells.filter((s) => match(s.name, s.school, s.classes, s.damage)
        && (state.level === '' || s.level === Number(state.level)) && (!state.cls || s.classes.includes(state.cls))
        && (!state.conc || s.concentration) && (!state.ritual || s.ritual));
      const lvl = (n) => (n ? `Nivel ${n}` : 'Truco');
      blocks.push(panel(`Conjuros (${list.length})`, 'wand', 'wide',
        state.section === 'conjuros' && h('div', { class: 'row spell-filters' },
          selectEl([['', 'Todos los niveles'], ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, lvl(n)])], state.level, (v) => { state.level = v; draw(); }, { class: 'mini-sel', 'aria-label': 'Nivel' }),
          selectEl([['', 'Todas las clases'], ...ref.classes.filter((c) => c.caster).map((c) => [c.name, c.name])], state.cls, (v) => { state.cls = v; draw(); }, { class: 'mini-sel', 'aria-label': 'Clase' }),
          h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: state.conc, onchange: (e) => { state.conc = e.target.checked; draw(); } }), 'Concentración'),
          h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: state.ritual, onchange: (e) => { state.ritual = e.target.checked; draw(); } }), 'Ritual')),
        h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table spell-table' },
          h('thead', {}, h('tr', {}, ['Conjuro', 'Nivel', 'Tiempo', 'Alcance', 'Duración', 'Efecto', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, list.slice(0, state.section === 'conjuros' ? 400 : 30).map((s) => h('tr', {},
            h('td', {}, h('b', {}, s.name), s.concentration && h('span', { class: 'chip tiny-chip', 'data-tip': 'Concentración' }, 'C'), s.ritual && h('span', { class: 'chip tiny-chip', 'data-tip': 'Ritual' }, 'R'),
              h('div', { class: 'tiny muted' }, `${s.school} · ${s.classes.join(', ')}`)),
            h('td', {}, lvl(s.level)), h('td', {}, s.time), h('td', {}, s.range), h('td', { class: 'small' }, s.duration),
            h('td', { class: 'small' }, [s.save && `Salv. ${ABILITY_SHORT[{ Fuerza: 'fue', Destreza: 'des', 'Constitución': 'con', Inteligencia: 'int', 'Sabiduría': 'sab', Carisma: 'car' }[s.save]]}`,
              s.attack && (s.attack === 'cac' ? 'Ataque c. a c.' : 'Ataque a distancia'), s.cost && `Material ${s.cost}`].filter(Boolean).join(' · '),
              (s.damage || s.heal) && h('button', { class: 'btn xs', type: 'button', onclick: () => roll((s.damage || s.heal).split(' ')[0], { label: `${s.name}: ${s.damage ? 'daño' : 'curación'}` }) },
                '🎲 ', s.damage || `${s.heal} curación`)),
            h('td', {}, page(s.page))))))),
        h('p', { class: 'tiny muted' }, 'Datos de cada conjuro del Manual del Jugador 2024; la descripción completa está en la página indicada.')));
    }

    // ------------------------------------------------------------------ equipo
    const weapons = ref.weapons.filter((w) => match(w.name, w.properties, w.mastery, w.type));
    if (show('equipo') && weapons.length) {
      blocks.push(panel('Armas', 'sword', 'wide', h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table' },
        h('thead', {}, h('tr', {}, ['Arma', 'Daño', 'Propiedades', 'Maestría'].map((t) => h('th', {}, t)))),
        ['sencilla', 'marcial'].map((cat) => {
          const list = weapons.filter((w) => w.category === cat);
          return list.length > 0 && h('tbody', {}, h('tr', { class: 'group' }, h('td', { colspan: 4 }, `Armas ${cat}s · ${cat === 'sencilla' ? 'casi todas las clases saben usarlas' : 'bárbaro, guerrero, paladín y explorador'}`)),
            list.map((w) => h('tr', {}, h('td', {}, h('b', {}, w.name), h('span', { class: 'tiny muted' }, w.kind === 'dist' ? ' · a distancia' : '')),
              h('td', {}, `${w.damage} ${w.type}`), h('td', { class: 'small' }, w.properties.map((p) => ((p === 'Arrojadiza' || p === 'Munición') && w.range ? `${p} (${w.range} m)` : p)).join(', ') || '—'),
              h('td', {}, h('span', { class: 'chip' }, w.mastery)))));
        })))));
    }
    const masteries = ref.masteries.filter((m) => match(m.name, m.text));
    if (show('equipo') && masteries.length) {
      blocks.push(panel('Propiedades de maestría', 'bolt', '', h('dl', { class: 'ref' }, masteries.map((m) => [h('dt', {}, m.name), h('dd', {}, m.text)]))));
    }
    const props = ref.properties.filter((m) => match(m.name, m.text));
    if (show('equipo') && props.length) {
      blocks.push(panel('Propiedades de las armas', 'sword', '', h('dl', { class: 'ref' }, props.map((m) => [h('dt', {}, m.name), h('dd', {}, m.text)]))));
    }
    const armor = ref.armor.filter((a) => match(a.name, a.category, 'armadura'));
    if (show('equipo') && armor.length) {
      blocks.push(panel('Armaduras', 'shield', '', h('table', { class: 'ref-table' },
        h('thead', {}, h('tr', {}, ['Armadura', 'CA', 'Fuerza', 'Sigilo'].map((t) => h('th', {}, t)))),
        ['ligera', 'media', 'pesada'].map((cat) => {
          const list = armor.filter((a) => a.category === cat);
          return list.length > 0 && h('tbody', {}, h('tr', { class: 'group' }, h('td', { colspan: 4 }, `Armadura ${cat} · ${cat === 'ligera' ? '1 minuto para ponerla' : cat === 'media' ? '5 minutos' : '10 minutos'}`)),
            list.map((a) => h('tr', {}, h('td', {}, a.name), h('td', {}, `${a.base}${a.dex_max == null ? ' + DES' : a.dex_max ? ` + DES (máx. ${a.dex_max})` : ''}`),
              h('td', {}, a.str ? `FUE ${a.str}` : '—'), h('td', {}, a.stealth ? 'Desventaja' : '—'))));
        }),
        h('tbody', {}, h('tr', {}, h('td', {}, h('b', {}, 'Escudo')), h('td', {}, '+2'), h('td', {}, '—'), h('td', {}, '—'))))));
    }
    if (show('equipo') && match('monedas cobre plata electro oro platino', ref.coins.map((c) => c.name))) {
      blocks.push(panel('Monedas', 'coins', '', h('div', { class: 'coin-ref' }, ref.coins.map((c) => h('div', { class: 'xpcr-cell' },
        h('b', {}, c.key), h('span', {}, c.name.replace('Pieza de ', '')), h('span', { class: 'tiny muted tnum' }, `${c.value_cp >= 100 ? `${c.value_cp / 100} po` : `${c.value_cp} pc`}`)))),
      h('p', { class: 'tiny muted' }, '1 ppt = 10 po · 1 po = 2 pe = 10 pp · 1 pp = 10 pc.')));
    }

    // ------------------------------------------------------------------ tablas
    const skills = ref.skills.filter((s) => match(s.name, ABILITY_SHORT[s.ability]));
    if (show('tablas') && skills.length) {
      blocks.push(panel('Habilidades', 'personajes', '',
        h('div', { class: 'skill-grid' }, ['fue', 'des', 'int', 'sab', 'car'].map((ab) => {
          const list = skills.filter((s) => s.ability === ab);
          return list.length > 0 && h('div', { class: 'skill-group' }, h('span', { class: 'chip' }, ABILITY_SHORT[ab]), list.map((s) => h('div', {}, s.name)));
        }))));
    }
    if (show('tablas') && match('experiencia nivel px competencia')) {
      const max = ref.level_xp[ref.level_xp.length - 1];
      blocks.push(panel('Experiencia por nivel', 'star', '',
        h('div', { class: 'xp-table' }, ref.level_xp.map((xp, i) => h('div', { class: 'xp-row' },
          h('b', {}, i + 1), h('div', { class: 'xp-track' }, h('i', { style: { width: `${Math.max(1, (xp / max) * 100)}%` } })),
          h('span', { class: 'tnum' }, xp.toLocaleString('es-ES')), h('span', { class: 'chip' }, `+${2 + Math.floor(i / 4)}`))))));
    }
    if (show('tablas') && match('valor de desafío vd px')) {
      blocks.push(panel('PX por valor de desafío', 'skull', '',
        h('div', { class: 'xpcr-grid' }, Object.entries(ref.cr_xp).map(([cr, xp]) => h('div', { class: 'xpcr-cell' }, h('b', {}, cr), h('span', { class: 'tnum' }, xp.toLocaleString('es-ES')))))));
    }
    if (show('tablas') && match('presupuesto encuentro dificultad bajo moderado alto')) {
      blocks.push(panel('Presupuesto de PX por personaje', 'combate', '',
        h('table', { class: 'ref-table compact' }, h('thead', {}, h('tr', {}, ['Nivel', 'Bajo', 'Moderado', 'Alto'].map((t) => h('th', {}, t)))),
          h('tbody', {}, Object.entries(ref.xp_budget).map(([l, b]) => h('tr', {}, h('td', {}, h('b', {}, l)), b.map((x) => h('td', { class: 'tnum' }, x.toLocaleString('es-ES'))))))),
        h('p', { class: 'tiny muted' }, 'Suma el presupuesto de cada personaje y gasta los PX de los monstruos sin multiplicadores (reglas de 2024).')));
    }
    clear(out, blocks.length ? blocks : h('div', { class: 'empty' }, icon('search'), h('h3', {}, 'Nada coincide'), h('p', {}, 'Prueba con otra palabra.')));
  }

  root.append(h('div', { class: 'stack' },
    h('div', { class: 'panel row' },
      h('div', { class: 'grow', style: { maxWidth: '420px' } }, searchBox('Buscar regla, estado, clase, dote, arma…', (v) => { state.q = v.trim().toLowerCase(); draw(); })),
      segmented(SECTIONS, state.section, (v) => { state.section = v; draw(); }),
      h('span', { class: 'chip', style: { marginLeft: 'auto' } }, icon('book', 13), ref.edition)),
    out));
  draw();
}
