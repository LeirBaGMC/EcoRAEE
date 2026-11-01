from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile

from ..config import load_settings
from ..domain.errors import ReglaNegocioError
from ..security import Actor, get_current_actor
from ..services import evidencia_service as svc
from .schemas import EvidenciaOut

router = APIRouter(prefix="/evidencias", tags=["evidencias"])
Proposito = Literal["AUDITORIA", "VERIFICACION_CIERRE", "EVALUACION"]


@router.post("", response_model=EvidenciaOut, status_code=201)
def subir(tipo_evidencia: Literal["FOTO_REGISTRO", "ACTA_RECEPCION", "INFORME_EVALUACION", "GUIA_TRASLADO",
                                  "CERTIFICADO_TRATAMIENTO", "ACTA_ENTREGA"] = Form(...),
          archivo: UploadFile = File(...), descripcion: Optional[str] = Form(None),
          id_recepcion: Optional[int] = Form(None), id_dispositivo_evaluacion: Optional[int] = Form(None),
          nro_evaluacion: Optional[int] = Form(None), id_movimiento: Optional[int] = Form(None),
          id_cierre: Optional[int] = Form(None), actor: Actor = Depends(get_current_actor)):
    """Indica EXACTAMENTE una entidad a respaldar. Solo PDF, JPG o PNG. El nombre del archivo no se usa."""
    maximo = load_settings().evidence_max_bytes
    contenido = archivo.file.read(maximo + 1)                   # nunca se lee mas del limite
    if len(contenido) > maximo:
        raise ReglaNegocioError(f"El archivo supera el maximo de {maximo} bytes")
    return svc.subir(actor, tipo_evidencia, descripcion,
                     {"id_recepcion": id_recepcion, "id_dispositivo_evaluacion": id_dispositivo_evaluacion,
                      "nro_evaluacion": nro_evaluacion, "id_movimiento": id_movimiento, "id_cierre": id_cierre},
                     archivo.content_type, contenido)


@router.get("", response_model=List[EvidenciaOut])
def listar(proposito: Proposito, id_recepcion: Optional[int] = None, id_dispositivo_evaluacion: Optional[int] = None,
           nro_evaluacion: Optional[int] = None, id_movimiento: Optional[int] = None, id_cierre: Optional[int] = None,
           actor: Actor = Depends(get_current_actor)):
    return svc.listar(actor, proposito, {"id_recepcion": id_recepcion, "id_dispositivo_evaluacion": id_dispositivo_evaluacion,
                                         "nro_evaluacion": nro_evaluacion, "id_movimiento": id_movimiento, "id_cierre": id_cierre})


@router.get("/{id_evidencia}/archivo")
def descargar(id_evidencia: int, proposito: Proposito, actor: Actor = Depends(get_current_actor)):
    contenido, tipo = svc.descargar(actor, id_evidencia, proposito)
    return Response(content=contenido, media_type=tipo,
                    headers={"Content-Disposition": f'attachment; filename="evidencia-{id_evidencia}"',
                             "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
