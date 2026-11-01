"""Reglas puras de la evaluacion tecnica (RN-02 se exige con rules.exigir_tecnico)."""
from .errors import ReglaNegocioError, TransicionInvalidaError

# PROPUESTA: se evalua al recibir (RECIBIDO) y se puede reevaluar mientras siga EVALUADO.
# Despues de salir a transito o tratamiento ya no se reevalua desde aqui.
ESTADOS_EVALUABLES = {"RECIBIDO", "EVALUADO"}
MAX_DIAGNOSTICO = 2000


def validar_evaluable(estado_actual) -> None:
    if estado_actual not in ESTADOS_EVALUABLES:
        raise TransicionInvalidaError(f"Un dispositivo en estado {estado_actual} no puede evaluarse")


def requiere_cambio_estado(estado_actual: str) -> bool:
    """La primera evaluacion lleva el dispositivo a EVALUADO. Las siguientes solo agregan una evaluacion."""
    return estado_actual == "RECIBIDO"


def validar_diagnostico(texto) -> str:
    limpio = (texto or "").strip()
    if not limpio:
        raise ReglaNegocioError("El diagnostico es obligatorio")
    if len(limpio) > MAX_DIAGNOSTICO:
        raise ReglaNegocioError(f"El diagnostico admite como maximo {MAX_DIAGNOSTICO} caracteres")
    return limpio
