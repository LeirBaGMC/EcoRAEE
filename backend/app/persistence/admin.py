from sqlalchemy import bindparam, text


def crear_usuario(s, correo, nombre_usuario, nombre_visible, hash_, id_org) -> int:
    return s.execute(text("INSERT INTO usuario (correo, nombre_usuario, nombre_visible, activo, credencial_hash, id_organizacion) "
                          "OUTPUT INSERTED.id_usuario VALUES (:c, :n, :v, 1, :h, :o)"),
                     {"c": correo, "n": nombre_usuario, "v": nombre_visible, "h": hash_, "o": id_org}).scalar()


def obtener_usuario(s, id_usuario, bloquear=False):
    hint = "WITH (UPDLOCK)" if bloquear else ""
    r = s.execute(text(f"SELECT id_usuario, correo, nombre_usuario, nombre_visible, activo, id_organizacion FROM usuario {hint} "
                       "WHERE id_usuario = :i"), {"i": id_usuario}).mappings().first()
    return dict(r) if r else None


def roles_de_usuarios(s, ids) -> dict:
    if not ids:
        return {}
    q = text("SELECT ur.id_usuario, r.nombre_rol FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol "
             "WHERE ur.id_usuario IN :ids ORDER BY r.nombre_rol").bindparams(bindparam("ids", expanding=True))
    out = {i: [] for i in ids}
    for uid, rol in s.execute(q, {"ids": list(ids)}):
        out[uid].append(rol)
    return out


def reemplazar_roles(s, id_usuario, roles) -> None:
    s.execute(text("DELETE FROM usuario_rol WHERE id_usuario = :u"), {"u": id_usuario})
    for r in roles:
        id_rol = s.execute(text("SELECT id_rol FROM rol WHERE nombre_rol = :r"), {"r": r}).scalar()
        s.execute(text("INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (:u, :r)"), {"u": id_usuario, "r": id_rol})


def cambiar_activo(s, id_usuario, activo: bool) -> None:
    s.execute(text("UPDATE usuario SET activo = :a WHERE id_usuario = :i"), {"a": 1 if activo else 0, "i": id_usuario})


def listar_usuarios(s, offset, limite):
    total = s.execute(text("SELECT COUNT(*) FROM usuario")).scalar()
    filas = [dict(r) for r in s.execute(text(
        "SELECT id_usuario, correo, nombre_usuario, nombre_visible, activo, id_organizacion FROM usuario "
        "ORDER BY nombre_visible, nombre_usuario, id_usuario OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), {"off": offset, "n": limite}).mappings()]
    roles = roles_de_usuarios(s, [f["id_usuario"] for f in filas])
    for f in filas:
        f["roles"] = roles.get(f["id_usuario"], [])
    return total, filas


def catalogos(s) -> dict:
    q = lambda sql: [dict(r) for r in s.execute(text(sql)).mappings()]   # noqa: E731  (SQL fijo)
    return {"clasificaciones": q("SELECT id_clasificacion, nombre_clasificacion, permite_asignacion FROM clasificacion ORDER BY nombre_clasificacion, id_clasificacion"),
            "categorias": q("SELECT id_categoria, nombre_categoria, descripcion FROM categoria_dispositivo ORDER BY nombre_categoria, id_categoria")}
