import unittest
from decimal import Decimal

from app.domain import evaluacion as de
from app.domain import lote as dl
from app.domain import recepcion as dr
from app.domain.errors import ConflictoError, ReglaNegocioError, TransicionInvalidaError


class TestLote(unittest.TestCase):
    def test_ids_ok(self):
        dl.validar_ids_lote([1, 2, 3])

    def test_vacio(self):
        with self.assertRaises(ReglaNegocioError):
            dl.validar_ids_lote([])

    def test_repetidos(self):
        with self.assertRaises(ReglaNegocioError):
            dl.validar_ids_lote([1, 1])

    def test_demasiados(self):
        with self.assertRaises(ReglaNegocioError):
            dl.validar_ids_lote(list(range(501)))

    def test_transiciones_lote(self):
        dl.validar_transicion_lote("REGISTRADO", "SOLICITADO")
        dl.validar_transicion_lote("SOLICITADO", "RECIBIDO")
        with self.assertRaises(TransicionInvalidaError):
            dl.validar_transicion_lote("REGISTRADO", "RECIBIDO")
        with self.assertRaises(TransicionInvalidaError):
            dl.validar_transicion_lote("CERRADO", "REGISTRADO")

    def test_modalidad(self):
        dl.validar_modalidad("RECOLECCION")
        with self.assertRaises(ReglaNegocioError):
            dl.validar_modalidad("VOLANDO")

    def test_estado_tras_solicitud(self):
        self.assertEqual(dl.estado_dispositivo_tras_solicitud("RECOLECCION"), "EN_RECOLECCION")
        self.assertIsNone(dl.estado_dispositivo_tras_solicitud("ENTREGA_DIRECTA"))

    def test_codigos(self):
        self.assertTrue(dl.generar_codigo_lote().startswith("LOT-"))
        self.assertTrue(dl.generar_codigo_solicitud().startswith("SOL-"))


class TestRecepcion(unittest.TestCase):
    def test_estados_recibibles(self):
        dr.validar_solicitud_recibible("PENDIENTE")
        dr.validar_solicitud_recibible("PROGRAMADA")

    def test_ya_atendida(self):
        for e in ("ATENDIDA", "CANCELADA"):
            with self.assertRaises(ConflictoError):
                dr.validar_solicitud_recibible(e)

    def test_medidas(self):
        dr.validar_medidas(Decimal("0"), 0)
        with self.assertRaises(ReglaNegocioError):
            dr.validar_medidas(Decimal("-1"), 1)
        with self.assertRaises(ReglaNegocioError):
            dr.validar_medidas(Decimal("1"), -1)


class TestEvaluacion(unittest.TestCase):
    def test_evaluable(self):
        de.validar_evaluable("RECIBIDO")
        de.validar_evaluable("EVALUADO")

    def test_no_evaluable(self):
        for e in ("REGISTRADO", "EN_RECOLECCION", "EN_TRANSITO", "ASIGNADO", None):
            with self.assertRaises(TransicionInvalidaError):
                de.validar_evaluable(e)

    def test_solo_primera_cambia_estado(self):
        self.assertTrue(de.requiere_cambio_estado("RECIBIDO"))
        self.assertFalse(de.requiere_cambio_estado("EVALUADO"))

    def test_diagnostico(self):
        self.assertEqual(de.validar_diagnostico("  pantalla rota  "), "pantalla rota")
        for malo in ("", "   ", None, "x" * 2001):
            with self.assertRaises(ReglaNegocioError):
                de.validar_diagnostico(malo)


if __name__ == "__main__":
    unittest.main()
