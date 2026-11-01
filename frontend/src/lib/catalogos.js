import { Catalogos } from '../api/endpoints.js';
import { useAsync } from './hooks.js';

// Los catalogos casi no cambian: se piden una vez por sesion de pantalla.
let promesa = null;
export function catalogos() {
  if (!promesa) promesa = Catalogos.todos().catch((e) => { promesa = null; throw e; });
  return promesa;
}
export const useCatalogos = () => useAsync(catalogos, []);
