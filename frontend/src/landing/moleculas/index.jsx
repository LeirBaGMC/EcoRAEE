import { useRef, useState } from 'react';
import { Burbuja, Etiqueta, Titulo } from '../atomos/index.jsx';
import { useEscena3D } from '../hooks/index.js';
import { crearBarras3D, crearDona3D } from '../lib/escenaGraficos.js';

export function CabeceraSeccion({ id, titulo, sub }) {
  return (
    <div className="eco-cabecera">
      <Titulo nivel={2} id={id}>{titulo}</Titulo>
      {sub && <p className="eco-sub">{sub}</p>}
    </div>
  );
}

export function Tarjeta({ col, colMd, children }) {
  return <article className="eco-tarjeta" style={{ '--col': col, '--col-md': colMd }}>{children}</article>;
}

export function Barras3D({ datos, densas, alto, descripcion }) {
  const tip = useRef(null);
  const lienzo = useEscena3D((THREE, escena, cont) => crearBarras3D(THREE, escena, cont, { datos, densas, tip }), true);
  return (
    <div className="eco-g3d" style={alto ? { '--alto': alto } : undefined} role="img" aria-label={descripcion}>
      <div className="eco-g3d-lienzo" ref={lienzo} />
      <span className="eco-g3d-tip" ref={tip} aria-hidden="true" />
    </div>
  );
}

export function Dona3D({ segmentos, centro, alto }) {
  const [activo, setActivo] = useState(null);
  const activoRef = useRef(null);
  const elegir = (i) => { activoRef.current = i; setActivo(i); };
  const lienzo = useEscena3D((THREE, escena, cont) => crearDona3D(THREE, escena, cont, { segmentos, activo: activoRef, alCambiar: elegir }), true);
  const seg = activo === null ? centro : { valor: `${segmentos[activo].valor} %`, texto: segmentos[activo].nombre };
  return (
    <>
      <div className="eco-g3d" style={alto ? { '--alto': alto } : undefined} role="img" aria-label={segmentos.map((s) => `${s.nombre}: ${s.valor} %`).join(', ')}>
        <div className="eco-g3d-lienzo" ref={lienzo} />
        <div className="eco-dona-centro"><b>{seg.valor}</b><span>{seg.texto}</span></div>
      </div>
      <div className="eco-leyenda">
        {segmentos.map((s, i) => (
          <button type="button" key={s.nombre} onMouseEnter={() => elegir(i)} onMouseLeave={() => elegir(null)} onFocus={() => elegir(i)} onBlur={() => elegir(null)}>
            <i style={{ '--c': s.hex }} />{s.nombre}
          </button>
        ))}
      </div>
    </>
  );
}

export function Hallazgo({ item }) {
  const { Icono, t, d } = item;
  return <article className="eco-hallazgo"><Burbuja Icono={Icono} /><div><Titulo nivel={4}>{t}</Titulo><p>{d}</p></div></article>;
}

export function TileMosaico({ item, copia }) {
  const { Icono, t, d, tag } = item;
  return (
    <article className="eco-tile" tabIndex={copia ? -1 : 0} aria-hidden={copia || undefined}>
      <Burbuja Icono={Icono} />
      <div className="eco-tile-texto">
        <Titulo nivel={4}>{t}</Titulo>
        <Etiqueta>{tag}</Etiqueta>
        <div className="eco-tile-detalle"><p>{d}</p></div>
      </div>
    </article>
  );
}

// Nodo de la red de la mina, ubicado en % del campo.
export function Nodo({ nivel, punto, info, children }) {
  return (
    <div className={`eco-ancla n${nivel}`} style={{ left: `${punto.x}%`, top: `${punto.y}%`, '--cos': punto.cos.toFixed(3) }}>
      <div className="eco-cuerpo">
        {children}
        <span className={`eco-info ${punto.sin > 0 ? 'arriba' : 'abajo'}`}>{info}</span>
      </div>
    </div>
  );
}
