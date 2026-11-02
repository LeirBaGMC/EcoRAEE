import { useEffect, useRef } from 'react';
import { Leaf } from 'lucide-react';
import { gsap, useVisible } from '../hooks/index.js';

export function Titulo({ nivel = 2, id, children, style }) {
  const Etiqueta = `h${Math.min(nivel, 3)}`;
  return <Etiqueta id={id} className={`eco-t${nivel}`} style={style}>{children}</Etiqueta>;}

export function Boton({ variante = 'primario', chico, href, onClick, children }) {
  const clase = `eco-boton ${variante}${chico ? ' chico' : ''}`;
  return href ? <a className={clase} href={href}>{children}</a> : <button type="button" className={clase} onClick={onClick}>{children}</button>;
}

export function Burbuja({ Icono, tam }) {
  return <span className="eco-burbuja" style={tam ? { '--tam': tam } : undefined}><Icono aria-hidden="true" /></span>;
}

const BURBUJAS = Array.from({ length: 14 }, (_, i) => ({ '--x': `${(i * 7.3 + 3) % 100}%`, '--t': `${1 + (i % 5) * 0.9}rem`, '--d': `${11 + (i % 6) * 2.5}s`, '--r': `${-i * 1.9}s` }));

export function Burbujas() {
  return <div className="eco-burbujas" aria-hidden="true">{BURBUJAS.map((b, i) => <i key={i} style={b} />)}</div>;
}

export function Marca() {
  return <a className="eco-marca" href="#/" aria-label="EcoRAEE, inicio"><span><Leaf size={18} /></span>EcoRAEE</a>;
}

export function Etiqueta({ children }) {
  return <span className="eco-etiqueta"><Leaf size={13} aria-hidden="true" />{children}</span>;
}

const formato = (v, dec) => {
  const [e, d] = v.toFixed(dec).split('.');
  return e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? `,${d}` : '');
};

export function Contador({ a, dec = 0, sufijo }) {
  const ref = useRef(null);
  const visible = useVisible(ref);
  useEffect(() => {
    if (!visible) return undefined;
    const o = { v: 0 };
    const t = gsap.to(o, { v: a, duration: 1.8, ease: 'power3.out', onUpdate: () => { ref.current.firstChild.textContent = formato(o.v, dec); } });
    return () => t.kill();
  }, [visible, a, dec]);
  return <span className="eco-numero" ref={ref}>{formato(0, dec)}{sufijo && <small>{sufijo}</small>}</span>;
}
