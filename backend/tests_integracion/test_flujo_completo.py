"""Prueba de INTEGRACION de los bloques 2 a 4 y administracion contra tu SQL Server real.

Requisitos: base creada, .env cargado, centros de prueba (python -m scripts.datos_prueba), pip install -r requirements.txt
Ejecutar:   python -m pytest tests_integracion -v
Cada ejecucion crea datos nuevos con sufijo aleatorio. No borra nada.
Verificacion local contra SQL Server: ver TRAZABILIDAD.md y correcciones-integracion.log.
"""
import io
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest

pytestmark = pytest.mark.skipif(not os.environ.get("ECORAEE_DB_URL"), reason="Falta ECORAEE_DB_URL (carga tu .env)")
CLAVE = "Clave-Prueba-123"
PDF = b"%PDF-1.4 evidencia sintetica"


def _cliente():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture(scope="module")
def mundo(tmp_path_factory):
    os.environ.setdefault("ECORAEE_EVIDENCE_DIR", str(tmp_path_factory.mktemp("evidencias")))
    from sqlalchemy import text
    from app.db import transaccion
    from scripts.crear_usuario import crear_usuario
    from scripts.datos_prueba import asegurar_centros

    suf = uuid.uuid4().hex[:6]
    c = _cliente()
    centro_rec, centro_rea = asegurar_centros()
    # Centro de tratamiento y sede beneficiaria propios de esta ejecucion (en la organizacion de prueba)
    org_prueba = None
    with transaccion() as s:
        org_prueba = s.execute(text("SELECT id_organizacion FROM centro WHERE id_centro=:c"), {"c": centro_rec}).scalar()
        sede = s.execute(text("INSERT INTO centro (codigo_centro,nombre,tipo_centro,ciudad,capacidad_almacenamiento,id_organizacion) "
                              "OUTPUT INSERTED.id_centro VALUES (:c,N'Sede beneficiaria prueba','SEDE_BENEFICIARIA',N'Quito',100,:o)"),
                         {"c": f"SED-{suf}", "o": org_prueba}).scalar()
        # una conexion pequena (capacidad 3 UND) hacia la sede, para probar RN-05
        con_sede = s.execute(text("INSERT INTO conexion_logistica (id_centro_origen,id_centro_destino,capacidad_por_periodo,unidad_capacidad) "
                                  "OUTPUT INSERTED.id_conexion VALUES (:a,:b,3,'UND')"), {"a": centro_rec, "b": sede}).scalar()
        con_rea = s.execute(text("SELECT id_conexion FROM conexion_logistica WHERE id_centro_origen=:a AND id_centro_destino=:b"),
                            {"a": centro_rec, "b": centro_rea}).scalar()
        # organizacion beneficiaria
        ruc_ben = "09" + suf.encode().hex()[:11]
        org_ben = s.execute(text("INSERT INTO organizacion (ruc,nombre,tipo_persona,ciudad) OUTPUT INSERTED.id_organizacion "
                                 "VALUES (:r,N'Escuela de prueba','JURIDICA',N'Quito')"), {"r": ruc_ben}).scalar()
        s.execute(text("INSERT INTO organizacion_tipo_actor (id_organizacion,tipo_actor) VALUES (:o,'BENEFICIARIO')"), {"o": org_ben})
    cab = {}
    for clave, roles, ruc in (("gen", ["GENERADOR"], None), ("op", ["OPERADOR_CENTRO"], None), ("tec", ["TECNICO_EVALUADOR"], None),
                              ("coo", ["COORDINADOR_LOGISTICO"], None), ("rec", ["REACONDICIONADOR_RECICLADOR"], None),
                              ("adm", ["ADMINISTRADOR"], None), ("otro", ["COORDINADOR_LOGISTICO", "OPERADOR_CENTRO"], "0999999999002")):
        nombre = f"{clave}_{suf}"
        kw = {"ruc": ruc} if ruc else {}
        crear_usuario(nombre, CLAVE, roles, **kw)
        tok = c.post("/auth/login", json={"nombre_usuario": nombre, "contrasena": CLAVE}).json()["access_token"]
        cab[clave] = {"Authorization": f"Bearer {tok}"}
    # beneficiaria: usuario en la organizacion beneficiaria
    from app.security import hash_password
    with transaccion() as s:
        uid = s.execute(text("INSERT INTO usuario (correo,nombre_usuario,nombre_visible,activo,credencial_hash,id_organizacion) "
                             "OUTPUT INSERTED.id_usuario VALUES (:c,:n,:n,1,:h,:o)"),
                        {"c": f"ben_{suf}@prueba.local", "n": f"ben_{suf}", "h": hash_password(CLAVE), "o": org_ben}).scalar()
        s.execute(text("INSERT INTO usuario_rol (id_usuario,id_rol) SELECT :u, id_rol FROM rol WHERE nombre_rol='ENTIDAD_BENEFICIARIA'"), {"u": uid})
    tok = c.post("/auth/login", json={"nombre_usuario": f"ben_{suf}", "contrasena": CLAVE}).json()["access_token"]
    cab["ben"] = {"Authorization": f"Bearer {tok}"}
    return dict(c=c, h=cab, suf=suf, centro_rec=centro_rec, centro_rea=centro_rea, sede=sede,
                con_sede=con_sede, con_rea=con_rea, org_ben=org_ben, org=org_prueba)


