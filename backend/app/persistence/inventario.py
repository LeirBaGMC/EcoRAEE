from datetime import datetime

from sqlalchemy import text


def abrir_estancia(sesion, id_dispositivo: int, id_centro: int, motivo: str) -> None:
    """nro_estancia=0: lo numera el trigger. El indice unico filtrado impide dos estancias abiertas."""
    sesion.execute(text(
        "INSERT INTO inventario (id_dispositivo, nro_estancia, fecha_ingreso, motivo_ingreso, id_centro) "
        "VALUES (:d, 0, :f, :m, :c)"), {"d": id_dispositivo, "f": datetime.now(), "m": motivo, "c": id_centro})
