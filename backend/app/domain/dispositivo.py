"""Reglas puras del registro de dispositivos (RN-01 parte de datos)."""
import uuid
from decimal import Decimal
from typing import Optional

from .errors import ReglaNegocioError


def generar_codigo() -> str:
    return "DSP-" + uuid.uuid4().hex[:12].upper()


def validar_datos(tipo_registro: str, numero_serie: Optional[str], peso_kg: Optional[Decimal],
                  cantidad: Optional[int]) -> None:
    if tipo_registro == "INDIVIDUAL":
        if not numero_serie:
            raise ReglaNegocioError("Un dispositivo individual requiere numero de serie")
        if peso_kg is not None or cantidad is not None:
            raise ReglaNegocioError("Un dispositivo individual no lleva peso ni cantidad")
    elif tipo_registro == "GRANEL":
        if numero_serie:
            raise ReglaNegocioError("Un registro a granel no lleva numero de serie")
        if peso_kg is None or peso_kg <= 0 or cantidad is None or cantidad <= 0:
            raise ReglaNegocioError("Un registro a granel requiere peso y cantidad mayores que cero")
    else:
        raise ReglaNegocioError("tipo_registro debe ser INDIVIDUAL o GRANEL")
