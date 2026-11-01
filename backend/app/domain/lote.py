"""Reglas puras de lotes y solicitudes de recoleccion (RN-01 para lotes)."""
import uuid
from typing import Sequence

from .errors import ReglaNegocioError, TransicionInvalidaError

MAX_DISPOSITIVOS_POR_LOTE = 500
MODALIDADES = ("RECOLECCION", "ENTREGA_DIRECTA")

# PROPUESTA derivada del TO-BE: a confirmar con el equipo.
TRANSICIONES_LOTE = {
    "REGISTRADO": {"SOLICITADO"},
    "SOLICITADO": {"RECOLECTADO", "RECIBIDO"},   # con recoleccion o entrega directa
    "RECOLECTADO": {"RECIBIDO"},
    "RECIBIDO": {"CERRADO"},
    "CERRADO": set(),
}


def validar_transicion_lote(anterior: str, nuevo: str) -> None:
    if nuevo not in TRANSICIONES_LOTE.get(anterior, set()):
        raise TransicionInvalidaError(f"El lote no puede pasar de {anterior} a {nuevo}")


def validar_ids_lote(ids: Sequence[int]) -> None:
    if not ids:
        raise ReglaNegocioError("Un lote necesita al menos un dispositivo")
    if len(set(ids)) != len(ids):
        raise ReglaNegocioError("Hay dispositivos repetidos en el lote")
    if len(ids) > MAX_DISPOSITIVOS_POR_LOTE:
        raise ReglaNegocioError(f"Un lote admite como maximo {MAX_DISPOSITIVOS_POR_LOTE} dispositivos")


def validar_modalidad(modalidad: str) -> None:
    if modalidad not in MODALIDADES:
        raise ReglaNegocioError("modalidad debe ser RECOLECCION o ENTREGA_DIRECTA")


def estado_dispositivo_tras_solicitud(modalidad: str):
    """Con recoleccion el dispositivo pasa a EN_RECOLECCION. Con entrega directa sigue REGISTRADO hasta recibirse."""
    return "EN_RECOLECCION" if modalidad == "RECOLECCION" else None


def generar_codigo_lote() -> str:
    return "LOT-" + uuid.uuid4().hex[:12].upper()


def generar_codigo_solicitud() -> str:
    return "SOL-" + uuid.uuid4().hex[:12].upper()
