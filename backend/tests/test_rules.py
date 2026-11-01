import unittest
from datetime import date
from decimal import Decimal

from app.domain import rules
from app.domain.errors import (CapacidadExcedidaError, CierreIncompletoError, EvidenciaFaltanteError,
                               PermisoDenegadoError, ReglaNegocioError, TransicionInvalidaError)


class TestRN01(unittest.TestCase):
    def test_transicion_valida(self):
        rules.validar_transicion(None, "REGISTRADO")
        rules.validar_transicion("RECIBIDO", "EVALUADO")

    def test_transicion_invalida(self):
        with self.assertRaises(TransicionInvalidaError):
            rules.validar_transicion("REGISTRADO", "ASIGNADO")

    def test_cerrado_es_final(self):
        with self.assertRaises(TransicionInvalidaError):
            rules.validar_transicion("CERRADO", "REGISTRADO")

    def test_estado_desconocido(self):
        with self.assertRaises(TransicionInvalidaError):
            rules.validar_transicion("REGISTRADO", "VOLANDO")


class TestRN02(unittest.TestCase):
    def test_tecnico_ok(self):
        rules.exigir_tecnico(["TECNICO_EVALUADOR"])

    def test_otro_rol_denegado(self):
        with self.assertRaises(PermisoDenegadoError):
            rules.exigir_tecnico(["OPERADOR_CENTRO"])


class TestRN03(unittest.TestCase):
    def test_completo(self):
        rules.validar_cierre_movimiento(1, 2, 7, 1)

    def test_sin_evidencia(self):
        with self.assertRaises(EvidenciaFaltanteError):
            rules.validar_cierre_movimiento(1, 2, 7, 0)

    def test_sin_responsable(self):
        with self.assertRaises(CierreIncompletoError):
            rules.validar_cierre_movimiento(1, 2, None, 1)

    def test_origen_igual_destino(self):
        with self.assertRaises(ReglaNegocioError):
            rules.validar_cierre_movimiento(1, 1, 7, 1)


class TestRN04(unittest.TestCase):
    def test_reutilizable(self):
        rules.validar_asignacion(True, "REUTILIZABLE")

    def test_no_recuperable(self):
        with self.assertRaises(ReglaNegocioError):
            rules.validar_asignacion(False, "NO_RECUPERABLE")


class TestRN05(unittest.TestCase):
    def test_justo_en_el_limite(self):
        rules.validar_capacidad(Decimal("100"), Decimal("60"), Decimal("40"))

    def test_excede(self):
        with self.assertRaises(CapacidadExcedidaError):
            rules.validar_capacidad(Decimal("100"), Decimal("60"), Decimal("40.01"))

    def test_cantidad_no_positiva(self):
        with self.assertRaises(ReglaNegocioError):
            rules.validar_capacidad(Decimal("100"), Decimal("0"), Decimal("0"))


class TestRN07(unittest.TestCase):
    def test_autorizado(self):
        rules.validar_acceso_evidencia(["COORDINADOR_LOGISTICO"], "AUDITORIA")

    def test_rol_no_autorizado(self):
        with self.assertRaises(PermisoDenegadoError):
            rules.validar_acceso_evidencia(["GENERADOR"], "AUDITORIA")

    def test_proposito_no_autorizado(self):
        with self.assertRaises(PermisoDenegadoError):
            rules.validar_acceso_evidencia(["ADMINISTRADOR"], "CURIOSIDAD")


class TestRN08(unittest.TestCase):
    def test_con_tratamiento(self):
        rules.validar_cierre_trazabilidad(5, None, date(2026, 10, 1))

    def test_sin_destino(self):
        with self.assertRaises(CierreIncompletoError):
            rules.validar_cierre_trazabilidad(None, None, date(2026, 10, 1))

    def test_dos_destinos(self):
        with self.assertRaises(CierreIncompletoError):
            rules.validar_cierre_trazabilidad(5, 6, date(2026, 10, 1))

    def test_sin_fecha(self):
        with self.assertRaises(CierreIncompletoError):
            rules.validar_cierre_trazabilidad(5, None, None)


if __name__ == "__main__":
    unittest.main()
