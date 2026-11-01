"""Reglas puras de administracion de usuarios."""
import re
from typing import Sequence

from .errors import ReglaNegocioError

ROLES_VALIDOS = ("GENERADOR", "OPERADOR_CENTRO", "TECNICO_EVALUADOR", "COORDINADOR_LOGISTICO",
                 "REACONDICIONADOR_RECICLADOR", "ENTIDAD_BENEFICIARIA", "ADMINISTRADOR")
_USUARIO = re.compile(r"^[a-z0-9_.-]{3,50}$")
_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validar_clave(clave: str) -> None:
    if not clave or len(clave) < 10 or len(clave) > 128:
        raise ReglaNegocioError("La contrasena debe tener entre 10 y 128 caracteres")
    if not re.search(r"[A-Za-z]", clave) or not re.search(r"\d", clave):
        raise ReglaNegocioError("La contrasena debe tener letras y numeros")


def validar_datos_usuario(correo: str, nombre_usuario: str, nombre_visible: str) -> None:
    if not _USUARIO.match(nombre_usuario or ""):
        raise ReglaNegocioError("nombre_usuario: 3 a 50 caracteres entre minusculas, numeros, punto, guion y guion bajo")
    if not correo or len(correo) > 150 or not _CORREO.match(correo):
        raise ReglaNegocioError("Correo no valido")
    if not nombre_visible or not nombre_visible.strip() or len(nombre_visible) > 120:
        raise ReglaNegocioError("nombre_visible es obligatorio (maximo 120 caracteres)")


def validar_roles(roles: Sequence[str]) -> None:
    if not roles:
        raise ReglaNegocioError("El usuario necesita al menos un rol")
    if len(set(roles)) != len(roles):
        raise ReglaNegocioError("Hay roles repetidos")
    for r in roles:
        if r not in ROLES_VALIDOS:
            raise ReglaNegocioError(f"Rol desconocido: {r}")


def validar_no_autobloqueo(id_actor: int, id_objetivo: int, roles_nuevos=None, activo_nuevo=None) -> None:
    """Un administrador no puede desactivarse ni quitarse a si mismo el rol ADMINISTRADOR (evita quedar sin acceso)."""
    if id_actor != id_objetivo:
        return
    if activo_nuevo is False:
        raise ReglaNegocioError("No puedes desactivar tu propia cuenta")
    if roles_nuevos is not None and "ADMINISTRADOR" not in roles_nuevos:
        raise ReglaNegocioError("No puedes quitarte a ti mismo el rol ADMINISTRADOR")


_RUC = re.compile(r"^\d{13}$")


def validar_ruc(ruc: str) -> None:
    if not _RUC.match(ruc or ""):
        raise ReglaNegocioError("El RUC debe tener 13 digitos")
