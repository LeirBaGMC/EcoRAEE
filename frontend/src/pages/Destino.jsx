import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Admin, Ciclo, Dispositivos } from '../api/endpoints.js';
import { traerTodo, useAccion, useAsync, useForm } from '../lib/hooks.js';
import { fecha, fechaHora, hoyISO, texto } from '../lib/format.js';
import { R_, puedeVer, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Carga, Datos, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

const TRATAMIENTOS = [['REACONDICIONAMIENTO', 'Reacondicionamiento (equipos reutilizables o reparables)'], ['RECICLAJE', 'Reciclaje (reciclables o no recuperables)'], ['DISPOSICION_CONTROLADA', 'Disposición controlada (solo no recuperables)']].map(([valor, t]) => ({ valor, texto: t }));
const ordenarRecientes = (filas, campo, id) => [...filas].sort((a, b) => String(b[campo] || '').localeCompare(String(a[campo] || '')) || b[id] - a[id]);
const equipo = (d) => [d.codigo_trazabilidad || `Dispositivo #${d.id_dispositivo}`, d.marca, d.modelo].filter(Boolean).join(' · ');

async function dispositivosEn(estados) {
  const r = await Promise.all(estados.map((e) => traerTodo((p, t) => Dispositivos.listar(p, t, e))));
  return r.flat();
}

function Tratamiento({ t, alCambiar }) {
  const fin = useAccion((resultado) => Ciclo.finalizarTratamiento(t.id_tratamiento, resultado));
  const enCurso = t.resultado === 'EN_CURSO' && !t.fecha_fin;
  return (
    <div>
      <Datos pares={[['Tratamiento', `#${t.id_tratamiento}`], ['Dispositivo', <a key="d" href={`#/dispositivos/${t.id_dispositivo}`}>{equipo(t)}</a>], ['Tipo', texto(t.tipo_tratamiento)], ['Resultado', <Estado key="r" valor={t.resultado} />], ['Inicio', fechaHora(t.fecha_inicio)], ['Fin', fechaHora(t.fecha_fin)]]} />
      {t.resultado === 'FALLIDO' && <Alerta tipo="aviso" titulo="Tratamiento finalizado sin éxito">Este intento terminó y no permite cerrar la trazabilidad. El dispositivo puede seguir figurando «En tratamiento»: eso no significa que este intento siga abierto. Puedes iniciar un nuevo tratamiento compatible para el mismo equipo si no tiene otro en curso.</Alerta>}
      {enCurso && (
        <div className="acciones" style={{ marginTop: '.75rem' }}>
          <Boton enviando={fin.enviando} onClick={async () => { const r = await fin.ejecutar('EXITOSO'); if (r) alCambiar(r); }}>Finalizar con exito</Boton>
          <Boton tipo="peligro" enviando={fin.enviando} onClick={async () => { const r = await fin.ejecutar('FALLIDO'); if (r) alCambiar(r); }}>Finalizar como fallido</Boton>
        </div>
      )}
      <ErrorApi error={fin.error} ayuda={{ 409: 'Este tratamiento ya estaba finalizado.' }} />
    </div>
  );
}

export function Tratamientos() {
  const disp = useAsync(async () => (await dispositivosEn(['EVALUADO', 'EN_TRATAMIENTO'])).filter((d) => d.ultimo_tratamiento?.resultado !== 'EN_CURSO'), []);
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => Ciclo.tratamientos(pagina, 20), [pagina]);
  const f = useForm({ id_dispositivo: '', tipo_tratamiento: '' });
  const ini = useAccion(Ciclo.iniciarTratamiento);
  const [actual, setActual] = useState(null);
  const [numero, setNumero] = useState('');
  const buscar = useAccion(async (id) => { setActual(null); const r = await Ciclo.tratamiento(id); setActual(r); return r; });
  const enviar = async (e) => {
    e.preventDefault();
    const r = await ini.ejecutar({ id_dispositivo: Number(f.v.id_dispositivo), tipo_tratamiento: f.v.tipo_tratamiento });
    if (r) { setActual(r); f.reiniciar(); disp.recargar(); lista.recargar(); }
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
            <ErrorApi error={ini.error} ayuda={{ 422: 'El tipo de tratamiento no corresponde a la clasificación técnica del equipo.' }} />
            {(!f.v.id_dispositivo || !f.v.tipo_tratamiento) && <p className="nota">Selecciona un dispositivo y el tipo de tratamiento para iniciarlo.</p>}
            <Boton type="submit" enviando={ini.enviando} disabled={!f.v.id_dispositivo || !f.v.tipo_tratamiento}>Iniciar tratamiento</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Seccion titulo="Tratamientos registrados" ayuda="Más recientes primero. Abre un tratamiento para consultar sus fechas o registrar el resultado.">
        <Carga estado={lista} vacio="Todavía no hay tratamientos registrados.">{(d) => (<>
          <Tabla titulo="Tratamientos registrados" clave="id_tratamiento" filas={ordenarRecientes(d.items, 'fecha_inicio', 'id_tratamiento')} columnas={[
            { titulo: 'Tratamiento', ver: (t) => `#${t.id_tratamiento}` },
            { titulo: 'Dispositivo', ver: equipo }, { titulo: 'Tipo', ver: (t) => texto(t.tipo_tratamiento) },
            { titulo: 'Resultado', ver: (t) => <Estado valor={t.resultado} /> },
            { titulo: 'Inicio', ver: (t) => fechaHora(t.fecha_inicio) }, { titulo: 'Fin', ver: (t) => fechaHora(t.fecha_fin) },
            { titulo: 'Detalle', ver: (t) => <Boton tipo="secundario" enviando={buscar.enviando} onClick={() => buscar.ejecutar(t.id_tratamiento)}>Abrir tratamiento #{t.id_tratamiento}</Boton> },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
      <Seccion titulo="Consultar o finalizar por número">
        <div className="acciones">
          <Input label="Número de tratamiento" type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Boton tipo="secundario" enviando={buscar.enviando} disabled={!/^[1-9]\d*$/.test(numero)} onClick={() => buscar.ejecutar(numero)}>Consultar</Boton>
        </div>
        <ErrorApi error={buscar.error} />
        {ini.ok && !ini.error && <Alerta tipo="exito">Tratamiento #{ini.ok.id_tratamiento} iniciado. Sus fechas y resultado se muestran a continuación.</Alerta>}
        {actual && <Tratamiento key={`${actual.id_tratamiento}-${actual.fecha_fin}`} t={actual} alCambiar={(t) => { setActual(t); disp.recargar(); lista.recargar(); }} />}
      </Seccion>
    </Pagina>
  );
}

function NuevaAsignacion({ alCrear }) {
  const base = useAsync(async () => {
    const [d, o] = await Promise.all([dispositivosEn(['EVALUADO', 'REACONDICIONADO']), traerTodo((p, t) => Admin.organizaciones(p, t, 'BENEFICIARIO'))]);
    return { d: d.filter((x) => x.permite_asignacion == null || x.permite_asignacion === true), o };
  }, []);
  const f = useForm({ id_dispositivo: '', id_organizacion_beneficiaria: '', finalidad: '' });
  const acc = useAccion(Ciclo.crearAsignacion);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ id_dispositivo: Number(f.v.id_dispositivo), id_organizacion_beneficiaria: Number(f.v.id_organizacion_beneficiaria), finalidad: f.v.finalidad.trim() });
    if (r) { f.reiniciar(); base.recargar(); alCrear(); }
  };
  return (
    <Seccion titulo="Nueva asignación" ayuda="Solo se ofrecen equipos cuya clasificación permite asignarlos. Si falta ese dato, el sistema comprobará su clasificación al guardar.">
      <Carga estado={base}>{(b) => (
        <form onSubmit={enviar} noValidate>
          <div className="form-rejilla">
            <Select label="Dispositivo" requerido opciones={b.d.map((x) => ({ valor: x.id_dispositivo, texto: `${equipo(x)} - ${texto(x.estado_actual)}${x.nombre_clasificacion ? ` · ${texto(x.nombre_clasificacion)}` : ''}` }))} {...f.enlazar('id_dispositivo')} errorApi={acc.error} />
            <Select label="Entidad beneficiaria" requerido buscable opciones={b.o.map((x) => ({ valor: x.id_organizacion, texto: `${x.nombre} · RUC ${x.ruc || 'sin dato'} · #${x.id_organizacion}` }))} {...f.enlazar('id_organizacion_beneficiaria')} errorApi={acc.error} />
            <Input label="Finalidad" requerido {...f.enlazar('finalidad')} errorApi={acc.error} />
          </div>
          <ErrorApi error={acc.error} ayuda={{ 422: 'Revisa la clasificación del equipo y su estado.', 409: 'Este dispositivo ya tiene una asignación.' }} />
          {acc.ok && !acc.error && <Alerta tipo="exito">Asignacion #{acc.ok.id_asignacion} creada. Falta que la entidad confirme la entrega.</Alerta>}
          {(!f.v.id_dispositivo || !f.v.id_organizacion_beneficiaria || !f.v.finalidad.trim()) && <p className="nota">Selecciona un dispositivo, la entidad destinataria y escribe la finalidad para crear la asignación.</p>}
          <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_dispositivo || !f.v.id_organizacion_beneficiaria || !f.v.finalidad.trim()}>Crear asignación</Boton>
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
  const global = tiene(usuario, R_.A);
  const puedeVerEquipo = puedeVer(usuario, '/dispositivos');
  return (
    <Pagina titulo="Asignaciones" ayuda={global ? 'Consulta global de asignaciones de todas las organizaciones. Solo puedes confirmar entregas dirigidas a tu organización y con rol de entidad beneficiaria.' : esBenef && !tiene(usuario, R_.C) ? 'Equipos asignados a tu organización. Confirma cuando los recibas.' : 'Entrega de equipos a entidades beneficiarias en tu organización.'}>
      {tiene(usuario, R_.C) && <NuevaAsignacion alCrear={lista.recargar} />}
      <Seccion titulo="Listado">
        <Carga estado={lista} vacio="No hay asignaciones.">{(d) => (<>
          <Tabla titulo="Asignaciones" clave="id_asignacion" filas={ordenarRecientes(d.items, 'fecha_asignacion', 'id_asignacion')} columnas={[
            { titulo: 'Asignación', ver: (f) => `#${f.id_asignacion}` },
            { titulo: 'Dispositivo', ver: (f) => puedeVerEquipo ? <a href={`#/dispositivos/${f.id_dispositivo}`}>{equipo(f)}</a> : equipo(f) },
            { titulo: 'Entidad beneficiaria', ver: (f) => `${f.nombre_organizacion || `Organización #${f.id_organizacion}`} · RUC ${f.ruc_organizacion || 'sin dato'} · #${f.id_organizacion}` },
            { titulo: 'Finalidad', ver: (f) => f.finalidad || '-' },
            { titulo: 'Asignada', ver: (f) => fecha(f.fecha_asignacion) },
            { titulo: 'Entrega', ver: (f) => (f.entregada ? <span><Estado valor="ENTREGADA" /> {fecha(f.fecha_entrega)}</span> : <Estado valor="PENDIENTE" />) },
            ...(esBenef ? [{ titulo: 'Acción', ver: (f) => (f.entregada || f.fecha_entrega ? 'Entrega confirmada' : usuario.id_organizacion != null && Number(f.id_organizacion) === Number(usuario.id_organizacion) ? <Confirmar id={f.id_asignacion} alCambiar={lista.recargar} /> : 'Confirmación a cargo de la entidad destinataria') }] : []),
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

const numeroValido = (v) => /^[1-9]\d*$/.test(String(v));
const firmaCierre = (v) => [v.id_dispositivo, v.destino, v.id_destino, v.fecha_confirmacion].join('|');

export function Cierres({ query = {} }) {
  const preseleccion = numeroValido(query.dispositivo) ? String(query.dispositivo) : '';
  const f = useForm({ id_dispositivo: preseleccion, destino: 'tratamiento', id_destino: '', fecha_confirmacion: hoyISO() });
  const [revision, setRevision] = useState(null);
  const acc = useAccion(Ciclo.cerrarTrazabilidad);
  useEffect(() => {
    if (preseleccion) { f.set('id_dispositivo', preseleccion); setRevision(null); acc.limpiar(); }
  }, [preseleccion]);

  const revisar = useAccion(async (datos) => {
    const [dispositivo, cierre] = await Promise.all([
      Dispositivos.obtener(datos.id_dispositivo),
      Dispositivos.cierre(datos.id_dispositivo).catch((e) => { if (e.status === 404) return null; throw e; }),
    ]);
    let soporte = null;
    if (!cierre) {
      soporte = datos.destino === 'tratamiento'
        ? await Ciclo.tratamiento(datos.id_destino)
        : (await traerTodo((p, t) => Ciclo.asignaciones(p, t))).find((a) => Number(a.id_asignacion) === Number(datos.id_destino));
    }
    const errores = [];
    const estado = dispositivo.estado_actual;
    if (cierre) errores.push(`El dispositivo ya tiene el cierre #${cierre.id_cierre}. Puedes consultar sus evidencias; no requiere otro cierre.`);
    else if (!soporte || Number(soporte.id_dispositivo) !== Number(datos.id_dispositivo)) errores.push('El destino indicado no pertenece a este dispositivo o no está disponible en tu alcance.');
    else if (datos.destino === 'tratamiento') {
      if (soporte.resultado !== 'EXITOSO' || !soporte.fecha_fin) errores.push('El tratamiento debe haber terminado con resultado Exitoso. Un intento fallido o en curso no permite cerrar la trazabilidad.');
      if (!['EN_TRATAMIENTO', 'REACONDICIONADO'].includes(estado)) errores.push(`El estado ${texto(estado)} no permite un cierre por tratamiento.`);
    } else {
      if (!soporte.fecha_entrega) errores.push('La entidad beneficiaria todavía no ha confirmado la entrega. Debe hacerlo antes del cierre.');
      if (estado !== 'ASIGNADO') errores.push(`El estado ${texto(estado)} no permite un cierre por asignación.`);
    }
    const fechaSoporte = soporte && (datos.destino === 'tratamiento' ? soporte.fecha_fin : soporte.fecha_entrega);
    if (fechaSoporte && datos.fecha_confirmacion < String(fechaSoporte).slice(0, 10)) errores.push('La fecha de confirmación no puede ser anterior al fin del tratamiento o a la entrega confirmada.');
    if (!datos.fecha_confirmacion || datos.fecha_confirmacion > hoyISO()) errores.push('Indica una fecha de confirmación válida, sin usar una fecha futura.');
    const r = { firma: firmaCierre(datos), dispositivo, cierre, soporte, errores };
    setRevision(r);
    return r;
  });

  const enlazar = (campo) => ({ ...f.enlazar(campo), disabled: revisar.enviando || acc.enviando || !!acc.ok,
    onChange: (e) => { f.set(campo, e.target.value); setRevision(null); revisar.limpiar(); acc.limpiar(); } });
  const lista = numeroValido(f.v.id_dispositivo) && numeroValido(f.v.id_destino) && ['tratamiento', 'asignacion'].includes(f.v.destino)
    && /^\d{4}-\d{2}-\d{2}$/.test(f.v.fecha_confirmacion) && f.v.fecha_confirmacion <= hoyISO();
  const revisado = revision?.firma === firmaCierre(f.v);
  const puedeCerrar = lista && revisado && !revision.errores.length && !acc.ok;
  const enviar = async (e) => {
    e.preventDefault();
    if (!puedeCerrar) return;
    const b = { id_dispositivo: Number(f.v.id_dispositivo), fecha_confirmacion: f.v.fecha_confirmacion };
    b[f.v.destino === 'tratamiento' ? 'id_tratamiento' : 'id_asignacion'] = Number(f.v.id_destino);
    await acc.ejecutar(b);
  };
  return (
    <Pagina titulo="Cierre de trazabilidad" ayuda="Cierra el ciclo de un equipo con un único destino final. Revisa el equipo, el soporte y la fecha antes de confirmar: el cierre no se puede deshacer.">
      <Seccion titulo="Requisitos para cerrar">
        <p>El equipo no debe tener un cierre previo. Elige un tratamiento terminado con resultado Exitoso o una asignación cuya entrega ya confirmó la entidad beneficiaria. La fecha debe ser igual o posterior a ese resultado o entrega, y no puede ser futura.</p>
      </Seccion>
      <Seccion titulo="Datos del cierre">
        <form onSubmit={enviar} noValidate>
          <div className="form-rejilla">
            <Input label="Número de dispositivo" type="number" min="1" requerido {...enlazar('id_dispositivo')} errorApi={acc.error} />
            <Select label="Destino final" requerido vacio="Selecciona..." opciones={[{ valor: 'tratamiento', texto: 'Tratamiento finalizado con éxito' }, { valor: 'asignacion', texto: 'Asignación a beneficiario entregada' }]} {...enlazar('destino')} />
            <Input label={f.v.destino === 'tratamiento' ? 'Número de tratamiento' : 'Número de asignación'} type="number" min="1" requerido {...enlazar('id_destino')} errorApi={acc.error} />
            <Input label="Fecha de confirmacion" type="date" max={hoyISO()} requerido {...enlazar('fecha_confirmacion')} errorApi={acc.error} ayuda="No puede ser anterior al resultado o entrega, ni futura." />
          </div>
          {!acc.ok && <Boton tipo="secundario" enviando={revisar.enviando} disabled={!lista || acc.enviando} onClick={() => { acc.limpiar(); setRevision(null); revisar.ejecutar({ ...f.v }); }}>Revisar requisitos</Boton>}
          {!lista && !acc.ok && <p className="nota">Completa los números del dispositivo y su destino, y una fecha válida para revisar los requisitos.</p>}
          <ErrorApi error={revisar.error} />
          {revisado && <Seccion titulo="Revisión del cierre">
            <Datos pares={[
              ['Dispositivo', equipo(revision.dispositivo)], ['Estado al revisar', <Estado key="estado" valor={revision.dispositivo.estado_actual} />],
              ['Destino elegido', `${f.v.destino === 'tratamiento' ? 'Tratamiento' : 'Asignación'} #${f.v.id_destino}`],
              ['Confirmación propuesta', fecha(f.v.fecha_confirmacion)],
              ...(revision.soporte ? f.v.destino === 'tratamiento' ? [
                ['Tipo de tratamiento', texto(revision.soporte.tipo_tratamiento)], ['Resultado', texto(revision.soporte.resultado)], ['Fin del tratamiento', fechaHora(revision.soporte.fecha_fin)],
              ] : [
                ['Entidad destinataria', `${revision.soporte.nombre_organizacion || `Organización #${revision.soporte.id_organizacion}`} · RUC ${revision.soporte.ruc_organizacion || 'sin dato'}`],
                ['Entrega confirmada', fechaHora(revision.soporte.fecha_entrega)],
              ] : []),
            ]} />
            {!acc.ok && (revision.errores.length ? <Alerta tipo="aviso" titulo="Todavía no se puede cerrar"><ul>{revision.errores.map((error) => <li key={error}>{error}</li>)}</ul></Alerta>
              : <Alerta titulo="Requisitos revisados">Confirma el cierre de {equipo(revision.dispositivo)} mediante {f.v.destino === 'tratamiento' ? 'tratamiento' : 'asignación'} #{f.v.id_destino}, con fecha {fecha(f.v.fecha_confirmacion)}.</Alerta>)}
            {revision.cierre && <a href={`#/evidencias?destino=id_cierre&id=${revision.cierre.id_cierre}`}>Consultar evidencias del cierre #{revision.cierre.id_cierre}</a>}
          </Seccion>}
          <ErrorApi error={acc.error} ayuda={{ 409: 'Actualiza la revisión para consultar el cierre existente.', 422: 'Revisa el resultado del tratamiento, la entrega y la fecha antes de intentar de nuevo.' }} />
          {acc.ok && !acc.error && (
            <Alerta tipo="exito" titulo="Trazabilidad cerrada">Cierre #{acc.ok.id_cierre}, destino {texto(acc.ok.destino_final)}, confirmado el {fecha(acc.ok.fecha_confirmacion)}.
              {acc.ok.lotes_cerrados?.length ? ` Se cerraron los lotes: ${acc.ok.lotes_cerrados.join(', ')}.` : ''} <a href={`#/evidencias?destino=id_cierre&id=${acc.ok.id_cierre}`}>Adjuntar evidencia al cierre</a></Alerta>
          )}
          <div className="acciones">
            <Boton type="submit" enviando={acc.enviando} disabled={!puedeCerrar || revisar.enviando}>Cerrar trazabilidad</Boton>
            {acc.ok && <Boton tipo="secundario" onClick={() => { acc.limpiar(); revisar.limpiar(); setRevision(null); f.setV({ id_dispositivo: '', destino: 'tratamiento', id_destino: '', fecha_confirmacion: hoyISO() }); }}>Preparar otro cierre</Boton>}
          </div>
          {!revisado && lista && !acc.ok && <p className="nota">Revisa los requisitos antes de cerrar. Si cambias un dato, vuelve a revisarlos.</p>}
        </form>
      </Seccion>
    </Pagina>
  );
}
