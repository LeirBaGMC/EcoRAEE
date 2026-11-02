import { useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Boton, Burbuja, Etiqueta, Titulo } from '../atomos/index.jsx';
import { ETAPAS_RUTA, PARADAS } from '../datos/contenido.js';
import { crearProceso } from '../lib/escenaProceso.js';
import { PARADAS_RUTA, avanceRuta } from '../lib/escenaRuta.js';
import { ScrollTrigger, gsap, useAnimacion, useEscena3D } from '../hooks/index.js';

const INDICE_MAPA = 3;
// Peso de cada parada en el recorrido: el traslado dura más porque el camión hace toda la ruta.
const PESOS = PARADAS.map((_, i) => (i === INDICE_MAPA ? 3.4 : 1));
const TOTAL = PESOS.reduce((a, b) => a + b, 0);

function ubicar(p) {
  let acumulado = 0;
  for (let i = 0; i < PESOS.length; i += 1) {
    const f = PESOS[i] / TOTAL;
    if (p < acumulado + f || i === PESOS.length - 1) return { parada: i, local: Math.min((p - acumulado) / f, 1) };
    acumulado += f;
  }
  return { parada: 0, local: 0 };
}
const inicioDe = (i) => PESOS.slice(0, i).reduce((a, b) => a + b, 0) / TOTAL;
const etapaDe = (local) => PARADAS_RUTA.reduce((a, t, i) => (avanceRuta(local) + 0.01 >= t ? i : a), 0);

export function Proceso() {
  const estado = useRef({ parada: 0, local: 0 });
  const etiquetas = useRef([]);
  const disparador = useRef(null);
  const [vista, setVista] = useState({ parada: 0, etapa: 0 });
  const lienzo = useEscena3D((THREE, escena) => crearProceso(THREE, escena, { estado, etiquetas }), true);

  const fijar = (u) => {
    estado.current = u;
    setVista((v) => { const etapa = etapaDe(u.parada === INDICE_MAPA ? u.local : 0); return v.parada === u.parada && v.etapa === etapa ? v : { parada: u.parada, etapa }; });
  };
  const ref = useAnimacion((raiz) => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      disparador.current = ScrollTrigger.create({
        trigger: raiz, start: 'top top', end: `+=${TOTAL * 85}%`, pin: true, anticipatePin: 1,
        onUpdate: (s) => fijar(ubicar(s.progress)),
      });
    });
  });
  // Con movimiento reducido no hay scroll fijado: los puntos cambian de parada.
  const ir = (i) => {
    const st = disparador.current;
    if (st) window.scrollTo({ top: st.start + (st.end - st.start) * (inicioDe(i) + 0.002), behavior: 'smooth' });
    else fijar({ parada: i, local: 1 });
  };

  const { parada, etapa } = vista;
  const p = PARADAS[parada];
  const esMapa = parada === INDICE_MAPA;
  const enTarjeta = !esMapa;
  const lado = parada % 2 === 0 ? 'texto-izq' : 'texto-der';
  return (
    <section className={`eco-proceso ${lado}${esMapa ? ' mapa' : ''}`} id="proceso" ref={ref} aria-labelledby="t-proceso">
      <div className="eco-proc-cab">
        <Titulo nivel={2} id="t-proceso">Del cajón a su segunda vida en 6 paradas</Titulo>
        <ol className="eco-proc-puntos">
          {PARADAS.map((x, i) => (
            <li key={x.t}><button type="button" className={i === parada ? 'activa' : i < parada ? 'hecha' : ''} aria-label={`Parada ${i + 1}: ${x.t}`} aria-current={i === parada ? 'step' : undefined} onClick={() => ir(i)}>{i < parada ? <Check size={13} /> : i + 1}</button></li>
          ))}
        </ol>
      </div>
      <div className="eco-proc-lienzo" aria-hidden="true">
        <div className="eco-proc-canvas" ref={lienzo} />
        {ETAPAS_RUTA.map((e, i) => <span key={e.t} className="eco-mapa-etq" ref={(el) => { etiquetas.current[i] = el; }}>{e.t}</span>)}
      </div>
      <div className="eco-proc-texto" key={parada} aria-live="polite">
        <div className={`eco-proc-recuadro${enTarjeta ? ' eco-recuadro-blanco' : ''}`}>
          {!enTarjeta && <><Burbuja Icono={p.Icono} tam="3.2rem" /><small>Parada {parada + 1}</small></>}
          <Titulo nivel={3}>{esMapa ? 'Trazabilidad en cada etapa del recorrido' : p.t}</Titulo>
          <p>{esMapa ? 'Cada traslado queda registrado. El propietario consulta en todo momento dónde se encuentra su equipo y en qué estado está.' : p.d}</p>
          {enTarjeta && parada < PARADAS.length - 1 && <><hr /><Boton chico onClick={() => ir(parada + 1)}>Siguiente parada <ArrowRight size={16} /></Boton></>}
          {parada === PARADAS.length - 1 && <><hr /><Etiqueta>Y listo, misión cumplida</Etiqueta></>}
          {esMapa && (
            <ol className="eco-etapas">
              {ETAPAS_RUTA.map((e, i) => (
                <li key={e.t} className={`eco-etapa${i === etapa ? ' activa' : i < etapa ? ' hecha' : ''}`}>
                  <i aria-hidden="true">{i <= etapa ? <Check size={14} /> : i + 1}</i>
                  <div><b>{e.t}</b><span>{e.d}</span></div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
