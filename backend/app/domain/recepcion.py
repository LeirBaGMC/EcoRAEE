"""Reglas puras de la recepcion en un centro."""
from decimal import Decimal

from .errors import ConflictoError, ReglaNegocioError

ESTADOS_SOLICITUD_RECIBIBLES = {"PENDIENTE", "PROGRAMADA"}


def validar_solicitud_recibible(estado_solicitud: str) -> None:
    if estado_solicitud not in ESTADOS_SOLICITUD_RECIBIBLES:
        raise ConflictoError(f"La solicitud esta {estado_solicitud} y no admite recepcion")


def validar_medidas(peso_kg: Decimal, unidades: int) -> None:
    if peso_kg is None or peso_kg < 0:
        raise ReglaNegocioError("El peso recibido no puede ser negativo")
    if unidades is None or unidades < 0:
        raise ReglaNegocioError("Las unidades recibidas no pueden ser negativas")
