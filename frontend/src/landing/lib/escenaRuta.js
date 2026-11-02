import { COLOR } from './utiles3d.js';

// Mapa de polígonos de la parada de traslado. `local` va de 0 a 1 a lo largo de la ruta.
export const PARADAS_RUTA = [0, 0.36, 0.68, 1];
// El camión llega antes de que termine la parada: queda scroll para leer la llegada.
export const avanceRuta = (local) => Math.min(local / 0.72, 1);
const TRAZADO = [[-7.2, 3], [-5, 0.3], [-2.6, -1.9], [-0.4, 0.6], [1.8, 2.4], [4, 0.2], [5.4, -1.8], [7.2, -2.8]];
const TECHOS = [COLOR.verde, COLOR.lima, COLOR.teal, COLOR.oscuro, COLOR.vivo];

export function crearMapa(THREE, u, { etiquetas }) {
  const { mat, caja } = u;
  const g = new THREE.Group();
  const ruta = new THREE.CatmullRomCurve3(TRAZADO.map(([x, z]) => new THREE.Vector3(x, 0, z)));

  // Terreno con esquinas redondeadas
  const forma = new THREE.Shape();
  const [a, b, r] = [9.4, 5.2, 1.4];
  forma.moveTo(-a + r, -b); forma.lineTo(a - r, -b); forma.quadraticCurveTo(a, -b, a, -b + r);
  forma.lineTo(a, b - r); forma.quadraticCurveTo(a, b, a - r, b); forma.lineTo(-a + r, b);
  forma.quadraticCurveTo(-a, b, -a, b - r); forma.lineTo(-a, -b + r); forma.quadraticCurveTo(-a, -b, -a + r, -b);
  const terreno = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.5, bevelEnabled: false }), [mat(COLOR.pasto), mat(COLOR.borde)]);
  terreno.rotation.x = Math.PI / 2; terreno.receiveShadow = true;
  g.add(terreno);

  // Vía: una cinta plana que sigue la curva
  const muestras = 240; const ancho = 0.42; const vertices = []; const indices = [];
  for (let i = 0; i <= muestras; i += 1) {
    const p = ruta.getPointAt(i / muestras); const t = ruta.getTangentAt(i / muestras);
    vertices.push(p.x - t.z * ancho, 0.02, p.z + t.x * ancho, p.x + t.z * ancho, 0.02, p.z - t.x * ancho);
    if (i < muestras) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const via = new THREE.BufferGeometry();
  via.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  via.setIndex(indices); via.computeVertexNormals();
  const cinta = new THREE.Mesh(via, new THREE.MeshStandardMaterial({ color: COLOR.via, side: THREE.DoubleSide, roughness: 0.9 }));
  cinta.receiveShadow = true;
  g.add(cinta);
  for (let i = 1; i < 44; i += 1) {
    const p = ruta.getPointAt(i / 44); const t = ruta.getTangentAt(i / 44);
    const raya = caja(0.05, 0.005, 0.26, COLOR.borde, p.x, 0.03, p.z);
    raya.rotation.y = Math.atan2(t.x, t.z); raya.castShadow = false;
    g.add(raya);
  }

  // Edificio de cada parada
  const paradas = PARADAS_RUTA.map((t) => ruta.getPointAt(t));
  const edificios = [
    [[1.3, 0.8, 1.1, COLOR.blanco], [1.5, 0.12, 1.3, COLOR.verde, 0, 0.8, 0]],
    [[1.9, 1.3, 1.3, COLOR.blanco], [2.1, 0.12, 1.5, COLOR.teal, 0, 1.3, 0], [0.5, 0.5, 0.5, COLOR.lima, 0.5, 1.42, 0]],
    [[2.1, 1, 1.4, COLOR.blanco], [0.34, 1, 0.34, COLOR.oscuro, -0.7, 1, 0.3], [2.2, 0.12, 1.5, COLOR.oscuro, 0, 1, 0]],
    [[1.7, 1, 1.3, COLOR.blanco], [1.9, 0.12, 1.5, COLOR.lima, 0, 1, 0], [0.06, 1, 0.06, COLOR.oscuro, 0.6, 1.1, 0.4], [0.4, 0.24, 0.02, COLOR.verde, 0.8, 1.86, 0.4]],
  ];
  const lados = [[0.3, 1.5], [-0.4, -1.7], [0.2, 1.7], [-0.5, 1.5]];
  const marcas = [];
  const sedes = [];
  paradas.forEach((p, i) => {
    const e = new THREE.Group();
    e.position.set(p.x + lados[i][0], 0, p.z + lados[i][1]);
    edificios[i].forEach(([w, h, d, c, x, y, z]) => e.add(caja(w, h, d, c, x, y, z)));
    g.add(e); sedes.push(e);
    const marca = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), mat(COLOR.apagado));
    marca.rotation.x = Math.PI; marca.position.set(p.x, 0.62, p.z); marca.castShadow = true;
    marcas.push(marca); g.add(marca);
  });

  // Árboles y casas en una cuadrícula fija, lejos de la vía y de los edificios
  const lejos = (x, z, puntos, d) => puntos.every((q) => Math.hypot(q.x - x, q.z - z) > d);
  const puntosVia = ruta.getSpacedPoints(70);
  const bases = paradas.map((p, i) => ({ x: p.x + lados[i][0], z: p.z + lados[i][1] }));
  let vivienda = 0;
  const copas = [COLOR.verde, COLOR.prado, COLOR.teal, COLOR.vivo, COLOR.oscuro];
  for (let x = -8.6; x <= 8.6; x += 1.2) {
    for (let z = -4.5; z <= 4.5; z += 1.15) {
      const sx = x + Math.sin(z * 7) * 0.3; const sz = z + Math.cos(x * 5) * 0.28;
      if (Math.sin(x * 12.9 + z * 78.2) > 0.72 || !lejos(sx, sz, puntosVia, 1) || !lejos(sx, sz, bases, 1.7)) continue;
      vivienda += 1;
      if (Math.abs(Math.sin(x * 3.3 + z * 2.1)) > 0.86) {
        g.add(caja(0.62, 0.42, 0.55, COLOR.blanco, sx, 0, sz), caja(0.74, 0.1, 0.67, TECHOS[vivienda % TECHOS.length], sx, 0.42, sz));
      } else if (vivienda % 3 === 0) {
        g.add(u.arbolRedondo(sx, sz, 0.26 + (vivienda % 3) * 0.04, copas[vivienda % copas.length]));
      } else {
        g.add(u.arbol(sx, sz, 0.5 + Math.abs(Math.sin(x * z)) * 0.5, copas[vivienda % copas.length]));
      }
    }
  }
  // Césped en todo el terreno, sin pisar la vía
  const hierba = [];
  for (let i = 0; i < 3200; i += 1) {
    const x = ((i * 0.618034) % 1) * 18.2 - 9.1; const z = ((i * 0.754878) % 1) * 9.9 - 4.95;
    if (lejos(x, z, puntosVia, 0.56)) hierba.push([x, z]);
  }
  g.add(u.cesped(hierba));

  // Carita feliz sobre la entidad beneficiaria al llegar
  const carita = new THREE.Group();
  carita.add(u.esfera(0.55, COLOR.sol));
  [-0.2, 0.2].forEach((x) => carita.add(u.arco(0.09, 0.024, 0, x, 0.08, 0.52)));
  carita.add(u.arco(0.2, 0.026, Math.PI, 0, -0.1, 0.52));
  const puntoFinal = bases[3];
  carita.position.set(puntoFinal.x, 3.5, puntoFinal.z);
  carita.rotation.x = -0.6;
  carita.scale.setScalar(0.001);
  g.add(carita);

  // Camión
  const camion = new THREE.Group();
  camion.add(caja(0.5, 0.46, 0.92, COLOR.blanco, 0, 0.14, -0.14), caja(0.5, 0.36, 0.38, COLOR.verde, 0, 0.14, 0.52), caja(0.42, 0.14, 0.03, COLOR.oscuro, 0, 0.32, 0.72), caja(0.52, 0.16, 0.5, COLOR.verde, 0, 0.3, -0.14));
  const llantas = [[-0.27, 0.46], [0.27, 0.46], [-0.27, -0.34], [0.27, -0.34]].map(([x, z]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 14), mat(COLOR.llanta));
    l.rotation.z = Math.PI / 2; l.position.set(x, 0.11, z); l.castShadow = true;
    camion.add(l);
    return l;
  });
  camion.scale.setScalar(1.35);
  g.add(camion);

  let actual = 0;
  const encendidas = PARADAS_RUTA.map(() => null);
  const proy = new THREE.Vector3();
  const encendido = new THREE.Color(COLOR.verde); const apagado = new THREE.Color(COLOR.apagado);
  return {
    grupo: g,
    colocar: (camara, aspecto) => {
      const d = Math.min(60, Math.max(23, 36 / aspecto));
      camara.position.set(0, d * 0.72, d * 0.74); camara.lookAt(0, -0.3, 1.1);
    },
    cuadro: (t, local, camara, ancho3d, alto3d) => {
      actual += (avanceRuta(local) - actual) * 0.1;
      const llego = actual > 0.985;
      const s = carita.scale.x + ((llego ? 0.68 : 0.001) - carita.scale.x) * 0.12;
      carita.scale.setScalar(Math.max(s, 0.001));
      carita.position.y = 4.1 + Math.sin(t * 2.2) * 0.06;
      const p = ruta.getPointAt(Math.min(actual, 0.9999)); const tg = ruta.getTangentAt(Math.min(actual, 0.9999));
      camion.position.copy(p);
      camion.rotation.y = Math.atan2(tg.x, tg.z);
      llantas.forEach((l) => { l.rotation.x = actual * 90; });
      marcas.forEach((m, i) => {
        const on = actual + 0.01 >= PARADAS_RUTA[i];
        m.material.color.copy(on ? encendido : apagado);
        // Saltito suave cuando la parada se enciende
        if (on && encendidas[i] === null) encendidas[i] = t;
        if (!on) encendidas[i] = null;
        const f = encendidas[i] === null ? 1 : Math.min((t - encendidas[i]) / 0.9, 1);
        const salto = Math.sin(f * Math.PI) * 0.26;
        sedes[i].position.y = salto;
        m.position.y = 0.62 + salto + Math.sin(t * 2 + i) * 0.06;
        m.rotation.y = t;
        const el = etiquetas.current[i];
        if (el) {
          proy.set(paradas[i].x + lados[i][0], 2.2, paradas[i].z + lados[i][1]).project(camara);
          el.style.transform = `translate(calc(${((proy.x + 1) / 2) * ancho3d}px - 50%), calc(${((1 - proy.y) / 2) * alto3d}px - 100%))`;
          el.classList.toggle('on', on);
        }
      });
    },
  };
}
