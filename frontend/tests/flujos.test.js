import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { useAsync } from '../src/lib/hooks.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const temporal = await mkdtemp(`${raiz}node_modules/.pruebas-`);
await build({
  stdin: { contents: `export { AuthProvider, useAuth } from './src/auth/AuthContext.jsx';
    export { api, sesion } from './src/api/client.js';
    export { default as Evidencias } from './src/pages/Evidencias.jsx';
    export { default as Solicitudes } from './src/pages/Solicitudes.jsx';
    export { MovimientoNuevo } from './src/pages/Movimientos.jsx';
    export { Tratamientos } from './src/pages/Destino.jsx';
    export { DispositivoNuevo, DispositivoDetalle } from './src/pages/Dispositivos.jsx';`, resolveDir: raiz },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env.VITE_API_URL': '"http://localhost:8000"' },
  outfile: `${temporal}/app.mjs`,
});
const app = await import(pathToFileURL(`${temporal}/app.mjs`));
test.after(async () => { await rm(temporal, { recursive: true, force: true }); });

test('registro repetido muestra conflicto y retira el éxito anterior', async (t) => {
  let envios = 0;
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    if (opciones?.method === 'POST') {
      envios++;
      return new Response(JSON.stringify(envios === 1
        ? { id_dispositivo: 136, codigo_trazabilidad: 'DSP-PRUEBA', estado: 'REGISTRADO' }
        : { error: 'CONFLICTO', mensaje: 'Ya existe un dispositivo registrado con ese número de serie.' }),
      { status: envios === 1 ? 201 : 409, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ categorias: [{ id_categoria: 1, nombre_categoria: 'LAPTOP' }], clasificaciones: [] }),
      { headers: { 'Content-Type': 'application/json' } });
  });
  let vista;
  try {
    await act(async () => { vista = create(React.createElement(app.DispositivoNuevo)); });
    await act(async () => {
      vista.root.findAllByType('select')[1].props.onChange({ target: { value: '1' } });
      vista.root.findAllByType('input')[0].props.onChange({ target: { value: 'AUD-IND-001' } });
    });
    await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.match(JSON.stringify(vista.toJSON()), /Dispositivo registrado/);
    await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    const pantalla = JSON.stringify(vista.toJSON());
    assert.match(pantalla, /Ya existe un dispositivo/);
    assert.doesNotMatch(pantalla, /Dispositivo registrado|Sin conexión/);
    assert.equal(envios, 2);
  } finally { act(() => vista?.unmount()); }
});

test('Evidencias admite tipo vacío o desconocido sin dejar la pantalla en blanco', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ roles: ['ADMINISTRADOR'] }), { headers: { 'Content-Type': 'application/json' } }));
  app.sesion.guardar('token-prueba');
  let vista;
  function Pantalla({ query }) { const { usuario } = app.useAuth(); return usuario ? React.createElement(app.Evidencias, { query }) : null; }
  try {
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Pantalla, { query: { destino: 'invalido', id: '1' } }))); });
    assert.match(JSON.stringify(vista.toJSON()), /Completa los numeros/);
    await act(async () => { vista.root.findByType('select').props.onChange({ target: { value: 'id_movimiento' } }); });
    await act(async () => { vista.root.findByType('input').props.onChange({ target: { value: '1' } }); });
    assert.match(JSON.stringify(vista.toJSON()), /Consultar evidencias/);
    await act(async () => { vista.root.findAllByType('select')[0].props.onChange({ target: { value: '' } }); });
    assert.match(JSON.stringify(vista.toJSON()), /Completa los numeros/);
    assert.equal(vista.root.findAllByType('input').length, 0);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});

function pendiente() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

test('useAsync conserva la respuesta nueva al cambiar filtros', async () => {
  const vieja = pendiente(), nueva = pendiente();
  let estado, vista;
  function Sonda({ filtro }) {
    estado = useAsync(() => filtro === 1 ? vieja.promise : nueva.promise, [filtro]);
    return null;
  }
  await act(async () => { vista = create(React.createElement(Sonda, { filtro: 1 })); });
  await act(async () => { vista.update(React.createElement(Sonda, { filtro: 2 })); });
  await act(async () => { nueva.resolve('nuevo'); });
  await act(async () => { vieja.resolve('obsoleto'); });
  assert.equal(estado.data, 'nuevo');
  act(() => vista.unmount());
});

test('useAsync ignora errores antiguos tras recargar y llamadas tras desmontar', async () => {
  const vieja = pendiente(), nueva = pendiente();
  let estado, vista, llamadas = 0;
  function Sonda() {
    estado = useAsync(() => (++llamadas === 1 ? vieja.promise : nueva.promise), []);
    return null;
  }
  await act(async () => { vista = create(React.createElement(Sonda)); });
  await act(async () => { estado.recargar(); });
  await act(async () => { nueva.resolve('nuevo'); });
  await act(async () => { vieja.reject(new Error('antiguo')); });
  assert.equal(estado.data, 'nuevo');
  assert.equal(estado.error, null);
  act(() => vista.unmount());
  await act(async () => { estado.recargar(); });
  assert.equal(llamadas, 2);
});

