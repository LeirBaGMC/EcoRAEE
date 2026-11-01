"""Reglas puras de evidencias: tamano, tipo real del archivo, objetivo unico y clave controlada por el servidor."""
import re
import uuid
from datetime import datetime
from typing import Optional

from .errors import ReglaNegocioError

# Tipo permitido -> (firma de los primeros bytes, extension). Se valida la firma, no solo lo que diga el cliente.
TIPOS_ARCHIVO = {
    "application/pdf": (b"%PDF-", "pdf"),
    "image/jpeg": (b"\xff\xd8\xff", "jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", "png"),
}
EXT_A_TIPO = {ext: ct for ct, (_, ext) in TIPOS_ARCHIVO.items()}
CLAVE_VALIDA = re.compile(r"^evidencias/\d{4}/\d{2}/[0-9a-f]{32}\.(pdf|jpg|png)$")

PROPOSITOS = ("AUDITORIA", "VERIFICACION_CIERRE", "EVALUACION")

# PROPUESTA: a que entidad puede respaldar cada tipo de evidencia.
OBJETIVOS_POR_TIPO = {
    "FOTO_REGISTRO": {"recepcion", "evaluacion"},
    "ACTA_RECEPCION": {"recepcion"},
    "INFORME_EVALUACION": {"evaluacion"},
    "GUIA_TRASLADO": {"movimiento"},
    "CERTIFICADO_TRATAMIENTO": {"cierre"},
    "ACTA_ENTREGA": {"cierre"},
}


def objetivo_de(id_recepcion, id_dispositivo_evaluacion, nro_evaluacion, id_movimiento, id_cierre) -> str:
    """Devuelve cual es el UNICO objetivo indicado. Coincide con el CHECK de la BD."""
    if (id_dispositivo_evaluacion is None) != (nro_evaluacion is None):
        raise ReglaNegocioError("Para una evaluacion indica id_dispositivo_evaluacion y nro_evaluacion")
    presentes = [n for n, v in (("recepcion", id_recepcion), ("evaluacion", id_dispositivo_evaluacion),
                                ("movimiento", id_movimiento), ("cierre", id_cierre)) if v is not None]
    if len(presentes) != 1:
        raise ReglaNegocioError("La evidencia debe respaldar exactamente una entidad (recepcion, evaluacion, movimiento o cierre)")
    return presentes[0]


def validar_tipo_vs_objetivo(tipo: str, objetivo: str) -> None:
    if tipo not in OBJETIVOS_POR_TIPO:
        raise ReglaNegocioError("tipo_evidencia no valido")
    if objetivo not in OBJETIVOS_POR_TIPO[tipo]:
        raise ReglaNegocioError(f"Una evidencia {tipo} no puede respaldar un/a {objetivo}")


def validar_archivo(content_type: Optional[str], contenido: bytes, max_bytes: int) -> str:
    """Devuelve la extension. Rechaza vacio, demasiado grande, tipo no permitido o firma que no coincide."""
    if not contenido:
        raise ReglaNegocioError("El archivo esta vacio")
    if len(contenido) > max_bytes:
        raise ReglaNegocioError(f"El archivo supera el maximo de {max_bytes} bytes")
    if content_type not in TIPOS_ARCHIVO:
        raise ReglaNegocioError("Tipo de archivo no permitido (solo PDF, JPG o PNG)")
    firma, ext = TIPOS_ARCHIVO[content_type]
    if not contenido.startswith(firma):
        raise ReglaNegocioError("El contenido del archivo no corresponde a su tipo")
    return ext


def generar_clave(ext: str, ahora: Optional[datetime] = None) -> str:
    """La clave del objeto la decide el servidor. Nunca se usa el nombre que mande el cliente."""
    ahora = ahora or datetime.now()
    return f"evidencias/{ahora:%Y}/{ahora:%m}/{uuid.uuid4().hex}.{ext}"


def clave_segura(clave: str) -> bool:
    return bool(CLAVE_VALIDA.match(clave or ""))


def tipo_de_clave(clave: str) -> str:
    return EXT_A_TIPO[clave.rsplit(".", 1)[1]]
