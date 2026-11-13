"""Almacenamiento privado de evidencias. Local para desarrollo, S3 para la nube.
Las claves se validan siempre (sin '..', sin rutas absolutas). Nada se sirve de forma publica."""
import os
from pathlib import Path

from ..config import load_settings
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

    def __init__(self, bucket: str, region: str = "", kms_key_id: str = ""):
        import boto3  # import tardio: no es necesario para trabajar en local
        self.bucket = bucket
        self.kms_key_id = kms_key_id
        kwargs = {"region_name": region} if region else {}
        self.cliente = boto3.client("s3", **kwargs)

    def guardar(self, clave: str, contenido: bytes, content_type: str) -> None:
        if not clave_segura(clave):
            raise ClaveInvalida("Clave de objeto no valida")
        params = {
            "Bucket": self.bucket,
            "Key": clave,
            "Body": contenido,
            "ContentType": content_type,
        }
        if self.kms_key_id:
            params.update(ServerSideEncryption="aws:kms", SSEKMSKeyId=self.kms_key_id)
        else:
            params["ServerSideEncryption"] = "AES256"
        self.cliente.put_object(**params)

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
        s = load_settings()
        if s.storage_mode == "s3":
            _instancia = AlmacenamientoS3(s.s3_bucket, s.s3_region, s.s3_kms_key_id)
        else:
            _instancia = AlmacenamientoLocal(s.evidence_dir)
    return _instancia


def comprobar_almacenamiento() -> None:
    """Comprueba solo la configuracion y credenciales, sin crear objetos."""
    almacen = obtener_almacenamiento()
    if isinstance(almacen, AlmacenamientoS3):
        almacen.cliente.head_bucket(Bucket=almacen.bucket)
