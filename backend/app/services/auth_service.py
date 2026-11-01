from ..db import transaccion
from ..persistence import usuarios
from ..security import create_token, verify_password
from ..persistence.models import Usuario
from ..security import Actor
from fastapi import HTTPException

# Hash falso para que el tiempo de respuesta no delate si el usuario existe.
_HASH_FALSO = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5pD5k9M9wCq0y1kq3nQw5QF5Z3k1b2e"


def login(nombre_usuario: str, contrasena: str):
    """Devuelve token o None. El mensaje de error es el mismo si falla usuario o contrasena."""
    with transaccion() as s:
        u = usuarios.buscar_por_nombre(s, nombre_usuario)
        ok = verify_password(contrasena, u.credencial_hash if u else _HASH_FALSO)
        if not (u and u.activo and ok):
            return None
        return create_token(u.id_usuario)


def perfil(actor: Actor) -> dict:
    with transaccion() as s:
        u = s.get(Usuario, actor.id_usuario)
        if u is None or not u.activo:
            raise HTTPException(status_code=401, detail="Usuario inexistente o inactivo")
        return {"id_usuario": u.id_usuario, "nombre_usuario": u.nombre_usuario,
                "nombre_visible": u.nombre_visible, "roles": sorted(usuarios.roles_de(s, u.id_usuario)),
                "id_organizacion": u.id_organizacion}
