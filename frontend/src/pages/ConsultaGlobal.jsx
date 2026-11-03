import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useAsync } from '../lib/hooks.js';
import { fechaHora, texto } from '../lib/format.js';
import { puedeVer } from '../lib/permisos.js';
import { Carga, Pagina, Paginacion, Tabla } from '../components/ui.jsx';

const CONFIG = {
  recepciones: { titulo: 'Recepciones', clave: 'id_recepcion', columnas: [['Número', 'id_recepcion'], ['Fecha', 'fecha_hora'], ['Solicitud', 'id_solicitud'], ['Centro', 'id_centro'], ['Peso (kg)', 'peso_recibido_kg'], ['Unidades', 'unidades_recibidas'], ['Conforme', 'conforme']] },
  tratamientos: { titulo: 'Tratamientos', clave: 'id_tratamiento', columnas: [['Número', 'id_tratamiento'], ['Dispositivo', 'id_dispositivo'], ['Tipo', 'tipo_tratamiento'], ['Resultado', 'resultado'], ['Inicio', 'fecha_inicio'], ['Fin', 'fecha_fin']] },
  cierres: { titulo: 'Cierres de trazabilidad', clave: 'id_cierre', columnas: [['Número', 'id_cierre'], ['Dispositivo', 'id_dispositivo'], ['Destino', 'destino_final'], ['Tratamiento', 'id_tratamiento'], ['Asignación', 'id_asignacion'], ['Confirmación', 'fecha_confirmacion']] },
};

export default function ConsultaGlobal({ recurso }) {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => api('GET', `/consultas/${recurso}`, { query: { pagina, tamano: 20 } }), [recurso, pagina]);
  const c = CONFIG[recurso];
  const columnas = c.columnas.map(([titulo, campo]) => ({ titulo, ver: (r) => {
    if (campo === 'id_dispositivo') return puedeVer(usuario, '/dispositivos') ? <a href={`#/dispositivos/${r[campo]}`}>#{r[campo]}</a> : `#${r[campo]}`;
    if (r[campo] == null) return '—';
    if (campo.startsWith('fecha_')) return fechaHora(r[campo]);
    if (typeof r[campo] === 'boolean') return r[campo] ? 'Sí' : 'No';
    return texto(String(r[campo]));
  } }));
  if (recurso !== 'tratamientos') columnas.push({ titulo: 'Evidencias', ver: (r) => <a href={`#/evidencias?destino=${c.clave}&id=${r[c.clave]}`}>Consultar</a> });
  return <Pagina titulo={`${c.titulo}: consulta global`} ayuda="Consulta de todas las organizaciones. Las acciones operativas corresponden a cada rol.">
    <Carga estado={lista} vacio="No hay registros.">{(d) => <>
      <Tabla titulo={c.titulo} clave={c.clave} filas={d.items} columnas={columnas} />
      <Paginacion pagina={pagina} tamano={20} total={d.total} onCambiar={setPagina} />
    </>}</Carga>
  </Pagina>;
}
