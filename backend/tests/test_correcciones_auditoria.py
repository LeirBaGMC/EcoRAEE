"""Regresiones sin conexion a SQL Server ni mutaciones de datos de desarrollo."""
import unittest
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

from pydantic import ValidationError
from sqlalchemy import create_engine, text

from app.api.schemas import CapacidadConexionIn
from app.domain.errors import NoEncontradoError, PermisoDenegadoError, ReglaNegocioError
from app.persistence import movimientos
from app.security import Actor
from app.services import admin_service as admin, ciclo_service as ciclo, consulta_service as consulta


ADMIN = Actor(1, frozenset({"ADMINISTRADOR"}), 1)
REA = Actor(2, frozenset({"REACONDICIONADOR_RECICLADOR"}), 2)
COO = Actor(3, frozenset({"COORDINADOR_LOGISTICO"}), 2)
BEN = Actor(4, frozenset({"ENTIDAD_BENEFICIARIA"}), 3)


class TestCapacidadSegura(unittest.TestCase):
    def setUp(self):
        self.con = {"id_conexion": 42, "id_centro_origen": 10, "id_centro_destino": 20,
                    "capacidad_por_periodo": Decimal("15"), "unidad_capacidad": "UND", "activa": True,
                    "org_origen": 2, "org_destino": 3}

    def test_editar_exige_gestion_de_red(self):
        with patch.object(admin, "transaccion") as tx:
            with self.assertRaises(PermisoDenegadoError):
                admin.actualizar_capacidad_conexion(COO, 42, Decimal("20"))
            tx.assert_not_called()

    def test_no_admite_cambiar_unidad_u_otros_campos(self):
        for extra in ({"unidad_capacidad": "KG"}, {"id_centro_destino": 30}, {"activa": False}):
            with self.assertRaises(ValidationError):
                CapacidadConexionIn(capacidad_por_periodo=20, **extra)

    def test_rechaza_capacidad_invalida(self):
        for valor in ("-1", "NaN", "Infinity", "1.001", "1000000000000"):
            with self.subTest(valor=valor), self.assertRaises(ReglaNegocioError):
                admin.actualizar_capacidad_conexion(ADMIN, 42, Decimal(valor))

    def test_no_baja_bajo_reservas_y_no_escribe(self):
        with patch.object(admin, "transaccion"), \
             patch.object(admin.movimientos, "conexion_para_programar", return_value=self.con) as bloquear, \
             patch.object(admin.movimientos, "maximo_comprometido_por_periodo", return_value=Decimal("10")), \
             patch.object(admin.red, "actualizar_capacidad_conexion") as actualizar, \
             patch.object(admin.auditoria, "registrar") as auditar:
            with self.assertRaisesRegex(ReglaNegocioError, "10 UND"):
                admin.actualizar_capacidad_conexion(ADMIN, 42, Decimal("9"))
            bloquear.assert_called_once()
            actualizar.assert_not_called()
            auditar.assert_not_called()

    def test_bloqueo_antes_de_validar_y_actualizar_audita_antes_despues(self):
        orden = MagicMock()
        orden.bloquear.return_value = self.con
        orden.comprometido.return_value = Decimal("10")
        with patch.object(admin, "transaccion"), \
             patch.object(admin.movimientos, "conexion_para_programar", orden.bloquear), \
             patch.object(admin.movimientos, "maximo_comprometido_por_periodo", orden.comprometido), \
             patch.object(admin.red, "actualizar_capacidad_conexion", orden.actualizar), \
             patch.object(admin.auditoria, "registrar", orden.auditar):
            resultado = admin.actualizar_capacidad_conexion(ADMIN, 42, Decimal("10"))
        self.assertEqual([llamada[0] for llamada in orden.mock_calls], ["bloquear", "comprometido", "actualizar", "auditar"])
        self.assertEqual(resultado["capacidad_por_periodo"], Decimal("10"))
        self.assertEqual(resultado["unidad_capacidad"], "UND")
        args = orden.auditar.call_args.args
        self.assertEqual(args[1:6], ("conexion_logistica", "UPDATE", 42,
                                     {"capacidad_por_periodo": Decimal("15")}, {"capacidad_por_periodo": Decimal("10")}))

    def test_conexion_inexistente_devuelve_404(self):
        with patch.object(admin, "transaccion"), \
             patch.object(admin.movimientos, "conexion_para_programar", return_value=None):
            with self.assertRaises(NoEncontradoError):
                admin.actualizar_capacidad_conexion(ADMIN, 42, 20)


