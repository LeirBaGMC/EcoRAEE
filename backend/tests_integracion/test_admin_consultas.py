"""Consultas de administrador con datos existentes: no crea ni modifica registros."""
import os
import pytest
from sqlalchemy import text
from app.db import transaccion
from app.security import Actor
from app.domain.errors import NoEncontradoError, PermisoDenegadoError
from app.domain.permisos import exigir_permiso, PERMISOS
from app.services import consulta_service as dispositivos, movimiento_service as movimientos
from app.services import ciclo_service as ciclo, admin_service as admin, flujo_service as flujo

pytestmark = pytest.mark.skipif(not os.environ.get('ECORAEE_DB_URL'), reason='Falta base de datos')


def test_admin_lectura_global_sin_organizacion():
    # Una organización ajena verifica que el acceso no depende de pertenecer al propietario.
    actor = Actor(7, frozenset(PERMISOS), -1)
    ajeno = Actor(7, frozenset({'COORDINADOR_LOGISTICO'}), -1)
    with transaccion() as s:
        ids = {t: s.execute(text(f'SELECT TOP 1 {k} FROM {t} ORDER BY {k} DESC')).scalar()
               for t,k in [('dispositivo','id_dispositivo'),('movimiento','id_movimiento'),
                           ('tratamiento','id_tratamiento'),('cierre_trazabilidad','id_dispositivo'),('escenario_red','id_escenario')]}
        total = s.execute(text('SELECT COUNT(*) FROM dispositivo')).scalar()
    assert total > 0
    assert dispositivos.listar_dispositivos(actor,1,100)['total'] == total
    dispositivos.obtener_dispositivo(actor,ids['dispositivo'])
    dispositivos.historial_dispositivo(actor,ids['dispositivo'])
    with pytest.raises(NoEncontradoError): dispositivos.obtener_dispositivo(ajeno,ids['dispositivo'])
    movimientos.obtener(actor,ids['movimiento'])
    with pytest.raises(NoEncontradoError): movimientos.obtener(ajeno,ids['movimiento'])
    assert movimientos.listar(actor,1,20,None)['total'] > 0
    ciclo.obtener_tratamiento(actor,ids['tratamiento'])
    ciclo.consultar_cierre(actor,ids['cierre_trazabilidad'])
    assert ciclo.listar_asignaciones(actor,1,20)['total'] > 0
    flujo.obtener_escenario(actor,ids['escenario_red'])
    assert flujo.listar_ejecuciones(actor,ids['escenario_red'])
    for recurso in ['recepciones','tratamientos','cierres']:
        assert admin.consulta_global(actor,recurso,1,20)['total'] > 0
        with pytest.raises(PermisoDenegadoError): admin.consulta_global(ajeno,recurso,1,20)
    for permiso in ['dispositivo:registrar','evaluacion:registrar','movimiento:programar','tratamiento:registrar','asignacion:confirmar']:
        exigir_permiso(actor.roles,permiso)
        with pytest.raises(PermisoDenegadoError): exigir_permiso({'ADMINISTRADOR'},permiso)
