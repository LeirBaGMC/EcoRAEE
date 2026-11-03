import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hoyISO } from '../src/lib/format.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const temporal = await mkdtemp(`${raiz}node_modules/.destino-auditoria-`);
await build({
  stdin: { contents: `export { AuthProvider, useAuth } from './src/auth/AuthContext.jsx';
    export { sesion } from './src/api/client.js';
    export { Tratamientos, Asignaciones, Cierres } from './src/pages/Destino.jsx';
    export { default as ConsultaGlobal } from './src/pages/ConsultaGlobal.jsx';`, resolveDir: raiz },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env.VITE_API_URL': '"http://localhost:8000"' }, outfile: `${temporal}/app.mjs`,
});
const app = await import(pathToFileURL(`${temporal}/app.mjs`));
test.after(async () => { await rm(temporal, { recursive: true, force: true }); });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const pag = (items, pagina = 1, tamano = 20, total = items.length) => ({ items, pagina, tamano, total });
const boton = (vista, label) => vista.root.findAllByType('button').find((b) => b.children.filter((c) => typeof c === 'string' || typeof c === 'number').join('') === label);
const campo = (vista, nombre) => vista.root.findAll((n) => ['input', 'select'].includes(n.type) && n.props.name === nombre)[0];
async function cambiar(vista, nombre, valor) { await act(async () => { campo(vista, nombre).props.onChange({ target: { value: valor } }); }); }
async function conUsuario(C, props = {}) {
  function Pantalla() { const { usuario } = app.useAuth(); return usuario ? React.createElement(C, props) : null; }
  app.sesion.guardar('token-prueba');
  let vista;
  await act(async () => { vista = create(React.createElement(app.AuthProvider, null, React.createElement(Pantalla))); });
  return vista;
}

test('tratamiento iniciado muestra fechas y al finalizar refresca listado y dispositivos', async (t) => {
  let actual = null, finalizado = false, cargasLista = 0, cargasEquipos = 0;
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    const u = new URL(url), metodo = opciones?.method || 'GET';
    if (u.pathname === '/auth/me') return json({ roles: ['REACONDICIONADOR_RECICLADOR'] });
    if (u.pathname === '/dispositivos') {
      cargasEquipos++;
      const estado = actual ? 'EN_TRATAMIENTO' : 'EVALUADO';
      return json(pag(!finalizado && u.searchParams.get('estado') === estado ? [{ id_dispositivo: 128, codigo_trazabilidad: 'DSP-128', estado_actual: estado }] : []));
    }
    if (u.pathname === '/tratamientos' && metodo === 'GET') { cargasLista++; return json(pag(actual ? [actual] : [])); }
    if (u.pathname === '/tratamientos' && metodo === 'POST') {
      actual = { id_tratamiento: 14, id_dispositivo: 128, tipo_tratamiento: 'REACONDICIONAMIENTO', resultado: 'EN_CURSO', fecha_inicio: '2026-11-02T11:22:00', fecha_fin: null };
      return json(actual, 201);
    }
    if (u.pathname === '/tratamientos/14/finalizar') { finalizado = true; actual = { ...actual, resultado: 'EXITOSO', fecha_fin: '2026-11-02T12:00:00' }; return json(actual); }
    throw new Error(`Petición inesperada ${u.pathname}`);
  });
  let vista;
  try {
    vista = await conUsuario(app.Tratamientos);
    await cambiar(vista, 'id_dispositivo', '128'); await cambiar(vista, 'tipo_tratamiento', 'REACONDICIONAMIENTO');
    await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.match(JSON.stringify(vista.toJSON()), /11:22/);
    await act(async () => { await boton(vista, 'Finalizar con exito').props.onClick(); });
    assert.match(JSON.stringify(vista.toJSON()), /12:00/);
    assert.equal(boton(vista, 'Finalizar con exito'), undefined);
    assert.equal(vista.root.findAllByType('select').length, 0);
    assert.ok(cargasLista >= 3);
    assert.ok(cargasEquipos >= 6);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});

