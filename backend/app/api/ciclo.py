from fastapi import APIRouter, Depends, Query

from ..security import Actor, get_current_actor
from ..services import ciclo_service as svc
from .schemas import (AsignacionesPagina, AsignacionIn, AsignacionOut, CierreDetalle, CierreIn, CierreOut, TratamientoFinIn,
                      TratamientoIn, TratamientoOut)

router = APIRouter(tags=["tratamiento, asignacion y cierre"])


@router.post("/tratamientos", response_model=TratamientoOut, status_code=201)
def iniciar_tratamiento(datos: TratamientoIn, actor: Actor = Depends(get_current_actor)):
    return svc.iniciar_tratamiento(actor, datos.id_dispositivo, datos.tipo_tratamiento)


@router.post("/tratamientos/{id_tratamiento}/finalizar", response_model=TratamientoOut)
def finalizar_tratamiento(id_tratamiento: int, datos: TratamientoFinIn, actor: Actor = Depends(get_current_actor)):
    return svc.finalizar_tratamiento(actor, id_tratamiento, datos.resultado)


@router.get("/tratamientos/{id_tratamiento}", response_model=TratamientoOut)
def obtener_tratamiento(id_tratamiento: int, actor: Actor = Depends(get_current_actor)):
    return svc.obtener_tratamiento(actor, id_tratamiento)


@router.post("/asignaciones", response_model=AsignacionOut, status_code=201)
def crear_asignacion(datos: AsignacionIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_asignacion(actor, datos.id_dispositivo, datos.id_organizacion_beneficiaria, datos.finalidad)


@router.post("/asignaciones/{id_asignacion}/confirmar", response_model=AsignacionOut)
def confirmar_entrega(id_asignacion: int, actor: Actor = Depends(get_current_actor)):
    return svc.confirmar_entrega(actor, id_asignacion)


@router.get("/asignaciones", response_model=AsignacionesPagina)
def listar_asignaciones(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100),
                        actor: Actor = Depends(get_current_actor)):
    return svc.listar_asignaciones(actor, pagina, tamano)


@router.post("/cierres", response_model=CierreOut, status_code=201)
def registrar_cierre(datos: CierreIn, actor: Actor = Depends(get_current_actor)):
    return svc.registrar_cierre(actor, datos.id_dispositivo, datos.id_tratamiento, datos.id_asignacion, datos.fecha_confirmacion)


@router.get("/dispositivos/{id_dispositivo}/cierre", response_model=CierreDetalle)
def consultar_cierre(id_dispositivo: int, actor: Actor = Depends(get_current_actor)):
    return svc.consultar_cierre(actor, id_dispositivo)
