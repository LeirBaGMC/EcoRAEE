import { useEffect } from 'react';
import './styles/tokens.css';
import './styles/base.css';
import './styles/atomos.css';
import './styles/moleculas.css';
import './styles/organismos.css';
import { Encabezado, Heroe } from './organismos/Portada.jsx';
import { HistoriaMina } from './organismos/HistoriaMina.jsx';
import { Proceso } from './organismos/Proceso.jsx';
import { Cierre, Impacto, Panorama, Pie, PlanB } from './organismos/Secciones.jsx';
import { ScrollTrigger } from './hooks/index.js';

export default function Landing() {
  // Las fuentes cambian las alturas: hay que volver a medir al terminar de cargar.
  useEffect(() => { document.fonts?.ready.then(() => ScrollTrigger.refresh()); }, []);
  return (
    <div className="eco">
      <div className="eco-fondo" aria-hidden="true"><i className="eco-mancha a" /><i className="eco-mancha b" /><i className="eco-mancha c" /></div>
      <Encabezado />
      <main>
        <Heroe />
        <HistoriaMina />
        <Panorama />
        <PlanB />
        <Proceso />
        <Impacto />
        <Cierre />
      </main>
      <Pie />
    </div>
  );
}
