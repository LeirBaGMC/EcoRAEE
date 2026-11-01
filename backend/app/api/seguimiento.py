from typing import List

from fastapi import APIRouter, Depends, Query

from ..security import Actor, get_current_actor
from ..services import seguimiento_service as svc
from .schemas import AlertaOut, AlertasPagina, EvaluarAlertasOut, IndicadorOut, MedicionOut

router = APIRouter(tags=["indicadores y alertas"])


@router.post("/indicadores/calcular", response_model=List[IndicadorOut])
def calcular(actor: Actor = Depends(get_current_actor)):
    """Calcula y guarda la medicion de hoy (si ya existe, la actualiza). Son valores de toda la red."""
    return svc.calcular_indicadores(actor)


@router.get("/indicadores", response_model=List[IndicadorOut])
def listar(actor: Actor = Depends(get_current_actor)):
    return svc.listar_indicadores(actor)


@router.get("/indicadores/{codigo}/mediciones", response_model=List[MedicionOut])
def historial(codigo: str, actor: Actor = Depends(get_current_actor)):
    return svc.historial_indicador(actor, codigo)


@router.post("/alertas/evaluar", response_model=EvaluarAlertasOut)
def evaluar(actor: Actor = Depends(get_current_actor)):
    return svc.evaluar_alertas(actor)


@router.get("/alertas", response_model=AlertasPagina)
def listar_alertas(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), solo_abiertas: bool = True,
                   actor: Actor = Depends(get_current_actor)):
    return svc.listar_alertas(actor, pagina, tamano, solo_abiertas)


@router.post("/alertas/{id_alerta}/atender")
def atender(id_alerta: int, actor: Actor = Depends(get_current_actor)):
    return svc.atender_alerta(actor, id_alerta)
