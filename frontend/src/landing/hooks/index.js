import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Corre animaciones GSAP limitadas a un elemento y las limpia al desmontar.
export function useAnimacion(montar) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => montar(ref.current), ref);
    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

// true la primera vez que el elemento entra en pantalla.
export function useVisible(ref, umbral = 0.3) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: umbral });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, umbral]);
  return visible;
}

export function useConsulta(consulta) {
  const [coincide, setCoincide] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const f = () => setCoincide(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [consulta]);
  return coincide;
}

// Monta una escena de Three.js: carga la librería solo aquí y dibuja mientras se ve.
export function useEscena3D(crear, sombras = false) {
  const ref = useRef(null);
  useEffect(() => {
    const cont = ref.current;
    let vivo = true;
    let limpiar = () => {};
    import('three').then((THREE) => {
      if (!vivo) return;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = sombras;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      cont.appendChild(renderer.domElement);
      const escena = new THREE.Scene();
      const { camara, cuadro, ajustar } = crear(THREE, escena, cont);

      const medir = () => {
        const { width, height } = cont.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        ajustar(width, height);
      };
      const ro = new ResizeObserver(medir);
      ro.observe(cont); medir();

      let enPantalla = false; let id = 0;
      const reloj = new THREE.Clock();
      const bucle = () => {
        if (!enPantalla) return;
        cuadro(reloj.getElapsedTime());
        renderer.render(escena, camara);
        id = requestAnimationFrame(bucle);
      };
      const io = new IntersectionObserver(([e]) => {
        enPantalla = e.isIntersecting;
        cancelAnimationFrame(id);
        if (enPantalla) bucle();
      }, { threshold: 0.2 });
      io.observe(cont);

      limpiar = () => {
        cancelAnimationFrame(id); ro.disconnect(); io.disconnect();
        escena.traverse((o) => { o.geometry?.dispose(); [o.material].flat().forEach((m) => m?.dispose()); });
        renderer.dispose(); renderer.domElement.remove();
      };
    });
    return () => { vivo = false; limpiar(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

export function irASeccion(id) {
  const el = document.getElementById(id);
  // Una sección fijada vive dentro de su espaciador: hay que ir al inicio de este.
  (el?.closest('.pin-spacer') ?? el)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export { gsap, ScrollTrigger };
