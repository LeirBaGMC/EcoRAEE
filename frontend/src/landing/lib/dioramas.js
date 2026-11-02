import { COLOR } from './utiles3d.js';

// Cada diorama recibe `abierto`: segundos desde que apareció. Sus animaciones no dependen del scroll.
const facil = (x) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;

export function dioramaRegistro(THREE, u) {
  const g = u.plataforma();
  g.add(u.bosque(4.3, 14));
  g.add(u.caja(2.3, 0.1, 1.2, COLOR.blanco, 0.9, 0.95, 0), u.caja(0.12, 0.95, 1, COLOR.gris, -0.1, 0, 0), u.caja(0.12, 0.95, 1, COLOR.gris, 1.9, 0, 0));
  // Computadora girada hacia la persona, que trabaja de perfil
  const compu = new THREE.Group();
  const marco = u.caja(0.9, 0.6, 0.04, COLOR.oscuro, 0, 0.03, -0.3);
  const brillo = u.luz(0.8, 0.5, 0.01, 0, 0.08, -0.27);
  marco.rotation.x = -0.18; brillo.rotation.x = -0.18;
  compu.add(u.caja(0.9, 0.05, 0.62, COLOR.oscuro), marco, brillo);
  compu.position.set(0.12, 1.05, 0.05); compu.rotation.y = -1.2;
  g.add(compu);
  const p = u.persona(COLOR.verde, { moño: true });
  p.grupo.position.set(-0.9, 0, 0.02); p.grupo.rotation.y = 1.35;
  g.add(p.grupo);
  // Tarjeta de identificación con el código único
  const tarjeta = new THREE.Group();
  tarjeta.add(u.caja(1.3, 0.72, 0.06, COLOR.blanco, 0, -0.36, 0));
  tarjeta.add(u.caja(0.42, 0.46, 0.08, COLOR.verde, -0.34, -0.23, 0));
  tarjeta.add(u.esfera(0.08, COLOR.blanco, -0.34, 0.09, 0.06), u.caja(0.22, 0.12, 0.09, COLOR.blanco, -0.34, -0.16, 0));
  [0.1, -0.07].forEach((y, i) => tarjeta.add(u.caja(i ? 0.42 : 0.56, 0.07, 0.08, i ? COLOR.gris : COLOR.vivo, 0.24, y - 0.03, 0)));
  tarjeta.position.set(1.15, 2.9, 0);
  g.add(tarjeta);
  return {
    grupo: g, distancia: 12.6,
    cuadro: (t, abierto) => {
      p.brazoD.rotation.x = -1.25 + Math.sin(t * 13) * 0.1; p.brazoI.rotation.x = -1.25 - Math.sin(t * 13) * 0.1;
      const e = facil((abierto - 0.5) / 0.8);
      tarjeta.scale.setScalar(Math.max(e, 0.001));
      tarjeta.position.y = 1.9 + e * 0.55 + Math.sin(t * 1.8) * 0.07;
      tarjeta.rotation.y = -0.18 + Math.sin(t) * 0.14;
    },
  };
}

