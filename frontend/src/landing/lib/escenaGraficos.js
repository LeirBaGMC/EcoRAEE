import { COLOR, crearUtiles } from './utiles3d.js';

const salida = (x) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function luces(THREE, escena) {
  escena.add(new THREE.HemisphereLight('#ffffff', '#bff0cf', 1.9));
  const sol = new THREE.DirectionalLight('#ffffff', 2.2);
  sol.position.set(-4, 9, 7); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10 });
  escena.add(sol);
}

// Puntero sobre el contenedor, normalizado de -1 a 1.
function seguirPuntero(cont) {
  const p = { x: 0, y: 0, dentro: false };
  const mover = (e) => { const r = cont.getBoundingClientRect(); p.x = ((e.clientX - r.left) / r.width) * 2 - 1; p.y = -((e.clientY - r.top) / r.height) * 2 + 1; p.dentro = true; };
  cont.addEventListener('pointermove', mover);
  cont.addEventListener('pointerleave', () => { p.dentro = false; });
  return p;
}

export function crearBarras3D(THREE, escena, cont, { datos, densas, tip }) {
  const u = crearUtiles(THREE);
  const camara = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const raiz = new THREE.Group();
  const n = datos.length; const ancho = densas ? 0.72 : 1.5; const paso = densas ? 1 : 2.3;
  const total = (n - 1) * paso;
  const max = Math.max(...datos.map((d) => d.valor));
  const altura = densas ? 3.2 : 4;
  const base = u.caja(total + ancho + 1, 0.16, densas ? 2.1 : 2.8, COLOR.pasto, 0, -0.16, 0);
  raiz.add(base);
  const barras = datos.map((d, i) => {
    const h = (d.valor / max) * altura;
    const geo = new THREE.BoxGeometry(ancho, h, ancho, 1, 1, 1);
    geo.translate(0, h / 2, 0);
    const m = u.sombra(new THREE.Mesh(geo, u.mat(d.proyeccion ? COLOR.vivo : i === n - 1 ? COLOR.oscuro : COLOR.verde, { emissive: '#3ddc97', emissiveIntensity: 0 })));
    if (d.proyeccion) { m.material.transparent = true; m.material.opacity = 0.65; }
    m.position.x = i * paso - total / 2;
    m.scale.y = 0.001;
    raiz.add(m);
    const etq = u.letrero(d.etiqueta, { alto: densas ? 0.34 : 0.42, color: COLOR.oscuro });
    etq.position.set(m.position.x, 0.1, (densas ? 1.05 : 1.4) + 0.2);
    raiz.add(etq);
    let valor = null;
    if (!densas) { valor = u.letrero(String(d.valor), { alto: 0.56, color: COLOR.oscuro, peso: 700 }); valor.position.set(m.position.x, h + 0.42, 0); valor.material.opacity = 0; raiz.add(valor); }
    return { m, h, d, valor, lift: 0 };
  });
  escena.add(raiz);
  luces(THREE, escena);

  const puntero = seguirPuntero(cont);
  const ray = new THREE.Raycaster(); const v2 = new THREE.Vector2(); const proy = new THREE.Vector3();
  let w = 1; let h = 1; let t0 = null;
  return {
    camara,
    ajustar: (a, b) => {
      w = a; h = b; camara.aspect = a / b;
      const d = Math.max(16, (total + 3.4) * 2.35 / Math.min(camara.aspect, 2.2));
      camara.position.set(0, d * 0.34, d); camara.lookAt(0, altura * 0.4, 0);
      camara.updateProjectionMatrix();
    },
    cuadro: (t) => {
      if (t0 === null) t0 = t;
      raiz.rotation.y += (-0.3 + (puntero.dentro ? puntero.x * 0.16 : 0) - raiz.rotation.y) * 0.06;
      ray.setFromCamera(v2.set(puntero.x, puntero.y), camara);
      const hit = puntero.dentro ? ray.intersectObjects(barras.map((b) => b.m))[0]?.object : null;
      let activa = null;
      barras.forEach((b, i) => {
        const e = sinMovimiento() ? 1 : salida((t - t0 - i * 0.07) / 1.1);
        const sobre = b.m === hit;
        if (sobre) activa = b;
        b.lift += ((sobre ? 1 : 0) - b.lift) * 0.14;
        b.m.scale.y = Math.max(e, 0.001) * (1 + b.lift * 0.08);
        b.m.scale.x = 1 + b.lift * 0.08; b.m.scale.z = 1 + b.lift * 0.08;
        b.m.material.emissiveIntensity = b.lift * 0.35;
        if (b.valor) b.valor.material.opacity = e > 0.85 ? 1 : 0;
      });
      const el = tip.current;
      if (el) {
        el.classList.toggle('on', Boolean(activa));
        if (activa) {
          el.textContent = activa.d.texto;
          proy.set(activa.m.position.x, activa.h, 0).applyMatrix4(raiz.matrixWorld).project(camara);
          el.style.transform = `translate(calc(${((proy.x + 1) / 2) * w}px - 50%), calc(${((1 - proy.y) / 2) * h}px - 130%))`;
        }
      }
    },
  };
}

