import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Dispositivos as Api, Ciclo } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { useCatalogos } from '../lib/catalogos.js';
import { fechaHora, texto } from '../lib/format.js';
import { ir } from '../lib/router.jsx';
import { tiene, R_ } from '../lib/permisos.js';
import { Alerta, Area, Boton, Carga, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

export const ESTADOS_DISPOSITIVO = ['REGISTRADO', 'EN_RECOLECCION', 'RECIBIDO', 'EVALUADO', 'EN_TRANSITO', 'EN_TRATAMIENTO', 'REACONDICIONADO', 'ASIGNADO', 'CERRADO'];
const CONDICIONES = [['ENCIENDE', 'Enciende'], ['NO_ENCIENDE', 'No enciende'], ['DANO_FISICO', 'Dano físico'], ['INCOMPLETO', 'Incompleto']].map(([valor, t]) => ({ valor, texto: t }));

export function Dispositivos() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const est = useAsync(() => Api.listar(pagina, 20, estado || undefined), [pagina, estado]);
  const puedeRegistrar = tiene(usuario, R_.G, R_.O);
  return (
    <Pagina titulo="Dispositivos" ayuda="Equipos dentro de tu alcance. El estado indica en que parte del proceso va cada uno."
      acciones={puedeRegistrar && <a className="btn btn-pri" href="#/dispositivos/nuevo">Registrar dispositivo</a>}>
      <Seccion titulo="Listado">
        <Select label="Filtrar por estado" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}
          vacio="Todos los estados" opciones={ESTADOS_DISPOSITIVO.map((x) => ({ valor: x, texto: texto(x) }))} />
        <Carga estado={est} vacio="No hay dispositivos con ese filtro.">
          {(d) => (<>
            <Tabla titulo="Dispositivos" clave="id_dispositivo" filas={d.items} columnas={[
              { titulo: 'Código', ver: (f) => <a href={`#/dispositivos/${f.id_dispositivo}`}>{f.codigo_trazabilidad}</a> },
              { titulo: 'Tipo', ver: (f) => texto(f.tipo_registro) },
              { titulo: 'Equipo', ver: (f) => [f.marca, f.modelo].filter(Boolean).join(' ') || '-' },
              { titulo: 'Condición declarada', ver: (f) => texto(f.condicion_declarada) },
              { titulo: 'Estado', ver: (f) => <Estado valor={f.estado_actual} /> },
              { titulo: 'Centro', ver: (f) => f.nombre_centro || '-' },
              { titulo: 'Registrado', ver: (f) => fechaHora(f.fecha_registro) },
            ]} />
            <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
          </>)}
        </Carga>
      </Seccion>
    </Pagina>
  );
}

