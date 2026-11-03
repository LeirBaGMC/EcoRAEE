import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const temporal = await mkdtemp(`${raiz}node_modules/.movil-rutas-`);
await build({
  stdin: { contents: `export { default as App } from './src/App.jsx';
    export { AuthProvider, useAuth } from './src/auth/AuthContext.jsx';
    export { sesion } from './src/api/client.js';
    export { EscenarioDetalle, EscenarioNuevo } from './src/pages/Escenarios.jsx';
    export { default as Grafo } from './src/pages/Grafo.jsx';`, resolveDir: raiz },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env.VITE_API_URL': '"http://localhost:8000"' },
  plugins: [{ name: 'omitir-portada-visual', setup(b) {
    b.onLoad({ filter: /[\\/]landing[\\/]Landing\.jsx$/ }, () => ({ contents: 'export default function Landing() { return null; }', loader: 'js' }));
  } }],
  outfile: `${temporal}/app.mjs`,
});
const app = await import(pathToFileURL(`${temporal}/app.mjs`));
test.after(async () => { await rm(temporal, { recursive: true, force: true }); });

function navegador(path) {
  const anteriores = { window: globalThis.window, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const eventos = new Map();
  const doc = {
    body: { style: { overflow: '', position: '', top: '', width: '' } },
    documentElement: { style: { overflow: '' } }, activeElement: null,
    getElementById: () => null,
    addEventListener: (tipo, fn) => eventos.set(tipo, fn),
    removeEventListener: (tipo) => eventos.delete(tipo),
  };
  globalThis.window = {
    location: { hash: `#${path}` }, scrollY: 700, scrollTo: (...args) => { doc.scrollRestaurado = args; },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  globalThis.document = doc;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return { doc, eventos, restaurar: () => Object.assign(globalThis, anteriores) };
}

const json = (data) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

for (const [rol, path] of [
  ['ADMINISTRADOR', '/movimientos/nuevo'],
  ['OPERADOR_CENTRO', '/movimientos/nuevo'],
  ['TECNICO_EVALUADOR', '/dispositivos/nuevo'],
  ['COORDINADOR_LOGISTICO', '/dispositivos/nuevo'],
  ['GENERADOR', '/escenarios/nuevo'],
  ['ENTIDAD_BENEFICIARIA', '/dispositivos/134'],
]) {
  test(`${rol}: ${path} rechaza antes de solicitar datos y permite salir a Inicio`, async (t) => {
    const entorno = navegador(path), llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      llamadas.push(new URL(url).pathname);
      return json({ roles: [rol], nombre_visible: 'Prueba' });
    });
    let vista;
    try {
      app.sesion.guardar('token-prueba');
      await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(app.App))); });
      assert.match(JSON.stringify(vista.toJSON()), /Sin acceso/);
      assert.deepEqual(llamadas, ['/auth/me']);
      assert.equal(vista.root.findByProps({ children: 'Volver a Inicio' }).props.href, '#/');
    } finally { act(() => vista?.unmount()); app.sesion.borrar(); entorno.restaurar(); }
  });
}

test('una ruta de detalle con identificador inválido no solicita el registro', async (t) => {
  const entorno = navegador('/movimientos/cualquier-texto'), llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url) => { llamadas.push(new URL(url).pathname); return json({ roles: ['COORDINADOR_LOGISTICO'] }); });
  let vista;
  try {
    app.sesion.guardar('token-prueba');
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(app.App))); });
    assert.match(JSON.stringify(vista.toJSON()), /Página no encontrada/);
    assert.deepEqual(llamadas, ['/auth/me']);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); entorno.restaurar(); }
});

test('el menú contiene el foco, aísla el fondo y restaura foco y desplazamiento al cerrar', async (t) => {
  const entorno = navegador('/movimientos/nuevo');
  t.mock.method(globalThis, 'fetch', async () => json({ roles: ['ADMINISTRADOR'], nombre_visible: 'Prueba' }));
  const primero = { focus: () => { entorno.doc.activeElement = primero; } };
  const ultimo = { focus: () => { entorno.doc.activeElement = ultimo; } };
  const disparador = { focus: () => { entorno.doc.activeElement = disparador; } };
  const panel = { querySelectorAll: () => [primero, ultimo], contains: (el) => [primero, ultimo].includes(el) };
  let vista;
  try {
    app.sesion.guardar('token-prueba');
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(app.App)), {
      createNodeMock: (elemento) => elemento.props.id === 'menu-lateral' ? panel : elemento.props['aria-label'] === 'Abrir menú' ? disparador : null,
    }); });
    await act(async () => { vista.root.findByProps({ 'aria-label': 'Abrir menú' }).props.onClick(); });
    assert.equal(vista.root.findByProps({ className: 'cuerpo' }).props.inert, '');
    assert.equal(vista.root.findByProps({ id: 'menu-lateral' }).props['aria-modal'], true);
    assert.equal(entorno.doc.body.style.position, 'fixed');
    assert.equal(entorno.doc.body.style.top, '-700px');
    assert.equal(entorno.doc.activeElement, primero);
    let impedido = false;
    entorno.eventos.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault: () => { impedido = true; } });
    assert.equal(impedido, true);
    assert.equal(entorno.doc.activeElement, ultimo);
    entorno.eventos.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() {} });
    assert.equal(entorno.doc.activeElement, primero);
    await act(async () => { entorno.eventos.get('keydown')({ key: 'Escape', preventDefault() {} }); });
    assert.equal(vista.root.findByProps({ className: 'cuerpo' }).props.inert, undefined);
    assert.equal(entorno.doc.body.style.position, '');
    assert.deepEqual(entorno.doc.scrollRestaurado, [0, 700]);
    assert.equal(entorno.doc.activeElement, disparador);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); entorno.restaurar(); }
});

