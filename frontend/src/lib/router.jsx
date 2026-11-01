import { useEffect, useState } from 'react';

// Router minimo por hash (#/ruta). Funciona igual en S3 sin configurar reescrituras.
export function rutaActual() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function useRuta() {
  const [r, setR] = useState(rutaActual());
  useEffect(() => {
    const f = () => setR(rutaActual());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function ir(path) { window.location.hash = path; }

export function coincide(patron, path) {
  const a = patron.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Enlace({ a, children, ...resto }) {
  return <a href={`#${a}`} {...resto}>{children}</a>;
}
