import unittest
from datetime import datetime, timedelta
from decimal import Decimal as D

from app.domain import seguimiento as sg


class TestPorcentaje(unittest.TestCase):
    def test_basico(self):
        self.assertEqual(sg.porcentaje(1, 4), D("25.0000"))
        self.assertEqual(sg.porcentaje(1, 3), D("33.3333"))
        self.assertEqual(sg.porcentaje(2, 3), D("66.6667"))

    def test_total_cero(self):
        self.assertEqual(sg.porcentaje(0, 0), D("0.0000"))
        self.assertEqual(sg.porcentaje(5, 0), D("0.0000"))


class TestSeveridadCapacidad(unittest.TestCase):
    def test_niveles(self):
        self.assertIsNone(sg.severidad_capacidad(89, 100))
        self.assertEqual(sg.severidad_capacidad(90, 100), "MEDIA")
        self.assertEqual(sg.severidad_capacidad(99.99, 100), "MEDIA")
        self.assertEqual(sg.severidad_capacidad(100, 100), "ALTA")

    def test_capacidad_cero(self):
        self.assertIsNone(sg.severidad_capacidad(0, 0))
        self.assertEqual(sg.severidad_capacidad(1, 0), "ALTA")


class TestSeveridadTiempo(unittest.TestCase):
    def test_niveles(self):
        ahora = datetime(2026, 11, 20)
        self.assertIsNone(sg.severidad_tiempo(ahora - timedelta(days=6), ahora, 7))
        self.assertIsNone(sg.severidad_tiempo(ahora - timedelta(days=7), ahora, 7))
        self.assertEqual(sg.severidad_tiempo(ahora - timedelta(days=8), ahora, 7), "MEDIA")
        self.assertEqual(sg.severidad_tiempo(ahora - timedelta(days=15), ahora, 7), "ALTA")


class TestCatalogo(unittest.TestCase):
    def test_codigos_unicos_y_largos(self):
        codigos = [c[0] for c in sg.CATALOGO_INDICADORES]
        self.assertEqual(len(codigos), len(set(codigos)))
        for c, n, d, u in sg.CATALOGO_INDICADORES:
            self.assertLessEqual(len(c), 30); self.assertLessEqual(len(n), 120)
            self.assertLessEqual(len(d), 255); self.assertLessEqual(len(u), 30)


if __name__ == "__main__":
    unittest.main()
