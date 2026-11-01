import unittest
from datetime import date, datetime

from app.domain import ciclo as dc
from app.domain.errors import CierreIncompletoError, ReglaNegocioError, TransicionInvalidaError

HOY = date(2026, 11, 1)
TRAT_OK = {"resultado": "EXITOSO", "fecha_fin": datetime(2026, 10, 30, 10, 0)}
ASIG_OK = {"fecha_entrega": datetime(2026, 10, 30, 10, 0)}


class TestTratamiento(unittest.TestCase):
    def test_validos(self):
        dc.validar_inicio_tratamiento("REACONDICIONAMIENTO", "REPARABLE", "EVALUADO")
        dc.validar_inicio_tratamiento("RECICLAJE", "NO_RECUPERABLE", "EN_TRATAMIENTO")
        dc.validar_inicio_tratamiento("DISPOSICION_CONTROLADA", "NO_RECUPERABLE", "EVALUADO")

    def test_clasificacion_incompatible(self):
        for t, c in (("REACONDICIONAMIENTO", "NO_RECUPERABLE"), ("DISPOSICION_CONTROLADA", "REUTILIZABLE"),
                     ("RECICLAJE", "REUTILIZABLE")):
            with self.assertRaises(ReglaNegocioError):
                dc.validar_inicio_tratamiento(t, c, "EVALUADO")

    def test_sin_evaluacion_o_estado_malo(self):
        with self.assertRaises(ReglaNegocioError):
            dc.validar_inicio_tratamiento("RECICLAJE", None, "EVALUADO")
        for e in ("RECIBIDO", "ASIGNADO", "CERRADO", "EN_TRANSITO"):
            with self.assertRaises(TransicionInvalidaError):
                dc.validar_inicio_tratamiento("RECICLAJE", "RECICLABLE", e)

    def test_estado_tras_fin(self):
        self.assertEqual(dc.estado_tras_tratamiento("REACONDICIONAMIENTO", "EXITOSO"), "REACONDICIONADO")
        self.assertIsNone(dc.estado_tras_tratamiento("REACONDICIONAMIENTO", "FALLIDO"))
        self.assertIsNone(dc.estado_tras_tratamiento("RECICLAJE", "EXITOSO"))

    def test_resultado(self):
        dc.validar_resultado_final("EXITOSO")
        with self.assertRaises(ReglaNegocioError):
            dc.validar_resultado_final("EN_CURSO")

    def test_inicio_cambia_estado(self):
        self.assertTrue(dc.inicio_cambia_estado("EVALUADO"))
        self.assertFalse(dc.inicio_cambia_estado("EN_TRATAMIENTO"))


class TestAsignacionRN04(unittest.TestCase):
    def test_ok(self):
        dc.validar_asignable("REACONDICIONADO", "REUTILIZABLE", True)
        dc.validar_asignable("EVALUADO", "REUTILIZABLE", True)

    def test_no_recuperable(self):
        with self.assertRaises(ReglaNegocioError):
            dc.validar_asignable("EVALUADO", "NO_RECUPERABLE", False)

    def test_estado_malo_o_sin_evaluacion(self):
        with self.assertRaises(TransicionInvalidaError):
            dc.validar_asignable("RECIBIDO", "REUTILIZABLE", True)
        with self.assertRaises(ReglaNegocioError):
            dc.validar_asignable("EVALUADO", None, False)


class TestCierreRN08(unittest.TestCase):
    def test_por_tratamiento(self):
        dc.validar_cierre(5, None, date(2026, 10, 31), HOY, TRAT_OK, None, "EN_TRATAMIENTO")
        dc.validar_cierre(5, None, date(2026, 10, 30), HOY, TRAT_OK, None, "REACONDICIONADO")

    def test_por_asignacion(self):
        dc.validar_cierre(None, 7, date(2026, 10, 31), HOY, None, ASIG_OK, "ASIGNADO")

    def test_sin_destino_o_dos(self):
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(None, None, date(2026, 10, 31), HOY, None, None, "ASIGNADO")
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, 7, date(2026, 10, 31), HOY, TRAT_OK, ASIG_OK, "ASIGNADO")

    def test_sin_fecha_o_futura(self):
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, None, None, HOY, TRAT_OK, None, "EN_TRATAMIENTO")
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, None, date(2026, 11, 2), HOY, TRAT_OK, None, "EN_TRATAMIENTO")

    def test_tratamiento_no_exitoso_o_inexistente(self):
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, None, date(2026, 10, 31), HOY, {"resultado": "FALLIDO", "fecha_fin": datetime(2026, 10, 30)}, None, "EN_TRATAMIENTO")
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, None, date(2026, 10, 31), HOY, {"resultado": "EN_CURSO", "fecha_fin": None}, None, "EN_TRATAMIENTO")
        with self.assertRaises(ReglaNegocioError):
            dc.validar_cierre(5, None, date(2026, 10, 31), HOY, None, None, "EN_TRATAMIENTO")

    def test_asignacion_sin_entrega(self):
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(None, 7, date(2026, 10, 31), HOY, None, {"fecha_entrega": None}, "ASIGNADO")

    def test_fecha_anterior_al_hecho(self):
        with self.assertRaises(CierreIncompletoError):
            dc.validar_cierre(5, None, date(2026, 10, 29), HOY, TRAT_OK, None, "EN_TRATAMIENTO")

    def test_estado_incorrecto(self):
        with self.assertRaises(TransicionInvalidaError):
            dc.validar_cierre(None, 7, date(2026, 10, 31), HOY, None, ASIG_OK, "REACONDICIONADO")


if __name__ == "__main__":
    unittest.main()
