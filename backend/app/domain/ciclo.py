"""Reglas puras de tratamiento, asignacion y cierre de trazabilidad (RN-04, RN-08)."""
from datetime import date, datetime
from typing import Optional

from . import rules
from .errors import (CierreIncompletoError, ConflictoError, ReglaNegocioError, TransicionInvalidaError)

# --- Tratamiento (PROPUESTA: que clasificacion admite cada tratamiento) ---
CLASIFICACIONES_POR_TRATAMIENTO = {
    "REACONDICIONAMIENTO": {"REUTILIZABLE", "REPARABLE"},
    "RECICLAJE": {"RECICLABLE", "NO_RECUPERABLE"},
    "DISPOSICION_CONTROLADA": {"NO_RECUPERABLE"},
}
ESTADOS_PARA_INICIAR_TRATAMIENTO = {"EVALUADO", "EN_TRATAMIENTO"}
RESULTADOS_FINALES = ("EXITOSO", "FALLIDO")


def validar_inicio_tratamiento(tipo: str, clasificacion: Optional[str], estado: Optional[str]) -> None:
    if tipo not in CLASIFICACIONES_POR_TRATAMIENTO:
        raise ReglaNegocioError("tipo_tratamiento no valido")
    if clasificacion is None:
        raise ReglaNegocioError("El dispositivo no tiene evaluacion tecnica")
    if clasificacion not in CLASIFICACIONES_POR_TRATAMIENTO[tipo]:
        raise ReglaNegocioError(f"Un dispositivo {clasificacion} no admite {tipo}")
    if estado not in ESTADOS_PARA_INICIAR_TRATAMIENTO:
        raise TransicionInvalidaError(f"Un dispositivo en estado {estado} no puede iniciar un tratamiento")


def inicio_cambia_estado(estado: str) -> bool:
    """Si llego por un movimiento ENVIO_TRATAMIENTO ya esta EN_TRATAMIENTO y no cambia."""
    return estado == "EVALUADO"


def validar_resultado_final(resultado: str) -> None:
    if resultado not in RESULTADOS_FINALES:
        raise ReglaNegocioError("resultado debe ser EXITOSO o FALLIDO")


def estado_tras_tratamiento(tipo: str, resultado: str) -> Optional[str]:
    """Reacondicionar con exito deja el dispositivo REACONDICIONADO. Cualquier otro caso no cambia el estado."""
    return "REACONDICIONADO" if (tipo == "REACONDICIONAMIENTO" and resultado == "EXITOSO") else None


# --- Asignacion ---
ESTADOS_ASIGNABLES = {"REACONDICIONADO", "EVALUADO"}


def validar_asignable(estado: Optional[str], clasificacion: Optional[str], permite_asignacion: bool) -> None:
    if clasificacion is None:
        raise ReglaNegocioError("El dispositivo no tiene evaluacion tecnica")
    rules.validar_asignacion(permite_asignacion, clasificacion)       # RN-04
    if estado not in ESTADOS_ASIGNABLES:
        raise TransicionInvalidaError(f"Un dispositivo en estado {estado} no puede asignarse")


# --- Cierre de trazabilidad (RN-08) ---
def validar_cierre(id_tratamiento, id_asignacion, fecha_confirmacion: Optional[date], hoy: date,
                   tratamiento: Optional[dict], asignacion: Optional[dict], estado: Optional[str]) -> None:
    rules.validar_cierre_trazabilidad(id_tratamiento, id_asignacion, fecha_confirmacion)   # RN-08
    if fecha_confirmacion > hoy:
        raise CierreIncompletoError("La fecha de confirmacion no puede estar en el futuro")
    if id_tratamiento:
        if tratamiento is None:
            raise ReglaNegocioError("El tratamiento no existe o no es de este dispositivo")
        if tratamiento["resultado"] != "EXITOSO" or tratamiento["fecha_fin"] is None:
            raise CierreIncompletoError("El tratamiento debe estar terminado con resultado EXITOSO")
        if fecha_confirmacion < _dia(tratamiento["fecha_fin"]):
            raise CierreIncompletoError("La confirmacion no puede ser anterior al fin del tratamiento")
        if estado not in ("EN_TRATAMIENTO", "REACONDICIONADO"):
            raise TransicionInvalidaError(f"Un dispositivo en estado {estado} no puede cerrarse por tratamiento")
    else:
        if asignacion is None:
            raise ReglaNegocioError("La asignacion no existe o no es de este dispositivo")
        if asignacion["fecha_entrega"] is None:
            raise CierreIncompletoError("La entidad beneficiaria aun no confirmo la entrega")
        if fecha_confirmacion < _dia(asignacion["fecha_entrega"]):
            raise CierreIncompletoError("La confirmacion no puede ser anterior a la entrega")
        if estado != "ASIGNADO":
            raise TransicionInvalidaError(f"Un dispositivo en estado {estado} no puede cerrarse por asignacion")


def _dia(valor) -> date:
    return valor.date() if isinstance(valor, datetime) else valor
