"""SQL de movimientos. Los hints WITH (...) son fijos. Sin decisiones de negocio."""
from datetime import datetime

from sqlalchemy import bindparam, text

_BASE = ("SELECT m.id_movimiento, m.codigo_movimiento, m.tipo_movimiento, m.estado_movimiento, m.fecha_despacho, "
         "m.fecha_recepcion, m.id_conexion, m.id_usuario, c.id_centro_origen, c.id_centro_destino, c.unidad_capacidad, "
         "co.id_organizacion AS org_origen, cd.id_organizacion AS org_destino ")


def conexion_para_programar(sesion, id_conexion: int):
    """Bloquea la conexion: dos programaciones simultaneas sobre ella se atienden una tras otra (RN-05)."""
    r = sesion.execute(text(
        "SELECT c.id_conexion, c.id_centro_origen, c.id_centro_destino, c.capacidad_por_periodo, c.unidad_capacidad, c.activa, "
        "co.id_organizacion AS org_origen, cd.id_organizacion AS org_destino, cd.tipo_centro AS tipo_destino "
        "FROM conexion_logistica c WITH (UPDLOCK, HOLDLOCK) "
        "JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
        "WHERE c.id_conexion = :i"), {"i": id_conexion}).mappings().first()
    return dict(r) if r else None


def comprometido(sesion, id_conexion: int, unidad: str, desde, hasta):
    suma = ("COALESCE(SUM(CASE WHEN dg.id_dispositivo IS NOT NULL THEN dg.cantidad_unidades ELSE 1 END), 0)" if unidad == "UND"
            else "COALESCE(SUM(COALESCE(md.peso_despachado_kg, dg.peso_kg)), 0)")
    return sesion.execute(text(
        f"SELECT {suma} FROM movimiento m JOIN movimiento_dispositivo md ON md.id_movimiento = m.id_movimiento "
        "LEFT JOIN dispositivo_granel dg ON dg.id_dispositivo = md.id_dispositivo "
        "WHERE m.id_conexion = :c AND m.estado_movimiento IN ('PROGRAMADO','AUTORIZADO','EN_TRANSITO','CERRADO') "
        "AND CAST(m.fecha_despacho AS DATE) BETWEEN :d AND :h"), {"c": id_conexion, "d": desde, "h": hasta}).scalar()


def info_dispositivos(sesion, ids):
    q = text(
        "SELECT d.id_dispositivo, d.tipo_registro, dg.cantidad_unidades, dg.peso_kg, "
        "(SELECT TOP 1 h.estado_nuevo FROM historial_estado h WHERE h.id_dispositivo = d.id_dispositivo ORDER BY h.nro_cambio DESC) AS estado, "
        "(SELECT TOP 1 i.id_centro FROM inventario i WHERE i.id_dispositivo = d.id_dispositivo AND i.fecha_salida IS NULL) AS id_centro "
        "FROM dispositivo d WITH (UPDLOCK, HOLDLOCK) LEFT JOIN dispositivo_granel dg ON dg.id_dispositivo = d.id_dispositivo "
        "WHERE d.id_dispositivo IN :ids").bindparams(bindparam("ids", expanding=True))
    return {r["id_dispositivo"]: dict(r) for r in sesion.execute(q, {"ids": list(ids)}).mappings()}


def en_movimiento_activo(sesion, ids):
    q = text("SELECT DISTINCT md.id_dispositivo FROM movimiento_dispositivo md JOIN movimiento m ON m.id_movimiento = md.id_movimiento "
             "WHERE md.id_dispositivo IN :ids AND m.estado_movimiento IN ('PROGRAMADO','AUTORIZADO','EN_TRANSITO')"
             ).bindparams(bindparam("ids", expanding=True))
    return {r[0] for r in sesion.execute(q, {"ids": list(ids)})}


def ultima_clasificacion(sesion, id_dispositivo: int):
    r = sesion.execute(text(
        "SELECT TOP 1 c.nombre_clasificacion, c.permite_asignacion FROM evaluacion_tecnica e "
        "JOIN clasificacion c ON c.id_clasificacion = e.id_clasificacion "
        "WHERE e.id_dispositivo = :d ORDER BY e.nro_evaluacion DESC"), {"d": id_dispositivo}).mappings().first()
    return dict(r) if r else None


def crear(sesion, codigo, tipo, fecha_despacho, id_conexion, id_usuario) -> int:
    return sesion.execute(text(
        "INSERT INTO movimiento (codigo_movimiento, tipo_movimiento, fecha_despacho, id_conexion, id_usuario) "
        "OUTPUT INSERTED.id_movimiento VALUES (:c, :t, :f, :k, :u)"),
        {"c": codigo, "t": tipo, "f": fecha_despacho, "k": id_conexion, "u": id_usuario}).scalar()


