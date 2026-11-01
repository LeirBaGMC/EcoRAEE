"""Prueba de INTEGRACION del bloque 1 contra tu SQL Server real (no contra mocks).

Requisitos: base ecoraee_cloud creada, .env configurado, pip install -r requirements.txt.
Ejecutar:   python -m pytest tests_integracion -v
Crea datos de prueba con sufijo aleatorio. No borra nada.
"""
import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(not os.environ.get("ECORAEE_DB_URL"), reason="Falta ECORAEE_DB_URL (carga tu .env)")

CLAVE = "Clave-Prueba-123"


@pytest.fixture(scope="module")
def entorno():
    from fastapi.testclient import TestClient

    from app.main import app
    from scripts.crear_usuario import crear_usuario
    from scripts.datos_prueba import asegurar_centros

    sufijo = uuid.uuid4().hex[:6]
    centro_rec, _ = asegurar_centros()
    nombres = {"gen": ("GENERADOR",), "op": ("OPERADOR_CENTRO",), "tec": ("TECNICO_EVALUADOR",),
               "ben": ("ENTIDAD_BENEFICIARIA",)}
    cliente = TestClient(app)
    cab = {}
    for clave, roles in nombres.items():
        nombre = f"{clave}_{sufijo}"
        crear_usuario(nombre, CLAVE, list(roles))
        tok = cliente.post("/auth/login", json={"nombre_usuario": nombre, "contrasena": CLAVE}).json()["access_token"]
        cab[clave] = {"Authorization": f"Bearer {tok}"}
    # usuario de OTRA organizacion
    nombre = f"otro_{sufijo}"
    crear_usuario(nombre, CLAVE, ["OPERADOR_CENTRO"], ruc="0999999999002")
    tok = cliente.post("/auth/login", json={"nombre_usuario": nombre, "contrasena": CLAVE}).json()["access_token"]
    cab["otro"] = {"Authorization": f"Bearer {tok}"}
    return cliente, cab, centro_rec, sufijo


def _dispositivo(c, h, serie):
    r = c.post("/dispositivos", headers=h, json={"tipo_registro": "INDIVIDUAL", "id_categoria": 1,
                                                  "condicion_declarada": "ENCIENDE", "numero_serie": serie})
    assert r.status_code == 201, r.text
    return r.json()["id_dispositivo"]


def test_flujo_completo_y_errores(entorno):
    c, h, centro, suf = entorno

    # sin token y con token falso
    assert c.post("/dispositivos", json={}).status_code == 401
    assert c.get("/dispositivos", headers={"Authorization": "Bearer falso"}).status_code == 401

    # registrar dispositivos (rol incorrecto -> 403)
    assert c.post("/dispositivos", headers=h["ben"], json={"tipo_registro": "INDIVIDUAL", "id_categoria": 1,
                  "condicion_declarada": "ENCIENDE", "numero_serie": f"X-{suf}"}).status_code == 403
    d1 = _dispositivo(c, h["gen"], f"SN-{suf}-1")
    d2 = _dispositivo(c, h["gen"], f"SN-{suf}-2")

    # lote: rol incorrecto 403, dispositivo ajeno rechazado, correcto 201
    assert c.post("/lotes", headers=h["ben"], json={"ids_dispositivos": [d1]}).status_code == 403
    assert c.post("/lotes", headers=h["otro"], json={"ids_dispositivos": [d1]}).status_code in (403, 422)
    r = c.post("/lotes", headers=h["gen"], json={"ids_dispositivos": [d1, d2]})
    assert r.status_code == 201, r.text
    id_lote = r.json()["id_lote"]
    # el mismo dispositivo no entra a otro lote
    assert c.post("/lotes", headers=h["gen"], json={"ids_dispositivos": [d1]}).status_code == 422

    # solicitud: una sola por lote
    r = c.post("/solicitudes", headers=h["gen"], json={"id_lote": id_lote, "modalidad": "RECOLECCION", "zona_referencial": "Norte de Quito"})
    assert r.status_code == 201, r.text
    id_sol = r.json()["id_solicitud"]
    assert c.post("/solicitudes", headers=h["gen"], json={"id_lote": id_lote, "modalidad": "RECOLECCION", "zona_referencial": "Norte"}).status_code in (409, 422)
    assert c.get(f"/dispositivos/{d1}", headers=h["gen"]).json()["estado_actual"] == "EN_RECOLECCION"

    # recepcion: rol incorrecto 403, correcta 201, repetida 409, centro ajeno 404
    cuerpo = {"id_solicitud": id_sol, "id_centro": centro, "peso_recibido_kg": "12.5", "unidades_recibidas": 2, "conforme": True}
    assert c.post("/recepciones", headers=h["gen"], json=cuerpo).status_code == 403
    assert c.post("/recepciones", headers=h["otro"], json=cuerpo).status_code == 404
    r = c.post("/recepciones", headers=h["op"], json=cuerpo)
    assert r.status_code == 201, r.text
    assert r.json()["dispositivos_recibidos"] == 2
    assert c.post("/recepciones", headers=h["op"], json=cuerpo).status_code == 409

    # consulta: el operador ve el dispositivo en su centro, otra organizacion no lo ve
    det = c.get(f"/dispositivos/{d1}", headers=h["op"]).json()
    assert det["estado_actual"] == "RECIBIDO" and det["id_centro"] == centro
    assert c.get(f"/dispositivos/{d1}", headers=h["otro"]).status_code == 404

    # evaluacion: RN-02 (operador no puede), tecnico si, reevaluacion suma numero
    ev = {"condicion_constatada": "ENCIENDE", "diagnostico": "Funciona, bateria al 80%", "id_clasificacion": 1}
    assert c.post(f"/dispositivos/{d1}/evaluaciones", headers=h["op"], json=ev).status_code == 403
    r = c.post(f"/dispositivos/{d1}/evaluaciones", headers=h["tec"], json=ev)
    assert r.status_code == 201, r.text
    assert r.json()["nro_evaluacion"] == 1 and r.json()["estado_actual"] == "EVALUADO"
    r = c.post(f"/dispositivos/{d1}/evaluaciones", headers=h["tec"], json=ev)
    assert r.status_code == 201 and r.json()["nro_evaluacion"] == 2

    # historial en orden, sin saltos
    hist = c.get(f"/dispositivos/{d1}/historial", headers=h["op"]).json()
    assert [x["estado_nuevo"] for x in hist] == ["REGISTRADO", "EN_RECOLECCION", "RECIBIDO", "EVALUADO"]
    assert [x["nro_cambio"] for x in hist] == [1, 2, 3, 4]

    # listado paginado con filtro
    pag = c.get("/dispositivos?pagina=1&tamano=1&estado=EVALUADO", headers=h["op"]).json()
    assert pag["tamano"] == 1 and len(pag["items"]) <= 1 and pag["total"] >= 1
