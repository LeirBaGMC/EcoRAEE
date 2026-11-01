"""Casos de uso: tratamiento, asignacion a beneficiarios y cierre de trazabilidad."""
from datetime import date
from typing import Optional

from sqlalchemy.exc import IntegrityError

from ..db import transaccion
from ..domain import ciclo as dc
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import auditoria, ciclo as repo
from ..persistence import dispositivos as repo_d
from ..persistence import movimientos as repo_m
from ..security import Actor
from . import estado_service


def _dispositivo_en_mi_centro(s, actor: Actor, id_dispositivo: int) -> dict:
    ubic = repo_d.ubicacion_actual(s, id_dispositivo)
    if ubic is None or ubic["id_organizacion"] != actor.id_organizacion:
        raise NoEncontradoError("Dispositivo no encontrado")
    return ubic


def _dispositivo_visible(s, actor: Actor, id_dispositivo: int) -> dict:
    d = repo_d.obtener_visible(s, id_dispositivo, actor.id_organizacion)
    if d is None:
        raise NoEncontradoError("Dispositivo no encontrado")
    return d


# ---------------- tratamiento ----------------
def iniciar_tratamiento(actor: Actor, id_dispositivo: int, tipo: str) -> dict:
    exigir_permiso(actor.roles, "tratamiento:registrar")
    with transaccion() as s:
        _dispositivo_en_mi_centro(s, actor, id_dispositivo)
        estado = repo_d.estado_actual(s, id_dispositivo, bloquear=True)
        clasif = repo_m.ultima_clasificacion(s, id_dispositivo)
        dc.validar_inicio_tratamiento(tipo, clasif["nombre_clasificacion"] if clasif else None, estado)
        if repo.tratamiento_en_curso(s, id_dispositivo):
            raise ConflictoError("El dispositivo ya tiene un tratamiento en curso")
        id_t = repo.crear_tratamiento(s, tipo, id_dispositivo)
        if dc.inicio_cambia_estado(estado):
            estado_service.transicionar(s, id_dispositivo, "EN_TRATAMIENTO", actor.id_usuario, f"Tratamiento {id_t}")
        auditoria.registrar(s, "tratamiento", "INSERT", id_t, None, {"tipo": tipo, "dispositivo": id_dispositivo}, actor.id_usuario)
    return {"id_tratamiento": id_t, "id_dispositivo": id_dispositivo, "tipo_tratamiento": tipo, "resultado": "EN_CURSO"}


def finalizar_tratamiento(actor: Actor, id_tratamiento: int, resultado: str) -> dict:
    exigir_permiso(actor.roles, "tratamiento:registrar")
    dc.validar_resultado_final(resultado)
    with transaccion() as s:
        t = repo.obtener_tratamiento(s, id_tratamiento, bloquear=True)
        if t is None:
            raise NoEncontradoError("Tratamiento no encontrado")
        _dispositivo_en_mi_centro(s, actor, t["id_dispositivo"])
        if t["resultado"] != "EN_CURSO":
            raise ConflictoError("El tratamiento ya estaba finalizado")
        repo.finalizar_tratamiento(s, id_tratamiento, resultado)
        nuevo = dc.estado_tras_tratamiento(t["tipo_tratamiento"], resultado)
        if nuevo:
            estado_service.transicionar(s, t["id_dispositivo"], nuevo, actor.id_usuario, f"Tratamiento {id_tratamiento} {resultado}")
        auditoria.registrar(s, "tratamiento", "UPDATE", id_tratamiento, {"resultado": "EN_CURSO"}, {"resultado": resultado}, actor.id_usuario)
    return {"id_tratamiento": id_tratamiento, "id_dispositivo": t["id_dispositivo"],
            "tipo_tratamiento": t["tipo_tratamiento"], "resultado": resultado}


def obtener_tratamiento(actor: Actor, id_tratamiento: int) -> dict:
    exigir_permiso(actor.roles, "tratamiento:ver")
    with transaccion() as s:
        t = repo.obtener_tratamiento(s, id_tratamiento)
        if t is None:
            raise NoEncontradoError("Tratamiento no encontrado")
        _dispositivo_visible(s, actor, t["id_dispositivo"])
        return t


# ---------------- asignacion ----------------
def crear_asignacion(actor: Actor, id_dispositivo: int, id_org_beneficiaria: int, finalidad: str) -> dict:
    exigir_permiso(actor.roles, "asignacion:crear")
    finalidad = (finalidad or "").strip()
    if not finalidad:
        raise ReglaNegocioError("La finalidad es obligatoria")
    with transaccion() as s:
        _dispositivo_visible(s, actor, id_dispositivo)
        if not repo.organizacion_es_beneficiaria(s, id_org_beneficiaria):
            raise ReglaNegocioError("La organizacion indicada no es una entidad beneficiaria")
        estado = repo_d.estado_actual(s, id_dispositivo, bloquear=True)
        clasif = repo_m.ultima_clasificacion(s, id_dispositivo)
        dc.validar_asignable(estado, clasif["nombre_clasificacion"] if clasif else None,
                             bool(clasif["permite_asignacion"]) if clasif else False)       # RN-04
        if repo.asignacion_de_dispositivo(s, id_dispositivo):
            raise ConflictoError("El dispositivo ya tiene una asignacion")
        if repo_m.en_movimiento_activo(s, [id_dispositivo]):
            raise ConflictoError("El dispositivo esta en un movimiento activo")
        id_a = repo.crear_asignacion(s, id_dispositivo, id_org_beneficiaria, finalidad)
        estado_service.transicionar(s, id_dispositivo, "ASIGNADO", actor.id_usuario, f"Asignacion {id_a}")
        auditoria.registrar(s, "asignacion_beneficiario", "INSERT", id_a, None,
                            {"dispositivo": id_dispositivo, "beneficiario": id_org_beneficiaria}, actor.id_usuario)
    return {"id_asignacion": id_a, "id_dispositivo": id_dispositivo, "id_organizacion": id_org_beneficiaria, "entregada": False}