def _recibir_y_evaluar(m, n, clasif=1):
    """Crea n dispositivos, los lleva hasta EVALUADO en centro_rec y devuelve sus ids."""
    c, h = m["c"], m["h"]
    ids = []
    for _ in range(n):
        r = c.post("/dispositivos", headers=h["gen"], json={"tipo_registro": "INDIVIDUAL", "id_categoria": 1, "condicion_declarada": "ENCIENDE",
                                                            "numero_serie": f"SN-{uuid.uuid4().hex[:10]}"})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id_dispositivo"])
    lote = c.post("/lotes", headers=h["gen"], json={"ids_dispositivos": ids}).json()["id_lote"]
    sol = c.post("/solicitudes", headers=h["gen"], json={"id_lote": lote, "modalidad": "ENTREGA_DIRECTA", "zona_referencial": "Norte"}).json()["id_solicitud"]
    r = c.post("/recepciones", headers=h["op"], json={"id_solicitud": sol, "id_centro": m["centro_rec"], "peso_recibido_kg": "5", "unidades_recibidas": n, "conforme": True})
    assert r.status_code == 201, r.text
    for i in ids:
        r = c.post(f"/dispositivos/{i}/evaluaciones", headers=h["tec"],
                   json={"condicion_constatada": "ENCIENDE", "diagnostico": "ok", "id_clasificacion": clasif})
        assert r.status_code == 201, r.text
    return ids, lote


def _subir(c, h, tipo, **objetivo):
    datos = {"tipo_evidencia": tipo, **{k: str(v) for k, v in objetivo.items()}}
    return c.post("/evidencias", headers=h, data=datos, files={"archivo": ("x.pdf", io.BytesIO(PDF), "application/pdf")})


def test_01_recoleccion_programada(mundo):
    c, h = mundo["c"], mundo["h"]
    r = c.post("/dispositivos", headers=h["gen"], json={"tipo_registro": "GRANEL", "id_categoria": 4, "condicion_declarada": "INCOMPLETO",
                                                        "peso_kg": "8.5", "cantidad_unidades": 12})
    assert r.status_code == 201, r.text
    lote = c.post("/lotes", headers=h["gen"], json={"ids_dispositivos": [r.json()["id_dispositivo"]]}).json()["id_lote"]
    sol = c.post("/solicitudes", headers=h["gen"], json={"id_lote": lote, "modalidad": "RECOLECCION", "zona_referencial": "Sur"}).json()["id_solicitud"]
    assert c.post(f"/solicitudes/{sol}/recoleccion", headers=h["gen"], json={"fecha_programada": str(date.today())}).status_code == 403
    r = c.post(f"/solicitudes/{sol}/recoleccion", headers=h["coo"], json={"fecha_programada": str(date.today())})
    assert r.status_code == 201, r.text
    assert c.post(f"/solicitudes/{sol}/recoleccion", headers=h["coo"], json={"fecha_programada": str(date.today())}).status_code == 409
    assert c.post(f"/solicitudes/{sol}/recoleccion/ejecutar", headers=h["coo"]).status_code == 200
    assert c.get(f"/lotes/{lote}", headers=h["op"]).json()["estado_lote"] == "RECOLECTADO"
    assert c.post("/recepciones", headers=h["op"], json={"id_solicitud": sol, "id_centro": mundo["centro_rec"], "peso_recibido_kg": "8.5",
                                                         "unidades_recibidas": 12, "conforme": False}).status_code == 201
    # la recepcion no conforme genero una alerta
    assert c.get("/alertas", headers=h["adm"]).json()["total"] >= 1


