import unittest

from app.domain import usuarios as du
from app.domain.errors import ReglaNegocioError
from app.domain.permisos import PERMISOS


class TestClave(unittest.TestCase):
    def test_valida(self):
        du.validar_clave("Clave-Prueba-123")

    def test_invalidas(self):
        for c in ("", "corta1", "sololetrasmuylargas", "12345678901234", None, "a1" * 70):
            with self.assertRaises(ReglaNegocioError, msg=str(c)):
                du.validar_clave(c)


class TestDatos(unittest.TestCase):
    def test_validos(self):
        du.validar_datos_usuario("ana@prueba.local", "ana.perez", "Ana Perez")

    def test_invalidos(self):
        for args in (("ana@", "ana", "Ana"), ("a@b.co", "AN", "Ana"), ("a@b.co", "ana perez", "Ana"),
                     ("a@b.co", "ana", "  "), ("sin-arroba", "ana", "Ana")):
            with self.assertRaises(ReglaNegocioError):
                du.validar_datos_usuario(*args)


class TestRoles(unittest.TestCase):
    def test_ok(self):
        du.validar_roles(["GENERADOR", "OPERADOR_CENTRO"])

    def test_invalidos(self):
        for r in ([], ["GENERADOR", "GENERADOR"], ["SUPERMAN"]):
            with self.assertRaises(ReglaNegocioError):
                du.validar_roles(r)

    def test_roles_coinciden_con_la_matriz(self):
        self.assertEqual(set(du.ROLES_VALIDOS), set(PERMISOS))


class TestAutobloqueo(unittest.TestCase):
    def test_otro_usuario_ok(self):
        du.validar_no_autobloqueo(1, 2, roles_nuevos=["GENERADOR"], activo_nuevo=False)

    def test_a_si_mismo(self):
        with self.assertRaises(ReglaNegocioError):
            du.validar_no_autobloqueo(1, 1, activo_nuevo=False)
        with self.assertRaises(ReglaNegocioError):
            du.validar_no_autobloqueo(1, 1, roles_nuevos=["GENERADOR"])
        du.validar_no_autobloqueo(1, 1, roles_nuevos=["ADMINISTRADOR", "GENERADOR"])
        du.validar_no_autobloqueo(1, 1, activo_nuevo=True)


class TestRuc(unittest.TestCase):
    def test_ruc(self):
        du.validar_ruc("0999999999001")
        for r in ("123", "09999999990011", "abcdefghijklm", None):
            with self.assertRaises(ReglaNegocioError):
                du.validar_ruc(r)


class TestMatrizDePermisos(unittest.TestCase):
    def test_solo_tecnico_evalua_y_clasifica(self):
        con = [r for r, a in PERMISOS.items() if "evaluacion:registrar" in a or "dispositivo:clasificar" in a]
        self.assertEqual(con, ["TECNICO_EVALUADOR"])

    def test_beneficiaria_no_toca_inventario_ni_movimientos(self):
        for a in PERMISOS["ENTIDAD_BENEFICIARIA"]:
            self.assertTrue(a.startswith("asignacion:"), a)

    def test_solo_admin_gestiona_usuarios_y_red(self):
        for accion in ("usuario:gestionar", "rol:gestionar", "red:gestionar", "auditoria:ver"):
            self.assertEqual([r for r, a in PERMISOS.items() if accion in a], ["ADMINISTRADOR"], accion)


if __name__ == "__main__":
    unittest.main()
