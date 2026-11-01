import { useMemo, useState } from 'react';
import { Admin, Escenarios as Api } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fecha, fechaHora, num, texto } from '../lib/format.js';
import { Alerta, Boton, Carga, Casilla, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';
import Grafo from './Grafo.jsx';

export function Escenarios() {
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => Api.listar(pagina, 20), [pagina]);
  return (
    <Pagina titulo="Analisis de red" ayuda="Escenarios para calcular cuanto puede mover la red en un periodo y que conexiones lo limitan. Es un analisis: no crea ni autoriza movimientos."
      acciones={<a className="btn btn-pri" href="#/escenarios/nuevo">Nuevo escenario</a>}>
      <Seccion titulo="Escenarios">
        <Carga estado={lista} vacio="Todavia no hay escenarios.">{(d) => (<>
          <Tabla titulo="Escenarios" clave="id_escenario" filas={d.items} columnas={[
            { titulo: 'Escenario', ver: (f) => <a href={`#/escenarios/${f.id_escenario}`}>{f.codigo_escenario} - {f.nombre}</a> },
            { titulo: 'Unidad', ver: (f) => f.unidad_flujo },
            { titulo: 'Periodo', ver: (f) => `${fecha(f.fecha_inicio_periodo)} a ${fecha(f.fecha_fin_periodo)}` },
            { titulo: 'Estado', ver: (f) => <Estado valor={f.estado_escenario} /> },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

export function EscenarioNuevo() {
  const centros = useAsync(Admin.centros, []);
  const f = useForm({ nombre: '', fecha_inicio_periodo: '', fecha_fin_periodo: '', unidad_flujo: 'UND' });
  const [nodos, setNodos] = useState({}); // id_centro -> {rol_nodo, oferta, demanda}
  const acc = useAccion(Api.crear);
  const [hecho, setHecho] = useState(null);
  const alternar = (id) => setNodos((x) => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = { rol_nodo: 'INTERMEDIO', oferta: '', demanda: '' }; return n; });
  const cambiar = (id, campo, v) => setNodos((x) => ({ ...x, [id]: { ...x[id], [campo]: v } }));
  const roles = Object.values(nodos).map((n) => n.rol_nodo);
  const faltaRol = Object.keys(nodos).length >= 2 && (!roles.includes('FUENTE') || !roles.includes('SUMIDERO'));

  const enviar = async (e) => {
    e.preventDefault();
    const lista = Object.entries(nodos).map(([id, n]) => ({ id_centro: Number(id), rol_nodo: n.rol_nodo, ...(n.rol_nodo === 'FUENTE' && n.oferta !== '' ? { oferta: n.oferta } : {}), ...(n.rol_nodo === 'SUMIDERO' && n.demanda !== '' ? { demanda: n.demanda } : {}) }));
    const r = await acc.ejecutar({ nombre: f.v.nombre.trim(), fecha_inicio_periodo: f.v.fecha_inicio_periodo, fecha_fin_periodo: f.v.fecha_fin_periodo, unidad_flujo: f.v.unidad_flujo, nodos: lista });
    if (r) setHecho(r);
  };
  return (
    <Pagina titulo="Nuevo escenario" ayuda="Elige los centros de la red y su papel. Las conexiones activas entre ellos, en la misma unidad, se incluyen solas." acciones={<a className="btn btn-sec" href="#/escenarios">Volver</a>}>
      {hecho && <Alerta tipo="exito" titulo="Escenario creado" accion={<p><a href={`#/escenarios/${hecho.id_escenario}`}>Abrir {hecho.codigo_escenario}</a></p>}>{hecho.total_nodos} centros y {hecho.total_conexiones} conexiones.</Alerta>}
      <Carga estado={centros} vacio="No hay centros en tu alcance.">{(cs) => (
        <form onSubmit={enviar} noValidate>
          <Seccion titulo="Datos del escenario">
            <div className="form-rejilla">
              <Input label="Nombre" requerido {...f.enlazar('nombre')} errorApi={acc.error} />
              <Select label="Unidad de flujo" requerido vacio="Selecciona..." opciones={[{ valor: 'UND', texto: 'Unidades (UND)' }, { valor: 'KG', texto: 'Kilogramos (KG)' }]} {...f.enlazar('unidad_flujo')} errorApi={acc.error} />
              <Input label="Inicio del periodo" type="date" requerido {...f.enlazar('fecha_inicio_periodo')} errorApi={acc.error} />
              <Input label="Fin del periodo" type="date" min={f.v.fecha_inicio_periodo} requerido {...f.enlazar('fecha_fin_periodo')} errorApi={acc.error} />
            </div>
          </Seccion>
          <Seccion titulo={`Centros del escenario (${Object.keys(nodos).length})`} ayuda="Necesitas al menos una fuente y un sumidero. Si dejas la oferta o demanda vacia, no se limita.">
            {cs.map((c) => (
              <div key={c.id_centro} className="acciones" style={{ marginBottom: '.5rem' }}>
                <Casilla label={`${c.codigo_centro} - ${c.nombre}`} checked={c.id_centro in nodos} onChange={() => alternar(c.id_centro)} />
                {c.id_centro in nodos && (<>
                  <select aria-label={`Papel de ${c.nombre}`} value={nodos[c.id_centro].rol_nodo} onChange={(e) => cambiar(c.id_centro, 'rol_nodo', e.target.value)}>
                    <option value="FUENTE">Fuente</option><option value="INTERMEDIO">Intermedio</option><option value="SUMIDERO">Sumidero</option>
                  </select>
                  {nodos[c.id_centro].rol_nodo === 'FUENTE' && <input type="number" min="0" aria-label={`Oferta de ${c.nombre} (opcional)`} placeholder="Oferta (opcional)" value={nodos[c.id_centro].oferta} onChange={(e) => cambiar(c.id_centro, 'oferta', e.target.value)} />}
                  {nodos[c.id_centro].rol_nodo === 'SUMIDERO' && <input type="number" min="0" aria-label={`Demanda de ${c.nombre} (opcional)`} placeholder="Demanda (opcional)" value={nodos[c.id_centro].demanda} onChange={(e) => cambiar(c.id_centro, 'demanda', e.target.value)} />}
                </>)}
              </div>
            ))}
            {faltaRol && <Alerta tipo="aviso">Marca al menos un centro como Fuente y otro como Sumidero.</Alerta>}
          </Seccion>
          <ErrorApi error={acc.error} ayuda={{ 422: 'Revisa el periodo, que haya fuente y sumidero, y que los centros esten en tu alcance.' }} />
          <Boton type="submit" enviando={acc.enviando} disabled={Object.keys(nodos).length < 2 || faltaRol || !f.v.nombre.trim() || !f.v.fecha_inicio_periodo || !f.v.fecha_fin_periodo}>Crear escenario</Boton>
        </form>
      )}</Carga>
    </Pagina>
  );
}

function Resultado({ esc, centros, r }) {
  const nombre = (id) => centros.find((c) => c.id_centro === id)?.nombre || `Centro ${id}`;
  const conex = useMemo(() => Object.fromEntries(esc.conexiones.map((c) => [c.id_conexion, c])), [esc]);
  const filas = r.resultados.map((x) => {
    const c = conex[x.id_conexion] || {};
    const cap = Number(x.capacidad_considerada);
    return { ...x, origen: c.id_centro_origen, destino: c.id_centro_destino, saturada: Number(x.flujo_asignado) >= cap && cap > 0 };
  });
  const aristas = filas.map((x) => ({ id_conexion: x.id_conexion, origen: x.origen, destino: x.destino, flujo: x.flujo_asignado, capacidad: x.capacidad_considerada, corte: x.en_corte_minimo }));
  return (
    <div>
      <Alerta tipo="info" titulo="Simulacion">Este resultado es un calculo sobre los datos guardados del escenario. No crea ni autoriza movimientos.</Alerta>
      <Datos pares={[['Flujo maximo', `${num(r.flujo_maximo)} ${esc.unidad_flujo}`], ...(r.capacidad_corte != null ? [['Capacidad del corte minimo', `${num(r.capacidad_corte)} ${esc.unidad_flujo}`]] : []),
        ['Periodo', `${fecha(esc.fecha_inicio_periodo)} a ${fecha(esc.fecha_fin_periodo)}`], ['Algoritmo', texto(r.algoritmo)], ...(r.huella_datos ? [['Huella de los datos', <code key="h" style={{ wordBreak: 'break-all' }}>{r.huella_datos}</code>]] : [])]} />
      {r.interpretacion && <p className="ayuda">{r.interpretacion}</p>}
      <h3 style={{ marginTop: '1rem' }}>Grafo</h3>
      <Grafo nodos={esc.nodos} aristas={aristas} nombre={nombre} />
      <p className="nota">Circulo F: fuente. Cuadrado S: sumidero. Circulo I: intermedio. Cada flecha muestra flujo/capacidad. Punteada y con la palabra corte: pertenece al corte minimo.</p>
      <h3>Tabla de conexiones</h3>
      <Tabla titulo="Resultado por conexion" clave="id_conexion" filas={filas} columnas={[
        { titulo: 'Conexion', ver: (x) => `${nombre(x.origen)} a ${nombre(x.destino)}` },
        { titulo: 'Capacidad considerada', num: true, ver: (x) => num(x.capacidad_considerada) },
        { titulo: 'Flujo asignado', num: true, ver: (x) => num(x.flujo_asignado) },
        { titulo: 'Saturada', ver: (x) => (x.saturada ? 'Si (usa toda su capacidad)' : 'No') },
        { titulo: 'En el corte minimo', ver: (x) => (x.en_corte_minimo ? 'Si' : 'No') },
      ]} />
      <p className="nota">Una conexion saturada no siempre pertenece al corte minimo: por eso son dos columnas distintas.</p>
      {(r.ofertas_limitantes?.length > 0 || r.demandas_limitantes?.length > 0) && (
        <p className="nota">{r.ofertas_limitantes?.length ? `Ofertas que limitan: ${r.ofertas_limitantes.map(nombre).join(', ')}. ` : ''}{r.demandas_limitantes?.length ? `Demandas que limitan: ${r.demandas_limitantes.map(nombre).join(', ')}.` : ''}</p>
      )}
    </div>
  );
}

export function EscenarioDetalle({ params }) {
  const id = params.id;
  const esc = useAsync(() => Api.obtener(id), [id]);
  const centros = useAsync(Admin.centros, []);
  const hist = useAsync(() => Api.ejecuciones(id), [id]);
  const [algoritmo, setAlgoritmo] = useState('EDMONDS_KARP');
  const [resultado, setResultado] = useState(null);
  const calcular = useAccion(() => Api.ejecutar(id, algoritmo).then((r) => { setResultado(r); hist.recargar(); return r; }));
  const ver = useAccion((ide) => Api.ejecucion(id, ide).then((r) => { setResultado(r); return r; }));
  const estado = useAccion((e) => Api.estado(id, e).then((r) => { esc.recargar(); return r; }));
  return (
    <Pagina titulo={`Escenario ${esc.data?.codigo_escenario || id}`} acciones={<a className="btn btn-sec" href="#/escenarios">Volver</a>}>
      <Carga estado={esc}>{(e) => (<>
        <Seccion titulo={e.nombre} acciones={e.estado_escenario !== 'ARCHIVADO' && (
          <Boton tipo="secundario" enviando={estado.enviando} onClick={() => estado.ejecutar(e.estado_escenario === 'VIGENTE' ? 'ARCHIVADO' : 'VIGENTE')}>{e.estado_escenario === 'VIGENTE' ? 'Archivar' : 'Marcar vigente'}</Boton>)}>
          <Datos pares={[['Estado', <Estado key="s" valor={e.estado_escenario} />], ['Unidad', e.unidad_flujo], ['Periodo', `${fecha(e.fecha_inicio_periodo)} a ${fecha(e.fecha_fin_periodo)}`], ['Centros', e.nodos.length], ['Conexiones', e.conexiones.length]]} />
          <ErrorApi error={estado.error} ayuda={{ 409: 'Un escenario archivado no cambia de estado.' }} />
        </Seccion>
        <Seccion titulo="Calcular flujo maximo y corte minimo">
          <div className="acciones">
            <Select label="Algoritmo" value={algoritmo} onChange={(ev) => setAlgoritmo(ev.target.value)} vacio="Selecciona..." opciones={[{ valor: 'EDMONDS_KARP', texto: 'Edmonds-Karp' }, { valor: 'FORD_FULKERSON', texto: 'Ford-Fulkerson' }]} />
            <Boton enviando={calcular.enviando} onClick={() => calcular.ejecutar()}>Calcular</Boton>
          </div>
          <ErrorApi error={calcular.error || ver.error} />
          <Carga estado={centros}>{(cs) => (resultado ? <Resultado esc={e} centros={cs} r={resultado} /> : <p className="nota">Todavia no hay un resultado en pantalla. Calcula o abre una ejecucion anterior.</p>)}</Carga>
        </Seccion>
        <Seccion titulo="Ejecuciones anteriores">
          <Carga estado={hist} vacio="Aun no se ha calculado este escenario.">{(h) => (
            <Tabla titulo="Ejecuciones" clave="id_ejecucion" filas={h} columnas={[
              { titulo: 'Ejecucion', ver: (x) => `#${x.id_ejecucion}` }, { titulo: 'Fecha', ver: (x) => fechaHora(x.fecha_hora_ejecucion) },
              { titulo: 'Algoritmo', ver: (x) => texto(x.algoritmo) }, { titulo: 'Flujo maximo', num: true, ver: (x) => num(x.flujo_maximo) }, { titulo: 'Estado', ver: (x) => <Estado valor={x.estado_ejecucion} /> },
              { titulo: 'Ver', ver: (x) => <button type="button" className="btn btn-sec btn-chico" onClick={() => ver.ejecutar(x.id_ejecucion)}>Abrir</button> },
            ]} />
          )}</Carga>
        </Seccion>
      </>)}</Carga>
    </Pagina>
  );
}
