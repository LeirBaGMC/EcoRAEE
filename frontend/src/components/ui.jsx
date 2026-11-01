import { useId } from 'react';
import { errorCampo } from '../lib/hooks.js';
import { texto } from '../lib/format.js';

export function Alerta({ tipo = 'info', titulo, children, accion }) {
  const rol = tipo === 'error' ? 'alert' : 'status';
  const marca = { error: 'Error', exito: 'Listo', aviso: 'Atencion', info: 'Informacion' }[tipo];
  return (
    <div className={`alerta alerta-${tipo}`} role={rol}>
      <strong>{titulo || marca}</strong>
      <div>{children}</div>
      {accion}
    </div>
  );
}

// Muestra un ApiError con ayuda segun el codigo HTTP.
export function ErrorApi({ error, ayuda }) {
  if (!error) return null;
  const consejo = ayuda?.[error.status]
    || (error.status === 0 ? 'Revisa tu conexion y vuelve a intentar.' : '')
    || (error.status === 403 ? 'Si crees que deberias poder hacerlo, pide a un administrador revisar tu rol.' : '');
  return <Alerta tipo="error" titulo={error.status ? `No se pudo completar (${error.status})` : 'Sin conexion'}>{error.message}{consejo ? ` ${consejo}` : ''}</Alerta>;
}

export function Cargando({ texto: t = 'Cargando' }) {
  return <p className="cargando" role="status" aria-live="polite"><span className="punto" aria-hidden="true" />{t}...</p>;
}

export function Vacio({ children }) {
  return <p className="vacio">{children}</p>;
}

export function Carga({ estado, vacio, children }) {
  if (estado.cargando && !estado.data) return <Cargando />;
  if (estado.error) {
    return (
      <div>
        <ErrorApi error={estado.error} />
        <button type="button" className="btn btn-sec" onClick={estado.recargar}>Reintentar</button>
      </div>
    );
  }
  const lista = Array.isArray(estado.data) ? estado.data : estado.data?.items;
  if (vacio && Array.isArray(lista) && lista.length === 0) return <Vacio>{vacio}</Vacio>;
  return children(estado.data);
}

export function Boton({ enviando, children, tipo = 'primario', ...r }) {
  return (
    <button type="button" className={`btn btn-${tipo === 'primario' ? 'pri' : tipo === 'peligro' ? 'pel' : 'sec'}`} disabled={enviando || r.disabled} aria-busy={enviando || undefined} {...r}>
      {enviando ? 'Enviando...' : children}
    </button>
  );
}

function Envoltura({ id, label, ayuda, error, children, requerido }) {
  return (
    <div className={`campo${error ? ' campo-error' : ''}`}>
      <label htmlFor={id}>{label}{requerido ? <span aria-hidden="true"> *</span> : null}</label>
      {children}
      {ayuda && <small id={`${id}-ay`}>{ayuda}</small>}
      {error && <small id={`${id}-er`} className="msg-error">{error}</small>}
    </div>
  );
}

function props(id, ayuda, error) {
  const d = [ayuda ? `${id}-ay` : null, error ? `${id}-er` : null].filter(Boolean).join(' ');
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': d || undefined };
}

export function Input({ label, ayuda, error, errorApi, requerido, ...r }) {
  const id = useId();
  const e = error || errorCampo(errorApi, r.name);
  return <Envoltura id={id} label={label} ayuda={ayuda} error={e} requerido={requerido}><input {...props(id, ayuda, e)} required={requerido} {...r} /></Envoltura>;
}

export function Area({ label, ayuda, error, errorApi, requerido, ...r }) {
  const id = useId();
  const e = error || errorCampo(errorApi, r.name);
  return <Envoltura id={id} label={label} ayuda={ayuda} error={e} requerido={requerido}><textarea rows={3} {...props(id, ayuda, e)} required={requerido} {...r} /></Envoltura>;
}

export function Select({ label, ayuda, error, errorApi, requerido, opciones, vacio = 'Selecciona...', ...r }) {
  const id = useId();
  const e = error || errorCampo(errorApi, r.name);
  return (
    <Envoltura id={id} label={label} ayuda={ayuda} error={e} requerido={requerido}>
      <select {...props(id, ayuda, e)} required={requerido} {...r}>
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </Envoltura>
  );
}

export function Casilla({ label, ...r }) {
  const id = useId();
  return (
    <div className="campo campo-check">
      <input type="checkbox" id={id} {...r} checked={!!r.checked} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

// El estado siempre lleva texto, el color es solo apoyo.
export function Estado({ valor }) {
  const v = String(valor || '-');
  const clase = /CERRADO|ENTREGAD|EXITOS|CONFORME|VIGENTE|REUTILIZABLE/.test(v) ? 'ok'
    : /ANULAD|FALLID|NO_RECUP|ALTA/.test(v) ? 'mal'
      : /TRANSITO|PROGRAM|PENDIENTE|AUTORIZ|TRATAMIENTO|MEDIA|REPARABLE/.test(v) ? 'ojo' : 'neutro';
  return <span className={`estado estado-${clase}`}>{texto(v)}</span>;
}

export function Tabla({ titulo, columnas, filas, clave, vacio = 'No hay registros.' }) {
  if (!filas || filas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <div className="tabla-wrap" tabIndex={0} role="region" aria-label={titulo}>
      <table>
        <caption className="solo-lector">{titulo}</caption>
        <thead><tr>{columnas.map((c) => <th key={c.titulo} scope="col" className={c.num ? 'num' : undefined}>{c.titulo}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={clave ? f[clave] : i}>
              {columnas.map((c) => <td key={c.titulo} className={c.num ? 'num' : undefined} data-label={c.titulo}>{c.ver ? c.ver(f) : f[c.campo]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Paginacion({ pagina, tamano, total, onCambiar }) {
  const paginas = Math.max(1, Math.ceil((total || 0) / tamano));
  if (paginas <= 1) return total ? <p className="pie-tabla">{total} registro(s)</p> : null;
  return (
    <nav className="paginacion" aria-label="Paginacion">
      <button type="button" className="btn btn-sec" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
      <span>Pagina {pagina} de {paginas} ({total} registros)</span>
      <button type="button" className="btn btn-sec" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
    </nav>
  );
}

export function Seccion({ titulo, ayuda, acciones, children }) {
  return (
    <section className="seccion">
      <header><div><h2>{titulo}</h2>{ayuda && <p className="ayuda">{ayuda}</p>}</div>{acciones && <div className="acciones">{acciones}</div>}</header>
      {children}
    </section>
  );
}

export function Pagina({ titulo, ayuda, children, acciones }) {
  return (
    <div className="pagina">
      <header className="pagina-cab"><div><h1 tabIndex={-1} id="titulo-pagina">{titulo}</h1>{ayuda && <p className="ayuda">{ayuda}</p>}</div>{acciones && <div className="acciones">{acciones}</div>}</header>
      {children}
    </div>
  );
}

export function Datos({ pares }) {
  return (
    <dl className="datos">
      {pares.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v ?? '-'}</dd></div>))}
    </dl>
  );
}

export function Confirmar({ texto: t, children }) {
  return <p className="nota">{t}{children}</p>;
}
