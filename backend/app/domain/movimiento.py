"""Reglas puras de movimientos (RN-03, RN-05, RN-06). Sin BD ni HTTP."""
import hashlib
import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Optional, Sequence, Tuple

from .errors import ReglaNegocioError, TransicionInvalidaError

TIPOS = ("TRANSFERENCIA", "ENVIO_TRATAMIENTO", "ENTREGA_BENEFICIARIO")

# PROPUESTA derivada del TO-BE.
TRANSICIONES_MOV = {
    "PROGRAMADO": {"AUTORIZADO", "ANULADO"},
    "AUTORIZADO": {"EN_TRANSITO", "ANULADO"},
    "EN_TRANSITO": {"CERRADO"},
    "CERRADO": set(),
    "ANULADO": set(),
}
ESTADOS_QUE_COMPROMETEN_CAPACIDAD = ("PROGRAMADO", "AUTORIZADO", "EN_TRANSITO", "CERRADO")
ESTADOS_ACTIVOS = ("PROGRAMADO", "AUTORIZADO", "EN_TRANSITO")
ESTADOS_DISPOSITIVO_MOVIBLES = {"EVALUADO", "REACONDICIONADO"}
TIPOS_CENTRO_TRATAMIENTO = {"REACONDICIONAMIENTO", "RECICLAJE", "DISPOSICION"}
MAX_ITEMS = 500


def validar_transicion_mov(anterior: str, nuevo: str) -> None:
    if nuevo not in TRANSICIONES_MOV.get(anterior, set()):
        raise TransicionInvalidaError(f"El movimiento no puede pasar de {anterior} a {nuevo}")


def validar_tipo_vs_destino(tipo: str, tipo_centro_destino: str) -> None:
    if tipo not in TIPOS:
        raise ReglaNegocioError("tipo_movimiento no valido")
    if tipo == "ENVIO_TRATAMIENTO" and tipo_centro_destino not in TIPOS_CENTRO_TRATAMIENTO:
        raise ReglaNegocioError("Un envio a tratamiento debe terminar en un centro de reacondicionamiento, reciclaje o disposicion")
    if tipo == "ENTREGA_BENEFICIARIO" and tipo_centro_destino != "SEDE_BENEFICIARIA":
        raise ReglaNegocioError("Una entrega a beneficiario debe terminar en una sede beneficiaria")
    if tipo == "TRANSFERENCIA" and tipo_centro_destino == "SEDE_BENEFICIARIA":
        raise ReglaNegocioError("Para llegar a una sede beneficiaria usa ENTREGA_BENEFICIARIO")


def validar_items(ids: Sequence[int]) -> None:
    if not ids:
        raise ReglaNegocioError("El movimiento necesita al menos un dispositivo")
    if len(set(ids)) != len(ids):
        raise ReglaNegocioError("Hay dispositivos repetidos en el movimiento")
    if len(ids) > MAX_ITEMS:
        raise ReglaNegocioError(f"Un movimiento admite como maximo {MAX_ITEMS} dispositivos")


def periodo_de(fecha: date) -> Tuple[date, date]:
    """PROPUESTA: el periodo de capacidad es el mes calendario de la fecha de despacho."""
    return date(fecha.year, fecha.month, 1), date(fecha.year, fecha.month, monthrange(fecha.year, fecha.month)[1])


def cantidad_item(unidad: str, tipo_registro: str, cantidad_unidades: Optional[int],
                  peso_kg_granel: Optional[Decimal], peso_despachado: Optional[Decimal]) -> Decimal:
    """Cuanto consume un dispositivo de la capacidad de la conexion, en la unidad de la conexion."""
    if unidad == "UND":
        return Decimal(cantidad_unidades) if tipo_registro == "GRANEL" else Decimal(1)
    if unidad == "KG":
        peso = peso_despachado if peso_despachado is not None else (peso_kg_granel if tipo_registro == "GRANEL" else None)
        if peso is None or peso <= 0:
            raise ReglaNegocioError("En una conexion medida en KG cada dispositivo individual necesita peso_despachado_kg mayor que cero")
        return Decimal(peso)
    raise ReglaNegocioError("Unidad de capacidad desconocida")


def estado_tras_cierre(tipo: str, estado_antes_de_salir: Optional[str]) -> str:
    """Al llegar: el envio a tratamiento queda EN_TRATAMIENTO. Los demas vuelven a su estado anterior."""
    if tipo == "ENVIO_TRATAMIENTO":
        return "EN_TRATAMIENTO"
    return estado_antes_de_salir if estado_antes_de_salir in ESTADOS_DISPOSITIVO_MOVIBLES else "RECIBIDO"


def codigo_idempotente(id_usuario: int, clave: str) -> str:
    """Misma persona + misma clave = mismo codigo_movimiento (UNIQUE en BD). Sirve para reintentos seguros."""
    h = hashlib.sha256(f"{id_usuario}:{clave}".encode()).hexdigest()[:16].upper()
    return "MOV-" + h


def generar_codigo_movimiento() -> str:
    return "MOV-" + uuid.uuid4().hex[:16].upper()
