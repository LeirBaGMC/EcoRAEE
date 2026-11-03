// Un metodo por endpoint del contrato (CONTRATO_API.md). No se inventa ninguno.
import { api, descargarBlob, subirFormulario } from './client.js';

const pag = (pagina = 1, tamano = 20, extra = {}) => ({ pagina, tamano, ...extra });

export const Auth = {
  login: (nombre_usuario, contrasena) => api('POST', '/auth/login', { body: { nombre_usuario, contrasena } }),
  yo: () => api('GET', '/auth/me'),
};

export const Catalogos = { todos: () => api('GET', '/catalogos') };

export const Dispositivos = {
  listar: (p, t, estado) => api('GET', '/dispositivos', { query: pag(p, t, { estado }) }),
  obtener: (id) => api('GET', `/dispositivos/${id}`),
  historial: (id) => api('GET', `/dispositivos/${id}/historial`),
  registrar: (b) => api('POST', '/dispositivos', { body: b }),
  evaluar: (id, b) => api('POST', `/dispositivos/${id}/evaluaciones`, { body: b }),
  cierre: (id) => api('GET', `/dispositivos/${id}/cierre`),
};

export const Lotes = {
  crear: (ids_dispositivos) => api('POST', '/lotes', { body: { ids_dispositivos } }),
  obtener: (id) => api('GET', `/lotes/${id}`),
  crearSolicitud: (b) => api('POST', '/solicitudes', { body: b }),
  listarSolicitudes: (p, t, estado) => api('GET', '/solicitudes', { query: pag(p, t, { estado }) }),
  programarRecoleccion: (id, fecha_programada) => api('POST', `/solicitudes/${id}/recoleccion`, { body: { fecha_programada } }),
  ejecutarRecoleccion: (id) => api('POST', `/solicitudes/${id}/recoleccion/ejecutar`),
};

export const Recepciones = { registrar: (b) => api('POST', '/recepciones', { body: b }) };

export const Movimientos = {
  listar: (p, t, estado) => api('GET', '/movimientos', { query: pag(p, t, { estado }) }),
  obtener: (id) => api('GET', `/movimientos/${id}`),
  programar: (b, idempotencyKey) => api('POST', '/movimientos', { body: b, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
  autorizar: (id) => api('POST', `/movimientos/${id}/autorizar`),
  anular: (id) => api('POST', `/movimientos/${id}/anular`),
  despachar: (id) => api('POST', `/movimientos/${id}/despachar`),
  cerrar: (id, conformes) => api('POST', `/movimientos/${id}/cerrar`, { body: { conformes } }),
};

export const Ciclo = {
  iniciarTratamiento: (b) => api('POST', '/tratamientos', { body: b }),
  finalizarTratamiento: (id, resultado) => api('POST', `/tratamientos/${id}/finalizar`, { body: { resultado } }),
  tratamiento: (id) => api('GET', `/tratamientos/${id}`),
  tratamientos: (p, t) => api('GET', '/tratamientos', { query: pag(p, t) }),
  crearAsignacion: (b) => api('POST', '/asignaciones', { body: b }),
  confirmarAsignacion: (id) => api('POST', `/asignaciones/${id}/confirmar`),
  asignaciones: (p, t) => api('GET', '/asignaciones', { query: pag(p, t) }),
  cerrarTrazabilidad: (b) => api('POST', '/cierres', { body: b }),
};

export const Evidencias = {
  listar: (proposito, destino) => api('GET', '/evidencias', { query: { proposito, ...destino } }),
  subir: (formData, onProgreso) => subirFormulario('/evidencias', formData, onProgreso),
  archivo: (id, proposito) => descargarBlob(`/evidencias/${id}/archivo`, { proposito }),
};

export const Escenarios = {
  listar: (p, t) => api('GET', '/escenarios', { query: pag(p, t) }),
  crear: (b) => api('POST', '/escenarios', { body: b }),
  obtener: (id) => api('GET', `/escenarios/${id}`),
  estado: (id, estado) => api('POST', `/escenarios/${id}/estado`, { body: { estado } }),
  ejecutar: (id, algoritmo) => api('POST', `/escenarios/${id}/ejecuciones`, { body: { algoritmo } }),
  ejecuciones: (id) => api('GET', `/escenarios/${id}/ejecuciones`),
  ejecucion: (id, ide) => api('GET', `/escenarios/${id}/ejecuciones/${ide}`),
};

export const Seguimiento = {
  calcularIndicadores: () => api('POST', '/indicadores/calcular'),
  indicadores: () => api('GET', '/indicadores'),
  mediciones: (codigo) => api('GET', `/indicadores/${codigo}/mediciones`),
  evaluarAlertas: () => api('POST', '/alertas/evaluar'),
  alertas: (p, t, solo_abiertas = true) => api('GET', '/alertas', { query: pag(p, t, { solo_abiertas }) }),
  atender: (id) => api('POST', `/alertas/${id}/atender`),
};

export const Admin = {
  usuarios: (p, t) => api('GET', '/usuarios', { query: pag(p, t) }),
  crearUsuario: (b) => api('POST', '/usuarios', { body: b }),
  roles: (id, roles) => api('PUT', `/usuarios/${id}/roles`, { body: { roles } }),
  activo: (id, activo) => api('PUT', `/usuarios/${id}/activo`, { body: { activo } }),
  organizaciones: (p, t, tipo_actor) => api('GET', '/organizaciones', { query: pag(p, t, { tipo_actor }) }),
  crearOrganizacion: (b) => api('POST', '/organizaciones', { body: b }),
  centros: () => api('GET', '/centros'),
  crearCentro: (b) => api('POST', '/centros', { body: b }),
  conexiones: () => api('GET', '/conexiones'),
  crearConexion: (b) => api('POST', '/conexiones', { body: b }),
  capacidadConexion: (id, capacidad_por_periodo) => api('PUT', `/conexiones/${id}/capacidad`, { body: { capacidad_por_periodo } }),
  auditoria: (p, t, tabla, clave) => api('GET', '/auditoria', { query: pag(p, t, { tabla, clave }) }),
};
