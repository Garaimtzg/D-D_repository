// Calendario del mundo: convierte el día de campaña del reloj (1, 2, 3…) en una fecha con año, mes,
// día de la semana, estación y fase lunar. settings.calendar guarda los meses, la semana, el año y el
// día en que empieza la campaña, el ciclo lunar y los acontecimientos (festivos que se repiten cada año
// y sucesos con fecha). Si no hay nada guardado se usa el calendario de Euskal Herria.
export const PRESETS = {
  euskal: {
    name: 'Euskal Herria',
    months: [['Urtarrila', 31], ['Otsaila', 28], ['Martxoa', 31], ['Apirila', 30], ['Maiatza', 31], ['Ekaina', 30],
      ['Uztaila', 31], ['Abuztua', 31], ['Iraila', 30], ['Urria', 31], ['Azaroa', 30], ['Abendua', 31]],
    weekdays: ['Astelehena', 'Asteartea', 'Asteazkena', 'Osteguna', 'Ostirala', 'Larunbata', 'Igandea'],
    short: ['Al', 'Ar', 'Az', 'Og', 'Or', 'Lr', 'Ig'],
    festivals: [[0, 20, 'Danborrada'], [5, 23, 'Sanjuan gaua (hogueras)'], [6, 31, 'San Ignazio'], [11, 21, 'Santo Tomas azoka'], [11, 24, 'Olentzero']],
  },
  gregoriano: {
    name: 'Gregoriano',
    months: [['Enero', 31], ['Febrero', 28], ['Marzo', 31], ['Abril', 30], ['Mayo', 31], ['Junio', 30],
      ['Julio', 31], ['Agosto', 31], ['Septiembre', 30], ['Octubre', 31], ['Noviembre', 30], ['Diciembre', 31]],
    weekdays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    short: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    festivals: [[0, 1, 'Año nuevo'], [5, 23, 'Noche de San Juan'], [9, 31, 'Noche de difuntos']],
  },
  fantasia: {
    name: 'Fantasía (12 meses de 30 días)',
    months: ['Escarcha', 'Deshielo', 'Brotes', 'Lluvias', 'Flores', 'Siega', 'Sol alto', 'Cosecha', 'Vendimia', 'Hojarasca', 'Nieblas', 'Lobos'].map((n) => [n, 30]),
    weekdays: ['Lunadía', 'Fuegodía', 'Aguadía', 'Árboldía', 'Orodía', 'Tierradía', 'Soldía'],
    festivals: [[3, 1, 'Fiesta de las lluvias'], [6, 15, 'Pleno verano'], [11, 30, 'Noche más larga']],
  },
};
export const SEASONS = [['Invierno', '❄️'], ['Primavera', '🌱'], ['Verano', '☀️'], ['Otoño', '🍂']];
const MOONS = [['Luna nueva', '🌑'], ['Luna creciente', '🌒'], ['Cuarto creciente', '🌓'], ['Gibosa creciente', '🌔'],
  ['Luna llena', '🌕'], ['Gibosa menguante', '🌖'], ['Cuarto menguante', '🌗'], ['Luna menguante', '🌘']];

// Calendario completo a partir de lo guardado (rellena lo que falte con su plantilla).
export function calendarOf(settings) {
  const saved = settings?.calendar || {};
  const preset = PRESETS[saved.preset] || PRESETS.euskal;
  return {
    preset: saved.preset || 'euskal', months: (saved.months?.length ? saved.months : preset.months).map(([n, d]) => [n, Math.max(1, Number(d) || 1)]),
    weekdays: saved.weekdays?.length ? saved.weekdays : preset.weekdays, year: saved.year ?? 1024,
    // abreviaturas de la semana: las de la plantilla si la semana es la suya; si no, las tres primeras letras
    short: (saved.weekdays?.length ? saved.weekdays : preset.weekdays).map((w, i) => (preset.short && (preset.weekdays[i] === w) ? preset.short[i] : w.slice(0, 3))),
    start: saved.start ?? 0, moon: saved.moon || 29.5, moonOffset: saved.moonOffset || 0,
    events: saved.events || preset.festivals.map(([month, day, title], i) => ({ id: `f${i}`, title, month, day, yearly: true, kind: 'festivo' })),
  };
}

const yearDays = (cal) => cal.months.reduce((s, [, d]) => s + Number(d || 0), 0) || 1;

// Día de campaña (1 = primer día; 0 o menos, antes de empezar) → fecha. «start» es cuántos días del año
// habían pasado el día 1.
const mod = (a, b) => ((a % b) + b) % b;
export function dateOf(cal, day) {
  const n = (Number(day) || 1) - 1 + cal.start;
  const total = yearDays(cal);
  const year = cal.year + Math.floor(n / total);
  let rest = mod(n, total);
  let month = 0;
  while (rest >= cal.months[month][1]) { rest -= cal.months[month][1]; month += 1; }
  const season = Math.floor((((month + 1) % cal.months.length) / cal.months.length) * 4);
  const weekdayIndex = mod(n, cal.weekdays.length);
  return { year, month, day: rest + 1, weekday: cal.weekdays[weekdayIndex], weekdayIndex, season, n };
}

// Fecha → día de campaña (puede ser 0 o negativo si es anterior al inicio).
export function dayOf(cal, year, month, day) {
  const before = cal.months.slice(0, month).reduce((s, [, d]) => s + Number(d), 0);
  return (year - cal.year) * yearDays(cal) + before + (day - 1) - cal.start + 1;
}

export function moonOf(cal, day) {
  const n = (Number(day) || 1) - 1 + cal.start + cal.moonOffset;
  const phase = mod(n, cal.moon) / cal.moon;
  const [name, emoji] = MOONS[Math.round(phase * 8) % 8];
  return { name, emoji, phase };
}

export function worldDate(cal, day, { weekday = false, short = false } = {}) {
  const d = dateOf(cal, day);
  const month = cal.months[d.month][0];
  if (short) return `${d.day} de ${month}`;
  return `${weekday ? `${d.weekday}, ` : ''}${d.day} de ${month} del año ${d.year}`;
}

// Acontecimientos de un día concreto: los anuales coinciden por mes y día; los demás, por fecha exacta.
export function eventsOn(cal, year, month, day) {
  return cal.events.filter((e) => e.month === month && e.day === day && (e.yearly || e.year === year));
}
