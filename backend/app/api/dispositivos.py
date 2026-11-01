from fastapi import APIRouter, Depends

from ..security import Actor, get_current_actor
from ..services import dispositivo_service
from .schemas import DispositivoIn, DispositivoOut

router = APIRouter(prefix="/dispositivos", tags=["dispositivos"])


@router.post("", response_model=DispositivoOut, status_code=201)
def registrar(datos: DispositivoIn, actor: Actor = Depends(get_current_actor)):
    # La ruta solo traduce HTTP. Las reglas viven en el servicio.
    return dispositivo_service.registrar_dispositivo(actor, datos.model_dump())


from typing import List, Optional  # noqa: E402

from fastapi import Query  # noqa: E402

from ..services import consulta_service, evaluacion_service  # noqa: E402
from .schemas import DispositivoDetalle, DispositivosPagina, EvaluacionIn, EvaluacionOut, HistorialItem  # noqa: E402


@router.get("", response_model=DispositivosPagina)
def listar(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100),
           estado: Optional[str] = None, actor: Actor = Depends(get_current_actor)):
    return consulta_service.listar_dispositivos(actor, pagina, tamano, estado)


@router.get("/{id_dispositivo}", response_model=DispositivoDetalle)
def obtener(id_dispositivo: int, actor: Actor = Depends(get_current_actor)):
    return consulta_service.obtener_dispositivo(actor, id_dispositivo)


@router.get("/{id_dispositivo}/historial", response_model=List[HistorialItem])
def historial(id_dispositivo: int, actor: Actor = Depends(get_current_actor)):
    return consulta_service.historial_dispositivo(actor, id_dispositivo)


@router.post("/{id_dispositivo}/evaluaciones", response_model=EvaluacionOut, status_code=201)
def evaluar(id_dispositivo: int, datos: EvaluacionIn, actor: Actor = Depends(get_current_actor)):
    return evaluacion_service.registrar_evaluacion(actor, id_dispositivo, datos.condicion_constatada,
                                                   datos.diagnostico, datos.id_clasificacion)
