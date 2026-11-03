"""Consultas de dispositivos. El alcance sale de la identidad: organizacion propia o centros propios."""
from ..db import transaccion
from ..domain.errors import NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import dispositivos as repo
from ..security import Actor

MAX_TAMANO = 100


def listar_dispositivos(actor: Actor, pagina: int, tamano: int, estado=None) -> dict:
    exigir_permiso(actor.roles, "dispositivo:ver")
    if pagina < 1 or tamano < 1 or tamano > MAX_TAMANO:
        raise ReglaNegocioError(f"pagina >= 1 y tamano entre 1 y {MAX_TAMANO}")
    with transaccion() as s:
        total, items = repo.listar_visibles(s, actor.id_organizacion, estado, (pagina - 1) * tamano, tamano, todos="ADMINISTRADOR" in actor.roles)
    return {"items": items, "total": total, "pagina": pagina, "tamano": tamano}


def obtener_dispositivo(actor: Actor, id_dispositivo: int) -> dict:
    exigir_permiso(actor.roles, "dispositivo:ver")
    with transaccion() as s:
        d = repo.obtener_visible(s, id_dispositivo, actor.id_organizacion, todos="ADMINISTRADOR" in actor.roles)
    if d is None:
        raise NoEncontradoError("Dispositivo no encontrado")
    return d


def historial_dispositivo(actor: Actor, id_dispositivo: int) -> list:
    exigir_permiso(actor.roles, "dispositivo:ver")
    with transaccion() as s:
        if repo.obtener_visible(s, id_dispositivo, actor.id_organizacion, todos="ADMINISTRADOR" in actor.roles) is None:
            raise NoEncontradoError("Dispositivo no encontrado")
        return repo.historial(s, id_dispositivo)
