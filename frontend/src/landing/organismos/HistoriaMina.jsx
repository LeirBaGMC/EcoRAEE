import { useMemo } from 'react';
import { Burbuja, Titulo } from '../atomos/index.jsx';
import { Nodo } from '../moleculas/index.jsx';
import { PIEZAS, RED_MINA } from '../datos/contenido.js';
import { construirRed } from '../lib/redMina.js';
import { crearPlaneta } from '../lib/escenaPlaneta.js';
import { gsap, useAnimacion, useConsulta, useEscena3D } from '../hooks/index.js';

const RADIOS = {
  ancho: { n1: [21, 31], n2: [35, 41], n3: [47, 48] },
  angosto: { n1: [31, 25], n2: [40, 36], n3: [47, 46] },
};

// Posición de cada pieza del teléfono, en % de su propio tamaño.
const salida = (p) => ({ xPercent: (p.x * 10000) / p.w, yPercent: (p.y * 10000) / p.h });

function animar(raiz) {
  const telefono = raiz.querySelector('.eco-telefono');
  const planeta = raiz.querySelector('.eco-planeta');
  const piezas = gsap.utils.toArray('.eco-pieza', raiz);
  const fichas = gsap.utils.toArray('.eco-ficha', raiz);
  const pulsos = raiz.querySelector('.eco-pulsos');
  const [cap1, cap2] = gsap.utils.toArray('.eco-cap', raiz);
  const campo = raiz.querySelector('.eco-campo');
  const lineas = (n) => gsap.utils.toArray(`.eco-enlace.l${n}`, raiz);
  const nodos = (n) => gsap.utils.toArray(`.eco-ancla.n${n}`, raiz);
  const desdeCentro = { x: (_, el) => campo.offsetWidth / 2 - el.offsetLeft, y: (_, el) => campo.offsetHeight / 2 - el.offsetTop, scale: 0, autoAlpha: 0 };
  const llega = { x: 0, y: 0, scale: 1, autoAlpha: 1 };
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.set(cap2, { autoAlpha: 0, y: 24 });
    gsap.set(pulsos, { autoAlpha: 0 });

    // El teléfono cae mientras la sección sube: al llegar ya está en su sitio.
    gsap.fromTo(telefono, { y: () => -window.innerHeight * 0.95, rotation: 32, scale: 0.85 }, {
      y: 0, rotation: 0, scale: 1, ease: 'power2.in',
      scrollTrigger: { trigger: raiz, start: 'top bottom', end: 'top 8%', scrub: 0.3, invalidateOnRefresh: true },
    });

    const largo = () => `+=${window.innerWidth < 768 ? 300 : 340}%`;
    const tl = gsap.timeline({ scrollTrigger: { trigger: raiz, start: 'top top', end: largo, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true } });
    tl.to({}, { duration: 0.5 })
      .to(cap1, { autoAlpha: 0, y: -24, duration: 0.5 })
      .to(cap2, { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.2');
    PIEZAS.forEach((p, i) => {
      tl.to(piezas[i], { ...salida(p), rotation: p.r, scale: 0.72, duration: 1.2, ease: 'power3.out' }, i === 0 ? '<' : '<0.1');
    });
    tl.to(fichas, { opacity: 1, duration: 0.4, stagger: 0.08 }, '-=0.7').to({}, { duration: 0.5 });

    // Las piezas se funden en el planeta y de él nace la red.
    tl.addLabel('red')
      .to(fichas, { opacity: 0, duration: 0.25 }, 'red')
      .to(piezas, { xPercent: 0, yPercent: 0, rotation: 0, scale: 0, opacity: 0, duration: 0.9, ease: 'power2.in' }, 'red')
      .fromTo(planeta, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.5)' }, 'red+=0.6')
      .fromTo(lineas(1), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.04, ease: 'none' })
      .fromTo(nodos(1), desdeCentro, { ...llega, duration: 0.8, stagger: 0.05, ease: 'back.out(1.3)' }, '<')
      .fromTo(lineas(2), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.02, ease: 'none' }, '-=0.15')
      .fromTo(nodos(2), desdeCentro, { ...llega, duration: 0.7, stagger: 0.02, ease: 'power3.out' }, '<')
      .fromTo(lineas(3), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, stagger: 0.01, ease: 'none' }, '-=0.1')
      .fromTo(nodos(3), desdeCentro, { ...llega, duration: 0.6, stagger: 0.01, ease: 'power3.out' }, '<')
      .to(pulsos, { autoAlpha: 1, duration: 0.3 })
      .to({}, { duration: 1 });

    gsap.to(raiz.querySelector('.eco-progreso i'), { scaleY: 1, ease: 'none', scrollTrigger: { trigger: raiz, start: 'top top', end: largo, scrub: true } });
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(cap1, { autoAlpha: 0 });
    gsap.set(piezas, { autoAlpha: 0 });
    gsap.set(planeta, { opacity: 1 });
    gsap.set('.eco-enlace', { strokeDashoffset: 0 });
  });
}