export function crearDona3D(THREE, escena, cont, { segmentos, activo, alCambiar }) {
  const u = crearUtiles(THREE);
  const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camara.position.set(0, 7.6, 7.6); camara.lookAt(0, 0.1, 0);
  const raiz = new THREE.Group();
  const [R, r] = [2.45, 1.45];
  let desde = 0;
  const piezas = segmentos.map((s) => {
    const fr = s.valor / 100;
    const a0 = desde * Math.PI * 2 + 0.012; const a1 = (desde + fr) * Math.PI * 2 - 0.012;
    desde += fr;
    const f = new THREE.Shape();
    f.absarc(0, 0, R, a0, a1, false); f.absarc(0, 0, r, a1, a0, true);
    const m = u.sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.55, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 48 }), u.mat(s.hex, { flatShading: false, roughness: 0.55 })));
    m.rotation.x = -Math.PI / 2;
    const medio = (a0 + a1) / 2;
    raiz.add(m);
    return { m, sale: new THREE.Vector3(Math.cos(medio), 0, -Math.sin(medio)), lift: 0 };
  });
  escena.add(raiz);
  luces(THREE, escena);
  const puntero = seguirPuntero(cont);
  const ray = new THREE.Raycaster(); const v2 = new THREE.Vector2();
  let t0 = null; let ultimo = null;
  return {
    camara,
    ajustar: (a, b) => { camara.aspect = a / b; camara.fov = a < 1 ? 26 / a : 26; camara.updateProjectionMatrix(); },
    cuadro: (t) => {
      if (t0 === null) t0 = t;
      const e = sinMovimiento() ? 1 : salida((t - t0) / 1.3);
      raiz.scale.setScalar(Math.max(e, 0.001));
      raiz.rotation.y = -1.57 + (1 - e) * -2.4;
      ray.setFromCamera(v2.set(puntero.x, puntero.y), camara);
      const hit = puntero.dentro ? ray.intersectObjects(piezas.map((p) => p.m))[0]?.object : null;
      const i = hit ? piezas.findIndex((p) => p.m === hit) : -1;
      if (puntero.dentro && i !== ultimo) { ultimo = i; alCambiar(i >= 0 ? i : null); }
      if (!puntero.dentro && ultimo !== null) { ultimo = null; alCambiar(null); }
      piezas.forEach((p, k) => {
        const on = activo.current === k;
        p.lift += ((on ? 1 : 0) - p.lift) * 0.14;
        p.m.position.copy(p.sale).multiplyScalar(p.lift * 0.22);
        p.m.position.y = p.lift * 0.28;
      });
    },
  };
}