export function DispositivoNuevo() {
  const cat = useCatalogos();
  const f = useForm({ tipo_registro: 'INDIVIDUAL', id_categoria: '', condicion_declarada: 'ENCIENDE', marca: '', modelo: '', numero_serie: '', peso_kg: '', cantidad_unidades: '' });
  const [creado, setCreado] = useState(null);
  const acc = useAccion(Api.registrar);
  const granel = f.v.tipo_registro === 'GRANEL';
  const enviar = async (e) => {
    e.preventDefault();
    const b = { tipo_registro: f.v.tipo_registro, id_categoria: Number(f.v.id_categoria), condicion_declarada: f.v.condicion_declarada };
    if (granel) { b.peso_kg = f.v.peso_kg; b.cantidad_unidades = Number(f.v.cantidad_unidades); }
    else { b.numero_serie = f.v.numero_serie.trim(); if (f.v.marca) b.marca = f.v.marca; if (f.v.modelo) b.modelo = f.v.modelo; }
    const r = await acc.ejecutar(b);
    if (r) setCreado(r);
  };
  return (
    <Pagina titulo="Registrar dispositivo" ayuda="Un equipo individual lleva número de serie. Un registro a granel lleva peso y cantidad, sin serie.">
      {creado && (
        <Alerta tipo="exito" titulo="Dispositivo registrado" accion={<p><a href={`#/dispositivos/${creado.id_dispositivo}`}>Ver {creado.codigo_trazabilidad}</a> o registra otro abajo.</p>}>
          Codigo de trazabilidad {creado.codigo_trazabilidad}, estado {texto(creado.estado)}.
        </Alerta>
      )}
      <Seccion titulo="Datos del equipo">
        <Carga estado={cat}>{(c) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Select label="Tipo de registro" requerido opciones={[{ valor: 'INDIVIDUAL', texto: 'Individual (con serie)' }, { valor: 'GRANEL', texto: 'A granel (peso y cantidad)' }]} vacio="Selecciona..." {...f.enlazar('tipo_registro')} errorApi={acc.error} />
              <Select label="Categoría" requerido opciones={c.categorias.map((x) => ({ valor: x.id_categoria, texto: x.nombre_categoria }))} {...f.enlazar('id_categoria')} errorApi={acc.error} />
              <Select label="Condición declarada" requerido opciones={CONDICIONES} {...f.enlazar('condicion_declarada')} errorApi={acc.error} />
              {!granel && <>
                <Input label="Número de serie" requerido {...f.enlazar('numero_serie')} errorApi={acc.error} />
                <Input label="Marca" {...f.enlazar('marca')} errorApi={acc.error} />
                <Input label="Modelo" {...f.enlazar('modelo')} errorApi={acc.error} />
              </>}
              {granel && <>
                <Input label="Peso total (kg)" type="number" step="0.001" min="0" requerido {...f.enlazar('peso_kg')} errorApi={acc.error} />
                <Input label="Cantidad de unidades" type="number" step="1" min="1" requerido {...f.enlazar('cantidad_unidades')} errorApi={acc.error} />
              </>}
            </div>
            <ErrorApi error={acc.error} ayuda={{ 409: 'Ese número de serie ya existe.' }} />
            <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_categoria}>Registrar</Boton>
          </form>
        )}</Carga>
      </Seccion>
    </Pagina>
  );
}

function Evaluar({ id, alTerminar }) {
  const cat = useCatalogos();
  const f = useForm({ condicion_constatada: 'ENCIENDE', diagnostico: '', id_clasificacion: '' });
  const acc = useAccion((b) => Api.evaluar(id, b));
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ condicion_constatada: f.v.condicion_constatada, diagnostico: f.v.diagnostico.trim(), id_clasificacion: Number(f.v.id_clasificacion) });
    if (r) { f.reiniciar(); alTerminar(); }
  };
  return (
    <Seccion titulo="Registrar evaluación técnica" ayuda="Solo el técnico evaluador clasifica. Una reevaluacion no se permite mientras el dispositivo tenga un movimiento activo.">
      <Carga estado={cat}>{(c) => (
        <form onSubmit={enviar} noValidate>
          <div className="form-rejilla">
            <Select label="Condición constatada" requerido opciones={CONDICIONES} {...f.enlazar('condicion_constatada')} errorApi={acc.error} />
            <Select label="Clasificación técnica" requerido opciones={c.clasificaciones.map((x) => ({ valor: x.id_clasificacion, texto: `${texto(x.nombre_clasificacion)}${x.permite_asignacion ? '' : ' (no se asigna a beneficiarios)'}` }))} {...f.enlazar('id_clasificacion')} errorApi={acc.error} />
          </div>
          <Area label="Diagnostico" requerido {...f.enlazar('diagnostico')} errorApi={acc.error} />
          <ErrorApi error={acc.error} ayuda={{ 409: 'Si hay un movimiento programado o autorizado, anulalo primero desde Movimientos.' }} />
          {acc.ok && !acc.error && <Alerta tipo="exito">Evaluacion {acc.ok.nro_evaluacion} guardada. Clasificacion {texto(acc.ok.clasificacion)}, estado {texto(acc.ok.estado_actual)}.</Alerta>}
          <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_clasificacion || !f.v.diagnostico.trim()}>Guardar evaluación</Boton>
        </form>
      )}</Carga>
    </Seccion>
  );
}