export function HistoriaMina() {
  const ref = useAnimacion(animar);
  const planetaRef = useEscena3D(crearPlaneta);
  const angosto = useConsulta('(max-width: 767px)');
  const { nodos, enlaces } = useMemo(() => construirRed(RED_MINA, angosto ? RADIOS.angosto : RADIOS.ancho), [angosto]);
  return (
    <section className="eco-historia" id="historia" ref={ref} aria-label="Valor oculto en los equipos electrónicos">
      <div className="eco-caps">
        <div className="eco-cap">
          <Titulo nivel={2}>Cada equipo en desuso conserva un valor por recuperar</Titulo>
          <p className="eco-sub">Teléfonos, computadoras y monitores almacenados o desechados representan recursos que aún pueden volver a la cadena productiva</p>
        </div>
        <div className="eco-cap">
          <Titulo nivel={2}>Ábrelos, dentro hay una mina</Titulo>
          <p className="eco-sub">Cada dispositivo se conecta con componentes y materiales que pueden tener una nueva vida</p>
        </div>
      </div>
      <div className="eco-campo" aria-hidden="true">
        <svg className="eco-enlaces">
          {enlaces.map((e, i) => <line key={i} className={`eco-enlace l${e.nivel}`} pathLength="1" x1={`${e.a.x}%`} y1={`${e.a.y}%`} x2={`${e.b.x}%`} y2={`${e.b.y}%`} />)}
          <g className="eco-pulsos">
            {enlaces.filter((e) => e.nivel < 3).map((e, i) => <line key={i} className="eco-pulso" pathLength="1" x1={`${e.a.x}%`} y1={`${e.a.y}%`} x2={`${e.b.x}%`} y2={`${e.b.y}%`} style={{ animationDelay: `${-(i * 0.47) % 3.4}s` }} />)}
          </g>
        </svg>
        <div className="eco-planeta" ref={planetaRef} />
        {nodos.n3.map((p, i) => <Nodo key={i} nivel={3} punto={p} info={p.nombre}><span className="eco-grano" /></Nodo>)}
        {nodos.n2.map((p, i) => <Nodo key={i} nivel={2} punto={p} info={p.info}><span className="eco-chip">{p.nombre}</span></Nodo>)}
        {nodos.n1.map((p) => <Nodo key={p.item.nombre} nivel={1} punto={p} info={p.item.info}><Burbuja Icono={p.item.Icono} /><span>{p.item.nombre}</span></Nodo>)}
        <div className="eco-escena">
          <div className="eco-telefono">
            {PIEZAS.map(({ k, w, h, Icono, etiqueta }) => (
              <div key={k} className={`eco-pieza ${k}`} style={{ '--w': `${w}%`, '--h': `${h}%` }}>
                <Icono strokeWidth={1.5} />
                <span className="eco-ficha">{etiqueta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="eco-progreso" aria-hidden="true"><i /></div>
    </section>
  );
}
