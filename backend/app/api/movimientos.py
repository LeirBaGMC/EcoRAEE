from typing import Optional

from fastapi import APIRouter, Depends, Header, Query

from ..security import Actor, get_current_actor
from ..services import movimiento_service as svc
from .schemas import CierreMovimientoIn, MovimientoDetalle, MovimientoIn, MovimientoOut, MovimientosPagina

router = APIRouter(prefix="/movimientos", tags=["movimientos"])


@router.post("", response_model=MovimientoOut, status_code=201)
def programar(datos: MovimientoIn, idempotency_key: Optional[str] = Header(default=None, max_length=100),
              actor: Actor = Depends(get_current_actor)):
    """Con la cabecera Idempotency-Key, repetir la misma peticion devuelve el mismo movimiento (repetido=true)."""
    return svc.programar(actor, datos.id_conexion, datos.tipo_movimiento, datos.fecha_despacho,
                         [i.model_dump() for i in datos.dispositivos], idempotency_key)


@router.get("", response_model=MovimientosPagina)
def listar(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), estado: Optional[str] = None,
           actor: Actor = Depends(get_current_actor)):
    return svc.listar(actor, pagina, tamano, estado)


@router.get("/{id_movimiento}", response_model=MovimientoDetalle)
def obtener(id_movimiento: int, actor: Actor = Depends(get_current_actor)):
    return svc.obtener(actor, id_movimiento)


@router.post("/{id_movimiento}/autorizar", response_model=MovimientoOut)
def autorizar(id_movimiento: int, actor: Actor = Depends(get_current_actor)):
    return svc.autorizar(actor, id_movimiento)


@router.post("/{id_movimiento}/anular", response_model=MovimientoOut)
def anular(id_movimiento: int, actor: Actor = Depends(get_current_actor)):
    return svc.anular(actor, id_movimiento)


@router.post("/{id_movimiento}/despachar", response_model=MovimientoOut)
def despachar(id_movimiento: int, actor: Actor = Depends(get_current_actor)):
    return svc.despachar(actor, id_movimiento)


@router.post("/{id_movimiento}/cerrar", response_model=MovimientoOut)
def cerrar(id_movimiento: int, datos: CierreMovimientoIn = CierreMovimientoIn(), actor: Actor = Depends(get_current_actor)):
    return svc.cerrar(actor, id_movimiento, {c.id_dispositivo: c.conforme for c in datos.conformes})
