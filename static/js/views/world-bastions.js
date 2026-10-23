// Bastiones de las reglas de 2024: la base de cada personaje jugador desde el nivel 5, con sus instalaciones
// especiales, órdenes, defensores y un turno de bastión cada 7 días con la tabla de sucesos.
// Resumen propio y orientativo: los detalles están en la Guía del DM 2024, capítulo 8.
import { api, debounced } from '../core/api.js';
import { h, clear, icon, bind, field, selectEl, confirmDialog, toast, toastError } from '../core/dom.js';
import { sfx } from '../core/sfx.js';

const ORDERS = { fabricar: 'Fabricar', potenciar: 'Potenciar', cosechar: 'Cosechar', reclutar: 'Reclutar', investigar: 'Investigar', comerciar: 'Comerciar' };
// [clave, nombre, nivel, orden, qué hace]
export const FACILITIES = [
  ['estudio', 'Estudio arcano', 5, 'fabricar', 'Fabrica focos arcanos y libros; más adelante, objetos mágicos arcanos. Pide saber usar un foco arcano.'],
  ['armeria', 'Armería', 5, 'comerciar', 'Abastécela de armas y armaduras para que los defensores resistan mejor los ataques.'],
  ['barracon', 'Barracón', 5, 'reclutar', 'Recluta defensores del bastión sin coste.'],
  ['jardin', 'Jardín', 5, 'cosechar', 'Da comida, hierbas, flores o venenos según el tipo de jardín.'],
  ['biblioteca', 'Biblioteca', 5, 'investigar', 'Investiga un tema y consigue información fiable sobre él.'],
  ['santuario', 'Santuario', 5, 'fabricar', 'Fabrica símbolos sagrados y focos druídicos. Pide saber usar uno.'],
  ['herreria', 'Herrería', 5, 'fabricar', 'Fabrica armas y armaduras; más adelante, armamento mágico.'],
  ['almacen', 'Almacén', 5, 'comerciar', 'Compra mercancías y véndelas después con beneficio.'],
  ['taller', 'Taller', 5, 'fabricar', 'Fabrica objetos con herramientas de artesano.'],
  ['salon-juego', 'Salón de juego', 9, 'comerciar', 'Juegos de azar que dejan ganancias al bastión.'],
  ['invernadero', 'Invernadero', 9, 'cosechar', 'Cultiva plantas raras para pociones curativas o venenos.'],
  ['laboratorio', 'Laboratorio', 9, 'fabricar', 'Elabora venenos, antídotos y otros preparados alquímicos.'],
  ['sacristia', 'Sacristía', 9, 'fabricar', 'Prepara agua bendita y objetos mágicos sagrados.'],
  ['scriptorium', 'Scriptorium', 9, 'fabricar', 'Copia libros, documentos y pergaminos de conjuro.'],
  ['establo', 'Establo', 9, 'comerciar', 'Cría monturas y las vende con beneficio.'],
  ['circulo', 'Círculo de teletransporte', 9, 'reclutar', 'Invita a un lanzador de conjuros que puede ayudarte.'],
  ['teatro', 'Teatro', 9, 'potenciar', 'Monta una obra; quien participa sale inspirado.'],
  ['entrenamiento', 'Zona de entrenamiento', 9, 'potenciar', 'Un instructor experto da beneficios a quien entrena allí.'],
  ['trofeos', 'Sala de trofeos', 9, 'investigar', 'Estudia los trofeos en busca de pistas y objetos útiles.'],
  ['archivo', 'Archivo', 13, 'investigar', 'Documentos únicos para responder preguntas difíciles.'],
  ['meditacion', 'Cámara de meditación', 13, 'potenciar', 'Meditar allí da ventaja en ciertas tiradas de salvación.'],
  ['fieras', 'Casa de fieras', 13, 'reclutar', 'Bestias que sirven como defensores.'],
  ['observatorio', 'Observatorio', 13, 'potenciar', 'Estudia las estrellas en busca de augurios y favores.'],
  ['taberna', 'Taberna', 13, 'investigar', 'Los parroquianos traen rumores y espían para ti.'],
  ['relicario', 'Relicario', 13, 'cosechar', 'Guarda una reliquia sagrada que puede dar una bendición.'],
  ['semiplano', 'Semiplano', 17, 'potenciar', 'Un espacio extradimensional con protección arcana.'],
  ['sede', 'Sede gremial', 17, 'reclutar', 'Un gremio a tus órdenes que cumple encargos.'],
  ['sanctasanctorum', 'Sanctasanctórum', 17, 'potenciar', 'Un lugar santo que protege y cura.'],
  ['guerra', 'Sala de guerra', 17, 'reclutar', 'Recluta tenientes y soldados para un pequeño ejército.'],
];
const FAC = Object.fromEntries(FACILITIES.map(([k, name, level, order, text]) => [k, { name, level, order, text }]));
const BASICS = ['Dormitorio', 'Comedor', 'Salón', 'Patio', 'Cocina', 'Almacenaje'];
const SIZES = ['Reducida', 'Amplia', 'Vasta'];
// instalaciones especiales según el nivel del personaje
export const specialSlots = (level) => (level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 2 : 0);

