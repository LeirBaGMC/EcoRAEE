"""DELETE real en SQL Server con datos sinteticos revertidos al terminar cada prueba."""
import json
import os
import uuid
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import db
from app.main import app
from app.security import Actor, get_current_actor
from app.services import dispositivo_service, lote_service

pytestmark = pytest.mark.skipif(not os.environ.get('ECORAEE_DB_URL'), reason='Falta base de datos')


@pytest.fixture
def mundo_delete(monkeypatch):
    with db.transaccion() as s:
        usuario = s.execute(text(
            "SELECT TOP 1 u.id_usuario,u.id_organizacion FROM usuario u "
            "JOIN usuario_rol ur ON ur.id_usuario=u.id_usuario JOIN rol r ON r.id_rol=ur.id_rol "
            "WHERE r.nombre_rol='GENERADOR' AND u.activo=1 AND u.id_organizacion IS NOT NULL "
            "ORDER BY u.id_usuario")).mappings().first()
        categoria = s.execute(text('SELECT TOP 1 id_categoria FROM categoria_dispositivo ORDER BY id_categoria')).scalar()
    if not usuario or categoria is None:
        pytest.skip('Se necesita un generador activo con organizacion y una categoria')
    actor = Actor(usuario['id_usuario'], frozenset({'GENERADOR'}), usuario['id_organizacion'])
    serie = 'DELETE-ROLLBACK-' + uuid.uuid4().hex[:16]
    conexion = db._engine.connect()
    externa = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode='rollback_only')

    @contextmanager
    def transaccion_controlada():
        # Cada llamada conserva su atomicidad sin confirmar la transaccion externa.
        with sesion.begin_nested():
            yield sesion

    monkeypatch.setattr(dispositivo_service, 'transaccion', transaccion_controlada)
    monkeypatch.setattr(lote_service, 'transaccion', transaccion_controlada)
    monkeypatch.setitem(app.dependency_overrides, get_current_actor, lambda: actor)
    id_lote = None
    try:
        with TestClient(app, raise_server_exceptions=False) as cliente:
            respuesta = cliente.post('/dispositivos', json={
                'tipo_registro': 'INDIVIDUAL', 'id_categoria': categoria,
                'condicion_declarada': 'ENCIENDE', 'numero_serie': serie,
                'marca': 'PRUEBA DELETE', 'modelo': 'Transaccion revertida',
            })
            assert respuesta.status_code == 201, respuesta.text
            id_dispositivo = respuesta.json()['id_dispositivo']
            respuesta = cliente.post('/lotes', json={'ids_dispositivos': [id_dispositivo]})
            assert respuesta.status_code == 201, respuesta.text
            id_lote = respuesta.json()['id_lote']
            yield cliente, sesion, actor, id_lote, id_dispositivo
    finally:
        externa.rollback()
        sesion.close()
        conexion.close()
    with db.transaccion() as s:
        assert s.execute(text('SELECT COUNT(*) FROM dispositivo_individual WHERE numero_serie=:serie'), {'serie': serie}).scalar_one() == 0
        assert s.execute(text('SELECT COUNT(*) FROM lote WHERE id_lote=:id'), {'id': id_lote}).scalar_one() == 0
        assert s.execute(text("SELECT COUNT(*) FROM auditoria_cambio WHERE tabla_afectada='lote' AND clave_registro=:id"), {'id': str(id_lote)}).scalar_one() == 0