def test_02_movimiento_completo_rn03_rn05_rn06(mundo):
    c, h = mundo["c"], mundo["h"]
    ids, _ = _recibir_y_evaluar(mundo, 2)
    cuerpo = {"id_conexion": mundo["con_rea"], "tipo_movimiento": "TRANSFERENCIA",
              "fecha_despacho": str(date.today()), "dispositivos": [{"id_dispositivo": i} for i in ids]}
    assert c.post("/movimientos", headers=h["op"], json=cuerpo).status_code == 403              # rol incorrecto
    assert c.post("/movimientos", headers=h["otro"], json=cuerpo).status_code == 404            # otra organizacion
    r = c.post("/movimientos", headers={**h["coo"], "Idempotency-Key": f"k-{mundo['suf']}"}, json=cuerpo)
    assert r.status_code == 201, r.text
    mov = r.json()["id_movimiento"]
    # reintento con la misma clave: mismo movimiento, sin duplicar
    r2 = c.post("/movimientos", headers={**h["coo"], "Idempotency-Key": f"k-{mundo['suf']}"}, json=cuerpo)
    assert r2.status_code in (200, 201) and r2.json()["id_movimiento"] == mov and r2.json()["repetido"] is True
    # los mismos dispositivos no pueden entrar en otro movimiento activo
    assert c.post("/movimientos", headers=h["coo"], json=cuerpo).status_code == 409
    # transiciones: no se puede despachar ni cerrar sin autorizar
    assert c.post(f"/movimientos/{mov}/despachar", headers=h["op"]).status_code == 422
    assert c.post(f"/movimientos/{mov}/autorizar", headers=h["op"]).status_code == 403
    assert c.post(f"/movimientos/{mov}/autorizar", headers=h["coo"]).status_code == 200
    assert c.post(f"/movimientos/{mov}/despachar", headers=h["op"]).status_code == 200
    assert c.get(f"/dispositivos/{ids[0]}", headers=h["op"]).json()["estado_actual"] == "EN_TRANSITO"
    # RN-03: sin guia de traslado no se cierra
    assert c.post(f"/movimientos/{mov}/cerrar", headers=h["coo"]).status_code == 422
    # evidencia: tipo incorrecto, archivo falso, y la correcta
    assert _subir(c, h["op"], "ACTA_ENTREGA", id_movimiento=mov).status_code == 422
    falso = c.post("/evidencias", headers=h["op"], data={"tipo_evidencia": "GUIA_TRASLADO", "id_movimiento": str(mov)},
                   files={"archivo": ("x.pdf", io.BytesIO(b"<script>alert(1)</script>"), "application/pdf")})
    assert falso.status_code == 422
    assert _subir(c, h["otro"], "GUIA_TRASLADO", id_movimiento=mov).status_code in (403, 404)
    ev = _subir(c, h["op"], "GUIA_TRASLADO", id_movimiento=mov)
    assert ev.status_code == 201, ev.text
    id_ev = ev.json()["id_evidencia"]
    # RN-06: al cerrar, salen del origen y entran al destino
    r = c.post(f"/movimientos/{mov}/cerrar", headers=h["coo"], json={"conformes": []})
    assert r.status_code == 200, r.text
    d = c.get(f"/dispositivos/{ids[0]}", headers=h["op"]).json()
    assert d["estado_actual"] == "EVALUADO" and d["id_centro"] == mundo["centro_rea"]
    assert c.post(f"/movimientos/{mov}/cerrar", headers=h["coo"]).status_code == 422             # ya cerrado
    # RN-07: solo roles y propositos autorizados, y dentro de su alcance
    ok = c.get(f"/evidencias/{id_ev}/archivo?proposito=AUDITORIA", headers=h["coo"])
    assert ok.status_code == 200 and ok.content == PDF and ok.headers["content-type"] == "application/pdf"
    assert c.get(f"/evidencias/{id_ev}/archivo?proposito=AUDITORIA", headers=h["gen"]).status_code == 403
    assert c.get(f"/evidencias/{id_ev}/archivo?proposito=CURIOSIDAD", headers=h["coo"]).status_code == 422
    assert c.get(f"/evidencias/{id_ev}/archivo?proposito=AUDITORIA", headers=h["otro"]).status_code == 404
    assert len(c.get(f"/evidencias?proposito=AUDITORIA&id_movimiento={mov}", headers=h["coo"]).json()) == 1


