import { useId, useState } from 'react';
import { ArrowRight, Cloud, Eye, EyeOff, Leaf, Lock, User } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAccion, useForm } from '../lib/hooks.js';
import { Alerta, Boton, ErrorApi } from '../components/ui.jsx';

const HOJA = 'M8 40C8 22 20 8 42 6c0 22-12 34-30 34z';
const Hoja = ({ className }) => <svg className={`acceso-hoja ${className}`} viewBox="0 0 48 48" aria-hidden="true"><path d={HOJA} /></svg>;

function CampoIcono({ label, Icono, accion, ...r }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{label}<span aria-hidden="true"> *</span></label>
      <div className="campo-icono">
        <Icono size={19} aria-hidden="true" />
        <input id={id} required {...r} />
        {accion}
      </div>
    </div>
  );
}

function PanelAcceso({ children }) {
  return (
    <div className="acceso-pagina">
      <svg className="acceso-curvas" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="acceso-verde" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0f5c3f" /><stop offset=".55" stopColor="#16895c" /><stop offset="1" stopColor="#2fb37c" /></linearGradient>
        </defs>
        <path d="M0 0H880C830 120 830 230 900 340C970 460 950 610 880 740C820 850 870 930 800 1000H0Z" fill="#c9efd6" />
        <path d="M0 0H770C740 130 780 220 860 330C930 450 930 590 860 720C800 830 730 910 680 1000H0Z" fill="url(#acceso-verde)" />
        <path d="M0 860C150 830 300 880 430 1000H0Z" fill="#0f5c3f" />
      </svg>
      <Hoja className="h1" /><Hoja className="h2" /><Hoja className="h3" /><Hoja className="h4" />
      <aside className="acceso-panel" aria-hidden="true">
        <span className="marca"><span className="marca-simbolo"><Leaf size={18} /></span>EcoRAEE</span>
        <div className="acceso-texto">
          <h2>Dale a tus equipos <b>una segunda vida</b></h2>
          <p>Trazabilidad de residuos electrónicos de principio a fin, con evidencia en cada etapa.</p>
        </div>
        <div className="acceso-escena"><img src={`${import.meta.env.BASE_URL}imagenes/acceso-escena.png`} alt="" /></div>
        <small><Cloud size={16} />EcoRAEE Cloud</small>
      </aside>
      <div className="acceso-lado">{children}</div>
    </div>
  );
}

export default function Login() {
  const { entrar, aviso } = useAuth();
  const f = useForm({ nombre: '', clave: '' });
  const [verClave, setVerClave] = useState(false);
  const acc = useAccion(entrar);
  const enviar = (e) => { e.preventDefault(); acc.ejecutar(f.v.nombre.trim(), f.v.clave); };
  const OjoIcono = verClave ? EyeOff : Eye;
  return (
    <PanelAcceso>
      <main className="login">
        <h1>Ingresar</h1>
        <p className="ayuda">Accede con tu usuario y contraseña.</p>
        {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}
        <form onSubmit={enviar} noValidate>
          <CampoIcono label="Usuario" Icono={User} placeholder="Ingresa tu usuario" autoComplete="username" {...f.enlazar('nombre')} />
          <CampoIcono
            label="Contraseña" Icono={Lock} placeholder="Ingresa tu contraseña" type={verClave ? 'text' : 'password'} autoComplete="current-password" {...f.enlazar('clave')}
            accion={<button type="button" className="campo-ojo" aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVerClave((x) => !x)}><OjoIcono size={19} /></button>}
          />
          <label className="campo campo-check"><input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} /> Mostrar contraseña</label>
          <ErrorApi error={acc.error} ayuda={{ 401: 'Revisa usuario y contraseña. Si sigues sin entrar, pide ayuda al administrador.' }} />
          <Boton type="submit" enviando={acc.enviando} disabled={!f.v.nombre || !f.v.clave}>Ingresar <ArrowRight size={18} /></Boton>
        </form>
        <p className="login-separador"><span>¿Aún no tienes cuenta? <a href="#/registro">Regístrate</a></span></p>
        <p className="login-pie"><a href="#/">Volver al inicio</a></p>
      </main>
    </PanelAcceso>
  );
}

// El sistema no tiene registro abierto: las cuentas las crea un administrador.
export function Registro() {
  return (
    <PanelAcceso>
      <main className="login">
        <h1>Regístrate</h1>
        <p className="ayuda">Por seguridad, cada cuenta se habilita según la organización y el rol de quien la usa.</p>
        <ol className="login-pasos">
          <li>Solicita tu acceso al administrador de tu organización.</li>
          <li>El administrador crea tu cuenta y te asigna un rol.</li>
          <li>Recibes tu usuario y tu contraseña inicial.</li>
        </ol>
        <a className="btn btn-pri" href="#/login">Ya tengo cuenta <ArrowRight size={18} /></a>
        <p className="login-pie"><a href="#/">Volver al inicio</a></p>
      </main>
    </PanelAcceso>
  );
}
