from typing import Optional

from sqlalchemy import select

from ..db import transaccion
from ..security import Actor
from .models import Rol, Usuario, UsuarioRol


def buscar_por_nombre(sesion, nombre_usuario: str) -> Optional[Usuario]:
    return sesion.execute(select(Usuario).where(Usuario.nombre_usuario == nombre_usuario)).scalar_one_or_none()


def roles_de(sesion, id_usuario: int) -> frozenset:
    filas = sesion.execute(select(Rol.nombre_rol).join(UsuarioRol, UsuarioRol.id_rol == Rol.id_rol)
                           .where(UsuarioRol.id_usuario == id_usuario)).scalars().all()
    return frozenset(filas)


def cargar_actor(id_usuario: int) -> Optional[Actor]:
    with transaccion() as s:
        u = s.get(Usuario, id_usuario)
        if u is None or not u.activo:
            return None
        return Actor(id_usuario=u.id_usuario, roles=roles_de(s, id_usuario), id_organizacion=u.id_organizacion)
