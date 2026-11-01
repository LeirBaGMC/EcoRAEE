"""Evidencias. RN-07: se consultan solo por roles Y propositos autorizados, dentro de su alcance.
S3 (o disco) y la BD no comparten transaccion: primero se guarda el objeto, luego se registra en BD;
si la BD falla se borra el objeto. Si ese borrado tambien falla queda un huerfano, que se deja en el log."""
import logging
from typing import Optional

from ..config import load_settings
from ..db import transaccion
from ..domain import evidencia as de
from ..domain import rules
from ..domain.errors import NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..integrations.almacenamiento import obtener_almacenamiento
from ..persistence import auditoria
from ..persistence import evidencias as repo
from ..security import Actor

log = logging.getLogger("ecoraee.evidencias")
_CAMPOS = ("id_recepcion", "id_dispositivo_evaluacion", "nro_evaluacion", "id_movimiento", "id_cierre")


def _metadatos(e: dict) -> dict:
    # La clave del objeto (uri_archivo) es interna y nunca se expone ni se usa como enlace permanente.
    return {k: e[k] for k in ("id_evidencia", "tipo_evidencia", "descripcion", "fecha_carga", *_CAMPOS)}


def _comprobar_alcance(s, actor: Actor, objetivo: str, ids: dict) -> None:
    orgs = repo.organizaciones_del_objetivo(s, objetivo, ids)
    if actor.id_organizacion not in orgs:
        raise NoEncontradoError("Elemento no encontrado")      # no se distingue "no existe" de "no es tuyo"


def subir(actor: Actor, tipo: str, descripcion: Optional[str], ids: dict, content_type: Optional[str], contenido: bytes) -> dict:
    exigir_permiso(actor.roles, "evidencia:subir")
    ids = {k: ids.get(k) for k in _CAMPOS}
    objetivo = de.objetivo_de(*(ids[k] for k in _CAMPOS))
    de.validar_tipo_vs_objetivo(tipo, objetivo)
    ext = de.validar_archivo(content_type, contenido, load_settings().evidence_max_bytes)
    if descripcion and len(descripcion) > 255:
        raise ReglaNegocioError("La descripcion admite como maximo 255 caracteres")
    with transaccion() as s:                                    # alcance antes de guardar nada
        _comprobar_alcance(s, actor, objetivo, ids)
    almacen = obtener_almacenamiento()
    clave = de.generar_clave(ext)
    almacen.guardar(clave, contenido, content_type)
    try:
        with transaccion() as s:
            id_ev = repo.insertar(s, tipo, descripcion, clave, ids)
            auditoria.registrar(s, "evidencia", "INSERT", id_ev, None, {"tipo": tipo, "objetivo": objetivo}, actor.id_usuario)
            meta = _metadatos(repo.obtener(s, id_ev))
    except Exception:
        try:
            almacen.eliminar(clave)
        except Exception:
            log.error("EVIDENCIA_HUERFANA clave=%s (la BD fallo y no se pudo borrar el objeto)", clave)
        raise
    return meta


def _autorizar(actor: Actor, proposito: str) -> None:
    exigir_permiso(actor.roles, "evidencia:ver")
    rules.validar_acceso_evidencia(actor.roles, proposito)      # RN-07


def _objetivo_de_fila(e: dict):
    ids = {k: e[k] for k in _CAMPOS}
    return de.objetivo_de(*(ids[k] for k in _CAMPOS)), ids


def descargar(actor: Actor, id_evidencia: int, proposito: str):
    """Devuelve (contenido, content_type). El acceso queda en el log tecnico con actor, recurso y proposito."""
    _autorizar(actor, proposito)
    with transaccion() as s:
        e = repo.obtener(s, id_evidencia)
        if e is None:
            raise NoEncontradoError("Evidencia no encontrada")
        objetivo, ids = _objetivo_de_fila(e)
        _comprobar_alcance(s, actor, objetivo, ids)
    log.info("ACCESO_EVIDENCIA usuario=%s evidencia=%s proposito=%s", actor.id_usuario, id_evidencia, proposito)
    return obtener_almacenamiento().leer(e["uri_archivo"]), de.tipo_de_clave(e["uri_archivo"])


def listar(actor: Actor, proposito: str, ids: dict) -> list:
    _autorizar(actor, proposito)
    ids = {k: ids.get(k) for k in _CAMPOS}
    objetivo = de.objetivo_de(*(ids[k] for k in _CAMPOS))
    with transaccion() as s:
        _comprobar_alcance(s, actor, objetivo, ids)
        return [_metadatos(e) for e in repo.listar_por_objetivo(s, ids)]
