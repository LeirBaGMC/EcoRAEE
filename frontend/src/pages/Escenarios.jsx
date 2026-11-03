import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { R_, tiene } from '../lib/permisos.js';
import { Admin, Escenarios as Api } from '../api/endpoints.js';
import { normalizar, useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fecha, fechaHora, num, texto } from '../lib/format.js';
import { Alerta, Boton, Carga, Casilla, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';
import Grafo from './Grafo.jsx';

const ALGORITMOS = { EDMONDS_KARP: 'Edmonds-Karp', FORD_FULKERSON: 'Ford-Fulkerson' };

export function Escenarios() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => Api.listar(pagina, 20), [pagina]);
  return (
    <Pagina titulo="Análisis de red" ayuda="Escenarios para calcular cuanto puede mover la red en un periodo y que conexiones lo limitan. Es un análisis: no crea ni autoriza movimientos."
      acciones={tiene(usuario, R_.C) && <a className="btn btn-pri" href="#/escenarios/nuevo">Nuevo escenario</a>}>
      <Seccion titulo="Escenarios">
        <Carga estado={lista} vacio="Todavia no hay escenarios.">{(d) => (<>
          <p className="nota">Escenarios más recientes primero.</p>
          <Tabla titulo="Escenarios" clave="id_escenario" filas={[...d.items].sort((a, b) => b.id_escenario - a.id_escenario)} columnas={[
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
  const [busquedaCentro, setBusquedaCentro] = useState('');
  const centrosOrdenados = useMemo(() => [...(centros.data || [])].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true }) || String(a.codigo_centro).localeCompare(String(b.codigo_centro), 'es', { numeric: true }) || a.id_centro - b.id_centro), [centros.data]);
  const centrosVisibles = centrosOrdenados.filter((c) => normalizar(`${c.nombre} ${c.codigo_centro} ${c.id_centro}`).includes(normalizar(busquedaCentro)));
  const alternar = (id) => setNodos((x) => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = { rol_nodo: 'INTERMEDIO', oferta: '', demanda: '' }; return n; });
  const cambiar = (id, campo, v) => setNodos((x) => ({ ...x, [id]: { ...x[id], [campo]: v } }));
  const roles = Object.values(nodos).map((n) => n.rol_nodo);
  const faltaRol = Object.keys(nodos).length >= 2 && (!roles.includes('FUENTE') || !roles.includes('SUMIDERO'));
  const faltaPapel = roles.some((r) => !['FUENTE', 'SUMIDERO', 'INTERMEDIO'].includes(r));

  const enviar = async (e) => {
    e.preventDefault();
    setHecho(null);
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
            <Input label="Buscar centro por nombre, código o número" value={busquedaCentro} onChange={(e) => setBusquedaCentro(e.target.value)} type="search" />
            <p className="nota">Por nombre, de A a Z. {centrosVisibles.length} de {cs.length} centros visibles; {Object.keys(nodos).length} seleccionados.</p>
            <div className="escenario-centros" role="region" aria-label="Centros disponibles para el escenario" tabIndex={0}>
            {centrosVisibles.map((c) => (
              <div key={c.id_centro} className={`escenario-centro${c.id_centro in nodos ? ' seleccionado' : ''}`}>
                <Casilla label={`${c.codigo_centro} - ${c.nombre}`} checked={c.id_centro in nodos} onChange={() => alternar(c.id_centro)} />
                {c.id_centro in nodos && (<div className="escenario-nodo-campos">
                  <Select label={`Papel de ${c.nombre}`} requerido value={nodos[c.id_centro].rol_nodo} onChange={(e) => cambiar(c.id_centro, 'rol_nodo', e.target.value)}
                    opciones={[{ valor: 'FUENTE', texto: 'Fuente' }, { valor: 'INTERMEDIO', texto: 'Intermedio' }, { valor: 'SUMIDERO', texto: 'Sumidero' }]} />
                  {nodos[c.id_centro].rol_nodo === 'FUENTE' && <Input label={`Oferta de ${c.nombre} (opcional)`} type="number" min="0" step="any" inputMode="decimal" value={nodos[c.id_centro].oferta} onChange={(e) => cambiar(c.id_centro, 'oferta', e.target.value)} />}
                  {nodos[c.id_centro].rol_nodo === 'SUMIDERO' && <Input label={`Demanda de ${c.nombre} (opcional)`} type="number" min="0" step="any" inputMode="decimal" value={nodos[c.id_centro].demanda} onChange={(e) => cambiar(c.id_centro, 'demanda', e.target.value)} />}
                </div>)}
              </div>
            ))}
            {!centrosVisibles.length && <p className="vacio">Ningún centro coincide con la búsqueda.</p>}
            </div>
            {faltaRol && <Alerta tipo="aviso">Marca al menos un centro como Fuente y otro como Sumidero.</Alerta>}
            {faltaPapel && <Alerta tipo="aviso">Selecciona el papel de cada centro incluido.</Alerta>}
          </Seccion>
          <ErrorApi error={acc.error} ayuda={{ 422: 'Revisa el periodo, que haya fuente y sumidero, y que los centros esten en tu alcance.' }} />
          <Boton type="submit" enviando={acc.enviando} disabled={Object.keys(nodos).length < 2 || faltaRol || faltaPapel || !f.v.nombre.trim() || !f.v.fecha_inicio_periodo || !f.v.fecha_fin_periodo}>Crear escenario</Boton>
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
      <Alerta tipo="info" titulo={`Resultado de ${ALGORITMOS[r.algoritmo] || texto(r.algoritmo)}`}>Esta simulación usa los datos guardados del escenario. No crea ni autoriza movimientos.</Alerta>
      <Datos pares={[['Flujo máximo', `${num(r.flujo_maximo)} ${esc.unidad_flujo}`], ...(r.capacidad_corte != null ? [['Capacidad del corte mínimo', `${num(r.capacidad_corte)} ${esc.unidad_flujo}`]] : []),
        ['Periodo', `${fecha(esc.fecha_inicio_periodo)} a ${fecha(esc.fecha_fin_periodo)}`], ['Algoritmo', ALGORITMOS[r.algoritmo] || texto(r.algoritmo)], ...(r.huella_datos ? [['Huella de los datos', <code key="h" style={{ wordBreak: 'break-all' }}>{r.huella_datos}</code>]] : [])]} />
      {r.interpretacion && <p className="ayuda">{r.interpretacion}</p>}
      <h3 style={{ marginTop: '1rem' }}>Grafo</h3>
      <Grafo nodos={esc.nodos} aristas={aristas} nombre={nombre} />
      <p className="nota">Circulo F: fuente. Cuadrado S: sumidero. Circulo I: intermedio. Cada flecha muestra flujo/capacidad. Punteada y con la palabra corte: pertenece al corte mínimo.</p>
      <h3>Tabla de conexiones</h3>
      <Tabla titulo="Resultado por conexión" clave="id_conexion" filas={filas} columnas={[
        { titulo: 'Conexión', ver: (x) => `${nombre(x.origen)} a ${nombre(x.destino)}` },
        { titulo: 'Capacidad considerada', num: true, ver: (x) => num(x.capacidad_considerada) },
        { titulo: 'Flujo asignado', num: true, ver: (x) => num(x.flujo_asignado) },
        { titulo: 'Saturada', ver: (x) => (x.saturada ? 'Si (usa toda su capacidad)' : 'No') },
        { titulo: 'En el corte mínimo', ver: (x) => (x.en_corte_minimo ? 'Si' : 'No') },
      ]} />
      <p className="nota">Una conexión saturada no siempre pertenece al corte mínimo: por eso son dos columnas distintas.</p>
      {(r.ofertas_limitantes?.length > 0 || r.demandas_limitantes?.length > 0) && (
        <p className="nota">{r.ofertas_limitantes?.length ? `Ofertas que limitan: ${r.ofertas_limitantes.map(nombre).join(', ')}. ` : ''}{r.demandas_limitantes?.length ? `Demandas que limitan: ${r.demandas_limitantes.map(nombre).join(', ')}.` : ''}</p>
      )}
    </div>
  );
}

