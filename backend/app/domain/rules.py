"""Reglas RN-01..RN-08 como funciones puras (sin BD, sin HTTP).

Estado: IMPLEMENTADO y probado con unittest. Las transiciones de estado son
una PROPUESTA derivada del TO-BE y deben confirmarse con el equipo.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable, Optional

from .errors import (CapacidadExcedidaError, CierreIncompletoError, EvidenciaFaltanteError,
                     PermisoDenegadoError, ReglaNegocioError, TransicionInvalidaError)

# --- RN-01: estados validos y transiciones (PROPUESTA, configurable) -----------------
ESTADOS = ("REGISTRADO", "EN_RECOLECCION", "RECIBIDO", "EVALUADO", "EN_TRANSITO",
           "EN_TRATAMIENTO", "REACONDICIONADO", "ASIGNADO", "CERRADO")

TRANSICIONES = {
    None: {"REGISTRADO"},
    "REGISTRADO": {"EN_RECOLECCION", "RECIBIDO"},   # recoleccion o entrega directa
    "EN_RECOLECCION": {"RECIBIDO"},
    "RECIBIDO": {"EVALUADO"},
    "EVALUADO": {"EN_TRANSITO", "EN_TRATAMIENTO", "ASIGNADO", "CERRADO"},
    # Al cerrar un movimiento el dispositivo vuelve al estado que tenia antes de salir (EVALUADO o REACONDICIONADO)
    "EN_TRANSITO": {"RECIBIDO", "EVALUADO", "REACONDICIONADO", "EN_TRATAMIENTO"},
    "EN_TRATAMIENTO": {"REACONDICIONADO", "CERRADO"},
    "REACONDICIONADO": {"ASIGNADO", "EN_TRANSITO", "CERRADO"},
    "ASIGNADO": {"CERRADO"},
    "CERRADO": set(),
}


def validar_transicion(anterior: Optional[str], nuevo: str) -> None:
    if nuevo not in ESTADOS:
        raise TransicionInvalidaError(f"Estado desconocido: {nuevo}")
    if nuevo not in TRANSICIONES.get(anterior, set()):
        raise TransicionInvalidaError(f"No se puede pasar de {anterior} a {nuevo}")


# --- RN-02: solo tecnico evaluador -----------------------------------------------------
ROL_TECNICO = "TECNICO_EVALUADOR"


def exigir_tecnico(roles: Iterable[str]) -> None:
    if ROL_TECNICO not in set(roles):
        raise PermisoDenegadoError("Solo un tecnico evaluador puede evaluar o clasificar")


# --- RN-03: cierre de movimiento ------------------------------------------------------
def validar_cierre_movimiento(origen, destino, responsable, num_evidencias: int) -> None:
    faltan = [n for n, v in (("origen", origen), ("destino", destino), ("responsable", responsable)) if not v]
    if faltan:
        raise CierreIncompletoError("Falta: " + ", ".join(faltan))
    if origen == destino:
        raise ReglaNegocioError("Origen y destino no pueden ser iguales")
    if num_evidencias < 1:
        raise EvidenciaFaltanteError("El movimiento no puede cerrarse sin evidencia")


# --- RN-04: no recuperable no se asigna ----------------------------------------------
def validar_asignacion(permite_asignacion: bool, nombre_clasificacion: str) -> None:
    if not permite_asignacion:
        raise ReglaNegocioError(f"Un dispositivo {nombre_clasificacion} no puede asignarse a un beneficiario")


# --- RN-05: capacidad de la conexion ---------------------------------------------------
def validar_capacidad(capacidad: Decimal, ya_comprometido: Decimal, solicitado: Decimal) -> None:
    if solicitado <= 0:
        raise ReglaNegocioError("La cantidad a transferir debe ser mayor que cero")
    disponible = capacidad - ya_comprometido
    if solicitado > disponible:
        raise CapacidadExcedidaError(f"Solicitado {solicitado} supera el disponible {disponible}")


# --- RN-07: evidencia por rol y proposito ---------------------------------------------
@dataclass(frozen=True)
class AccesoEvidencia:
    roles: frozenset
    propositos: frozenset


# PROPUESTA: la matriz real debe acordarse con el equipo.
ACCESO_EVIDENCIA = AccesoEvidencia(
    roles=frozenset({"TECNICO_EVALUADOR", "COORDINADOR_LOGISTICO", "ADMINISTRADOR", "OPERADOR_CENTRO"}),
    propositos=frozenset({"AUDITORIA", "VERIFICACION_CIERRE", "EVALUACION"}),
)


def validar_acceso_evidencia(roles: Iterable[str], proposito: str) -> None:
    if not (set(roles) & ACCESO_EVIDENCIA.roles) or proposito not in ACCESO_EVIDENCIA.propositos:
        raise PermisoDenegadoError("Rol o proposito no autorizado para consultar evidencia")


# --- RN-08: cierre de trazabilidad ----------------------------------------------------
def validar_cierre_trazabilidad(id_tratamiento, id_asignacion, fecha_confirmacion: Optional[date]) -> None:
    if bool(id_tratamiento) == bool(id_asignacion):
        raise CierreIncompletoError("Debe existir exactamente un destino final (tratamiento o asignacion)")
    if fecha_confirmacion is None:
        raise CierreIncompletoError("Falta la fecha de confirmacion")