const d = (n) => 1 + Math.floor(Math.random() * n);
const roll = (count, faces) => Array.from({ length: count }, () => d(faces));
// Tabla de sucesos del bastión (d100). Cada suceso devuelve el texto y, si toca, cambios en el bastión.
const EVENTS = [
  [50, '🌤️ Todo va bien', () => ({ text: 'Nada fuera de lo normal: el bastión funciona sin problemas.' })],
  [55, '⚔️ Ataque', (b) => {
    const dice = roll(Math.max(1, 6 - (b.walls ? 2 : 0)), b.armory ? 8 : 6);
    const dead = Math.min(b.defenders || 0, dice.filter((x) => x === 1).length);
    return { text: `Unos enemigos atacan el bastión. Dados: ${dice.join(', ')} → ${dead} defensores caen.${!b.defenders ? ' Sin defensores, una instalación especial queda cerrada el próximo turno.' : ''}`, defenders: (b.defenders || 0) - dead };
  }],
  [58, '🕵️ Asalariado criminal', () => ({ text: `Uno de los asalariados resulta ser un delincuente. Puedes pagar ${d(6) * 100} po de soborno a las autoridades o perderlo.` })],
  [63, '✨ Oportunidad extraordinaria', () => ({ text: 'Se presenta una ocasión única (el máster decide cuál). Aprovecharla suele costar oro.' })],
  [72, '🙂 Visitantes amistosos', () => ({ text: `Llegan visitantes de paso que dejan ${d(6) * 100} po por usar una instalación.` })],
  [76, '🧳 Invitado', () => ({ text: 'Un invitado (un aliado, un mercenario, una criatura amistosa…) se queda una temporada y puede ayudar.' })],
  [79, '🏚️ Asalariados perdidos', () => ({ text: 'Los asalariados de una instalación especial se marchan: no podrá recibir órdenes el próximo turno.' })],
  [83, '🔮 Descubrimiento mágico', () => ({ text: 'Los asalariados encuentran o crean un objeto mágico poco común (una poción o un pergamino).' })],
  [91, '🏕️ Refugiados', () => ({ text: `${d(4) + d(4)} refugiados piden cobijo. Si los acoges, te pagan ${d(6) * 100} po.` })],
  [98, '🆘 Petición de ayuda', () => ({ text: 'Los vecinos piden ayuda. Puedes enviar defensores: si salen bien parados, hay recompensa.' })],
  [100, '💰 Tesoro', () => ({ text: 'El bastión recibe un tesoro: un objeto de arte o una joya de valor (tira en la tabla de tesoros).' })],
];

