import os
import unittest
from decimal import Decimal

os.environ["ECORAEE_JWT_SECRET"] = "x" * 40  # secreto sintetico solo para pruebas

import sys  # noqa: E402
import types  # noqa: E402

try:
    import fastapi  # noqa: F401
except ModuleNotFoundError:
    # SOLO PRUEBAS: sustituto minimo cuando FastAPI no esta instalado (entorno sin internet).
    # En tu computadora se usa el FastAPI real.
    class _HTTPException(Exception):
        def __init__(self, status_code, detail=None):
            self.status_code, self.detail = status_code, detail
    f = types.ModuleType("fastapi"); f.HTTPException = _HTTPException; f.Depends = lambda x=None: x
    fs = types.ModuleType("fastapi.security"); fs.HTTPAuthorizationCredentials = object
    fs.HTTPBearer = lambda auto_error=True: None
    sys.modules.update({"fastapi": f, "fastapi.security": fs})

import jwt  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from app import security  # noqa: E402
from app.domain.errors import PermisoDenegadoError, ReglaNegocioError  # noqa: E402
from app.domain.permisos import exigir_permiso  # noqa: E402
from app.domain import dispositivo as ds  # noqa: E402


class TestPermisos(unittest.TestCase):
    def test_generador_registra(self):
        exigir_permiso(["GENERADOR"], "dispositivo:registrar")

    def test_beneficiario_no_registra(self):
        with self.assertRaises(PermisoDenegadoError):
            exigir_permiso(["ENTIDAD_BENEFICIARIA"], "dispositivo:registrar")

    def test_solo_tecnico_clasifica(self):
        exigir_permiso(["TECNICO_EVALUADOR"], "dispositivo:clasificar")
        for r in ("GENERADOR", "OPERADOR_CENTRO", "COORDINADOR_LOGISTICO", "ADMINISTRADOR"):
            with self.assertRaises(PermisoDenegadoError):
                exigir_permiso([r], "dispositivo:clasificar")

    def test_rol_inexistente(self):
        with self.assertRaises(PermisoDenegadoError):
            exigir_permiso(["INVENTADO"], "dispositivo:registrar")


class TestToken(unittest.TestCase):
    def test_ida_y_vuelta(self):
        self.assertEqual(security.decode_token(security.create_token(7)), 7)

    def test_vencido(self):
        t = security.create_token(7, ahora=1000)
        with self.assertRaises(HTTPException) as e:
            security.decode_token(t)
        self.assertEqual(e.exception.status_code, 401)

    def test_manipulado(self):
        t = jwt.encode({"sub": "7", "exp": 9999999999}, "otro" * 10, algorithm="HS256")
        with self.assertRaises(HTTPException):
            security.decode_token(t)

    def test_secreto_corto_rechazado(self):
        os.environ["ECORAEE_JWT_SECRET"] = "corto"
        try:
            with self.assertRaises(RuntimeError):
                security.create_token(1)
        finally:
            os.environ["ECORAEE_JWT_SECRET"] = "x" * 40


class TestValidacionDispositivo(unittest.TestCase):
    def test_individual_ok(self):
        ds.validar_datos("INDIVIDUAL", "SN-SINTETICO-1", None, None)

    def test_individual_sin_serie(self):
        with self.assertRaises(ReglaNegocioError):
            ds.validar_datos("INDIVIDUAL", None, None, None)

    def test_granel_ok(self):
        ds.validar_datos("GRANEL", None, Decimal("12.5"), 10)

    def test_granel_peso_cero(self):
        with self.assertRaises(ReglaNegocioError):
            ds.validar_datos("GRANEL", None, Decimal("0"), 10)

    def test_granel_con_serie(self):
        with self.assertRaises(ReglaNegocioError):
            ds.validar_datos("GRANEL", "SN1", Decimal("1"), 1)

    def test_codigos_unicos(self):
        self.assertEqual(len({ds.generar_codigo() for _ in range(1000)}), 1000)


if __name__ == "__main__":
    unittest.main()
