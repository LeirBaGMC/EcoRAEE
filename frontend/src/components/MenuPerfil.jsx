import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';

export default function MenuPerfil({ nombre, detalle, alSalir }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  return (
    <div className="perfil" ref={ref}>
      <button type="button" className="perfil-boton" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
        <span className="avatar" aria-hidden="true">{nombre?.slice(0, 2).toUpperCase()}</span>
        <span><strong>{nombre}</strong><small>{detalle}</small></span>
        <ChevronDown className="perfil-flecha" size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="perfil-menu" role="menu">
          <p className="perfil-rol">{detalle}</p>
          <button type="button" role="menuitem" onClick={alSalir}><LogOut size={16} aria-hidden="true" />Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
