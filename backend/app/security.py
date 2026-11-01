"""Identidad. El actor sale del token firmado por el servidor y de la BD, nunca del cliente.

LOCAL (desarrollo): usuario + contrasena (bcrypt) -> token JWT firmado (PyJWT, HS256).
NUBE (despues): se reemplaza por Cognito. Solo cambia decode_token y get_current_actor;
los servicios y la matriz de permisos no se tocan.
Los roles se leen de la BD en cada peticion, no del token, para que quitar un rol surta efecto ya.
"""
import os
import time
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)
TOKEN_MINUTOS = 60


@dataclass(frozen=True)
class Actor:
    id_usuario: int
    roles: frozenset
    id_organizacion: Optional[int] = None
    id_centro: Optional[int] = None


def _secreto() -> str:
    s = os.environ.get("ECORAEE_JWT_SECRET", "")
    if len(s) < 32:
        raise RuntimeError("ECORAEE_JWT_SECRET debe tener al menos 32 caracteres")
    return s


def hash_password(plana: str) -> str:
    import bcrypt  # biblioteca mantenida, nada de criptografia propia
    return bcrypt.hashpw(plana.encode(), bcrypt.gensalt()).decode()


def verify_password(plana: str, hash_guardado: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(plana.encode(), hash_guardado.encode())
    except ValueError:
        return False


def create_token(id_usuario: int, ahora: Optional[float] = None) -> str:
    t = int(ahora if ahora is not None else time.time())
    return jwt.encode({"sub": str(id_usuario), "iat": t, "exp": t + TOKEN_MINUTOS * 60}, _secreto(), algorithm="HS256")


def decode_token(token: str) -> int:
    try:
        datos = jwt.decode(token, _secreto(), algorithms=["HS256"])
        return int(datos["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token invalido o vencido")


def get_current_actor(cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> Actor:
    if cred is None:
        raise HTTPException(status_code=401, detail="Falta autenticacion")
    id_usuario = decode_token(cred.credentials)
    from .persistence.usuarios import cargar_actor  # import tardio: evita ciclo
    actor = cargar_actor(id_usuario)
    if actor is None:
        raise HTTPException(status_code=401, detail="Usuario inexistente o inactivo")
    return actor
