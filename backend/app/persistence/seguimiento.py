"""SQL de indicadores y alertas."""
from datetime import datetime

from sqlalchemy import text

_TOTAL = "SELECT COUNT(*) FROM dispositivo"


def asegurar_catalogo(s, catalogo) -> dict:
    ids = {}
    for codigo, nombre, desc, unidad in catalogo:
        i = s.execute(text("SELECT id_indicador FROM indicador WHERE codigo_indicador = :c"), {"c": codigo}).scalar()
        if i is None:
            i = s.execute(text("INSERT INTO indicador (codigo_indicador, nombre, descripcion, unidad_medida) OUTPUT INSERTED.id_indicador "
                               "VALUES (:c, :n, :d, :u)"), {"c": codigo, "n": nombre, "d": desc, "u": unidad}).scalar()
        ids[codigo] = i
    return ids


def conteos(s) -> dict:
    q = lambda sql: s.execute(text(sql)).scalar()          # noqa: E731  (SQL fijo, sin parametros del usuario)
    evaluados = q("SELECT COUNT(DISTINCT id_dispositivo) FROM evaluacion_tecnica")
    reutilizables = q("SELECT COUNT(*) FROM (SELECT e.id_dispositivo, (SELECT TOP 1 c.nombre_clasificacion FROM evaluacion_tecnica e2 "
                      "JOIN clasificacion c ON c.id_clasificacion = e2.id_clasificacion WHERE e2.id_dispositivo = e.id_dispositivo "
                      "ORDER BY e2.nro_evaluacion DESC) AS n FROM evaluacion_tecnica e GROUP BY e.id_dispositivo) t WHERE t.n = 'REUTILIZABLE'")
    return {"total": q(_TOTAL), "evaluados": evaluados, "reutilizables": reutilizables,
            "mov_cerrados": q("SELECT COUNT(*) FROM movimiento WHERE estado_movimiento = 'CERRADO'"),
            "cierres": q("SELECT COUNT(*) FROM cierre_trazabilidad"), "evidencias": q("SELECT COUNT(*) FROM evidencia")}


def guardar_medicion(s, id_indicador, fecha, valor) -> None:
    hay = s.execute(text("SELECT 1 FROM medicion_indicador WHERE id_indicador = :i AND fecha_corte = :f"), {"i": id_indicador, "f": fecha}).first()
    if hay:
        s.execute(text("UPDATE medicion_indicador SET valor = :v WHERE id_indicador = :i AND fecha_corte = :f"), {"v": valor, "i": id_indicador, "f": fecha})
    else:
        s.execute(text("INSERT INTO medicion_indicador (id_indicador, fecha_corte, valor) VALUES (:i, :f, :v)"), {"i": id_indicador, "f": fecha, "v": valor})


def ultimas_mediciones(s):
    return [dict(r) for r in s.execute(text(
        "SELECT i.codigo_indicador, i.nombre, i.descripcion, i.unidad_medida, m.fecha_corte, m.valor FROM indicador i "
        "LEFT JOIN medicion_indicador m ON m.id_indicador = i.id_indicador AND m.fecha_corte = "
        "(SELECT MAX(m2.fecha_corte) FROM medicion_indicador m2 WHERE m2.id_indicador = i.id_indicador) ORDER BY i.codigo_indicador")).mappings()]


def historial(s, codigo, limite=60):
    return [dict(r) for r in s.execute(text(
        "SELECT TOP (:n) m.fecha_corte, m.valor FROM medicion_indicador m JOIN indicador i ON i.id_indicador = m.id_indicador "
        "WHERE i.codigo_indicador = :c ORDER BY m.fecha_corte DESC"), {"c": codigo, "n": limite}).mappings()]


def indicador_existe(s, codigo) -> bool:
    return s.execute(text("SELECT 1 FROM indicador WHERE codigo_indicador = :c"), {"c": codigo}).first() is not None


# ---------- alertas ----------
def conexiones_activas(s, id_org, todos: bool):
    f = "" if todos else "AND (co.id_organizacion = :o OR cd.id_organizacion = :o)"
    return [dict(r) for r in s.execute(text(
        "SELECT c.id_conexion, c.capacidad_por_periodo, c.unidad_capacidad FROM conexion_logistica c "
        "JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
        f"WHERE c.activa = 1 {f}"), {"o": id_org}).mappings()]


