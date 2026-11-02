// Árbol radial: el planeta se conecta con cada equipo, este con sus componentes y estos con sus materiales.
export function construirRed(dispositivos, radios) {
  const hojasTotal = dispositivos.reduce((n, d) => n + d.hijos.reduce((m, c) => m + c.hijos.length, 0), 0);
  const punto = (angulo, [rx, ry]) => ({ x: 50 + Math.cos(angulo) * rx, y: 50 + Math.sin(angulo) * ry, cos: Math.cos(angulo), sin: Math.sin(angulo) });
  const paso = (Math.PI * 2) / hojasTotal;
  const nodos = { n1: [], n2: [], n3: [] };
  const enlaces = [];
  let hoja = 0;
  dispositivos.forEach((d) => {
    const inicioD = hoja;
    d.hijos.forEach((c) => {
      const inicioC = hoja; hoja += c.hijos.length;
      const anguloC = ((inicioC + hoja - 1) / 2 + 0.5) * paso - Math.PI / 2;
      const pc = { ...punto(anguloC, radios.n2), nombre: c.nombre, info: c.info };
      nodos.n2.push(pc);
      c.hijos.forEach((m, i) => {
        const pm = { ...punto((inicioC + i + 0.5) * paso - Math.PI / 2, radios.n3), nombre: m };
        nodos.n3.push(pm);
        enlaces.push({ nivel: 3, a: pc, b: pm });
      });
    });
    const anguloD = ((inicioD + hoja - 1) / 2 + 0.5) * paso - Math.PI / 2;
    const pd = { ...punto(anguloD, radios.n1), item: d };
    nodos.n1.push(pd);
    enlaces.push({ nivel: 1, a: { x: 50, y: 50 }, b: pd });
    nodos.n2.slice(-d.hijos.length).forEach((pc) => enlaces.push({ nivel: 2, a: pd, b: pc }));
  });
  return { nodos, enlaces };
}