export function DispositivoDetalle({ params }) {
  const { usuario } = useAuth();
  const id = params.id;
  const det = useAsync(() => Api.obtener(id), [id]);
  const hist = useAsync(() => Api.historial(id), [id]);
  const cierre = useAsync(() => Api.cierre(id).catch((e) => (e.status === 404 ? null : Promise.reject(e))), [id]);
  const recargar = () => { det.recargar(); hist.recargar(); cierre.recargar(); };
  return (
    <Pagina titulo={`Dispositivo ${det.data?.codigo_trazabilidad || id}`} acciones={<a className="btn btn-sec" href="#/dispositivos">Volver al listado</a>}>
      <Seccion titulo="Datos">
        <Carga estado={det}>{(d) => (<>
          <Datos pares={[
            ['Código', d.codigo_trazabilidad], ['Tipo', texto(d.tipo_registro)], ['Marca', d.marca], ['Modelo', d.modelo],
            ['Condición declarada', texto(d.condicion_declarada)], ['Estado actual', <Estado key="e" valor={d.estado_actual} />],
            ['Centro actual', d.nombre_centro], ['Registrado', fechaHora(d.fecha_registro)],
          ]} />
          <Acciones d={d} usuario={usuario} />
        </>)}</Carga>
      </Seccion>
      <Seccion titulo="Historial de estados" ayuda="Historial de negocio, en orden. No incluye los registros tecnicos del sistema.">
        <Carga estado={hist} vacio="Sin cambios de estado todavia.">{(h) => (
          <ol className="linea-tiempo">{h.map((x) => (
            <li key={x.nro_cambio}><strong>{x.estado_anterior ? `${texto(x.estado_anterior)} a ` : 'Inicio: '}{texto(x.estado_nuevo)}</strong>
              <small>{fechaHora(x.fecha_hora)} - usuario {x.id_usuario}{x.observacion ? ` - ${x.observacion}` : ''}</small></li>
          ))}</ol>
        )}</Carga>
      </Seccion>
      <Seccion titulo="Cierre de trazabilidad">
        <Carga estado={cierre}>{(c) => (c
          ? <Datos pares={[['Destino final', texto(c.destino_final)], ['Fecha confirmada', c.fecha_confirmacion], ['Cierre', c.id_cierre]]} />
          : <p className="nota">Todavia no se ha cerrado.</p>)}</Carga>
      </Seccion>
      {tiene(usuario, R_.T) && det.data && ['RECIBIDO', 'EVALUADO'].includes(det.data.estado_actual) && <Evaluar id={id} alTerminar={recargar} />}
    </Pagina>
  );
}

// Enlaces a las acciones que el proceso permite segun estado y rol. El backend decide al final.
function Acciones({ d, usuario }) {
  const e = d.estado_actual;
  const a = [];
  if (tiene(usuario, R_.C) && ['EVALUADO', 'REACONDICIONADO'].includes(e)) a.push(<a key="m" className="btn btn-sec" href="#/movimientos/nuevo">Programar movimiento</a>);
  if (tiene(usuario, R_.C) && ['EVALUADO', 'REACONDICIONADO'].includes(e)) a.push(<a key="a" className="btn btn-sec" href="#/asignaciones">Asignar a beneficiario</a>);
  if (tiene(usuario, R_.R) && ['EVALUADO', 'EN_TRATAMIENTO'].includes(e)) a.push(<a key="t" className="btn btn-sec" href="#/tratamientos">Ir a tratamientos</a>);
  if (tiene(usuario, R_.C) && ['EN_TRATAMIENTO', 'ASIGNADO', 'REACONDICIONADO', 'EVALUADO'].includes(e)) a.push(<a key="c" className="btn btn-sec" href="#/cierres">Cerrar trazabilidad</a>);
  if (!a.length) return null;
  return <div className="acciones" style={{ marginTop: '1rem' }}>{a}</div>;
}
export { ir };
