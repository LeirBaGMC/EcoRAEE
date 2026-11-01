from datetime import datetime

from sqlalchemy import text


def obtener_clasificacion(sesion, id_clasificacion: int):
    r = sesion.execute(text(
        "SELECT id_clasificacion, nombre_clasificacion, permite_asignacion FROM clasificacion WHERE id_clasificacion = :i"),
        {"i": id_clasificacion}).mappings().first()
    return dict(r) if r else None


def insertar(sesion, id_dispositivo, condicion, diagnostico, id_usuario, id_clasificacion) -> int:
    """nro_evaluacion=0: lo numera el trigger. Se lee despues dentro de la misma transaccion."""
    sesion.execute(text(
        "INSERT INTO evaluacion_tecnica (id_dispositivo, nro_evaluacion, fecha_hora, condicion_constatada, "
        "diagnostico, id_usuario, id_clasificacion) VALUES (:d, 0, :f, :c, :g, :u, :k)"),
        {"d": id_dispositivo, "f": datetime.now(), "c": condicion, "g": diagnostico, "u": id_usuario, "k": id_clasificacion})
    return sesion.execute(text("SELECT MAX(nro_evaluacion) FROM evaluacion_tecnica WHERE id_dispositivo = :d"),
                          {"d": id_dispositivo}).scalar()