class TestReservasMensuales(unittest.TestCase):
    """Ejecuta el agregado real con tablas sinteticas en memoria y funciones de fecha SQL Server."""
    def setUp(self):
        self.engine = create_engine("sqlite://")
        self.s = self.engine.connect()
        conexion = self.s.connection.driver_connection
        conexion.create_function("YEAR", 1, lambda f: int(f[:4]))
        conexion.create_function("MONTH", 1, lambda f: int(f[5:7]))
        self.s.execute(text("CREATE TABLE movimiento (id_movimiento INT, id_conexion INT, estado_movimiento TEXT, fecha_despacho TEXT)"))
        self.s.execute(text("CREATE TABLE movimiento_dispositivo (id_movimiento INT, id_dispositivo INT, peso_despachado_kg NUMERIC)"))
        self.s.execute(text("CREATE TABLE dispositivo_granel (id_dispositivo INT, cantidad_unidades INT, peso_kg NUMERIC)"))
        self.s.execute(text("INSERT INTO dispositivo_granel VALUES (1, 10, 8), (3, 4, 30)"))
        self.s.execute(text("INSERT INTO movimiento VALUES (1,42,'CERRADO','2025-01-10'), (2,42,'PROGRAMADO','2026-11-01'), "
                            "(3,42,'AUTORIZADO','2026-11-20'), (4,42,'ANULADO','2026-11-20'), (5,99,'PROGRAMADO','2026-11-20')"))
        self.s.execute(text("INSERT INTO movimiento_dispositivo VALUES (1,1,NULL), (2,3,12), (3,2,2), (4,1,999), (5,1,999)"))

    def tearDown(self):
        self.s.close()
        self.engine.dispose()

    def test_maximo_por_mes_incluye_cerrado_historico_sin_sumar_meses(self):
        # Enero=10, noviembre=4+1. ANULADO y otra conexion no cuentan.
        self.assertEqual(movimientos.maximo_comprometido_por_periodo(self.s, 42, "UND"), 10)

    def test_kg_usa_peso_persistido_y_solo_recurre_a_granel_si_falta(self):
        # Enero=8; noviembre=12+2, aunque el peso actual a granel sea 30.
        self.assertEqual(movimientos.maximo_comprometido_por_periodo(self.s, 42, "KG"), 14)

    def test_sin_compromisos_es_cero(self):
        self.assertEqual(movimientos.maximo_comprometido_por_periodo(self.s, 1000, "UND"), 0)


