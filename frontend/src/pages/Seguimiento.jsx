import { useState } from 'react';
import { Seguimiento as Api } from '../api/endpoints.js';
import { useAccion, useAsync } from '../lib/hooks.js';
import { fecha, fechaHora, num, texto } from '../lib/format.js';
import { Alerta, Boton, Carga, ErrorApi, Estado, Paginacion, Pagina, Seccion, Tabla } from '../components/ui.jsx';

function Mediciones({ codigo }) {
  const m = useAsync(() => Api.mediciones(codigo), [codigo]);
  return <Carga estado={m} vacio="Sin mediciones guardadas.">{(l) => <Tabla titulo={`Mediciones de ${codigo}`} filas={l} columnas={[{ titulo: 'Fecha de corte', ver: (x) => fecha(x.fecha_corte) }, { titulo: 'Valor', num: true, ver: (x) => num(x.valor) }]} />}</Carga>;
}

export default function Seguimiento() {
  const ind = useAsync(Api.indicadores, []);
  const [abierto, setAbierto] = useState(null);
  const [version, setVersion] = useState(0);
  const calc = useAccion(() => Api.calcularIndicadores().then((r) => { ind.recargar(); setVersion((v) => v + 1); return r; }));
  const [pagina, setPagina] = useState(1);
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const al = useAsync(() => Api.alertas(pagina, 20, soloAbiertas), [pagina, soloAbiertas]);
  const evaluar = useAccion(() => Api.evaluarAlertas().then((r) => { al.recargar(); return r; }));
  const atender = useAccion((id) => Api.atender(id).then((r) => { al.recargar(); return r; }));
  return (
    <Pagina titulo="Indicadores y alertas" ayuda="Indicadores de toda la red y alertas por capacidad, evidencia faltante y tiempos excedidos.">
      <Seccion titulo="Indicadores" acciones={<Boton enviando={calc.enviando} onClick={() => calc.ejecutar()}>Calcular ahora</Boton>}>
        <p className="nota">Calcular ahora consulta los datos actuales de toda la red y guarda la medición de hoy. Si ya calculaste hoy, la actualiza. No mueve equipos ni ejecuta una simulación. En Historia puedes consultar las mediciones de otros días.</p>
        <ErrorApi error={calc.error} />
        {calc.ok && !calc.error && <Alerta tipo="exito">Medición de hoy guardada. Se actualizaron {calc.ok.length} indicadores.</Alerta>}
        <Carga estado={ind} vacio="Aún no hay indicadores. Pulsa Calcular ahora.">{(l) => (
          <Tabla titulo="Indicadores" clave="codigo_indicador" filas={l} columnas={[
            { titulo: 'Código', campo: 'codigo_indicador' }, { titulo: 'Indicador', ver: (x) => <span>{x.nombre}{x.descripcion ? <small className="nota"> - {x.descripcion}</small> : null}</span> },
            { titulo: 'Valor', num: true, ver: (x) => `${num(x.valor)} ${x.unidad_medida || ''}` }, { titulo: 'Corte', ver: (x) => fecha(x.fecha_corte) },
            { titulo: 'Historia', ver: (x) => <button type="button" className="btn btn-sec btn-chico" aria-expanded={abierto === x.codigo_indicador} onClick={() => setAbierto(abierto === x.codigo_indicador ? null : x.codigo_indicador)}>{abierto === x.codigo_indicador ? 'Ocultar' : 'Ver'}</button> },
          ]} />
        )}</Carga>
        {abierto && <Mediciones key={`${abierto}-${version}`} codigo={abierto} />}
      </Seccion>
      <Seccion titulo="Alertas" acciones={<Boton tipo="secundario" enviando={evaluar.enviando} onClick={() => evaluar.ejecutar()}>Buscar alertas nuevas</Boton>}>
        <p className="nota">Busca capacidad comprometida desde el 90 %, movimientos en tránsito sin guía y demoras de más de 7 días. Marcar atendida registra la atención; no corrige por sí mismo la causa.</p>
        <label className="campo campo-check"><input type="checkbox" checked={soloAbiertas} onChange={(e) => { setSoloAbiertas(e.target.checked); setPagina(1); }} /> Mostrar solo las abiertas</label>
        <ErrorApi error={evaluar.error || atender.error} ayuda={{ 409: 'Esa alerta ya estaba atendida.' }} />
        {evaluar.ok && !evaluar.error && <Alerta tipo="exito">Busqueda terminada: {evaluar.ok.total_creadas} alerta(s) nueva(s).</Alerta>}
        <Carga estado={al} vacio="No hay alertas.">{(d) => (<>
          <Tabla titulo="Alertas" clave="id_alerta" filas={d.items} columnas={[
            { titulo: 'Tipo', ver: (x) => texto(x.tipo_alerta) }, { titulo: 'Severidad', ver: (x) => <Estado valor={x.severidad} /> }, { titulo: 'Mensaje', campo: 'mensaje' },
            { titulo: 'Generada', ver: (x) => fechaHora(x.fecha_generacion) },
            { titulo: 'Estado', ver: (x) => (x.fecha_atencion ? `Atendida ${fecha(x.fecha_atencion)}` : <Estado valor="PENDIENTE" />) },
            { titulo: 'Acción', ver: (x) => (x.fecha_atencion ? '-' : <button type="button" className="btn btn-sec btn-chico" disabled={atender.enviando} onClick={() => atender.ejecutar(x.id_alerta)}>Marcar atendida</button>) },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}