def test_03_capacidad_y_concurrencia_rn05(mundo):
    c, h = mundo["c"], mundo["h"]
    ids, _ = _recibir_y_evaluar(mundo, 4)       # la conexion a la sede admite 3 UND por periodo (menos lo ya usado)
    # entrega a beneficiario requiere RN-04 (clasificacion 1 = REUTILIZABLE, permite asignacion)
    def intentar(i):
        cl = _cliente()
        return cl.post("/movimientos", headers=h["coo"], json={"id_conexion": mundo["con_sede"], "tipo_movimiento": "ENTREGA_BENEFICIARIO",
                                                             "fecha_despacho": str(date.today()), "dispositivos": [{"id_dispositivo": i}]}).status_code
    with ThreadPoolExecutor(max_workers=4) as ex:
        codigos = list(ex.map(intentar, ids))
    # 4 intentos simultaneos de 1 UND sobre una capacidad de 3: nunca mas de 3 aceptados (sin sobrepasar la capacidad)
    assert codigos.count(201) == 3, codigos
    assert all(x in (201, 422) for x in codigos), codigos


def test_04_rn04_tratamiento_asignacion_y_cierre_rn08(mundo):
    c, h = mundo["c"], mundo["h"]
    # RN-04: un dispositivo NO_RECUPERABLE no puede asignarse
    ids_nr, _ = _recibir_y_evaluar(mundo, 1, clasif=4)
    r = c.post("/asignaciones", headers=h["coo"], json={"id_dispositivo": ids_nr[0], "id_organizacion_beneficiaria": mundo["org_ben"], "finalidad": "Aula"})
    assert r.status_code == 422, r.text
    # y no admite reacondicionamiento, pero si disposicion controlada
    assert c.post("/tratamientos", headers=h["rec"], json={"id_dispositivo": ids_nr[0], "tipo_tratamiento": "REACONDICIONAMIENTO"}).status_code == 422
    t = c.post("/tratamientos", headers=h["rec"], json={"id_dispositivo": ids_nr[0], "tipo_tratamiento": "DISPOSICION_CONTROLADA"})
    assert t.status_code == 201, t.text
    # RN-08: no se cierra con el tratamiento en curso, ni sin fecha, ni con dos destinos
    base = {"id_dispositivo": ids_nr[0], "id_tratamiento": t.json()["id_tratamiento"], "fecha_confirmacion": str(date.today())}
    assert c.post("/cierres", headers=h["coo"], json=base).status_code == 422
    assert c.post("/cierres", headers=h["coo"], json={**base, "fecha_confirmacion": str(date.today() + timedelta(days=3))}).status_code == 422
    assert c.post("/cierres", headers=h["coo"], json={**base, "id_asignacion": 1}).status_code == 422
    assert c.post(f"/tratamientos/{t.json()['id_tratamiento']}/finalizar", headers=h["rec"], json={"resultado": "EXITOSO"}).status_code == 200
    assert c.post("/cierres", headers=h["gen"], json=base).status_code == 403
    r = c.post("/cierres", headers=h["coo"], json=base)
    assert r.status_code == 201, r.text
    assert r.json()["destino_final"] == "TRATAMIENTO"
    assert c.post("/cierres", headers=h["coo"], json=base).status_code == 409
    hist = c.get(f"/dispositivos/{ids_nr[0]}/historial", headers=h["coo"]).json()
    assert hist[-1]["estado_nuevo"] == "CERRADO"

    # asignacion de un reutilizable: crear, confirmar la entrega, cerrar
    ids_ok, lote = _recibir_y_evaluar(mundo, 1, clasif=1)
    a = c.post("/asignaciones", headers=h["coo"], json={"id_dispositivo": ids_ok[0], "id_organizacion_beneficiaria": mundo["org_ben"], "finalidad": "Aula de computo"})
    assert a.status_code == 201, a.text
    ida = a.json()["id_asignacion"]
    cierre = {"id_dispositivo": ids_ok[0], "id_asignacion": ida, "fecha_confirmacion": str(date.today())}
    assert c.post("/cierres", headers=h["coo"], json=cierre).status_code == 422                 # la entrega aun no esta confirmada
    assert c.post(f"/asignaciones/{ida}/confirmar", headers=h["coo"]).status_code == 403
    assert c.post(f"/asignaciones/{ida}/confirmar", headers=h["ben"]).status_code == 200
    assert c.post(f"/asignaciones/{ida}/confirmar", headers=h["ben"]).status_code == 409
    r = c.post("/cierres", headers=h["coo"], json=cierre)
    assert r.status_code == 201, r.text
    assert r.json()["lotes_cerrados"] == [lote]
    assert c.get(f"/dispositivos/{ids_ok[0]}/cierre", headers=h["op"]).json()["destino_final"] == "ASIGNACION_BENEFICIARIO"


