import { useState } from 'react';
import { Leaf, Menu, X } from 'lucide-react';
import { Boton, Marca, Titulo } from '../atomos/index.jsx';
import { CINTA, SATELITES, SECCIONES } from '../datos/contenido.js';
import { irASeccion } from '../hooks/index.js';

export function Encabezado() {
  const [abierto, setAbierto] = useState(false);
  const ir = (id) => { setAbierto(false); irASeccion(id); };
  return (
    <header className="eco-nav">
      <Marca />
      <nav className={`eco-nav-links${abierto ? ' abierto' : ''}`} aria-label="Secciones" id="eco-menu">
        {SECCIONES.map((s) => <button type="button" key={s.id} onClick={() => ir(s.id)}>{s.texto}</button>)}
      </nav>
      <div className="eco-nav-acciones">
        <button type="button" className="eco-nav-menu" aria-label="Abrir menú" aria-expanded={abierto} aria-controls="eco-menu" onClick={() => setAbierto(!abierto)}>{abierto ? <X size={20} /> : <Menu size={20} />}</button>
        <Boton chico href="#/login">Ingresar</Boton>
      </div>
    </header>
  );
}

export function Heroe() {
  return (
    <section className="eco-heroe" aria-labelledby="t-heroe">
      <div className="eco-envoltura eco-heroe-contenido">
        <Titulo nivel={1} id="t-heroe">Tus aparatos viejos no son basura, son un tesoro en pausa</Titulo>
        <p className="eco-sub">Seguimos cada equipo desde tus manos hasta su segunda vida, con evidencia en cada parada.</p>
        <div className="eco-orbita" aria-hidden="true">
          <div className="eco-anillo r1">
            {SATELITES.map((Ic, i) => {
              const a = (i / SATELITES.length) * Math.PI * 2 - Math.PI / 2;
              return <span key={i} className="eco-satelite" style={{ left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%` }}><Ic size={22} /></span>;
            })}
          </div>
          <div className="eco-anillo r2" /><div className="eco-anillo r3" />
          <div className="eco-nucleo"><Leaf /></div>
        </div>
      </div>
      <div className="eco-cinta" aria-hidden="true">
        <div>{[...CINTA, ...CINTA, ...CINTA].map((p, i) => <span key={i}>{p}<i /></span>)}</div>
      </div>
    </section>
  );
}