def agregar_items(sesion, id_movimiento: int, items) -> None:
    sesion.execute(text("INSERT INTO movimiento_dispositivo (id_movimiento, id_dispositivo, peso_despachado_kg) VALUES (:m, :d, :p)"),
                   [{"m": id_movimiento, "d": i["id_dispositivo"], "p": i.get("peso_despachado_kg")} for i in items])


def obtener(sesion, id_movimiento: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = sesion.execute(text(
        _BASE + f"FROM movimiento m {hint} JOIN conexion_logistica c ON c.id_conexion = m.id_conexion "
        "JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
        "WHERE m.id_movimiento = :i"), {"i": id_movimiento}).mappings().first()
    return dict(r) if r else None


def obtener_por_codigo(sesion, codigo: str):
    r = sesion.execute(text("SELECT id_movimiento FROM movimiento WHERE codigo_movimiento = :c"), {"c": codigo}).scalar()
    return r


def bloquear_clave(sesion, codigo: str) -> None:
    """Serializa reintentos de una misma clave, incluso sobre conexiones diferentes."""
    resultado = sesion.execute(text(
        "DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource=:k, "
        "@LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; SELECT @r;"
    ), {"k": "ecoraee:" + codigo}).scalar()
    if resultado < 0:
        from ..domain.errors import ConflictoError
        raise ConflictoError("Hay otra solicitud con esta clave en curso; reintenta")


def huella_solicitud(sesion, id_movimiento: int):
    return sesion.execute(text(
        "SELECT TOP 1 JSON_VALUE(valor_nuevo, '$.huella_solicitud') FROM auditoria_cambio "
        "WHERE tabla_afectada='movimiento' AND operacion='INSERT' AND clave_registro=:i "
        "ORDER BY id_auditoria DESC"), {"i": str(id_movimiento)}).scalar()


def items(sesion, id_movimiento: int):
    return [dict(r) for r in sesion.execute(text(
        "SELECT id_dispositivo, peso_despachado_kg, conforme FROM movimiento_dispositivo "
        "WHERE id_movimiento = :m ORDER BY id_dispositivo"), {"m": id_movimiento}).mappings()]


def cambiar_estado(sesion, id_movimiento: int, nuevo: str, fecha_recepcion=None) -> None:
    sesion.execute(text("UPDATE movimiento SET estado_movimiento = :e, "
                        "fecha_recepcion = COALESCE(:f, fecha_recepcion) WHERE id_movimiento = :i"),
                   {"e": nuevo, "f": fecha_recepcion, "i": id_movimiento})


def marcar_conforme(sesion, id_movimiento: int, id_dispositivo: int, conforme: bool) -> None:
    sesion.execute(text("UPDATE movimiento_dispositivo SET conforme = :c WHERE id_movimiento = :m AND id_dispositivo = :d"),
                   {"c": 1 if conforme else 0, "m": id_movimiento, "d": id_dispositivo})


def contar_guias(sesion, id_movimiento: int) -> int:
    return sesion.execute(text("SELECT COUNT(*) FROM evidencia WHERE id_movimiento = :m AND tipo_evidencia = 'GUIA_TRASLADO'"),
                          {"m": id_movimiento}).scalar()


def cerrar_estancia(sesion, id_dispositivo: int, id_centro: int) -> int:
    """UPDATE condicional: solo cierra si la estancia sigue abierta en ese centro. Devuelve filas afectadas."""
    return sesion.execute(text(
        "UPDATE inventario SET fecha_salida = :f WHERE id_dispositivo = :d AND id_centro = :c AND fecha_salida IS NULL"),
        {"f": datetime.now(), "d": id_dispositivo, "c": id_centro}).rowcount


def estado_antes_de_transito(sesion, id_dispositivo: int):
    return sesion.execute(text(
        "SELECT TOP 1 estado_anterior FROM historial_estado WHERE id_dispositivo = :d AND estado_nuevo = 'EN_TRANSITO' "
        "ORDER BY nro_cambio DESC"), {"d": id_dispositivo}).scalar()


def listar_visibles(sesion, id_org: int, estado, offset: int, limite: int):
    filtro = " AND m.estado_movimiento = :estado" if estado else ""
    base = ("FROM movimiento m JOIN conexion_logistica c ON c.id_conexion = m.id_conexion "
            "JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
            f"WHERE (co.id_organizacion = :org OR cd.id_organizacion = :org){filtro}")
    p = {"org": id_org, "estado": estado, "off": offset, "n": limite}
    total = sesion.execute(text(f"SELECT COUNT(*) {base}"), p).scalar()
    filas = sesion.execute(text(_BASE + base + " ORDER BY m.id_movimiento DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]