def test_05_flujo_maximo_con_datos_persistidos(mundo):
    c, h = mundo["c"], mundo["h"]
    # Red propia del escenario: 3 centros nuevos y capacidades conocidas (resultado esperado: 7)
    from sqlalchemy import text
    from app.db import transaccion
    suf = uuid.uuid4().hex[:5]
    with transaccion() as s:
        ids = []
        for k, t in enumerate(("RECOLECCION", "REACONDICIONAMIENTO", "RECICLAJE")):
            ids.append(s.execute(text("INSERT INTO centro (codigo_centro,nombre,tipo_centro,ciudad,capacidad_almacenamiento,id_organizacion) "
                                      "OUTPUT INSERTED.id_centro VALUES (:c,:n,:t,N'Quito',10,:o)"),
                                 {"c": f"F{k}-{suf}", "n": f"Nodo {k}", "t": t, "o": mundo["org"]}).scalar())
        cons = []
        for a, b, cap in ((0, 1, 4), (0, 2, 3), (1, 2, 5)):     # s->a (4), s->t (3), a->t (5)
            cons.append(s.execute(text("INSERT INTO conexion_logistica (id_centro_origen,id_centro_destino,capacidad_por_periodo,unidad_capacidad) "
                                       "OUTPUT INSERTED.id_conexion VALUES (:a,:b,:c,'KG')"), {"a": ids[a], "b": ids[b], "c": cap}).scalar())
    esc = {"nombre": f"Escenario {suf}", "fecha_inicio_periodo": "2026-11-01", "fecha_fin_periodo": "2026-11-30", "unidad_flujo": "KG",
           "nodos": [{"id_centro": ids[0], "rol_nodo": "FUENTE"}, {"id_centro": ids[1], "rol_nodo": "INTERMEDIO"}, {"id_centro": ids[2], "rol_nodo": "SUMIDERO"}],
           "conexiones": [{"id_conexion": k} for k in cons]}
    assert c.post("/escenarios", headers=h["gen"], json=esc).status_code == 403
    r = c.post("/escenarios", headers=h["coo"], json=esc)
    assert r.status_code == 201, r.text
    id_esc = r.json()["id_escenario"]
    res = {}
    for alg in ("EDMONDS_KARP", "FORD_FULKERSON"):
        r = c.post(f"/escenarios/{id_esc}/ejecuciones", headers=h["coo"], json={"algoritmo": alg})
        assert r.status_code == 201, r.text
        res[alg] = r.json()
        assert float(res[alg]["flujo_maximo"]) == 7.0
        assert float(res[alg]["capacidad_corte"]) == 7.0
    assert res["EDMONDS_KARP"]["huella_datos"] == res["FORD_FULKERSON"]["huella_datos"]       # mismos datos, misma huella
    det = c.get(f"/escenarios/{id_esc}/ejecuciones/{res['EDMONDS_KARP']['id_ejecucion']}", headers=h["coo"]).json()
    assert len(det["resultados"]) == 3
    assert c.get(f"/escenarios/{id_esc}", headers=h["otro"]).status_code == 404               # otra organizacion
    # calcular no creo ningun movimiento nuevo
    assert c.post("/escenarios", headers=h["coo"], json={**esc, "unidad_flujo": "UND"}).status_code == 422   # conexiones en KG


