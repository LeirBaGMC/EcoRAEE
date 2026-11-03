"""SQL de red logistica (organizaciones, centros, conexiones) y de escenarios y ejecuciones de flujo."""
from datetime import datetime

from sqlalchemy import bindparam, text


# ---------- organizaciones, centros, conexiones ----------
def crear_organizacion(s, ruc, nombre, tipo_persona, ciudad, tipos_actor) -> int:
    id_org = s.execute(text("INSERT INTO organizacion (ruc, nombre, tipo_persona, ciudad) OUTPUT INSERTED.id_organizacion VALUES (:r, :n, :t, :c)"),
                       {"r": ruc, "n": nombre, "t": tipo_persona, "c": ciudad}).scalar()
    for t in tipos_actor:
        s.execute(text("INSERT INTO organizacion_tipo_actor (id_organizacion, tipo_actor) VALUES (:o, :t)"), {"o": id_org, "t": t})
    return id_org


def listar_organizaciones(s, offset, limite, tipo_actor=None):
    filtro = " WHERE EXISTS (SELECT 1 FROM organizacion_tipo_actor a WHERE a.id_organizacion = o.id_organizacion AND a.tipo_actor = :ta)" if tipo_actor else ""
    p = {"off": offset, "n": limite, "ta": tipo_actor}
    total = s.execute(text(f"SELECT COUNT(*) FROM organizacion o{filtro}"), p).scalar()
    filas = s.execute(text(f"SELECT o.id_organizacion, o.ruc, o.nombre, o.tipo_persona, o.ciudad FROM organizacion o{filtro} "
                           "ORDER BY o.nombre, o.ruc, o.id_organizacion OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]


def organizacion_existe(s, id_org) -> bool:
    return s.execute(text("SELECT 1 FROM organizacion WHERE id_organizacion = :o"), {"o": id_org}).first() is not None


def crear_centro(s, codigo, nombre, tipo, ciudad, capacidad, id_org) -> int:
    return s.execute(text("INSERT INTO centro (codigo_centro, nombre, tipo_centro, ciudad, capacidad_almacenamiento, id_organizacion) "
                          "OUTPUT INSERTED.id_centro VALUES (:c, :n, :t, :ci, :cap, :o)"),
                     {"c": codigo, "n": nombre, "t": tipo, "ci": ciudad, "cap": capacidad, "o": id_org}).scalar()


def listar_centros(s, id_org, todos: bool):
    filtro = "" if todos else "WHERE id_organizacion = :o"
    filas = s.execute(text(f"SELECT id_centro, codigo_centro, nombre, tipo_centro, ciudad, capacidad_almacenamiento, id_organizacion "
                           f"FROM centro {filtro} ORDER BY nombre, id_centro"), {"o": id_org}).mappings().all()
    return [dict(f) for f in filas]


def crear_conexion(s, origen, destino, capacidad, unidad) -> int:
    return s.execute(text("INSERT INTO conexion_logistica (id_centro_origen, id_centro_destino, capacidad_por_periodo, unidad_capacidad) "
                          "OUTPUT INSERTED.id_conexion VALUES (:o, :d, :c, :u)"),
                     {"o": origen, "d": destino, "c": capacidad, "u": unidad}).scalar()


def actualizar_capacidad_conexion(s, id_conexion: int, capacidad) -> None:
    s.execute(text("UPDATE conexion_logistica SET capacidad_por_periodo = :cap WHERE id_conexion = :i"),
              {"cap": capacidad, "i": id_conexion})


def centros_existen(s, ids) -> set:
    q = text("SELECT id_centro FROM centro WHERE id_centro IN :ids").bindparams(bindparam("ids", expanding=True))
    return {r[0] for r in s.execute(q, {"ids": list(ids)})}


def listar_conexiones(s, id_org, todos: bool, activas_unidad=None):
    f, p = [], {"o": id_org}
    if not todos:
        f.append("(co.id_organizacion = :o OR cd.id_organizacion = :o)")
    if activas_unidad:
        f.append("c.activa = 1 AND c.unidad_capacidad = :u"); p["u"] = activas_unidad
    donde = ("WHERE " + " AND ".join(f)) if f else ""
    filas = s.execute(text(
        "SELECT c.id_conexion, c.id_centro_origen, c.id_centro_destino, c.capacidad_por_periodo, c.unidad_capacidad, c.activa "
        "FROM conexion_logistica c JOIN centro co ON co.id_centro = c.id_centro_origen JOIN centro cd ON cd.id_centro = c.id_centro_destino "
        f"{donde} ORDER BY co.nombre, cd.nombre, c.id_conexion"), p).mappings().all()
    return [dict(f) for f in filas]


def obtener_conexiones(s, ids):
    q = text("SELECT id_conexion, id_centro_origen, id_centro_destino, capacidad_por_periodo, unidad_capacidad, activa "
             "FROM conexion_logistica WHERE id_conexion IN :ids").bindparams(bindparam("ids", expanding=True))
    return {r["id_conexion"]: dict(r) for r in s.execute(q, {"ids": list(ids)}).mappings()}


def organizaciones_de_centros(s, ids) -> dict:
    q = text("SELECT id_centro, id_organizacion FROM centro WHERE id_centro IN :ids").bindparams(bindparam("ids", expanding=True))
    return {r[0]: r[1] for r in s.execute(q, {"ids": list(ids)})}


# ---------- escenarios ----------
def crear_escenario(s, codigo, nombre, inicio, fin, unidad) -> int:
    return s.execute(text("INSERT INTO escenario_red (codigo_escenario, nombre, fecha_inicio_periodo, fecha_fin_periodo, unidad_flujo) "
                          "OUTPUT INSERTED.id_escenario VALUES (:c, :n, :i, :f, :u)"),
                     {"c": codigo, "n": nombre, "i": inicio, "f": fin, "u": unidad}).scalar()


def agregar_nodos(s, id_esc, nodos) -> None:
    s.execute(text("INSERT INTO escenario_nodo (id_escenario, id_centro, rol_nodo, oferta, demanda) VALUES (:e, :c, :r, :o, :d)"),
              [{"e": id_esc, "c": n["id_centro"], "r": n["rol_nodo"], "o": n.get("oferta"), "d": n.get("demanda")} for n in nodos])


def agregar_conexiones(s, id_esc, conexiones) -> None:
    s.execute(text("INSERT INTO escenario_conexion (id_escenario, id_conexion, capacidad_escenario, habilitada) VALUES (:e, :c, :k, :h)"),
              [{"e": id_esc, "c": c["id_conexion"], "k": c["capacidad_escenario"], "h": 1 if c.get("habilitada", True) else 0} for c in conexiones])


def escenario_visible(s, id_esc, id_org, todos: bool = False, bloquear: bool = False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = s.execute(text(f"SELECT e.id_escenario, e.codigo_escenario, e.nombre, e.fecha_inicio_periodo, e.fecha_fin_periodo, e.unidad_flujo, "
                       f"e.estado_escenario FROM escenario_red e {hint} WHERE e.id_escenario = :e AND "
                       "(:todos = 1 OR EXISTS (SELECT 1 FROM escenario_nodo n JOIN centro c ON c.id_centro = n.id_centro "
                       "WHERE n.id_escenario = e.id_escenario AND c.id_organizacion = :o))"),
                  {"e": id_esc, "o": id_org, "todos": 1 if todos else 0}).mappings().first()
    return dict(r) if r else None


def listar_escenarios(s, id_org, todos: bool, offset, limite):
    base = ("FROM escenario_red e WHERE (:todos = 1 OR EXISTS (SELECT 1 FROM escenario_nodo n JOIN centro c ON c.id_centro = n.id_centro "
            "WHERE n.id_escenario = e.id_escenario AND c.id_organizacion = :o))")
    p = {"o": id_org, "todos": 1 if todos else 0, "off": offset, "n": limite}
    total = s.execute(text(f"SELECT COUNT(*) {base}"), p).scalar()
    filas = s.execute(text("SELECT e.id_escenario, e.codigo_escenario, e.nombre, e.fecha_inicio_periodo, e.fecha_fin_periodo, e.unidad_flujo, "
                           f"e.estado_escenario {base} ORDER BY e.id_escenario DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), p).mappings().all()
    return total, [dict(f) for f in filas]


def cambiar_estado_escenario(s, id_esc, estado) -> None:
    s.execute(text("UPDATE escenario_red SET estado_escenario = :e WHERE id_escenario = :i"), {"e": estado, "i": id_esc})


def nodos_de(s, id_esc):
    return [dict(r) for r in s.execute(text("SELECT id_centro, rol_nodo, oferta, demanda FROM escenario_nodo WHERE id_escenario = :e ORDER BY id_centro"),
                                       {"e": id_esc}).mappings()]


def conexiones_de(s, id_esc):
    return [dict(r) for r in s.execute(text(
        "SELECT ec.id_conexion, c.id_centro_origen, c.id_centro_destino, ec.capacidad_escenario, ec.habilitada "
        "FROM escenario_conexion ec JOIN conexion_logistica c ON c.id_conexion = ec.id_conexion "
        "WHERE ec.id_escenario = :e ORDER BY ec.id_conexion"), {"e": id_esc}).mappings()]


# ---------- ejecuciones ----------
def crear_ejecucion(s, id_esc, algoritmo, flujo_maximo) -> int:
    return s.execute(text("INSERT INTO ejecucion_flujo (fecha_hora_ejecucion, algoritmo, flujo_maximo, estado_ejecucion, id_escenario) "
                          "OUTPUT INSERTED.id_ejecucion VALUES (:f, :a, :m, 'COMPLETADA', :e)"),
                     {"f": datetime.now(), "a": algoritmo, "m": flujo_maximo, "e": id_esc}).scalar()


def guardar_resultados(s, id_ejecucion, filas) -> None:
    """nro_resultado=0: lo numera el trigger. Una fila por conexion."""
    for f in filas:
        s.execute(text("INSERT INTO resultado_flujo (id_ejecucion, nro_resultado, flujo_asignado, capacidad_considerada, en_corte_minimo, id_conexion) "
                       "VALUES (:e, 0, :f, :c, :k, :i)"),
                  {"e": id_ejecucion, "f": f["flujo"], "c": f["capacidad"], "k": 1 if f["en_corte_minimo"] else 0, "i": f["id_conexion"]})


def obtener_ejecucion(s, id_esc, id_ejecucion):
    r = s.execute(text("SELECT id_ejecucion, fecha_hora_ejecucion, algoritmo, flujo_maximo, estado_ejecucion, id_escenario "
                       "FROM ejecucion_flujo WHERE id_ejecucion = :i AND id_escenario = :e"), {"i": id_ejecucion, "e": id_esc}).mappings().first()
    return dict(r) if r else None


def resultados_de(s, id_ejecucion):
    return [dict(r) for r in s.execute(text(
        "SELECT r.id_conexion, c.id_centro_origen, c.id_centro_destino, r.flujo_asignado, r.capacidad_considerada, r.en_corte_minimo "
        "FROM resultado_flujo r JOIN conexion_logistica c ON c.id_conexion = r.id_conexion WHERE r.id_ejecucion = :i ORDER BY r.id_conexion"),
        {"i": id_ejecucion}).mappings()]


def listar_ejecuciones(s, id_esc):
    return [dict(r) for r in s.execute(text(
        "SELECT id_ejecucion, fecha_hora_ejecucion, algoritmo, flujo_maximo, estado_ejecucion, id_escenario "
        "FROM ejecucion_flujo WHERE id_escenario = :e ORDER BY id_ejecucion DESC"), {"e": id_esc}).mappings()]
