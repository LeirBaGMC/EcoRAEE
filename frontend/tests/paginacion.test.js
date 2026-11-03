import test from 'node:test';
import assert from 'node:assert/strict';
import { traerTodo } from '../src/lib/hooks.js';

test('recupera todas las páginas de un listado estable', async () => {
  const datos = [1, 2, 3, 4, 5];
  assert.deepEqual(await traerTodo(async (p, n) => ({ total: datos.length, items: datos.slice((p - 1) * n, p * n) }), 2), datos);
});

test('termina al recibir una página vacía aunque el total inicial sea mayor', async () => {
  const llamadas = [];
  const resultado = await traerTodo(async (p) => {
    llamadas.push(p);
    if (p > 2) throw new Error('No debe pedir otra página vacía');
    return { total: 100, items: p === 1 ? [1, 2] : [] };
  }, 2);
  assert.deepEqual(resultado, [1, 2]);
  assert.deepEqual(llamadas, [1, 2]);
});

test('acota las solicitudes aunque el total crezca', async () => {
  let llamadas = 0;
  await traerTodo(async (p) => {
    llamadas++;
    return { total: p === 1 ? 4 : 100, items: [p * 2 - 1, p * 2] };
  }, 2);
  assert.equal(llamadas, 2);
});

test('un listado vacío no solicita más páginas', async () => {
  let llamadas = 0;
  assert.deepEqual(await traerTodo(async () => { llamadas++; return { total: 0, items: [] }; }), []);
  assert.equal(llamadas, 1);
});

test('rechaza tamaños de página inválidos antes de consultar', async () => {
  for (const tamano of [0, -1, 1.5, Infinity]) {
    await assert.rejects(traerTodo(() => assert.fail('No debe consultar'), tamano), RangeError);
  }
});
