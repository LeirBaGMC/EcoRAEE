"""RN-01: todo dispositivo nace con identificador unico e historial. Una sola transaccion."""
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from ..db import transaccion
from ..domain import rules
from ..domain.dispositivo import generar_codigo, validar_datos
from ..domain.permisos import exigir_permiso
from ..domain.errors import ConflictoError
from ..persistence import dispositivos as repo
from ..security import Actor


def registrar_dispositivo(actor: Actor, datos: dict) -> dict:
    exigir_permiso(actor.roles, "dispositivo:registrar")
    validar_datos(datos["tipo_registro"], datos.get("numero_serie"), datos.get("peso_kg"), datos.get("cantidad_unidades"))
    rules.validar_transicion(None, "REGISTRADO")
    codigo = generar_codigo()  # lo decide el servidor, no el cliente
    try:
        with transaccion() as s:  # dispositivo + subtipo + historial: todo o nada
            id_disp = repo.crear(s, dict(
                codigo_trazabilidad=codigo, tipo_registro=datos["tipo_registro"], marca=datos.get("marca"),
                modelo=datos.get("modelo"), condicion_declarada=datos["condicion_declarada"],
                fecha_registro=datetime.now(), id_organizacion=actor.id_organizacion,
                id_categoria=datos["id_categoria"]))
            if datos["tipo_registro"] == "INDIVIDUAL":
                repo.crear_individual(s, id_disp, datos["numero_serie"])
            else:
                repo.crear_granel(s, id_disp, datos["peso_kg"], datos["cantidad_unidades"])
            repo.agregar_historial(s, id_disp, None, "REGISTRADO", actor.id_usuario, "Registro inicial")
    except IntegrityError as exc:
        # Capturar después del rollback también cubre dos altas concurrentes.
        # No confundir otras restricciones (categoría, código, etc.) con una serie duplicada.
        if 'uq_individual_serie' in str(exc.orig).lower():
            raise ConflictoError('Ya existe un dispositivo registrado con ese número de serie.') from exc
        raise
    return {"id_dispositivo": id_disp, "codigo_trazabilidad": codigo, "estado": "REGISTRADO"}