test('el grafo conserva tamaño legible y sus controles amplían hasta 200 por ciento', async () => {
  let vista;
  try {
    await act(async () => { vista = create(React.createElement(app.Grafo, {
      nodos: [{ id_centro: 1, rol_nodo: 'FUENTE' }, { id_centro: 2, rol_nodo: 'SUMIDERO' }],
      aristas: [{ id_conexion: 1, origen: 1, destino: 2, flujo: 8, capacidad: 10 }],
      nombre: (id) => `Centro de prueba con un nombre largo ${id}`,
    })); });
    assert.equal(vista.root.findByType('svg').props.width, 720);
    assert.equal(vista.root.findByProps({ 'aria-label': 'Reducir grafo' }).props.disabled, true);
    assert.equal(vista.root.findByProps({ 'aria-label': 'Grafo desplazable' }).props.tabIndex, 0);
    for (let i = 0; i < 4; i++) await act(async () => { vista.root.findByProps({ 'aria-label': 'Ampliar grafo' }).props.onClick(); });
    assert.equal(vista.root.findByType('svg').props.width, 1440);
    assert.equal(vista.root.findByProps({ 'aria-label': 'Ampliar grafo' }).props.disabled, true);
  } finally { act(() => vista?.unmount()); }
});

test('centros de escenario se ordenan, se buscan y ofrecen campos etiquetados para el papel y oferta', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json([
    { id_centro: 2, nombre: 'Zamora', codigo_centro: 'ZAM' },
    { id_centro: 1, nombre: 'Ambato', codigo_centro: 'AMB' },
  ]));
  let vista;
  try {
    await act(async () => { vista = create(React.createElement(app.EscenarioNuevo)); });
    const etiquetas = vista.root.findAllByType('label').map((l) => l.children.join(''));
    assert.ok(etiquetas.indexOf('AMB - Ambato') < etiquetas.indexOf('ZAM - Zamora'));
    await act(async () => { vista.root.findAllByType('input').find((i) => i.props.type === 'search').props.onChange({ target: { value: 'AMB' } }); });
    assert.equal(vista.root.findAllByType('input').filter((i) => i.props.type === 'checkbox').length, 1);
    await act(async () => { vista.root.findAllByType('input').find((i) => i.props.type === 'checkbox').props.onChange(); });
    const papel = vista.root.findAllByType('select').find((s) => s.props.value === 'INTERMEDIO');
    await act(async () => { papel.props.onChange({ target: { value: 'FUENTE' } }); });
    const oferta = vista.root.findAllByType('input').find((i) => i.props.type === 'number');
    assert.equal(oferta.props.inputMode, 'decimal');
    assert.ok(vista.root.findAllByType('label').some((l) => l.props.htmlFor === oferta.props.id && l.children.includes('Oferta de Ambato (opcional)')));
  } finally { act(() => vista?.unmount()); }
});

test('calcular confirma algoritmo y valor; repetir conserva ejecuciones y abrir no crea otra', async (t) => {
  let creadas = 0;
  const historial = [];
  const esc = { id_escenario: 9, codigo_escenario: 'ESC-9', nombre: 'Red de prueba', unidad_flujo: 'UND', estado_escenario: 'VIGENTE', nodos: [], conexiones: [] };
  const resultado = (id, algoritmo = 'EDMONDS_KARP') => ({ id_ejecucion: id, algoritmo, flujo_maximo: 8, resultados: [] });
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    const path = new URL(url).pathname;
    if (path === '/auth/me') return json({ roles: ['COORDINADOR_LOGISTICO'] });
    if (path === '/centros') return json([]);
    if (path === '/escenarios/9') return json(esc);
    if (path === '/escenarios/9/ejecuciones' && opciones?.method === 'POST') {
      const r = resultado(20 + ++creadas, JSON.parse(opciones.body).algoritmo);
      historial.push({ ...r, fecha_hora_ejecucion: `2026-11-02T12:00:0${creadas}`, estado_ejecucion: 'COMPLETADA' });
      return json(r);
    }
    if (path === '/escenarios/9/ejecuciones') return json(historial);
    if (path === '/escenarios/9/ejecuciones/21') return json(resultado(21));
    throw new Error(`Petición inesperada: ${path}`);
  });
  function Pantalla() { const { usuario } = app.useAuth(); return usuario ? React.createElement(app.EscenarioDetalle, { params: { id: '9' } }) : null; }
  let vista;
  try {
    app.sesion.guardar('token-prueba');
    await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Pantalla))); });
    for (let i = 1; i <= 2; i++) {
      await act(async () => { await vista.root.findAllByType('button').find((b) => b.children.includes('Calcular y guardar ejecución')).props.onClick(); });
      const pantalla = JSON.stringify(vista.toJSON());
      assert.match(pantalla, new RegExp(`Ejecución #${20 + i} creada`));
      assert.match(pantalla, /Edmonds-Karp/);
      assert.match(pantalla, /mismo flujo máximo/);
    }
    await act(async () => { await vista.root.findByProps({ 'aria-label': 'Abrir ejecución 21 de Edmonds-Karp' }).props.onClick(); });
    assert.equal(creadas, 2);
    assert.equal(historial.length, 2);
    assert.match(JSON.stringify(vista.toJSON()), /Ejecución #21 abierta/);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});
