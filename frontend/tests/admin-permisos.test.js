import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU, ROLES, puedeVer, tiene, R_ } from '../src/lib/permisos.js';

test('administrador conserva su menú base; cuenta con todos los roles ve todas las herramientas', () => {
  const admin = { roles: ['ADMINISTRADOR'] };
  const auditor = { roles: Object.keys(ROLES) };
  for (const item of MENU) assert.equal(puedeVer(auditor, item.ruta), true, item.ruta);
  assert.deepEqual(MENU.filter((m) => puedeVer(admin, m.ruta)).map((m) => m.ruta),
    ['/', '/evidencias', '/seguimiento', '/red', '/usuarios', '/organizaciones', '/auditoria']);
  assert.equal(tiene(admin, R_.G, R_.O, R_.T, R_.C, R_.R, R_.B), false);
  assert.equal(puedeVer({ roles: ['GENERADOR'] }, '/auditoria'), false);
  assert.equal(puedeVer({ roles: ['ENTIDAD_BENEFICIARIA'] }, '/usuarios'), false);
});
