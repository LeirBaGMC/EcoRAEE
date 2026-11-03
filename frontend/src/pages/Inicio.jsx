import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { MENU, puedeVer, R_, tiene } from '../lib/permisos.js';
import { Pagina } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

const DESCRIPCION = {
  '/dispositivos': 'Registra equipos y revisa su estado e historial.',
  '/solicitudes': 'Agrupa dispositivos en lotes y pide su recolección o entrega.',
  '/recepciones': 'Registra lo que llega a tu centro y si viene conforme.',
  '/movimientos': 'Programa, autoriza, despacha y cierra traslados entre centros.',
  '/tratamientos': 'Inicia y finaliza reacondicionamiento, reciclaje o disposición.',
  '/asignaciones': 'Entrega de equipos reutilizables a entidades beneficiarias.',
  '/cierres': 'Cierra la trazabilidad con destino final y fecha confirmada.',
  '/evidencias': 'Sube y consulta actas, guias y certificados.',
  '/escenarios': 'Calcula flujo máximo y cuellos de botella de la red.',
  '/seguimiento': 'Indicadores de la red y alertas por atender.',
  '/red': 'Centros y conexiones con su capacidad por periodo.',
  '/usuarios': 'Crea usuarios, cambia roles y activa o desactiva cuentas.',
  '/organizaciones': 'Organizaciones y sus tipos de actor.',
  '/auditoria': 'Cambios registrados en el sistema.',
};

export default function Inicio() {
  const { usuario } = useAuth();
  const items = MENU.filter((m) => m.ruta !== '/' && puedeVer(usuario, m.ruta));
  const prioridad = usuario.roles.includes('ADMINISTRADOR') ? '/usuarios' : usuario.roles.includes('COORDINADOR_LOGISTICO') ? '/movimientos' : usuario.roles.includes('ENTIDAD_BENEFICIARIA') ? '/asignaciones' : usuario.roles.includes('REACONDICIONADOR_RECICLADOR') ? '/tratamientos' : '/dispositivos';
  const principal = items.find(m => m.ruta === prioridad) || items[0];
  const admin = usuario.roles.includes('ADMINISTRADOR');
  const descripcion = (ruta) => {
    if (ruta === '/dispositivos' && !tiene(usuario, R_.G, R_.O)) return tiene(usuario, R_.T) ? 'Consulta los equipos y registra su evaluación técnica.' : 'Consulta los equipos, su estado e historial.';
    if (ruta === '/solicitudes' && !tiene(usuario, R_.G)) return tiene(usuario, R_.C) ? 'Programa recolecciones y confirma su ejecución.' : 'Consulta las solicitudes disponibles para recibir equipos.';
    if (ruta === '/movimientos') return tiene(usuario, R_.C) && tiene(usuario, R_.O) ? DESCRIPCION[ruta] : tiene(usuario, R_.C) ? 'Programa, autoriza y cierra traslados entre centros.' : 'Despacha movimientos autorizados y adjunta su guía.';
    if (ruta === '/asignaciones' && !tiene(usuario, R_.C)) return 'Consulta los equipos asignados a tu entidad y confirma su recepción.';
    if (ruta === '/evidencias') return tiene(usuario, R_.O, R_.R) && !tiene(usuario, R_.T, R_.C, R_.A) ? 'Adjunta documentos a los registros del proceso.' : !tiene(usuario, R_.O, R_.R, R_.T, R_.C) ? 'Consulta y abre documentos según el propósito de acceso.' : DESCRIPCION[ruta];
    return DESCRIPCION[ruta];
  };
  const secundarios = items.filter((m) => m !== principal);
  return (
    <Pagina titulo={admin ? 'Panel de administración' : 'Tu espacio de trabajo'} ayuda={`Bienvenido, ${usuario.nombre_visible}. ${admin ? 'Organiza tu red y mantén el control de los accesos.' : 'Continúa con la gestión y el seguimiento de los equipos.'}`}>
      <div className="inicio-layout">
        <section className="inicio-principal">
          <div className="destacado">
            <h2>{admin ? 'Un equipo conectado,\nuna red con propósito' : 'Cada equipo tiene\nuna nueva oportunidad'}</h2>
            <p>{admin ? 'Gestiona las cuentas y los roles de quienes hacen posible la recuperación de equipos.' : principal && descripcion(principal.ruta)}</p>
            {principal && <a className="btn btn-pri" href={`#${principal.ruta}`}>{admin ? 'Gestionar usuarios' : `Ir a ${principal.titulo.toLowerCase()}`}<ArrowUpRight size={16} aria-hidden="true" /></a>}
          </div>
          {secundarios.length > 0 && <><div className="titulo-bloque"><h2>Herramientas de trabajo</h2><span>Según tus permisos</span></div>
          <div className="accesos-grid">{secundarios.map(m => <a className="acceso" href={`#${m.ruta}`} key={m.ruta}><span className="acceso-icono"><Icono ruta={m.ruta}/></span><div><h3>{m.titulo}</h3><p>{descripcion(m.ruta)}</p></div><ArrowUpRight className="flecha" size={16} aria-hidden="true" /></a>)}</div></>}
        </section>
        <aside className="inicio-aside">
          <h2>De residuo a recurso</h2><p className="nota">Cada etapa conserva su historia y su responsable.</p>
          <ol className="recorrido">{[['Registro','Identificar y recibir los equipos.'],['Evaluación','Definir su condición y potencial.'],['Destino','Reutilizar, reparar o reciclar.'],['Trazabilidad','Documentar y confirmar el cierre.']].map(([titulo,texto],i)=><li key={titulo}><span>{i + 1}</span><div><strong>{titulo}</strong><p>{texto}</p></div></li>)}</ol>
          <div className="nota-circular"><RefreshCw size={20} aria-hidden="true" /><p>Más vida útil.<br/><strong>Menos residuos electrónicos.</strong></p></div>
        </aside>
      </div>
    </Pagina>
  );
}
