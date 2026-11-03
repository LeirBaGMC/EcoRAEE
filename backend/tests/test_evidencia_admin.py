import unittest
from unittest.mock import patch

from app.domain.errors import NoEncontradoError, ReglaNegocioError
from app.security import Actor
from app.services import evidencia_service as svc


class TestAlcanceEvidenciaAdmin(unittest.TestCase):
    def setUp(self):
        self.admin = Actor(1, frozenset({'ADMINISTRADOR'}), 1)
        self.tecnico = Actor(2, frozenset({'TECNICO_EVALUADOR'}), 1)

    @patch.object(svc.repo, 'organizaciones_del_objetivo', return_value={99})
    def test_admin_lee_otra_organizacion(self, _):
        svc._comprobar_alcance(None, self.admin, 'movimiento', {}, consulta=True)

    @patch.object(svc.repo, 'organizaciones_del_objetivo', return_value=set())
    def test_admin_no_lee_objetivo_inexistente(self, _):
        with self.assertRaises(NoEncontradoError):
            svc._comprobar_alcance(None, self.admin, 'movimiento', {}, consulta=True)

    @patch.object(svc.repo, 'organizaciones_del_objetivo', return_value={99})
    def test_tecnico_no_lee_otra_organizacion(self, _):
        with self.assertRaises(NoEncontradoError):
            svc._comprobar_alcance(None, self.tecnico, 'movimiento', {}, consulta=True)

    @patch.object(svc.repo, 'organizaciones_del_objetivo', return_value={1})
    def test_tecnico_conserva_acceso_propio(self, _):
        svc._comprobar_alcance(None, self.tecnico, 'movimiento', {}, consulta=True)

    @patch.object(svc.repo, 'organizaciones_del_objetivo', return_value={99})
    def test_excepcion_no_amplia_subida(self, _):
        with self.assertRaises(NoEncontradoError):
            svc._comprobar_alcance(None, self.admin, 'movimiento', {})

    def test_admin_aun_requiere_proposito_valido(self):
        with self.assertRaises(ReglaNegocioError):
            svc._autorizar(self.admin, 'CURIOSIDAD')


if __name__ == '__main__':
    unittest.main()
