"""Caso de uso: recepcion en un centro. Una sola transaccion: recepcion + solicitud + lote +
estado de cada dispositivo + historial + inventario. Si algo falla, no queda nada a medias."""
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from ..db import transaccion
from ..domain import lote as dl
from ..domain import recepcion as dr
from ..domain.errors import ConflictoError, NoEncontradoError
from ..domain.permisos import exigir_permiso
from ..persistence import inventario as inv
from ..persistence import seguimiento as seg
from ..persistence import lotes as repo
from ..security import Actor
from . import estado_service


def registrar_recepcion(actor: Actor, id_solicitud: int, id_centro: int, peso_recibido_kg: Decimal,
                        unidades_recibidas: int, conforme: bool) -> dict:
    exigir_permiso(actor.roles, "recepcion:registrar")
    dr.validar_medidas(peso_recibido_kg, unidades_recibidas)
    with transaccion() as s:
        # Alcance: solo se recibe en un centro de la propia organizacion.
        if not repo.centro_pertenece(s, id_centro, actor.id_organizacion):
            raise NoEncontradoError("Centro no encontrado")
        solicitud = repo.obtener_solicitud(s, id_solicitud, bloquear=True)  # serializa recepciones repetidas
        if solicitud is None:
            raise NoEncontradoError("Solicitud no encontrada")
        dr.validar_solicitud_recibible(solicitud["estado_solicitud"])
        if repo.recepcion_existe(s, id_solicitud):
            raise ConflictoError("Esa solicitud ya tiene una recepcion")
        lote = repo.obtener_lote(s, solicitud["id_lote"], bloquear=True)
        dl.validar_transicion_lote(lote["estado_lote"], "RECIBIDO")
        try:
            id_recepcion = repo.crear_recepcion(s, id_solicitud, id_centro, peso_recibido_kg, unidades_recibidas, conforme)
        except IntegrityError:  # red de seguridad: UNIQUE(id_solicitud) en la BD
            raise ConflictoError("Esa solicitud ya tiene una recepcion")
        repo.cambiar_estado_solicitud(s, id_solicitud, "ATENDIDA")
        repo.cambiar_estado_lote(s, lote["id_lote"], "RECIBIDO")
        dispositivos = repo.dispositivos_de_lote(s, lote["id_lote"])
        for id_disp in dispositivos:
            estado_service.transicionar(s, id_disp, "RECIBIDO", actor.id_usuario,
                                        f"Recepcion {solicitud['codigo_solicitud']}")
            inv.abrir_estancia(s, id_disp, id_centro, "RECEPCION")
        if not conforme:   # una recepcion no conforme genera una alerta para revisarla
            seg.crear(s, "OTRA", "MEDIA", f"Recepcion no conforme de la solicitud {solicitud['codigo_solicitud']}", id_centro=id_centro)
    return {"id_recepcion": id_recepcion, "id_solicitud": id_solicitud, "id_centro": id_centro,
            "conforme": conforme, "dispositivos_recibidos": len(dispositivos)}
