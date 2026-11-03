"""Casos de uso: crear lote (RN-01) y crear solicitud de recoleccion."""
from ..db import transaccion
from ..domain import lote as dl
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import lotes as repo
from ..security import Actor
from . import estado_service


def crear_lote(actor: Actor, ids_dispositivos: list) -> dict:
    exigir_permiso(actor.roles, "lote:registrar")
    dl.validar_ids_lote(ids_dispositivos)
    with transaccion() as s:
        aptos = repo.dispositivos_aptos_para_lote(s, ids_dispositivos, actor.id_organizacion)
        if aptos != set(ids_dispositivos):
            # No se dice cual falla para no revelar dispositivos de otras organizaciones.
            raise ReglaNegocioError("Algunos dispositivos no existen, no son de tu organizacion, "
                                    "ya estan en otro lote o no estan en estado REGISTRADO")
        codigo = dl.generar_codigo_lote()
        id_lote = repo.crear_lote(s, codigo, actor.id_organizacion)
        repo.agregar_dispositivos(s, id_lote, sorted(ids_dispositivos))
    return {"id_lote": id_lote, "codigo_lote": codigo, "estado_lote": "REGISTRADO",
            "total_dispositivos": len(ids_dispositivos)}


def crear_solicitud(actor: Actor, id_lote: int, modalidad: str, zona_referencial: str) -> dict:
    exigir_permiso(actor.roles, "solicitud:crear")
    dl.validar_modalidad(modalidad)
    zona = (zona_referencial or "").strip()
    if not zona:
        raise ReglaNegocioError("La zona referencial es obligatoria (nunca la direccion exacta)")
    with transaccion() as s:
        lote = repo.obtener_lote(s, id_lote, bloquear=True)
        if lote is None or lote["id_organizacion"] != actor.id_organizacion:
            raise NoEncontradoError("Lote no encontrado")
        dl.validar_transicion_lote(lote["estado_lote"], "SOLICITADO")
        if repo.lote_tiene_solicitud(s, id_lote):
            raise ConflictoError("El lote ya tiene una solicitud")
        codigo = dl.generar_codigo_solicitud()
        id_solicitud = repo.crear_solicitud(s, codigo, modalidad, zona, id_lote)
        repo.cambiar_estado_lote(s, id_lote, "SOLICITADO")
        nuevo_estado = dl.estado_dispositivo_tras_solicitud(modalidad)
        if nuevo_estado:
            for id_disp in repo.dispositivos_de_lote(s, id_lote):
                estado_service.transicionar(s, id_disp, nuevo_estado, actor.id_usuario, f"Solicitud {codigo}")
    return {"id_solicitud": id_solicitud, "codigo_solicitud": codigo, "estado_solicitud": "PENDIENTE",
            "id_lote": id_lote}


# ---------------- recoleccion y consultas ----------------
from datetime import date, datetime, time  # noqa: E402

from ..domain.errors import PermisoDenegadoError  # noqa: E402


def programar_recoleccion(actor: Actor, id_solicitud: int, fecha_programada: date) -> dict:
    """PROPUESTA: la programa el coordinador logistico. Una solicitud no tiene centro, por eso no hay filtro por organizacion."""
    exigir_permiso(actor.roles, "recoleccion:programar")
    if fecha_programada < date.today():
        raise ReglaNegocioError("La fecha programada no puede estar en el pasado")
    with transaccion() as s:
        sol = repo.obtener_solicitud(s, id_solicitud, bloquear=True)
        if sol is None:
            raise NoEncontradoError("Solicitud no encontrada")
        if sol["modalidad"] != "RECOLECCION":
            raise ReglaNegocioError("Solo las solicitudes con modalidad RECOLECCION se programan")
        if sol["estado_solicitud"] != "PENDIENTE":
            raise ConflictoError(f"La solicitud esta {sol['estado_solicitud']}")
        id_rec = repo.crear_recoleccion(s, id_solicitud, datetime.combine(fecha_programada, time.min))
        repo.cambiar_estado_solicitud(s, id_solicitud, "PROGRAMADA")
    return {"id_recoleccion": id_rec, "id_solicitud": id_solicitud, "estado_solicitud": "PROGRAMADA",
            "fecha_programada": fecha_programada, "fecha_ejecucion": None}


def ejecutar_recoleccion(actor: Actor, id_solicitud: int) -> dict:
    exigir_permiso(actor.roles, "recoleccion:programar")
    with transaccion() as s:
        sol = repo.obtener_solicitud(s, id_solicitud, bloquear=True)
        if sol is None:
            raise NoEncontradoError("Solicitud no encontrada")
        rec = repo.obtener_recoleccion(s, id_solicitud)
        if rec is None or sol["estado_solicitud"] != "PROGRAMADA":
            raise ConflictoError("La solicitud no esta programada")
        if rec["fecha_ejecucion"] is not None:
            raise ConflictoError("La recoleccion ya se ejecuto")
        if datetime.now() < rec["fecha_programada"]:
            raise ReglaNegocioError("Todavia no llega la fecha programada")
        lote = repo.obtener_lote(s, sol["id_lote"], bloquear=True)
        dl.validar_transicion_lote(lote["estado_lote"], "RECOLECTADO")
        repo.ejecutar_recoleccion(s, rec["id_recoleccion"])
        repo.cambiar_estado_lote(s, sol["id_lote"], "RECOLECTADO")
    return {"id_recoleccion": rec["id_recoleccion"], "id_solicitud": id_solicitud, "estado_solicitud": "PROGRAMADA",
            "fecha_programada": rec["fecha_programada"].date(), "fecha_ejecucion": datetime.now().date()}


def _ve_todo(actor: Actor) -> bool:
    return bool({"OPERADOR_CENTRO", "COORDINADOR_LOGISTICO", "ADMINISTRADOR"} & set(actor.roles))


def obtener_lote(actor: Actor, id_lote: int) -> dict:
    exigir_permiso(actor.roles, "lote:ver")
    with transaccion() as s:
        lote = repo.obtener_lote(s, id_lote)
        if lote is None or (not _ve_todo(actor) and lote["id_organizacion"] != actor.id_organizacion):
            raise NoEncontradoError("Lote no encontrado")
        lote["dispositivos"] = repo.dispositivos_de_lote(s, id_lote)
        return lote


def listar_solicitudes(actor: Actor, pagina: int, tamano: int, estado=None) -> dict:
    exigir_permiso(actor.roles, "solicitud:ver")
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    with transaccion() as s:
        total, filas = repo.listar_solicitudes(s, None if _ve_todo(actor) else actor.id_organizacion, estado,
                                               (pagina - 1) * tamano, tamano)
    return {"items": filas, "total": total, "pagina": pagina, "tamano": tamano}
