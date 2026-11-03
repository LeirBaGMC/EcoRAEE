import unittest
from app.domain.permisos import PERMISOS, exigir_permiso
from app.domain.errors import PermisoDenegadoError


class TestCuentaAuditoria(unittest.TestCase):
    def test_todos_los_roles_permiten_todas_las_acciones(self):
        for accion in set().union(*PERMISOS.values()):
            exigir_permiso(set(PERMISOS), accion)

    def test_admin_conserva_solo_permisos_base(self):
        self.assertEqual(PERMISOS['ADMINISTRADOR'], {
            'usuario:gestionar', 'rol:gestionar', 'auditoria:ver', 'evidencia:ver',
            'red:gestionar', 'red:ver', 'indicador:ver', 'indicador:calcular', 'alerta:ver', 'alerta:evaluar'})
        for accion in ['movimiento:programar', 'movimiento:ver', 'evaluacion:registrar', 'dispositivo:registrar']:
            with self.assertRaises(PermisoDenegadoError):
                exigir_permiso({'ADMINISTRADOR'}, accion)
