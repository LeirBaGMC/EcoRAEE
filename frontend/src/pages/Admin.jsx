import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Admin } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { useCatalogos } from '../lib/catalogos.js';
import { fechaHora, num, texto } from '../lib/format.js';
import { ROLES, R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, Carga, Casilla, ErrorApi, Estado, Input, Paginacion, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

export function Red() {
  const { usuario } = useAuth();
  const esAdmin = tiene(usuario, R_.A);
  const cen = useAsync(Admin.centros, []);
  const con = useAsync(Admin.conexiones, []);
  const cat = useCatalogos();
  const orgs = useAsync(() => (esAdmin ? Admin.organizaciones(1, 100) : Promise.resolve({ items: [] })), [esAdmin]);
  const fc = useForm({ codigo_centro: '', nombre: '', tipo_centro: '', ciudad: '', capacidad_almacenamiento: '0', id_organizacion: '' });
  const fx = useForm({ id_centro_origen: '', id_centro_destino: '', capacidad_por_periodo: '', unidad_capacidad: 'UND' });
  const nuevoCentro = useAccion(Admin.crearCentro);
  const nuevaCon = useAccion(Admin.crearConexion);
  const nombre = (id) => cen.data?.find((c) => c.id_centro === id)?.nombre || `Centro ${id}`;
  return (
    <Pagina titulo="Centros y conexiones" ayuda="La capacidad de cada conexion se mide por periodo y en una unidad (UND o KG).">
      <Seccion titulo="Centros">
        <Carga estado={cen} vacio="No hay centros.">{(l) => <Tabla titulo="Centros" clave="id_centro" filas={l} columnas={[
          { titulo: 'Codigo', campo: 'codigo_centro' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', ver: (x) => texto(x.tipo_centro) }, { titulo: 'Ciudad', campo: 'ciudad' },
          { titulo: 'Capacidad de almacenamiento', num: true, ver: (x) => num(x.capacidad_almacenamiento) }]} />}</Carga>
        {esAdmin && (
          <form noValidate onSubmit={async (e) => { e.preventDefault(); if (await nuevoCentro.ejecutar({ ...fc.v, capacidad_almacenamiento: fc.v.capacidad_almacenamiento || '0', id_organizacion: Number(fc.v.id_organizacion) })) { fc.reiniciar(); cen.recargar(); } }}>
            <h3 style={{ marginTop: '1rem' }}>Crear centro</h3>
            <div className="form-rejilla">
              <Input label="Codigo" requerido {...fc.enlazar('codigo_centro')} errorApi={nuevoCentro.error} />
              <Input label="Nombre" requerido {...fc.enlazar('nombre')} errorApi={nuevoCentro.error} />
              <Carga estado={cat}>{(c) => <Select label="Tipo de centro" requerido opciones={c.tipos_centro.map((t) => ({ valor: t, texto: texto(t) }))} {...fc.enlazar('tipo_centro')} errorApi={nuevoCentro.error} />}</Carga>
              <Input label="Ciudad" requerido {...fc.enlazar('ciudad')} errorApi={nuevoCentro.error} />
              <Input label="Capacidad de almacenamiento" type="number" min="0" {...fc.enlazar('capacidad_almacenamiento')} errorApi={nuevoCentro.error} />
              <Select label="Organizacion" requerido opciones={(orgs.data?.items || []).map((o) => ({ valor: o.id_organizacion, texto: o.nombre }))} {...fc.enlazar('id_organizacion')} errorApi={nuevoCentro.error} />
            </div>
            <ErrorApi error={nuevoCentro.error} ayuda={{ 409: 'Ese codigo de centro ya existe.' }} />
            <Boton type="submit" enviando={nuevoCentro.enviando} disabled={!fc.v.codigo_centro || !fc.v.nombre || !fc.v.tipo_centro || !fc.v.ciudad || !fc.v.id_organizacion}>Crear centro</Boton>
          </form>
        )}
      </Seccion>
      <Seccion titulo="Conexiones logisticas">
        <Carga estado={con} vacio="No hay conexiones.">{(l) => <Tabla titulo="Conexiones" clave="id_conexion" filas={l} columnas={[
          { titulo: 'Numero', ver: (x) => `#${x.id_conexion}` }, { titulo: 'Origen', ver: (x) => nombre(x.id_centro_origen) }, { titulo: 'Destino', ver: (x) => nombre(x.id_centro_destino) },
          { titulo: 'Capacidad por periodo', num: true, ver: (x) => `${num(x.capacidad_por_periodo)} ${x.unidad_capacidad}` }, { titulo: 'Activa', ver: (x) => (x.activa ? 'Si' : 'No') }]} />}</Carga>
        {esAdmin && (
          <form noValidate onSubmit={async (e) => { e.preventDefault(); if (await nuevaCon.ejecutar({ ...fx.v, id_centro_origen: Number(fx.v.id_centro_origen), id_centro_destino: Number(fx.v.id_centro_destino) })) { fx.reiniciar(); con.recargar(); } }}>
            <h3 style={{ marginTop: '1rem' }}>Crear conexion</h3>
            <div className="form-rejilla">
              <Select label="Centro de origen" requerido opciones={(cen.data || []).map((c) => ({ valor: c.id_centro, texto: c.nombre }))} {...fx.enlazar('id_centro_origen')} errorApi={nuevaCon.error} />
              <Select label="Centro de destino" requerido opciones={(cen.data || []).map((c) => ({ valor: c.id_centro, texto: c.nombre }))} {...fx.enlazar('id_centro_destino')} errorApi={nuevaCon.error} />
              <Input label="Capacidad por periodo" type="number" min="0" requerido {...fx.enlazar('capacidad_por_periodo')} errorApi={nuevaCon.error} />
              <Select label="Unidad" requerido vacio="Selecciona..." opciones={[{ valor: 'UND', texto: 'Unidades (UND)' }, { valor: 'KG', texto: 'Kilogramos (KG)' }]} {...fx.enlazar('unidad_capacidad')} errorApi={nuevaCon.error} />
            </div>
            <ErrorApi error={nuevaCon.error} />
            <Boton type="submit" enviando={nuevaCon.enviando} disabled={!fx.v.id_centro_origen || !fx.v.id_centro_destino || fx.v.capacidad_por_periodo === ''}>Crear conexion</Boton>
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
  const lista = useAsync(() => Admin.usuarios(pagina, 20), [pagina]);
  const cat = useCatalogos();
  const orgs = useAsync(() => Admin.organizaciones(1, 100), []);
  const f = useForm({ correo: '', nombre_usuario: '', nombre_visible: '', contrasena: '', id_organizacion: '' });
  const [roles, setRoles] = useState([]);
  const acc = useAccion(Admin.crearUsuario);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ ...f.v, roles, id_organizacion: Number(f.v.id_organizacion) });
    if (r) { f.reiniciar(); setRoles([]); lista.recargar(); }
  };
  return (
    <Pagina titulo="Usuarios" ayuda="Crea cuentas y define que rol tiene cada una. Los cambios de rol aplican de inmediato.">
      <Seccion titulo="Crear usuario">
        <Carga estado={cat}>{(c) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Input label="Correo" type="email" requerido {...f.enlazar('correo')} errorApi={acc.error} />
              <Input label="Nombre de usuario" requerido ayuda="Minimo 3 caracteres." {...f.enlazar('nombre_usuario')} errorApi={acc.error} />
              <Input label="Nombre visible" requerido {...f.enlazar('nombre_visible')} errorApi={acc.error} />
              <Input label="Contrasena inicial" type="password" autoComplete="new-password" requerido ayuda="Minimo 10 caracteres." {...f.enlazar('contrasena')} errorApi={acc.error} />
              <Select label="Organizacion" requerido opciones={(orgs.data?.items || []).map((o) => ({ valor: o.id_organizacion, texto: o.nombre }))} {...f.enlazar('id_organizacion')} errorApi={acc.error} />
            </div>
            <CasillasRoles roles={c.roles || []} valor={roles} onCambiar={setRoles} />
            <ErrorApi error={acc.error} ayuda={{ 409: 'Ese usuario o correo ya existe.' }} />
            {acc.ok && !acc.error && <Alerta tipo="exito">Usuario {acc.ok.nombre_usuario} creado.</Alerta>}
            <Boton type="submit" enviando={acc.enviando} disabled={!roles.length || !f.v.id_organizacion || !f.v.correo || !f.v.nombre_usuario || !f.v.contrasena}>Crear usuario</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Seccion titulo="Usuarios existentes">
        <Carga estado={lista} vacio="No hay usuarios.">{(d) => (<>
          <Tabla titulo="Usuarios" clave="id_usuario" filas={d.items} columnas={[
            { titulo: 'Usuario', ver: (u) => <span>{u.nombre_visible}<small className="nota"> ({u.nombre_usuario})</small></span> }, { titulo: 'Correo', campo: 'correo' },
            { titulo: 'Roles', ver: (u) => u.roles.map((r) => ROLES[r] || r).join(', ') }, { titulo: 'Estado', ver: (u) => <Estado valor={u.activo ? 'ACTIVO' : 'ANULADO'} /> },
            { titulo: 'Acciones', ver: (u) => <FilaUsuario key={`${u.id_usuario}-${u.roles.join()}-${u.activo}`} u={u} roles={cat.data?.roles || []} alCambiar={lista.recargar} /> },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

export function Organizaciones() {
  const [pagina, setPagina] = useState(1);
  const lista = useAsync(() => Admin.organizaciones(pagina, 20), [pagina]);
  const cat = useCatalogos();
  const f = useForm({ ruc: '', nombre: '', tipo_persona: 'JURIDICA', ciudad: '' });
  const [tipos, setTipos] = useState([]);
  const acc = useAccion(Admin.crearOrganizacion);
  const enviar = async (e) => {
    e.preventDefault();
    if (await acc.ejecutar({ ...f.v, ruc: f.v.ruc.trim(), tipos_actor: tipos })) { f.reiniciar(); setTipos([]); lista.recargar(); }
  };
  return (
    <Pagina titulo="Organizaciones" ayuda="Cada organizacion puede cumplir uno o varios papeles en el proceso.">
      <Seccion titulo="Crear organizacion">
        <Carga estado={cat}>{(c) => (
          <form onSubmit={enviar} noValidate>
            <div className="form-rejilla">
              <Input label="RUC (13 digitos)" requerido inputMode="numeric" maxLength={13} {...f.enlazar('ruc')} errorApi={acc.error} />
              <Input label="Nombre" requerido {...f.enlazar('nombre')} errorApi={acc.error} />
              <Select label="Tipo de persona" requerido vacio="Selecciona..." opciones={[{ valor: 'JURIDICA', texto: 'Juridica' }, { valor: 'NATURAL', texto: 'Natural' }]} {...f.enlazar('tipo_persona')} errorApi={acc.error} />
              <Input label="Ciudad" requerido {...f.enlazar('ciudad')} errorApi={acc.error} />
            </div>
            <fieldset className="lista-check"><legend>Papeles (tipo de actor)</legend>
              {(c.tipos_actor || []).map((t) => <Casilla key={t} label={texto(t)} checked={tipos.includes(t)} onChange={(e) => setTipos(e.target.checked ? [...tipos, t] : tipos.filter((x) => x !== t))} />)}
            </fieldset>
            <ErrorApi error={acc.error} ayuda={{ 409: 'Ya existe una organizacion con ese RUC.' }} />
            <Boton type="submit" enviando={acc.enviando} disabled={!tipos.length || f.v.ruc.trim().length !== 13 || !f.v.nombre || !f.v.ciudad}>Crear organizacion</Boton>
          </form>
        )}</Carga>
      </Seccion>
      <Seccion titulo="Organizaciones existentes">
        <Carga estado={lista} vacio="No hay organizaciones.">{(d) => (<>
          <Tabla titulo="Organizaciones" clave="id_organizacion" filas={d.items} columnas={[{ titulo: 'Numero', ver: (o) => `#${o.id_organizacion}` }, { titulo: 'RUC', campo: 'ruc' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Persona', ver: (o) => texto(o.tipo_persona) }, { titulo: 'Ciudad', campo: 'ciudad' }]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const f = useForm({ tabla: '', clave: '' });
  const [filtro, setFiltro] = useState({ tabla: '', clave: '' });
  const lista = useAsync(() => Admin.auditoria(pagina, 20, filtro.tabla || undefined, filtro.clave || undefined), [pagina, filtro]);
  return (
    <Pagina titulo="Auditoria" ayuda="Cambios registrados por el sistema. Los datos sensibles, como contrasenas, nunca aparecen.">
      <Seccion titulo="Filtros">
        <form className="acciones" onSubmit={(e) => { e.preventDefault(); setPagina(1); setFiltro({ tabla: f.v.tabla.trim(), clave: f.v.clave.trim() }); }}>
          <Input label="Tabla (ej. usuario, movimiento)" {...f.enlazar('tabla')} />
          <Input label="Clave del registro (numero)" {...f.enlazar('clave')} />
          <Boton type="submit" tipo="secundario">Filtrar</Boton>
        </form>
      </Seccion>
      <Seccion titulo="Registros">
        <Carga estado={lista} vacio="No hay registros con ese filtro.">{(d) => (<>
          <Tabla titulo="Auditoria" clave="id_auditoria" filas={d.items} columnas={[
            { titulo: 'Fecha', ver: (x) => fechaHora(x.fecha_hora) }, { titulo: 'Tabla', campo: 'tabla_afectada' }, { titulo: 'Operacion', campo: 'operacion' }, { titulo: 'Registro', campo: 'clave_registro' }, { titulo: 'Usuario', ver: (x) => `#${x.id_usuario}` },
            { titulo: 'Detalle', ver: (x) => (<details><summary>Ver cambio</summary><pre style={{ whiteSpace: 'pre-wrap', maxWidth: '40ch' }}>{JSON.stringify({ antes: x.valor_anterior, despues: x.valor_nuevo }, null, 2)}</pre></details>) },
          ]} />
          <Paginacion pagina={d.pagina} tamano={d.tamano} total={d.total} onCambiar={setPagina} />
        </>)}</Carga>
      </Seccion>
    </Pagina>
  );
}
