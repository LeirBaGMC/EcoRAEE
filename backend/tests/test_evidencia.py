import tempfile
import unittest
from datetime import datetime

from app.domain import evidencia as ev
from app.domain import rules
from app.domain.errors import PermisoDenegadoError, ReglaNegocioError
from app.integrations.almacenamiento import AlmacenamientoLocal, ClaveInvalida

PDF = b"%PDF-1.4 sintetico"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 10
JPG = b"\xff\xd8\xff\xe0" + b"0" * 10


class TestArchivo(unittest.TestCase):
    def test_validos(self):
        self.assertEqual(ev.validar_archivo("application/pdf", PDF, 100), "pdf")
        self.assertEqual(ev.validar_archivo("image/png", PNG, 100), "png")
        self.assertEqual(ev.validar_archivo("image/jpeg", JPG, 100), "jpg")

    def test_rechazos(self):
        casos = [("application/pdf", b"", 100), ("application/pdf", PDF, 5), ("text/html", b"<html>", 100),
                 ("application/pdf", b"<script>alert(1)</script>", 100), ("image/png", PDF, 100),
                 (None, PDF, 100), ("application/x-msdownload", b"MZ....", 100)]
        for ct, data, mx in casos:
            with self.assertRaises(ReglaNegocioError, msg=str((ct, data[:6]))):
                ev.validar_archivo(ct, data, mx)

    def test_justo_en_el_limite(self):
        ev.validar_archivo("application/pdf", PDF, len(PDF))


class TestObjetivo(unittest.TestCase):
    def test_uno_solo(self):
        self.assertEqual(ev.objetivo_de(1, None, None, None, None), "recepcion")
        self.assertEqual(ev.objetivo_de(None, 5, 2, None, None), "evaluacion")
        self.assertEqual(ev.objetivo_de(None, None, None, 9, None), "movimiento")
        self.assertEqual(ev.objetivo_de(None, None, None, None, 3), "cierre")

    def test_invalidos(self):
        for args in ((None, None, None, None, None), (1, None, None, 2, None), (None, 5, None, None, None),
                     (None, None, 2, None, None)):
            with self.assertRaises(ReglaNegocioError):
                ev.objetivo_de(*args)

    def test_tipo_vs_objetivo(self):
        ev.validar_tipo_vs_objetivo("GUIA_TRASLADO", "movimiento")
        ev.validar_tipo_vs_objetivo("FOTO_REGISTRO", "recepcion")
        for t, o in (("GUIA_TRASLADO", "cierre"), ("ACTA_ENTREGA", "movimiento"), ("INVENTADO", "cierre")):
            with self.assertRaises(ReglaNegocioError):
                ev.validar_tipo_vs_objetivo(t, o)


class TestClave(unittest.TestCase):
    def test_generada_es_segura_y_unica(self):
        k = ev.generar_clave("pdf", datetime(2026, 11, 1))
        self.assertTrue(ev.clave_segura(k))
        self.assertTrue(k.startswith("evidencias/2026/11/"))
        self.assertNotEqual(k, ev.generar_clave("pdf", datetime(2026, 11, 1)))
        self.assertEqual(ev.tipo_de_clave(k), "application/pdf")

    def test_claves_peligrosas(self):
        for k in ("../secreto.pdf", "/etc/passwd", "evidencias/2026/11/../../x.pdf", "evidencias/2026/11/abc.pdf",
                  "evidencias/2026/11/" + "a" * 32 + ".exe", "", None):
            self.assertFalse(ev.clave_segura(k), k)


class TestAlmacenLocal(unittest.TestCase):
    def test_guardar_leer_eliminar(self):
        with tempfile.TemporaryDirectory() as d:
            a = AlmacenamientoLocal(d)
            k = ev.generar_clave("pdf")
            a.guardar(k, PDF, "application/pdf")
            self.assertEqual(a.leer(k), PDF)
            a.eliminar(k)
            with self.assertRaises(FileNotFoundError):
                a.leer(k)
            a.eliminar(k)       # eliminar dos veces no falla

    def test_no_permite_salirse(self):
        with tempfile.TemporaryDirectory() as d:
            a = AlmacenamientoLocal(d)
            for k in ("../x.pdf", "/tmp/x.pdf", "evidencias/2026/11/../../../x.pdf"):
                with self.assertRaises(ClaveInvalida):
                    a.leer(k)
                with self.assertRaises(ClaveInvalida):
                    a.guardar(k, PDF, "application/pdf")


class TestAccesoRN07(unittest.TestCase):
    def test_roles_y_propositos(self):
        rules.validar_acceso_evidencia(["TECNICO_EVALUADOR"], "EVALUACION")
        rules.validar_acceso_evidencia(["ADMINISTRADOR"], "AUDITORIA")
        for roles, p in ((["GENERADOR"], "AUDITORIA"), (["ENTIDAD_BENEFICIARIA"], "AUDITORIA"),
                         (["TECNICO_EVALUADOR"], "CURIOSIDAD"), ([], "AUDITORIA")):
            with self.assertRaises(PermisoDenegadoError):
                rules.validar_acceso_evidencia(roles, p)


if __name__ == "__main__":
    unittest.main()
