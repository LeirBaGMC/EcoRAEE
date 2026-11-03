"""Editar capacidad y auditar en SQL Server real, revirtiendo todos los cambios."""
import os
from contextlib import contextmanager
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import db
from app.persistence import movimientos
from app.security import Actor
from app.services import admin_service

pytestmark = pytest.mark.skipif(not os.environ.get('ECORAEE_DB_URL'), reason='Falta base de datos')


def test_editar_capacidad_audita_y_rollback_conserva_datos():
    with db.transaccion() as s:
        admin = s.execute(text("SELECT TOP 1 u.id_usuario,u.id_organizacion FROM usuario u "
                               "JOIN usuario_rol ur ON ur.id_usuario=u.id_usuario JOIN rol r ON r.id_rol=ur.id_rol "
                               "WHERE r.nombre_rol='ADMINISTRADOR' AND u.activo=1 ORDER BY u.id_usuario")).mappings().first()
        con = s.execute(text('SELECT TOP 1 id_conexion,capacidad_por_periodo,unidad_capacidad FROM conexion_logistica ORDER BY id_conexion')).mappings().first()
    if not admin or not con:
        pytest.skip('Se necesitan un administrador y una conexión existentes')
    actor = Actor(admin['id_usuario'], frozenset({'ADMINISTRADOR'}), admin['id_organizacion'])
    ident = str(con['id_conexion'])
    consulta = text("SELECT COUNT(*) FROM auditoria_cambio WHERE tabla_afectada='conexion_logistica' AND clave_registro=:id")
    conexion = db._engine.connect()
    externa = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode='rollback_only')

    @contextmanager
    def transaccion_externa():
        yield sesion

    try:
        original = Decimal(con['capacidad_por_periodo'])
        anterior = sesion.execute(consulta, {'id': ident}).scalar_one()
        comprometido = Decimal(movimientos.maximo_comprometido_por_periodo(sesion, int(ident), con['unidad_capacidad']))
        propuesta = max(original, comprometido) + Decimal('0.01')
        if propuesta > Decimal('999999999999.99'):
            pytest.skip('No hay margen para aumentar esta conexión')
        with patch.object(admin_service, 'transaccion', transaccion_externa):
            resultado = admin_service.actualizar_capacidad_conexion(actor, int(ident), propuesta)
        assert resultado['capacidad_por_periodo'] == propuesta
        assert sesion.execute(text('SELECT capacidad_por_periodo FROM conexion_logistica WHERE id_conexion=:id'), {'id': int(ident)}).scalar_one() == propuesta
        assert sesion.execute(consulta, {'id': ident}).scalar_one() == anterior + 1
    finally:
        externa.rollback()
        sesion.close()
        conexion.close()
    with db.transaccion() as s:
        assert s.execute(text('SELECT capacidad_por_periodo FROM conexion_logistica WHERE id_conexion=:id'), {'id': int(ident)}).scalar_one() == original
        assert s.execute(consulta, {'id': ident}).scalar_one() == anterior
