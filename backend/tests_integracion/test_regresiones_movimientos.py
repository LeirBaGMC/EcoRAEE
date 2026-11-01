"""Regresiones contra SQL Server: capacidad KG, RN-04 e idempotencia."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
import uuid
import os

import pytest
from sqlalchemy import text

from .test_flujo_completo import mundo, _recibir_y_evaluar, _cliente
from app.db import transaccion

pytestmark = pytest.mark.skipif(not os.environ.get('ECORAEE_DB_URL'), reason='Falta ECORAEE_DB_URL')


def _cuerpo(m, ids, conexion=None):
    return {"id_conexion": conexion or m["con_rea"], "tipo_movimiento": "TRANSFERENCIA",
            "fecha_despacho": str(date.today()), "dispositivos": [{"id_dispositivo": i} for i in ids]}


def test_kg_granel_persistido_y_limite(mundo):
    c, h = mundo["c"], mundo["h"]
    with transaccion() as s:
        destino = s.execute(text("INSERT INTO centro (codigo_centro,nombre,tipo_centro,ciudad,capacidad_almacenamiento,id_organizacion) "
                                "OUTPUT INSERTED.id_centro VALUES (:c,'Prueba KG','RECICLAJE','Quito',100,:o)"),
                            {"c": 'KG-' + uuid.uuid4().hex[:8], "o": mundo['org']}).scalar()
        conexion = s.execute(text("INSERT INTO conexion_logistica (id_centro_origen,id_centro_destino,capacidad_por_periodo,unidad_capacidad) "
                                 "OUTPUT INSERTED.id_conexion VALUES (:a,:b,10,'KG')"),
                             {"a": mundo['centro_rec'], "b": destino}).scalar()
    ids = []
    for _ in range(2):
        r = c.post('/dispositivos', headers=h['gen'], json={"tipo_registro":"GRANEL", "id_categoria":4,
                   "condicion_declarada":"INCOMPLETO", "peso_kg":"6", "cantidad_unidades":2})
        assert r.status_code == 201, r.text
        ids.append(r.json()['id_dispositivo'])
    lote = c.post('/lotes', headers=h['gen'], json={'ids_dispositivos':ids}).json()['id_lote']
    sol = c.post('/solicitudes', headers=h['gen'], json={'id_lote':lote,'modalidad':'ENTREGA_DIRECTA','zona_referencial':'Norte'}).json()['id_solicitud']
    r = c.post('/recepciones', headers=h['op'], json={'id_solicitud':sol,'id_centro':mundo['centro_rec'],
               'peso_recibido_kg':12,'unidades_recibidas':4,'conforme':True})
    assert r.status_code == 201, r.text
    for i in ids:
        r = c.post(f'/dispositivos/{i}/evaluaciones',headers=h['tec'],json={'condicion_constatada':'INCOMPLETO','diagnostico':'Prueba KG','id_clasificacion':3})
        assert r.status_code == 201, r.text
    body = _cuerpo(mundo, ids[:1], conexion)
    headers = {**h['coo'], 'Idempotency-Key':'kg-' + uuid.uuid4().hex}
    r = c.post('/movimientos',headers=headers,json=body)
    assert r.status_code == 201, r.text
    mov = r.json()['id_movimiento']
    with transaccion() as s:
        peso = s.execute(text('SELECT peso_despachado_kg FROM movimiento_dispositivo WHERE id_movimiento=:m'),{'m':mov}).scalar()
        assert peso == Decimal('6')
    assert c.post('/movimientos',headers=headers,json=body).json()['id_movimiento'] == mov
    assert c.post('/movimientos',headers=h['coo'],json=_cuerpo(mundo,ids[1:],conexion)).status_code == 422
    # Compatibilidad: los registros antiguos con NULL tambien consumen capacidad.
    with transaccion() as s:
        s.execute(text('UPDATE movimiento_dispositivo SET peso_despachado_kg=NULL WHERE id_movimiento=:m'),{'m':mov})
    assert c.post('/movimientos',headers=h['coo'],json=_cuerpo(mundo,ids[1:],conexion)).status_code == 422


@pytest.mark.parametrize('autorizado', [False, True])
def test_reevaluacion_requiere_anular_movimiento(mundo, autorizado):
    c, h = mundo['c'], mundo['h']
    ids, _ = _recibir_y_evaluar(mundo, 1)
    r = c.post('/movimientos',headers=h['coo'],json=_cuerpo(mundo,ids))
    assert r.status_code == 201, r.text
    mov = r.json()['id_movimiento']
    if autorizado:
        assert c.post(f'/movimientos/{mov}/autorizar',headers=h['coo']).status_code == 200
    evaluacion = {'condicion_constatada':'INCOMPLETO','diagnostico':'Nueva clasificacion','id_clasificacion':4}
    assert c.post(f'/dispositivos/{ids[0]}/evaluaciones',headers=h['tec'],json=evaluacion).status_code == 409
    assert c.post(f'/movimientos/{mov}/anular',headers=h['coo']).status_code == 200
    assert c.post(f'/dispositivos/{ids[0]}/evaluaciones',headers=h['tec'],json=evaluacion).status_code == 201


def test_idempotencia_concurrente_conflictos_y_dia_siguiente(mundo, monkeypatch):
    c, h = mundo['c'], mundo['h']
    ids, _ = _recibir_y_evaluar(mundo, 2)
    body = _cuerpo(mundo, ids)
    headers = {**h['coo'], 'Idempotency-Key':'race-' + uuid.uuid4().hex}
    def enviar(_):
        with _cliente() as cliente:
            return cliente.post('/movimientos',headers=headers,json=body)
    with ThreadPoolExecutor(max_workers=4) as pool:
        respuestas = list(pool.map(enviar, range(4)))
    assert all(r.status_code == 201 for r in respuestas), [r.text for r in respuestas]
    assert len({r.json()['id_movimiento'] for r in respuestas}) == 1
    assert sum(not r.json()['repetido'] for r in respuestas) == 1
    for cambio in ({'id_conexion':mundo['con_sede']}, {'tipo_movimiento':'ENVIO_TRATAMIENTO'},
                   {'fecha_despacho':str(date.today()+timedelta(days=1))},
                   {'dispositivos':[{'id_dispositivo':ids[0]}]},
                   {'dispositivos':[{'id_dispositivo':i,'peso_despachado_kg':1} for i in ids]}):
        r = c.post('/movimientos',headers=headers,json={**body,**cambio})
        assert r.status_code == 409, r.text
    assert c.post('/movimientos',headers=headers,json={**body,'dispositivos':list(reversed(body['dispositivos']))}).status_code == 201
    class Manana(date):
        @classmethod
        def today(cls):
            return date.today()+timedelta(days=1)
    monkeypatch.setattr('app.services.movimiento_service.date',Manana)
    r = c.post('/movimientos',headers=headers,json=body)
    assert r.status_code == 201 and r.json()['repetido'], r.text
    assert c.post('/movimientos',headers=h['coo'],json=body).status_code == 422


def test_despacho_revalida_clasificacion_de_datos_anteriores(mundo):
    c, h = mundo['c'], mundo['h']
    ids, _ = _recibir_y_evaluar(mundo, 1)
    body = {**_cuerpo(mundo, ids, mundo['con_sede']), 'tipo_movimiento':'ENTREGA_BENEFICIARIO'}
    r = c.post('/movimientos',headers=h['coo'],json=body)
    assert r.status_code == 201, r.text
    mov = r.json()['id_movimiento']
    assert c.post(f'/movimientos/{mov}/autorizar',headers=h['coo']).status_code == 200
    # Simular una clasificacion incompatible guardada por una version anterior.
    with transaccion() as s:
        s.execute(text('UPDATE evaluacion_tecnica SET id_clasificacion=4 WHERE id_dispositivo=:d'),{'d':ids[0]})
    r = c.post(f'/movimientos/{mov}/despachar',headers=h['op'])
    assert r.status_code == 422, r.text
    assert c.get(f'/movimientos/{mov}',headers=h['coo']).json()['estado_movimiento'] == 'AUTORIZADO'
    assert c.get(f'/dispositivos/{ids[0]}',headers=h['op']).json()['estado_actual'] == 'EVALUADO'