export function renderBastions(body, state) {
  const players = state.chars.filter((c) => c.type === 'jugador');
  const savers = new Map();
  const save = (b) => {
    if (!savers.has(b.id)) savers.set(b.id, debounced(() => api.update('bastions', b).catch(toastError), 400));
    savers.get(b.id)();
  };
  const redraw = () => renderBastions(body, state);

  async function add() {
    const owner = players.find((c) => (c.level || 1) >= 5 && !state.bastions.some((b) => b.owner === c.id)) || players[0];
    try {
      state.bastions.push(await api.create('bastions', {
        name: owner ? `Bastión de ${owner.name}` : 'Bastión', owner: owner?.id || '', facilities: [],
        basics: [{ kind: 'Dormitorio', size: 'Reducida' }, { kind: 'Almacenaje', size: 'Amplia' }],
        defenders: 0, gold: 0, walls: false, armory: false, lastTurn: null, log: [],
      }));
      sfx.pin();
      redraw();
    } catch (e) { toastError(e); }
  }

  clear(body, h('div', { class: 'stack' },
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', {}, '🏰 Bastiones'),
        h('div', { class: 'actions' }, h('button', { class: 'btn sm primary', type: 'button', onclick: add }, icon('plus', 15), 'Nuevo bastión'))),
      h('p', { class: 'tiny muted' }, 'Desde el nivel 5 cada personaje jugador puede tener un bastión: 2 instalaciones especiales a nivel 5, 4 a nivel 9, 5 a nivel 13 y 6 a nivel 17. ',
        'Cada 7 días de juego hay un turno de bastión: da una orden a cada instalación o deja todas en «Mantener» para tirar en la tabla de sucesos. ',
        h('b', {}, 'Resumen orientativo: comprueba los detalles en la Guía del DM 2024, capítulo 8.'))),
    !state.bastions.length && h('div', { class: 'empty' }, h('h3', {}, 'Ningún bastión todavía'), h('p', {}, 'Crea uno para el primer personaje que llegue a nivel 5.')),
    state.bastions.map((b) => card(b))));

  function card(b) {
    const owner = state.chars.find((c) => c.id === b.owner);
    const level = owner?.level || 1;
    const slots = specialSlots(level);
    const today = state.settings.clock?.day || 1;
    const since = b.lastTurn == null ? null : today - b.lastTurn;
    const changed = () => save(b);
    const used = new Set(b.facilities.map((f) => f.key));
    const options = FACILITIES.filter(([k, , lvl]) => lvl <= level && !used.has(k));

    async function turn() {
      const lines = b.facilities.filter((f) => f.order && f.order !== 'mantener').map((f) => `${FAC[f.key].name}: ${ORDERS[f.order]}${f.note ? ` (${f.note})` : ''}`);
      if (!lines.length) { // todo en «Mantener»: suceso del bastión
        const n = d(100);
        const [, title, fn] = EVENTS.find(([max]) => n <= max);
        const ev = fn(b);
        if (ev.defenders != null) b.defenders = ev.defenders;
        lines.push(`d100 = ${n} · ${title}: ${ev.text}`);
      }
      b.log = [{ day: today, text: lines.join('\n') }, ...(b.log || [])].slice(0, 40);
      b.lastTurn = today;
      b.facilities.forEach((f) => { f.order = 'mantener'; f.note = ''; });
      changed();
      sfx.unroll?.();
      toast(`Turno de «${b.name}» resuelto.`, { kind: 'good' });
      redraw();
    }

    return h('section', { class: 'panel bastion' },
      h('div', { class: 'row wrap' },
        h('label', { class: 'field grow' }, 'Nombre', bind(b, 'name', { onChange: changed })),
        field('Dueño', selectEl([['', '—'], ...players.map((c) => [c.id, `${c.name} (nv. ${c.level || 1})`])], b.owner, (v) => { b.owner = v; changed(); redraw(); })),
        field('Defensores', bind(b, 'defenders', { type: 'number', min: 0, onChange: changed })),
        field('Oro (po)', bind(b, 'gold', { type: 'number', min: 0, onChange: changed })),
        h('div', { class: 'stack-sm' },
          h('label', { class: 'check small' }, bind(b, 'walls', { type: 'checkbox', onChange: changed }), 'Murallas defensivas'),
          h('label', { class: 'check small' }, bind(b, 'armory', { type: 'checkbox', onChange: changed }), 'Armería abastecida')),
        h('button', { class: 'btn sm danger', type: 'button', 'aria-label': 'Eliminar bastión', onclick: async () => {
          if (!(await confirmDialog(`Se eliminará «${b.name}».`))) return;
          await api.remove('bastions', b.id).catch(toastError);
          state.bastions = state.bastions.filter((x) => x !== b);
          redraw();
        } }, icon('trash', 14))),
      level < 5 && h('p', { class: 'small warn' }, `${owner ? owner.name : 'El dueño'} aún no tiene nivel 5: el bastión no puede tener instalaciones especiales.`),
      h('div', { class: 'row between' },
        h('b', { class: 'eyebrow' }, `Instalaciones especiales ${b.facilities.length}/${slots}`),
        b.facilities.length < slots && options.length > 0 && selectEl([['', '+ Añadir instalación…'], ...[5, 9, 13, 17].filter((l) => l <= level).flatMap((l) =>
          options.filter(([, , lvl]) => lvl === l).map(([k, name]) => [k, `${name} (nv. ${l})`]))], '',
        (v) => { if (!v) return; b.facilities.push({ key: v, order: 'mantener', note: '' }); changed(); redraw(); }, { class: 'mini-sel', 'aria-label': 'Añadir instalación' })),
      b.facilities.length > slots && h('p', { class: 'small warn' }, `Hay más instalaciones de las que permite el nivel ${level}.`),
      h('ul', { class: 'bastion-fac' }, b.facilities.map((f) => {
        const info = FAC[f.key];
        return h('li', {},
          h('div', { class: 'grow' }, h('b', {}, info.name), h('div', { class: 'tiny muted' }, info.text)),
          selectEl([['mantener', 'Mantener'], [info.order, ORDERS[info.order]]], f.order, (v) => { f.order = v; changed(); }, { class: 'mini-sel', 'aria-label': `Orden para ${info.name}` }),
          bind(f, 'note', { placeholder: 'Qué exactamente…', class: 'bastion-note', 'aria-label': 'Detalle de la orden', onChange: changed }),
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${info.name}`, onclick: () => { b.facilities = b.facilities.filter((x) => x !== f); changed(); redraw(); } }, icon('close', 12)));
      })),
      h('div', { class: 'row wrap' }, h('b', { class: 'eyebrow' }, 'Básicas'),
        (b.basics || []).map((x) => h('span', { class: 'chip' }, `${x.kind} · ${x.size}`,
          h('button', { class: 'btn icon xs ghost', type: 'button', 'aria-label': `Quitar ${x.kind}`, onclick: () => { b.basics = b.basics.filter((y) => y !== x); changed(); redraw(); } }, icon('close', 10)))),
        selectEl([['', '+ Básica…'], ...BASICS.flatMap((k) => SIZES.map((s) => [`${k}|${s}`, `${k} (${s.toLowerCase()})`]))], '',
          (v) => { if (!v) return; const [kind, size] = v.split('|'); (b.basics ||= []).push({ kind, size }); changed(); redraw(); }, { class: 'mini-sel', 'aria-label': 'Añadir instalación básica' })),
      h('div', { class: 'row between' },
        h('span', { class: 'small muted' }, since == null ? 'Aún no ha habido ningún turno.' : since >= 7 ? `Último turno hace ${since} días: toca otro.` : `Último turno hace ${since} días (el siguiente, dentro de ${7 - since}).`),
        h('button', { class: `btn sm ${since == null || since >= 7 ? 'primary' : ''}`, type: 'button', onclick: turn }, '🎲 Turno del bastión')),
      (b.log || []).length > 0 && h('details', { class: 'bastion-log', open: true }, h('summary', {}, 'Registro'),
        h('ul', {}, b.log.map((l) => h('li', {}, h('span', { class: 'tiny muted' }, `Día ${l.day}`), h('div', { class: 'small pre' }, l.text))))));
  }
}
