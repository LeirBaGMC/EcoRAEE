from datetime import datetime

from sqlalchemy import insert

from .models import Dispositivo, DispositivoGranel, DispositivoIndividual, HistorialEstado


def crear(sesion, datos: dict) -> int:
    d = Dispositivo(**datos)
    sesion.add(d)
    sesion.flush()  # obtiene id_dispositivo
    return d.id_dispositivo


def crear_individual(sesion, id_dispositivo: int, numero_serie: str) -> None:
    sesion.add(DispositivoIndividual(id_dispositivo=id_dispositivo, tipo_registro="INDIVIDUAL", numero_serie=numero_serie))


def crear_granel(sesion, id_dispositivo: int, peso_kg, cantidad: int) -> None:
    sesion.add(DispositivoGranel(id_dispositivo=id_dispositivo, tipo_registro="GRANEL",
                                 peso_kg=peso_kg, cantidad_unidades=cantidad))


def agregar_historial(sesion, id_dispositivo, anterior, nuevo, id_usuario, observacion=None) -> None:
    """INSERT puro: nro_cambio=0 para que el trigger trg_historial_nro lo numere."""
    sesion.execute(insert(HistorialEstado).values(
        id_dispositivo=id_dispositivo, nro_cambio=0, estado_anterior=anterior, estado_nuevo=nuevo,
        fecha_hora=datetime.now(), observacion=observacion, id_usuario=id_usuario))


# ---- Lecturas y bloqueos (SQL Server). Los hints WITH (...) son fijos, nunca vienen del usuario. ----
from sqlalchemy import bindparam, text  # noqa: E402


def estado_actual(sesion, id_dispositivo: int, bloquear: bool = False):
    hint = "WITH (UPDLOCK, HOLDLOCK)" if bloquear else ""
    return sesion.execute(text(
        f"SELECT TOP 1 estado_nuevo FROM historial_estado {hint} WHERE id_dispositivo = :i ORDER BY nro_cambio DESC"),
        {"i": id_dispositivo}).scalar()


def ubicacion_actual(sesion, id_dispositivo: int):
    r = sesion.execute(text(
        "SELECT c.id_centro, c.nombre, c.id_organizacion FROM inventario i JOIN centro c ON c.id_centro = i.id_centro "
        "WHERE i.id_dispositivo = :i AND i.fecha_salida IS NULL"), {"i": id_dispositivo}).mappings().first()
    return dict(r) if r else None


_VISIBLE = ("(:todos = 1 OR d.id_organizacion = :org OR c.id_organizacion = :org)")
_FROM = ("FROM dispositivo d "
         "LEFT JOIN v_dispositivo_estado_actual e ON e.id_dispositivo = d.id_dispositivo "
         "LEFT JOIN v_dispositivo_ubicacion_actual u ON u.id_dispositivo = d.id_dispositivo "
         "LEFT JOIN centro c ON c.id_centro = u.id_centro ")


def obtener_visible(sesion, id_dispositivo: int, id_org: int, todos: bool = False):
    """Devuelve el dispositivo solo si es de la organizacion del usuario o esta en un centro de ella."""
    r = sesion.execute(text(
        "SELECT d.id_dispositivo, d.codigo_trazabilidad, d.tipo_registro, d.marca, d.modelo, d.condicion_declarada, "
        "d.fecha_registro, e.estado_actual, u.id_centro, u.nombre_centro " + _FROM +
        f"WHERE d.id_dispositivo = :id AND {_VISIBLE}"), {"id": id_dispositivo, "org": id_org, "todos": int(todos)}).mappings().first()
    return dict(r) if r else None


def listar_visibles(sesion, id_org: int, estado, offset: int, limite: int, todos: bool = False):
    filtro = " AND e.estado_actual = :estado" if estado else ""
    params = {"org": id_org, "estado": estado, "off": offset, "n": limite, "todos": int(todos)}
    total = sesion.execute(text(f"SELECT COUNT(*) {_FROM} WHERE {_VISIBLE}{filtro}"), params).scalar()
    filas = sesion.execute(text(
        "SELECT d.id_dispositivo, d.codigo_trazabilidad, d.tipo_registro, d.marca, d.modelo, d.condicion_declarada, "
        f"d.fecha_registro, e.estado_actual, u.id_centro, u.nombre_centro {_FROM} WHERE {_VISIBLE}{filtro} "
        "ORDER BY d.id_dispositivo DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), params).mappings().all()
    return total, [dict(f) for f in filas]


def historial(sesion, id_dispositivo: int):
    filas = sesion.execute(text(
        "SELECT nro_cambio, estado_anterior, estado_nuevo, fecha_hora, observacion, id_usuario "
        "FROM historial_estado WHERE id_dispositivo = :i ORDER BY nro_cambio"), {"i": id_dispositivo}).mappings().all()
    return [dict(f) for f in filas]