def movimientos_en_transito(s, id_org, todos: bool):
    f = "" if todos else "AND (co.id_organizacion = :o OR cd.id_organizacion = :o)"
    return [dict(r) for r in s.execute(text(
        "SELECT m.id_movimiento, m.codigo_movimiento, m.id_conexion, m.fecha_despacho, "
        "(SELECT COUNT(*) FROM evidencia e WHERE e.id_movimiento = m.id_movimiento AND e.tipo_evidencia = 'GUIA_TRASLADO') AS guias "
        "FROM movimiento m JOIN conexion_logistica c ON c.id_conexion = m.id_conexion "
        "JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
        f"WHERE m.estado_movimiento = 'EN_TRANSITO' {f}"), {"o": id_org}).mappings()]


def dispositivos_recibidos_sin_evaluar(s, id_org, todos: bool):
    f = "" if todos else "AND c.id_organizacion = :o"
    return [dict(r) for r in s.execute(text(
        "SELECT e.id_dispositivo, e.codigo_trazabilidad, e.fecha_estado FROM v_dispositivo_estado_actual e "
        "JOIN v_dispositivo_ubicacion_actual u ON u.id_dispositivo = e.id_dispositivo JOIN centro c ON c.id_centro = u.id_centro "
        f"WHERE e.estado_actual = 'RECIBIDO' {f}"), {"o": id_org}).mappings()]


def existe_abierta(s, tipo, mensaje) -> bool:
    return s.execute(text("SELECT 1 FROM alerta WHERE tipo_alerta = :t AND mensaje = :m AND fecha_atencion IS NULL"),
                     {"t": tipo, "m": mensaje}).first() is not None


def crear(s, tipo, severidad, mensaje, id_centro=None, id_conexion=None, id_dispositivo=None) -> int:
    return s.execute(text(
        "INSERT INTO alerta (tipo_alerta, severidad, mensaje, fecha_generacion, id_centro, id_conexion, id_dispositivo) "
        "OUTPUT INSERTED.id_alerta VALUES (:t, :s, :m, :f, :c, :x, :d)"),
        {"t": tipo, "s": severidad, "m": mensaje[:255], "f": datetime.now(), "c": id_centro, "x": id_conexion, "d": id_dispositivo}).scalar()


_VISIBLE = ("(:todos = 1 OR a.id_centro IN (SELECT id_centro FROM centro WHERE id_organizacion = :o) "
            "OR a.id_conexion IN (SELECT c.id_conexion FROM conexion_logistica c JOIN centro co ON co.id_centro = c.id_centro_origen "
            "JOIN centro cd ON cd.id_centro = c.id_centro_destino WHERE co.id_organizacion = :o OR cd.id_organizacion = :o) "
            "OR a.id_dispositivo IN (SELECT d.id_dispositivo FROM dispositivo d WHERE d.id_organizacion = :o "
            "UNION SELECT i.id_dispositivo FROM inventario i JOIN centro c ON c.id_centro = i.id_centro WHERE c.id_organizacion = :o))")


def listar(s, id_org, todos: bool, solo_abiertas: bool, offset, limite):
    extra = " AND a.fecha_atencion IS NULL" if solo_abiertas else ""
    p = {"o": id_org, "todos": 1 if todos else 0, "off": offset, "n": limite}
    total = s.execute(text(f"SELECT COUNT(*) FROM alerta a WHERE {_VISIBLE}{extra}"), p).scalar()
    filas = s.execute(text("SELECT a.id_alerta, a.tipo_alerta, a.severidad, a.mensaje, a.fecha_generacion, a.fecha_atencion, "
                           "a.id_centro, a.id_conexion, a.id_dispositivo FROM alerta a "
                           f"WHERE {_VISIBLE}{extra} ORDER BY a.id_alerta DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]


def obtener_visible(s, id_alerta, id_org, todos: bool):
    r = s.execute(text(f"SELECT a.id_alerta, a.fecha_atencion FROM alerta a WITH (UPDLOCK) WHERE a.id_alerta = :i AND {_VISIBLE}"),
                  {"i": id_alerta, "o": id_org, "todos": 1 if todos else 0}).mappings().first()
    return dict(r) if r else None


def atender(s, id_alerta) -> None:
    s.execute(text("UPDATE alerta SET fecha_atencion = :f WHERE id_alerta = :i"), {"f": datetime.now(), "i": id_alerta})
