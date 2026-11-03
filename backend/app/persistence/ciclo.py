"""SQL de tratamientos, asignaciones y cierres."""
from datetime import datetime

from sqlalchemy import text


def tratamiento_en_curso(sesion, id_dispositivo: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM tratamiento WHERE id_dispositivo = :d AND resultado = 'EN_CURSO'"),
                          {"d": id_dispositivo}).first() is not None


def crear_tratamiento(sesion, tipo: str, id_dispositivo: int) -> int:
    return sesion.execute(text("INSERT INTO tratamiento (tipo_tratamiento, id_dispositivo) OUTPUT INSERTED.id_tratamiento VALUES (:t, :d)"),
                          {"t": tipo, "d": id_dispositivo}).scalar()


def obtener_tratamiento(sesion, id_tratamiento: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = sesion.execute(text(
        "SELECT t.id_tratamiento, t.tipo_tratamiento, t.fecha_inicio, t.fecha_fin, t.resultado, t.id_dispositivo, "
        "d.codigo_trazabilidad, d.marca, d.modelo "
        f"FROM tratamiento t {hint} JOIN dispositivo d ON d.id_dispositivo = t.id_dispositivo "
        "WHERE t.id_tratamiento = :i"), {"i": id_tratamiento}).mappings().first()
    return dict(r) if r else None


def listar_tratamientos(sesion, id_org: int, offset: int, limite: int, todos: bool = False):
    base = ("FROM tratamiento t JOIN dispositivo d ON d.id_dispositivo = t.id_dispositivo "
            "LEFT JOIN v_dispositivo_ubicacion_actual u ON u.id_dispositivo = d.id_dispositivo "
            "LEFT JOIN centro c ON c.id_centro = u.id_centro "
            "WHERE (:todos = 1 OR d.id_organizacion = :org OR c.id_organizacion = :org)")
    p = {"org": id_org, "todos": int(todos), "off": offset, "n": limite}
    total = sesion.execute(text(f"SELECT COUNT(*) {base}"), p).scalar()
    filas = sesion.execute(text(
        "SELECT t.id_tratamiento, t.tipo_tratamiento, t.fecha_inicio, t.fecha_fin, t.resultado, t.id_dispositivo, "
        f"d.codigo_trazabilidad, d.marca, d.modelo {base} "
        "ORDER BY t.fecha_inicio DESC, t.id_tratamiento DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]


def finalizar_tratamiento(sesion, id_tratamiento: int, resultado: str) -> None:
    sesion.execute(text("UPDATE tratamiento SET resultado = :r, fecha_fin = :f WHERE id_tratamiento = :i"),
                   {"r": resultado, "f": datetime.now(), "i": id_tratamiento})


def organizacion_es_beneficiaria(sesion, id_org: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM organizacion_tipo_actor WHERE id_organizacion = :o AND tipo_actor = 'BENEFICIARIO'"),
                          {"o": id_org}).first() is not None


def asignacion_de_dispositivo(sesion, id_dispositivo: int):
    r = sesion.execute(text("SELECT id_asignacion FROM asignacion_beneficiario WHERE id_dispositivo = :d"),
                       {"d": id_dispositivo}).first()
    return r[0] if r else None


def crear_asignacion(sesion, id_dispositivo: int, id_org: int, finalidad: str) -> int:
    return sesion.execute(text("INSERT INTO asignacion_beneficiario (finalidad, id_dispositivo, id_organizacion) "
                               "OUTPUT INSERTED.id_asignacion VALUES (:f, :d, :o)"),
                          {"f": finalidad, "d": id_dispositivo, "o": id_org}).scalar()


def obtener_asignacion(sesion, id_asignacion: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = sesion.execute(text(f"SELECT id_asignacion, fecha_asignacion, fecha_entrega, finalidad, id_dispositivo, id_organizacion "
                            f"FROM asignacion_beneficiario {hint} WHERE id_asignacion = :i"), {"i": id_asignacion}).mappings().first()
    return dict(r) if r else None


def confirmar_entrega(sesion, id_asignacion: int) -> None:
    sesion.execute(text("UPDATE asignacion_beneficiario SET fecha_entrega = :f WHERE id_asignacion = :i"),
                   {"f": datetime.now(), "i": id_asignacion})


def listar_asignaciones(sesion, id_org: int, como_beneficiaria: bool, offset: int, limite: int, todos: bool = False):
    if todos:
        donde, join = "1=1", ""
    elif como_beneficiaria:
        donde, join = "a.id_organizacion = :org", ""
    else:
        join = ("LEFT JOIN v_dispositivo_ubicacion_actual u ON u.id_dispositivo = d.id_dispositivo "
                "LEFT JOIN centro c ON c.id_centro = u.id_centro ")
        donde = "(d.id_organizacion = :org OR c.id_organizacion = :org)"
    base = ("FROM asignacion_beneficiario a JOIN dispositivo d ON d.id_dispositivo = a.id_dispositivo "
            "JOIN organizacion o ON o.id_organizacion = a.id_organizacion "
            "LEFT JOIN dispositivo_individual di ON di.id_dispositivo = d.id_dispositivo "
            f"{join}WHERE {donde}")
    p = {"org": id_org, "off": offset, "n": limite}
    total = sesion.execute(text(f"SELECT COUNT(*) {base}"), p).scalar()
    filas = sesion.execute(text(
        "SELECT a.id_asignacion, a.fecha_asignacion, a.fecha_entrega, a.finalidad, a.id_dispositivo, a.id_organizacion, "
        "d.codigo_trazabilidad, d.marca, d.modelo, di.numero_serie, o.nombre AS nombre_organizacion, o.ruc AS ruc_organizacion "
        f"{base} ORDER BY a.fecha_asignacion DESC, a.id_asignacion DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]


def cierre_existe(sesion, id_dispositivo: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM cierre_trazabilidad WHERE id_dispositivo = :d"), {"d": id_dispositivo}).first() is not None


def crear_cierre(sesion, fecha, id_dispositivo, id_tratamiento, id_asignacion) -> int:
    return sesion.execute(text(
        "INSERT INTO cierre_trazabilidad (fecha_confirmacion, id_dispositivo, id_tratamiento, id_asignacion) "
        "OUTPUT INSERTED.id_cierre VALUES (:f, :d, :t, :a)"),
        {"f": fecha, "d": id_dispositivo, "t": id_tratamiento, "a": id_asignacion}).scalar()


def obtener_cierre(sesion, id_cierre: int):
    r = sesion.execute(text("SELECT id_cierre, fecha_confirmacion, id_dispositivo, id_tratamiento, id_asignacion, destino_final "
                            "FROM cierre_trazabilidad WHERE id_cierre = :i"), {"i": id_cierre}).mappings().first()
    return dict(r) if r else None


def cierre_de_dispositivo(sesion, id_dispositivo: int):
    r = sesion.execute(text("SELECT id_cierre, fecha_confirmacion, id_dispositivo, id_tratamiento, id_asignacion, destino_final "
                            "FROM cierre_trazabilidad WHERE id_dispositivo = :i"), {"i": id_dispositivo}).mappings().first()
    return dict(r) if r else None


def cerrar_estancia_abierta(sesion, id_dispositivo: int) -> None:
    sesion.execute(text("UPDATE inventario SET fecha_salida = :f WHERE id_dispositivo = :d AND fecha_salida IS NULL"),
                   {"f": datetime.now(), "d": id_dispositivo})


def cerrar_lotes_completos(sesion, id_dispositivo: int) -> list:
    """Cierra los lotes del dispositivo cuando todos sus dispositivos ya estan CERRADO."""
    cerrados = []
    for (id_lote,) in sesion.execute(text("SELECT id_lote FROM lote_dispositivo WHERE id_dispositivo = :d"), {"d": id_dispositivo}).all():
        pendientes = sesion.execute(text(
            "SELECT COUNT(*) FROM lote_dispositivo ld WHERE ld.id_lote = :l AND "
            "(SELECT TOP 1 h.estado_nuevo FROM historial_estado h WHERE h.id_dispositivo = ld.id_dispositivo ORDER BY h.nro_cambio DESC) <> 'CERRADO'"),
            {"l": id_lote}).scalar()
        if pendientes == 0:
            sesion.execute(text("UPDATE lote SET estado_lote = 'CERRADO' WHERE id_lote = :l AND estado_lote = 'RECIBIDO'"), {"l": id_lote})
            cerrados.append(id_lote)
    return cerrados
