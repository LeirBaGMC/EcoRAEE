import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { MENU, ROLES, puedeVer } from './lib/permisos.js';
import { coincide, useRuta } from './lib/router.jsx';
import { Alerta, Cargando } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Icono from './components/Icono.jsx';
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

  if (cargando) return <div className="login"><Cargando texto="Verificando tu sesion" /></div>;
  if (!usuario) return <Login />;

  const hallada = elegir(path);
  const grupos = [...new Set(MENU.map((m) => m.grupo))];
  const visibles = MENU.filter((m) => puedeVer(usuario, m.ruta));

  let contenido;
  if (!hallada) contenido = <Alerta tipo="aviso" titulo="Pagina no encontrada">Esa direccion no existe. Usa el menu.</Alerta>;
  else if (!puedeVer(usuario, hallada.base)) contenido = <Alerta tipo="aviso" titulo="Sin acceso">Tu rol no ve esta pantalla. Si la necesitas, pide a un administrador revisar tu rol.</Alerta>;
  else { const C = hallada.C; contenido = <C params={hallada.params} query={query} />; }

  return (
    <div className="app">
      <a className="saltar" href="#contenido-principal" onClick={(e) => { e.preventDefault(); document.getElementById('contenido-principal')?.focus(); }}>Saltar al contenido</a>
      <nav className={`lateral${menuAbierto ? ' abierto' : ''}`} aria-label="Principal" id="menu-lateral">
        <a className="marca" href="#/" aria-label="EcoRAEE, inicio"><span className="marca-simbolo">↗</span><span>EcoRAEE<small>GESTIÓN CIRCULAR</small></span></a>
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
          <button type="button" className="btn btn-sec menu-btn" aria-expanded={menuAbierto} aria-controls="menu-lateral" onClick={() => setMenuAbierto((x) => !x)}>Menu</button>
          <div className="ubicacion-barra">Espacio de trabajo <span>/</span> <strong>{MENU.find(m => m.ruta === hallada?.base)?.titulo || 'Detalle'}</strong></div>
          <div className="quien"><span className="avatar">{usuario.nombre_visible?.slice(0, 2).toUpperCase()}</span><div><strong>{usuario.nombre_visible}</strong><small>{usuario.roles.map((r) => ROLES[r] || r).join(', ')}</small></div></div>
          <button type="button" className="btn btn-sec salir-btn" onClick={() => salir()}>Salir</button>
        </div>
        <main className="contenido" id="contenido-principal" tabIndex={-1}>{contenido}</main>
      </div>
    </div>
  );
}