export function EscenarioDetalle({ params }) {
  const { usuario } = useAuth();
  const puedeOperar = tiene(usuario, R_.C);
  const id = params.id;
  const esc = useAsync(() => Api.obtener(id), [id]);
  const centros = useAsync(Admin.centros, []);
  const hist = useAsync(() => Api.ejecuciones(id), [id]);
  const [algoritmo, setAlgoritmo] = useState('EDMONDS_KARP');
  const [resultado, setResultado] = useState(null);
  const [avisoResultado, setAvisoResultado] = useState('');
  const resultadoRef = useRef(null);
  useEffect(() => {
    if (!resultado) return;
    resultadoRef.current?.focus();
  }, [resultado]);
  const calcular = useAccion(async () => {
    setResultado(null); setAvisoResultado('');
    const r = await Api.ejecutar(id, algoritmo);
    setAvisoResultado('creada'); setResultado(r); hist.recargar();
    return r;
  });
  const ver = useAccion(async (ide) => {
    setResultado(null); setAvisoResultado('');
    const r = await Api.ejecucion(id, ide);
    setAvisoResultado('abierta'); setResultado(r);
    return r;
  });
  const estado = useAccion((e) => Api.estado(id, e).then((r) => { esc.recargar(); return r; }));
  return (
    <Pagina titulo={`Escenario ${esc.data?.codigo_escenario || id}`} acciones={<a className="btn btn-sec" href="#/escenarios">Volver</a>}>
      <Carga estado={esc}>{(e) => (<>
        <Seccion titulo={e.nombre} acciones={puedeOperar && e.estado_escenario !== 'ARCHIVADO' && (
          <Boton tipo="secundario" enviando={estado.enviando} onClick={() => estado.ejecutar(e.estado_escenario === 'VIGENTE' ? 'ARCHIVADO' : 'VIGENTE')}>{e.estado_escenario === 'VIGENTE' ? 'Archivar' : 'Marcar vigente'}</Boton>)}>
          <Datos pares={[['Estado', <Estado key="s" valor={e.estado_escenario} />], ['Unidad', e.unidad_flujo], ['Periodo', `${fecha(e.fecha_inicio_periodo)} a ${fecha(e.fecha_fin_periodo)}`], ['Centros', e.nodos.length], ['Conexiones', e.conexiones.length]]} />
          <ErrorApi error={estado.error} ayuda={{ 409: 'Un escenario archivado no cambia de estado.' }} />
        </Seccion>
        <Seccion titulo="Calcular flujo máximo y corte mínimo">
          <Alerta titulo="Cómo comparar los algoritmos">Edmonds-Karp y Ford-Fulkerson deben dar el mismo flujo máximo si usan los mismos datos. Puede cambiar el reparto entre conexiones. Cada cálculo guarda una ejecución; para revisar un resultado, ábrelo en el historial.</Alerta>
          {puedeOperar && <div className="acciones">
            <Select label="Algoritmo" value={algoritmo} disabled={calcular.enviando || ver.enviando} onChange={(ev) => setAlgoritmo(ev.target.value)} vacio="Selecciona..." opciones={Object.entries(ALGORITMOS).map(([valor, texto]) => ({ valor, texto }))} />
            <Boton enviando={calcular.enviando} disabled={!algoritmo || ver.enviando || e.estado_escenario === 'ARCHIVADO'} onClick={() => calcular.ejecutar()}>Calcular y guardar ejecución</Boton>
          </div>}
          {e.estado_escenario === 'ARCHIVADO' && <p className="nota">Este escenario está archivado. Puedes consultar sus ejecuciones anteriores.</p>}
          <ErrorApi error={calcular.error || ver.error} />
          {resultado && <div ref={resultadoRef} tabIndex={-1} className="resultado-aviso">
            <Alerta tipo="exito" titulo={`Ejecución #${resultado.id_ejecucion} ${avisoResultado}`}>{ALGORITMOS[resultado.algoritmo] || texto(resultado.algoritmo)}: flujo máximo de {num(resultado.flujo_maximo)} {e.unidad_flujo}. {avisoResultado === 'creada' ? 'El resultado ya está guardado y se muestra a continuación.' : 'Se muestra el resultado guardado, sin crear otra ejecución.'}</Alerta>
          </div>}
          <Carga estado={centros}>{(cs) => (resultado ? <Resultado esc={e} centros={cs} r={resultado} /> : <p className="nota">{calcular.enviando || ver.enviando ? 'Cargando el resultado…' : 'Todavía no hay un resultado en pantalla. Calcula o abre una ejecución anterior.'}</p>)}</Carga>
        </Seccion>
        <Seccion titulo="Ejecuciones anteriores">
          <Carga estado={hist} vacio="Aún no se ha calculado este escenario.">{(h) => (
            <Tabla titulo="Ejecuciones" clave="id_ejecucion" filas={[...h].sort((a, b) => String(b.fecha_hora_ejecucion).localeCompare(String(a.fecha_hora_ejecucion)) || b.id_ejecucion - a.id_ejecucion)} columnas={[
              { titulo: 'Ejecucion', ver: (x) => `#${x.id_ejecucion}` }, { titulo: 'Fecha', ver: (x) => fechaHora(x.fecha_hora_ejecucion) },
              { titulo: 'Algoritmo', ver: (x) => ALGORITMOS[x.algoritmo] || texto(x.algoritmo) }, { titulo: 'Flujo máximo', num: true, ver: (x) => num(x.flujo_maximo) }, { titulo: 'Estado', ver: (x) => <Estado valor={x.estado_ejecucion} /> },
              { titulo: 'Ver', ver: (x) => <button type="button" className="btn btn-sec btn-chico" disabled={ver.enviando || calcular.enviando} aria-label={`Abrir ejecución ${x.id_ejecucion} de ${ALGORITMOS[x.algoritmo] || texto(x.algoritmo)}`} onClick={() => ver.ejecutar(x.id_ejecucion)}>{resultado?.id_ejecucion === x.id_ejecucion ? 'Volver a abrir' : 'Abrir'}</button> },
            ]} />
          )}</Carga>
        </Seccion>
      </>)}</Carga>
    </Pagina>
  );
}