def test_delete_preserva_equipo_historial_audita_y_libera_para_otro_lote(mundo_delete):
    cliente, s, _, id_lote, id_dispositivo = mundo_delete
    historial_antes = s.execute(text('SELECT COUNT(*) FROM historial_estado WHERE id_dispositivo=:id'), {'id': id_dispositivo}).scalar_one()
    respuesta = cliente.delete(f'/lotes/{id_lote}')
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == {'id_lote': id_lote, 'eliminado': True, 'dispositivos_liberados': 1}
    assert cliente.get(f'/lotes/{id_lote}').status_code == 404
    assert cliente.delete(f'/lotes/{id_lote}').status_code == 404
    assert s.execute(text('SELECT COUNT(*) FROM lote_dispositivo WHERE id_lote=:id'), {'id': id_lote}).scalar_one() == 0
    assert s.execute(text('SELECT COUNT(*) FROM dispositivo WHERE id_dispositivo=:id'), {'id': id_dispositivo}).scalar_one() == 1
    assert s.execute(text('SELECT COUNT(*) FROM dispositivo_individual WHERE id_dispositivo=:id'), {'id': id_dispositivo}).scalar_one() == 1
    assert s.execute(text('SELECT COUNT(*) FROM historial_estado WHERE id_dispositivo=:id'), {'id': id_dispositivo}).scalar_one() == historial_antes
    audit = s.execute(text("SELECT operacion,valor_anterior,valor_nuevo FROM auditoria_cambio WHERE tabla_afectada='lote' AND clave_registro=:id"), {'id': str(id_lote)}).mappings().one()
    assert audit['operacion'] == 'DELETE'
    assert json.loads(audit['valor_anterior'])['ids_dispositivos'] == [id_dispositivo]
    assert audit['valor_nuevo'] is None
    otro = cliente.post('/lotes', json={'ids_dispositivos': [id_dispositivo]})
    assert otro.status_code == 201, otro.text
    assert otro.json()['id_lote'] != id_lote


def test_delete_con_solicitud_se_rechaza_y_conserva_relacion(mundo_delete):
    cliente, s, _, id_lote, id_dispositivo = mundo_delete
    respuesta = cliente.post('/solicitudes', json={
        'id_lote': id_lote, 'modalidad': 'ENTREGA_DIRECTA', 'zona_referencial': 'Prueba DELETE rollback',
    })
    assert respuesta.status_code == 201, respuesta.text
    assert cliente.delete(f'/lotes/{id_lote}').status_code == 409
    assert cliente.get(f'/lotes/{id_lote}').json()['dispositivos'] == [id_dispositivo]
    # La presencia de una solicitud tambien bloquea el DELETE si el estado fuera inconsistente.
    s.execute(text("UPDATE lote SET estado_lote='REGISTRADO' WHERE id_lote=:id"), {'id': id_lote})
    assert cliente.delete(f'/lotes/{id_lote}').status_code == 409
    assert s.execute(text('SELECT COUNT(*) FROM solicitud_recoleccion WHERE id_lote=:id'), {'id': id_lote}).scalar_one() == 1


def test_delete_de_otra_organizacion_no_revela_ni_borra(mundo_delete, monkeypatch):
    cliente, s, actor, id_lote, id_dispositivo = mundo_delete
    ajeno = Actor(actor.id_usuario, actor.roles, actor.id_organizacion + 1000000)
    monkeypatch.setitem(app.dependency_overrides, get_current_actor, lambda: ajeno)
    assert cliente.delete(f'/lotes/{id_lote}').status_code == 404
    assert s.execute(text('SELECT COUNT(*) FROM lote_dispositivo WHERE id_lote=:id AND id_dispositivo=:d'), {'id': id_lote, 'd': id_dispositivo}).scalar_one() == 1


def test_fallo_de_auditoria_revierte_ambos_deletes(mundo_delete):
    cliente, s, _, id_lote, id_dispositivo = mundo_delete
    with patch.object(lote_service.auditoria, 'registrar', side_effect=RuntimeError('Fallo simulado')):
        assert cliente.delete(f'/lotes/{id_lote}').status_code == 500
    assert cliente.get(f'/lotes/{id_lote}').json()['dispositivos'] == [id_dispositivo]
    assert s.execute(text('SELECT COUNT(*) FROM dispositivo WHERE id_dispositivo=:id'), {'id': id_dispositivo}).scalar_one() == 1
    assert s.execute(text("SELECT COUNT(*) FROM auditoria_cambio WHERE tabla_afectada='lote' AND clave_registro=:id"), {'id': str(id_lote)}).scalar_one() == 0
