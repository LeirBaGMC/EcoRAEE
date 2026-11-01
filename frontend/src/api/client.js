// Cliente HTTP central. Todas las pantallas llaman a la API solo por aqui.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const CLAVE_TOKEN = 'ecoraee_token';

export class ApiError extends Error {
  constructor(status, message, campos = []) {
    super(message);
    this.status = status;
    this.campos = campos; // [{campo, mensaje}] cuando el backend valida formato (422)
  }
}

export const sesion = {
  leer() {
    try { return sessionStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  },
  guardar(t) {
    try { sessionStorage.setItem(CLAVE_TOKEN, t); } catch { /* sin almacenamiento: la sesion dura mientras la pestana */ }
    memoria = t;
  },
  borrar() {
    try { sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* nada */ }
    memoria = null;
  },
  token() { return memoria ?? this.leer(); },
};
let memoria = null;

let alVencerSesion = () => {};
export function onSesionVencida(fn) { alVencerSesion = fn; }

function leerDetalle(cuerpo, status) {
  if (typeof cuerpo?.mensaje === 'string') return { mensaje: cuerpo.mensaje, campos: [] };
  const d = cuerpo && cuerpo.detail;
  if (typeof d === 'string') return { mensaje: d, campos: [] };
  if (Array.isArray(d)) {
    const campos = d.map((e) => ({
      campo: Array.isArray(e.loc) ? e.loc.filter((x) => x !== 'body' && x !== 'query').join('.') : '',
      mensaje: e.msg || 'Valor no valido',
    }));
    return { mensaje: 'Revisa los campos marcados.', campos };
  }
  const genericos = {
    401: 'Tu sesion no es valida. Ingresa de nuevo.',
    403: 'Tu rol no permite esta accion.',
    404: 'No se encontro, o no esta dentro de tu alcance.',
    409: 'La accion choca con el estado actual. Actualiza la pantalla y revisa.',
    422: 'Los datos no cumplen una regla del proceso.',
  };
  return { mensaje: genericos[status] || `El servidor respondio con error ${status}.`, campos: [] };
}

function armarUrl(path, query) {
  const u = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  });
  return u.toString();
}

async function manejar(resp, esLogin) {
  if (resp.ok) {
    const tipo = resp.headers.get('content-type') || '';
    return tipo.includes('application/json') ? resp.json() : resp;
  }
  let cuerpo = null;
  try { cuerpo = await resp.json(); } catch { /* sin cuerpo */ }
  const { mensaje, campos } = leerDetalle(cuerpo, resp.status);
  if (resp.status === 401 && !esLogin) alVencerSesion();
  throw new ApiError(resp.status, mensaje, campos);
}

export async function api(method, path, { body, query, headers } = {}) {
  const h = { Accept: 'application/json', ...(headers || {}) };
  const t = sesion.token();
  if (t) h.Authorization = `Bearer ${t}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  let resp;
  try {
    resp = await fetch(armarUrl(path, query), { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexion o que el backend este encendido, y reintenta.');
  }
  return manejar(resp, path === '/auth/login');
}

// Subida con progreso (fetch no informa el avance de subida; XMLHttpRequest si).
export function subirFormulario(path, formData, onProgreso) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', armarUrl(path));
    const t = sesion.token();
    if (t) x.setRequestHeader('Authorization', `Bearer ${t}`);
    x.setRequestHeader('Accept', 'application/json');
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgreso) onProgreso(Math.round((e.loaded / e.total) * 100)); };
    x.onerror = () => reject(new ApiError(0, 'Se corto la conexion durante la carga. Reintenta.'));
    x.onload = () => {
      let cuerpo = null;
      try { cuerpo = JSON.parse(x.responseText); } catch { /* nada */ }
      if (x.status >= 200 && x.status < 300) return resolve(cuerpo);
      if (x.status === 401) alVencerSesion();
      const { mensaje, campos } = leerDetalle(cuerpo, x.status);
      reject(new ApiError(x.status, mensaje, campos));
    };
    x.send(formData);
  });
}

// Descarga protegida: el archivo se pide con el token y se abre desde memoria; no se guarda ningun enlace.
export async function descargarBlob(path, query) {
  const h = {};
  const t = sesion.token();
  if (t) h.Authorization = `Bearer ${t}`;
  let resp;
  try { resp = await fetch(armarUrl(path, query), { headers: h }); }
  catch { throw new ApiError(0, 'No se pudo conectar con el servidor. Reintenta.'); }
  if (!resp.ok) {
    let cuerpo = null;
    try { cuerpo = await resp.json(); } catch { /* nada */ }
    if (resp.status === 401) alVencerSesion();
    const { mensaje } = leerDetalle(cuerpo, resp.status);
    throw new ApiError(resp.status, mensaje);
  }
  return resp.blob();
}