export function dioramaRecepcion(THREE, u) {
  const g = u.plataforma();
  g.add(u.bosque(4.3, 14));
  g.add(u.caja(3.2, 1, 1.1, COLOR.blanco, 0, 0, 0.5), u.caja(3.4, 0.1, 1.3, COLOR.verde, 0, 1, 0.5));
  g.add(u.caja(0.9, 0.08, 0.65, COLOR.oscuro, -0.8, 1.1, 0.5), u.luz(0.78, 0.02, 0.54, -0.8, 1.18, 0.5));
  const p = u.persona(COLOR.teal, { feliz: true, pelo: COLOR.peloNegro });
  p.grupo.position.set(0.7, 0, -0.7);
  g.add(p.grupo);
  // Documento con el visto en su esquina
  const doc = new THREE.Group();
  doc.add(u.caja(1.15, 1.5, 0.05, COLOR.blanco, 0, -0.75, 0));
  [0.5, 0.28, 0.06, -0.16].forEach((y, i) => doc.add(u.caja(i === 3 ? 0.42 : 0.82, 0.07, 0.07, COLOR.gris, i === 3 ? -0.2 : 0, y - 0.04, 0.02)));
  doc.position.set(-1.05, 2.95, 0.6);
  const visto = new THREE.Group();
  const disco = u.cilindro(0.36, 0.36, 0.1, COLOR.verde, 0, -0.05, 0, 32);
  disco.rotation.x = Math.PI / 2;
  const trazo1 = u.caja(0.08, 0.2, 0.05, COLOR.blanco, -0.08, -0.15, 0.07);
  const trazo2 = u.caja(0.08, 0.4, 0.05, COLOR.blanco, 0.07, -0.17, 0.07);
  trazo1.rotation.z = 0.78; trazo2.rotation.z = -0.68;
  visto.add(disco, trazo1, trazo2);
  visto.position.set(0.48, -0.66, 0.1);
  doc.add(visto);
  g.add(doc);
  const CICLO = 2.6;
  const TAM_VISTO = 0.62;
  return {
    grupo: g, distancia: 12.6,
    cuadro: (t, abierto) => {
      doc.scale.setScalar(Math.max(facil(abierto / 0.5), 0.001));
      doc.position.y = 2.95 + Math.sin(t * 1.6) * 0.06;
      doc.rotation.y = 0.2 + Math.sin(t * 0.9) * 0.1;
      // El visto aparece, late y se va, una y otra vez.
      const f = (abierto % CICLO) / CICLO;
      const entra = facil(f / 0.22); const sale = 1 - facil((f - 0.82) / 0.18);
      visto.scale.setScalar(Math.max(TAM_VISTO * entra * sale * (1 + Math.sin(Math.min(f / 0.22, 1) * Math.PI) * 0.14), 0.001));
      p.brazoD.rotation.x = -1.4 + Math.sin(t * 3) * 0.12;
    },
  };
}

export function dioramaEvaluacion(THREE, u) {
  const g = u.plataforma();
  g.add(u.bosque(4.3, 14));
  g.add(u.caja(2.6, 0.1, 1.3, COLOR.blanco, 0.7, 0.95, 0), u.caja(0.12, 0.95, 1.1, COLOR.gris, -0.45, 0, 0), u.caja(0.12, 0.95, 1.1, COLOR.gris, 1.85, 0, 0));
  // Monitor girado hacia el técnico
  const monitor = new THREE.Group();
  monitor.add(u.caja(1.3, 0.85, 0.08, COLOR.oscuro, 0, 0.2, 0), u.luz(1.16, 0.72, 0.02, 0, 0.27, 0.05), u.caja(0.14, 0.2, 0.14, COLOR.oscuro), u.caja(0.5, 0.03, 0.32, COLOR.oscuro));
  monitor.position.set(1.35, 1.05, -0.15); monitor.rotation.y = -0.95;
  g.add(monitor);
  // Herramientas sobre la mesa
  g.add(u.caja(0.72, 0.05, 0.5, '#0d4a34', 0.3, 1.05, 0.25), u.caja(0.16, 0.08, 0.16, COLOR.lima, 0.17, 1.1, 0.17), u.caja(0.1, 0.08, 0.2, COLOR.vivo, 0.45, 1.1, 0.31));
  const engranaje = (radio, color, x, z, altura = 0.09) => {
    const e = new THREE.Group();
    e.add(u.cilindro(radio, radio, 0.08, color, 0, 0, 0, 20), u.cilindro(radio * 0.36, radio * 0.36, 0.1, COLOR.blanco, 0, -0.01, 0, 16));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const diente = u.caja(radio * 0.42, 0.08, radio * 0.38, color, Math.cos(a) * radio, 0, Math.sin(a) * radio);
      diente.rotation.y = -a;
      e.add(diente);
    }
    e.position.set(x, 1.05 + altura - 0.09, z);
    g.add(e);
    return e;
  };
  const engranajes = [engranaje(0.2, COLOR.teal, 1, 0.38), engranaje(0.13, COLOR.sol, 1.31, 0.45), engranaje(0.11, COLOR.oscuro, 0.78, 0.5)];
  // Destornillador y llave
  const destornillador = new THREE.Group();
  const mango = u.cilindro(0.055, 0.055, 0.28, COLOR.rojo, 0, 0, 0, 10);
  const punta = u.cilindro(0.016, 0.016, 0.3, COLOR.gris, 0, 0.28, 0, 8);
  destornillador.add(mango, punta);
  destornillador.rotation.set(Math.PI / 2, 0, 0.7);
  destornillador.position.set(-0.05, 1.11, 0.42);
  const llave = new THREE.Group();
  llave.add(u.caja(0.46, 0.03, 0.07, COLOR.gris), u.sombra(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 8, 16, Math.PI * 1.5), u.mat(COLOR.gris))));
  llave.children[1].rotation.x = Math.PI / 2; llave.children[1].position.set(0.28, 0.015, 0);
  llave.position.set(1.42, 1.06, 0.14); llave.rotation.y = 0.4;
  g.add(destornillador, llave);
  const p = u.persona(COLOR.blanco, { pelo: COLOR.peloNegro });
  p.grupo.position.set(-1.05, 0, 0.25); p.grupo.rotation.y = 1.25;
  g.add(p.grupo);
  const signo = u.letrero('?', { alto: 0.95, peso: 700, color: COLOR.rojo, familia: '"Unbounded", sans-serif' });
  signo.position.set(-1.05, 2.5, 0.25);
  g.add(signo);
  return {
    grupo: g, distancia: 12.6,
    cuadro: (t) => {
      // Se rasca la cabeza mientras decide
      p.brazoD.rotation.x = -2.75 + Math.sin(t * 9) * 0.16;
      p.brazoD.rotation.z = 0.5;
      p.brazoI.rotation.x = -0.9;
      p.grupo.rotation.y = 1.25 + Math.sin(t * 0.8) * 0.15;
      signo.position.y = 2.5 + Math.sin(t * 2.4) * 0.07;
      engranajes.forEach((e, i) => { e.rotation.y = t * (i % 2 ? -0.9 : 0.6); });
    },
  };
}

