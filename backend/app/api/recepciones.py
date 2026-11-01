from fastapi import APIRouter, Depends

from ..security import Actor, get_current_actor
from ..services import recepcion_service
from .schemas import RecepcionIn, RecepcionOut

router = APIRouter(prefix="/recepciones", tags=["recepciones"])


@router.post("", response_model=RecepcionOut, status_code=201)
def registrar(datos: RecepcionIn, actor: Actor = Depends(get_current_actor)):
    return recepcion_service.registrar_recepcion(actor, datos.id_solicitud, datos.id_centro,
                                                 datos.peso_recibido_kg, datos.unidades_recibidas, datos.conforme)
