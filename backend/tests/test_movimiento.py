import unittest
from datetime import date
from decimal import Decimal

from app.domain import movimiento as dm
from app.domain import rules
from app.domain.errors import CapacidadExcedidaError, ReglaNegocioError, TransicionInvalidaError


class TestTransiciones(unittest.TestCase):
    def test_camino_feliz(self):
        dm.validar_transicion_mov("PROGRAMADO", "AUTORIZADO")
        dm.validar_transicion_mov("AUTORIZADO", "EN_TRANSITO")
        dm.validar_transicion_mov("EN_TRANSITO", "CERRADO")

    def test_no_se_salta(self):
        for a, n in (("PROGRAMADO", "CERRADO"), ("PROGRAMADO", "EN_TRANSITO"), ("CERRADO", "ANULADO"),
                     ("EN_TRANSITO", "ANULADO"), ("ANULADO", "AUTORIZADO")):
            with self.assertRaises(TransicionInvalidaError):
                dm.validar_transicion_mov(a, n)

    def test_anular_antes_de_salir(self):
        dm.validar_transicion_mov("PROGRAMADO", "ANULADO")
        dm.validar_transicion_mov("AUTORIZADO", "ANULADO")


class TestTipoVsDestino(unittest.TestCase):
    def test_validos(self):
        dm.validar_tipo_vs_destino("TRANSFERENCIA", "REACONDICIONAMIENTO")
        dm.validar_tipo_vs_destino("ENVIO_TRATAMIENTO", "RECICLAJE")
        dm.validar_tipo_vs_destino("ENTREGA_BENEFICIARIO", "SEDE_BENEFICIARIA")

    def test_invalidos(self):
        for t, c in (("ENVIO_TRATAMIENTO", "RECOLECCION"), ("ENTREGA_BENEFICIARIO", "RECICLAJE"),
                     ("TRANSFERENCIA", "SEDE_BENEFICIARIA"), ("VOLAR", "RECICLAJE")):
            with self.assertRaises(ReglaNegocioError):
                dm.validar_tipo_vs_destino(t, c)


class TestPeriodoYCantidad(unittest.TestCase):
    def test_periodo(self):
        self.assertEqual(dm.periodo_de(date(2026, 2, 10)), (date(2026, 2, 1), date(2026, 2, 28)))
        self.assertEqual(dm.periodo_de(date(2028, 2, 10))[1], date(2028, 2, 29))
        self.assertEqual(dm.periodo_de(date(2026, 12, 31)), (date(2026, 12, 1), date(2026, 12, 31)))

    def test_und(self):
        self.assertEqual(dm.cantidad_item("UND", "INDIVIDUAL", None, None, None), 1)
        self.assertEqual(dm.cantidad_item("UND", "GRANEL", 25, Decimal("10"), None), 25)

    def test_kg(self):
        self.assertEqual(dm.cantidad_item("KG", "GRANEL", 25, Decimal("10.5"), None), Decimal("10.5"))
        self.assertEqual(dm.cantidad_item("KG", "INDIVIDUAL", None, None, Decimal("2.3")), Decimal("2.3"))
        with self.assertRaises(ReglaNegocioError):
            dm.cantidad_item("KG", "INDIVIDUAL", None, None, None)

    def test_items(self):
        dm.validar_items([1, 2])
        for malo in ([], [1, 1], list(range(501))):
            with self.assertRaises(ReglaNegocioError):
                dm.validar_items(malo)


class TestEstadoTrasCierre(unittest.TestCase):
    def test_vuelve_a_su_estado(self):
        self.assertEqual(dm.estado_tras_cierre("TRANSFERENCIA", "EVALUADO"), "EVALUADO")
        self.assertEqual(dm.estado_tras_cierre("ENTREGA_BENEFICIARIO", "REACONDICIONADO"), "REACONDICIONADO")

    def test_tratamiento(self):
        self.assertEqual(dm.estado_tras_cierre("ENVIO_TRATAMIENTO", "EVALUADO"), "EN_TRATAMIENTO")

    def test_sin_dato(self):
        self.assertEqual(dm.estado_tras_cierre("TRANSFERENCIA", None), "RECIBIDO")

    def test_transiciones_existen(self):
        for destino in ("RECIBIDO", "EVALUADO", "REACONDICIONADO", "EN_TRATAMIENTO"):
            rules.validar_transicion("EN_TRANSITO", destino)


class TestIdempotencia(unittest.TestCase):
    def test_determinista(self):
        self.assertEqual(dm.codigo_idempotente(1, "abc"), dm.codigo_idempotente(1, "abc"))

    def test_distinto_usuario_o_clave(self):
        self.assertNotEqual(dm.codigo_idempotente(1, "abc"), dm.codigo_idempotente(2, "abc"))
        self.assertNotEqual(dm.codigo_idempotente(1, "abc"), dm.codigo_idempotente(1, "abd"))

    def test_cabe_en_columna(self):
        self.assertLessEqual(len(dm.codigo_idempotente(1, "x" * 100)), 30)
        self.assertLessEqual(len(dm.generar_codigo_movimiento()), 30)


class TestCapacidadRN05(unittest.TestCase):
    def test_acumulado_del_periodo(self):
        rules.validar_capacidad(Decimal("100"), Decimal("90"), Decimal("10"))
        with self.assertRaises(CapacidadExcedidaError):
            rules.validar_capacidad(Decimal("100"), Decimal("90"), Decimal("10.01"))


if __name__ == "__main__":
    unittest.main()
