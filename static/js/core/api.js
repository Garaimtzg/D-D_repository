// Cliente de la API del servidor Python.
// Cada escritura avisa con los eventos «dnd:saving» y «dnd:saved» para el indicador de guardado.
let writes = 0;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const isWrite = method !== 'GET' && url !== '/api/roll' && !url.startsWith('/api/generate') && url !== '/api/encounter';
  if (isWrite && writes++ === 0) emit('dnd:saving');
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    if (isWrite && --writes === 0) emit('dnd:saved', { at: Date.now() });
    return data;
  } catch (e) {
    if (isWrite) { writes = Math.max(0, writes - 1); emit('dnd:save-error', { message: e.message }); }
    throw e;
  }
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),

  // Colecciones: characters, combats, maps, notes, quests, tracks
  list: (col) => request('GET', `/api/${col}`),
  create: (col, doc) => request('POST', `/api/${col}`, doc),
  update: (col, doc) => request('PUT', `/api/${col}/${doc.id}`, doc),
  remove: (col, id) => request('DELETE', `/api/${col}/${id}`),

  settings: () => request('GET', '/api/settings'),
  saveSettings: (patch) => request('PUT', '/api/settings', patch),

  async upload(file) {
    emit('dnd:saving');
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'X-Filename': encodeURIComponent(file.name) },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { emit('dnd:save-error', { message: data.error }); throw new Error(data.error || `Error ${res.status}`); }
    emit('dnd:saved', { at: Date.now() });
    return data;
  },
  removeUpload: (url) => url?.startsWith('/uploads/')
    ? request('DELETE', `/api${url}`).catch(() => {})
    : Promise.resolve(),
};

// Guarda con retardo para no lanzar una petición por cada tecla.
export function debounced(fn, ms = 500) {
  let t;
  let lastArgs = [];
  const run = (...args) => {
    lastArgs = args;
    run.pending = true;
    clearTimeout(t);
    t = setTimeout(() => { run.pending = false; fn(...args); }, ms);
  };
  run.pending = false;
  // flush() guarda ya: con argumentos los usa; sin ellos repite la última llamada pendiente.
  run.flush = (...args) => {
    clearTimeout(t);
    run.pending = false;
    return fn(...(args.length ? args : lastArgs));
  };
  return run;
}
