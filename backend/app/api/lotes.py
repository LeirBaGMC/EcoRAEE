from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..security import Actor, get_current_actor
from ..services import lote_service
from .schemas import (LoteDetalle, LoteIn, LoteOut, RecoleccionIn, RecoleccionOut, SolicitudesPagina, SolicitudIn,
                      SolicitudOut)

router = APIRouter(tags=["lotes y solicitudes"])


@router.post("/lotes", response_model=LoteOut, status_code=201)
def crear_lote(datos: LoteIn, actor: Actor = Depends(get_current_actor)):
    return lote_service.crear_lote(actor, datos.ids_dispositivos)


@router.post("/solicitudes", response_model=SolicitudOut, status_code=201)
def crear_solicitud(datos: SolicitudIn, actor: Actor = Depends(get_current_actor)):
    return lote_service.crear_solicitud(actor, datos.id_lote, datos.modalidad, datos.zona_referencial)


@router.get("/lotes/{id_lote}", response_model=LoteDetalle)
def obtener_lote(id_lote: int, actor: Actor = Depends(get_current_actor)):
    return lote_service.obtener_lote(actor, id_lote)


@router.get("/solicitudes", response_model=SolicitudesPagina)
def listar_solicitudes(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), estado: Optional[str] = None,
                       actor: Actor = Depends(get_current_actor)):
    return lote_service.listar_solicitudes(actor, pagina, tamano, estado)


@router.post("/solicitudes/{id_solicitud}/recoleccion", response_model=RecoleccionOut, status_code=201)
def programar_recoleccion(id_solicitud: int, datos: RecoleccionIn, actor: Actor = Depends(get_current_actor)):
    return lote_service.programar_recoleccion(actor, id_solicitud, datos.fecha_programada)


@router.post("/solicitudes/{id_solicitud}/recoleccion/ejecutar", response_model=RecoleccionOut)
def ejecutar_recoleccion(id_solicitud: int, actor: Actor = Depends(get_current_actor)):
    return lote_service.ejecutar_recoleccion(actor, id_solicitud)