test('useAsync presenta errores síncronos como estado de error', async () => {
  let estado, vista;
  function Sonda() { estado = useAsync(() => { throw new Error('fallo'); }, []); return null; }
  await act(async () => { vista = create(React.createElement(Sonda)); });
  assert.equal(estado.error.message, 'fallo');
  assert.equal(estado.cargando, false);
  act(() => vista.unmount());
});

test('sesión vencida va al login con aviso; salida manual va al inicio', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 401 }));
  const anterior = globalThis.window;
  globalThis.window = { location: { hash: '/' } };
  let auth, vista;
  function Sonda() { auth = app.useAuth(); return null; }
  try {
    app.sesion.borrar();
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Sonda))); });
    app.sesion.guardar('token-vencido');
    await act(async () => { await assert.rejects(app.api('GET', '/auth/me'), { status: 401 }); });
    assert.equal(window.location.hash, '/login');
    assert.match(auth.aviso, /sesion vencio/);
    assert.equal(app.sesion.token(), null);
    await act(async () => { auth.salir(); });
    assert.equal(window.location.hash, '/');
    assert.equal(auth.aviso, null);
  } finally { act(() => vista?.unmount()); globalThis.window = anterior; }
});

for (const pantalla of ['Solicitudes', 'MovimientoNuevo', 'Tratamientos']) {
  test(`${pantalla}: muestra el dispositivo 101 de la segunda página`, async (t) => {
    const llamadas = [];
    const estadoObjetivo = pantalla === 'Solicitudes' ? 'REGISTRADO' : 'EVALUADO';
    t.mock.method(globalThis, 'fetch', async (url) => {
      const u = new URL(url);
      let data;
      if (u.pathname === '/auth/me') data = { roles: ['GENERADOR'], nombre_visible: 'Prueba' };
      else if (u.pathname === '/dispositivos') {
        const p = Number(u.searchParams.get('pagina'));
        const estado = u.searchParams.get('estado');
        llamadas.push([estado, p]);
        const items = estado === estadoObjetivo ? Array.from({ length: 101 }, (_, i) => ({
          id_dispositivo: i + 1, codigo_trazabilidad: `EQUIPO-${i + 1}`, estado_actual: estado,
          id_centro: i === 100 ? 1 : 2, tipo_registro: 'INDIVIDUAL',
        })) : [];
        data = { total: items.length, items: items.slice((p - 1) * 100, p * 100) };
      } else if (u.pathname === '/conexiones') data = [{ id_conexion: 1, activa: true, id_centro_origen: 1, id_centro_destino: 2, capacidad_por_periodo: 1000, unidad_capacidad: 'UND' }];
      else if (u.pathname === '/centros') data = [{ id_centro: 1, nombre: 'Origen' }, { id_centro: 2, nombre: 'Destino' }];
      else if (u.pathname === '/tratamientos') data = { items: [], total: 0, pagina: 1, tamano: 20 };
      else if (u.pathname === '/solicitudes') data = { items: [], total: 0, pagina: 1, tamano: 20 };
      else throw new Error(`Petición inesperada ${url}`);
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    });
    let vista;
    app.sesion.guardar('token-prueba');
    function Pantalla() { const { usuario } = app.useAuth(); return usuario ? React.createElement(app[pantalla]) : null; }
    try {
      await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Pantalla))); });
      if (pantalla === 'MovimientoNuevo') {
        await act(async () => { vista.root.findByProps({ name: 'id_conexion' }).props.onChange({ target: { value: '1' } }); });
      }
      assert.match(JSON.stringify(vista.toJSON()), /EQUIPO-101/);
      assert.ok(llamadas.some(([e, p]) => e === estadoObjetivo && p === 2));
    } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
  });
}

test('detalle granel identifica cantidades y clasificación; no ofrece asignar si no está permitido', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const ruta = new URL(url).pathname;
    let datos;
    if (ruta === '/auth/me') datos = { roles: ['COORDINADOR_LOGISTICO'], id_organizacion: 1 };
    else if (ruta.endsWith('/historial')) datos = [];
    else if (ruta.endsWith('/cierre')) return new Response('{}', { status: 404 });
    else datos = { id_dispositivo: 135, codigo_trazabilidad: 'DSP-GRANEL', tipo_registro: 'GRANEL', estado_actual: 'EVALUADO', nombre_categoria: 'CABLES', peso_kg: '2.5', cantidad_unidades: 10, nombre_clasificacion: 'RECICLABLE', permite_asignacion: false, diagnostico: 'Cables incompletos para reciclaje' };
    return new Response(JSON.stringify(datos), { headers: { 'Content-Type': 'application/json' } });
  });
  let vista; app.sesion.guardar('prueba');
  function Pantalla() { const { usuario } = app.useAuth(); return usuario ? React.createElement(app.DispositivoDetalle, { params: { id: '135' } }) : null; }
  try {
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Pantalla))); });
    const pantalla = JSON.stringify(vista.toJSON());
    assert.match(pantalla, /Peso total \(kg\)|Cantidad de unidades/);
    assert.match(pantalla, /CABLES/);
    assert.match(pantalla, /Cables incompletos para reciclaje/);
    assert.doesNotMatch(pantalla, /Asignar a beneficiario/);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});