def confirmar_entrega(actor: Actor, id_asignacion: int) -> dict:
    exigir_permiso(actor.roles, "asignacion:confirmar")
    with transaccion() as s:
        a = repo.obtener_asignacion(s, id_asignacion, bloquear=True)
        if a is None or a["id_organizacion"] != actor.id_organizacion:
            raise NoEncontradoError("Asignacion no encontrada")
        if a["fecha_entrega"] is not None:
            raise ConflictoError("La entrega ya fue confirmada")
        repo.confirmar_entrega(s, id_asignacion)
        auditoria.registrar(s, "asignacion_beneficiario", "UPDATE", id_asignacion, {"entregada": False}, {"entregada": True}, actor.id_usuario)
    return {"id_asignacion": id_asignacion, "id_dispositivo": a["id_dispositivo"], "id_organizacion": a["id_organizacion"], "entregada": True}


def listar_asignaciones(actor: Actor, pagina: int, tamano: int) -> dict:
    exigir_permiso_ver_asignacion(actor)
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    como_benef = "ENTIDAD_BENEFICIARIA" in actor.roles and "COORDINADOR_LOGISTICO" not in actor.roles
    with transaccion() as s:
        total, filas = repo.listar_asignaciones(s, actor.id_organizacion, como_benef, (pagina - 1) * tamano, tamano)
    return {"items": [{**f, "entregada": f["fecha_entrega"] is not None} for f in filas], "total": total, "pagina": pagina, "tamano": tamano}


def exigir_permiso_ver_asignacion(actor: Actor) -> None:
    from ..domain.errors import PermisoDenegadoError
    if not ({"ENTIDAD_BENEFICIARIA", "COORDINADOR_LOGISTICO"} & set(actor.roles)):
        raise PermisoDenegadoError("No tienes permiso para: asignacion:ver")


# ---------------- cierre de trazabilidad (RN-08) ----------------
def registrar_cierre(actor: Actor, id_dispositivo: int, id_tratamiento: Optional[int], id_asignacion: Optional[int],
                     fecha_confirmacion: Optional[date]) -> dict:
    exigir_permiso(actor.roles, "cierre:registrar")
    try:
        with transaccion() as s:
            _dispositivo_visible(s, actor, id_dispositivo)
            estado = repo_d.estado_actual(s, id_dispositivo, bloquear=True)
            if repo.cierre_existe(s, id_dispositivo):
                raise ConflictoError("La trazabilidad de este dispositivo ya esta cerrada")
            trat = repo.obtener_tratamiento(s, id_tratamiento) if id_tratamiento else None
            if trat and trat["id_dispositivo"] != id_dispositivo:
                trat = None
            asig = repo.obtener_asignacion(s, id_asignacion) if id_asignacion else None
            if asig and asig["id_dispositivo"] != id_dispositivo:
                asig = None
            dc.validar_cierre(id_tratamiento, id_asignacion, fecha_confirmacion, date.today(), trat, asig, estado)
            id_c = repo.crear_cierre(s, fecha_confirmacion, id_dispositivo, id_tratamiento, id_asignacion)
            repo.cerrar_estancia_abierta(s, id_dispositivo)
            estado_service.transicionar(s, id_dispositivo, "CERRADO", actor.id_usuario, f"Cierre de trazabilidad {id_c}")
            lotes = repo.cerrar_lotes_completos(s, id_dispositivo)
            auditoria.registrar(s, "cierre_trazabilidad", "INSERT", id_c, None,
                                {"dispositivo": id_dispositivo, "tratamiento": id_tratamiento, "asignacion": id_asignacion,
                                 "fecha_confirmacion": fecha_confirmacion}, actor.id_usuario)
            destino = "TRATAMIENTO" if id_tratamiento else "ASIGNACION_BENEFICIARIO"
    except IntegrityError:
        raise ConflictoError("El tratamiento o la asignacion ya estan usados en otro cierre")
    return {"id_cierre": id_c, "id_dispositivo": id_dispositivo, "destino_final": destino,
            "fecha_confirmacion": fecha_confirmacion, "lotes_cerrados": lotes}


def consultar_cierre(actor: Actor, id_dispositivo: int) -> dict:
    exigir_permiso(actor.roles, "dispositivo:ver")
    with transaccion() as s:
        _dispositivo_visible(s, actor, id_dispositivo)
        c = repo.cierre_de_dispositivo(s, id_dispositivo)
    if c is None:
        raise NoEncontradoError("El dispositivo aun no tiene cierre de trazabilidad")
    return c
