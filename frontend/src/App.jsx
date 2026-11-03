import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { MENU, R_, ROLES, puedeVer, tiene } from './lib/permisos.js';
import { coincide, ir, useRuta } from './lib/router.jsx';
import Landing from './landing/Landing.jsx';
import { Cargando, Pagina } from './components/ui.jsx';
import Login, { Registro } from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Icono from './components/Icono.jsx';
import MenuPerfil from './components/MenuPerfil.jsx';
import ConsultaGlobal from './pages/ConsultaGlobal.jsx';
import { Leaf, Menu, X } from 'lucide-react';
import { DispositivoDetalle, DispositivoNuevo, Dispositivos } from './pages/Dispositivos.jsx';
import Solicitudes from './pages/Solicitudes.jsx';
import Recepciones from './pages/Recepciones.jsx';
import { MovimientoDetalle, MovimientoNuevo, Movimientos } from './pages/Movimientos.jsx';
import { Asignaciones, Cierres, Tratamientos } from './pages/Destino.jsx';
import Evidencias from './pages/Evidencias.jsx';
import { EscenarioDetalle, EscenarioNuevo, Escenarios } from './pages/Escenarios.jsx';
import Seguimiento from './pages/Seguimiento.jsx';
import { Auditoria, Organizaciones, Red, Usuarios } from './pages/Admin.jsx';

const RUTAS = [
  ['/', Inicio], ['/dispositivos', Dispositivos], ['/dispositivos/nuevo', DispositivoNuevo], ['/dispositivos/:id', DispositivoDetalle],
  ['/solicitudes', Solicitudes], ['/recepciones', Recepciones],
  ['/movimientos', Movimientos], ['/movimientos/nuevo', MovimientoNuevo], ['/movimientos/:id', MovimientoDetalle],
  ['/tratamientos', Tratamientos], ['/asignaciones', Asignaciones], ['/cierres', Cierres],
  ['/evidencias', Evidencias],
  ['/escenarios', Escenarios], ['/escenarios/nuevo', EscenarioNuevo], ['/escenarios/:id', EscenarioDetalle],
  ['/seguimiento', Seguimiento], ['/red', Red],
  ['/usuarios', Usuarios], ['/organizaciones', Organizaciones], ['/auditoria', Auditoria],
];

// Las pantallas de alta requieren su permiso de operación, además de ver el módulo.
const ROLES_ALTA = {
  '/dispositivos/nuevo': [R_.G, R_.O],
  '/movimientos/nuevo': [R_.C],
  '/escenarios/nuevo': [R_.C],
};

function elegir(path) {
  // las rutas fijas (/dispositivos/nuevo) van antes que las de parametro
  const fijas = RUTAS.filter(([p]) => !p.includes(':'));
  for (const [p, C] of fijas) if (p === path) return { C, params: {}, base: p === '/' ? '/' : `/${p.split('/')[1]}` };
  for (const [p, C] of RUTAS.filter(([x]) => x.includes(':'))) {
    let params;
    try { params = coincide(p, path); } catch { continue; }
    if (params) return { C, params, base: `/${p.split('/')[1]}` };
  }
  return null;
}

