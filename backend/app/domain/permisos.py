"""Matriz rol -> acciones. PROPUESTA aceptada por Katty el 2026-10-31, pendiente de validar con el grupo.
Las acciones de lectura y las de los bloques 2 a 4 se agregaron despues y estan marcadas como propuesta.
El alcance (misma organizacion o centro) se revisa aparte en cada servicio."""
from typing import Iterable

from .errors import PermisoDenegadoError

PERMISOS = {
    "GENERADOR": {"dispositivo:registrar", "dispositivo:ver", "lote:registrar", "lote:ver", "solicitud:crear", "solicitud:ver"},
    "OPERADOR_CENTRO": {"dispositivo:registrar", "dispositivo:ver", "recepcion:registrar", "inventario:gestionar",
                        "evidencia:subir", "movimiento:despachar", "movimiento:ver", "red:ver", "lote:ver", "solicitud:ver"},
    "TECNICO_EVALUADOR": {"evaluacion:registrar", "dispositivo:clasificar", "dispositivo:ver",
                          "evidencia:ver", "evidencia:subir"},
    "COORDINADOR_LOGISTICO": {"dispositivo:ver", "movimiento:programar", "movimiento:autorizar", "movimiento:cerrar",
                              "movimiento:anular", "movimiento:ver", "recoleccion:programar", "asignacion:crear",
                              "cierre:registrar", "flujo:ejecutar", "flujo:ver", "escenario:gestionar",
                              "evidencia:ver", "evidencia:subir", "indicador:ver", "indicador:calcular",
                              "alerta:ver", "alerta:evaluar", "red:ver", "lote:ver", "solicitud:ver"},
    "REACONDICIONADOR_RECICLADOR": {"tratamiento:registrar", "tratamiento:ver", "dispositivo:ver", "evidencia:subir"},
    "ENTIDAD_BENEFICIARIA": {"asignacion:ver", "asignacion:confirmar"},
    "ADMINISTRADOR": {"usuario:gestionar", "rol:gestionar", "auditoria:ver", "evidencia:ver", "red:gestionar",
                      "red:ver", "indicador:ver", "indicador:calcular", "alerta:ver", "alerta:evaluar"},
}


def exigir_permiso(roles: Iterable[str], accion: str) -> None:
    if not any(accion in PERMISOS.get(r, set()) for r in roles):
        raise PermisoDenegadoError(f"No tienes permiso para: {accion}")
