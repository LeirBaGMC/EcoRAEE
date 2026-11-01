"""Configuracion externa. Nada de secretos en el codigo."""
import os
from dataclasses import dataclass

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


def load_settings() -> Settings:
    return Settings(
        db_url=os.environ.get("ECORAEE_DB_URL", ""),
        cors_origins=tuple(o for o in os.environ.get("ECORAEE_CORS_ORIGINS", "").split(",") if o),
        evidence_max_bytes=int(os.environ.get("ECORAEE_EVIDENCE_MAX_BYTES", 10 * 1024 * 1024)),
    )