export default function App() {
  const { usuario, cargando, salir } = useAuth();
  const { path, query } = useRuta();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const menu = useRef(null);
  const abrirMenu = useRef(null);
  useEffect(() => {
    setMenuAbierto(false);
    const cuadro = requestAnimationFrame(() => document.getElementById('titulo-pagina')?.focus());
    return () => cancelAnimationFrame(cuadro);
  }, [path]);
  useEffect(() => {
    if (!menuAbierto || !usuario) return undefined;
    const panel = menu.current;
    const scroll = window.scrollY;
    const estilos = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    const overflowRaiz = document.documentElement.style.overflow;
    Object.assign(document.body.style, { overflow: 'hidden', position: 'fixed', top: `-${scroll}px`, width: '100%' });
    document.documentElement.style.overflow = 'hidden';
    const controles = () => [...panel.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')];
    controles()[0]?.focus();
    // El enfoque de la página tras iniciar sesión puede coincidir con la apertura.
    const cuadroFoco = requestAnimationFrame(() => {
      if (!panel.contains(document.activeElement)) (controles()[0] || panel).focus();
    });
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setMenuAbierto(false); }
      if (e.key !== 'Tab') return;
      const items = controles();
      const primero = items[0], ultimo = items[items.length - 1];
      if (!primero) { e.preventDefault(); panel.focus(); }
      else if (e.shiftKey && (document.activeElement === primero || !panel.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !panel.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
    };
    const mantenerFoco = (e) => { if (!panel.contains(e.target)) controles()[0]?.focus(); };
    const escritorio = window.matchMedia('(min-width: 1024px)');
    const cerrarEnEscritorio = (e) => { if (e.matches) setMenuAbierto(false); };
    escritorio.addEventListener('change', cerrarEnEscritorio);
    document.addEventListener('keydown', tecla);
    document.addEventListener('focusin', mantenerFoco);
    return () => {
      cancelAnimationFrame(cuadroFoco);
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('focusin', mantenerFoco);
      escritorio.removeEventListener('change', cerrarEnEscritorio);
      Object.assign(document.body.style, estilos);
      document.documentElement.style.overflow = overflowRaiz;
      window.scrollTo(0, scroll);
      abrirMenu.current?.focus();
    };
  }, [menuAbierto, usuario]);

  if (cargando) return <div className="carga-inicial"><Cargando texto="Verificando tu sesión" /></div>;
  if (!usuario) return path === '/' ? <Landing /> : path === '/registro' ? <Registro /> : <Login />;
  if (path === '/login' || path === '/registro') { ir('/'); return null; }

  const hallada = elegir(path);
  const grupos = [...new Set(MENU.map((m) => m.grupo))];
  const visibles = MENU.filter((m) => puedeVer(usuario, m.ruta));

  let contenido;
  if (!hallada || (hallada.params.id && (!/^[1-9]\d*$/.test(hallada.params.id) || !Number.isSafeInteger(Number(hallada.params.id))))) contenido = <Pagina titulo="Página no encontrada" ayuda="Esa dirección no corresponde a un registro válido." acciones={<a className="btn btn-sec" href="#/">Volver a Inicio</a>} />;
  else if (!puedeVer(usuario, hallada.base) || (ROLES_ALTA[path] && !tiene(usuario, ...ROLES_ALTA[path]))) contenido = <Pagina titulo="Sin acceso" ayuda="Esta pantalla no está habilitada para tus roles actuales." acciones={<a className="btn btn-pri" href="#/">Volver a Inicio</a>} />;
  else if (usuario.roles.includes('ADMINISTRADOR') && ['/recepciones', '/cierres'].includes(path)) {
    const C = hallada.C;
    contenido = <><C params={hallada.params} query={query} /><ConsultaGlobal key={path} recurso={path.slice(1)} /></>;
  }
  else { const C = hallada.C; contenido = <C key={path} params={hallada.params} query={query} />; }

  return (
    <div className="app">
      <a className="saltar" inert={menuAbierto ? '' : undefined} aria-hidden={menuAbierto || undefined} href="#contenido-principal" onClick={(e) => { e.preventDefault(); document.getElementById('contenido-principal')?.focus(); }}>Saltar al contenido</a>
      <div className={`lateral-velo${menuAbierto ? ' abierto' : ''}`} aria-hidden="true" onClick={() => setMenuAbierto(false)} />
      <div ref={menu} className={`lateral${menuAbierto ? ' abierto' : ''}`} role={menuAbierto ? 'dialog' : undefined} aria-modal={menuAbierto || undefined} aria-label={menuAbierto ? 'Menú principal' : undefined} id="menu-lateral" tabIndex={-1}>
        <div className="menu-cabecera">
          <a className="marca" href="#/" aria-label="EcoRAEE, inicio" onClick={() => setMenuAbierto(false)}><span className="marca-simbolo"><Leaf size={18} /></span>EcoRAEE</a>
          <button type="button" className="btn btn-sec menu-cerrar" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)}><X size={20} aria-hidden="true" /></button>
        </div>
        <nav aria-label="Principal">
        {grupos.map((g) => {
          const items = visibles.filter((m) => m.grupo === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <h2>{g}</h2>
              <ul>{items.map((m) => (
                <li key={m.ruta}><a href={`#${m.ruta}`} onClick={() => setMenuAbierto(false)} aria-current={(m.ruta === '/' ? path === '/' : path === m.ruta || path.startsWith(`${m.ruta}/`)) ? 'page' : undefined}><Icono ruta={m.ruta} /><span>{m.titulo}</span></a></li>
              ))}</ul>
            </div>
          );
        })}
        </nav>
        <div className="lateral-pie">EcoRAEE Cloud<small>Trazabilidad de principio a fin</small></div>
      </div>
      <div className="cuerpo" inert={menuAbierto ? '' : undefined} aria-hidden={menuAbierto || undefined}>
        <div className="barra">
          <button ref={abrirMenu} type="button" className="btn btn-sec menu-btn" aria-label="Abrir menú" aria-expanded={menuAbierto} aria-controls="menu-lateral" onClick={() => setMenuAbierto((x) => !x)}><Menu size={20} aria-hidden="true" /></button>
          <div className="ubicacion-barra">Espacio de trabajo <span>/</span> <strong>{MENU.find(m => m.ruta === hallada?.base)?.titulo || 'Detalle'}</strong></div>
          <MenuPerfil nombre={usuario.nombre_visible} detalle={usuario.roles.map((r) => ROLES[r] || r).join(', ')} alSalir={() => salir()} />
        </div>
        <main className="contenido" id="contenido-principal" tabIndex={-1}>{contenido}</main>
      </div>
    </div>
  );
}
