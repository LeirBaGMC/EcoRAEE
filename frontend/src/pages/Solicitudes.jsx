import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Dispositivos, Lotes } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fechaHora, hoyISO, texto } from '../lib/format.js';
import { R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Carga, Casilla, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

function NuevaSolicitud({ alCrear }) {
  const disp = useAsync(() => Dispositivos.listar(1, 100, 'REGISTRADO'), []);
  const [elegidos, setElegidos] = useState([]);
  const [lote, setLote] = useState(null); // el lote se crea una sola vez; si la solicitud falla, se reintenta solo la solicitud
  const f = useForm({ modalidad: 'RECOLECCION', zona_referencial: '' });
  const crearLote = useAccion((ids) => Lotes.crear(ids));
  const crearSol = useAccion((b) => Lotes.crearSolicitud(b));
  const [hecho, setHecho] = useState(null);

  const alternar = (id) => setElegidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const enviar = async (e) => {
    e.preventDefault();
    let l = lote;
    if (!l) {
      l = await crearLote.ejecutar(elegidos);
      if (!l) return;
      setLote(l);
    }
    const s = await crearSol.ejecutar({ id_lote: l.id_lote, modalidad: f.v.modalidad, zona_referencial: f.v.zona_referencial.trim() });
    if (s) { setHecho({ lote: l, solicitud: s }); setLote(null); setElegidos([]); f.reiniciar(); disp.recargar(); alCrear(); }
  };
  return (
    <Seccion titulo="Nueva solicitud" ayuda="Elige dispositivos registrados para formar un lote y pide su recoleccion o entrega directa.">
      {hecho && <Alerta tipo="exito" titulo="Solicitud creada">Lote {hecho.lote.codigo_lote} con {hecho.lote.total_dispositivos} dispositivo(s). Solicitud {hecho.solicitud.codigo_solicitud}, estado {texto(hecho.solicitud.estado_solicitud)}.</Alerta>}
      <Carga estado={disp} vacio="No tienes dispositivos en estado Registrado. Registra uno primero.">{(d) => (
        <form onSubmit={enviar} noValidate>
          <fieldset className="lista-check" disabled={!!lote}>
            <legend>Dispositivos registrados ({elegidos.length} elegido(s))</legend>
            {d.items.map((x) => <Casilla key={x.id_dispositivo} label={`${x.codigo_trazabilidad} - ${[x.marca, x.modelo].filter(Boolean).join(' ') || texto(x.tipo_registro)}`} checked={elegidos.includes(x.id_dispositivo)} onChange={() => alternar(x.id_dispositivo)} />)}
          </fieldset>
          {lote && <Alerta tipo="aviso">El lote {lote.codigo_lote} ya se creo. Falta crear la solicitud: reintenta sin volver a elegir equipos.</Alerta>}
          <div className="form-rejilla">
            <Select label="Modalidad" requerido vacio="Selecciona..." opciones={[{ valor: 'RECOLECCION', texto: 'Recoleccion' }, { valor: 'ENTREGA_DIRECTA', texto: 'Entrega directa en el centro' }]} {...f.enlazar('modalidad')} errorApi={crearSol.error} />
            <Input label="Zona referencial" requerido {...f.enlazar('zona_referencial')} errorApi={crearSol.error} />
          </div>
          <ErrorApi error={crearLote.error} />
          <ErrorApi error={crearSol.error} />
          <Boton type="submit" enviando={crearLote.enviando || crearSol.enviando} disabled={(!lote && elegidos.length === 0) || !f.v.zona_referencial.trim()}>{lote ? 'Reintentar solicitud' : 'Crear lote y solicitud'}</Boton>
        </form>
      )}</Carga>
    </Seccion>
  );
}

function FilaAcciones({ s, alCambiar }) {
  const [fechaProg, setFechaProg] = useState(hoyISO());
  const prog = useAccion((id, fch) => Lotes.programarRecoleccion(id, fch));
  const ejec = useAccion((id) => Lotes.ejecutarRecoleccion(id));
  if (s.modalidad !== 'RECOLECCION') return <span className="nota">Entrega directa</span>;
  return (
    <div>
      {s.estado_solicitud === 'PENDIENTE' && (
        <div className="acciones">
          <input type="date" aria-label={`Fecha de recoleccion de ${s.codigo_solicitud}`} min={hoyISO()} value={fechaProg} onChange={(e) => setFechaProg(e.target.value)} />
          <Boton tipo="secundario" className="btn btn-sec btn-chico" enviando={prog.enviando} onClick={async () => { if (await prog.ejecutar(s.id_solicitud, fechaProg)) alCambiar(); }}>Programar</Boton>
        </div>
      )}
      {s.estado_solicitud === 'PROGRAMADA' && <Boton tipo="secundario" className="btn btn-sec btn-chico" enviando={ejec.enviando} onClick={async () => { if (await ejec.ejecutar(s.id_solicitud)) alCambiar(); }}>Marcar recolectado</Boton>}
      <ErrorApi error={prog.error || ejec.error} ayuda={{ 409: 'Ya estaba programada o cambio de estado. Actualiza la lista.' }} />
    </div>
  );
}

export default function Solicitudes() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const lista = useAsync(() => Lotes.listarSolicitudes(pagina, 20, estado || undefined), [pagina, estado]);
  const esCoord = tiene(usuario, R_.C);
  return (
    <Pagina titulo="Lotes y solicitudes" ayuda="El generador pide la recoleccion. El coordinador la programa y confirma que se recolecto. El centro recibe despues.">
      {tiene(usuario, R_.G) && <NuevaSolicitud alCrear={lista.recargar} />}
      <Seccion titulo="Solicitudes">
        <Select label="Filtrar por estado" value={estado} vacio="Todos" onChange={(e) => { setEstado(e.target.value); setPagina(1); }} opciones={['PENDIENTE', 'PROGRAMADA', 'RECIBIDA'].map((x) => ({ valor: x, texto: texto(x) }))} />
        <Carga estado={lista} vacio="No hay solicitudes.">{(d) => (<>
          <Tabla titulo="Solicitudes" clave="id_solicitud" filas={d.items} columnas={[
            { titulo: 'Solicitud', ver: (f) => `${f.codigo_solicitud} (#${f.id_solicitud})` },
            { titulo: 'Lote', ver: (f) => `#${f.id_lote}` },
            { titulo: 'Modalidad', ver: (f) => texto(f.modalidad) },
            { titulo: 'Zona', campo: 'zona_referencial' },
            { titulo: 'Estado', ver: (f) => <Estado valor={f.estado_solicitud} /> },
            { titulo: 'Fecha', ver: (f) => fechaHora(f.fecha_solicitud) },
            ...(esCoord ? [{ titulo: 'Recoleccion', ver: (f) => <FilaAcciones s={f} alCambiar={lista.recargar} /> }] : []),
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}
