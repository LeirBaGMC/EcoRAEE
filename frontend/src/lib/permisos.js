// SOLO para decidir que mostrar. La autorizacion real la hace el backend en cada peticion.
export const ROLES = {
  GENERADOR: 'Generador',
  OPERADOR_CENTRO: 'Operador de centro',
  TECNICO_EVALUADOR: 'Técnico evaluador',
  COORDINADOR_LOGISTICO: 'Coordinador logístico',
  REACONDICIONADOR_RECICLADOR: 'Reacondicionador o reciclador',
  ENTIDAD_BENEFICIARIA: 'Entidad beneficiaria',
  ADMINISTRADOR: 'Administrador',
};

const G = 'GENERADOR', O = 'OPERADOR_CENTRO', T = 'TECNICO_EVALUADOR', C = 'COORDINADOR_LOGISTICO',
  R = 'REACONDICIONADOR_RECICLADOR', B = 'ENTIDAD_BENEFICIARIA', A = 'ADMINISTRADOR';

// ruta, titulo del menu, roles que la ven, grupo
export const MENU = [
  { ruta: '/', titulo: 'Inicio', roles: [G, O, T, C, R, B, A], grupo: 'General' },
  { ruta: '/dispositivos', titulo: 'Dispositivos', roles: [G, O, T, C, R], grupo: 'Equipos' },
  { ruta: '/solicitudes', titulo: 'Lotes y solicitudes', roles: [G, O, C], grupo: 'Equipos' },
  { ruta: '/recepciones', titulo: 'Recepción en centro', roles: [O], grupo: 'Centro' },
  { ruta: '/movimientos', titulo: 'Movimientos', roles: [O, C], grupo: 'Centro' },
  { ruta: '/tratamientos', titulo: 'Tratamientos', roles: [R], grupo: 'Destino' },
  { ruta: '/asignaciones', titulo: 'Asignaciones', roles: [C, B], grupo: 'Destino' },
  { ruta: '/cierres', titulo: 'Cierre de trazabilidad', roles: [C], grupo: 'Destino' },
  { ruta: '/evidencias', titulo: 'Evidencias', roles: [O, T, C, R, A], grupo: 'Control' },
  { ruta: '/escenarios', titulo: 'Análisis de red', roles: [C], grupo: 'Control' },
  { ruta: '/seguimiento', titulo: 'Indicadores y alertas', roles: [C, A], grupo: 'Control' },
  { ruta: '/red', titulo: 'Centros y conexiones', roles: [O, C, A], grupo: 'Administración' },
  { ruta: '/usuarios', titulo: 'Usuarios', roles: [A], grupo: 'Administración' },
  { ruta: '/organizaciones', titulo: 'Organizaciones', roles: [A], grupo: 'Administración' },
  { ruta: '/auditoria', titulo: 'Auditoría', roles: [A], grupo: 'Administración' },
];

export const tiene = (usuario, ...roles) => !!usuario && roles.some((r) => usuario.roles.includes(r));
export const puedeVer = (usuario, ruta) => {
  const m = MENU.find((x) => x.ruta === ruta);
  return !m || tiene(usuario, ...m.roles);
};

export const R_ = { G, O, T, C, R, B, A };
