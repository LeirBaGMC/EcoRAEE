// Piezas básicas compartidas por todas las escenas 3D.
export const COLOR = {
  pasto: '#86e39a', pastoClaro: '#a4eeb0', borde: '#6bd48e', tierra: '#b58a5f', via: '#ffffff', verde: '#16a06b', vivo: '#3ddc97', oscuro: '#0f5c3f', lima: '#d7f56b', prado: '#6fd94f',
  blanco: '#ffffff', tronco: '#8a6f4d', llanta: '#0a2b1d', apagado: '#b9d8c8', piel: '#efc9a4', pelo: '#4a2e1c', peloNegro: '#23201d', teal: '#2aa6a0', gris: '#dfe9e3',
  pantalla: '#4db4ff', rojo: '#e5484d', sol: '#ffd84d',
};
const ANGULO_DORADO = 2.39996;

export function crearUtiles(THREE) {
  const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });
  const sombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const caja = (w, h, d, color, x = 0, y = 0, z = 0) => {
    const m = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color));
    m.position.set(x, y + h / 2, z);
    return m;
  };
  const cilindro = (r1, r2, h, color, x = 0, y = 0, z = 0, lados = 16) => {
    const m = sombra(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, lados), mat(color)));
    m.position.set(x, y + h / 2, z);
    return m;
  };
  const esfera = (r, color, x = 0, y = 0, z = 0) => {
    const m = sombra(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, { flatShading: false })));
    m.position.set(x, y, z);
    return m;
  };
  // Pantalla encendida: no depende de las luces de la escena.
  const luz = (w, h, d, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: COLOR.pantalla }));
    m.position.set(x, y + h / 2, z);
    return m;
  };
  // Letrero plano que siempre mira a la cámara.
  const letrero = (texto, { color = COLOR.oscuro, fondo = null, alto = 0.5, peso = 600, familia = '"DM Sans", sans-serif' } = {}) => {
    const lienzo = document.createElement('canvas');
    const c = lienzo.getContext('2d');
    const fuente = `${peso} 72px ${familia}`;
    c.font = fuente;
    lienzo.width = Math.ceil(c.measureText(texto).width) + 56; lienzo.height = 112;
    c.font = fuente; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (fondo) { c.fillStyle = fondo; c.beginPath(); c.roundRect(0, 0, lienzo.width, lienzo.height, 40); c.fill(); }
    c.fillStyle = color; c.fillText(texto, lienzo.width / 2, lienzo.height / 2 + 4);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }));
    s.scale.set((alto * lienzo.width) / lienzo.height, alto, 1);
    return s;
  };
  // Tubo recto entre dos puntos.
  const enlace = (a, b, radio, color) => {
    const v = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, v.length(), 8), mat(color));
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    return m;
  };
  // Arco de la cara: 0 dibuja ∩ (ojo feliz) y Math.PI dibuja ∪ (sonrisa).
  const arco = (radio, grosor, giro, x, y, z) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radio, grosor, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: COLOR.llanta }));
    m.rotation.z = giro; m.position.set(x, y, z);
    return m;
  };
  // Persona sencilla: los brazos giran desde el hombro.
  const persona = (ropa, { moño, feliz, pelo = COLOR.pelo } = {}) => {
    const g = new THREE.Group();
    g.add(caja(0.17, 0.5, 0.2, COLOR.oscuro, -0.13), caja(0.17, 0.5, 0.2, COLOR.oscuro, 0.13));
    g.add(sombra(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.45, 4, 12), mat(ropa, { flatShading: false }))));
    g.children[2].position.y = 0.95;
    g.add(esfera(0.25, COLOR.piel, 0, 1.68, 0));
    // Cabello: un casquete inclinado hacia atrás que deja libre la cara.
    const cabello = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.268, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(pelo, { flatShading: false })));
    cabello.position.set(0, 1.69, -0.01); cabello.rotation.x = -0.5;
    g.add(cabello);
    if (feliz) {
      [-0.09, 0.09].forEach((x) => g.add(arco(0.04, 0.012, 0, x, 1.66, 0.238)));
      g.add(arco(0.075, 0.012, Math.PI, 0, 1.6, 0.238));
    } else {
      [-0.09, 0.09].forEach((x) => g.add(esfera(0.028, COLOR.llanta, x, 1.68, 0.235)));
    }
    if (moño) g.add(esfera(0.13, pelo, 0, 1.86, -0.24));
    [-0.13, 0.13].forEach((x) => g.add(caja(0.2, 0.09, 0.3, COLOR.blanco, x, 0, 0.04)));
    const brazo = (lado) => {
      const hombro = new THREE.Group();
      hombro.position.set(lado * 0.36, 1.32, 0);
      const b = cilindro(0.08, 0.07, 0.56, ropa, 0, -0.56, 0, 8);
      hombro.add(b, esfera(0.08, COLOR.piel, 0, -0.6, 0));
      g.add(hombro);
      return hombro;
    };
    return { grupo: g, brazoI: brazo(-1), brazoD: brazo(1) };
  };
  // Hojas de césped y flores repartidas en las posiciones dadas.
  const cesped = (posiciones) => {
    const g = new THREE.Group();
    const d = new THREE.Object3D(); const color = new THREE.Color();
    const hojas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.045, 0.1, 4), mat(COLOR.blanco), posiciones.length);
    const tonos = [COLOR.pastoClaro, COLOR.borde, COLOR.pasto, COLOR.prado];
    posiciones.forEach(([x, z], i) => {
      d.position.set(x, 0.04, z); d.rotation.set(0, i, 0); d.scale.setScalar(0.8 + (i % 4) * 0.14); d.updateMatrix();
      hojas.setMatrixAt(i, d.matrix); hojas.setColorAt(i, color.set(tonos[i % tonos.length]));
    });
    const flores = posiciones.filter((_, i) => i % 41 === 0);
    const petalos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), mat(COLOR.blanco, { flatShading: false }), flores.length);
    const coloresFlor = [COLOR.blanco, COLOR.sol, COLOR.lima, COLOR.pantalla];
    flores.forEach(([x, z], i) => {
      d.position.set(x + 0.08, 0.12, z + 0.05); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
      petalos.setMatrixAt(i, d.matrix); petalos.setColorAt(i, color.set(coloresFlor[i % coloresFlor.length]));
    });
    g.add(hojas, petalos);
    return g;
  };
  const plataforma = (radio = 4.3) => {
    const g = new THREE.Group();
    const base = cilindro(radio, radio * 0.95, 0.42, COLOR.pasto, 0, -0.42, 0, 56);
    base.material = [mat(COLOR.tierra), mat(COLOR.pasto, { flatShading: false }), mat(COLOR.tierra)];
    g.add(base);
    const n = Math.round(radio * radio * 70);
    g.add(cesped(Array.from({ length: n }, (_, i) => {
      const r = radio * 0.97 * Math.sqrt((i + 0.5) / n); const a = i * ANGULO_DORADO;
      return [Math.cos(a) * r, Math.sin(a) * r];
    })));
    return g;
  };
  const arbol = (x, z, h = 0.9, color = COLOR.verde) => {
    const g = new THREE.Group();
    const copa = sombra(new THREE.Mesh(new THREE.ConeGeometry(0.34, h, 7), mat(color)));
    copa.position.set(x, 0.2 + h / 2, z);
    g.add(copa, caja(0.09, 0.2, 0.09, COLOR.tronco, x, 0, z));
    return g;
  };
  const arbolRedondo = (x, z, r = 0.36, color = COLOR.prado) => {
    const g = new THREE.Group();
    g.add(caja(0.1, 0.42, 0.1, COLOR.tronco, x, 0, z), esfera(r, color, x, 0.42 + r * 0.8, z));
    return g;
  };
  // Árboles alrededor del borde; el frente central queda libre para la escena.
  const bosque = (radio, n, libre = (x, z) => z > 0.4 && Math.abs(x) < 2.9) => {
    const g = new THREE.Group();
    const tonos = [COLOR.verde, COLOR.prado, COLOR.teal, COLOR.vivo, COLOR.oscuro];
    for (let i = 0; i < n; i += 1) {
      const a = i * ANGULO_DORADO + 0.4; const r = radio * (0.74 + 0.2 * ((i * 0.37) % 1));
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (!libre(x, z)) {
        const tono = tonos[i % tonos.length];
        g.add(i % 3 === 0 ? arbolRedondo(x, z, 0.3 + (i % 3) * 0.06, tono) : arbol(x, z, 0.8 + (i % 4) * 0.16, tono));
      }
    }
    return g;
  };
  return { mat, sombra, caja, cilindro, esfera, luz, letrero, enlace, arco, persona, cesped, plataforma, arbol, arbolRedondo, bosque };
}
