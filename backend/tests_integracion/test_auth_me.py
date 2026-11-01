import os
import time

import pytest
from app.security import create_token
from .test_flujo_bloque1 import entorno

pytestmark = pytest.mark.skipif(not os.environ.get('ECORAEE_DB_URL'), reason='Falta ECORAEE_DB_URL')


def test_perfil_autenticado_y_sesion_vencida(entorno):
    # La fixture crea usuarios aislados y entrega sus cabeceras autenticadas.
    c, cab, _, _ = entorno
    assert c.get('/auth/me').status_code == 401
    r = c.get('/auth/me', headers=cab['tec'])
    assert r.status_code == 200, r.text
    assert set(r.json()) == {'id_usuario','nombre_usuario','nombre_visible','roles','id_organizacion'}
    assert r.json()['roles'] == ['TECNICO_EVALUADOR']
    expired = create_token(r.json()['id_usuario'], ahora=time.time()-7200)
    assert c.get('/auth/me', headers={'Authorization':f'Bearer {expired}'}).status_code == 401
