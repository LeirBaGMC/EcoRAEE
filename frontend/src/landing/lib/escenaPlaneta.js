// Planeta verde de polígonos: el relieve sale de una función fija, no del azar.
const relieve = (x, y, z) => Math.sin(x * 3.1 + 1.2) * Math.cos(y * 2.7) + Math.sin(z * 3.6 + x * 1.4) * 0.7 + Math.cos(y * 5.2 + z * 2.1) * 0.35;

const RADIO_MODELO = 3.345;
const RADIO_VISIBLE = 1;

// Pasa la textura original a la paleta verde de la página: mar, tierra y polos por separado.
function teñir(material) {
  material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 c = diffuseColor.rgb;
      float agua = smoothstep(.04, .2, c.b - max(c.r, c.g));
      float luz = dot(c, vec3(.3, .59, .11));
      vec3 mar = mix(vec3(.005, .13, .07), vec3(.008, .35, .147), smoothstep(.02, .14, luz));
      vec3 tierra = mix(vec3(.047, .72, .31), vec3(.68, .91, .15), smoothstep(.12, .3, luz));
      float hielo = smoothstep(.45, .7, min(c.r, min(c.g, c.b)));
      diffuseColor.rgb = mix(mix(tierra, mar, agua), vec3(.96, 1., .97), hielo);`);
  };
  material.roughnessMap = null; material.roughness = 0.92; material.specularIntensity = 0.25;
  material.needsUpdate = true;
}

export function crearPlaneta(THREE, escena) {
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camara.position.set(0, 0.5, 4.3);
  camara.lookAt(0, 0, 0);

  const geometria = new THREE.IcosahedronGeometry(1, 14);
  const pos = geometria.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    v.multiplyScalar(1 + Math.max(relieve(v.x, v.y, v.z), 0) * 0.04);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const colores = new Float32Array(pos.count * 3);
  const [oceano, tierra, cumbre] = ['#0f7a56', '#3ddc97', '#d7f56b'].map((c) => new THREE.Color(c));
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const h = relieve(cx, cy, cz);
    const c = h > 0.75 ? cumbre : h > 0 ? tierra : oceano;
    for (let k = 0; k < 3; k += 1) c.toArray(colores, (i + k) * 3);
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  geometria.computeVertexNormals();

  const grupo = new THREE.Group();
  grupo.rotation.z = 0.28;
  const planeta = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 }));
  const atmosfera = new THREE.Mesh(new THREE.SphereGeometry(1.1, 40, 40), new THREE.MeshBasicMaterial({ color: '#3ddc97', transparent: true, opacity: 0.1 }));
  grupo.add(planeta, atmosfera);
  escena.add(grupo);

  escena.add(new THREE.HemisphereLight('#ffffff', '#9fe3b4', 1.5));
  const sol = new THREE.DirectionalLight('#ffffff', 2.2);
  sol.position.set(3, 3, 4);
  escena.add(sol);

  // Modelo Elaria: mientras carga (o si falla) se ve el planeta de polígonos.
  let spin = null; let nubes = null; let nubesAltas = null;
  import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}modelos/elaria.glb`, ({ scene }) => {
      const mundo = scene.getObjectByName('ElariaWorld');
      mundo.position.set(0, 0, 0);
      mundo.traverse((o) => { if (o.material?.map && o.name === 'Surface') teñir(o.material); });
      spin = scene.getObjectByName('PlanetSpin');
      nubes = scene.getObjectByName('CloudDrift');
      nubesAltas = scene.getObjectByName('HighCloudDrift');
      scene.scale.setScalar(RADIO_VISIBLE / RADIO_MODELO);
      grupo.remove(planeta);
      grupo.add(scene);
    });
  });

  return {
    camara,
    ajustar: (w, h) => { camara.aspect = w / h; camara.updateProjectionMatrix(); },
    cuadro: (t) => {
      planeta.rotation.y = t * 0.25;
      if (spin) spin.rotation.y = t * 0.14;
      if (nubes) nubes.rotation.y = t * 0.2;
      if (nubesAltas) nubesAltas.rotation.y = t * 0.27;
    },
  };
}
