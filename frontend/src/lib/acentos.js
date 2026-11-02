// Palabras que llegan sin tilde desde los catálogos del backend o desde textos antiguos.
const PALABRAS = {
  administracion: 'administración', accion: 'acción', actualizacion: 'actualización', analisis: 'análisis', asignacion: 'asignación', atencion: 'atención',
  auditoria: 'auditoría', aun: 'aún', automatica: 'automática', busqueda: 'búsqueda', categoria: 'categoría', clasificacion: 'clasificación', codigo: 'código',
  condicion: 'condición', conexion: 'conexión', contrasena: 'contraseña', creacion: 'creación', descripcion: 'descripción', destruccion: 'destrucción',
  dias: 'días', direccion: 'dirección', disposicion: 'disposición', electronico: 'electrónico', electronicos: 'electrónicos', evaluacion: 'evaluación',
  fisico: 'físico', gestion: 'gestión', informacion: 'información', juridica: 'jurídica', logistica: 'logística', logistico: 'logístico', maximo: 'máximo',
  menu: 'menú', minimo: 'mínimo', numero: 'número', operacion: 'operación', opcion: 'opción', organizacion: 'organización', pagina: 'página', peticion: 'petición',
  proposito: 'propósito', publico: 'público', recepcion: 'recepción', recoleccion: 'recolección', revision: 'revisión', seleccion: 'selección', sesion: 'sesión',
  tecnica: 'técnica', tecnico: 'técnico', transito: 'tránsito', ubicacion: 'ubicación', ultimo: 'último', unico: 'único', verificacion: 'verificación',
};

export function conTildes(cadena) {
  return cadena.replace(/[A-Za-zÁÉÍÓÚáéíóúñÑ]+/g, (p) => {
    const m = PALABRAS[p.toLowerCase()];
    if (!m) return p;
    return p[0] === p[0].toUpperCase() ? m[0].toUpperCase() + m.slice(1) : m;
  });
}
