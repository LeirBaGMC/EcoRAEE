import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Admin } from '../api/endpoints.js';
import { normalizar, traerTodo, useAccion, useAsync, useForm } from '../lib/hooks.js';
import { useCatalogos } from '../lib/catalogos.js';
import { fechaHora, num, texto } from '../lib/format.js';
import { ROLES, R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Buscador, Carga, Casilla, Desplegable, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

const POR_PAGINA = 20;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const si = (condicion, mensaje) => (condicion ? mensaje : undefined);
const trozo = (filas, pagina) => filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

function EditarCapacidad({ conexion, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(String(conexion.capacidad_por_periodo));
  const acc = useAccion(() => Admin.capacidadConexion(conexion.id_conexion, valor));
  const valido = valor.trim() !== '' && Number.isFinite(Number(valor)) && Number(valor) >= 0;
  if (!abierto) return <Boton tipo="secundario" onClick={() => { acc.limpiar(); setAbierto(true); }}>Editar capacidad</Boton>;
  return <form className="capacidad-editor" noValidate onSubmit={async (e) => { e.preventDefault(); if (valido && await acc.ejecutar()) { setAbierto(false); alGuardar(); } }}>
    <Input label={`Capacidad de la conexión #${conexion.id_conexion} (${conexion.unidad_capacidad})`} type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} error={!valido ? 'Introduce una capacidad no negativa.' : undefined} />
    <p className="nota">Se conserva la ruta y la unidad. La capacidad debe cubrir lo comprometido en todos los periodos registrados.</p>
    <ErrorApi error={acc.error} />
    <div className="acciones"><Boton type="submit" enviando={acc.enviando} disabled={!valido || Number(valor) === Number(conexion.capacidad_por_periodo)}>Guardar capacidad</Boton><Boton tipo="secundario" disabled={acc.enviando} onClick={() => { acc.limpiar(); setValor(String(conexion.capacidad_por_periodo)); setAbierto(false); }}>Cancelar</Boton></div>
  </form>;
}

export function Red() {
  const { usuario } = useAuth();
  const esAdmin = tiene(usuario, R_.A);
  const cen = useAsync(Admin.centros, []);
  const con = useAsync(Admin.conexiones, []);
  const cat = useCatalogos();
  const orgs = useAsync(() => (esAdmin ? traerTodo(Admin.organizaciones) : Promise.resolve([])), [esAdmin]);
  const fc = useForm({ codigo_centro: '', nombre: '', tipo_centro: '', ciudad: '', capacidad_almacenamiento: '0', id_organizacion: '' });
  const fx = useForm({ id_centro_origen: '', id_centro_destino: '', capacidad_por_periodo: '', unidad_capacidad: 'UND' });
  const nuevoCentro = useAccion(Admin.crearCentro);
  const nuevaCon = useAccion(Admin.crearConexion);
  const [qCentro, setQCentro] = useState('');
  const [qConexion, setQConexion] = useState('');
  const nombre = (id) => cen.data?.find((c) => c.id_centro === id)?.nombre || `Centro ${id}`;
  const errCapCentro = si(Number(fc.v.capacidad_almacenamiento) < 0, 'La capacidad no puede ser negativa.');
  const errMismo = si(fx.v.id_centro_origen && fx.v.id_centro_origen === fx.v.id_centro_destino, 'El destino debe ser distinto del origen.');
  const errCapCon = si(fx.v.capacidad_por_periodo !== '' && Number(fx.v.capacidad_por_periodo) <= 0, 'La capacidad debe ser mayor que cero.');
  return (
    <Pagina titulo="Centros y conexiones" ayuda="La capacidad de cada conexión se mide por periodo y en una unidad (UND o KG).">
      <Seccion titulo="Centros">
        <Desplegable titulo="Listado de centros" total={cen.data?.length}>
          <Buscador label="Buscar centros" placeholder="Nombre, código o ciudad" value={qCentro} onChange={(e) => setQCentro(e.target.value)} />
          <p className="nota">Ordenados por nombre y código.</p>
          <Carga estado={cen} vacio="No hay centros.">{(l) => <Tabla titulo="Centros" clave="id_centro" filas={[...l].filter((c) => normalizar(`${c.nombre} ${c.codigo_centro} ${c.ciudad}`).includes(normalizar(qCentro.trim()))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', {numeric:true,sensitivity:'base'}) || a.codigo_centro.localeCompare(b.codigo_centro, 'es'))} columnas={[
            { titulo: 'Código', campo: 'codigo_centro' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', ver: (x) => texto(x.tipo_centro) }, { titulo: 'Ciudad', campo: 'ciudad' },
            { titulo: 'Capacidad de almacenamiento', num: true, ver: (x) => num(x.capacidad_almacenamiento) }]} />}</Carga>
        </Desplegable>
        {esAdmin && (
          <form noValidate onSubmit={async (e) => { e.preventDefault(); if (await nuevoCentro.ejecutar({ ...fc.v, capacidad_almacenamiento: fc.v.capacidad_almacenamiento || '0', id_organizacion: Number(fc.v.id_organizacion) })) { fc.reiniciar(); cen.recargar(); } }}>
            <h3>Crear centro</h3>
            <div className="form-rejilla">
              <Input label="Código" requerido {...fc.enlazar('codigo_centro')} errorApi={nuevoCentro.error} />
              <Input label="Nombre" requerido {...fc.enlazar('nombre')} errorApi={nuevoCentro.error} />
              <Carga estado={cat}>{(c) => <Select label="Tipo de centro" requerido opciones={c.tipos_centro.map((t) => ({ valor: t, texto: texto(t) }))} {...fc.enlazar('tipo_centro')} errorApi={nuevoCentro.error} />}</Carga>
              <Input label="Ciudad" requerido {...fc.enlazar('ciudad')} errorApi={nuevoCentro.error} />
              <Input label="Capacidad de almacenamiento" type="number" min="0" error={errCapCentro} {...fc.enlazar('capacidad_almacenamiento')} errorApi={nuevoCentro.error} />
              <Select label="Organización" requerido opciones={(orgs.data || []).map((o) => ({ valor: o.id_organizacion, texto: `${o.nombre} — ${o.ruc} (#${o.id_organizacion})` }))} {...fc.enlazar('id_organizacion')} errorApi={nuevoCentro.error} />
            </div>
            <ErrorApi error={nuevoCentro.error} ayuda={{ 409: 'Ese código de centro ya existe.' }} />
            <Boton type="submit" enviando={nuevoCentro.enviando} ayudaDeshabilitado="Completa código, nombre, tipo, ciudad y organización; la capacidad no puede ser negativa." disabled={!fc.v.codigo_centro.trim() || !fc.v.nombre.trim() || !fc.v.tipo_centro || !fc.v.ciudad.trim() || !fc.v.id_organizacion || !!errCapCentro}>Crear centro</Boton>
          </form>
        )}
      </Seccion>
      <Seccion titulo="Conexiones logísticas">
        <Desplegable titulo="Listado de conexiones" total={con.data?.length}>
          <Buscador label="Buscar conexiones" placeholder="Origen, destino o número" value={qConexion} onChange={(e) => setQConexion(e.target.value)} />
          <p className="nota">Ordenadas por origen y destino. El contador indica cuántas conexiones hay; los números identificadores pueden tener saltos.</p>
          <Carga estado={con} vacio="No hay conexiones.">{(l) => <Tabla titulo="Conexiones" clave="id_conexion" filas={[...l].filter((c) => normalizar(`${nombre(c.id_centro_origen)} ${nombre(c.id_centro_destino)} ${c.id_conexion}`).includes(normalizar(qConexion.trim()))).sort((a,b) => nombre(a.id_centro_origen).localeCompare(nombre(b.id_centro_origen), 'es', {numeric:true,sensitivity:'base'}) || nombre(a.id_centro_destino).localeCompare(nombre(b.id_centro_destino), 'es', {numeric:true,sensitivity:'base'}) || a.id_conexion - b.id_conexion)} columnas={[
            { titulo: 'Número', ver: (x) => `#${x.id_conexion}` }, { titulo: 'Origen', ver: (x) => nombre(x.id_centro_origen) }, { titulo: 'Destino', ver: (x) => nombre(x.id_centro_destino) },
            { titulo: 'Capacidad por periodo', num: true, ver: (x) => `${num(x.capacidad_por_periodo)} ${x.unidad_capacidad}` }, { titulo: 'Activa', ver: (x) => (x.activa ? 'Sí' : 'No') },
            ...(esAdmin ? [{titulo:'Acciones',ver:(x)=><EditarCapacidad key={`${x.id_conexion}-${x.capacidad_por_periodo}`} conexion={x} alGuardar={con.recargar}/>}]:[])]} />}</Carga>
        </Desplegable>
        {esAdmin && (
          <form noValidate onSubmit={async (e) => { e.preventDefault(); if (await nuevaCon.ejecutar({ ...fx.v, id_centro_origen: Number(fx.v.id_centro_origen), id_centro_destino: Number(fx.v.id_centro_destino) })) { fx.reiniciar(); con.recargar(); } }}>
            <h3>Crear conexión</h3>
            <div className="form-rejilla">
              <Select label="Centro de origen" requerido buscable opciones={(cen.data || []).map((c) => ({ valor: c.id_centro, texto: `${c.nombre} (${c.codigo_centro})` }))} {...fx.enlazar('id_centro_origen')} errorApi={nuevaCon.error} />
              <Select label="Centro de destino" requerido buscable error={errMismo} opciones={(cen.data || []).map((c) => ({ valor: c.id_centro, texto: `${c.nombre} (${c.codigo_centro})` }))} {...fx.enlazar('id_centro_destino')} errorApi={nuevaCon.error} />
              <Input label="Capacidad por periodo" type="number" min="0" requerido error={errCapCon} {...fx.enlazar('capacidad_por_periodo')} errorApi={nuevaCon.error} />
              <Select label="Unidad" requerido vacio="Selecciona..." opciones={[{ valor: 'UND', texto: 'Unidades (UND)' }, { valor: 'KG', texto: 'Kilogramos (KG)' }]} {...fx.enlazar('unidad_capacidad')} errorApi={nuevaCon.error} />
            </div>
            <ErrorApi error={nuevaCon.error} />
            <Boton type="submit" enviando={nuevaCon.enviando} ayudaDeshabilitado="Elige centros distintos y una capacidad positiva." disabled={!fx.v.id_centro_origen || !fx.v.id_centro_destino || fx.v.capacidad_por_periodo === '' || !!errMismo || !!errCapCon}>Crear conexión</Boton>
          </form>
        )}
      </Seccion>
    </Pagina>
  );
}

function CasillasRoles({ roles, valor, onCambiar }) {
  return (
    <fieldset className="lista-check"><legend>Roles</legend>
      {roles.map((r) => <Casilla key={r} label={ROLES[r] || r} checked={valor.includes(r)} onChange={(e) => onCambiar(e.target.checked ? [...valor, r] : valor.filter((x) => x !== r))} />)}
    </fieldset>
  );
}

function FilaUsuario({ u, roles, alCambiar }) {
  const [editando, setEditando] = useState(false);
  const [sel, setSel] = useState(u.roles);
  const cambiar = useAccion(() => Admin.roles(u.id_usuario, sel).then((r) => { setEditando(false); alCambiar(); return r; }));
  const activo = useAccion(() => Admin.activo(u.id_usuario, !u.activo).then((r) => { alCambiar(); return r; }));
  return (
    <div>
      {editando ? (<>
        <CasillasRoles roles={roles} valor={sel} onCambiar={setSel} />
        <div className="acciones"><Boton enviando={cambiar.enviando} disabled={sel.length === 0} onClick={() => cambiar.ejecutar()}>Guardar roles</Boton><Boton tipo="secundario" onClick={() => { setEditando(false); setSel(u.roles); }}>Cancelar</Boton></div>
      </>) : (
        <div className="acciones">
          <button type="button" className="btn btn-sec btn-chico" onClick={() => setEditando(true)}>Cambiar roles</button>
          <button type="button" className="btn btn-sec btn-chico" disabled={activo.enviando} onClick={() => activo.ejecutar()}>{u.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      )}
      <ErrorApi error={cambiar.error || activo.error} ayuda={{ 422: 'No puedes desactivarte a ti mismo ni dejar un usuario sin roles.' }} />
    </div>
  );
}

export function Usuarios() {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState({ q: '', rol: '', estado: '' });
  const lista = useAsync(() => traerTodo(Admin.usuarios), []);
  const cat = useCatalogos();
  const orgs = useAsync(() => traerTodo(Admin.organizaciones), []);
  const f = useForm({ correo: '', nombre_usuario: '', nombre_visible: '', contrasena: '', id_organizacion: '' });
  const [roles, setRoles] = useState([]);
  const acc = useAccion(Admin.crearUsuario);
  const filtrar = (cambio) => { setFiltro((x) => ({ ...x, ...cambio })); setPagina(1); };
  const filas = useMemo(() => {
    const q = normalizar(filtro.q.trim());
    return (lista.data || []).filter((u) => (!q || normalizar(`${u.nombre_visible} ${u.nombre_usuario} ${u.correo}`).includes(q))
      && (!filtro.rol || u.roles.includes(filtro.rol))
      && (!filtro.estado || (filtro.estado === 'ACTIVO') === u.activo)).sort((a,b) => (a.nombre_visible || a.nombre_usuario).localeCompare(b.nombre_visible || b.nombre_usuario, 'es', {numeric:true,sensitivity:'base'}) || a.id_usuario-b.id_usuario);
  }, [lista.data, filtro]);
  const errores = {
    correo: si(f.v.correo && !CORREO.test(f.v.correo.trim()), 'Escribe un correo válido, por ejemplo nombre@dominio.com.'),
    nombre_usuario: si(f.v.nombre_usuario && f.v.nombre_usuario.trim().length < 3, 'Debe tener al menos 3 caracteres.'),
    contrasena: si(f.v.contrasena && f.v.contrasena.length < 10, 'Debe tener al menos 10 caracteres.'),
  };
  const listo = f.v.correo && f.v.nombre_usuario && f.v.nombre_visible.trim() && f.v.contrasena && f.v.id_organizacion && roles.length && !Object.values(errores).some(Boolean);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ ...f.v, correo: f.v.correo.trim(), nombre_usuario: f.v.nombre_usuario.trim(), roles, id_organizacion: Number(f.v.id_organizacion) });
    if (r) { f.reiniciar(); setRoles([]); lista.recargar(); }
  };
  return (
    <Pagina titulo="Usuarios" ayuda="Crea cuentas y define qué rol tiene cada una. Los cambios de rol aplican de inmediato.">
      <Seccion titulo="Crear usuario">
        <Carga estado={cat}>{(c) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Input label="Correo" type="email" requerido error={errores.correo} {...f.enlazar('correo')} errorApi={acc.error} />
              <Input label="Nombre de usuario" requerido ayuda="Mínimo 3 caracteres." error={errores.nombre_usuario} {...f.enlazar('nombre_usuario')} errorApi={acc.error} />
              <Input label="Nombre visible" requerido {...f.enlazar('nombre_visible')} errorApi={acc.error} />
              <Input label="Contraseña inicial" type="password" autoComplete="new-password" requerido ayuda="Mínimo 10 caracteres." error={errores.contrasena} {...f.enlazar('contrasena')} errorApi={acc.error} />
              <Select label="Organización" requerido opciones={(orgs.data || []).map((o) => ({ valor: o.id_organizacion, texto: `${o.nombre} — ${o.ruc} (#${o.id_organizacion})` }))} {...f.enlazar('id_organizacion')} errorApi={acc.error} />
            </div>
            <CasillasRoles roles={c.roles || []} valor={roles} onCambiar={setRoles} />
            <ErrorApi error={acc.error} ayuda={{ 409: 'Ese usuario o correo ya existe.' }} />
            {acc.ok && !acc.error && <Alerta tipo="exito">Usuario {acc.ok.nombre_usuario} creado.</Alerta>}
            <Boton type="submit" enviando={acc.enviando} ayudaDeshabilitado="Completa los campos obligatorios, una contraseña de 10 caracteres o más y al menos un rol." disabled={!listo}>Crear usuario</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Desplegable titulo="Usuarios existentes" total={lista.data ? filas.length : undefined}>
        <div className="filtros">
          <Buscador label="Buscar" placeholder="Nombre, usuario o correo" value={filtro.q} onChange={(e) => filtrar({ q: e.target.value })} />
          <Select label="Rol" vacio="Todos" opciones={Object.entries(ROLES).map(([valor, t]) => ({ valor, texto: t }))} value={filtro.rol} onChange={(e) => filtrar({ rol: e.target.value })} />
          <Select label="Estado" vacio="Todos" opciones={[{ valor: 'ACTIVO', texto: 'Activos' }, { valor: 'INACTIVO', texto: 'Inactivos' }]} value={filtro.estado} onChange={(e) => filtrar({ estado: e.target.value })} />
        </div>
        <Carga estado={lista} vacio="No hay usuarios.">{() => (<>
          <Tabla titulo="Usuarios" clave="id_usuario" filas={trozo(filas, pagina)} vacio="Ningún usuario coincide con el filtro." columnas={[
            { titulo: 'Usuario', ver: (u) => <span>{u.nombre_visible}<small className="nota"> ({u.nombre_usuario})</small></span> }, { titulo: 'Correo', campo: 'correo' },
            { titulo: 'Roles', ver: (u) => u.roles.map((r) => ROLES[r] || r).join(', ') }, { titulo: 'Estado', ver: (u) => <Estado valor={u.activo ? 'ACTIVO' : 'INACTIVO'} /> },
            { titulo: 'Acciones', ver: (u) => <FilaUsuario key={`${u.id_usuario}-${u.roles.join()}-${u.activo}`} u={u} roles={cat.data?.roles || []} alCambiar={lista.recargar} /> },
          ]} />
          <Paginacion pagina={pagina} tamano={POR_PAGINA} total={filas.length} onCambiar={setPagina} />
        </>)}</Carga>
      </Desplegable>
    </Pagina>
  );
}

export function Organizaciones() {
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState('');
  const lista = useAsync(() => traerTodo(Admin.organizaciones), []);
  const cat = useCatalogos();
  const f = useForm({ ruc: '', nombre: '', tipo_persona: 'JURIDICA', ciudad: '' });
  const [tipos, setTipos] = useState([]);
  const acc = useAccion(Admin.crearOrganizacion);
  const filas = useMemo(() => {
    const b = normalizar(q.trim());
    return (lista.data || []).filter((o) => !b || normalizar(`${o.nombre} ${o.ruc} ${o.ciudad}`).includes(b)).sort((a,c) => a.nombre.localeCompare(c.nombre, 'es', {numeric:true,sensitivity:'base'}) || a.ruc.localeCompare(c.ruc));
  }, [lista.data, q]);
  const ruc = f.v.ruc.trim();
  const errRuc = si(ruc && !/^\d{13}$/.test(ruc), 'El RUC debe tener exactamente 13 dígitos.');
  const enviar = async (e) => {
    e.preventDefault();
    if (await acc.ejecutar({ ...f.v, ruc, tipos_actor: tipos })) { f.reiniciar(); setTipos([]); lista.recargar(); }
  };
  return (
    <Pagina titulo="Organizaciones" ayuda="Cada organización puede cumplir uno o varios papeles en el proceso.">
      <Seccion titulo="Crear organización">
        <Carga estado={cat}>{(c) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Input label="RUC (13 dígitos)" requerido inputMode="numeric" maxLength={13} error={errRuc} {...f.enlazar('ruc')} errorApi={acc.error} />
              <Input label="Nombre" requerido {...f.enlazar('nombre')} errorApi={acc.error} />
              <Select label="Tipo de persona" requerido vacio="Selecciona..." opciones={[{ valor: 'JURIDICA', texto: 'Jurídica' }, { valor: 'NATURAL', texto: 'Natural' }]} {...f.enlazar('tipo_persona')} errorApi={acc.error} />
              <Input label="Ciudad" requerido {...f.enlazar('ciudad')} errorApi={acc.error} />
            </div>
            <fieldset className="lista-check"><legend>Papeles (tipo de actor)</legend>
              {(c.tipos_actor || []).map((t) => <Casilla key={t} label={texto(t)} checked={tipos.includes(t)} onChange={(e) => setTipos(e.target.checked ? [...tipos, t] : tipos.filter((x) => x !== t))} />)}
            </fieldset>
            <ErrorApi error={acc.error} ayuda={{ 409: 'Ya existe una organización con ese RUC.' }} />
            <Boton type="submit" enviando={acc.enviando} ayudaDeshabilitado="Completa un RUC de 13 dígitos, nombre, ciudad y al menos un papel; selecciona el tipo de persona." disabled={!tipos.length || ruc.length !== 13 || !!errRuc || !f.v.nombre.trim() || !f.v.ciudad.trim() || !f.v.tipo_persona}>Crear organización</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Desplegable titulo="Organizaciones existentes" total={lista.data ? filas.length : undefined}>
        <div className="filtros">
          <Buscador label="Buscar" placeholder="Nombre, RUC o ciudad" value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
        </div>
        <Carga estado={lista} vacio="No hay organizaciones.">{() => (<>
          <Tabla titulo="Organizaciones" clave="id_organizacion" filas={trozo(filas, pagina)} vacio="Ninguna organización coincide con la búsqueda." columnas={[{ titulo: 'Número', ver: (o) => `#${o.id_organizacion}` }, { titulo: 'RUC', campo: 'ruc' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Persona', ver: (o) => texto(o.tipo_persona) }, { titulo: 'Ciudad', campo: 'ciudad' }]} />
          <Paginacion pagina={pagina} tamano={POR_PAGINA} total={filas.length} onCambiar={setPagina} />
        </>)}</Carga>
      </Desplegable>
    </Pagina>
  );
}

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const f = useForm({ tabla: '', clave: '' });
  const [filtro, setFiltro] = useState({ tabla: '', clave: '' });
  const lista = useAsync(() => Admin.auditoria(pagina, 20, filtro.tabla || undefined, filtro.clave || undefined), [pagina, filtro]);
  return (
    <Pagina titulo="Auditoría" ayuda="Cambios registrados por el sistema. Los datos sensibles, como contrasenas, nunca aparecen.">
      <Seccion titulo="Filtros">
        <form className="acciones" onSubmit={(e) => { e.preventDefault(); setPagina(1); setFiltro({ tabla: f.v.tabla.trim(), clave: f.v.clave.trim() }); }}>
          <Input label="Tabla (ej. usuario, movimiento)" {...f.enlazar('tabla')} />
          <Input label="Clave del registro (número)" {...f.enlazar('clave')} />
          <Boton type="submit" tipo="secundario">Filtrar</Boton>
        </form>
      </Seccion>
      <Seccion titulo="Registros">
        <Carga estado={lista} vacio="No hay registros con ese filtro.">{(d) => (<>
          <Tabla titulo="Auditoría" clave="id_auditoria" filas={d.items} columnas={[
            { titulo: 'Fecha', ver: (x) => fechaHora(x.fecha_hora) }, { titulo: 'Tabla', campo: 'tabla_afectada' }, { titulo: 'Operación', campo: 'operacion' }, { titulo: 'Registro', campo: 'clave_registro' }, { titulo: 'Usuario', ver: (x) => `#${x.id_usuario}` },
            { titulo: 'Detalle', ver: (x) => (<details><summary>Ver cambio</summary><pre style={{ whiteSpace: 'pre-wrap', maxWidth: '40ch' }}>{JSON.stringify({ antes: x.valor_anterior, despues: x.valor_nuevo }, null, 2)}</pre></details>) },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}
