import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Admin, Dispositivos, Movimientos as Api } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fecha, fechaHora, hoyISO, num, texto, uuid } from '../lib/format.js';
import { R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Carga, Casilla, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';
import { ListaEvidencias, SubirEvidencia } from './Evidencias.jsx';

const ESTADOS = ['PROGRAMADO', 'AUTORIZADO', 'EN_TRANSITO', 'CERRADO', 'ANULADO'];
const TIPOS = [['TRANSFERENCIA', 'Transferencia entre centros'], ['ENVIO_TRATAMIENTO', 'Envio a tratamiento'], ['ENTREGA_BENEFICIARIO', 'Entrega a beneficiario']].map(([valor, t]) => ({ valor, texto: t }));

export function Movimientos() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const lista = useAsync(() => Api.listar(pagina, 20, estado || undefined), [pagina, estado]);
  return (
    <Pagina titulo="Movimientos" ayuda="Traslados entre centros. Un calculo de red nunca crea un movimiento: aqui se registran los reales."
      acciones={tiene(usuario, R_.C) && <a className="btn btn-pri" href="#/movimientos/nuevo">Programar movimiento</a>}>
      <Seccion titulo="Listado">
        <Select label="Filtrar por estado" value={estado} vacio="Todos" onChange={(e) => { setEstado(e.target.value); setPagina(1); }} opciones={ESTADOS.map((x) => ({ valor: x, texto: texto(x) }))} />
        <Carga estado={lista} vacio="No hay movimientos.">{(d) => (<>
          <Tabla titulo="Movimientos" clave="id_movimiento" filas={d.items} columnas={[
            { titulo: 'Codigo', ver: (f) => <a href={`#/movimientos/${f.id_movimiento}`}>{f.codigo_movimiento}</a> },
            { titulo: 'Tipo', ver: (f) => texto(f.tipo_movimiento) },
            { titulo: 'Estado', ver: (f) => <Estado valor={f.estado_movimiento} /> },
            { titulo: 'Conexion', ver: (f) => `#${f.id_conexion}` },
            { titulo: 'Despacho planificado', ver: (f) => fecha(f.fecha_despacho) },
            { titulo: 'Cantidad', num: true, ver: (f) => (f.cantidad != null ? `${num(f.cantidad)} ${f.unidad || ''}` : '-') },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

export function MovimientoNuevo() {
  const base = useAsync(async () => {
    const [con, cen, ev, re] = await Promise.all([Admin.conexiones(), Admin.centros(), Dispositivos.listar(1, 100, 'EVALUADO'), Dispositivos.listar(1, 100, 'REACONDICIONADO')]);
    return { con: con.filter((c) => c.activa), cen, disp: [...ev.items, ...re.items] };
  }, []);
  const f = useForm({ id_conexion: '', tipo_movimiento: 'TRANSFERENCIA', fecha_despacho: hoyISO() });
  const [elegidos, setElegidos] = useState({}); // id -> peso opcional
  const [hecho, setHecho] = useState(null);
  const clave = useRef({ huella: '', key: '' });
  const acc = useAccion((b, k) => Api.programar(b, k));

  const alternar = (id) => setElegidos((x) => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = ''; return n; });
  const enviar = async (e, con) => {
    e.preventDefault();
    const dispositivos = Object.entries(elegidos).map(([id, peso]) => ({ id_dispositivo: Number(id), ...(peso ? { peso_despachado_kg: peso } : {}) }))
      .sort((a, b) => a.id_dispositivo - b.id_dispositivo);
    const body = { id_conexion: Number(f.v.id_conexion), tipo_movimiento: f.v.tipo_movimiento, fecha_despacho: f.v.fecha_despacho, dispositivos };
    // La misma clave se reutiliza solo si los datos son identicos (reintento seguro). Si cambian, clave nueva.
    const huella = JSON.stringify(body);
    if (clave.current.huella !== huella) clave.current = { huella, key: uuid() };
    const r = await acc.ejecutar(body, clave.current.key);
    if (r) { setHecho(r); clave.current = { huella: '', key: '' }; setElegidos({}); base.recargar(); }
  };

  return (
    <Pagina titulo="Programar movimiento" ayuda="Elige la conexion y los dispositivos. El sistema reserva capacidad del periodo al programar."
      acciones={<a className="btn btn-sec" href="#/movimientos">Volver</a>}>
      {hecho && (
        <Alerta tipo="exito" titulo={hecho.repetido ? 'Ya estaba registrado' : 'Movimiento programado'} accion={<p><a href={`#/movimientos/${hecho.id_movimiento}`}>Abrir {hecho.codigo_movimiento}</a></p>}>
          {hecho.repetido ? 'Es el mismo movimiento de un envio anterior: no se duplico. ' : ''}
          Estado {texto(hecho.estado_movimiento)}. Cantidad {num(hecho.cantidad)} {hecho.unidad || ''}. Capacidad restante del periodo: {num(hecho.capacidad_restante_periodo)} {hecho.unidad || ''}.
        </Alerta>
      )}
      <Carga estado={base}>{(b) => {
        const con = b.con.find((c) => String(c.id_conexion) === String(f.v.id_conexion));
        const nombre = (id) => b.cen.find((c) => c.id_centro === id)?.nombre || `Centro ${id}`;
        const enOrigen = con ? b.disp.filter((d) => d.id_centro === con.id_centro_origen) : [];
        return (
          <form onSubmit={(e) => enviar(e, con)} noValidate>
            <Seccion titulo="Ruta y fecha">
              <div className="form-rejilla">
                <Select label="Conexion (origen a destino)" requerido value={f.v.id_conexion} onChange={(e) => { f.set('id_conexion', e.target.value); setElegidos({}); }}
                  opciones={b.con.map((c) => ({ valor: c.id_conexion, texto: `${nombre(c.id_centro_origen)} a ${nombre(c.id_centro_destino)} - ${num(c.capacidad_por_periodo)} ${c.unidad_capacidad} por periodo` }))} errorApi={acc.error} name="id_conexion" />
                <Select label="Tipo de movimiento" requerido vacio="Selecciona..." opciones={TIPOS} {...f.enlazar('tipo_movimiento')} errorApi={acc.error} />
                <Input label="Fecha planificada de despacho" type="date" min={hoyISO()} requerido {...f.enlazar('fecha_despacho')} errorApi={acc.error} ayuda="La capacidad se mide por mes calendario de esta fecha (propuesta pendiente de validar)." />
              </div>
              {con && <p className="nota">La capacidad de esta conexion se mide en {con.unidad_capacidad === 'KG' ? 'kilogramos (usa el peso de cada dispositivo)' : 'unidades (1 por dispositivo)'}.</p>}
            </Seccion>
            <Seccion titulo={`Dispositivos en el centro de origen (${Object.keys(elegidos).length} elegido(s))`} ayuda="Solo se muestran equipos evaluados o reacondicionados que estan en el centro de origen.">
              {!con ? <p className="nota">Elige primero la conexion.</p> : enOrigen.length === 0 ? <Alerta tipo="aviso">No hay dispositivos movibles en {nombre(con.id_centro_origen)}.</Alerta> : (
                <div className="lista-check">
                  {enOrigen.map((d) => (
                    <div key={d.id_dispositivo} className="acciones">
                      <Casilla label={`${d.codigo_trazabilidad} - ${texto(d.estado_actual)}`} checked={d.id_dispositivo in elegidos} onChange={() => alternar(d.id_dispositivo)} />
                      {con.unidad_capacidad === 'KG' && d.id_dispositivo in elegidos && (
                        <input type="number" min="0" step="0.001" aria-label={`Peso a despachar de ${d.codigo_trazabilidad} en kg (opcional)`} placeholder="Peso kg (opcional)" value={elegidos[d.id_dispositivo]} onChange={(e) => setElegidos((x) => ({ ...x, [d.id_dispositivo]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Seccion>
            <ErrorApi error={acc.error} ayuda={{ 409: 'Alguno de los dispositivos ya esta en otro movimiento activo, o la clave de reintento se uso con datos distintos. Actualiza y revisa.', 422: 'Una regla no se cumplio: capacidad del periodo, fecha pasada, centro de destino o clasificacion.' }} />
            <Boton type="submit" enviando={acc.enviando} disabled={!con || Object.keys(elegidos).length === 0 || !f.v.fecha_despacho}>Programar movimiento</Boton>
          </form>
        );
      }}</Carga>
    </Pagina>
  );
}

function Paso({ texto: t, tipo = 'primario', pedirConfirmacion, onHacer }) {
  const [seguro, setSeguro] = useState(false);
  const acc = useAccion(onHacer);
  return (
    <div>
      {!seguro || !pedirConfirmacion
        ? <Boton tipo={tipo} enviando={acc.enviando} onClick={() => (pedirConfirmacion ? setSeguro(true) : acc.ejecutar())}>{t}</Boton>
        : (<div className="acciones"><span>Seguro que quieres continuar?</span>
          <Boton tipo="peligro" enviando={acc.enviando} onClick={async () => { await acc.ejecutar(); setSeguro(false); }}>Si, {t.toLowerCase()}</Boton>
          <Boton tipo="secundario" onClick={() => setSeguro(false)}>No</Boton></div>)}
      <ErrorApi error={acc.error} ayuda={{ 409: 'El movimiento cambio de estado. Actualiza la pantalla.', 422: 'El proceso no permite esta accion ahora.' }} />
    </div>
  );
}

export function MovimientoDetalle({ params }) {
  const { usuario } = useAuth();
  const id = params.id;
  const det = useAsync(() => Api.obtener(id), [id]);
  const [conformes, setConformes] = useState({});
  const [version, setVersion] = useState(0);
  const refrescar = () => det.recargar();
  const esC = tiene(usuario, R_.C), esO = tiene(usuario, R_.O);
  return (
    <Pagina titulo={`Movimiento ${det.data?.codigo_movimiento || id}`} acciones={<a className="btn btn-sec" href="#/movimientos">Volver al listado</a>}>
      <Carga estado={det}>{(m) => {
        const e = m.estado_movimiento;
        const cerrar = () => Api.cerrar(id, m.dispositivos.map((d) => ({ id_dispositivo: d.id_dispositivo, conforme: conformes[d.id_dispositivo] !== false }))).then((r) => { refrescar(); return r; });
        return (<>
          <Seccion titulo="Resumen">
            <Datos pares={[
              ['Estado', <Estado key="e" valor={e} />], ['Tipo', texto(m.tipo_movimiento)], ['Origen (centro)', m.id_centro_origen], ['Destino (centro)', m.id_centro_destino],
              ['Responsable (usuario)', m.id_responsable], ['Despacho planificado', fecha(m.fecha_despacho)], ['Recepcion', fechaHora(m.fecha_recepcion)],
              ['Cantidad', m.cantidad != null ? `${num(m.cantidad)} ${m.unidad || ''}` : '-'],
            ]} />
          </Seccion>
          <Seccion titulo="Dispositivos">
            <Tabla titulo="Dispositivos del movimiento" clave="id_dispositivo" filas={m.dispositivos} columnas={[
              { titulo: 'Dispositivo', ver: (d) => <a href={`#/dispositivos/${d.id_dispositivo}`}>#{d.id_dispositivo}</a> },
              { titulo: 'Peso despachado (kg)', num: true, ver: (d) => num(d.peso_despachado_kg) },
              { titulo: 'Conforme al recibir', ver: (d) => (e === 'CERRADO' ? (d.conforme === null ? '-' : d.conforme ? 'Si' : 'No') : (e === 'EN_TRANSITO' && esC ? <Casilla label="Conforme" checked={conformes[d.id_dispositivo] !== false} onChange={(ev) => setConformes((x) => ({ ...x, [d.id_dispositivo]: ev.target.checked }))} /> : 'Pendiente')) },
            ]} />
          </Seccion>
          <Seccion titulo="Acciones" ayuda="Solo aparecen las que el proceso permite en este estado para tu rol.">
            <div className="acciones">
              {e === 'PROGRAMADO' && esC && <Paso texto="Autorizar" onHacer={() => Api.autorizar(id).then(refrescar)} />}
              {['PROGRAMADO', 'AUTORIZADO'].includes(e) && esC && <Paso texto="Anular" tipo="peligro" pedirConfirmacion onHacer={() => Api.anular(id).then(refrescar)} />}
              {e === 'AUTORIZADO' && esO && <Paso texto="Despachar" onHacer={() => Api.despachar(id).then(refrescar)} />}
              {e === 'EN_TRANSITO' && esC && <Paso texto="Cerrar movimiento" onHacer={cerrar} />}
            </div>
            {['CERRADO', 'ANULADO'].includes(e) && <p className="nota">Este movimiento ya termino.</p>}
            {e === 'EN_TRANSITO' && <Alerta tipo="info">Para cerrar hace falta la guia de traslado (abajo). El cierre mueve el inventario del origen al destino en una sola operacion.</Alerta>}
          </Seccion>
          {tiene(usuario, R_.O, R_.T, R_.C) && ['AUTORIZADO', 'EN_TRANSITO'].includes(e) && (
            <Seccion titulo="Subir guia de traslado"><SubirEvidencia destino={{ id_movimiento: id }} tipos={['GUIA_TRASLADO']} alSubir={() => setVersion((x) => x + 1)} /></Seccion>
          )}
          {tiene(usuario, R_.T, R_.C, R_.A) && (
            <Seccion titulo="Evidencias del movimiento"><ListaEvidencias key={version} destino={{ id_movimiento: id }} propositoInicial="VERIFICACION_CIERRE" /></Seccion>
          )}
        </>);
      }}</Carga>
    </Pagina>
  );
}