export function dioramaTratamiento(THREE, u) {
  const g = u.plataforma(4.6);
  g.add(u.bosque(4.6, 16, (x, z) => (z > 0.4 && Math.abs(x) < 3) || (z < -0.6 && Math.abs(x) < 2.6)));
  // Fábrica con techo de dientes de sierra
  g.add(u.caja(4.4, 1.5, 1.7, COLOR.blanco, 0, 0, -1.8));
  [-1.5, 0, 1.5].forEach((x, i) => {
    const t = u.sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.05, 0.7, 4), u.mat([COLOR.verde, COLOR.teal, COLOR.oscuro][i])));
    t.rotation.y = Math.PI / 4; t.scale.set(1, 1, 1.2); t.position.set(x, 1.85, -1.8);
    g.add(t);
  });
  g.add(u.cilindro(0.26, 0.34, 1.6, COLOR.oscuro, 1.75, 1.5, -2.2, 12));
  g.add(u.caja(0.9, 1, 0.08, COLOR.oscuro, -0.9, 0, -0.93));
  const humo = [0, 1, 2, 3].map(() => { const s = u.esfera(0.26, COLOR.blanco, 1.75, 3, -2.2); s.castShadow = false; g.add(s); return s; });
  // Banda transportadora
  g.add(u.caja(5.4, 0.42, 0.7, COLOR.oscuro, 0, 0.18, 0.05), u.caja(5.4, 0.04, 0.72, COLOR.gris, 0, 0.6, 0.05));
  const cajas = [0, 1, 2, 3, 4].map((i) => { const c = u.caja(0.4, 0.36, 0.42, [COLOR.vivo, COLOR.pantalla, COLOR.lima][i % 3], 0, 0.64, 0.05); g.add(c); return c; });
  // Yunque y operarios
  g.add(u.caja(0.8, 0.44, 0.7, COLOR.oscuro, 0, 0, 1.75), u.caja(0.5, 0.1, 0.4, COLOR.teal, 0, 0.44, 1.75));
  const a = u.persona(COLOR.verde); const b = u.persona(COLOR.teal, { pelo: COLOR.peloNegro, moño: true });
  a.grupo.position.set(-1, 0, 1.75); a.grupo.rotation.y = 1.57;
  b.grupo.position.set(1, 0, 1.75); b.grupo.rotation.y = -1.57;
  [a, b].forEach((p) => {
    p.brazoD.add(u.cilindro(0.03, 0.03, 0.5, COLOR.tronco, 0, -1.02, 0, 6), u.caja(0.28, 0.14, 0.16, COLOR.oscuro, 0, -1.08, 0));
    g.add(p.grupo);
  });
  return {
    grupo: g, distancia: 13.5,
    cuadro: (t) => {
      cajas.forEach((c, i) => { c.position.x = -2.6 + ((t * 0.5 + i * 1.04) % 5.2); });
      humo.forEach((s, i) => {
        const f = (t * 0.28 + i / 4) % 1;
        s.position.set(1.75 + f * 0.7, 3.1 + f * 1.5, -2.2);
        s.scale.setScalar(0.5 + f * 1.2);
      });
      a.brazoD.rotation.x = -1.6 + Math.sin(t * 3.6) * 0.7;
      b.brazoD.rotation.x = -1.6 + Math.sin(t * 3.6 + 3.14) * 0.7;
    },
  };
}

