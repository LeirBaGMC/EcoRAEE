"""Reglas puras de indicadores y alertas (M-07). Los umbrales son PROPUESTA a validar con el equipo."""
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

UMBRAL_CAPACIDAD_MEDIA = Decimal("0.90")
UMBRAL_CAPACIDAD_ALTA = Decimal("1.00")
DIAS_MAX_EN_TRANSITO = 7
DIAS_MAX_SIN_EVALUAR = 7

CATALOGO_INDICADORES = [
    ("IND-01", "Dispositivos registrados", "Total de dispositivos trazables registrados", "UND"),
    ("IND-02", "Cobertura de evaluacion tecnica", "Porcentaje de dispositivos con al menos una evaluacion tecnica", "%"),
    ("IND-03", "Tasa de reutilizacion", "Porcentaje de dispositivos evaluados cuya ultima clasificacion es REUTILIZABLE", "%"),
    ("IND-04", "Movimientos cerrados", "Movimientos entre centros cerrados con evidencia", "UND"),
    ("IND-05", "Trazabilidades cerradas", "Dispositivos con destino final y fecha de confirmacion", "UND"),
    ("IND-06", "Evidencias cargadas", "Total de evidencias registradas", "UND"),
]


def porcentaje(parte, total) -> Decimal:
    if not total:
        return Decimal("0.0000")
    return (Decimal(parte) * 100 / Decimal(total)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def severidad_capacidad(comprometido, capacidad) -> Optional[str]:
    comprometido, capacidad = Decimal(comprometido), Decimal(capacidad)
    if capacidad <= 0:
        return "ALTA" if comprometido > 0 else None
    uso = comprometido / capacidad
    if uso >= UMBRAL_CAPACIDAD_ALTA:
        return "ALTA"
    if uso >= UMBRAL_CAPACIDAD_MEDIA:
        return "MEDIA"
    return None


def severidad_tiempo(desde: datetime, ahora: datetime, dias_max: int) -> Optional[str]:
    transcurridos = (ahora - desde).total_seconds() / 86400
    if transcurridos > dias_max * 2:
        return "ALTA"
    if transcurridos > dias_max:
        return "MEDIA"
    return None