class TestTratamientosYAlcance(unittest.TestCase):
    def setUp(self):
        self.t = {"id_tratamiento": 14, "id_dispositivo": 128, "tipo_tratamiento": "REACONDICIONAMIENTO",
                  "resultado": "EN_CURSO", "fecha_inicio": datetime(2026, 11, 2, 10), "fecha_fin": None}

    def test_inicio_devuelve_fecha_guardada_en_vez_de_resumen_incompleto(self):
        with patch.object(ciclo, "transaccion"), \
             patch.object(ciclo.repo_d, "ubicacion_actual", return_value={"id_organizacion": 2}), \
             patch.object(ciclo.repo_d, "estado_actual", return_value="EVALUADO"), \
             patch.object(ciclo.repo_m, "ultima_clasificacion", return_value={"nombre_clasificacion": "REPARABLE"}), \
             patch.object(ciclo.repo, "tratamiento_en_curso", return_value=False), \
             patch.object(ciclo.repo, "crear_tratamiento", return_value=14), \
             patch.object(ciclo.repo, "obtener_tratamiento", return_value=self.t), \
             patch.object(ciclo.estado_service, "transicionar"), patch.object(ciclo.auditoria, "registrar"):
            resultado = ciclo.iniciar_tratamiento(REA, 128, "REACONDICIONAMIENTO")
        self.assertEqual(resultado["fecha_inicio"], self.t["fecha_inicio"])

    def test_finalizar_fallido_devuelve_fechas_y_conserva_regla_sin_transicion(self):
        fin = {**self.t, "resultado": "FALLIDO", "fecha_fin": datetime(2026, 11, 2, 11)}
        with patch.object(ciclo, "transaccion"), \
             patch.object(ciclo.repo, "obtener_tratamiento", side_effect=[self.t, fin]), \
             patch.object(ciclo.repo_d, "ubicacion_actual", return_value={"id_organizacion": 2}), \
             patch.object(ciclo.repo, "finalizar_tratamiento"), patch.object(ciclo.auditoria, "registrar"), \
             patch.object(ciclo.estado_service, "transicionar") as transicionar:
            resultado = ciclo.finalizar_tratamiento(REA, 14, "FALLIDO")
        self.assertEqual(resultado, fin)
        transicionar.assert_not_called()

    def test_listado_del_reacondicionador_conserva_alcance_y_paginacion(self):
        with patch.object(ciclo, "transaccion") as tx, \
             patch.object(ciclo.repo, "listar_tratamientos", return_value=(1, [self.t])) as listar:
            resultado = ciclo.listar_tratamientos(REA, 2, 10)
        listar.assert_called_once_with(tx.return_value.__enter__.return_value, 2, 10, 10, todos=False)
        self.assertEqual(resultado["items"], [self.t])

    def test_admin_lectura_global_no_concede_registro(self):
        with patch.object(ciclo, "transaccion"), patch.object(ciclo.repo, "listar_tratamientos", return_value=(0, [])) as listar:
            ciclo.listar_tratamientos(ADMIN, 1, 20)
            self.assertTrue(listar.call_args.kwargs["todos"])
        with self.assertRaises(PermisoDenegadoError):
            ciclo.iniciar_tratamiento(ADMIN, 128, "REACONDICIONAMIENTO")

    def test_coordinador_consulta_soporte_para_cierre_solo_si_dispositivo_visible(self):
        with patch.object(ciclo, "transaccion"), \
             patch.object(ciclo.repo, "obtener_tratamiento", return_value=self.t), \
             patch.object(ciclo.repo_d, "obtener_visible", return_value=None):
            with self.assertRaises(NoEncontradoError):
                ciclo.obtener_tratamiento(COO, 14)

    def test_beneficiaria_no_accede_a_tratamientos_ni_a_dispositivos_globales(self):
        with self.assertRaises(PermisoDenegadoError):
            ciclo.listar_tratamientos(BEN, 1, 20)
        with self.assertRaises(PermisoDenegadoError):
            consulta.obtener_dispositivo(BEN, 128)

    def test_asignaciones_beneficiaria_identificadas_sin_ampliar_alcance(self):
        fila = {"id_asignacion": 10, "fecha_entrega": None, "codigo_trazabilidad": "DSP-128",
                "numero_serie": "SERIE-128", "nombre_organizacion": "Escuela", "ruc_organizacion": "0999999999001"}
        with patch.object(ciclo, "transaccion"), \
             patch.object(ciclo.repo, "listar_asignaciones", return_value=(1, [fila])) as listar:
            resultado = ciclo.listar_asignaciones(BEN, 1, 20)
        self.assertEqual(listar.call_args.args[1:3], (3, True))
        self.assertFalse(listar.call_args.kwargs["todos"])
        self.assertEqual(resultado["items"][0]["numero_serie"], "SERIE-128")


if __name__ == "__main__":
    unittest.main()
