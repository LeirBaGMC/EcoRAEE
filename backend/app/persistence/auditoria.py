import json
from datetime import datetime

from sqlalchemy import bindparam, text


def registrar(sesion, tabla: str, operacion: str, clave: str, anterior, nuevo, id_usuario: int) -> None:
    """Historial de negocio (no es un log tecnico). Nunca incluyas credenciales en anterior/nuevo."""
    sesion.execute(text(
        "INSERT INTO auditoria_cambio (tabla_afectada, operacion, clave_registro, valor_anterior, valor_nuevo, fecha_hora, id_usuario) "
        "VALUES (:t, :o, :c, :a, :n, :f, :u)"),
        {"t": tabla, "o": operacion, "c": str(clave),
         "a": json.dumps(anterior, default=str) if anterior is not None else None,
         "n": json.dumps(nuevo, default=str) if nuevo is not None else None,
         "f": datetime.now(), "u": id_usuario})


def listar(sesion, tabla, clave, offset: int, limite: int):
    filtros, params = [], {"off": offset, "n": limite}
    if tabla:
        filtros.append("tabla_afectada = :t"); params["t"] = tabla
    if clave:
        filtros.append("clave_registro = :c"); params["c"] = clave
    donde = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    total = sesion.execute(text(f"SELECT COUNT(*) FROM auditoria_cambio {donde}"), params).scalar()
    filas = sesion.execute(text(
        f"SELECT id_auditoria, tabla_afectada, operacion, clave_registro, valor_anterior, valor_nuevo, fecha_hora, id_usuario "
        f"FROM auditoria_cambio {donde} ORDER BY id_auditoria DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY"), params).mappings().all()
    return total, [dict(f) for f in filas]
