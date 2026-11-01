from typing import List

from fastapi import APIRouter, Depends, Query

from ..security import Actor, get_current_actor
from ..services import flujo_service as svc
from .schemas import (EjecucionDetalle, EjecucionOut, EjecucionResumen, EjecutarFlujoIn, EscenarioDetalle, EscenarioIn,
                      EscenarioOut, EscenarioResumen, EscenariosPagina, EstadoEscenarioIn)

router = APIRouter(prefix="/escenarios", tags=["escenarios y flujo maximo"])


@router.post("", response_model=EscenarioOut, status_code=201)
def crear(datos: EscenarioIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_escenario(actor, datos.nombre, datos.fecha_inicio_periodo, datos.fecha_fin_periodo, datos.unidad_flujo,
                               [n.model_dump() for n in datos.nodos],
                               None if datos.conexiones is None else [c.model_dump() for c in datos.conexiones])


@router.get("", response_model=EscenariosPagina)
def listar(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), actor: Actor = Depends(get_current_actor)):
    return svc.listar_escenarios(actor, pagina, tamano)


@router.get("/{id_escenario}", response_model=EscenarioDetalle)
def obtener(id_escenario: int, actor: Actor = Depends(get_current_actor)):
    return svc.obtener_escenario(actor, id_escenario)


@router.post("/{id_escenario}/estado", response_model=EscenarioResumen)
def cambiar_estado(id_escenario: int, datos: EstadoEscenarioIn, actor: Actor = Depends(get_current_actor)):
    return svc.cambiar_estado(actor, id_escenario, datos.estado)


@router.post("/{id_escenario}/ejecuciones", response_model=EjecucionOut, status_code=201)
def ejecutar(id_escenario: int, datos: EjecutarFlujoIn = EjecutarFlujoIn(), actor: Actor = Depends(get_current_actor)):
    """Calcula flujo maximo y corte minimo con los datos guardados. No crea ni autoriza movimientos."""
    return svc.ejecutar(actor, id_escenario, datos.algoritmo)


@router.get("/{id_escenario}/ejecuciones", response_model=List[EjecucionResumen])
def listar_ejecuciones(id_escenario: int, actor: Actor = Depends(get_current_actor)):
    return svc.listar_ejecuciones(actor, id_escenario)


@router.get("/{id_escenario}/ejecuciones/{id_ejecucion}", response_model=EjecucionDetalle)
def obtener_ejecucion(id_escenario: int, id_ejecucion: int, actor: Actor = Depends(get_current_actor)):
    return svc.obtener_ejecucion(actor, id_escenario, id_ejecucion)
