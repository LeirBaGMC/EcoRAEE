import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Auth } from '../api/endpoints.js';
import { onSesionVencida, sesion } from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(!!sesion.token());
  const [aviso, setAviso] = useState(null);

  const salir = useCallback((mensaje) => {
    sesion.borrar();
    setUsuario(null);
    setCargando(false);
    setAviso(mensaje || null);
    window.location.hash = mensaje ? '/login' : '/';
  }, []);

  useEffect(() => {
    onSesionVencida(() => salir('Tu sesion vencio o fue cerrada. Ingresa de nuevo.'));
    if (!sesion.token()) return;
    Auth.yo().then(setUsuario).catch((e) => {
      if (e.status !== 401) setAviso(e.message);
      sesion.borrar();
    }).finally(() => setCargando(false));
  }, [salir]);

  const entrar = useCallback(async (nombre, clave) => {
    const { access_token: token } = await Auth.login(nombre, clave);
    sesion.guardar(token);
    try {
      setUsuario(await Auth.yo());
    } catch (e) {
      sesion.borrar();
      throw e;
    }
    setAviso(null);
  }, []);

  const valor = useMemo(() => ({ usuario, cargando, aviso, entrar, salir }), [usuario, cargando, aviso, entrar, salir]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
