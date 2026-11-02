import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos al entrar y permite recargar. Evita actualizar si la pantalla ya se cerro.
export function useAsync(fn, deps = []) {
  const [estado, setEstado] = useState({ cargando: true, data: null, error: null });
  const vivo = useRef(true);
  const cargar = useCallback(() => {
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    fn().then(
      (data) => vivo.current && setEstado({ cargando: false, data, error: null }),
      (error) => vivo.current && setEstado({ cargando: false, data: null, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { vivo.current = true; cargar(); return () => { vivo.current = false; }; }, [cargar]);
  return { ...estado, recargar: cargar };
}

// Ejecuta una accion (POST/PUT) una sola vez a la vez: el segundo clic mientras envia se ignora.
export function useAccion(fn) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const ocupado = useRef(false);
  const ejecutar = useCallback(async (...args) => {
    if (ocupado.current) return undefined;
    ocupado.current = true;
    setEnviando(true); setError(null); setOk(null);
    try {
      const r = await fn(...args);
      setOk(r ?? true);
      return r ?? true;
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }, [fn]);
  return { ejecutar, enviando, error, ok, limpiar: () => { setError(null); setOk(null); } };
}

// Trae todas las páginas de un listado para poder filtrar en el navegador.
export async function traerTodo(pedir, tamano = 100) {
  const primera = await pedir(1, tamano);
  const items = [...primera.items];
  for (let p = 2; items.length < primera.total; p += 1) items.push(...(await pedir(p, tamano)).items);
  return items;
}

export const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useForm(inicial) {
  const [v, setV] = useState(inicial);
  const set = (nombre, valor) => setV((x) => ({ ...x, [nombre]: valor }));
  const enlazar = (nombre) => ({
    name: nombre,
    value: v[nombre] ?? '',
    onChange: (e) => set(nombre, e.target.type === 'checkbox' ? e.target.checked : e.target.value),
  });
  return { v, set, enlazar, reiniciar: () => setV(inicial), setV };
}

export function errorCampo(error, nombre) {
  if (!error || !error.campos) return undefined;
  const c = error.campos.find((x) => x.campo === nombre || x.campo.endsWith(`.${nombre}`));
  return c ? c.mensaje : undefined;
}
