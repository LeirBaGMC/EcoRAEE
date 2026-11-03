import { ArrowRight } from 'lucide-react';
import { Boton, Burbujas, Contador, Marca, Titulo } from '../atomos/index.jsx';
import { Barras3D, CabeceraSeccion, Dona3D, Hallazgo, Tarjeta, TileMosaico } from '../moleculas/index.jsx';
import { DESTINOS, HALLAZGOS, INDICADORES, MATERIALES, MESES, PLAN_B, RECICLAJE, RESIDUOS_ANIO } from '../datos/contenido.js';

export function Panorama() {
  return (
    <section className="eco-seccion" id="panorama" aria-labelledby="t-panorama">
      <div className="eco-envoltura">
        <CabeceraSeccion
          id="t-panorama"
          titulo="Los residuos electrónicos crecen más rápido que su recuperación"
          sub="La generación mundial aumenta cinco veces más rápido que el reciclaje documentado. Cada dispositivo que no se recupera representa materiales perdidos y un riesgo para el ambiente."
        />
        <div className="eco-rejilla">
          <Tarjeta col={5}>
            <Titulo nivel={4}>Generación mundial en millones de toneladas</Titulo>
            <Barras3D datos={RESIDUOS_ANIO} alto="19rem" descripcion="34 millones de toneladas en 2010, 62 en 2022 y una proyección de 82 en 2030" />
          </Tarjeta>
          <Tarjeta col={3} colMd={5}>
            <Titulo nivel={4}>Reciclaje documentado</Titulo>
            <Dona3D segmentos={RECICLAJE} centro={{ valor: '22 %', texto: 'del total' }} alto="15rem" />
          </Tarjeta>
          <Tarjeta col={4} colMd={7}>
            <Titulo nivel={4}>Materiales recuperables</Titulo>
            <ul className="eco-materiales">
              {MATERIALES.map((m) => <li key={m.s} className="eco-material"><b>{m.s}</b><span>{m.d}</span></li>)}
            </ul>
          </Tarjeta>
        </div>
        <div className="eco-rejilla eco-hallazgos">{HALLAZGOS.map((h) => <Hallazgo key={h.t} item={h} />)}</div>
      </div>
    </section>
  );
}

export function PlanB() {
  return (
    <section className="eco-plan" id="plan" aria-labelledby="t-plan">
      <div className="eco-envoltura"><CabeceraSeccion id="t-plan" titulo="Todo tiene un plan B" sub="Cada dispositivo recibe el tratamiento que mejor aprovecha su valor" /></div>
      <div className="eco-plan-filas">
        {PLAN_B.map((fila, i) => (
          <div className={`eco-fila${i % 2 ? ' inversa' : ''}`} key={i}>
            {[0, 1, 2, 3].flatMap((vuelta) => fila.map((item) => <TileMosaico key={`${vuelta}-${item.t}`} item={item} copia={vuelta > 0} />))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Impacto() {
  return (
    <section className="eco-seccion" id="impacto" aria-labelledby="t-impacto">
      <div className="eco-envoltura">
        <CabeceraSeccion id="t-impacto" titulo="Ejemplo de indicadores de impacto" sub="Datos ficticios de demostración. Estas cifras no representan resultados reales de EcoRAEE." />
        <div className="eco-rejilla">
          <Tarjeta>
            <div className="eco-indicadores">
              {INDICADORES.map((d) => <div className="eco-indicador" key={d.t}><Contador a={d.a} dec={d.dec} sufijo={d.sufijo} /><p>{d.t}</p></div>)}
            </div>
          </Tarjeta>
          <Tarjeta col={8}>
            <Titulo nivel={4}>Equipos recuperados por mes (ejemplo)</Titulo>
            <Barras3D datos={MESES} densas alto="18rem" descripcion="Ejemplo con datos ficticios de equipos recuperados por mes" />
          </Tarjeta>
          <Tarjeta col={4}>
            <Titulo nivel={4}>Destino de los equipos (ejemplo)</Titulo>
            <Dona3D segmentos={DESTINOS} centro={{ valor: '100 %', texto: 'del ejemplo' }} alto="15rem" />
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}

export function Cierre() {
  return (
    <section className="eco-seccion" aria-labelledby="t-cierre">
      <div className="eco-envoltura">
        <div className="eco-cierre">
          <Burbujas />
          <Titulo nivel={2} id="t-cierre" style={{ maxWidth: '26ch' }}>Dale a tus equipos una segunda vida</Titulo>
          <p className="eco-sub">Crea tu cuenta, registra tus dispositivos y consulta cada etapa de su recorrido</p>
          <div className="eco-cierre-acciones">
            <Boton href="#/registro">Regístrate <ArrowRight size={18} /></Boton>
            <Boton variante="suave" href="#/login">Ya tengo cuenta</Boton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Pie() {
  return (
    <footer>
      <div className="eco-envoltura eco-pie">
        <Marca />
        <span>Trazabilidad de residuos electrónicos de principio a fin</span>
      </div>
    </footer>
  );
}
