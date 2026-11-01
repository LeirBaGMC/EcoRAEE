from datetime import datetime

from sqlalchemy import text


def organizaciones_del_objetivo(sesion, objetivo: str, ids: dict) -> set:
    """Organizaciones con derecho a ver evidencia de ese objetivo. Conjunto vacio = el objetivo no existe."""
    q = {
        "recepcion": ("SELECT c.id_organizacion FROM recepcion r JOIN centro c ON c.id_centro = r.id_centro WHERE r.id_recepcion = :a "
                      "UNION SELECT l.id_organizacion FROM recepcion r JOIN solicitud_recoleccion s ON s.id_solicitud = r.id_solicitud "
                      "JOIN lote l ON l.id_lote = s.id_lote WHERE r.id_recepcion = :a"),
        "movimiento": ("SELECT co.id_organizacion FROM movimiento m JOIN conexion_logistica c ON c.id_conexion = m.id_conexion "
                       "JOIN centro co ON co.id_centro = c.id_centro_origen WHERE m.id_movimiento = :a "
                       "UNION SELECT cd.id_organizacion FROM movimiento m JOIN conexion_logistica c ON c.id_conexion = m.id_conexion "
                       "JOIN centro cd ON cd.id_centro = c.id_centro_destino WHERE m.id_movimiento = :a"),
    }
    dispositivo_orgs = ("SELECT d.id_organizacion FROM dispositivo d WHERE d.id_dispositivo = :a "
                        "UNION SELECT c.id_organizacion FROM inventario i JOIN centro c ON c.id_centro = i.id_centro WHERE i.id_dispositivo = :a")
    if objetivo in q:
        sql, p = q[objetivo], {"a": ids["id_recepcion"] if objetivo == "recepcion" else ids["id_movimiento"]}
    elif objetivo == "evaluacion":
        sql = ("SELECT 1 FROM evaluacion_tecnica WHERE id_dispositivo = :a AND nro_evaluacion = :n")
        existe = sesion.execute(text(sql), {"a": ids["id_dispositivo_evaluacion"], "n": ids["nro_evaluacion"]}).first()
        if not existe:
            return set()
        sql, p = dispositivo_orgs, {"a": ids["id_dispositivo_evaluacion"]}
    else:  # cierre
        fila = sesion.execute(text("SELECT id_dispositivo FROM cierre_trazabilidad WHERE id_cierre = :c"), {"c": ids["id_cierre"]}).first()
        if not fila:
            return set()
        sql, p = dispositivo_orgs, {"a": fila[0]}
    return {r[0] for r in sesion.execute(text(sql), p)}


def insertar(sesion, tipo, descripcion, clave, ids: dict) -> int:
    return sesion.execute(text(
        "INSERT INTO evidencia (tipo_evidencia, descripcion, fecha_carga, uri_archivo, id_recepcion, id_dispositivo_evaluacion, "
        "nro_evaluacion, id_movimiento, id_cierre) OUTPUT INSERTED.id_evidencia "
        "VALUES (:t, :d, :f, :u, :r, :de, :ne, :m, :c)"),
        {"t": tipo, "d": descripcion, "f": datetime.now(), "u": clave, "r": ids.get("id_recepcion"),
         "de": ids.get("id_dispositivo_evaluacion"), "ne": ids.get("nro_evaluacion"),
         "m": ids.get("id_movimiento"), "c": ids.get("id_cierre")}).scalar()


_COLS = ("id_evidencia, tipo_evidencia, descripcion, fecha_carga, uri_archivo, id_recepcion, "
         "id_dispositivo_evaluacion, nro_evaluacion, id_movimiento, id_cierre")


def obtener(sesion, id_evidencia: int):
    r = sesion.execute(text(f"SELECT {_COLS} FROM evidencia WHERE id_evidencia = :i"), {"i": id_evidencia}).mappings().first()
    return dict(r) if r else None


def listar_por_objetivo(sesion, ids: dict):
    filtros = {k: v for k, v in ids.items() if v is not None}
    where = " AND ".join(f"{k} = :{k}" for k in filtros)          # nombres de columna fijos (vienen del codigo)
    filas = sesion.execute(text(f"SELECT {_COLS} FROM evidencia WHERE {where} ORDER BY id_evidencia"), filtros).mappings().all()
    return [dict(f) for f in filas]
