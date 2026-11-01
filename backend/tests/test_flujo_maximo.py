import unittest
from decimal import Decimal as D

from app.domain import flujo_maximo as fm
from app.domain.errors import ReglaNegocioError

# Red clasica de CLRS (Introduction to Algorithms), flujo maximo conocido = 23.
# Nodos: 1=s, 2=v1, 3=v2, 4=v3, 5=v4, 6=t
CLRS_NODOS = {1: {"rol": "FUENTE"}, 2: {"rol": "INTERMEDIO"}, 3: {"rol": "INTERMEDIO"},
              4: {"rol": "INTERMEDIO"}, 5: {"rol": "INTERMEDIO"}, 6: {"rol": "SUMIDERO"}}
CLRS_ARISTAS = [(1, 1, 2, D(16)), (2, 1, 3, D(13)), (3, 2, 3, D(10)), (4, 3, 2, D(4)), (5, 2, 4, D(12)),
                (6, 4, 3, D(9)), (7, 3, 5, D(14)), (8, 5, 4, D(7)), (9, 4, 6, D(20)), (10, 5, 6, D(4))]


class TestCLRS(unittest.TestCase):
    def test_flujo_conocido_ambos_algoritmos(self):
        for alg in fm.ALGORITMOS:
            r = fm.calcular(CLRS_NODOS, CLRS_ARISTAS, alg)
            self.assertEqual(r["flujo_maximo"], D(23), alg)

    def test_teorema_flujo_maximo_corte_minimo(self):
        for alg in fm.ALGORITMOS:
            r = fm.calcular(CLRS_NODOS, CLRS_ARISTAS, alg)
            self.assertEqual(r["capacidad_corte"], r["flujo_maximo"], alg)

    def test_corte_conocido(self):
        r = fm.calcular(CLRS_NODOS, CLRS_ARISTAS, "EDMONDS_KARP")
        suma = sum(CLRS_ARISTAS[i - 1][3] for i in r["corte_minimo"])
        self.assertEqual(suma, D(23))

    def test_conservacion_y_capacidad(self):
        r = fm.calcular(CLRS_NODOS, CLRS_ARISTAS)
        for f in r["flujos"].values():
            self.assertTrue(D(0) <= f["flujo"] <= f["capacidad"])
        entrada = {n: D(0) for n in CLRS_NODOS}
        salida = {n: D(0) for n in CLRS_NODOS}
        for i, u, v, c in CLRS_ARISTAS:
            salida[u] += r["flujos"][i]["flujo"]
            entrada[v] += r["flujos"][i]["flujo"]
        for n in (2, 3, 4, 5):
            self.assertEqual(entrada[n], salida[n])
        self.assertEqual(salida[1], D(23))
        self.assertEqual(entrada[6], D(23))

    def test_reproducible(self):
        a = fm.calcular(CLRS_NODOS, CLRS_ARISTAS)
        b = fm.calcular(CLRS_NODOS, list(reversed(CLRS_ARISTAS)))
        self.assertEqual(a, b)


class TestCasosBorde(unittest.TestCase):
    def test_sin_camino(self):
        nodos = {1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO"}, 3: {"rol": "INTERMEDIO"}}
        r = fm.calcular(nodos, [(1, 1, 3, D(5))])
        self.assertEqual(r["flujo_maximo"], 0)

    def test_varias_fuentes_y_sumideros(self):
        nodos = {1: {"rol": "FUENTE"}, 2: {"rol": "FUENTE"}, 3: {"rol": "INTERMEDIO"},
                 4: {"rol": "SUMIDERO"}, 5: {"rol": "SUMIDERO"}}
        ar = [(1, 1, 3, D(10)), (2, 2, 3, D(10)), (3, 3, 4, D(6)), (4, 3, 5, D(7))]
        for alg in fm.ALGORITMOS:
            self.assertEqual(fm.calcular(nodos, ar, alg)["flujo_maximo"], D(13))

    def test_oferta_limita(self):
        nodos = {1: {"rol": "FUENTE", "oferta": D(3)}, 2: {"rol": "SUMIDERO"}}
        r = fm.calcular(nodos, [(1, 1, 2, D(100))])
        self.assertEqual(r["flujo_maximo"], 3)
        self.assertEqual(r["ofertas_limitantes"], [1])
        self.assertEqual(r["corte_minimo"], [])

    def test_demanda_limita(self):
        nodos = {1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO", "demanda": D("2.5")}}
        r = fm.calcular(nodos, [(1, 1, 2, D(100))])
        self.assertEqual(r["flujo_maximo"], D("2.5"))
        self.assertEqual(r["demandas_limitantes"], [2])

    def test_decimales_exactos(self):
        nodos = {1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO"}}
        r = fm.calcular(nodos, [(1, 1, 2, D("0.1")), (2, 1, 2, D("0.2"))])
        self.assertEqual(r["flujo_maximo"], D("0.3"))

    def test_errores(self):
        with self.assertRaises(ReglaNegocioError):
            fm.calcular({1: {"rol": "FUENTE"}}, [])
        with self.assertRaises(ReglaNegocioError):
            fm.calcular({1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO"}}, [(1, 1, 9, D(1))])
        with self.assertRaises(ReglaNegocioError):
            fm.calcular({1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO"}}, [(1, 1, 2, D(1))], "MAGIA")
        with self.assertRaises(ReglaNegocioError):
            fm.calcular({1: {"rol": "FUENTE"}, 2: {"rol": "SUMIDERO"}}, [(1, 1, 2, D(-1))])


if __name__ == "__main__":
    unittest.main()
