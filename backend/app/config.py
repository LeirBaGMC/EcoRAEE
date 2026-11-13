"""Configuracion externa. Nada de secretos en el codigo."""
import os
from dataclasses import dataclass
from functools import lru_cache

try:  # carga el archivo .env si existe (opcional)
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


@dataclass(frozen=True)
class Settings:
    db_url: str
    cors_origins: tuple
    evidence_max_bytes: int
    storage_mode: str
    evidence_dir: str
    s3_bucket: str
    s3_region: str
    s3_kms_key_id: str
    db_pool_size: int
    db_max_overflow: int
    db_pool_timeout: int
    db_pool_recycle: int


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    value = os.environ.get(name, str(default))
    try:
        parsed = int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} debe ser un entero") from exc
    if parsed < minimum:
        raise RuntimeError(f"{name} debe ser mayor o igual que {minimum}")
    return parsed


@lru_cache(maxsize=1)
def load_settings() -> Settings:
    storage_mode = os.environ.get("ECORAEE_STORAGE", "local").strip().lower()
    if storage_mode not in {"local", "s3"}:
        raise RuntimeError("ECORAEE_STORAGE debe ser 'local' o 's3'")

    s3_bucket = os.environ.get("ECORAEE_S3_BUCKET", "").strip()
    if storage_mode == "s3" and not s3_bucket:
        raise RuntimeError("Falta ECORAEE_S3_BUCKET cuando ECORAEE_STORAGE=s3")

    return Settings(
        db_url=os.environ.get("ECORAEE_DB_URL", "").strip(),
        cors_origins=tuple(o.strip() for o in os.environ.get("ECORAEE_CORS_ORIGINS", "").split(",") if o.strip()),
        evidence_max_bytes=_int_env("ECORAEE_EVIDENCE_MAX_BYTES", 10 * 1024 * 1024),
        storage_mode=storage_mode,
        evidence_dir=os.environ.get("ECORAEE_EVIDENCE_DIR", "almacen_evidencias").strip(),
        s3_bucket=s3_bucket,
        s3_region=os.environ.get("AWS_REGION", "").strip(),
        s3_kms_key_id=os.environ.get("ECORAEE_S3_KMS_KEY_ID", "").strip(),
        db_pool_size=_int_env("ECORAEE_DB_POOL_SIZE", 5),
        db_max_overflow=_int_env("ECORAEE_DB_MAX_OVERFLOW", 10, minimum=0),
        db_pool_timeout=_int_env("ECORAEE_DB_POOL_TIMEOUT", 30),
        db_pool_recycle=_int_env("ECORAEE_DB_POOL_RECYCLE", 1800),
    )
