import unittest
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import IntegrityError

from app.domain.errors import ConflictoError
from app.security import Actor
from app.services.dispositivo_service import registrar_dispositivo


class TestSerieDuplicada(unittest.TestCase):
    def ejecutar_error_commit(self, constraint):
        sesion = MagicMock()
        sesion.commit.side_effect = IntegrityError('INSERT', {}, Exception(constraint))
        actor = Actor(1, frozenset({'GENERADOR'}), 1)
        datos = dict(tipo_registro='INDIVIDUAL', numero_serie='AUD-IND-001',
                     id_categoria=1, condicion_declarada='ENCIENDE')
        with patch('app.db._Session', return_value=sesion), \
             patch('app.services.dispositivo_service.repo') as repo:
            repo.crear.return_value = 10
            try:
                registrar_dispositivo(actor, datos)
            finally:
                sesion.rollback.assert_called_once()
                sesion.close.assert_called_once()

    def test_serie_duplicada_revierte_y_devuelve_conflicto(self):
        with self.assertRaisesRegex(ConflictoError, 'Ya existe un dispositivo'):
            self.ejecutar_error_commit("Violation of UNIQUE KEY constraint 'uq_individual_serie'")

    def test_otras_restricciones_no_se_confunden_con_serie(self):
        with self.assertRaises(IntegrityError):
            self.ejecutar_error_commit('FK_dispositivo_categoria')
