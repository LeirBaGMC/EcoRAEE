import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Admin, Ciclo, Dispositivos } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fecha, fechaHora, hoyISO, texto } from '../lib/format.js';
import { R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Carga, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

const TRATAMIENTOS = [['REACONDICIONAMIENTO', 'Reacondicionamiento (equipos reutilizables o reparables)'], ['RECICLAJE', 'Reciclaje (reciclables o no recuperables)'], ['DISPOSICION_CONTROLADA', 'Disposicion controlada (solo no recuperables)']].map(([valor, t]) => ({ valor, texto: t }));

async function dispositivosEn(estados) {
  const r = await Promise.all(estados.map((e) => Dispositivos.listar(1, 100, e)));
  return r.flatMap((x) => x.items);
}

function Tratamiento({ t, alCambiar }) {
  const fin = useAccion((resultado) => Ciclo.finalizarTratamiento(t.id_tratamiento, resultado));
  const enCurso = !t.fecha_fin;
  return (
    <div>
      <Datos pares={[['Tratamiento', `#${t.id_tratamiento}`], ['Dispositivo', <a key="d" href={`#/dispositivos/${t.id_dispositivo}`}>#{t.id_dispositivo}</a>], ['Tipo', texto(t.tipo_tratamiento)], ['Resultado', <Estado key="r" valor={t.resultado} />], ['Inicio', fechaHora(t.fecha_inicio)], ['Fin', fechaHora(t.fecha_fin)]]} />
      {enCurso && (
        <div className="acciones" style={{ marginTop: '.75rem' }}>
          <Boton enviando={fin.enviando} onClick={async () => { if (await fin.ejecutar('EXITOSO')) alCambiar(); }}>Finalizar con exito</Boton>
          <Boton tipo="peligro" enviando={fin.enviando} onClick={async () => { if (await fin.ejecutar('FALLIDO')) alCambiar(); }}>Finalizar como fallido</Boton>
        </div>
      )}
      <ErrorApi error={fin.error} ayuda={{ 409: 'Este tratamiento ya estaba finalizado.' }} />
    </div>
  );
}

export function Tratamientos() {
  const disp = useAsync(() => dispositivosEn(['EVALUADO', 'EN_TRATAMIENTO']), []);
  const f = useForm({ id_dispositivo: '', tipo_tratamiento: '' });
  const ini = useAccion(Ciclo.iniciarTratamiento);
  const [actual, setActual] = useState(null);
  const [numero, setNumero] = useState('');
  const buscar = useAccion((id) => Ciclo.tratamiento(id).then((r) => { setActual(r); return r; }));
  const enviar = async (e) => {
    e.preventDefault();
    const r = await ini.ejecutar({ id_dispositivo: Number(f.v.id_dispositivo), tipo_tratamiento: f.v.tipo_tratamiento });
    if (r) { setActual(r); disp.recargar(); }
  };
  return (
    <Pagina titulo="Tratamientos" ayuda="Inicia el tratamiento de un equipo evaluado y registra su resultado. El destino final se cierra despues en Cierre de trazabilidad.">
      <Seccion titulo="Iniciar tratamiento">
        <Carga estado={disp} vacio="No hay dispositivos evaluados disponibles para tratamiento.">{(lista) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Select label="Dispositivo" requerido opciones={lista.map((d) => ({ valor: d.id_dispositivo, texto: `${d.codigo_trazabilidad} - ${texto(d.estado_actual)}` }))} {...f.enlazar('id_dispositivo')} errorApi={ini.error} />
              <Select label="Tipo de tratamiento" requerido opciones={TRATAMIENTOS} {...f.enlazar('tipo_tratamiento')} errorApi={ini.error} />
            </div>
            <ErrorApi error={ini.error} ayuda={{ 422: 'El tipo de tratamiento no corresponde a la clasificacion tecnica del equipo.' }} />
            <Boton type="submit" enviando={ini.enviando} disabled={!f.v.id_dispositivo || !f.v.tipo_tratamiento}>Iniciar tratamiento</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Seccion titulo="Consultar o finalizar por numero" ayuda="El sistema aun no lista tratamientos: usa el numero que recibiste al iniciarlo.">
        <div className="acciones">
          <Input label="Numero de tratamiento" type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Boton tipo="secundario" enviando={buscar.enviando} disabled={!numero} onClick={() => buscar.ejecutar(numero)}>Consultar</Boton>
        </div>
        <ErrorApi error={buscar.error} />
        {actual && <Tratamiento key={`${actual.id_tratamiento}-${actual.fecha_fin}`} t={actual} alCambiar={() => buscar.ejecutar(actual.id_tratamiento)} />}
      </Seccion>
    </Pagina>
  );
}

function NuevaAsignacion({ alCrear }) {
  const base = useAsync(async () => {
    const [d, o] = await Promise.all([dispositivosEn(['EVALUADO', 'REACONDICIONADO']), Admin.organizaciones(1, 100, 'BENEFICIARIO')]);
    return { d, o: o.items };
  }, []);
  const f = useForm({ id_dispositivo: '', id_organizacion_beneficiaria: '', finalidad: '' });
  const acc = useAccion(Ciclo.crearAsignacion);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ id_dispositivo: Number(f.v.id_dispositivo), id_organizacion_beneficiaria: Number(f.v.id_organizacion_beneficiaria), finalidad: f.v.finalidad.trim() });
    if (r) { f.reiniciar(); base.recargar(); alCrear(); }
  };
  return (
    <Seccion titulo="Nueva asignacion" ayuda="Un equipo clasificado como no recuperable no se puede asignar: el sistema lo rechaza.">
      <Carga estado={base}>{(b) => (
        <form onSubmit={enviar} noValidate>
          <div className="form-rejilla">
            <Select label="Dispositivo" requerido opciones={b.d.map((x) => ({ valor: x.id_dispositivo, texto: `${x.codigo_trazabilidad} - ${texto(x.estado_actual)}` }))} {...f.enlazar('id_dispositivo')} errorApi={acc.error} />
            <Select label="Entidad beneficiaria" requerido opciones={b.o.map((x) => ({ valor: x.id_organizacion, texto: x.nombre }))} {...f.enlazar('id_organizacion_beneficiaria')} errorApi={acc.error} />
            <Input label="Finalidad" requerido {...f.enlazar('finalidad')} errorApi={acc.error} />
          </div>
          <ErrorApi error={acc.error} ayuda={{ 422: 'Revisa la clasificacion del equipo y su estado.', 409: 'Este dispositivo ya tiene una asignacion.' }} />
          {acc.ok && !acc.error && <Alerta tipo="exito">Asignacion #{acc.ok.id_asignacion} creada. Falta que la entidad confirme la entrega.</Alerta>}
          <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_dispositivo || !f.v.id_organizacion_beneficiaria || !f.v.finalidad.trim()}>Crear asignacion</Boton>
        </form>
      )}</Carga>
    </Seccion>
  );
}

function Confirmar({ id, alCambiar }) {
  const acc = useAccion(() => Ciclo.confirmarAsignacion(id));
  return (<div><Boton tipo="secundario" className="btn btn-sec btn-chico" enviando={acc.enviando} onClick={async () => { if (await acc.ejecutar()) alCambiar(); }}>Confirmar entrega recibida</Boton><ErrorApi error={acc.error} ayuda={{ 409: 'Esta entrega ya estaba confirmada.' }} /></div>);
}

export function Asignaciones() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => Ciclo.asignaciones(pagina, 20), [pagina]);
  const esBenef = tiene(usuario, R_.B);
  return (
    <Pagina titulo="Asignaciones" ayuda={esBenef ? 'Equipos asignados a tu organizacion. Confirma cuando los recibas.' : 'Entrega de equipos a entidades beneficiarias.'}>
      {tiene(usuario, R_.C) && <NuevaAsignacion alCrear={lista.recargar} />}
      <Seccion titulo="Listado">
        <Carga estado={lista} vacio="No hay asignaciones.">{(d) => (<>
          <Tabla titulo="Asignaciones" clave="id_asignacion" filas={d.items} columnas={[
            { titulo: 'Asignacion', ver: (f) => `#${f.id_asignacion}` },
            { titulo: 'Dispositivo', ver: (f) => <a href={`#/dispositivos/${f.id_dispositivo}`}>#{f.id_dispositivo}</a> },
            { titulo: 'Finalidad', ver: (f) => f.finalidad || '-' },
            { titulo: 'Asignada', ver: (f) => fecha(f.fecha_asignacion) },
            { titulo: 'Entrega', ver: (f) => (f.entregada ? <span><Estado valor="ENTREGADA" /> {fecha(f.fecha_entrega)}</span> : <Estado valor="PENDIENTE" />) },
            ...(esBenef ? [{ titulo: 'Accion', ver: (f) => (f.entregada ? '-' : <Confirmar id={f.id_asignacion} alCambiar={lista.recargar} />) }] : []),
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

export function Cierres() {
  const f = useForm({ id_dispositivo: '', destino: 'tratamiento', id_destino: '', fecha_confirmacion: hoyISO() });
  const acc = useAccion(Ciclo.cerrarTrazabilidad);
  const enviar = async (e) => {
    e.preventDefault();
    const b = { id_dispositivo: Number(f.v.id_dispositivo), fecha_confirmacion: f.v.fecha_confirmacion };
    b[f.v.destino === 'tratamiento' ? 'id_tratamiento' : 'id_asignacion'] = Number(f.v.id_destino);
    const r = await acc.ejecutar(b);
    if (r) f.set('id_destino', '');
  };
  return (
    <Pagina titulo="Cierre de trazabilidad" ayuda="Cierra el ciclo de un equipo con un unico destino final y la fecha en que se confirmo. No se puede deshacer.">
      <Seccion titulo="Datos del cierre">
        <form onSubmit={enviar} noValidate>
          <div className="form-rejilla">
            <Input label="Numero de dispositivo" type="number" min="1" requerido {...f.enlazar('id_dispositivo')} errorApi={acc.error} />
            <Select label="Destino final" requerido vacio="Selecciona..." opciones={[{ valor: 'tratamiento', texto: 'Tratamiento finalizado' }, { valor: 'asignacion', texto: 'Asignacion a beneficiario entregada' }]} {...f.enlazar('destino')} />
            <Input label={f.v.destino === 'tratamiento' ? 'Numero de tratamiento' : 'Numero de asignacion'} type="number" min="1" requerido {...f.enlazar('id_destino')} errorApi={acc.error} />
            <Input label="Fecha de confirmacion" type="date" max={hoyISO()} requerido {...f.enlazar('fecha_confirmacion')} errorApi={acc.error} ayuda="No puede ser futura." />
          </div>
          <ErrorApi error={acc.error} ayuda={{ 409: 'Este dispositivo ya tiene un cierre.', 422: 'El tratamiento debe estar finalizado o la entrega confirmada antes de cerrar.' }} />
          {acc.ok && !acc.error && (
            <Alerta tipo="exito" titulo="Trazabilidad cerrada">Cierre #{acc.ok.id_cierre}, destino {texto(acc.ok.destino_final)}, confirmado el {fecha(acc.ok.fecha_confirmacion)}.
              {acc.ok.lotes_cerrados?.length ? ` Se cerraron los lotes: ${acc.ok.lotes_cerrados.join(', ')}.` : ''} <a href={`#/evidencias?destino=id_cierre&id=${acc.ok.id_cierre}`}>Adjuntar evidencia al cierre</a></Alerta>
          )}
          <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_dispositivo || !f.v.id_destino || !f.v.fecha_confirmacion}>Cerrar trazabilidad</Boton>
        </form>
      </Seccion>
    </Pagina>
  );
}