def test_06_indicadores_y_alertas(mundo):
    c, h = mundo["c"], mundo["h"]
    assert c.post("/indicadores/calcular", headers=h["gen"]).status_code == 403
    r = c.post("/indicadores/calcular", headers=h["coo"])
    assert r.status_code == 200, r.text
    ind = {i["codigo_indicador"]: i for i in r.json()}
    assert float(ind["IND-01"]["valor"]) >= 1 and "IND-06" in ind
    assert c.post("/indicadores/calcular", headers=h["adm"]).status_code == 200           # repetir el mismo dia actualiza
    assert len(c.get("/indicadores/IND-01/mediciones", headers=h["adm"]).json()) >= 1
    r = c.post("/alertas/evaluar", headers=h["coo"])
    assert r.status_code == 200, r.text
    again = c.post("/alertas/evaluar", headers=h["coo"]).json()
    assert again["total_creadas"] == 0                                                    # no duplica alertas abiertas
    lista = c.get("/alertas?tamano=5", headers=h["adm"]).json()
    if lista["items"]:
        id_a = lista["items"][0]["id_alerta"]
        assert c.post(f"/alertas/{id_a}/atender", headers=h["adm"]).status_code == 200
        assert c.post(f"/alertas/{id_a}/atender", headers=h["adm"]).status_code == 409


def test_07_administracion_y_auditoria(mundo):
    c, h, suf = mundo["c"], mundo["h"], mundo["suf"]
    nuevo = {"correo": f"nuevo_{suf}@prueba.local", "nombre_usuario": f"nuevo_{suf}", "nombre_visible": "Nuevo", "contrasena": CLAVE,
             "roles": ["GENERADOR"], "id_organizacion": mundo["org"]}
    assert c.post("/usuarios", headers=h["coo"], json=nuevo).status_code == 403
    r = c.post("/usuarios", headers=h["adm"], json=nuevo)
    assert r.status_code == 201, r.text
    assert "credencial_hash" not in r.text and CLAVE not in r.text
    uid = r.json()["id_usuario"]
    assert c.post("/usuarios", headers=h["adm"], json=nuevo).status_code == 409
    assert c.post("/usuarios", headers=h["adm"], json={**nuevo, "nombre_usuario": f"x_{suf}", "correo": f"x_{suf}@p.local", "contrasena": "corta"}).status_code in (422,)
    # el nuevo usuario ya puede entrar, y al quitarle el rol pierde el permiso al instante
    tok = c.post("/auth/login", json={"nombre_usuario": f"nuevo_{suf}", "contrasena": CLAVE}).json()["access_token"]
    hh = {"Authorization": f"Bearer {tok}"}
    assert c.post("/lotes", headers=hh, json={"ids_dispositivos": [1]}).status_code != 403   # GENERADOR si puede crear lotes
    assert c.put(f"/usuarios/{uid}/roles", headers=h["adm"], json={"roles": ["ENTIDAD_BENEFICIARIA"]}).status_code == 200
    assert c.post("/lotes", headers=hh, json={"ids_dispositivos": [1]}).status_code == 403
    assert c.put(f"/usuarios/{uid}/activo", headers=h["adm"], json={"activo": False}).status_code == 200
    assert c.get("/dispositivos", headers=hh).status_code == 401                           # desactivado: ya no entra
    assert c.post("/auth/login", json={"nombre_usuario": f"nuevo_{suf}", "contrasena": CLAVE}).status_code == 401
    # un admin no puede desactivarse a si mismo
    me = [u for u in c.get("/usuarios?tamano=100", headers=h["adm"]).json()["items"] if u["nombre_usuario"] == f"adm_{suf}"]
    if me:
        assert c.put(f"/usuarios/{me[0]['id_usuario']}/activo", headers=h["adm"], json={"activo": False}).status_code == 422
    # auditoria
    aud = c.get(f"/auditoria?tabla=usuario&clave={uid}", headers=h["adm"])
    assert aud.status_code == 200 and aud.json()["total"] >= 2
    assert "credencial" not in aud.text
    assert c.get("/auditoria", headers=h["coo"]).status_code == 403
    cat = c.get("/catalogos", headers=h["gen"]).json()
    assert len(cat["clasificaciones"]) == 4 and "roles" not in cat
    assert "roles" in c.get("/catalogos", headers=h["adm"]).json()
