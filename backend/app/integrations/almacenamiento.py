"""Almacenamiento privado de evidencias. Local para desarrollo, S3 para la nube.
Las claves se validan siempre (sin '..', sin rutas absolutas). Nada se sirve de forma publica."""
import os
from pathlib import Path

from ..domain.evidencia import clave_segura


class ClaveInvalida(ValueError):
    pass


class AlmacenamientoLocal:
    """IMPLEMENTADO y probado con pruebas unitarias."""

    def __init__(self, base_dir: str):
        self.base = Path(base_dir).resolve()

    def _ruta(self, clave: str) -> Path:
        if not clave_segura(clave):
            raise ClaveInvalida("Clave de objeto no valida")
        ruta = (self.base / clave).resolve()
        if self.base not in ruta.parents:
            raise ClaveInvalida("Clave fuera del almacen")
        return ruta

    def guardar(self, clave: str, contenido: bytes, content_type: str) -> None:
        ruta = self._ruta(clave)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        tmp = ruta.with_suffix(ruta.suffix + ".tmp")
        tmp.write_bytes(contenido)
        os.replace(tmp, ruta)                     # escritura atomica: nunca queda un archivo a medias

    def leer(self, clave: str) -> bytes:
        return self._ruta(clave).read_bytes()

    def eliminar(self, clave: str) -> None:
        self._ruta(clave).unlink(missing_ok=True)


class AlmacenamientoS3:
    """ESCRITO, NO VERIFICADO: requiere boto3, un bucket privado y credenciales por rol IAM (sin claves en el codigo).
    No se usa mientras ECORAEE_STORAGE sea 'local'. Se activa en la fase Cloud con autorizacion."""

    def __init__(self, bucket: str):
        import boto3  # import tardio: no es necesario para trabajar en local
        self.bucket = bucket
        self.cliente = boto3.client("s3")

    def guardar(self, clave: str, contenido: bytes, content_type: str) -> None:
        if not clave_segura(clave):
            raise ClaveInvalida("Clave de objeto no valida")
        self.cliente.put_object(Bucket=self.bucket, Key=clave, Body=contenido, ContentType=content_type,
                                ServerSideEncryption="AES256")

    def leer(self, clave: str) -> bytes:
        if not clave_segura(clave):
            raise ClaveInvalida("Clave de objeto no valida")
        return self.cliente.get_object(Bucket=self.bucket, Key=clave)["Body"].read()

    def eliminar(self, clave: str) -> None:
        if not clave_segura(clave):
            raise ClaveInvalida("Clave de objeto no valida")
        self.cliente.delete_object(Bucket=self.bucket, Key=clave)


_instancia = None


def obtener_almacenamiento():
    global _instancia
    if _instancia is None:
        modo = os.environ.get("ECORAEE_STORAGE", "local")
        if modo == "s3":
            _instancia = AlmacenamientoS3(os.environ["ECORAEE_S3_BUCKET"])
        else:
            _instancia = AlmacenamientoLocal(os.environ.get("ECORAEE_EVIDENCE_DIR", "almacen_evidencias"))
    return _instancia
