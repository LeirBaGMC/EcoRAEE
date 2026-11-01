"""SQL de lotes, solicitudes y recepciones. Sin decisiones de negocio ni HTTP."""
from datetime import datetime

from sqlalchemy import bindparam, text


def dispositivos_aptos_para_lote(sesion, ids, id_org):
    """Del listado, devuelve los que son de la organizacion, estan REGISTRADO y no estan en otro lote.
    UPDLOCK + HOLDLOCK: dos lotes simultaneos no pueden tomar el mismo dispositivo."""
    q = text(
        "SELECT d.id_dispositivo FROM dispositivo d WITH (UPDLOCK, HOLDLOCK) "
        "WHERE d.id_dispositivo IN :ids AND d.id_organizacion = :org "
        "AND NOT EXISTS (SELECT 1 FROM lote_dispositivo ld WHERE ld.id_dispositivo = d.id_dispositivo) "
        "AND (SELECT TOP 1 h.estado_nuevo FROM historial_estado h WHERE h.id_dispositivo = d.id_dispositivo "
        "     ORDER BY h.nro_cambio DESC) = 'REGISTRADO'").bindparams(bindparam("ids", expanding=True))
    return {r[0] for r in sesion.execute(q, {"ids": list(ids), "org": id_org})}


def crear_lote(sesion, codigo: str, id_org: int) -> int:
    return sesion.execute(text(
        "INSERT INTO lote (codigo_lote, id_organizacion) OUTPUT INSERTED.id_lote VALUES (:c, :o)"),
        {"c": codigo, "o": id_org}).scalar()


def agregar_dispositivos(sesion, id_lote: int, ids) -> None:
    sesion.execute(text("INSERT INTO lote_dispositivo (id_lote, id_dispositivo) VALUES (:l, :d)"),
                   [{"l": id_lote, "d": i} for i in ids])


def obtener_lote(sesion, id_lote: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = sesion.execute(text(
        f"SELECT id_lote, codigo_lote, estado_lote, id_organizacion FROM lote {hint} WHERE id_lote = :i"),
        {"i": id_lote}).mappings().first()
    return dict(r) if r else None


def cambiar_estado_lote(sesion, id_lote: int, nuevo: str) -> None:
    sesion.execute(text("UPDATE lote SET estado_lote = :e WHERE id_lote = :i"), {"e": nuevo, "i": id_lote})


def dispositivos_de_lote(sesion, id_lote: int):
    return [r[0] for r in sesion.execute(text(
        "SELECT id_dispositivo FROM lote_dispositivo WHERE id_lote = :l ORDER BY id_dispositivo"), {"l": id_lote})]


def lote_tiene_solicitud(sesion, id_lote: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM solicitud_recoleccion WHERE id_lote = :l"), {"l": id_lote}).first() is not None


def crear_solicitud(sesion, codigo: str, modalidad: str, zona: str, id_lote: int) -> int:
    return sesion.execute(text(
        "INSERT INTO solicitud_recoleccion (codigo_solicitud, modalidad, zona_referencial, id_lote) "
        "OUTPUT INSERTED.id_solicitud VALUES (:c, :m, :z, :l)"),
        {"c": codigo, "m": modalidad, "z": zona, "l": id_lote}).scalar()


def obtener_solicitud(sesion, id_solicitud: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = sesion.execute(text(
        f"SELECT id_solicitud, codigo_solicitud, modalidad, estado_solicitud, id_lote "
        f"FROM solicitud_recoleccion {hint} WHERE id_solicitud = :i"), {"i": id_solicitud}).mappings().first()
    return dict(r) if r else None


def cambiar_estado_solicitud(sesion, id_solicitud: int, nuevo: str) -> None:
    sesion.execute(text("UPDATE solicitud_recoleccion SET estado_solicitud = :e WHERE id_solicitud = :i"),
                   {"e": nuevo, "i": id_solicitud})


def centro_pertenece(sesion, id_centro: int, id_org: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM centro WHERE id_centro = :c AND id_organizacion = :o"),
                          {"c": id_centro, "o": id_org}).first() is not None


def recepcion_existe(sesion, id_solicitud: int) -> bool:
    return sesion.execute(text("SELECT 1 FROM recepcion WHERE id_solicitud = :s"), {"s": id_solicitud}).first() is not None


def crear_recepcion(sesion, id_solicitud, id_centro, peso, unidades, conforme) -> int:
    return sesion.execute(text(
        "INSERT INTO recepcion (fecha_hora, peso_recibido_kg, unidades_recibidas, conforme, id_solicitud, id_centro) "
        "OUTPUT INSERTED.id_recepcion VALUES (:f, :p, :u, :c, :s, :ce)"),
        {"f": datetime.now(), "p": peso, "u": unidades, "c": 1 if conforme else 0, "s": id_solicitud, "ce": id_centro}).scalar()


def crear_recoleccion(sesion, id_solicitud: int, fecha_programada) -> int:
    return sesion.execute(text("INSERT INTO recoleccion (fecha_programada, id_solicitud) OUTPUT INSERTED.id_recoleccion VALUES (:f, :s)"),
                          {"f": fecha_programada, "s": id_solicitud}).scalar()


def obtener_recoleccion(sesion, id_solicitud: int):
    r = sesion.execute(text("SELECT id_recoleccion, fecha_programada, fecha_ejecucion FROM recoleccion WITH (UPDLOCK) WHERE id_solicitud = :s"),
                       {"s": id_solicitud}).mappings().first()
    return dict(r) if r else None


def ejecutar_recoleccion(sesion, id_recoleccion: int) -> None:
    sesion.execute(text("UPDATE recoleccion SET fecha_ejecucion = :f WHERE id_recoleccion = :i"),
                   {"f": datetime.now(), "i": id_recoleccion})


def listar_solicitudes(sesion, id_org, estado, offset: int, limite: int):
    """id_org=None: ve todas (operador o coordinador). Con id_org: solo las de lotes de esa organizacion."""
    f, p = [], {"off": offset, "n": limite}
    if id_org is not None:
        f.append("l.id_organizacion = :org"); p["org"] = id_org
    if estado:
        f.append("s.estado_solicitud = :estado"); p["estado"] = estado
    donde = ("WHERE " + " AND ".join(f)) if f else ""
    base = f"FROM solicitud_recoleccion s JOIN lote l ON l.id_lote = s.id_lote {donde}"
    total = sesion.execute(text(f"SELECT COUNT(*) {base}"), p).scalar()
    filas = sesion.execute(text(
        "SELECT s.id_solicitud, s.codigo_solicitud, s.modalidad, s.estado_solicitud, s.zona_referencial, s.fecha_solicitud, s.id_lote "
        f"{base} ORDER BY s.id_solicitud DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(x) for x in filas]
