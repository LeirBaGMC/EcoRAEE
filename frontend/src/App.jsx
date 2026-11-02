import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { MENU, ROLES, puedeVer } from './lib/permisos.js';
import { coincide, ir, useRuta } from './lib/router.jsx';
import Landing from './landing/Landing.jsx';
import { Alerta, Cargando } from './components/ui.jsx';
import Login, { Registro } from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Icono from './components/Icono.jsx';
import MenuPerfil from './components/MenuPerfil.jsx';
import { Leaf, Menu } from 'lucide-react';
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

function elegir(path) {
  // las rutas fijas (/dispositivos/nuevo) van antes que las de parametro
  const fijas = RUTAS.filter(([p]) => !p.includes(':'));
  for (const [p, C] of fijas) if (p === path) return { C, params: {}, base: p };
  for (const [p, C] of RUTAS.filter(([x]) => x.includes(':'))) {
    const params = coincide(p, path);
    if (params) return { C, params, base: `/${p.split('/')[1]}` };
  }
  return null;
}

export default function App() {
  const { usuario, cargando, salir } = useAuth();
  const { path, query } = useRuta();

  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => { setMenuAbierto(false); document.getElementById('titulo-pagina')?.focus(); }, [path]);
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [menuAbierto]);

  if (cargando) return <div className="carga-inicial"><Cargando texto="Verificando tu sesión" /></div>;
  if (!usuario) return path === '/' ? <Landing /> : path === '/registro' ? <Registro /> : <Login />;
  if (path === '/login' || path === '/registro') { ir('/'); return null; }

  const hallada = elegir(path);
  const grupos = [...new Set(MENU.map((m) => m.grupo))];
  const visibles = MENU.filter((m) => puedeVer(usuario, m.ruta));

  let contenido;
  if (!hallada) contenido = <Alerta tipo="aviso" titulo="Página no encontrada">Esa dirección no existe. Usa el menú.</Alerta>;
  else if (!puedeVer(usuario, hallada.base)) contenido = <Alerta tipo="aviso" titulo="Sin acceso">Tu rol no ve esta pantalla. Si la necesitas, pide a un administrador revisar tu rol.</Alerta>;
  else { const C = hallada.C; contenido = <C params={hallada.params} query={query} />; }

  return (
    <div className="app">
      <a className="saltar" href="#contenido-principal" onClick={(e) => { e.preventDefault(); document.getElementById('contenido-principal')?.focus(); }}>Saltar al contenido</a>
      <div className={`lateral-velo${menuAbierto ? ' abierto' : ''}`} aria-hidden="true" onClick={() => setMenuAbierto(false)} />
      <nav className={`lateral${menuAbierto ? ' abierto' : ''}`} aria-label="Principal" id="menu-lateral">
        <a className="marca" href="#/" aria-label="EcoRAEE, inicio"><span className="marca-simbolo"><Leaf size={18} /></span>EcoRAEE</a>
        {grupos.map((g) => {
          const items = visibles.filter((m) => m.grupo === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <h2>{g}</h2>
              <ul>{items.map((m) => (
                <li key={m.ruta}><a href={`#${m.ruta}`} aria-current={(m.ruta === '/' ? path === '/' : path === m.ruta || path.startsWith(`${m.ruta}/`)) ? 'page' : undefined}><Icono ruta={m.ruta} /><span>{m.titulo}</span></a></li>
              ))}</ul>
            </div>
          );
        })}
        <div className="lateral-pie">EcoRAEE Cloud<small>Trazabilidad de principio a fin</small></div>
      </nav>
      <div className="cuerpo">
        <div className="barra">
          <button type="button" className="btn btn-sec menu-btn" aria-label="Abrir menú" aria-expanded={menuAbierto} aria-controls="menu-lateral" onClick={() => setMenuAbierto((x) => !x)}><Menu size={20} aria-hidden="true" /></button>
          <div className="ubicacion-barra">Espacio de trabajo <span>/</span> <strong>{MENU.find(m => m.ruta === hallada?.base)?.titulo || 'Detalle'}</strong></div>
          <MenuPerfil nombre={usuario.nombre_visible} detalle={usuario.roles.map((r) => ROLES[r] || r).join(', ')} alSalir={() => salir()} />
        </div>
        <main className="contenido" id="contenido-principal" tabIndex={-1}>{contenido}</main>
      </div>
    </div>
  );
}