test('abrir un tratamiento fallido del listado explica el siguiente intento', async (t) => {
  const tratamiento = { id_tratamiento: 13, id_dispositivo: 128, resultado: 'FALLIDO', tipo_tratamiento: 'REACONDICIONAMIENTO', fecha_inicio: '2026-11-02T09:00:00', fecha_fin: '2026-11-02T10:00:00' };
  t.mock.method(globalThis, 'fetch', async (url) => {
    const path = new URL(url).pathname;
    if (path === '/auth/me') return json({ roles: ['REACONDICIONADOR_RECICLADOR'] });
    if (path === '/dispositivos') return json(pag([]));
    if (path === '/tratamientos') return json(pag([tratamiento]));
    if (path === '/tratamientos/13') return json(tratamiento);
    throw new Error(path);
  });
  let vista;
  try {
    vista = await conUsuario(app.Tratamientos);
    await act(async () => { await boton(vista, 'Abrir tratamiento #13').props.onClick(); });
    assert.match(JSON.stringify(vista.toJSON()), /Puedes iniciar un nuevo tratamiento compatible/);
    assert.equal(boton(vista, 'Finalizar como fallido'), undefined);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});

test('asignar carga todas las entidades, identifica RUC y descarta clasificación no asignable', async (t) => {
  const paginas = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const u = new URL(url);
    if (u.pathname === '/auth/me') return json({ roles: ['COORDINADOR_LOGISTICO'], id_organizacion: 1 });
    if (u.pathname === '/asignaciones') return json(pag([]));
    if (u.pathname === '/dispositivos') return json(pag(u.searchParams.get('estado') === 'EVALUADO' ? [
      { id_dispositivo: 1, codigo_trazabilidad: 'NO-ASIGNABLE', permite_asignacion: false, estado_actual: 'EVALUADO' },
      { id_dispositivo: 2, codigo_trazabilidad: 'SI-ASIGNABLE', permite_asignacion: true, estado_actual: 'EVALUADO' },
      { id_dispositivo: 3, codigo_trazabilidad: 'COMPATIBLE-SIN-DATO', estado_actual: 'EVALUADO' },
    ] : []));
    if (u.pathname === '/organizaciones') {
      const p = Number(u.searchParams.get('pagina')); paginas.push(p);
      const entidades = Array.from({ length: 101 }, (_, i) => ({ id_organizacion: i + 1, nombre: 'Escuela de prueba', ruc: `0999999999${String(i + 1).padStart(3, '0')}` }));
      return json(pag(entidades.slice((p - 1) * 100, p * 100), p, 100, 101));
    }
    throw new Error(u.pathname);
  });
  let vista;
  try {
    vista = await conUsuario(app.Asignaciones);
    const equipoOpciones = campo(vista, 'id_dispositivo').findAllByType('option').map((o) => o.children.join('')).join(' ');
    assert.doesNotMatch(equipoOpciones, /NO-ASIGNABLE/);
    assert.match(equipoOpciones, /SI-ASIGNABLE|COMPATIBLE-SIN-DATO/);
    assert.ok(paginas.includes(2));
    const entidades = campo(vista, 'id_organizacion_beneficiaria').findAllByType('option').map((o) => o.children.join('')).join(' ');
    assert.match(entidades, /RUC 0999999999101 · #101/);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});

test('beneficiaria ve identificación sin enlace restringido y confirma solo su propia organización', async (t) => {
  const asignaciones = [
    { id_asignacion: 10, id_dispositivo: 134, id_organizacion: 3, codigo_trazabilidad: 'DSP-134', marca: 'Marca', modelo: 'Modelo', nombre_organizacion: 'Escuela propia', ruc_organizacion: '1234567890123', entregada: false },
    { id_asignacion: 11, id_dispositivo: 135, id_organizacion: 4, codigo_trazabilidad: 'DSP-135', nombre_organizacion: 'Escuela ajena', entregada: false },
  ];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    const path = new URL(url).pathname;
    if (path === '/auth/me') return json({ roles: ['ADMINISTRADOR', 'ENTIDAD_BENEFICIARIA'], id_organizacion: 3 });
    if (path === '/asignaciones/10/confirmar' && opciones.method === 'POST') { Object.assign(asignaciones[0], { entregada: true, fecha_entrega: '2026-11-02' }); return json(asignaciones[0]); }
    if (path === '/asignaciones') return json(pag(asignaciones));
    throw new Error(path);
  });
  let vista;
  try {
    vista = await conUsuario(app.Asignaciones);
    const pantalla = JSON.stringify(vista.toJSON());
    assert.match(pantalla, /Consulta global/);
    assert.match(pantalla, /DSP-134 · Marca · Modelo/);
    assert.equal(vista.root.findAllByType('a').filter((a) => a.props.href?.startsWith('#/dispositivos/')).length, 0);
    assert.equal(vista.root.findAllByType('button').filter((b) => b.children.includes('Confirmar entrega recibida')).length, 1);
    await act(async () => { await boton(vista, 'Confirmar entrega recibida').props.onClick(); });
    assert.equal(boton(vista, 'Confirmar entrega recibida'), undefined);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});

for (const [caso, destino, soporte, estado] of [
  ['tratamiento fallido', 'tratamiento', { id_tratamiento: 14, id_dispositivo: 128, resultado: 'FALLIDO', fecha_fin: `${hoyISO()}T10:00:00` }, 'EN_TRATAMIENTO'],
  ['asignación sin entrega', 'asignacion', { id_asignacion: 14, id_dispositivo: 128, entregada: false, fecha_entrega: null }, 'ASIGNADO'],
]) {
  test(`Cierres bloquea ${caso} antes del envío`, async (t) => {
    let envios = 0;
    t.mock.method(globalThis, 'fetch', async (url, opciones) => {
      const path = new URL(url).pathname;
      if (opciones?.method === 'POST') { envios++; return json({}); }
      if (path === '/dispositivos/128') return json({ id_dispositivo: 128, codigo_trazabilidad: 'DSP-128', estado_actual: estado });
      if (path === '/dispositivos/128/cierre') return json({ mensaje: 'No existe cierre' }, 404);
      if (path === '/tratamientos/14') return json(soporte);
      if (path === '/asignaciones') return json(pag([soporte]));
      throw new Error(path);
    });
    let vista;
    try {
      await act(async () => { vista = create(React.createElement(app.Cierres, { query: { dispositivo: '128' } })); });
      assert.equal(campo(vista, 'id_dispositivo').props.value, '128');
      await cambiar(vista, 'destino', destino); await cambiar(vista, 'id_destino', '14');
      await act(async () => { await boton(vista, 'Revisar requisitos').props.onClick(); });
      assert.match(JSON.stringify(vista.toJSON()), /Todavía no se puede cerrar/);
      assert.equal(boton(vista, 'Cerrar trazabilidad').props.disabled, true);
      await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
      assert.equal(envios, 0);
    } finally { act(() => vista?.unmount()); }
  });
}

test('Cierres invalida la revisión al cambiar datos y bloquea repetir tras un cierre exitoso', async (t) => {
  let envios = 0;
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    const path = new URL(url).pathname;
    if (path === '/dispositivos/128') return json({ id_dispositivo: 128, codigo_trazabilidad: 'DSP-128', estado_actual: 'REACONDICIONADO' });
    if (path === '/dispositivos/128/cierre') return json({ mensaje: 'No existe cierre' }, 404);
    if (path === '/tratamientos/14') return json({ id_tratamiento: 14, id_dispositivo: 128, tipo_tratamiento: 'REACONDICIONAMIENTO', resultado: 'EXITOSO', fecha_fin: `${hoyISO()}T10:00:00` });
    if (path === '/cierres' && opciones.method === 'POST') { envios++; return json({ id_cierre: 18, id_dispositivo: 128, destino_final: 'TRATAMIENTO', fecha_confirmacion: hoyISO() }, 201); }
    throw new Error(path);
  });
  let vista;
  try {
    await act(async () => { vista = create(React.createElement(app.Cierres, { query: { dispositivo: '128' } })); });
    await cambiar(vista, 'id_destino', '14');
    await act(async () => { await boton(vista, 'Revisar requisitos').props.onClick(); });
    assert.equal(boton(vista, 'Cerrar trazabilidad').props.disabled, false);
    assert.match(JSON.stringify(vista.toJSON()), /Requisitos revisados/);
    await cambiar(vista, 'id_destino', '15');
    assert.equal(boton(vista, 'Cerrar trazabilidad').props.disabled, true);
    await cambiar(vista, 'id_destino', '14');
    await act(async () => { await boton(vista, 'Revisar requisitos').props.onClick(); });
    await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.match(JSON.stringify(vista.toJSON()), /Trazabilidad cerrada/);
    assert.equal(boton(vista, 'Cerrar trazabilidad').props.disabled, true);
    assert.equal(campo(vista, 'id_dispositivo').props.disabled, true);
    await act(async () => { await vista.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(envios, 1);
  } finally { act(() => vista?.unmount()); }
});

test('Consulta global identifica el alcance y no enlaza al dispositivo sin permiso', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => new URL(url).pathname === '/auth/me'
    ? json({ roles: ['ADMINISTRADOR'] })
    : json(pag([{ id_tratamiento: 14, id_dispositivo: 128, resultado: 'EXITOSO', tipo_tratamiento: 'REACONDICIONAMIENTO' }])));
  let vista;
  try {
    vista = await conUsuario(app.ConsultaGlobal, { recurso: 'tratamientos' });
    assert.match(JSON.stringify(vista.toJSON()), /Tratamientos: consulta global/);
    assert.equal(vista.root.findAllByType('a').length, 0);
  } finally { act(() => vista?.unmount()); app.sesion.borrar(); }
});
