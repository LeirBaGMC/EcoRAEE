import { num } from '../lib/format.js';

// Grafo de la red con el flujo asignado en cada conexion. Siempre va acompanado de una tabla (ver Escenarios.jsx).
// Una conexion en el corte minimo se dibuja punteada y con la palabra "corte"; el color solo acompana.
export default function Grafo({ nodos, aristas, nombre }) {
  const ids = nodos.map((n) => n.id_centro);
  const profundidad = {};
  const fuentes = nodos.filter((n) => n.rol_nodo === 'FUENTE').map((n) => n.id_centro);
  const cola = [...(fuentes.length ? fuentes : ids.slice(0, 1))];
  cola.forEach((i) => { profundidad[i] = 0; });
  while (cola.length) {
    const u = cola.shift();
    aristas.filter((a) => a.origen === u).forEach((a) => {
      if (profundidad[a.destino] === undefined) { profundidad[a.destino] = profundidad[u] + 1; cola.push(a.destino); }
    });
  }
  const maxP = Math.max(0, ...Object.values(profundidad));
  ids.forEach((i) => { if (profundidad[i] === undefined) profundidad[i] = maxP + 1; });
  const capas = {};
  ids.forEach((i) => { (capas[profundidad[i]] = capas[profundidad[i]] || []).push(i); });
  const nCapas = Object.keys(capas).length;
  const ancho = Math.max(560, nCapas * 190);
  const alto = Math.max(300, Math.max(...Object.values(capas).map((c) => c.length)) * 130 + 80);
  const pos = {};
  Object.entries(capas).forEach(([p, lista]) => {
    lista.forEach((i, k) => { pos[i] = { x: 70 + (Number(p) / Math.max(1, nCapas - 1)) * (ancho - 140), y: (alto / (lista.length + 1)) * (k + 1) }; });
  });
  const rol = Object.fromEntries(nodos.map((n) => [n.id_centro, n.rol_nodo]));
  return (
    <svg className="grafo" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Grafo de la red con ${nodos.length} centros y ${aristas.length} conexiones. Los mismos datos estan en la tabla siguiente.`}>
      <defs>
        <marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker>
      </defs>
      {aristas.map((a) => {
        const p = pos[a.origen], q = pos[a.destino];
        if (!p || !q) return null;
        const hay = aristas.some((b) => b.origen === a.destino && b.destino === a.origen);
        const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
        const off = hay ? 22 : 0;
        const cx = (p.x + q.x) / 2 - (dy / len) * off, cy = (p.y + q.y) / 2 + (dx / len) * off;
        const ux = dx / len, uy = dy / len;
        const x1 = p.x + ux * 24, y1 = p.y + uy * 24, x2 = q.x - ux * 30, y2 = q.y - uy * 30;
        const vertical = Math.abs(dx) < Math.abs(dy) * 0.5;
        const lx = (x1 + 2 * cx + x2) / 4 + (vertical ? 10 : 0), ly = (y1 + 2 * cy + y2) / 4 - (vertical ? 0 : 8);
        return (
          <g key={a.id_conexion} style={{ color: a.corte ? 'var(--mal)' : 'var(--verde)' }}>
            <path d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} fill="none" stroke="currentColor" strokeWidth={a.corte ? 3.5 : 2} strokeDasharray={a.corte ? '8 5' : undefined} markerEnd="url(#flecha)" />
            <text x={lx} y={ly} textAnchor={vertical ? 'start' : 'middle'} style={{ fill: 'var(--tinta)', paintOrder: 'stroke', stroke: 'var(--papel)', strokeWidth: 4 }}>{num(a.flujo)}/{num(a.capacidad)}{a.corte ? ' corte' : ''}</text>
          </g>
        );
      })}
      {ids.map((i) => (
        <g key={i}>
          {rol[i] === 'SUMIDERO' ? <rect x={pos[i].x - 22} y={pos[i].y - 22} width="44" height="44" rx="6" fill="var(--verde-claro)" stroke="var(--verde)" strokeWidth="2.5" />
            : <circle cx={pos[i].x} cy={pos[i].y} r="24" fill={rol[i] === 'FUENTE' ? 'var(--rosa-claro)' : 'var(--verde-claro)'} stroke={rol[i] === 'FUENTE' ? 'var(--rosa)' : 'var(--verde)'} strokeWidth="2.5" />}
          <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" fontWeight="700">{rol[i] === 'FUENTE' ? 'F' : rol[i] === 'SUMIDERO' ? 'S' : 'I'}</text>
          <text x={pos[i].x} y={pos[i].y + 44} textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'var(--papel)', strokeWidth: 4 }}>{nombre(i)}</text>
        </g>
      ))}
    </svg>
  );
}