export function dioramaCertificacion(THREE, u) {
  const g = u.plataforma(5.4);
  const n = 8;
  const separacion = (x, z) => [0, 1, 2, 3, 4, 5, 6, 7].some((i) => { const a = (i / n) * Math.PI * 2 + 0.39; return Math.hypot(x - Math.cos(a) * 4.5, z - Math.sin(a) * 4.5) < 0.9; });
  g.add(u.bosque(5.4, 22, (x, z) => separacion(x, z) || Math.hypot(x, z) < 3 || (z > 0 && Math.abs(x) < 2.2)));
  // Sede de la empresa en el centro
  const sede = new THREE.Group();
  sede.add(u.caja(2.3, 2, 1.7, COLOR.blanco), u.caja(2.5, 0.14, 1.9, COLOR.verde, 0, 2, 0), u.caja(0.56, 0.9, 0.06, COLOR.oscuro, 0, 0, 0.86));
  [-0.74, 0.74].forEach((x) => [0.95, 1.5].forEach((y) => sede.add(u.luz(0.38, 0.3, 0.04, x, y, 0.86))));
  const nombre = u.letrero('EcoRAEE', { alto: 0.52, fondo: '#ffffff', familia: '"Unbounded", sans-serif', color: COLOR.oscuro });
  nombre.position.set(0, 2.62, 0.9);
  sede.add(nombre);
  g.add(sede);
  // Red: de la sede salen los envíos a cada destino
  const centro = new THREE.Vector3(0, 1.3, 0);
  const tonos = [COLOR.verde, COLOR.teal, COLOR.prado, COLOR.pantalla];
  const rutas = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.39;
    const fin = new THREE.Vector3(Math.cos(a) * 4.5, 0.45, Math.sin(a) * 4.5);
    const r = new THREE.Group();
    r.add(u.enlace(centro, fin, 0.024, COLOR.oscuro));
    r.add(u.esfera(0.3, tonos[i % tonos.length], fin.x, fin.y, fin.z));
    g.add(r);
    const paquete = u.esfera(0.12, COLOR.sol); paquete.castShadow = false;
    g.add(paquete);
    return { r, fin, paquete, i };
  });
  return {
    grupo: g, distancia: 15.5,
    cuadro: (t, abierto) => {
      rutas.forEach(({ r, fin, paquete, i }) => {
        const e = facil((abierto - 0.3 - i * 0.12) / 0.6);
        r.scale.setScalar(Math.max(e, 0.001));
        r.position.copy(centro).multiplyScalar(1 - e);
        const f = (t * 0.42 + i / n) % 1;
        paquete.visible = e > 0.95;
        paquete.position.lerpVectors(centro, fin, f);
        paquete.position.y += Math.sin(f * Math.PI) * 0.5;
      });
    },
  };
}
