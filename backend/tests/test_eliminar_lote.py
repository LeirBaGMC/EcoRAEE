"""Contrato y protecciones de DELETE de lotes, sin conectar con SQL Server."""
import re
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.domain.errors import ConflictoError, NoEncontradoError, PermisoDenegadoError
from app.main import app
from app.persistence import lotes as repo_lotes
from app.security import Actor, get_current_actor
from app.services import lote_service


GENERADOR = Actor(7, frozenset({"GENERADOR"}), 11)
OTROS_ROLES = (
    "OPERADOR_CENTRO", "TECNICO_EVALUADOR", "COORDINADOR_LOGISTICO",
    "REACONDICIONADOR_RECICLADOR", "ENTIDAD_BENEFICIARIA", "ADMINISTRADOR",
)
RESULTADO = {"id_lote": 31, "eliminado": True, "dispositivos_liberados": 2}


class _LoteAislado(unittest.TestCase):
    def setUp(self):
        self.lote = {"id_lote": 31, "codigo_lote": "LOT-PRUEBA", "estado_lote": "REGISTRADO",
                     "id_organizacion": 11}
        self.sesion = MagicMock(name="sesion_sin_base_de_datos")
        self.fabrica = self.enterContext(patch("app.db._Session", return_value=self.sesion))
        self.repo = self.enterContext(patch.object(lote_service, "repo", spec=repo_lotes))
        self.repo.obtener_lote.return_value = self.lote
        self.repo.lote_tiene_solicitud.return_value = False
        self.repo.dispositivos_de_lote.return_value = [101, 102]
        self.auditar = self.enterContext(patch.object(lote_service.auditoria, "registrar"))

    def comprobar_sin_borrado(self):
        self.repo.eliminar_lote.assert_not_called()
        self.auditar.assert_not_called()
        self.sesion.commit.assert_not_called()


class TestEliminarLoteServicio(_LoteAislado):
    def test_elimina_agrupacion_y_audita_dispositivos_preservados(self):
        resultado = lote_service.eliminar_lote(GENERADOR, 31)

        self.assertEqual(resultado, RESULTADO)
        self.repo.eliminar_lote.assert_called_once_with(self.sesion, 31)
        self.auditar.assert_called_once_with(
            self.sesion, "lote", "DELETE", 31,
            {"codigo_lote": "LOT-PRUEBA", "estado_lote": "REGISTRADO", "id_organizacion": 11,
             "total_dispositivos": 2, "ids_dispositivos": [101, 102]},
            None, GENERADOR.id_usuario,
        )
        self.sesion.commit.assert_called_once_with()
        self.sesion.rollback.assert_not_called()
        self.sesion.close.assert_called_once_with()

    def test_bloquea_antes_de_consultar_y_mantiene_auditoria_en_transaccion(self):
        orden = MagicMock()
        orden.attach_mock(self.repo.obtener_lote, "bloquear")
        orden.attach_mock(self.repo.lote_tiene_solicitud, "solicitud")
        orden.attach_mock(self.repo.dispositivos_de_lote, "dispositivos")
        orden.attach_mock(self.repo.eliminar_lote, "eliminar")
        orden.attach_mock(self.auditar, "auditar")
        orden.attach_mock(self.sesion.commit, "commit")
        orden.attach_mock(self.sesion.close, "close")

        lote_service.eliminar_lote(GENERADOR, 31)

        self.repo.obtener_lote.assert_called_once_with(self.sesion, 31, bloquear=True)
        self.assertEqual([llamada[0] for llamada in orden.mock_calls],
                         ["bloquear", "solicitud", "dispositivos", "eliminar", "auditar", "commit", "close"])

    def test_no_revela_si_falta_o_pertenece_a_otra_organizacion(self):
        for lote in (None, {**self.lote, "id_organizacion": 99}):
            with self.subTest(lote=lote):
                self.repo.obtener_lote.return_value = lote
                with self.assertRaisesRegex(NoEncontradoError, "^Lote no encontrado$"):
                    lote_service.eliminar_lote(GENERADOR, 31)
                self.repo.lote_tiene_solicitud.assert_not_called()
                self.repo.dispositivos_de_lote.assert_not_called()
                self.comprobar_sin_borrado()

    def test_solo_generador_puede_eliminar_incluso_si_es_administrador(self):
        for rol in OTROS_ROLES:
            with self.subTest(rol=rol), self.assertRaises(PermisoDenegadoError):
                lote_service.eliminar_lote(Actor(8, frozenset({rol}), 11), 31)
        self.fabrica.assert_not_called()
        self.repo.obtener_lote.assert_not_called()
        self.comprobar_sin_borrado()

    def test_rechaza_todos_los_estados_posteriores_sin_borrar(self):
        for estado in ("SOLICITADO", "RECOLECTADO", "RECIBIDO", "CERRADO"):
            with self.subTest(estado=estado):
                self.repo.obtener_lote.return_value = {**self.lote, "estado_lote": estado}
                with self.assertRaises(ConflictoError):
                    lote_service.eliminar_lote(GENERADOR, 31)
                self.repo.lote_tiene_solicitud.assert_not_called()
                self.repo.dispositivos_de_lote.assert_not_called()
                self.comprobar_sin_borrado()

    def test_solicitud_impide_borrado_aunque_el_lote_siga_registrado(self):
        self.repo.lote_tiene_solicitud.return_value = True

        with self.assertRaisesRegex(ConflictoError, "solicitud"):
            lote_service.eliminar_lote(GENERADOR, 31)

        self.repo.dispositivos_de_lote.assert_not_called()
        self.comprobar_sin_borrado()
        self.sesion.rollback.assert_called_once_with()
        self.sesion.close.assert_called_once_with()

    def test_fallo_de_auditoria_revierte_y_no_confirma_el_borrado(self):
        self.auditar.side_effect = RuntimeError("Auditoria no disponible")

        with self.assertRaisesRegex(RuntimeError, "Auditoria no disponible"):
            lote_service.eliminar_lote(GENERADOR, 31)

        self.repo.eliminar_lote.assert_called_once_with(self.sesion, 31)
        self.sesion.commit.assert_not_called()
        self.sesion.rollback.assert_called_once_with()
        self.sesion.close.assert_called_once_with()


