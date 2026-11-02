import { crearUtiles } from './utiles3d.js';
import { dioramaCertificacion, dioramaEvaluacion, dioramaRecepcion, dioramaRegistro, dioramaTratamiento } from './dioramas.js';
import { crearMapa } from './escenaRuta.js';

const INDICE_MAPA = 3;
const CIERRE = 0.16;
const APERTURA = 0.6;
const rebote = (x) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

// Director de las 6 paradas: una sola escena que cierra un diorama y abre el siguiente.
export function crearProceso(THREE, escena, { estado, etiquetas }) {
  const u = crearUtiles(THREE);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const mapa = crearMapa(THREE, u, { etiquetas });
  const dioramas = [dioramaRegistro(THREE, u), dioramaRecepcion(THREE, u), dioramaEvaluacion(THREE, u), mapa, dioramaTratamiento(THREE, u), dioramaCertificacion(THREE, u)];
  dioramas.forEach((d) => { d.grupo.visible = false; d.grupo.scale.setScalar(0.001); escena.add(d.grupo); });

  escena.add(new THREE.HemisphereLight('#ffffff', '#bff0cf', 1.7));
  const sol = new THREE.DirectionalLight('#ffffff', 2.4);
  sol.position.set(-6, 12, 7); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 9, bottom: -9, far: 40 });
  escena.add(sol);

  let w = 1; let h = 1; let activa = 0; let inicio = 0; let previo = null; let cerrando = false;
  const colocar = () => {
    const d = dioramas[activa];
    camara.aspect = w / h;
    if (d.colocar) d.colocar(camara, camara.aspect);
    else {
      const dist = d.distancia * 1.22 * Math.max(1, 1.1 / camara.aspect);
      camara.position.set(0, dist * 0.38, dist * 0.92); camara.lookAt(0, -0.35, 0);
    }
    camara.updateProjectionMatrix();
  };
  dioramas[0].grupo.visible = true;

  return {
    camara,
    ajustar: (ancho, alto) => { w = ancho; h = alto; colocar(); },
    cuadro: (t) => {
      if (previo === null) { previo = t; inicio = t; }
      const dt = t - previo; previo = t;
      const { parada, local } = estado.current;
      const d = dioramas[activa];
      if (parada !== activa) cerrando = true;
      if (cerrando) {
        const s = Math.max(d.grupo.scale.x - dt / CIERRE, 0.001);
        d.grupo.scale.setScalar(s);
        if (s <= 0.001) {
          d.grupo.visible = false;
          activa = parada; cerrando = false; inicio = t;
          dioramas[activa].grupo.visible = true;
          colocar();
        }
      } else {
        d.grupo.scale.setScalar(Math.max(rebote(Math.min((t - inicio) / APERTURA, 1)), 0.001));
      }
      const a = dioramas[activa];
      if (activa === INDICE_MAPA) a.cuadro(t, parada === activa ? local : 1, camara, w, h);
      else a.cuadro(t, t - inicio);
    },
  };
}
