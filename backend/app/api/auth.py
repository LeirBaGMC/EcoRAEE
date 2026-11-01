from fastapi import APIRouter, Depends, HTTPException

from ..services import auth_service
from .schemas import LoginIn, PerfilOut, TokenOut
from ..security import Actor, get_current_actor

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(datos: LoginIn):
    token = auth_service.login(datos.nombre_usuario, datos.contrasena)
    if token is None:
        raise HTTPException(status_code=401, detail="Usuario o contrasena incorrectos")
    return TokenOut(access_token=token)


@router.get("/me", response_model=PerfilOut)
def perfil(actor: Actor = Depends(get_current_actor)):
    return auth_service.perfil(actor)