class TestEliminarLoteContrato(_LoteAislado):
    def setUp(self):
        super().setUp()
        self.actor = GENERADOR
        self.enterContext(patch.dict(app.dependency_overrides,
                                     {get_current_actor: lambda: self.actor}))
        self.cliente = TestClient(app)

    def test_delete_devuelve_200_y_contrato_de_dispositivos_liberados(self):
        respuesta = self.cliente.delete("/lotes/31")

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), RESULTADO)
        self.repo.obtener_lote.assert_called_once_with(self.sesion, 31, bloquear=True)
        self.sesion.commit.assert_called_once_with()

    def test_delete_devuelve_404_identico_para_inexistente_y_otra_organizacion(self):
        for lote in (None, {**self.lote, "id_organizacion": 99}):
            with self.subTest(lote=lote):
                self.repo.obtener_lote.return_value = lote
                respuesta = self.cliente.delete("/lotes/31")
                self.assertEqual(respuesta.status_code, 404)
                self.assertEqual(respuesta.json(),
                                 {"error": "NO_ENCONTRADO", "mensaje": "Lote no encontrado"})
                self.comprobar_sin_borrado()

    def test_delete_denegado_por_rol_devuelve_403_sin_abrir_transaccion(self):
        for rol in OTROS_ROLES:
            with self.subTest(rol=rol):
                self.actor = Actor(8, frozenset({rol}), 11)
                respuesta = self.cliente.delete("/lotes/31")
                self.assertEqual(respuesta.status_code, 403)
                self.assertEqual(respuesta.json()["error"], "PERMISO_DENEGADO")
        self.fabrica.assert_not_called()
        self.comprobar_sin_borrado()

    def test_delete_devuelve_409_por_estado_posterior_o_solicitud(self):
        casos = [("SOLICITADO", False), ("RECOLECTADO", False), ("RECIBIDO", False),
                 ("CERRADO", False), ("REGISTRADO", True)]
        for estado, solicitud in casos:
            with self.subTest(estado=estado, solicitud=solicitud):
                self.repo.obtener_lote.return_value = {**self.lote, "estado_lote": estado}
                self.repo.lote_tiene_solicitud.return_value = solicitud
                respuesta = self.cliente.delete("/lotes/31")
                self.assertEqual(respuesta.status_code, 409)
                self.assertEqual(respuesta.json()["error"], "CONFLICTO")
                self.comprobar_sin_borrado()

    def test_swagger_publica_delete_con_id_de_ruta_y_respuesta_tipificada(self):
        esquema = app.openapi()
        operacion = esquema["paths"]["/lotes/{id_lote}"]["delete"]
        parametro = next(p for p in operacion["parameters"] if p["name"] == "id_lote")
        self.assertEqual(parametro["in"], "path")
        self.assertTrue(parametro["required"])
        self.assertEqual(parametro["schema"]["type"], "integer")
        self.assertNotIn("requestBody", operacion)
        self.assertEqual(operacion["responses"]["200"]["content"]["application/json"]["schema"],
                         {"$ref": "#/components/schemas/LoteEliminadoOut"})
        respuesta = esquema["components"]["schemas"]["LoteEliminadoOut"]
        self.assertEqual(set(respuesta["required"]),
                         {"id_lote", "eliminado", "dispositivos_liberados"})
        self.assertEqual(respuesta["properties"]["eliminado"]["type"], "boolean")
        self.assertEqual(respuesta["properties"]["dispositivos_liberados"]["type"], "integer")
        self.assertTrue(operacion["security"])
        self.fabrica.assert_not_called()


class TestEliminarLotePersistencia(unittest.TestCase):
    def test_sql_solo_borra_vinculos_y_lote_filtrados_por_id_en_ese_orden(self):
        sesion = MagicMock()

        repo_lotes.eliminar_lote(sesion, 31)

        self.assertEqual(sesion.execute.call_count, 2)
        tablas = []
        for llamada in sesion.execute.call_args_list:
            sql = str(llamada.args[0])
            tablas.append(re.search(r"DELETE\s+FROM\s+(\w+)", sql, re.IGNORECASE).group(1))
            self.assertRegex(sql, r"WHERE\s+id_lote\s*=\s*:i\s*$")
            self.assertEqual(llamada.args[1], {"i": 31})
        self.assertEqual(tablas, ["lote_dispositivo", "lote"])


if __name__ == "__main__":
    unittest.main()
